import AsyncStorage from '@react-native-async-storage/async-storage'
import { spacing, typography, useTheme } from '@spark/ui'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
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
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'

import { LogoMark } from '../src/components/map/logo'
import { Button } from '../src/components/ui'
import { useLanguage } from '../src/i18n/LanguageProvider'
import { ONBOARDED_STORAGE_KEY } from '../src/lib/constants'
import { useUserLocation } from '../src/lib/location'

const GRID_PITCH = 34
const RING_DURATION = 2400
const RING2_DELAY = 500
const GLOW_COLOR = '#249ED9'

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
  const { retry } = useUserLocation({ auto: false })
  const ring1Style = usePulseStyle(0)
  const ring2Style = usePulseStyle(RING2_DELAY)
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 })

  function onSceneLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    setSceneSize({ width, height })
  }

  async function proceed() {
    await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, 'true')
    router.replace('/map')
  }

  function enableLocation() {
    retry()
    void proceed()
  }

  const vLineCount = sceneSize.width ? Math.floor(sceneSize.width / GRID_PITCH) : 0
  const hLineCount = sceneSize.height ? Math.floor(sceneSize.height / GRID_PITCH) : 0

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} />
            <Stop offset="1" stopColor={colors.sheet} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bgGrad)" />
      </Svg>

      <View style={[styles.top, { paddingTop: insets.top }]} onLayout={onSceneLayout}>
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="30%" r="55%">
              <Stop offset="0" stopColor={GLOW_COLOR} stopOpacity={0.22} />
              <Stop offset="1" stopColor={GLOW_COLOR} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glow)" />
        </Svg>
        {Array.from({ length: vLineCount }, (_, i) => (
          <View
            key={`v-${i}`}
            style={[styles.vLine, { left: (i + 1) * GRID_PITCH, backgroundColor: colors.mapLine }]}
          />
        ))}
        {Array.from({ length: hLineCount }, (_, i) => (
          <View
            key={`h-${i}`}
            style={[styles.hLine, { top: (i + 1) * GRID_PITCH, backgroundColor: colors.mapLine }]}
          />
        ))}
        <View style={styles.markWrap}>
          <Animated.View style={[styles.ringOuter, { backgroundColor: colors.pri }, ring1Style]} />
          <Animated.View style={[styles.ringInner, { backgroundColor: colors.pri }, ring2Style]} />
          <View style={styles.logoShadow}>
            <LogoMark size={64} />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.sheet,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.ink }]}>{t('onboardingTitle')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('onboardingBody')}</Text>
        <View style={styles.ctaWrap}>
          <Button label={t('onboardingAllow')} onPress={enableLocation} />
        </View>
        <Pressable style={styles.ghost} onPress={() => void proceed()} hitSlop={8}>
          <Text style={[styles.ghostText, { color: colors.muted }]}>{t('onboardingNotNow')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const MARK_WRAP_SIZE = 120

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flex: 1.2, overflow: 'hidden' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  markWrap: {
    position: 'absolute',
    top: '44%',
    left: '50%',
    width: MARK_WRAP_SIZE,
    height: MARK_WRAP_SIZE,
    marginLeft: -MARK_WRAP_SIZE / 2,
    marginTop: -MARK_WRAP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  ringInner: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
  logoShadow: {
    shadowColor: GLOW_COLOR,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  sheet: {
    paddingHorizontal: 26,
    paddingTop: 30,
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.display.fontWeight,
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  body: { fontSize: 15, lineHeight: 23, marginBottom: 26 },
  ctaWrap: { marginBottom: 12 },
  ghost: { alignItems: 'center', paddingVertical: 14 },
  ghostText: { fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight },
})
