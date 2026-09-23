import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'
import { Animated, Pressable } from 'react-native'

import { useTheme } from '../../theme'
import type { SwitchProps } from './Switch.types'

export function Switch(props: SwitchProps): ReactElement {
  const { checked, onChange, disabled } = props
  const { colors, radii } = useTheme()
  const left = useRef(new Animated.Value(checked ? 21 : 3)).current

  useEffect(() => {
    Animated.timing(left, {
      toValue: checked ? 21 : 3,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [checked, left])

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: radii.pill,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: checked ? colors.pri : colors.card2,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 3,
          left,
          width: 18,
          height: 18,
          borderRadius: radii.pill,
          backgroundColor: '#fff',
        }}
      />
    </Pressable>
  )
}
