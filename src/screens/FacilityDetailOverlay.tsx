import { Ionicons } from '@expo/vector-icons'
import { computeDistanceMeters } from '../lib/geo'
import { spacing, typography, useTheme } from '../theme'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { defaultEnd, defaultStart, type BookingValue } from '../components/BookingForm'
import { SegmentedControl, type Segment } from '../components/SegmentedControl'
import { LogoMark } from '../components/map/logo'
import { Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { Locale } from '../i18n/messages'
import { getFacility, getQuote, type FacilityDetail, type PriceQuote } from '../lib/api'
import { amenityLabel, VEHICLE_ICONS, VEHICLE_TYPES } from '../lib/constants'
import { openDirections } from '../lib/directions'
import { formatDistance, formatMoney, formatTimeRange } from '../lib/format'
import { NetworkError } from '../lib/http'
import { useUserLocation } from '../lib/location'
import { useSavedFacilities } from '../lib/savedFacilities'
import { useOverlay } from '../navigation/OverlayContext'

function Chip({ label, warning }: { label: string; warning?: boolean }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: warning ? colors.warnBg : colors.surface,
          borderColor: warning ? colors.warnBg : colors.line,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: warning ? colors.warn : colors.ink }]}>{label}</Text>
    </View>
  )
}

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

const HERO_CONTENT_GAP_RATIO = 0.012
const HERO_BUTTON_SIZE = 40

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
    <Card style={[styles.card, styles.cardRadius]}>
      <Text style={[styles.cardTitle, { color: colors.muted }]}>{t('pricingTitle')}</Text>
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
  const { height: windowHeight } = useWindowDimensions()
  const { colors } = useTheme()
  const { coords } = useUserLocation()

  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [booking, setBooking] = useState<BookingValue | null>(initialBooking ?? null)
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isSaved, toggleSaved } = useSavedFacilities()
  const saved = isSaved(facilityId)

  const vehicleSegments = useMemo<Segment[]>(
    () =>
      VEHICLE_TYPES.map((vt) => ({
        value: vt.value,
        label: t(vt.labelKey),
        icon: VEHICLE_ICONS[vt.value] ?? 'car',
      })),
    [t],
  )

  function setVehicleType(vehicleType: string) {
    setBooking({ ...(booking ?? initialBooking ?? defaultBooking()), vehicleType })
  }

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
        if (!cancelled) setError(t(e instanceof NetworkError ? 'networkError' : 'facilityNotFound'))
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
    if (!booking || !facility || facility.kind !== 'BUSINESS') return
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
  }, [facilityId, facility, booking?.startsAt, booking?.endsAt, booking?.vehicleType])

  const heroButtons = (
    <View style={[styles.heroButtonRow, { marginTop: insets.top + spacing.sm }]}>
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
          // Reachable enough for its detail page to have loaded, which is the same
          // predicate the server applies before it will accept the bookmark at all.
          toggleSaved({
            id: facilityId,
            name: facility.name,
            address: facility.address,
            available: true,
          })
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
        <View style={[styles.hero, { backgroundColor: colors.pri }]}>{heroButtons}</View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.pri} />
        </View>
      </View>
    )
  }

  if (error || !facility) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.hero, { backgroundColor: colors.pri }]}>{heroButtons}</View>
        <View style={styles.center}>
          <Text style={[styles.error, { color: colors.bad }]}>
            {error ?? t('facilityNotFound')}
          </Text>
        </View>
      </View>
    )
  }

  const isBusiness = facility.kind === 'BUSINESS'

  const distanceLabel =
    coords != null ? formatDistance(computeDistanceMeters(coords, facility)) : null

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.hero, { backgroundColor: colors.pri }]}>
        <View style={styles.heroWatermark}>
          <LogoMark size={100} color="#fff" />
        </View>
        {heroButtons}
        <View style={[styles.heroContent, { marginTop: windowHeight * HERO_CONTENT_GAP_RATIO }]}>
          <Text style={styles.heroTitle}>{facility.name}</Text>
          <Pressable
            onPress={() =>
              openDirections({ lat: facility.lat, lng: facility.lng, label: facility.name })
            }
            style={({ pressed }) => [styles.directions, pressed && styles.directionsPressed]}
          >
            <Ionicons name="navigate-circle" size={18} color="#fff" />
            <Text style={styles.heroAddress}>
              {facility.address}
              {distanceLabel ? ` · ${distanceLabel}` : ''}
            </Text>
          </Pressable>
          {facility.rating.average != null ? (
            <Text style={styles.heroRating}>
              ★ {facility.rating.average.toFixed(1)} ({facility.rating.count})
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isBusiness ? (
          <Card style={[styles.card, styles.cardRadius]}>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {t('facilityInfoOnlyNotice')}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={[styles.card, styles.cardRadius]}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>{t('amenitiesTitle')}</Text>
              <View style={styles.wrap}>
                {facility.amenities.map((a) => (
                  <Chip key={a} label={amenityLabel(a, t)} />
                ))}
                {facility.heightRestrictionCm ? (
                  <Chip
                    label={`${t('heightRestrictionPrefix')} ${facility.heightRestrictionCm}cm`}
                    warning
                  />
                ) : null}
              </View>
              {facility.cancellationPolicy ? (
                <Text style={[styles.policy, { color: colors.muted }]}>
                  {facility.cancellationPolicy}
                </Text>
              ) : null}
            </Card>

            <Card style={[styles.card, styles.cardRadius]}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>
                {t('bookingDetailsTitle')}
              </Text>
              <Pressable
                onPress={() =>
                  openTimePicker(booking ?? initialBooking ?? defaultBooking(), setBooking, false)
                }
                style={({ pressed }) => [
                  styles.pickRow,
                  styles.pickRowLast,
                  { backgroundColor: colors.card2, borderColor: colors.line },
                  pressed && styles.pickRowPressed,
                ]}
              >
                <Ionicons name="time-outline" size={18} color={colors.pri} />
                <View style={styles.pickTextCol}>
                  <Text style={[styles.pickLabel, { color: colors.muted }]}>
                    {t('bookingDuration')}
                  </Text>
                  <Text style={[styles.pickValue, { color: colors.ink }]}>
                    {booking
                      ? formatTimeRange(booking.startsAt, booking.endsAt, locale)
                      : t('bookingTapToSelect')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>

              <Text style={[styles.vehicleLabel, { color: colors.muted }]}>
                {t('bookingVehicle')}
              </Text>
              <SegmentedControl
                segments={vehicleSegments}
                value={booking?.vehicleType ?? initialBooking?.vehicleType ?? 'CAR'}
                onChange={setVehicleType}
              />
            </Card>

            <Card style={[styles.card, styles.cardRadius]}>
              <Text style={[styles.cardTitle, { color: colors.muted }]}>{t('priceTitle')}</Text>
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
                    <Text style={[styles.totalValueCard, { color: colors.pri }]}>
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
          </>
        )}
      </ScrollView>

      {isBusiness ? (
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
              <Text style={[styles.totalValue, { color: colors.ink }]}>
                {formatMoney(quote.totalCents, locale, quote.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.footerBtn}>
            <Button
              label={t('bookingBook')}
              icon="arrow-forward"
              iconPosition="trailing"
              animateIcon
              disabled={!booking || !quote}
              onPress={() => {
                if (!booking || !quote) return
                openReview(facilityId, facility.name, facility.address, booking, quote)
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    width: '100%',
    justifyContent: 'flex-start',
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroButtonRow: {
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconBackdrop: {
    width: HERO_BUTTON_SIZE,
    height: HERO_BUTTON_SIZE,
    borderRadius: HERO_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBackdropPressed: { opacity: 0.75 },
  heroWatermark: {
    position: 'absolute',
    right: -spacing.md,
    bottom: -spacing.md,
    opacity: 0.22,
  },
  heroContent: { gap: 4 },
  heroTitle: { fontSize: 23, fontWeight: typography.display.fontWeight, color: '#fff' },
  heroAddress: {
    fontSize: typography.body.fontSize,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  heroRating: { fontSize: typography.caption.fontSize, color: 'rgba(255,255,255,0.85)' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderWidth: 1,
    borderRadius: 13,
    marginBottom: 9,
  },
  pickRowLast: { marginBottom: 0 },
  pickRowPressed: { opacity: 0.6 },
  pickTextCol: { flex: 1, gap: 2 },
  pickLabel: { fontSize: typography.caption.fontSize },
  pickValue: { fontSize: 14, fontWeight: '700' },
  vehicleLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  directions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directionsPressed: { opacity: 0.6 },
  card: { marginTop: spacing.md },
  cardRadius: { borderRadius: 18 },
  cardTitle: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  divider: { height: 1, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 14, flexShrink: 1 },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  totalValueCard: { fontSize: 20, fontWeight: '800' },
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
