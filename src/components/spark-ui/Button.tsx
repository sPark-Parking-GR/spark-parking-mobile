import type { ReactElement } from 'react'
import type { TextStyle, ViewStyle } from 'react-native'
import { Pressable, Text } from 'react-native'

import { useTheme } from '../../theme'
import type { ButtonProps } from './Button.types'

export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.types'

export function Button(props: ButtonProps): ReactElement {
  const { variant = 'primary', size = 'md', fullWidth, disabled, onPress, children } = props
  const { colors, radii } = useTheme()

  const sizeStyle: ViewStyle & TextStyle =
    size === 'md'
      ? {
          paddingVertical: 14,
          paddingHorizontal: 20,
          fontSize: 15,
          fontWeight: '800',
          borderRadius: radii.md,
        }
      : {
          paddingVertical: 9,
          paddingHorizontal: 16,
          fontSize: 13,
          fontWeight: '700',
          borderRadius: radii.sm,
        }

  const variantStyle: ViewStyle & TextStyle =
    variant === 'primary'
      ? { backgroundColor: colors.pri, borderWidth: 0 }
      : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line }

  const textColor = variant === 'primary' ? '#FFFFFF' : colors.ink

  const containerStyle: ViewStyle = {
    ...sizeStyle,
    ...variantStyle,
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <Pressable disabled={disabled} onPress={onPress} style={containerStyle}>
      <Text
        style={{ color: textColor, fontSize: sizeStyle.fontSize, fontWeight: sizeStyle.fontWeight }}
      >
        {children}
      </Text>
    </Pressable>
  )
}
