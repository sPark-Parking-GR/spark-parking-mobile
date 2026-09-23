import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '../theme'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { BookingValue } from '../components/BookingForm'
import { Button, Card, Field } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { PriceQuote } from '../lib/api'
import type { HeldBooking } from '../lib/booking'
import { holdBooking, holdIsLive, newIdempotencyKey, settleBooking } from '../lib/booking'
import { vehicleLabel } from '../lib/constants'
import { formatDateTime, formatMoney, formatTimeRange } from '../lib/format'
import { NetworkError } from '../lib/http'
import { identity } from '../lib/identity'
import { collectPayment } from '../lib/payments'
import { useOverlay } from '../navigation/OverlayContext'

const PLATE_MAX = 16

type Phase = 'idle' | 'holding' | 'paying' | 'confirming'

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
  const { openFacilityDetail, openTicket, openAuth } = useOverlay()
  const { t, locale } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  // One key for the whole checkout, not one per attempt: `POST /bookings` is idempotent on
  // it, so a retry after a dismissed sheet replays the original hold instead of holding a
  // second slot and opening a second PaymentIntent.
  const idempotencyKey = useRef(newIdempotencyKey())
  // Kept in a ref, never in state or storage: the client secret is a payment credential
  // and must not be logged, persisted or serialised into a navigation param.
  const held = useRef<HeldBooking | null>(null)
  // A ref, not the `phase` state: two taps landing in the same frame both read the
  // pre-render value and would each start a checkout.
  const inFlight = useRef(false)

  const [vehiclePlate, setVehiclePlate] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submitting = phase !== 'idle'

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
    void handleConfirm()
  }

  async function handleConfirm() {
    if (inFlight.current) return

    const plate = vehiclePlate.trim()
    if (!plate) {
      setError(t('reviewPlateRequired'))
      return
    }

    // The session can lapse between opening this screen and confirming (a refresh token
    // that no longer refreshes). Send the user through sign-in and back to this exact
    // booking rather than letting the request fail with a bare 401.
    if (!identity.canBook()) {
      openAuth('signIn', {
        type: 'review',
        facilityId,
        facilityName,
        facilityAddress,
        booking,
        quote,
      })
      return
    }

    setError(null)
    setNotice(null)
    inFlight.current = true

    try {
      // An expired hold can never be confirmed, and replaying its key would only return
      // the same dead booking — so that is the one case that earns a fresh key.
      if (held.current && !holdIsLive(held.current)) {
        held.current = null
        idempotencyKey.current = newIdempotencyKey()
      }

      setPhase('holding')
      const hold =
        held.current ??
        (await holdBooking(
          {
            facilityId,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            vehicleType: booking.vehicleType,
            vehiclePlate: plate,
            idempotencyKey: idempotencyKey.current,
          },
          identity,
        ))
      held.current = hold

      if (hold.clientSecret) {
        setPhase('paying')
        const outcome = await collectPayment({
          clientSecret: hold.clientSecret,
          currency: hold.currency,
        })

        if (outcome.status !== 'paid') {
          // Nothing was charged in any of these branches. The hold stays live, so the
          // screen stays on the same booking and Confirm resumes it.
          if (outcome.status === 'cancelled') setNotice(t('paymentCancelled'))
          else if (outcome.status === 'unavailable') setError(t('paymentUnavailable'))
          else setError(outcome.message || t('paymentFailed'))
          setPhase('idle')
          return
        }
      }

      setPhase('confirming')
      const confirmed = await settleBooking(hold.bookingId, identity)

      openTicket({
        bookingId: hold.bookingId,
        facilityId,
        facilityName,
        code: confirmed.accessCode,
        booking,
        totalCents: confirmed.finalPriceCents,
        currency: confirmed.currency,
      })
    } catch (e) {
      setError(t(e instanceof NetworkError ? 'networkError' : 'reviewError'))
      setPhase('idle')
    } finally {
      inFlight.current = false
    }
  }

  function busyLabel(): string {
    if (phase === 'paying') return t('reviewPaying')
    if (phase === 'confirming') return t('reviewBooking')
    return t('reviewPreparingPayment')
  }

  const confirmLabel = `${t('reviewConfirm')} · ${formatMoney(quote.totalCents, locale, quote.currency)}`

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={back}
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + spacing.sm, backgroundColor: colors.sheet },
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

        <Card style={[styles.card, styles.cardRadius]}>
          <Text style={[styles.facilityName, { color: colors.ink }]}>{facilityName}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{facilityAddress}</Text>
          <View style={[styles.divider, { marginVertical: 14, backgroundColor: colors.line }]} />
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
          <View style={[styles.divider, { marginVertical: 14, backgroundColor: colors.line }]} />
          <Field
            label={t('reviewVehiclePlate')}
            value={vehiclePlate}
            onChangeText={(next) => setVehiclePlate(next.toUpperCase())}
            placeholder={t('reviewVehiclePlatePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={PLATE_MAX}
            editable={!submitting}
          />
        </Card>

        <Card style={[styles.card, styles.cardRadius]}>
          <Text style={[styles.cardTitle, { color: colors.muted }]}>
            {t('reviewPaymentMethod')}
          </Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{t('reviewPaymentSheetHint')}</Text>
        </Card>

        <Card style={[styles.card, styles.cardRadius]}>
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
            <Text style={[styles.totalValueCard, { color: colors.pri }]}>
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
            backgroundColor: colors.sheet,
            borderTopColor: colors.line,
          },
        ]}
      >
        {error ? <Text style={[styles.error, { color: colors.bad }]}>{error}</Text> : null}
        {notice ? (
          <View style={styles.notice}>
            <Text style={[styles.error, styles.noticeText, { color: colors.ink }]}>{notice}</Text>
            {held.current ? (
              <Text style={[styles.holdUntil, { color: colors.muted }]}>
                {t('paymentHoldUntil')} {formatDateTime(held.current.expiresAt, locale)}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Button
          label={submitting ? busyLabel() : confirmLabel}
          onPress={confirm}
          loading={submitting}
        />
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
  title: { fontSize: 20, fontWeight: '800' },
  card: { marginTop: 14 },
  cardRadius: { borderRadius: 18 },
  cardTitle: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  facilityName: { fontSize: 17, fontWeight: typography.heading.fontWeight },
  divider: { height: 1, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: spacing.md },
  rowLabel: { fontSize: typography.body.fontSize, flexShrink: 1 },
  rowValue: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.label.fontWeight,
    flexShrink: 1,
    textAlign: 'right',
  },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValueCard: { fontSize: 20, fontWeight: '800' },
  muted: { fontSize: 12, marginTop: 2 },
  error: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  notice: { marginBottom: spacing.xs },
  noticeText: { marginBottom: 2, fontWeight: '600' },
  holdUntil: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
})
