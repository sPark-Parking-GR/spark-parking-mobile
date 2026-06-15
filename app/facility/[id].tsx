import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card } from '../../src/components/ui'
import { getFacility, getQuote, type FacilityDetail, type PriceQuote } from '../../src/lib/api'
import { formatMoney, formatTimeRange } from '../../src/lib/format'
import { colors, font, space } from '../../src/theme'

export default function FacilityScreen() {
  const params = useLocalSearchParams<{
    id: string
    startsAt: string
    endsAt: string
    vehicleType: string
  }>()

  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasWindow = Boolean(params.startsAt && params.endsAt && params.vehicleType)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getFacility(params.id)
      .then(async (f) => {
        if (cancelled) return
        setFacility(f)
        if (hasWindow) {
          const q = await getQuote(params.id, params.startsAt, params.endsAt, params.vehicleType).catch(
            () => null,
          )
          if (!cancelled) setQuote(q)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Δεν βρέθηκε ο χώρος')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.id, params.startsAt, params.endsAt, params.vehicleType])

  function book() {
    if (!quote || !facility) return
    router.push({
      pathname: '/checkout',
      params: {
        facilityId: facility.id,
        name: facility.name,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        vehicleType: params.vehicleType,
      },
    })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (error || !facility) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Δεν βρέθηκε ο χώρος'}</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{facility.name}</Text>
      <Text style={styles.address}>{facility.address}</Text>
      {facility.rating.average != null ? (
        <Text style={styles.rating}>
          ★ {facility.rating.average.toFixed(1)} ({facility.rating.count})
        </Text>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Παροχές</Text>
        <View style={styles.wrap}>
          {facility.amenities.map((a) => (
            <Badge key={a} label={a} variant="neutral" />
          ))}
          {facility.heightRestrictionCm ? (
            <Badge label={`Ύψος ≤ ${facility.heightRestrictionCm}cm`} variant="warning" />
          ) : null}
        </View>
        {facility.cancellationPolicy ? (
          <Text style={styles.policy}>{facility.cancellationPolicy}</Text>
        ) : null}
      </Card>

      {quote ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Τιμή</Text>
          <Text style={styles.muted}>{formatTimeRange(quote.startsAt, quote.endsAt)}</Text>
          <View style={styles.divider} />
          {quote.lineItems.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>
                {item.label} × {item.quantity}
              </Text>
              <Text style={styles.rowValue}>{formatMoney(item.subtotalCents, quote.currency)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Σύνολο</Text>
            <Text style={styles.totalValue}>{formatMoney(quote.totalCents, quote.currency)}</Text>
          </View>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.muted}>Επίλεξε ώρα άφιξης και αναχώρησης για τιμή.</Text>
        </Card>
      )}

      {quote ? (
        <View style={styles.cta}>
          <Button label="Κράτηση" onPress={book} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', color: colors.textMain },
  address: { fontSize: font.body, color: colors.textSecondary, marginTop: 4 },
  rating: { fontSize: font.small, color: colors.warning, marginTop: 6 },
  card: { marginTop: space.md },
  cardTitle: { fontSize: font.body, fontWeight: '600', color: colors.textMain, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: font.small, color: colors.textSecondary, flexShrink: 1 },
  rowValue: { fontSize: font.small, color: colors.textMain, fontWeight: '500' },
  totalLabel: { fontSize: font.heading, fontWeight: '700', color: colors.textMain },
  totalValue: { fontSize: font.heading, fontWeight: '700', color: colors.primary },
  muted: { color: colors.textSecondary, fontSize: font.small },
  policy: { fontSize: font.small, color: colors.textSecondary, marginTop: space.sm },
  error: { color: colors.error, fontSize: font.body, textAlign: 'center', paddingHorizontal: space.lg },
  cta: { marginTop: space.lg },
})
