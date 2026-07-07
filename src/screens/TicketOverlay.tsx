import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { BookingValue } from '../components/BookingForm'
import { Button } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { vehicleLabel } from '../lib/constants'
import { formatTimeRange } from '../lib/format'
import { useOverlay } from '../navigation/OverlayContext'

export function TicketOverlay({
  facilityName,
  code,
  booking,
}: {
  facilityName: string
  code: string
  booking: BookingValue
  totalCents: number
  currency: string
}) {
  const { closeOverlay } = useOverlay()
  const { t, locale } = useLanguage()
  const { colors, radii } = useTheme()
  const insets = useSafeAreaInsets()

  const backToMap = () => closeOverlay()
  const viewTrips = () => {
    closeOverlay()
    router.replace('/trips')
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backToMap()
      return true
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.bg,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={[styles.check, { backgroundColor: colors.ok }]}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.ink }]}>{t('ticketConfirmed')}</Text>
        <Text style={[styles.facilityName, { color: colors.muted }]}>{facilityName}</Text>

        <View
          style={[
            styles.qrBox,
            { borderRadius: radii.md, borderColor: colors.line, backgroundColor: colors.surface },
          ]}
        >
          <Ionicons name="qr-code-outline" size={48} color={colors.muted} />
          <Text style={[styles.qrNote, { color: colors.muted }]}>{t('ticketQrComingSoon')}</Text>
        </View>

        <Text style={[styles.codeLabel, { color: colors.muted }]}>{t('ticketCode')}</Text>
        <Text style={[styles.code, { color: colors.pri }]}>{code}</Text>

        <Text style={[styles.recap, { color: colors.muted }]}>
          {formatTimeRange(booking.startsAt, booking.endsAt, locale)}
        </Text>
        <Text style={[styles.recap, { color: colors.muted }]}>
          {vehicleLabel(booking.vehicleType, t)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label={t('ticketViewTrips')} icon="receipt-outline" onPress={viewTrips} />
        <Button label={t('ticketBackToMap')} variant="secondary" onPress={backToMap} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: typography.display.fontSize, fontWeight: '700' },
  facilityName: { fontSize: typography.body.fontSize },
  qrBox: {
    width: 180,
    height: 180,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  qrNote: { fontSize: typography.caption.fontSize },
  codeLabel: { fontSize: typography.body.fontSize },
  code: { fontSize: typography.heading.fontSize, fontWeight: '700', letterSpacing: 1 },
  recap: { fontSize: typography.body.fontSize },
  actions: { gap: spacing.sm },
})
