import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card } from '../../src/components/ui'
import { getBooking, type BookingDetail } from '../../src/lib/api'
import { formatMoney, formatTimeRange } from '../../src/lib/format'
import { colors, font, space } from '../../src/theme'

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'error' }> = {
  CONFIRMED: { label: 'Επιβεβαιωμένη', variant: 'success' },
  PENDING_PAYMENT: { label: 'Εκκρεμεί πληρωμή', variant: 'warning' },
  CHECKED_IN: { label: 'Σε εξέλιξη', variant: 'success' },
  CHECKED_OUT: { label: 'Ολοκληρωμένη', variant: 'neutral' },
  CANCELLED: { label: 'Ακυρωμένη', variant: 'error' },
  REFUNDED: { label: 'Επιστροφή χρημάτων', variant: 'neutral' },
  EXPIRED: { label: 'Έληξε', variant: 'error' },
}

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getBooking(id)
      .then((b) => {
        if (!cancelled) setBooking(b)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Δεν βρέθηκε η κράτηση')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (error || !booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'Σφάλμα'}</Text>
      </View>
    )
  }

  const status = STATUS[booking.status] ?? { label: booking.status, variant: 'neutral' as const }
  const price = booking.finalPriceCents ?? booking.quotedPriceCents

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.head}>
          <Text style={styles.title}>Η κράτησή σου</Text>
          <Badge label={status.label} variant={status.variant} />
        </View>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Κωδικός εισόδου</Text>
          <Text style={styles.code}>{booking.accessCode}</Text>
        </View>

        <Row label="Χώρος" value={booking.facility.name} />
        <Row label="Διεύθυνση" value={booking.facility.address} />
        <Row label="Διάστημα" value={formatTimeRange(booking.startsAt, booking.endsAt)} />
        <Row label="Πινακίδα" value={booking.vehiclePlate} />
        <Row label="Σύνολο" value={formatMoney(price, booking.currency)} />
      </Card>

      <View style={styles.cta}>
        <Button
          label="Νέα αναζήτηση"
          variant="secondary"
          onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))}
        />
      </View>
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  title: { fontSize: font.heading, fontWeight: '600', color: colors.textMain },
  codeBox: {
    alignItems: 'center',
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  codeLabel: { fontSize: font.small, color: colors.textSecondary },
  code: { fontSize: 34, fontWeight: '700', letterSpacing: 4, color: colors.primary, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: space.sm },
  rowLabel: { fontSize: font.small, color: colors.textSecondary },
  rowValue: { fontSize: font.small, fontWeight: '500', color: colors.textMain, textAlign: 'right', flexShrink: 1 },
  cta: { marginTop: space.lg },
  error: { color: colors.error, fontSize: font.body, textAlign: 'center', paddingHorizontal: space.lg },
})
