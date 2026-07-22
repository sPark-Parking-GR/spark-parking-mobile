import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { computeDistanceMeters, generalizedCostCents } from '@spark/maps'
import { spacing, useTheme } from '@spark/ui'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { defaultEnd, defaultStart, type BookingValue } from '../../src/components/BookingForm'
import { BottomSheet, type SortMode } from '../../src/components/BottomSheet'
import { Map } from '../../src/components/map'
import type { MapBounds, MapRegion } from '../../src/components/map'
import { SelectedFacilityCard } from '../../src/components/map/SelectedFacilityCard'
import { useLanguage } from '../../src/i18n/LanguageProvider'
import {
  searchFacilities,
  type FacilityCluster,
  type FacilitySearchResult,
} from '../../src/lib/api'
import { FALLBACK_CENTER, tabBarFloatOffset, vehicleLabel } from '../../src/lib/constants'
import { openDirections } from '../../src/lib/directions'
import { formatDateTimeShort } from '../../src/lib/format'
import { useUserLocation } from '../../src/lib/location'
import { useDebouncedCallback } from '../../src/lib/useDebouncedCallback'
import { useOverlay } from '../../src/navigation/OverlayContext'
import { useSheetExpandProgress } from '../../src/navigation/SheetExpandContext'

const MIN_RADIUS = 300
const MAX_RADIUS = 50_000
// How many of the closest parkings to frame alongside the user on first load.
const FIT_NEAREST = 4
// Over-fetch this fraction beyond the viewport on each side, so small pans stay
// inside the already-fetched area and need no new request.
const FETCH_PADDING = 0.5
// Gap kept above the bottom sheet's current top edge for the recenter FAB and
// the selected-spot card, so both sit close to the sheet without touching it —
// at every detent and mid-drag position, not just peek/expanded.
const FAB_GAP_ABOVE_SHEET = spacing.sm
// Mirrors the sheet's own peek-detent header height (see BottomSheet's
// PEEK_HEADER_ROOM), just to seed the shared value before the sheet's first
// animated frame reports the real one — avoids a one-frame flash at bottom:0.
const PEEK_HEADER_ROOM = 88
const TOP_ROW_HEIGHT = 50
const RECENTER_FAB_SIZE = 46
// Keeps the selected-spot card clear of the recenter FAB to its right.
const CARD_RIGHT_OFFSET = spacing.md + RECENTER_FAB_SIZE + spacing.sm

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
  // Clamp to valid lat/lng so a padded continent-scale viewport doesn't exceed the
  // API's ±90/±180 bounds and get rejected as a validation error.
  return {
    north: Math.min(90, b.north + dLat),
    south: Math.max(-90, b.south - dLat),
    east: Math.min(180, b.east + dLng),
    west: Math.max(-180, b.west - dLng),
  }
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

export default function MapScreen() {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const { coords, status, retry } = useUserLocation()
  const { openFacilityDetail, openTimePicker, openFilters } = useOverlay()
  const insets = useSafeAreaInsets()
  const barOffset = tabBarFloatOffset(insets.bottom)
  const sheetProgress = useSheetExpandProgress()

  const [applied, setApplied] = useState<BookingValue>(defaultWindow)
  const [sortMode, setSortMode] = useState<SortMode>('nearby')
  const [center, setCenter] = useState(FALLBACK_CENTER)
  const [centerNonce, setCenterNonce] = useState(0)
  const [viewport, setViewport] = useState<MapRegion | null>(null)
  const [results, setResults] = useState<FacilitySearchResult[]>([])
  const [clusters, setClusters] = useState<FacilityCluster[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fitBounds, setFitBounds] = useState<MapBounds | null>(null)
  const [fitNonce, setFitNonce] = useState(0)
  const [collapseNonce, setCollapseNonce] = useState(0)
  const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null)
  const [atUser, setAtUser] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const autoLocated = useRef(false)
  // The padded bounds the current results cover; pans inside it skip refetching.
  const lastFetched = useRef<MapBounds | null>(null)
  // The sheet's live visible height (px above the screen bottom), mirrored from
  // its internal translateY on every frame — see BottomSheet's heightValue prop.
  const sheetHeight = useSharedValue(barOffset + PEEK_HEADER_ROOM)
  const floatingStyle = useAnimatedStyle(() => ({
    bottom: sheetHeight.value + FAB_GAP_ABOVE_SHEET,
  }))
  // Measured once the selected-spot card has laid out at least once; kept across
  // deselects so the very next selection already has a good estimate.
  const cardHeightRef = useRef(130)
  // Mirrors selectedId synchronously (state updates land a render later, too
  // late for the centering math below, which runs in the same tap handler that
  // sets selectedId).
  const selectedIdRef = useRef<string | null>(null)

  // Space the floating top bar (search pill + filters button) occupies, plus a
  // gap below it — mirrors FAB_GAP_ABOVE_SHEET's role at the bottom, so the
  // "available viewport" doesn't hug either edge.
  const topOcclusion = insets.top + spacing.sm + TOP_ROW_HEIGHT + spacing.sm

  // How far (px) a centered point should shift from the literal screen middle,
  // read fresh whenever the map centers a point — spot taps and recenter-to-user
  // alike — so it lands in the middle of the viewport still actually visible
  // between the top bar and the bottom sheet (+ card, if one is showing), across
  // all four sheet-detent × card combinations.
  const getCenterOffsetPx = useCallback(() => {
    const bottomOcclusion =
      sheetHeight.value + (selectedIdRef.current ? FAB_GAP_ABOVE_SHEET + cardHeightRef.current : 0)
    return (bottomOcclusion - topOcclusion) / 2
  }, [topOcclusion])

  function recenterTo(c: { lat: number; lng: number }) {
    setCenter(c)
    setCenterNonce((n) => n + 1)
  }

  // Collapse the sheet back to peek when leaving this tab, so the tab bar's
  // label/shrink state (driven by the sheet's own progress) always resets too
  // instead of staying expanded-looking on tabs that have no sheet at all.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setCollapseNonce((n) => n + 1)
        selectedIdRef.current = null
        setSelectedId(null)
      }
    }, []),
  )

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
      .then((resp) => {
        const data = resp.points
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
      .then((resp) => {
        setResults(resp.points)
        setClusters(resp.clusters)
      })
      .catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return
        lastFetched.current = null
        setError(e instanceof Error ? e.message : t('mapSearchFailed'))
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
  // stays on the map but out of the list. Ordered by the active sort: cheapest
  // first (cost preference, unpriced last) or stored rank then distance.
  const listResults = useMemo(() => {
    const base = visibleBounds ? mapResults.filter((r) => within(visibleBounds, r)) : mapResults
    const sorted = [...base]
    if (sortMode === 'cost') {
      sorted.sort((a, b) => {
        const ca = generalizedCostCents(a.priceCents, a.distanceMeters)
        const cb = generalizedCostCents(b.priceCents, b.distanceMeters)
        if (ca === cb) return a.distanceMeters - b.distanceMeters
        return ca - cb
      })
    } else {
      sorted.sort((a, b) =>
        a.rank !== b.rank ? b.rank - a.rank : a.distanceMeters - b.distanceMeters,
      )
    }
    return sorted
  }, [mapResults, visibleBounds, sortMode])

  // The lowest-priced listed spot gets the "cheapest" tag — real priced data only,
  // never guessed when every visible spot is unpriced.
  const cheapestId = useMemo(() => {
    let best: FacilitySearchResult | null = null
    for (const r of listResults) {
      if (r.priceCents == null) continue
      if (!best || r.priceCents < best.priceCents!) best = r
    }
    return best?.id ?? null
  }, [listResults])

  const costLabel = useMemo(() => {
    if (sortMode !== 'cost') return null
    const vehicle = vehicleLabel(applied.vehicleType, t)
    return `${t('mapCostLabelPrefix')}${formatDateTimeShort(applied.startsAt, locale)} · ${vehicle}`
  }, [sortMode, applied.startsAt, applied.vehicleType, t, locale])

  const openCostPicker = useCallback(() => {
    setSortMode('cost')
    openTimePicker(applied, (next) => setApplied(next))
  }, [applied, openTimePicker])

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
    if (coords) {
      recenterTo({ ...coords })
      setAtUser(true)
    }
    retry()
  }

  const openFacility = useCallback(
    (id: string) => {
      openFacilityDetail(id, applied)
    },
    [openFacilityDetail, applied],
  )

  const navigateTo = useCallback(
    (id: string) => {
      const spot = results.find((r) => r.id === id)
      if (spot) openDirections({ lat: spot.lat, lng: spot.lng, label: spot.name })
    },
    [results],
  )

  const selected = useMemo(
    () => mapResults.find((r) => r.id === selectedId) ?? null,
    [mapResults, selectedId],
  )

  // Close the card once its spot pans out of view — a stale card pointing at an
  // off-screen pin is confusing, and there's no longer a marker to tap to re-open
  // it. Re-checks only when the viewport itself settles, not on every selection
  // change: onRegionChange is debounced, so a spot tapped right after panning
  // back into view would otherwise get validated against the still-stale
  // pre-pan bounds and close right back up.
  useEffect(() => {
    if (!selectedId || !visibleBounds) return
    const spot = mapResults.find((r) => r.id === selectedId)
    if (spot && !within(visibleBounds, spot)) {
      selectedIdRef.current = null
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBounds])

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
          clusters={clusters}
          onClusterPress={() => {}}
          onRegionChange={onRegionChange}
          onUserGesture={() => {
            // A user gesture invalidates any search still queued for the
            // just-recentered (user) position, so the stale request never fires.
            onRegionChange.cancel()
            setAtUser(false)
          }}
          onMapPress={() => {
            if (selectedId) {
              selectedIdRef.current = null
              setSelectedId(null)
              return
            }
            setCollapseNonce((n) => n + 1)
          }}
          onSpotSelect={(id) => {
            selectedIdRef.current = id
            setSelectedId(id)
          }}
          getCenterOffsetPx={getCenterOffsetPx}
        />
      </View>

      <View style={[styles.topRow, { top: insets.top + spacing.sm }]}>
        <View
          style={[styles.searchPill, { backgroundColor: colors.sheet, borderColor: colors.line }]}
        >
          <Ionicons name="search" size={17} color={colors.muted} />
          <Text style={[styles.searchHint, { color: colors.muted }]} numberOfLines={1}>
            {t('searchHint')}
          </Text>
        </View>

        <Pressable
          onPress={openFilters}
          style={({ pressed }) => [
            styles.squareFab,
            { backgroundColor: colors.sheet, borderColor: colors.line },
            pressed && styles.fabPressed,
          ]}
        >
          <MaterialIcons name="tune" size={19} color={colors.ink} />
        </Pressable>
      </View>

      {selected ? (
        <Animated.View
          style={[styles.cardWrap, floatingStyle]}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          onLayout={(e) => {
            cardHeightRef.current = e.nativeEvent.layout.height
          }}
        >
          <SelectedFacilityCard
            facility={selected}
            onDetails={() => openFacility(selected.id)}
            onDirections={() => navigateTo(selected.id)}
          />
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.recenterFabWrap, floatingStyle]}>
        <Pressable
          onPress={locateMe}
          style={({ pressed }) => [
            styles.recenterFab,
            { backgroundColor: colors.sheet, borderColor: colors.line },
            pressed && styles.fabPressed,
          ]}
        >
          <MaterialIcons
            name={status === 'denied' ? 'gps-off' : atUser ? 'gps-fixed' : 'gps-not-fixed'}
            size={20}
            color={colors.pri}
          />
        </Pressable>
      </Animated.View>

      <BottomSheet
        results={listResults}
        clustered={clusters.length > 0}
        loading={loading}
        error={error}
        onSelect={openFacility}
        collapse={collapseNonce}
        sortMode={sortMode}
        onSortNearby={() => setSortMode('nearby')}
        onSortCost={openCostPicker}
        costLabel={costLabel}
        cheapestId={cheapestId}
        bottomInset={barOffset}
        expandProgress={sheetProgress}
        heightValue={sheetHeight}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: TOP_ROW_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchHint: { fontSize: 14, fontWeight: '500' },
  squareFab: {
    width: TOP_ROW_HEIGHT,
    height: TOP_ROW_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  recenterFabWrap: {
    position: 'absolute',
    right: spacing.md,
    width: RECENTER_FAB_SIZE,
    height: RECENTER_FAB_SIZE,
  },
  recenterFab: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
  cardWrap: {
    position: 'absolute',
    left: spacing.md,
    right: CARD_RIGHT_OFFSET,
    alignItems: 'flex-start',
  },
})
