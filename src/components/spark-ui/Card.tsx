import type { ReactElement, ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import { View } from 'react-native'

import { spacing, useTheme } from '../../theme'

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
