import { useEffect, useRef, type ElementRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Callout, Marker, type Region } from 'react-native-maps'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance } from '../../lib/format'
import { colors, font } from '../../theme'
import { LogoMark } from './logo'
import type { MapProps } from './types'

function metaLine(r: FacilitySearchResult): string {
  return (
    (r.available ? 'Διαθέσιμο' : 'Πλήρες') + ' · ' + formatDistance(r.distanceMeters)
  )
}

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
      style={styles.fill}
      initialRegion={region}
      showsUserLocation
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
          anchor={{ x: 0.5, y: 1 }}
          onPress={async () => {
            selectedId.current = r.id
            calloutOpen.current = true
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
          <View style={styles.marker}>
            <View style={[styles.pin, { backgroundColor: r.available ? colors.primary : '#9AA0A6' }]}>
              <View style={styles.pinInner}>
                <LogoMark size={16} color="#fff" />
              </View>
            </View>
          </View>
          <Callout onPress={() => onMarkerPress(r.id)}>
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
  marker: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 17,
    transform: [{ rotate: '45deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinInner: { transform: [{ rotate: '-45deg' }] },
  callout: { minWidth: 180, paddingVertical: 2, gap: 2 },
  calloutName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  calloutAddr: { fontSize: font.tiny, color: colors.textSecondary },
  calloutMeta: { fontSize: font.small, color: colors.textMain, marginTop: 2 },
  calloutCta: { fontSize: font.small, fontWeight: '600', color: colors.primary, marginTop: 4 },
})

