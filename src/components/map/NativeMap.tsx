import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import MapView, { Callout, Marker, type Region } from 'react-native-maps'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance, formatMoney, formatPriceShort } from '../../lib/format'
import { colors, font } from '../../theme'
import type { MapProps } from './types'

function metaLine(r: FacilitySearchResult): string {
  return (
    (r.available ? 'Διαθέσιμο' : 'Πλήρες') +
    ' · ' +
    formatDistance(r.distanceMeters) +
    (r.priceCents != null ? ' · ' + formatMoney(r.priceCents, r.currency) : '')
  )
}

const DELTA = 0.04

export function NativeMap({
  center,
  centerNonce,
  results,
  onMarkerPress,
  onRegionChange,
}: MapProps) {
  const ref = useRef<MapView>(null)

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

  function handleRegion(r: Region) {
    const latM = r.latitudeDelta * 111_320
    const lngM = r.longitudeDelta * 111_320 * Math.cos((r.latitude * Math.PI) / 180)
    const radiusMeters = Math.round(Math.sqrt(latM * latM + lngM * lngM) / 2)
    onRegionChange({ lat: r.latitude, lng: r.longitude, radiusMeters })
  }

  return (
    <MapView
      ref={ref}
      style={styles.fill}
      initialRegion={region}
      showsUserLocation
      onRegionChangeComplete={handleRegion}
    >
      {results.map((r) => (
        <Marker
          key={r.id}
          coordinate={{ latitude: r.lat, longitude: r.lng }}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.marker}>
            <View style={[styles.pill, { backgroundColor: r.available ? colors.primary : '#9AA0A6' }]}>
              <Text style={styles.pillText}>
                {r.priceCents != null ? formatPriceShort(r.priceCents, r.currency) : '—'}
              </Text>
            </View>
            <View
              style={[styles.tail, { borderTopColor: r.available ? colors.primary : '#9AA0A6' }]}
            />
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
  marker: { alignItems: 'center' },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  callout: { minWidth: 180, paddingVertical: 2, gap: 2 },
  calloutName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  calloutAddr: { fontSize: font.tiny, color: colors.textSecondary },
  calloutMeta: { fontSize: font.small, color: colors.textMain, marginTop: 2 },
  calloutCta: { fontSize: font.small, fontWeight: '600', color: colors.primary, marginTop: 4 },
})

