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

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { colors, radii } = useTheme()
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderRadius: radii.md,
        },
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
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const { colors, radii } = useTheme()
  const isSecondary = variant === 'secondary'
  const fg = isSecondary ? colors.pri : '#fff'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { borderRadius: radii.md },
        isSecondary
          ? { backgroundColor: 'transparent', borderColor: colors.pri }
          : { backgroundColor: colors.pri, borderColor: colors.pri },
        pressed && !disabled && styles.btnPressed,
        (disabled || loading) && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { fontSize: typography.label.fontSize, color: fg }]}>
            {label}
          </Text>
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
      <Text style={[styles.badgeText, { fontSize: typography.caption.fontSize, color: map.fg }]}>
        {label}
      </Text>
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
  btn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontWeight: '600' },
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
