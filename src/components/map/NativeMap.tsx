import { Ionicons } from '@expo/vector-icons'
import { radii, spacing, typography, useTheme } from '@spark/ui'
import { useEffect, useRef, type ElementRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, {
  Callout,
  CalloutSubview,
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps'

import { MapPin, PIN_ANCHOR } from './logo'
import type { MapProps } from './types'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance, formatMoney } from '../../lib/format'

function metaLine(r: FacilitySearchResult, availableLabel: string, fullLabel: string): string {
  return (r.available ? availableLabel : fullLabel) + ' · ' + formatDistance(r.distanceMeters)
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
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
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
          <MapPin available={r.available} colors={colors} />
          <Callout tooltip>
            <View
              style={[styles.callout, { backgroundColor: colors.sheet, borderColor: colors.line }]}
            >
              <View style={styles.calloutHeader}>
                <View style={styles.calloutInfo}>
                  <Text style={[styles.calloutName, { color: colors.ink }]}>{r.name}</Text>
                  <Text style={[styles.calloutAddr, { color: colors.muted }]}>{r.address}</Text>
                  <Text style={[styles.calloutMeta, { color: colors.muted }]}>
                    {metaLine(r, t('badgeAvailable'), t('badgeFull'))}
                  </Text>
                </View>
                {r.priceCents != null ? (
                  <View style={styles.calloutPriceWrap}>
                    <Text style={[styles.calloutPrice, { color: colors.pri }]}>
                      {formatMoney(r.priceCents, locale, r.currency)}
                    </Text>
                    <Text style={[styles.calloutPriceSub, { color: colors.muted }]}>
                      {t('priceTotalSuffix')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.calloutActions}>
                <CalloutSubview style={styles.calloutBtn} onPress={() => onMarkerPress(r.id)}>
                  <Text style={[styles.calloutCta, { color: colors.pri }]}>
                    {t('mapDetailsCta')} →
                  </Text>
                </CalloutSubview>
                <CalloutSubview
                  style={[
                    styles.calloutBtn,
                    styles.calloutBtnDirections,
                    { borderLeftColor: colors.line },
                  ]}
                  onPress={() => onDirections(r.id)}
                >
                  <Ionicons name="navigate" size={14} color={colors.pri} />
                  <Text style={[styles.calloutCta, { color: colors.pri }]}>
                    {t('mapDirectionsCta')}
                  </Text>
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
  callout: {
    minWidth: 220,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  calloutInfo: { flex: 1, minWidth: 0 },
  calloutName: { fontSize: 16, fontWeight: '700' },
  calloutAddr: { fontSize: 12, marginTop: 2 },
  calloutMeta: { fontSize: 12, marginTop: 6 },
  calloutPriceWrap: { alignItems: 'flex-end' },
  calloutPrice: { fontSize: 19, fontWeight: '800' },
  calloutPriceSub: { fontSize: 11 },
  calloutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  calloutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  calloutBtnDirections: {
    borderLeftWidth: 1,
    paddingLeft: spacing.md,
  },
  calloutCta: { fontSize: typography.body.fontSize, fontWeight: '600' },
})
