import type { ReactElement } from 'react'
import { Pressable, Text, View } from 'react-native'

import { typography, useTheme } from '../../theme'
import type { TabsProps } from './Tabs.types'

export function Tabs(props: TabsProps): ReactElement {
  const { items, active, onChange } = props
  const { colors } = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 28,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      {items.map((item) => {
        const selected = item.key === active
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={{
              paddingBottom: 12,
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: selected ? colors.pri : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: typography.label.fontSize,
                fontWeight: typography.label.fontWeight,
                color: selected ? colors.ink : colors.muted,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
