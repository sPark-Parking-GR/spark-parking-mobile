import { useCallback, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import type { FacilitySearchResult } from '../lib/api'
import { colors, font, radius, space } from '../theme'
import { FacilityCard } from './FacilityCard'

const PEEK = 132
const TAP_THRESHOLD = 8
const SPRING = { damping: 20, stiffness: 200 }

export function BottomSheet({
  results,
  loading,
  error,
  onSelect,
}: {
  results: FacilitySearchResult[]
  loading: boolean
  error?: string | null
  onSelect: (id: string) => void
}) {
  const { height: screenH } = useWindowDimensions()
  const fullH = Math.round(screenH * 0.85)
  const halfH = Math.round(screenH * 0.5)

  // translateY: 0 = full open; larger = more closed
  const openY = 0
  const halfY = fullH - halfH
  const peekY = fullH - PEEK

  const ty = useSharedValue(peekY)
  const start = useSharedValue(peekY)
  const [expanded, setExpanded] = useState(false)

  const setExpandedJS = useCallback((y: number) => setExpanded(y <= halfY + 1), [halfY])

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = ty.value
    })
    .onUpdate((e) => {
      ty.value = Math.min(peekY, Math.max(openY, start.value + e.translationY))
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationY)
      let dest: number
      if (moved < TAP_THRESHOLD) {
        dest = start.value >= peekY - 1 ? halfY : peekY
      } else {
        const cur = ty.value
        const dO = Math.abs(openY - cur)
        const dH = Math.abs(halfY - cur)
        const dP = Math.abs(peekY - cur)
        dest = dO <= dH && dO <= dP ? openY : dH <= dP ? halfY : peekY
      }
      ty.value = withSpring(dest, SPRING)
      runOnJS(setExpandedJS)(dest)
    })

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  const headerLabel = error
    ? error
    : loading
      ? 'Αναζήτηση…'
      : `${results.length} χώροι στάθμευσης`

  return (
    <Animated.View style={[styles.sheet, { height: fullH }, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.header}>
          <View style={styles.grip} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>{headerLabel}</Text>
            <Text style={styles.hint}>{expanded ? 'Λίστα' : 'Σύρε για λίστα'}</Text>
          </View>
        </View>
      </GestureDetector>

      <Animated.ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        scrollEnabled={expanded}
        showsVerticalScrollIndicator={expanded}
      >
        {loading ? (
          <>
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
            <View style={styles.skeleton} />
          </>
        ) : results.length === 0 ? (
          <Text style={styles.empty}>Δεν βρέθηκαν χώροι. Δοκίμασε άλλη ώρα ή προορισμό.</Text>
        ) : (
          results.map((r) => (
            <FacilityCard key={r.id} result={r} onPress={() => onSelect(r.id)} />
          ))
        )}
      </Animated.ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  header: { paddingTop: space.sm, paddingBottom: space.sm },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  title: { fontSize: font.body, fontWeight: '600', color: colors.textMain, flexShrink: 1 },
  hint: { fontSize: font.tiny, color: colors.textSecondary },
  body: { flex: 1 },
  bodyContent: { padding: space.md, paddingTop: space.xs },
  skeleton: {
    height: 84,
    borderRadius: radius.md,
    marginBottom: space.md,
    backgroundColor: colors.neutralBg,
  },
  empty: { fontSize: font.body, color: colors.textSecondary },
})
