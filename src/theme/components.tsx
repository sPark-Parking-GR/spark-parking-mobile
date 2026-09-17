import type { ReactElement, ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import { Pressable, Text, View } from 'react-native'

import { spacing } from './tokens'
import { useTheme } from './ThemeProvider'

export type BadgeVariant = 'ok' | 'warn' | 'bad' | 'neutral'

export interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
}

export function Badge(props: BadgeProps): ReactElement {
  const { variant, children } = props
  const { colors, radii } = useTheme()

  const colorMap: Record<BadgeVariant, { text: string; bg: string }> = {
    ok: { text: colors.ok, bg: colors.okBg },
    warn: { text: colors.warn, bg: colors.warnBg },
    bad: { text: colors.bad, bg: colors.badBg },
    neutral: { text: colors.muted, bg: colors.card2 },
  }
  const { text, bg } = colorMap[variant]

  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 11,
        borderRadius: radii.pill,
        backgroundColor: bg,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: text }}>{children}</Text>
    </View>
  )
}

export interface CardProps {
  children: ReactNode
  padding?: number
  style?: ViewStyle
}

export function Card(props: CardProps): ReactElement {
  const { children, padding = spacing.lg, style } = props
  const { colors, radii, mode } = useTheme()

  return (
    <View
      style={{
        padding,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radii.lg,
        ...(mode === 'light'
          ? {
              shadowColor: '#0C1B2A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 14,
              elevation: 2,
            }
          : null),
        ...style,
      }}
    >
      {children}
    </View>
  )
}

export interface SegmentedControlOption {
  value: string
  label: string
}

export interface SegmentedControlProps {
  options: readonly SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  size?: 'md' | 'lg'
  variant?: 'compact' | 'spaced'
}

export function SegmentedControl(props: SegmentedControlProps): ReactElement {
  const { options, value, onChange, size = 'md', variant = 'compact' } = props
  const { colors, radii } = useTheme()

  if (variant === 'spaced') {
    return (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                borderRadius: radii.md,
                borderWidth: selected ? 0 : 1,
                borderColor: colors.line,
                paddingVertical: 9,
                paddingHorizontal: 16,
                backgroundColor: selected ? colors.pri : 'transparent',
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : colors.muted }}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              borderRadius: radii.pill,
              paddingVertical: size === 'md' ? 6 : 9,
              paddingHorizontal: size === 'md' ? 12 : 16,
              backgroundColor: selected ? colors.pri : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: size === 'md' ? 12 : 13,
                fontWeight: '800',
                color: selected ? '#fff' : colors.muted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
