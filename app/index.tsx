import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { BottomSheet } from '../src/components/BottomSheet'
import { defaultEnd, defaultStart, type BookingValue } from '../src/components/BookingForm'
import { computeDistanceMeters } from '@parqin/maps'
import { Map } from '../src/components/map'
import type { MapBounds, MapRegion } from '../src/components/map'
import { searchFacilities, type FacilitySearchResult } from '../src/lib/api'
import { FALLBACK_CENTER } from '../src/lib/constants'
import { useUserLocation } from '../src/lib/location'
import { useDebouncedCallback } from '../src/lib/useDebouncedCallback'
import { colors, space } from '../src/theme'

const MIN_RADIUS = 300
const MAX_RADIUS = 50_000
// How many of the closest parkings to frame alongside the user on first load.
const FIT_NEAREST = 3
// Over-fetch this fraction beyond the viewport on each side, so small pans stay
// inside the already-fetched area and need no new request.
const FETCH_PADDING = 0.5

function contains(outer: MapBounds, inner: MapBounds): boolean {
  return (
    inner.north <= outer.north &&
    inner.south >= outer.south &&
    inner.east <= outer.east &&
    inner.west >= outer.west
  )
}

function padBounds(b: MapBounds, factor: number): MapBounds {
  const dLat = (b.north - b.south) * factor
  const dLng = (b.east - b.west) * factor
  return { north: b.north + dLat, south: b.south - dLat, east: b.east + dLng, west: b.west - dLng }
}

function within(b: MapBounds, p: { lat: number; lng: number }): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east
}

// Module-scoped so the one-off initial fit (and its search) runs once per app
// session, not on every navigation back to Home — avoids redundant data/battery.
let initialFitDone = false

// The browse list uses a default window just to surface availability; the user
// picks the actual booking window (and sees the price) on the facility screen.
function defaultWindow(): BookingValue {
  const start = defaultStart()
  return {
    startsAt: start.toISOString(),
    endsAt: defaultEnd(start).toISOString(),
    vehicleType: 'CAR',
  }
}

export default function HomeScreen() {
  const { coords, status, retry } = useUserLocation()

  const [applied] = useState<BookingValue>(defaultWindow)
  const [center, setCenter] = useState(FALLBACK_CENTER)
  const [centerNonce, setCenterNonce] = useState(0)
  const [viewport, setViewport] = useState<MapRegion | null>(null)
  const [results, setResults] = useState<FacilitySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fitBounds, setFitBounds] = useState<MapBounds | null>(null)
  const [fitNonce, setFitNonce] = useState(0)
  const [collapseNonce, setCollapseNonce] = useState(0)
  const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null)
  const autoLocated = useRef(false)
  // The padded bounds the current results cover; pans inside it skip refetching.
  const lastFetched = useRef<MapBounds | null>(null)

  function recenterTo(c: { lat: number; lng: number }) {
    setCenter(c)
    setCenterNonce((n) => n + 1)
  }

  // Recenter on the user's first GPS fix.
  useEffect(() => {
    if (coords && !autoLocated.current) {
      autoLocated.current = true
      recenterTo(coords)
    }
  }, [coords])

  // On the first GPS fix, run one explicit search centered on the user and frame
  // the user with the closest few parkings. Decoupled from the viewport (which is
  // driven by map gestures) so the initial fit fires deterministically instead of
  // racing the recenter → region → debounce → search round-trip.
  useEffect(() => {
    if (initialFitDone || !coords) return
    initialFitDone = true
    const here = coords
    const controller = new AbortController()
    searchFacilities(
      {
        lat: here.lat,
        lng: here.lng,
        radiusMeters: MAX_RADIUS,
        startsAt: applied.startsAt,
        endsAt: applied.endsAt,
        vehicleType: applied.vehicleType,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        if (data.length === 0) return
        const nearest = [...data]
          .sort((a, b) => computeDistanceMeters(here, a) - computeDistanceMeters(here, b))
          .slice(0, FIT_NEAREST)
        setFitBounds({
          north: Math.max(here.lat, ...nearest.map((r) => r.lat)),
          south: Math.min(here.lat, ...nearest.map((r) => r.lat)),
          east: Math.max(here.lng, ...nearest.map((r) => r.lng)),
          west: Math.min(here.lng, ...nearest.map((r) => r.lng)),
        })
        setFitNonce((n) => n + 1)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [coords, applied.startsAt, applied.endsAt, applied.vehicleType])

  // Refetch for the visible map area (debounced) or when the booking window /
  // vehicle changes. Viewport drives the query coords; the form supplies the rest.
  useEffect(() => {
    if (!viewport) return
    const controller = new AbortController()
    // Fetch a padded area so nearby pans are already covered; remember it so the
    // region handler can skip refetching while the viewport stays inside it.
    const requestBounds = padBounds(viewport.bounds, FETCH_PADDING)
    lastFetched.current = requestBounds
    // Skeleton only when there's nothing to show. With a populated list the
    // refresh is silent (swap in place), so consecutive map moves don't flash
    // the loading state; an empty result then surfaces the empty-state.
    if (results.length === 0) setLoading(true)
    setError(null)
    searchFacilities(
      {
        lat: viewport.lat,
        lng: viewport.lng,
        radiusMeters: viewport.radiusMeters,
        bounds: requestBounds,
        startsAt: applied.startsAt,
        endsAt: applied.endsAt,
        vehicleType: applied.vehicleType,
      },
      { signal: controller.signal },
    )
      .then((data) => setResults(data))
      .catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return
        lastFetched.current = null
        setError(e instanceof Error ? e.message : 'Η αναζήτηση απέτυχε')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // results is read for the initial-load check only; adding it would refetch on every result change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, applied?.startsAt, applied?.endsAt, applied?.vehicleType])

  // The API returns distance from the search center (the viewport), so it drifts
  // as the map pans. Recompute it from the user's location and sort by it, so the
  // displayed distance is the true user→spot distance and stays stable on pan.
  // Markers keep the full (over-fetched) set so pans reveal nearby spots instantly.
  const mapResults = useMemo(() => {
    if (!coords) return results
    return results
      .map((r) => ({ ...r, distanceMeters: computeDistanceMeters(coords, r) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [results, coords])

  // The list shows only spots inside the current viewport — the over-fetched ring
  // stays on the map but out of the list.
  const listResults = useMemo(
    () => (visibleBounds ? mapResults.filter((r) => within(visibleBounds, r)) : mapResults),
    [mapResults, visibleBounds],
  )

  const onRegionChange = useDebouncedCallback((region: MapRegion) => {
    // Always track the visible area so the list shows only in-view spots, even
    // when the fetch is skipped.
    setVisibleBounds(region.bounds)
    // Skip the request while the visible area stays within what we already fetched.
    if (lastFetched.current && contains(lastFetched.current, region.bounds)) return
    setViewport({
      lat: region.lat,
      lng: region.lng,
      radiusMeters: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, region.radiusMeters)),
      bounds: region.bounds,
    })
  }, 700)

  function locateMe() {
    if (coords) recenterTo({ ...coords })
    retry()
  }

  const openFacility = useCallback(
    (id: string) => {
      router.push({
        pathname: '/facility/[id]',
        params: {
          id,
          startsAt: applied.startsAt,
          endsAt: applied.endsAt,
          vehicleType: applied.vehicleType,
        },
      })
    },
    [applied.startsAt, applied.endsAt, applied.vehicleType],
  )

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <Map
          center={center}
          centerNonce={centerNonce}
          user={coords}
          fitBounds={fitBounds}
          fitNonce={fitNonce}
          results={mapResults}
          onMarkerPress={openFacility}
          onRegionChange={onRegionChange}
          onMapPress={() => setCollapseNonce((n) => n + 1)}
        />
      </View>

      <Pressable
        onPress={locateMe}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons
          name={status === 'denied' ? 'location-outline' : 'locate'}
          size={22}
          color={colors.primary}
        />
      </Pressable>

      <BottomSheet
        results={listResults}
        loading={loading}
        error={error}
        onSelect={openFacility}
        collapse={collapseNonce}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: {
    position: 'absolute',
    right: space.md,
    bottom: 148,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
})
