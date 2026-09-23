import type { ReactElement } from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { useTheme } from '../../theme'
import type { ProgressBarProps, ProgressRingProps } from './Progress.types'

export type { ProgressBarProps, ProgressRingProps } from './Progress.types'

export function ProgressBar(props: ProgressBarProps): ReactElement {
  const { pct, colorOverride } = props
  const { colors, radii } = useTheme()

  const fillColor = colorOverride ?? (pct > 90 ? colors.bad : pct > 70 ? colors.warn : colors.ok)

  return (
    <View style={{ height: 8, borderRadius: radii.pill, backgroundColor: colors.card2 }}>
      <View
        style={{
          width: `${pct}%`,
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: fillColor,
        }}
      />
    </View>
  )
}

export function ProgressRing(props: ProgressRingProps): ReactElement {
  const { pct, size = 150, strokeWidth = 14, children } = props
  const { colors } = useTheme()

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct / 100)
  const center = size / 2

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.card2}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.pri}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          originX={center}
          originY={center}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  )
}
