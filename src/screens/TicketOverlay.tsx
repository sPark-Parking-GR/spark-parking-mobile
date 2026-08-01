import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { BookingValue } from '../components/BookingForm'
import { RotatingQr, useQrTicket, type QrFailure } from '../components/RotatingQr'
import { Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { vehicleLabel } from '../lib/constants'
import { formatAccessCode, formatTimeRange } from '../lib/format'
import { useOverlay } from '../navigation/OverlayContext'

const QR_SIZE = 196

const QR_FAILURE_MESSAGE: Record<QrFailure, string> = {
  offline: 'ticketQrOffline',
  signedOut: 'ticketQrSignedOut',
  notFound: 'ticketQrNotFound',
  notIssuable: 'ticketQrNotIssuable',
  rateLimited: 'ticketQrRateLimited',
  failed: 'ticketQrFailed',
}

// Retrying only makes sense where the next attempt could answer differently. Signing in
// again, a booking that is not the caller's and a booking with no live ticket are all
// settled states that another request would only repeat.
const RETRYABLE: QrFailure[] = ['offline', 'rateLimited', 'failed']

function PulseRing({ delay }: { delay: number }) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1.8, { duration: 1600, easing: Easing.out(Easing.quad) }), -1),
    )
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }), -1),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return <Animated.View style={[styles.pulseRing, style]} />
}

export function TicketOverlay({
  bookingId,
  facilityName,
  code,
  booking,
}: {
  bookingId: string
  facilityName: string
  code: string
  booking: BookingValue
  totalCents: number
  currency: string
}) {
  const { closeOverlay } = useOverlay()
  const { t, locale } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const { state: qr, retry } = useQrTicket(bookingId)

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

  // With no scannable code the access code is not a fallback, it is the way in, so it
  // leads the screen instead of sitting under an empty QR frame.
  const unavailable = qr.status === 'unavailable'

  const qrCard = (
    <Card style={styles.qrCard}>
      {qr.status === 'ready' ? (
        <>
          <RotatingQr payload={qr.payload} size={QR_SIZE} />
          <Text style={[styles.qrNote, { color: colors.muted }]}>{t('ticketQrHint')}</Text>
        </>
      ) : (
        <>
          <View
            style={[
              styles.qrPlaceholder,
              { borderColor: colors.line, backgroundColor: colors.card2 },
            ]}
          >
            {qr.status === 'loading' ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Ionicons
                name={qr.reason === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                size={40}
                color={colors.muted}
              />
            )}
          </View>
          <Text style={[styles.qrNote, { color: colors.muted }]}>
            {qr.status === 'loading' ? t('ticketQrLoading') : t(QR_FAILURE_MESSAGE[qr.reason])}
          </Text>
          {qr.status === 'unavailable' && RETRYABLE.includes(qr.reason) ? (
            <Button label={t('ticketQrRetry')} variant="secondary" onPress={retry} />
          ) : null}
        </>
      )}
    </Card>
  )

  const codeCard = (
    <Card style={[styles.codeCard, unavailable && { borderColor: colors.pri, borderWidth: 2 }]}>
      <Text style={[styles.codeLabel, { color: colors.muted }]}>{t('ticketCode')}</Text>
      <Text style={[styles.code, { color: colors.ink }]} selectable>
        {formatAccessCode(code)}
      </Text>
      <Text style={[styles.codeHint, { color: colors.muted }]}>
        {unavailable ? t('ticketCodeManualHint') : t('ticketCodeHint')}
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <Text style={[styles.facilityName, { color: colors.ink }]} numberOfLines={1}>
        {facilityName}
      </Text>
      <Text style={[styles.recap, { color: colors.muted }]} numberOfLines={1}>
        {formatTimeRange(booking.startsAt, booking.endsAt, locale)} ·{' '}
        {vehicleLabel(booking.vehicleType, t)}
      </Text>
    </Card>
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.sheet }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View
          style={[
            styles.hero,
            { paddingTop: insets.top + spacing.lg, backgroundColor: colors.pri },
          ]}
        >
          <View style={styles.checkWrap}>
            <PulseRing delay={0} />
            <PulseRing delay={800} />
            <View style={styles.check}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
          </View>
          <Text style={styles.title}>{t('ticketConfirmed')}</Text>
          <Text style={styles.subtitle}>{t('ticketConfirmSubtitle')}</Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
          {unavailable ? (
            <>
              {codeCard}
              {qrCard}
            </>
          ) : (
            <>
              {qrCard}
              {codeCard}
            </>
          )}

          <View style={styles.actions}>
            <Button label={t('ticketViewTrips')} onPress={viewTrips} />
            <Button label={t('ticketBackToMap')} variant="secondary" onPress={backToMap} />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
    overflow: 'hidden',
  },
  checkWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#fff',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
  },
  sheet: {
    marginTop: -spacing.xl,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 26,
    gap: spacing.sm,
  },
  qrCard: { alignItems: 'center', gap: spacing.sm, padding: 18, borderRadius: 18 },
  qrPlaceholder: {
    width: QR_SIZE,
    height: QR_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrNote: { fontSize: typography.caption.fontSize, textAlign: 'center', maxWidth: 260 },
  codeCard: { padding: 18, borderRadius: 18 },
  codeLabel: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  code: { fontSize: 22, fontWeight: '800', letterSpacing: 1.4, marginTop: 6, lineHeight: 30 },
  codeHint: { fontSize: typography.caption.fontSize, marginTop: 6 },
  divider: { height: 1, marginVertical: 14 },
  facilityName: { fontSize: typography.body.fontSize, fontWeight: '600' },
  recap: { fontSize: typography.caption.fontSize, marginTop: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
})
