import { useEffect, useRef, type ElementRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance } from '../../lib/format'
import { colors, font, radius, space } from '../../theme'
import { MapPin, PIN_ANCHOR } from './logo'
import type { MapProps } from './types'

function metaLine(r: FacilitySearchResult): string {
  return (
    (r.available ? 'Διαθέσιμο' : 'Πλήρες') + ' · ' + formatDistance(r.distanceMeters)
  )
}

// Dark basemap (Google, Android) tuned to the navy brand canvas.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a1721' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a96a0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020c14' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1f3340' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7780' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d2016' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#16242e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0c1a24' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#24333d' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0a6a99' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#15252f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020c14' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a4b56' }] },
]

const DELTA = 0.04
// Floor on the fitted span so a user standing next to a parking doesn't zoom to street level.
const MIN_FIT_DELTA = 0.01
// Headroom so neither the user dot nor the nearest pin sits on the screen edge.
const FIT_PADDING = 1.4
// ~1m: if the spot is already centered, skip the pan (and its refetch).
const CENTER_EPS = 1e-5

export function NativeMap({
  center,
  centerNonce,
  fitBounds,
  fitNonce,
  results,
  onMarkerPress,
  onRegionChange,
  onMapPress,
  onSpotSelect,
}: MapProps) {
  const ref = useRef<MapView>(null)
  const markerRefs = useRef<Record<string, ElementRef<typeof Marker> | null>>({})
  const selectedId = useRef<string | null>(null)
  const calloutOpen = useRef(false)

  const region: Region = {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: DELTA,
    longitudeDelta: DELTA,
  }

  useEffect(() => {
    ref.current?.animateToRegion(region, 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, centerNonce])

  useEffect(() => {
    if (!fitBounds) return
    ref.current?.animateToRegion(
      {
        latitude: (fitBounds.north + fitBounds.south) / 2,
        longitude: (fitBounds.east + fitBounds.west) / 2,
        latitudeDelta: Math.max(MIN_FIT_DELTA, (fitBounds.north - fitBounds.south) * FIT_PADDING),
        longitudeDelta: Math.max(MIN_FIT_DELTA, (fitBounds.east - fitBounds.west) * FIT_PADDING),
      },
      450,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce])

  // Refetch re-renders the markers, dropping the open callout; reopen the selected one.
  useEffect(() => {
    if (selectedId.current) markerRefs.current[selectedId.current]?.showCallout()
  }, [results])

  function handleRegion(r: Region) {
    const latM = r.latitudeDelta * 111_320
    const lngM = r.longitudeDelta * 111_320 * Math.cos((r.latitude * Math.PI) / 180)
    const radiusMeters = Math.round(Math.sqrt(latM * latM + lngM * lngM) / 2)
    onRegionChange({
      lat: r.latitude,
      lng: r.longitude,
      radiusMeters,
      bounds: {
        north: r.latitude + r.latitudeDelta / 2,
        south: r.latitude - r.latitudeDelta / 2,
        east: r.longitude + r.longitudeDelta / 2,
        west: r.longitude - r.longitudeDelta / 2,
      },
    })
  }

  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      style={styles.fill}
      initialRegion={region}
      showsUserLocation
      customMapStyle={DARK_MAP_STYLE}
      userInterfaceStyle="dark"
      onRegionChangeComplete={handleRegion}
      onPress={(e) => {
        if (e.nativeEvent.action === 'marker-press') return
        if (calloutOpen.current) {
          calloutOpen.current = false
          return
        }
        onMapPress()
      }}
    >
      {results.map((r) => (
        <Marker
          key={r.id}
          ref={(node) => {
            markerRefs.current[r.id] = node
          }}
          coordinate={{ latitude: r.lat, longitude: r.lng }}
          tracksViewChanges={false}
          anchor={PIN_ANCHOR}
          onPress={async () => {
            selectedId.current = r.id
            calloutOpen.current = true
            onSpotSelect()
            const cam = await ref.current?.getCamera()
            if (
              cam &&
              Math.abs(cam.center.latitude - r.lat) < CENTER_EPS &&
              Math.abs(cam.center.longitude - r.lng) < CENTER_EPS
            )
              return
            ref.current?.animateCamera({ center: { latitude: r.lat, longitude: r.lng } }, { duration: 350 })
          }}
        >
          <MapPin available={r.available} />
          <Callout tooltip onPress={() => onMarkerPress(r.id)}>
            <View style={styles.callout}>
              <Text style={styles.calloutName}>{r.name}</Text>
              <Text style={styles.calloutAddr}>{r.address}</Text>
              <Text style={styles.calloutMeta}>{metaLine(r)}</Text>
              <Text style={styles.calloutCta}>Λεπτομέρειες →</Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  callout: {
    minWidth: 180,
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  calloutName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  calloutAddr: { fontSize: font.tiny, color: colors.textSecondary },
  calloutMeta: { fontSize: font.small, color: colors.textMain, marginTop: 2 },
  calloutCta: { fontSize: font.small, fontWeight: '600', color: colors.primary, marginTop: 4 },
})

