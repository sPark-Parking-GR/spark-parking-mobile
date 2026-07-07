import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useEffect } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { BookingValue } from '../components/BookingForm'
import { Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { PriceQuote } from '../lib/api'
import { vehicleLabel } from '../lib/constants'
import { formatMoney, formatTimeRange } from '../lib/format'
import { useOverlay } from '../navigation/OverlayContext'

function generateCode(): string {
  return `SPK-${Math.floor(1000 + Math.random() * 9000)}`
}

export function ReviewOverlay({
  facilityId,
  facilityName,
  facilityAddress,
  booking,
  quote,
}: {
  facilityId: string
  facilityName: string
  facilityAddress: string
  booking: BookingValue
  quote: PriceQuote
}) {
  const { openFacilityDetail, openTicket } = useOverlay()
  const { t, locale } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const back = () => openFacilityDetail(facilityId, booking)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back()
      return true
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, booking])

  const confirm = () => {
    openTicket({
      facilityId,
      facilityName,
      code: generateCode(),
      booking,
      totalCents: quote.totalCents,
      currency: quote.currency,
    })
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={back}
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + spacing.sm, backgroundColor: colors.surface },
          pressed && styles.closePressed,
        ]}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={24} color={colors.ink} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl + spacing.md },
        ]}
      >
        <Text style={[styles.title, { color: colors.ink }]}>{t('reviewTitle')}</Text>

        <Card style={styles.card}>
          <Text style={[styles.facilityName, { color: colors.ink }]}>{facilityName}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{facilityAddress}</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('bookingDuration')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink }]}>
              {formatTimeRange(booking.startsAt, booking.endsAt, locale)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('bookingVehicle')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink }]}>
              {vehicleLabel(booking.vehicleType, t)}
            </Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('reviewPaymentMethod')}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{t('reviewNoPaymentMethod')}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('reviewPriceBreakdown')}</Text>
          {quote.lineItems.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>
                {item.label} × {item.quantity}
              </Text>
              <Text style={[styles.rowValue, { color: colors.ink }]}>
                {formatMoney(item.subtotalCents, locale, quote.currency)}
              </Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: colors.ink }]}>{t('reviewTotal')}</Text>
            <Text style={[styles.totalValue, { color: colors.pri }]}>
              {formatMoney(quote.totalCents, locale, quote.currency)}
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
          },
        ]}
      >
        <View style={styles.footerTotal}>
          <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('reviewTotal')}</Text>
          <Text style={[styles.totalValue, { color: colors.pri }]}>
            {formatMoney(quote.totalCents, locale, quote.currency)}
          </Text>
        </View>
        <View style={styles.footerBtn}>
          <Button label={t('reviewConfirm')} icon="checkmark-circle" onPress={confirm} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  close: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  closePressed: { opacity: 0.85 },
  title: { fontSize: typography.display.fontSize, fontWeight: '600' },
  card: { marginTop: spacing.md },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  facilityName: { fontSize: typography.heading.fontSize, fontWeight: '600' },
  divider: { height: 1, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: spacing.md },
  rowLabel: { fontSize: typography.body.fontSize, flexShrink: 1 },
  rowValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalLabel: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  totalValue: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  muted: { fontSize: typography.body.fontSize, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  footerTotal: { flexShrink: 1 },
  footerBtn: { flex: 1 },
})
