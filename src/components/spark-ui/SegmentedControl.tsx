import type { ReactElement } from 'react'
import { Pressable, Text, View } from 'react-native'

import { useTheme } from '../../theme'
import type { SegmentedControlProps } from './SegmentedControl.types'

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
