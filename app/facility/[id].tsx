import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BookingForm, type BookingValue } from '../../src/components/BookingForm'
import { Badge, Card } from '../../src/components/ui'
import { getFacility, getQuote, type FacilityDetail, type PriceQuote } from '../../src/lib/api'
import { formatMoney, formatTimeRange } from '../../src/lib/format'
import { colors, font, space } from '../../src/theme'

export default function FacilityScreen() {
  const params = useLocalSearchParams<{
    id: string
    startsAt?: string
    endsAt?: string
    vehicleType?: string
  }>()

  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [booking, setBooking] = useState<BookingValue | null>(null)
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getFacility(params.id)
      .then((f) => {
        if (!cancelled) setFacility(f)
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
  }, [params.id])

  // Recompute the price whenever the booking form changes.
  useEffect(() => {
    if (!booking) return
    let cancelled = false
    setQuoteLoading(true)
    getQuote(params.id, booking.startsAt, booking.endsAt, booking.vehicleType)
      .then((q) => {
        if (!cancelled) setQuote(q)
      })
      .catch(() => {
        if (!cancelled) setQuote(null)
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.id, booking?.startsAt, booking?.endsAt, booking?.vehicleType])

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

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Στοιχεία κράτησης</Text>
        <BookingForm
          initial={{
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            vehicleType: params.vehicleType,
          }}
          onChange={setBooking}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Τιμή</Text>
        {quote ? (
          <>
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
          </>
        ) : quoteLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>
            Δεν είναι δυνατός ο υπολογισμός τιμής για αυτό το διάστημα.
          </Text>
        )}
      </Card>
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
})
