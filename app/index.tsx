import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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
  const autoLocated = useRef(false)
  const fitRequested = useRef(false)

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
    if (fitRequested.current || !coords) return
    fitRequested.current = true
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
    setLoading(true)
    setError(null)
    searchFacilities(
      {
        lat: viewport.lat,
        lng: viewport.lng,
        radiusMeters: viewport.radiusMeters,
        bounds: viewport.bounds,
        startsAt: applied.startsAt,
        endsAt: applied.endsAt,
        vehicleType: applied.vehicleType,
      },
      { signal: controller.signal },
    )
      .then((data) => setResults(data))
      .catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Η αναζήτηση απέτυχε')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [viewport, applied?.startsAt, applied?.endsAt, applied?.vehicleType])

  const onRegionChange = useDebouncedCallback((region: MapRegion) => {
    setViewport({
      lat: region.lat,
      lng: region.lng,
      radiusMeters: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, region.radiusMeters)),
      bounds: region.bounds,
    })
  }, 350)

  function locateMe() {
    if (coords) recenterTo({ ...coords })
    retry()
  }

  function openFacility(id: string) {
    router.push({
      pathname: '/facility/[id]',
      params: {
        id,
        startsAt: applied.startsAt,
        endsAt: applied.endsAt,
        vehicleType: applied.vehicleType,
      },
    })
  }

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <Map
          center={center}
          centerNonce={centerNonce}
          user={coords}
          fitBounds={fitBounds}
          fitNonce={fitNonce}
          results={results}
          onMarkerPress={openFacility}
          onRegionChange={onRegionChange}
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

      <BottomSheet results={results} loading={loading} error={error} onSelect={openFacility} />
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
