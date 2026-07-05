import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { colors, font, radius } from '../theme'

const SPRING = { damping: 22, stiffness: 220, mass: 0.9 }
const PAD = 3
const GAP = 3

export interface Segment {
  value: string
  label: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
}

export function SegmentedControl({
  segments,
  value,
  onChange,
}: {
  segments: readonly Segment[]
  value: string
  onChange: (value: string) => void
}) {
  const [trackW, setTrackW] = useState(0)
  const tx = useSharedValue(0)
  const settled = useRef(false)

  const n = segments.length
  const index = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  )
  const segW = trackW > 0 ? (trackW - PAD * 2 - GAP * (n - 1)) / n : 0

  useEffect(() => {
    if (segW <= 0) return
    const target = PAD + index * (segW + GAP)
    if (settled.current) {
      tx.value = withSpring(target, SPRING)
    } else {
      // Place instantly, but via withTiming so a UI-thread frame is scheduled —
      // a bare assignment isn't flushed to a freshly mounted Modal view, leaving
      // the indicator mispositioned until the first interaction.
      tx.value = withTiming(target, { duration: 0 })
      settled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, segW])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

  function onLayout(e: LayoutChangeEvent) {
    setTrackW(e.nativeEvent.layout.width)
  }

  return (
    <View style={styles.track} onLayout={onLayout}>
      {segW > 0 && <Animated.View style={[styles.indicator, { width: segW }, indicatorStyle]} />}
      {segments.map((s) => {
        const active = s.value === value
        return (
          <Pressable key={s.value} onPress={() => onChange(s.value)} style={styles.segment}>
            <MaterialCommunityIcons
              name={s.icon}
              size={19}
              color={active ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {s.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.sm,
    padding: PAD,
    gap: GAP,
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.sm - 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: radius.sm - 3,
  },
  label: { fontSize: font.tiny, fontWeight: '600', color: colors.textSecondary },
  labelActive: { color: '#fff' },
})
