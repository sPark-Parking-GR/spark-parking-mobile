import { radii, spacing, typography, useTheme } from '../theme'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View, type ListRenderItem } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { FacilityCard } from './FacilityCard'
import { SegmentedControl, type Segment } from './SegmentedControl'
import { useLanguage } from '../i18n/LanguageProvider'
import type { FacilitySearchResult } from '../lib/api'

export type SortMode = 'nearby' | 'cost'

// Header content (grip + title row) needs about this much room above the
// floating tab bar's top edge for the collapsed sheet to clear it with a gap.
const PEEK_HEADER_ROOM = 88
const TAP_THRESHOLD = 8
// A flick faster than this commits one detent in the swipe direction, even on a
// short drag — so a deliberate swipe deploys/collapses instead of snapping back.
const FLICK_VELOCITY = 500
const TIMING = { duration: 200 }

export function BottomSheet({
  results,
  clustered,
  loading,
  error,
  onSelect,
  collapse,
  sortMode,
  onSortNearby,
  onSortCost,
  costLabel,
  cheapestId,
  onExpandedChange,
  bottomInset,
  expandProgress,
  heightValue,
}: {
  results: FacilitySearchResult[]
  // The map is showing aggregated clusters (zoomed out), so the list is empty by
  // design — surface a zoom-in hint instead of the generic empty state.
  clustered?: boolean
  loading: boolean
  error?: string | null
  onSelect: (id: string) => void
  // Bump to collapse the sheet to its peek position (e.g. on empty-map tap).
  collapse: number
  sortMode: SortMode
  onSortNearby: () => void
  // Opens the cost-order sheet (date/time/vehicle) and switches to cost sort.
  onSortCost: () => void
  // Active cost window summary, shown under the chips while sorting by cost.
  costLabel?: string | null
  // Id of the currently-cheapest priced result in the list, tagged in its row.
  cheapestId?: string | null
  // Fires when the sheet settles above/at its peek detent, so the map's floating
  // controls can move clear of the sheet instead of sitting under it.
  onExpandedChange?: (expanded: boolean) => void
  // Extra bottom padding for the list so its last item can scroll clear of the
  // floating tab bar instead of staying hidden behind it.
  bottomInset: number
  // Shared with the tab bar so its labels hide in lockstep as this sheet expands.
  expandProgress?: SharedValue<number>
  // Live-updated with the sheet's current visible height (px above the screen
  // bottom), so floating controls above it can track every detent and drag.
  heightValue?: SharedValue<number>
}) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const sortSegments: Segment[] = [
    { value: 'nearby', label: t('sortNearby'), icon: 'map-marker-distance' },
    { value: 'cost', label: t('sortCheapest'), icon: 'cash' },
  ]
  const { height: screenH } = useWindowDimensions()
  const fullH = Math.round(screenH * 0.85)
  const halfH = Math.round(screenH * 0.5)
  // Clears the floating tab bar's full footprint (height + gap + safe-area inset)
  // plus room for the header, so the collapsed sheet sits above it, not behind it.
  const peek = bottomInset + PEEK_HEADER_ROOM

  // translateY: 0 = full open; larger = more closed
  const openY = 0
  const halfY = fullH - halfH
  const peekY = fullH - peek

  const ty = useSharedValue(peekY)
  const start = useSharedValue(peekY)
  const [expanded, setExpanded] = useState(false)
  const headerH = useSharedValue(0)
  // 1 only once the sheet has settled at the full detent; drives the sort row's
  // reveal so it appears after the half→full animation finishes, not during it.
  const sortReveal = useSharedValue(0)
  const sortH = useSharedValue(0)

  // 0 at peek → 1 from half-open upward. Drives the sort row + list clip below,
  // and (via expandProgress) the tab bar's label collapse in lockstep.
  const progress = useDerivedValue(() =>
    interpolate(ty.value, [halfY, peekY], [1, 0], Extrapolation.CLAMP),
  )

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (expandProgress && current !== previous) expandProgress.value = current
    },
  )

  // Tracks the sheet's actual visible height continuously — every drag frame,
  // detent snap, and programmatic collapse — so dependents never fall out of
  // sync the way a coarse expanded/collapsed boolean would. Capped at halfH so
  // floating controls stop climbing past the half detent and instead get
  // covered by the sheet as it keeps opening toward full.
  useAnimatedReaction(
    () => Math.min(fullH - ty.value, halfH),
    (current, previous) => {
      if (heightValue && current !== previous) heightValue.value = current
    },
  )

  // List scroll state, plus the handoff bookkeeping for delegating edge scroll.
  const scrollRef = useAnimatedRef<Animated.FlatList<FacilitySearchResult>>()
  const scrollY = useSharedValue(0)
  const maxScroll = useSharedValue(0)
  // True once a list-edge pull has taken over driving the sheet this gesture.
  const driving = useSharedValue(false)
  // translationY at the moment the handoff engaged, so the sheet doesn't jump.
  const handoff = useSharedValue(0)

  const setExpandedJS = useCallback(
    (y: number) => {
      const next = y <= halfY + 1
      setExpanded(next)
      onExpandedChange?.(next)
    },
    [halfY, onExpandedChange],
  )

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

  // Snaps ty to dest, then reveals the sort row only after arriving at the
  // partial detent or above. Collapsing to peek hides it immediately.
  const settle = (dest: number) => {
    'worklet'
    if (dest <= halfY) {
      ty.value = withTiming(dest, TIMING, (finished) => {
        if (finished) sortReveal.value = withTiming(1, TIMING)
      })
    } else {
      sortReveal.value = withTiming(0, TIMING)
      ty.value = withTiming(dest, TIMING)
    }
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
      settle(dest)
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
        if (
          (atTop && e.translationY > 0 && canRetract) ||
          (atBottom && e.translationY < 0 && canExpand)
        ) {
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
      settle(dest)
      runOnJS(setExpandedJS)(dest)
    })
    .simultaneousWithExternalGesture(listScroll)

  useEffect(() => {
    if (collapse === 0 || ty.value >= peekY - 1) return
    ty.value = withTiming(peekY, TIMING)
    sortReveal.value = withTiming(0, TIMING)
    setExpanded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapse])

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  // Clips the sort row + list together so, at the peek detent, only the header
  // (count + swipe hint) is visible — no partial list content peeking through.
  const bodyClipStyle = useAnimatedStyle(() => ({
    height: (fullH - headerH.value) * progress.value,
  }))

  // Collapses the sort row's height and fades it in lockstep with sortReveal, so
  // it only takes space and shows once the sheet has fully expanded.
  const sortWrapStyle = useAnimatedStyle(() => ({
    height: sortH.value * sortReveal.value,
    opacity: sortReveal.value,
  }))

  const keyExtractor = useCallback((item: FacilitySearchResult) => item.id, [])
  const renderItem = useCallback<ListRenderItem<FacilitySearchResult>>(
    ({ item }) => (
      <FacilityCard result={item} isCheapest={item.id === cheapestId} onSelect={onSelect} />
    ),
    [onSelect, cheapestId],
  )
  const skeletonStyle = [styles.skeleton, { borderRadius: radii.md, backgroundColor: colors.card2 }]
  const emptyStyle = [styles.empty, { color: colors.muted }]
  const listEmpty = loading ? (
    <>
      <View style={skeletonStyle} />
      <View style={skeletonStyle} />
      <View style={skeletonStyle} />
    </>
  ) : clustered ? (
    <Text style={emptyStyle}>{t('zoomToSeeSpots')}</Text>
  ) : (
    <Text style={emptyStyle}>{t('noResultsFound')}</Text>
  )

  const headerLabel = error
    ? error
    : loading
      ? t('searchingLabel')
      : clustered
        ? t('zoomForDetails')
        : `${results.length} ${t('parkingSpotsCountSuffix')}`

  return (
    <Animated.View
      style={[styles.sheet, { height: fullH, backgroundColor: colors.sheet }, sheetStyle]}
    >
      <GestureDetector gesture={pan}>
        <View
          style={styles.header}
          onLayout={(e) => {
            headerH.value = e.nativeEvent.layout.height
          }}
        >
          <View style={[styles.grip, { backgroundColor: colors.muted }]} />
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { fontSize: typography.label.fontSize, color: colors.ink }]}
            >
              {headerLabel}
            </Text>
            {!expanded && (
              <Text
                style={[
                  styles.hint,
                  { fontSize: typography.caption.fontSize, color: colors.muted },
                ]}
              >
                {t('swipeForList')}
              </Text>
            )}
          </View>
        </View>
      </GestureDetector>

      <Animated.View style={[styles.contentClip, bodyClipStyle]}>
        {!error && (
          <Animated.View style={[styles.sortClip, sortWrapStyle]}>
            <View
              style={styles.sortRow}
              onLayout={(e) => {
                sortH.value = e.nativeEvent.layout.height
              }}
            >
              <SegmentedControl
                segments={sortSegments}
                value={sortMode}
                onChange={(v) => (v === 'cost' ? onSortCost() : onSortNearby())}
              />
              {sortMode === 'cost' && costLabel ? (
                <Text
                  style={[
                    styles.sortCaption,
                    { fontSize: typography.caption.fontSize, color: colors.muted },
                  ]}
                  numberOfLines={1}
                >
                  {costLabel}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        )}

        <GestureDetector gesture={Gesture.Simultaneous(listPan, listScroll)}>
          <Animated.FlatList
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              { paddingBottom: spacing.md + bottomInset },
            ]}
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
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: -16 },
    elevation: 16,
  },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  grip: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.4,
    alignSelf: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: { fontWeight: '700', flexShrink: 1 },
  hint: { fontWeight: '600' },
  contentClip: { overflow: 'hidden' },
  sortClip: { overflow: 'hidden' },
  sortRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 6 },
  sortCaption: { fontWeight: '600', paddingHorizontal: 2 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.md, paddingTop: spacing.xs },
  skeleton: {
    height: 84,
    marginBottom: spacing.md,
  },
  empty: { fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight },
})
