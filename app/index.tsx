import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomSheet } from '../src/components/BottomSheet'
import { Map } from '../src/components/map'
import type { MapRegion } from '../src/components/map'
import { SearchPanel, type AppliedQuery } from '../src/components/SearchPanel'
import { searchFacilities, type FacilitySearchResult } from '../src/lib/api'
import { CITY_PRESETS } from '../src/lib/constants'
import { useUserLocation } from '../src/lib/location'
import { useDebouncedCallback } from '../src/lib/useDebouncedCallback'
import { colors, space } from '../src/theme'

const MIN_RADIUS = 300
const MAX_RADIUS = 60_000
const PRESET = { lat: CITY_PRESETS[0]!.lat, lng: CITY_PRESETS[0]!.lng }

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { coords, status, retry } = useUserLocation()

  const [applied, setApplied] = useState<AppliedQuery | null>(null)
  const [center, setCenter] = useState(PRESET)
  const [centerNonce, setCenterNonce] = useState(0)
  const [viewport, setViewport] = useState<MapRegion | null>(null)
  const [results, setResults] = useState<FacilitySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoLocated = useRef(false)

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

  // Refetch for the visible map area (debounced) or when the booking window /
  // vehicle changes. Viewport drives the query coords; the form supplies the rest.
  useEffect(() => {
    if (!applied || !viewport) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    searchFacilities(
      {
        lat: viewport.lat,
        lng: viewport.lng,
        radiusMeters: viewport.radiusMeters,
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
    })
  }, 350)

  function handleSearch(query: AppliedQuery) {
    setApplied(query)
    recenterTo({ lat: query.lat, lng: query.lng })
  }

  function locateMe() {
    if (coords) recenterTo({ ...coords })
    retry()
  }

  function openFacility(id: string) {
    if (!applied) return
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
          results={results}
          onMarkerPress={openFacility}
          onRegionChange={onRegionChange}
        />
      </View>

      <View style={[styles.top, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <SearchPanel onSearch={handleSearch} userCoords={coords} />
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
  top: { position: 'absolute', left: space.md, right: space.md },
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
