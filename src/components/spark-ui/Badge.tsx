import type { ReactElement, ReactNode } from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../../theme'

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
