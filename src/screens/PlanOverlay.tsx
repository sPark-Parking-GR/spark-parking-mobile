import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '../theme'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LogoMark } from '../components/map/logo'
import { Badge, Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import {
  createDriverSubscriptionCheckout,
  getMyDriverSubscription,
  listDriverPlans,
  type DriverEntitlements,
  type DriverPlanSummary,
  type MyDriverSubscription,
} from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { NetworkError } from '../lib/http'
import { identity } from '../lib/identity'
import { useOverlay } from '../navigation/OverlayContext'

const HERO_BUTTON_SIZE = 40

// Matches `scheme` in app.json. The hosted checkout page redirects here when the rider is
// done, which is the only signal the app gets that the subscription may have changed.
const RETURN_URL = 'spark://subscription-return'

const STATUS_LABEL_KEY: Record<NonNullable<MyDriverSubscription['status']>, string> = {
  TRIALING: 'planStatusTrialing',
  ACTIVE: 'planStatusActive',
  PAST_DUE: 'planStatusPastDue',
  CANCELLED: 'planStatusCancelled',
}

const STATUS_VARIANT: Record<
  NonNullable<MyDriverSubscription['status']>,
  'success' | 'warning' | 'error'
> = {
  TRIALING: 'success',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'error',
}

const INTERVAL_SUFFIX_KEY: Record<DriverPlanSummary['interval'], string> = {
  MONTHLY: 'planIntervalMonthly',
  YEARLY: 'planIntervalYearly',
}

const FEATURE_LABEL_KEY: Record<string, string> = {
  'support.priority': 'planFeatureSupportPriority',
}

function formatDiscount(bps: number): string {
  const percent = bps / 100
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

// `canOpenURL` is advisory — an Android handset with no default browser bound still
// answers false for a perfectly openable https URL, so a refusal there is not the answer.
async function openCheckout(url: string): Promise<boolean> {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url)
      return true
    }
  } catch {
    // Fall through and let the OS decide.
  }
  try {
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

function PerkList({ entitlements }: { entitlements: DriverEntitlements }) {
  const { colors } = useTheme()
  const { t } = useLanguage()

  const rows: { key: string; label: string; value: string }[] = []

  if (entitlements.bookingDiscountBps != null && entitlements.bookingDiscountBps > 0) {
    rows.push({
      key: 'discount',
      label: t('planPerkDiscount'),
      value: `−${formatDiscount(entitlements.bookingDiscountBps)}%`,
    })
  }

  if (entitlements.bookingFeeWaived) {
    rows.push({ key: 'fee', label: t('planPerkBookingFee'), value: t('planPerkWaived') })
  }

  // null is unlimited and 0 is a real "none" — only the former is worth a line.
  if (entitlements.freeCancellations == null) {
    rows.push({
      key: 'cancellations',
      label: t('planPerkFreeCancellations'),
      value: t('planPerkUnlimited'),
    })
  } else if (entitlements.freeCancellations > 0) {
    rows.push({
      key: 'cancellations',
      label: t('planPerkFreeCancellations'),
      value: String(entitlements.freeCancellations),
    })
  }

  for (const feature of entitlements.features) {
    const labelKey = FEATURE_LABEL_KEY[feature]
    rows.push({
      key: `feature:${feature}`,
      label: labelKey ? t(labelKey) : feature,
      value: t('planPerkIncluded'),
    })
  }

  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.muted }]}>{row.label}</Text>
          <Text style={[styles.rowValue, { color: colors.ink }]}>{row.value}</Text>
        </View>
      ))}
    </>
  )
}

function PlanCard({
  plan,
  isCurrent,
  busy,
  onSubscribe,
}: {
  plan: DriverPlanSummary
  isCurrent: boolean
  busy: boolean
  onSubscribe: () => void
}) {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()

  return (
    <Card style={[styles.card, styles.cardRadius, isCurrent && { borderColor: colors.pri }]}>
      <View style={styles.planHead}>
        <Text style={[styles.planName, { color: colors.ink }]}>{plan.name}</Text>
        <View style={styles.planPrice}>
          <Text style={[styles.planPriceValue, { color: colors.pri }]}>
            {formatMoney(plan.priceCents, locale, plan.currency)}
          </Text>
          <Text style={[styles.planInterval, { color: colors.muted }]}>
            {t(INTERVAL_SUFFIX_KEY[plan.interval])}
          </Text>
        </View>
      </View>

      {plan.description ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{plan.description}</Text>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <PerkList entitlements={plan.entitlements} />

      <View style={styles.planCta}>
        <Button
          label={isCurrent ? t('planCurrentCta') : t('planSubscribe')}
          variant={isCurrent ? 'secondary' : 'primary'}
          disabled={isCurrent || busy}
          loading={busy}
          onPress={onSubscribe}
        />
      </View>
    </Card>
  )
}

export function PlanOverlay() {
  const { closeOverlay } = useOverlay()
  const { t, locale } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [subscription, setSubscription] = useState<MyDriverSubscription | null>(null)
  const [plans, setPlans] = useState<DriverPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [returnNotice, setReturnNotice] = useState<'success' | 'cancel' | null>(null)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay()
      return true
    })
    return () => sub.remove()
  }, [closeOverlay])

  const loadSubscription = useCallback(async () => {
    setSubscription(await getMyDriverSubscription(identity))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getMyDriverSubscription(identity), listDriverPlans()])
      .then(([mine, catalog]) => {
        if (cancelled) return
        setSubscription(mine)
        setPlans(catalog)
      })
      .catch((e) => {
        if (!cancelled) setError(t(e instanceof NetworkError ? 'networkError' : 'planLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The checkout page is a browser tab, not a native sheet, so the only way back is the
  // return deep link. Scoped to this screen: nothing else in the app listens for URLs.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith(RETURN_URL)) return
      const cancelled = /[?&]status=cancel(&|$)/.test(url)
      setCheckoutPlanId(null)
      setCheckoutError(null)
      setReturnNotice(cancelled ? 'cancel' : 'success')
      loadSubscription().catch(() => undefined)
    })
    return () => sub.remove()
  }, [loadSubscription])

  const subscribe = (plan: DriverPlanSummary) => {
    void startCheckout(plan)
  }

  async function startCheckout(plan: DriverPlanSummary) {
    if (checkoutPlanId) return
    setCheckoutError(null)
    setReturnNotice(null)
    setCheckoutPlanId(plan.id)
    try {
      const url = await createDriverSubscriptionCheckout(plan.id, identity)
      if (!(await openCheckout(url))) {
        setCheckoutError(t('planCheckoutOpenFailed'))
        setCheckoutPlanId(null)
      }
    } catch (e) {
      setCheckoutError(t(e instanceof NetworkError ? 'networkError' : 'planCheckoutFailed'))
      setCheckoutPlanId(null)
    }
  }

  const backButton = (
    <View style={[styles.heroButtonRow, { marginTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={closeOverlay}
        style={({ pressed }) => [styles.iconBackdrop, pressed && styles.iconBackdropPressed]}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>
    </View>
  )

  const heroSubtitle =
    subscription == null ? null : (subscription.planName ?? t('planFreeTierLabel'))

  const hero = (
    <View style={[styles.hero, { backgroundColor: colors.pri }]}>
      <View style={styles.heroWatermark}>
        <LogoMark size={100} color="#fff" />
      </View>
      {backButton}
      <View style={styles.heroContent}>
        <Text style={styles.heroTitle}>{t('planTitle')}</Text>
        {heroSubtitle ? <Text style={styles.heroSubtitle}>{heroSubtitle}</Text> : null}
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={colors.pri} />
        </View>
      </View>
    )
  }

  if (error || !subscription) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        {hero}
        <View style={styles.center}>
          <Text style={[styles.error, { color: colors.bad }]}>{error ?? t('planLoadFailed')}</Text>
        </View>
      </View>
    )
  }

  const isFree = subscription.source === 'free' || subscription.planName == null
  // A cancelled plan still runs to its period end, but it is not the plan the rider is on
  // for the purpose of offering the catalog back to them.
  const currentPlanCode = subscription.status === 'CANCELLED' ? null : subscription.planCode

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {hero}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {returnNotice ? (
          <Card style={[styles.card, styles.cardRadius, styles.cardFirst]}>
            <Text style={[styles.notice, { color: colors.ink }]}>
              {t(returnNotice === 'success' ? 'planReturnSuccess' : 'planReturnCancelled')}
            </Text>
          </Card>
        ) : null}

        <Card style={[styles.card, styles.cardRadius, !returnNotice && styles.cardFirst]}>
          <Text style={[styles.cardTitle, { color: colors.muted }]}>{t('planCurrentTitle')}</Text>
          {isFree ? (
            <Text style={[styles.muted, { color: colors.muted }]}>{t('planFreeTierBody')}</Text>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('planFieldPlan')}</Text>
                <Text style={[styles.rowValue, { color: colors.ink }]}>
                  {subscription.planName}
                </Text>
              </View>
              {subscription.status ? (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.muted }]}>
                    {t('planFieldStatus')}
                  </Text>
                  <Badge
                    label={t(STATUS_LABEL_KEY[subscription.status])}
                    variant={STATUS_VARIANT[subscription.status]}
                  />
                </View>
              ) : null}
              {subscription.currentPeriodEnd ? (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.muted }]}>
                    {t(subscription.status === 'CANCELLED' ? 'planAccessUntil' : 'planRenewsOn')}
                  </Text>
                  <Text style={[styles.rowValue, { color: colors.ink }]}>
                    {formatDateTime(subscription.currentPeriodEnd, locale)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.divider, { backgroundColor: colors.line }]} />
              <PerkList entitlements={subscription.entitlements} />
            </>
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.muted }]}>
          {t('planAvailableTitle')}
        </Text>

        {plans.length === 0 ? (
          <Card style={[styles.card, styles.cardRadius]}>
            <Text style={[styles.muted, { color: colors.muted }]}>{t('planNoPlans')}</Text>
          </Card>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.code === currentPlanCode}
              busy={checkoutPlanId === plan.id}
              onSubscribe={() => subscribe(plan)}
            />
          ))
        )}

        {checkoutError ? (
          <Text style={[styles.error, styles.checkoutError, { color: colors.bad }]}>
            {checkoutError}
          </Text>
        ) : (
          <Text style={[styles.hint, { color: colors.faint }]}>{t('planCheckoutHint')}</Text>
        )}
      </ScrollView>
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
    justifyContent: 'flex-start',
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
  heroSubtitle: { fontSize: typography.body.fontSize, color: 'rgba(255,255,255,0.85)' },
  content: { padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: spacing.md },
  cardFirst: { marginTop: 0 },
  cardRadius: { borderRadius: 18 },
  cardTitle: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: spacing.lg,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  planName: { fontSize: typography.heading.fontSize, fontWeight: '800', flexShrink: 1 },
  planPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPriceValue: { fontSize: 20, fontWeight: '800' },
  planInterval: { fontSize: typography.caption.fontSize },
  planCta: { marginTop: spacing.md },
  divider: { height: 1, marginVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: { fontSize: 14, flexShrink: 1 },
  rowValue: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  muted: { fontSize: typography.caption.fontSize, lineHeight: 18 },
  notice: { fontSize: typography.body.fontSize, lineHeight: 20 },
  hint: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  error: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  checkoutError: { marginTop: spacing.md },
})
