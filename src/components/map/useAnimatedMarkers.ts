import { useEffect, useReducer, useRef } from 'react'
import { Animated } from 'react-native'
import { AnimatedRegion } from 'react-native-maps'

import type { FacilityCluster, FacilitySearchResult } from '../../lib/api'

const FLY_DURATION = 320
const FADE_DURATION = 220
// An entering marker only flies from a vanished one within this fraction of
// the current extent (the bounding diagonal of everything in play this
// update) — otherwise it fades in in place. Without a cap, an unrelated pair
// of markers leaving and arriving on opposite sides of the same viewport
// update would fly across the whole map at each other, reading as a bug
// rather than a cluster splitting or merging.
const FLIGHT_EXTENT_FRACTION = 0.4
// How close a new cluster from the server has to sit to a previously tracked
// one (as a fraction of the same extent) to be treated as the SAME cluster
// rather than a fresh one. Needed because supercluster's cluster_id is tied
// to a tree node at a specific zoom level: zooming by even one level gives
// almost every on-screen cluster a brand new id even when the real-world
// grouping barely moved, which without this match would read as the entire
// map flushing and re-entering on every zoom step.
const CLUSTER_MATCH_FRACTION = 0.3

interface Tracked {
  kind: 'point' | 'cluster'
  data: FacilitySearchResult | FacilityCluster
  region: AnimatedRegion
  progress: Animated.Value
  animating: boolean
  visible: boolean
  lat: number
  lng: number
}

export interface AnimatedPointMarker {
  key: string
  kind: 'point'
  data: FacilitySearchResult
  region: AnimatedRegion
  progress: Animated.Value
  animating: boolean
}

export interface AnimatedClusterMarker {
  key: string
  kind: 'cluster'
  data: FacilityCluster
  region: AnimatedRegion
  progress: Animated.Value
  animating: boolean
}

export type AnimatedMarkerItem = AnimatedPointMarker | AnimatedClusterMarker

interface Entry {
  key: string
  kind: 'point' | 'cluster'
  lat: number
  lng: number
  data: FacilitySearchResult | FacilityCluster
}

function squaredDistance(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = aLat - bLat
  const dLng = aLng - bLng
  return dLat * dLat + dLng * dLng
}

function extentOf(points: { lat: number; lng: number }[]): number {
  if (points.length === 0) return 0
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  return Math.sqrt((maxLat - minLat) ** 2 + (maxLng - minLng) ** 2)
}

function fadeTo(progress: Animated.Value, toValue: 0 | 1, onDone?: () => void): void {
  Animated.timing(progress, {
    toValue,
    duration: toValue === 1 ? FLY_DURATION : FADE_DURATION,
    useNativeDriver: true,
  }).start(({ finished }) => {
    if (finished) onDone?.()
  })
}

/**
 * Resolves each incoming cluster to the tracking key of whichever previously
 * tracked cluster sits nearest to it (within `thresholdSq`), picking globally
 * closest pairs first so two candidates never fight over the same match.
 * Unmatched clusters get a fresh key. This is what keeps a cluster's own
 * marker stable — same key, same AnimatedRegion, no fade — across a zoom
 * step even though the server hands it a brand new cluster_id every time,
 * reserving the enter/exit animation for clusters that actually appear or
 * disappear rather than every cluster on every zoom change.
 */
function resolveClusterKeys(
  clusters: FacilityCluster[],
  trackedClusters: [string, Tracked][],
  thresholdSq: number,
  nextKey: () => string,
): string[] {
  const candidates: { ni: number; key: string; d: number }[] = []
  clusters.forEach((c, ni) => {
    for (const [key, t] of trackedClusters) {
      const d = squaredDistance(c.lat, c.lng, t.lat, t.lng)
      if (d <= thresholdSq) candidates.push({ ni, key, d })
    }
  })
  candidates.sort((a, b) => a.d - b.d)

  const matchedNext = new Set<number>()
  const matchedTracked = new Set<string>()
  const resolved = new Map<number, string>()
  for (const cand of candidates) {
    if (matchedNext.has(cand.ni) || matchedTracked.has(cand.key)) continue
    matchedNext.add(cand.ni)
    matchedTracked.add(cand.key)
    resolved.set(cand.ni, cand.key)
  }

  return clusters.map((_, ni) => resolved.get(ni) ?? nextKey())
}

/**
 * Keeps one persistent Marker per point/cluster across server-driven cluster
 * rebuilds, so crossing SEARCH_RENDER_BUDGET or a supercluster zoom bucket
 * reads as markers flying apart or converging rather than a hard swap.
 *
 * Points key on their real facility id, which is genuinely stable. Clusters
 * have no stable server id across zoom levels, so they're re-identified each
 * update by nearest position (resolveClusterKeys) — without that, a cluster
 * that simply recentres one zoom level up would look identical to the whole
 * screen's clusters vanishing and re-entering at once. Whatever's left after
 * that resolution is a genuine appearance or disappearance: an arriving
 * marker with no prior counterpart flies in from whichever marker just
 * vanished nearest to it — an approximation (the server exposes no real
 * parent/child relationship), but the right one in both directions.
 *
 * Re-renders only when something visible actually changed (a marker
 * appeared, disappeared, or a continuing marker's kind/count changed) —
 * a same-content refetch or a marker drifting a few metres updates its
 * AnimatedRegion directly without forcing React to redo the marker list.
 */
export function useAnimatedMarkers(
  results: FacilitySearchResult[],
  clusters: FacilityCluster[],
): AnimatedMarkerItem[] {
  const tracked = useRef(new Map<string, Tracked>())
  const clusterKeySeq = useRef(0)
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const pointEntries: Entry[] = results.map((r) => ({
      key: `p:${r.id}`,
      kind: 'point' as const,
      lat: r.lat,
      lng: r.lng,
      data: r,
    }))

    const trackedClusterPairs = [...tracked.current.entries()].filter(
      (pair): pair is [string, Tracked] => pair[1].kind === 'cluster',
    )
    const matchExtent = extentOf([
      ...results,
      ...clusters,
      ...[...tracked.current.values()].map((t) => ({ lat: t.lat, lng: t.lng })),
    ])
    const clusterKeys = resolveClusterKeys(
      clusters,
      trackedClusterPairs,
      (matchExtent * CLUSTER_MATCH_FRACTION) ** 2,
      () => `c:new:${clusterKeySeq.current++}`,
    )
    const clusterEntries: Entry[] = clusters.map((c, i) => ({
      key: clusterKeys[i]!,
      kind: 'cluster' as const,
      lat: c.lat,
      lng: c.lng,
      data: c,
    }))

    const nextEntries: Entry[] = [...pointEntries, ...clusterEntries]
    const nextKeys = new Set(nextEntries.map((e) => e.key))
    const vanishingEntries = [...tracked.current.entries()].filter(([key]) => !nextKeys.has(key))
    const vanishing = vanishingEntries.map(([, v]) => v)
    const maxFlightSq = (extentOf([...nextEntries, ...vanishing]) * FLIGHT_EXTENT_FRACTION) ** 2

    let changed = false

    for (const entry of nextEntries) {
      const existing = tracked.current.get(entry.key)
      if (existing) {
        // Only kind (point) / count (cluster) feed this marker's own JSX —
        // everything else in `data` (price, availability, ...) is read
        // straight from `results` elsewhere, so it needs no re-render here.
        const contentChanged =
          entry.kind === 'point'
            ? (existing.data as FacilitySearchResult).kind !==
              (entry.data as FacilitySearchResult).kind
            : (existing.data as FacilityCluster).count !== (entry.data as FacilityCluster).count
        if (contentChanged) changed = true
        existing.data = entry.data

        if (existing.lat !== entry.lat || existing.lng !== entry.lng) {
          existing.lat = entry.lat
          existing.lng = entry.lng
          existing.region
            .timing({
              latitude: entry.lat,
              longitude: entry.lng,
              duration: FLY_DURATION,
              useNativeDriver: false,
            } as never)
            .start()
        }
        if (!existing.visible) {
          // Reappeared before its own fade-out finished (a bounds flap right at
          // a supercluster bucket boundary) — bring it back instead of leaving
          // it stuck fading toward invisible.
          existing.visible = true
          existing.animating = true
          changed = true
          fadeTo(existing.progress, 1, () => {
            existing.animating = false
            forceRender()
          })
        }
        continue
      }

      changed = true
      let nearest: Tracked | null = null
      for (const v of vanishing) {
        const d = squaredDistance(entry.lat, entry.lng, v.lat, v.lng)
        if (d > maxFlightSq) continue
        if (!nearest || d < squaredDistance(entry.lat, entry.lng, nearest.lat, nearest.lng)) {
          nearest = v
        }
      }

      const region = new AnimatedRegion({
        latitude: nearest?.lat ?? entry.lat,
        longitude: nearest?.lng ?? entry.lng,
      })
      const progress = new Animated.Value(0)
      tracked.current.set(entry.key, {
        kind: entry.kind,
        data: entry.data,
        region,
        progress,
        animating: true,
        visible: true,
        lat: entry.lat,
        lng: entry.lng,
      })

      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(progress, {
          toValue: 1,
          duration: nearest ? FLY_DURATION : FADE_DURATION,
          useNativeDriver: true,
        }),
      ]
      if (nearest) {
        animations.push(
          region.timing({
            latitude: entry.lat,
            longitude: entry.lng,
            duration: FLY_DURATION,
            useNativeDriver: false,
          } as never),
        )
      }
      Animated.parallel(animations).start(() => {
        const t = tracked.current.get(entry.key)
        if (t) t.animating = false
        forceRender()
      })
    }

    for (const [key, gone] of vanishingEntries) {
      changed = true
      gone.visible = false
      gone.animating = true
      fadeTo(gone.progress, 0, () => {
        tracked.current.delete(key)
        forceRender()
      })
    }

    if (changed) forceRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, clusters])

  return [...tracked.current.entries()].map(
    ([key, t]) =>
      ({
        key,
        kind: t.kind,
        data: t.data,
        region: t.region,
        progress: t.progress,
        animating: t.animating,
      }) as AnimatedMarkerItem,
  )
}
