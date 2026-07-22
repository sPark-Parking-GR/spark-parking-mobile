import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import type { BookingValue } from '../components/BookingForm'
import { Button, Card } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { vehicleLabel } from '../lib/constants'
import { formatTimeRange } from '../lib/format'
import { useOverlay } from '../navigation/OverlayContext'

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
  const { colors } = useTheme()
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
    <View style={[styles.root, { backgroundColor: colors.sheet }]}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl, backgroundColor: colors.pri }]}>
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

      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.sheet, paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <Card style={styles.ticketCard}>
          <View style={[styles.qrBox, { borderColor: colors.line, backgroundColor: colors.card2 }]}>
            <Ionicons name="qr-code-outline" size={28} color={colors.muted} />
          </View>
          <View style={styles.ticketInfo}>
            <Text style={[styles.codeLabel, { color: colors.muted }]}>{t('ticketCode')}</Text>
            <Text style={[styles.code, { color: colors.ink }]}>{code}</Text>
            <Text style={[styles.facilityName, { color: colors.ink }]} numberOfLines={1}>
              {facilityName}
            </Text>
            <Text style={[styles.recap, { color: colors.muted }]} numberOfLines={1}>
              {formatTimeRange(booking.startsAt, booking.endsAt, locale)} ·{' '}
              {vehicleLabel(booking.vehicleType, t)}
            </Text>
          </View>
        </Card>
        <Text style={[styles.qrNote, { color: colors.muted }]}>{t('ticketQrComingSoon')}</Text>

        <View style={styles.actions}>
          <Button label={t('ticketViewTrips')} onPress={viewTrips} />
          <Button label={t('ticketBackToMap')} variant="secondary" onPress={backToMap} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 26,
    gap: spacing.sm,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 18,
    borderRadius: 18,
  },
  qrBox: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketInfo: { flex: 1, minWidth: 0 },
  qrNote: { fontSize: typography.caption.fontSize, textAlign: 'center' },
  facilityName: { fontSize: typography.body.fontSize, fontWeight: '600', marginTop: 4 },
  codeLabel: { fontSize: typography.caption.fontSize },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 1.2 },
  recap: { fontSize: typography.caption.fontSize, marginTop: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
})
