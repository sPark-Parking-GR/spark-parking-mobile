import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

const BTN_RADIUS = 15
const GLOW_COLOR = '#249ED9'

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { colors, radii, mode } = useTheme()
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderRadius: radii.md,
        },
        mode === 'light' && styles.cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  iconPosition = 'leading',
  animateIcon,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  iconPosition?: 'leading' | 'trailing'
  animateIcon?: boolean
}) {
  const { colors } = useTheme()
  const isSecondary = variant === 'secondary'
  const fg = isSecondary ? colors.ink : '#fff'
  const iconOffset = useSharedValue(0)
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: iconOffset.value }],
  }))

  const handlePress = () => {
    if (animateIcon) {
      iconOffset.value = withSequence(
        withTiming(6, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 180, easing: Easing.inOut(Easing.quad) }),
      )
    }
    onPress()
  }

  const iconEl = icon ? (
    <Animated.View style={animateIcon ? iconAnimatedStyle : undefined}>
      <Ionicons name={icon} size={18} color={fg} />
    </Animated.View>
  ) : null

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isSecondary
          ? { backgroundColor: 'transparent', borderColor: colors.line }
          : { borderColor: 'transparent' },
        !isSecondary && !disabled && !loading && styles.btnGlow,
        pressed && !disabled && styles.btnPressed,
        (disabled || loading) && styles.btnDisabled,
      ]}
    >
      {!isSecondary && (
        <View style={styles.btnGradientClip}>
          <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
            <Defs>
              <LinearGradient id="btnGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.pri} />
                <Stop offset="1" stopColor={colors.pri2} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#btnGrad)" />
          </Svg>
        </View>
      )}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {iconPosition === 'leading' ? iconEl : null}
          <Text
            style={[
              styles.btnText,
              isSecondary
                ? { fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight }
                : { fontSize: 16, fontWeight: '800' },
              { color: fg },
            ]}
          >
            {label}
          </Text>
          {iconPosition === 'trailing' ? iconEl : null}
        </>
      )}
    </Pressable>
  )
}

type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral'

export function Badge({ label, variant = 'neutral' }: { label: string; variant?: BadgeVariant }) {
  const { colors } = useTheme()
  const map = {
    success: { bg: colors.okBg, fg: colors.ok },
    warning: { bg: colors.warnBg, fg: colors.warn },
    error: { bg: colors.badBg, fg: colors.bad },
    neutral: { bg: colors.card2, fg: colors.muted },
  }[variant]
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  )
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const { colors, radii } = useTheme()
  return (
    <View style={styles.field}>
      <Text
        style={[styles.fieldLabel, { fontSize: typography.caption.fontSize, color: colors.muted }]}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            fontSize: typography.label.fontSize,
            borderColor: colors.line,
            borderRadius: radii.sm,
            backgroundColor: colors.surface,
            color: colors.ink,
          },
        ]}
        {...props}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: spacing.md,
  },
  cardShadow: {
    shadowColor: '#0C1B2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  btn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: BTN_RADIUS,
  },
  btnGlow: {
    shadowColor: GLOW_COLOR,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 8,
  },
  btnGradientClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BTN_RADIUS,
    overflow: 'hidden',
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: {},
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
})
