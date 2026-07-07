import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { defaultEnd, defaultStart, type BookingValue } from '../components/BookingForm'
import { Badge, Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { Locale } from '../i18n/messages'
import { getFacility, getQuote, type FacilityDetail, type PriceQuote } from '../lib/api'
import { vehicleLabel } from '../lib/constants'
import { openDirections } from '../lib/directions'
import { formatMoney, formatTimeRange } from '../lib/format'
import { useSavedFacilities } from '../lib/savedFacilities'
import { useOverlay } from '../navigation/OverlayContext'

const HERO_HEIGHT = 188

function defaultBooking(): BookingValue {
  const start = defaultStart()
  return {
    startsAt: start.toISOString(),
    endsAt: defaultEnd(start).toISOString(),
    vehicleType: 'CAR',
  }
}

function minuteToHHMM(minute: number): string {
  const h = Math.floor(minute / 60) % 24
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function centsToCurrency(cents: number, locale: Locale): string {
  return formatMoney(cents, locale, 'EUR')
}

type TariffPlan = NonNullable<FacilityDetail['tariffAssignments'][number]['tariffPlan']>

function PricingCard({
  assignments,
  vehicleType,
}: {
  assignments: FacilityDetail['tariffAssignments']
  vehicleType: string
}) {
  const { colors } = useTheme()
  const { locale, t } = useLanguage()
  const plan: TariffPlan | null =
    assignments.find((a) => a.vehicleType === vehicleType)?.tariffPlan ?? null

  if (!plan || plan.tiers.length === 0) return null

  const windowById = new Map(plan.windows.map((w) => [w.id, w]))
  const dailyCap = plan.caps.find((c) => c.windowMinutes === 1440)

  return (
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('pricingTitle')}</Text>
      {plan.windows.length > 0 && (
        <View style={styles.pricingSection}>
          {plan.windows.map((w) => (
            <Text key={w.id} style={[styles.windowLabel, { color: colors.muted }]}>
              {w.label}: {minuteToHHMM(w.startMinute)}–{minuteToHHMM(w.endMinute)}
            </Text>
          ))}
        </View>
      )}
      {plan.tiers.map((tier) => {
        const rangeLabel =
          tier.toMinute != null
            ? `${tier.fromMinute}–${tier.toMinute} ${t('minutesUnit')}`
            : `${tier.fromMinute}+ ${t('minutesUnit')}`

        if (tier.rates.length === 0) return null

        if (tier.rates.length === 1) {
          const rate = tier.rates[0]!
          const unitSuffix =
            tier.unit === 'FLAT'
              ? ''
              : tier.unit === 'PER_BLOCK' && tier.blockMinutes != null
                ? `/${tier.blockMinutes} ${t('minutesUnit')}`
                : t('perMinuteUnit')
          return (
            <View key={tier.id} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>{rangeLabel}:</Text>
              <Text style={[styles.rowValue, { color: colors.ink }]}>
                {centsToCurrency(rate.priceCents, locale)}
                {unitSuffix}
              </Text>
            </View>
          )
        }

        return (
          <View key={tier.id}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{rangeLabel}:</Text>
            {tier.rates.map((rate) => {
              const win = windowById.get(rate.windowId)
              const unitSuffix =
                tier.unit === 'FLAT'
                  ? ''
                  : tier.unit === 'PER_BLOCK' && tier.blockMinutes != null
                    ? `/${tier.blockMinutes} ${t('minutesUnit')}`
                    : t('perMinuteUnit')
              return (
                <View key={rate.id} style={[styles.row, styles.rowIndent]}>
                  <Text style={[styles.rowLabel, { color: colors.muted }]}>
                    {win?.label ?? rate.windowId}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.ink }]}>
                    {centsToCurrency(rate.priceCents, locale)}
                    {unitSuffix}
                  </Text>
                </View>
              )
            })}
          </View>
        )
      })}
      {dailyCap && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('maxPerDay')}</Text>
            <Text style={[styles.rowValue, { color: colors.ink }]}>
              {centsToCurrency(dailyCap.capCents, locale)}
            </Text>
          </View>
        </>
      )}
    </Card>
  )
}

export function FacilityDetailOverlay({
  facilityId,
  booking: initialBooking,
}: {
  facilityId: string
  booking?: BookingValue
}) {
  const { closeOverlay, openTimePicker, openReview } = useOverlay()
  const { t, locale } = useLanguage()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [booking, setBooking] = useState<BookingValue | null>(initialBooking ?? null)
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isSaved, toggleSaved } = useSavedFacilities()
  const saved = isSaved(facilityId)

  // While the overlay is mounted, the Android hardware back closes it instead of
  // popping the underlying route (which would leave the tab stack, not the overlay).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay()
      return true
    })
    return () => sub.remove()
  }, [closeOverlay])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getFacility(facilityId)
      .then((f) => {
        if (!cancelled) setFacility(f)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('facilityNotFound'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [facilityId])

  // Recompute the price whenever the booking form changes.
  useEffect(() => {
    if (!booking) return
    let cancelled = false
    setQuoteLoading(true)
    getQuote(facilityId, booking.startsAt, booking.endsAt, booking.vehicleType)
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
  }, [facilityId, booking?.startsAt, booking?.endsAt, booking?.vehicleType])

  const heroButtons = (
    <View style={[styles.heroButtonRow, { top: insets.top + spacing.sm }]}>
      <Pressable
        onPress={closeOverlay}
        style={({ pressed }) => [styles.iconBackdrop, pressed && styles.iconBackdropPressed]}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>
      <Pressable
        onPress={() => {
          if (!facility) return
          toggleSaved({ id: facilityId, name: facility.name, address: facility.address })
        }}
        style={({ pressed }) => [styles.iconBackdrop, pressed && styles.iconBackdropPressed]}
        hitSlop={12}
      >
        <Ionicons name={saved ? 'star' : 'star-outline'} size={22} color="#fff" />
      </Pressable>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.hero, { height: HERO_HEIGHT, backgroundColor: colors.pri }]}>
          {heroButtons}
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.pri} />
        </View>
      </View>
    )
  }

  if (error || !facility) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.hero, { height: HERO_HEIGHT, backgroundColor: colors.pri }]}>
          {heroButtons}
        </View>
        <View style={styles.center}>
          <Text style={[styles.error, { color: colors.bad }]}>
            {error ?? t('facilityNotFound')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.hero, { height: HERO_HEIGHT, backgroundColor: colors.pri }]}>
        {heroButtons}
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>{facility.name}</Text>
          <Pressable
            onPress={() =>
              openDirections({ lat: facility.lat, lng: facility.lng, label: facility.name })
            }
            style={({ pressed }) => [styles.directions, pressed && styles.directionsPressed]}
          >
            <Ionicons name="navigate-circle" size={18} color="#fff" />
            <Text style={styles.heroAddress}>{facility.address}</Text>
          </Pressable>
          {facility.rating.average != null ? (
            <Text style={styles.heroRating}>
              ★ {facility.rating.average.toFixed(1)} ({facility.rating.count})
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.md }]}>
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('amenitiesTitle')}</Text>
          <View style={styles.wrap}>
            {facility.amenities.map((a) => (
              <Badge key={a} label={a} variant="neutral" />
            ))}
            {facility.heightRestrictionCm ? (
              <Badge
                label={`${t('heightRestrictionPrefix')} ${facility.heightRestrictionCm}cm`}
                variant="warning"
              />
            ) : null}
          </View>
          {facility.cancellationPolicy ? (
            <Text style={[styles.policy, { color: colors.muted }]}>
              {facility.cancellationPolicy}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('bookingDetailsTitle')}</Text>
          <Pressable
            onPress={() =>
              openTimePicker(booking ?? initialBooking ?? defaultBooking(), setBooking)
            }
            style={({ pressed }) => [styles.pickRow, pressed && styles.pickRowPressed]}
          >
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('bookingDuration')}</Text>
            <View style={styles.pickValue}>
              <Text style={[styles.rowValue, { color: colors.ink }]}>
                {booking
                  ? formatTimeRange(booking.startsAt, booking.endsAt, locale)
                  : t('bookingTapToSelect')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <Pressable
            onPress={() =>
              openTimePicker(booking ?? initialBooking ?? defaultBooking(), setBooking)
            }
            style={({ pressed }) => [styles.pickRow, pressed && styles.pickRowPressed]}
          >
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('bookingVehicle')}</Text>
            <View style={styles.pickValue}>
              <Text style={[styles.rowValue, { color: colors.ink }]}>
                {booking ? vehicleLabel(booking.vehicleType, t) : t('bookingTapToSelect')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
          </Pressable>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>{t('priceTitle')}</Text>
          {quote ? (
            <>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {formatTimeRange(quote.startsAt, quote.endsAt, locale)}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.line }]} />
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
                <Text style={[styles.totalLabel, { color: colors.ink }]}>{t('total')}</Text>
                <Text style={[styles.totalValue, { color: colors.pri }]}>
                  {formatMoney(quote.totalCents, locale, quote.currency)}
                </Text>
              </View>
            </>
          ) : quoteLoading ? (
            <ActivityIndicator color={colors.pri} />
          ) : (
            <Text style={[styles.muted, { color: colors.muted }]}>{t('priceUnavailable')}</Text>
          )}
        </Card>

        <PricingCard
          assignments={facility.tariffAssignments}
          vehicleType={booking?.vehicleType ?? 'CAR'}
        />
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
        {quote ? (
          <View style={styles.footerTotal}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('total')}</Text>
            <Text style={[styles.totalValue, { color: colors.pri }]}>
              {formatMoney(quote.totalCents, locale, quote.currency)}
            </Text>
          </View>
        ) : null}
        <View style={styles.footerBtn}>
          <Button
            label={t('bookingBook')}
            icon="arrow-forward"
            disabled={!booking || !quote}
            onPress={() => {
              if (!booking || !quote) return
              openReview(facilityId, facility.name, facility.address, booking, quote)
            }}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  heroButtonRow: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconBackdrop: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBackdropPressed: { opacity: 0.75 },
  heroContent: { gap: 4 },
  heroTitle: { fontSize: typography.display.fontSize, fontWeight: '700', color: '#fff' },
  heroAddress: {
    fontSize: typography.body.fontSize,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  heroRating: { fontSize: typography.caption.fontSize, color: 'rgba(255,255,255,0.85)' },
  content: { padding: spacing.md, paddingTop: HERO_HEIGHT + spacing.md, paddingBottom: spacing.xl },
  pickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  pickRowPressed: { opacity: 0.6 },
  pickValue: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: HERO_HEIGHT },
  directions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directionsPressed: { opacity: 0.6 },
  card: { marginTop: spacing.md },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  divider: { height: 1, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: typography.caption.fontSize, flexShrink: 1 },
  rowValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalLabel: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  totalValue: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  muted: { fontSize: typography.caption.fontSize },
  policy: { fontSize: typography.caption.fontSize, marginTop: spacing.sm },
  error: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  pricingSection: { marginBottom: spacing.sm },
  windowLabel: { fontSize: typography.caption.fontSize, marginBottom: 2 },
  rowIndent: { paddingLeft: spacing.sm },
})
