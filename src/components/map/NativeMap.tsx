import { typography, useTheme } from '@spark/ui'
import { useEffect, useRef } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps'

import { MapPin, PIN_ANCHOR } from './logo'
import type { MapProps } from './types'

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
  onRegionChange,
  onUserGesture,
  onMapPress,
  onSpotSelect,
  getCenterOffsetPx,
}: MapProps) {
  const { colors } = useTheme()
  const ref = useRef<MapView>(null)
  const { height: screenHeight } = useWindowDimensions()

  const region: Region = {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: DELTA,
    longitudeDelta: DELTA,
  }

  useEffect(() => {
    // This region always resets to the fixed DELTA zoom, so (unlike the spot-tap
    // centering below) the resulting latitude span is known upfront — no need to
    // query the live camera bounds first.
    const offsetLat = (getCenterOffsetPx() / screenHeight) * DELTA
    ref.current?.animateToRegion({ ...region, latitude: center.lat - offsetLat }, 350)
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
        onMapPress()
      }}
    >
      {results.map((r) => (
        <Marker
          key={r.id}
          coordinate={{ latitude: r.lat, longitude: r.lng }}
          tracksViewChanges={false}
          anchor={PIN_ANCHOR}
          onPress={async () => {
            onSpotSelect(r.id)
            const [cam, bounds] = await Promise.all([
              ref.current?.getCamera(),
              ref.current?.getMapBoundaries(),
            ])
            // Shift the target north by the center offset (converted from px to
            // degrees via the currently visible latitude span), so the spot lands
            // in the middle of the viewport still visible between the top bar and
            // the sheet/selected-spot card, not behind either.
            const latitudeDelta = bounds
              ? bounds.northEast.latitude - bounds.southWest.latitude
              : DELTA
            const offsetLat = (getCenterOffsetPx() / screenHeight) * latitudeDelta
            const targetLat = r.lat - offsetLat
            if (
              cam &&
              Math.abs(cam.center.latitude - targetLat) < CENTER_EPS &&
              Math.abs(cam.center.longitude - r.lng) < CENTER_EPS
            )
              return
            ref.current?.animateCamera(
              { center: { latitude: targetLat, longitude: r.lng } },
              { duration: 350 },
            )
          }}
        >
          <MapPin available={r.available} colors={colors} />
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
          <View
            style={[styles.cluster, { backgroundColor: colors.pri, borderColor: colors.surface }]}
          >
            <Text style={[styles.clusterText, { color: colors.ink }]}>{c.count}</Text>
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: { fontSize: typography.body.fontSize, fontWeight: '700' },
})
