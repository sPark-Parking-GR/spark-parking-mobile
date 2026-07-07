import AsyncStorage from '@react-native-async-storage/async-storage'
import { radii, spacing, typography, useTheme } from '@spark/ui'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { LogoMark } from '../src/components/map/logo'
import { Button } from '../src/components/ui'
import { useLanguage } from '../src/i18n/LanguageProvider'
import { ONBOARDED_STORAGE_KEY } from '../src/lib/constants'
import { useUserLocation } from '../src/lib/location'

const GRID_LINES = 5
const RING_DURATION = 2200

function usePulseStyle(delay: number) {
  const value = useSharedValue(0)

  useEffect(() => {
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.ease) }), -1),
    )
  }, [value, delay])

  return useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(value.value, [0, 1], [1, 2.6]) }],
    opacity: interpolate(value.value, [0, 1], [0.45, 0]),
  }))
}

export default function OnboardingScreen() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const { retry } = useUserLocation()
  const ring1Style = usePulseStyle(0)
  const ring2Style = usePulseStyle(RING_DURATION / 2)

  async function proceed() {
    await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, 'true')
    router.replace('/map')
  }

  function enableLocation() {
    retry()
    void proceed()
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top }]}>
        <View style={[styles.glow, { backgroundColor: colors.priSoft }]} />
        {Array.from({ length: GRID_LINES }, (_, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.vLine,
              { left: `${((i + 1) / (GRID_LINES + 1)) * 100}%`, backgroundColor: colors.line },
            ]}
          />
        ))}
        {Array.from({ length: GRID_LINES }, (_, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.hLine,
              { top: `${((i + 1) / (GRID_LINES + 1)) * 100}%`, backgroundColor: colors.line },
            ]}
          />
        ))}
        <View style={styles.markWrap}>
          <Animated.View style={[styles.ring, { backgroundColor: colors.pri }, ring1Style]} />
          <Animated.View style={[styles.ring, { backgroundColor: colors.pri }, ring2Style]} />
          <LogoMark size={72} />
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.ink }]}>{t('onboardingTitle')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('onboardingBody')}</Text>
        <Button label={t('onboardingAllow')} onPress={enableLocation} />
        <Pressable style={styles.ghost} onPress={() => void proceed()} hitSlop={8}>
          <Text style={[styles.ghostText, { color: colors.muted }]}>{t('onboardingNotNow')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flex: 1.2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  markWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  sheet: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  title: { fontSize: typography.display.fontSize, fontWeight: typography.display.fontWeight },
  body: { fontSize: typography.body.fontSize, lineHeight: 20 },
  ghost: { alignItems: 'center', paddingVertical: spacing.sm },
  ghostText: { fontSize: typography.label.fontSize, fontWeight: '600' },
})
