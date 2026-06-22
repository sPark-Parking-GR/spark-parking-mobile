import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, type ElementRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, {
  Callout,
  CalloutSubview,
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance } from '../../lib/format'
import { colors, font, radius, space } from '../../theme'
import { MapPin, PIN_ANCHOR } from './logo'
import type { MapProps } from './types'

function metaLine(r: FacilitySearchResult): string {
  return (r.available ? 'Διαθέσιμο' : 'Πλήρες') + ' · ' + formatDistance(r.distanceMeters)
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
  clusters,
  onClusterPress,
  onMarkerPress,
  onDirections,
  onRegionChange,
  onUserGesture,
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
      showsMyLocationButton={false}
      customMapStyle={DARK_MAP_STYLE}
      userInterfaceStyle="dark"
      onRegionChangeComplete={handleRegion}
      onRegionChangeStart={(_region, details) => {
        if (details.isGesture) onUserGesture?.()
      }}
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
            ref.current?.animateCamera(
              { center: { latitude: r.lat, longitude: r.lng } },
              { duration: 350 },
            )
          }}
        >
          <MapPin available={r.available} />
          <Callout tooltip>
            <View style={styles.callout}>
              <Text style={styles.calloutName}>{r.name}</Text>
              <Text style={styles.calloutAddr}>{r.address}</Text>
              <Text style={styles.calloutMeta}>{metaLine(r)}</Text>
              <View style={styles.calloutActions}>
                <CalloutSubview style={styles.calloutBtn} onPress={() => onMarkerPress(r.id)}>
                  <Text style={styles.calloutCta}>Λεπτομέρειες →</Text>
                </CalloutSubview>
                <CalloutSubview
                  style={[styles.calloutBtn, styles.calloutBtnDirections]}
                  onPress={() => onDirections(r.id)}
                >
                  <Ionicons name="navigate" size={14} color={colors.primary} />
                  <Text style={styles.calloutCta}>Οδηγίες</Text>
                </CalloutSubview>
              </View>
            </View>
          </Callout>
        </Marker>
      ))}
      {clusters.map((c) => (
        <Marker
          key={c.id}
          coordinate={{ latitude: c.lat, longitude: c.lng }}
          tracksViewChanges={false}
          onPress={async () => {
            const cam = await ref.current?.getCamera()
            ref.current?.animateCamera(
              { center: { latitude: c.lat, longitude: c.lng }, zoom: (cam?.zoom ?? 12) + 2 },
              { duration: 350 },
            )
            onClusterPress?.(c)
          }}
        >
          <View style={styles.cluster}>
            <Text style={styles.clusterText}>{c.count}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cluster: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { color: colors.textMain, fontSize: font.small, fontWeight: '700' },
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
  calloutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.sm,
  },
  calloutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  calloutBtnDirections: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: space.md,
  },
  calloutCta: { fontSize: font.small, fontWeight: '600', color: colors.primary },
})
