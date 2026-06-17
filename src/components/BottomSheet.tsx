import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View, type ListRenderItem } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import type { FacilitySearchResult } from '../lib/api'
import { colors, font, radius, space } from '../theme'
import { FacilityCard } from './FacilityCard'

const PEEK = 132
const TAP_THRESHOLD = 8
// A flick faster than this commits one detent in the swipe direction, even on a
// short drag — so a deliberate swipe deploys/collapses instead of snapping back.
const FLICK_VELOCITY = 500
const TIMING = { duration: 200 }

export function BottomSheet({
  results,
  loading,
  error,
  onSelect,
  collapse,
}: {
  results: FacilitySearchResult[]
  loading: boolean
  error?: string | null
  onSelect: (id: string) => void
  // Bump to collapse the sheet to its peek position (e.g. on empty-map tap).
  collapse: number
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

  // List scroll state, plus the handoff bookkeeping for delegating edge scroll.
  const scrollRef = useAnimatedRef<Animated.FlatList<FacilitySearchResult>>()
  const scrollY = useSharedValue(0)
  const maxScroll = useSharedValue(0)
  // True once a list-edge pull has taken over driving the sheet this gesture.
  const driving = useSharedValue(false)
  // translationY at the moment the handoff engaged, so the sheet doesn't jump.
  const handoff = useSharedValue(0)

  const setExpandedJS = useCallback((y: number) => setExpanded(y <= halfY + 1), [halfY])

  // Resting detents, open (top) → closed (bottom).
  const snapTo = (startY: number, curY: number, velocityY: number) => {
    'worklet'
    const order = [openY, halfY, peekY]
    if (velocityY <= -FLICK_VELOCITY || velocityY >= FLICK_VELOCITY) {
      // Step one detent from where the drag began, in the flick direction.
      let si = 0
      if (Math.abs(halfY - startY) < Math.abs(order[si]! - startY)) si = 1
      if (Math.abs(peekY - startY) < Math.abs(order[si]! - startY)) si = 2
      return velocityY < 0 ? order[Math.max(0, si - 1)]! : order[Math.min(2, si + 1)]!
    }
    const dO = Math.abs(openY - curY)
    const dH = Math.abs(halfY - curY)
    const dP = Math.abs(peekY - curY)
    return dO <= dH && dO <= dP ? openY : dH <= dP ? halfY : peekY
  }

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
    maxScroll.value = Math.max(0, e.contentSize.height - e.layoutMeasurement.height)
  })

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = ty.value
    })
    .onUpdate((e) => {
      ty.value = Math.min(peekY, Math.max(openY, start.value + e.translationY))
    })
    .onEnd((e) => {
      const moved = Math.abs(e.translationY)
      const dest =
        moved < TAP_THRESHOLD
          ? start.value >= peekY - 1
            ? halfY
            : peekY
          : snapTo(start.value, ty.value, e.velocityY)
      ty.value = withTiming(dest, TIMING)
      runOnJS(setExpandedJS)(dest)
    })

  // Runs simultaneously with the list's native scroll. While the list scrolls
  // normally this does nothing; at the top edge a continued pull-down retracts
  // the sheet, and at the bottom edge a continued pull-up expands it.
  const listScroll = Gesture.Native()
  const listPan = Gesture.Pan()
    .onBegin(() => {
      start.value = ty.value
      driving.value = false
      handoff.value = 0
    })
    .onUpdate((e) => {
      if (!driving.value) {
        const atTop = scrollY.value <= 0
        const atBottom = scrollY.value >= maxScroll.value - 1
        const canRetract = ty.value < peekY - 1
        const canExpand = ty.value > openY + 1
        if ((atTop && e.translationY > 0 && canRetract) || (atBottom && e.translationY < 0 && canExpand)) {
          driving.value = true
          handoff.value = e.translationY
          start.value = ty.value
        } else {
          return
        }
      }
      // Pin the list at its edge so the finger drives only the sheet.
      scrollTo(scrollRef, 0, scrollY.value, false)
      ty.value = Math.min(peekY, Math.max(openY, start.value + e.translationY - handoff.value))
    })
    .onEnd((e) => {
      if (!driving.value) return
      driving.value = false
      const dest = snapTo(start.value, ty.value, e.velocityY)
      ty.value = withTiming(dest, TIMING)
      runOnJS(setExpandedJS)(dest)
    })
    .simultaneousWithExternalGesture(listScroll)

  useEffect(() => {
    if (collapse === 0 || ty.value >= peekY - 1) return
    ty.value = withTiming(peekY, TIMING)
    setExpanded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapse])

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  const keyExtractor = useCallback((item: FacilitySearchResult) => item.id, [])
  const renderItem = useCallback<ListRenderItem<FacilitySearchResult>>(
    ({ item }) => <FacilityCard result={item} onSelect={onSelect} />,
    [onSelect],
  )
  const listEmpty = loading ? (
    <>
      <View style={styles.skeleton} />
      <View style={styles.skeleton} />
      <View style={styles.skeleton} />
    </>
  ) : (
    <Text style={styles.empty}>Δεν βρέθηκαν χώροι. Δοκίμασε άλλη ώρα ή προορισμό.</Text>
  )

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
            {!expanded && <Text style={styles.hint}>Σύρε για λίστα</Text>}
          </View>
        </View>
      </GestureDetector>

      <GestureDetector gesture={Gesture.Simultaneous(listPan, listScroll)}>
        <Animated.FlatList
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={listEmpty}
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={expanded}
          onScroll={onScroll}
          scrollEventThrottle={16}
          bounces={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      </GestureDetector>
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
