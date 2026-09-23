import type { ReactElement } from 'react'
import type { TextStyle, ViewStyle } from 'react-native'
import { Pressable, Text, View } from 'react-native'

import { typography, useTheme } from '../../theme'
import type { StepperProps } from './Stepper.types'

export type { StepperProps, StepperSize } from './Stepper.types'

function clamp(v: number, min: number, max?: number): number {
  const withMin = Math.max(v, min)
  return max === undefined ? withMin : Math.min(withMin, max)
}

export function Stepper(props: StepperProps): ReactElement {
  const {
    value,
    onChange,
    step = 1,
    min = 0,
    max,
    formatValue = String,
    disabled,
    size = 'md',
  } = props
  const { colors, radii } = useTheme()

  const buttonSize = size === 'md' ? 32 : 28
  const valueWidth = size === 'md' ? 76 : 64
  const fontSize = size === 'md' ? typography.label.fontSize : 13

  const canDecrement = !disabled && value > min
  const canIncrement = !disabled && (max === undefined || value < max)

  const buttonStyle: ViewStyle = {
    width: buttonSize,
    height: buttonSize,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  }

  const glyphStyle: TextStyle = {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 18,
  }

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }}
    >
      <Pressable
        disabled={!canDecrement}
        onPress={() => onChange(clamp(value - step, min, max))}
        style={buttonStyle}
      >
        <Text style={glyphStyle}>{'−'}</Text>
      </Pressable>
      <Text
        style={{
          width: valueWidth,
          textAlign: 'center',
          fontSize,
          fontWeight: typography.label.fontWeight,
          color: colors.ink,
        }}
      >
        {formatValue(value)}
      </Text>
      <Pressable
        disabled={!canIncrement}
        onPress={() => onChange(clamp(value + step, min, max))}
        style={buttonStyle}
      >
        <Text style={glyphStyle}>+</Text>
      </Pressable>
    </View>
  )
}
