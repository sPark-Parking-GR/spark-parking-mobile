import { spacing, useTheme } from '../theme'
import { type ReactNode, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const SPRING = { damping: 22, stiffness: 220, mass: 0.9 }
const FADE = 220
const DISMISS_RATIO = 0.3
const DISMISS_VELOCITY = 800

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { colors } = useTheme()
  const { height } = useWindowDimensions()
  const [mounted, setMounted] = useState(open)
  const ty = useSharedValue(height)
  const opacity = useSharedValue(0)
  const sheetH = useSharedValue(height)

  useEffect(() => {
    if (open) {
      setMounted(true)
      opacity.value = withTiming(1, { duration: FADE, easing: Easing.out(Easing.quad) })
      ty.value = withSpring(0, SPRING)
    } else if (mounted) {
      opacity.value = withTiming(0, { duration: FADE, easing: Easing.in(Easing.quad) })
      ty.value = withTiming(
        sheetH.value,
        { duration: FADE, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false)
        },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = Gesture.Pan()
    .hitSlop({ top: 8, bottom: 24, left: 80, right: 80 })
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > sheetH.value * DISMISS_RATIO || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)()
      } else {
        ty.value = withSpring(0, SPRING)
      }
    })

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  if (!mounted) return null

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, { backgroundColor: colors.scrim }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.sheet }, sheetStyle]}
            onLayout={(e) => {
              sheetH.value = e.nativeEvent.layout.height
            }}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.handle}>
                <View style={[styles.grip, { backgroundColor: colors.muted, opacity: 0.4 }]} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    gap: spacing.md,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: -20 },
    elevation: 12,
  },
  handle: { paddingBottom: spacing.xs, alignItems: 'center' },
  grip: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
})
