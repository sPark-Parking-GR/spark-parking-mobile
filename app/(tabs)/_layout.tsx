import { Ionicons } from '@expo/vector-icons'
import { radii, spacing, useTheme } from '../../src/theme'
import { BlurTargetView, BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { useRef, type ComponentProps, type ReactNode, type RefObject } from 'react'

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Sheet } from '../../src/components/Sheet'
import { useLanguage } from '../../src/i18n/LanguageProvider'
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '../../src/lib/constants'
import { useOverlay } from '../../src/navigation/OverlayContext'
import { SheetExpandContext, useSheetExpandProgress } from '../../src/navigation/SheetExpandContext'
import { AuthOverlay } from '../../src/screens/AuthOverlay'
import { FacilityDetailOverlay } from '../../src/screens/FacilityDetailOverlay'
import { FiltersOverlay } from '../../src/screens/FiltersOverlay'
import { PlanOverlay } from '../../src/screens/PlanOverlay'
import { ReviewOverlay } from '../../src/screens/ReviewOverlay'
import { TicketOverlay } from '../../src/screens/TicketOverlay'
import { TimePickerOverlay } from '../../src/screens/TimePickerOverlay'

// How far the whole bar (fill, border, shadow, items) shrinks toward, at full
// expand — reads as the bar receding/disengaging, not just its labels vanishing.
const BAR_DISENGAGE_SCALE = 0.9

function AnimatedTabIcon({ scale, children }: { scale: SharedValue<number>; children: ReactNode }) {
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return <Animated.View style={animatedStyle}>{children}</Animated.View>
}

// Single-line height of styles.tabLabel (fontSize 10, bold) plus the gap above
// it — fixed rather than measured via onLayout, since a Text inside a parent
// already animated to height:0 can never report a real size to measure from.
const TAB_LABEL_HEIGHT = 16
const TAB_LABEL_GAP = 3

// Collapses to icon-only as the map's bottom sheet expands (progress 0 → 1).
// Height (not just opacity) goes to 0 so it's fully out of layout, letting the
// icon above it recenter in the tab slot via the row's own justifyContent: 'center'.
function AnimatedTabLabel({
  progress,
  color,
  children,
}: {
  progress: SharedValue<number>
  color: string
  children: string
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const shown = 1 - progress.value
    return {
      opacity: shown,
      height: TAB_LABEL_HEIGHT * shown,
      marginTop: TAB_LABEL_GAP * shown,
    }
  })
  return (
    <Animated.View style={[styles.labelWrap, animatedStyle]}>
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {children}
      </Text>
    </Animated.View>
  )
}

// Fully custom bar (rather than tabBarStyle/tabBarBackground/tabBarButton) so
// the visible pill — border, shadow, blur fill, and item row — is one real
// view we can scale as a single unit. tabBarStyle's host view isn't a
// Reanimated node, so a shared value can't drive its transform; splitting the
// shrink across the background layer and the items separately (an earlier
// attempt) left the static border/shadow behind, looking disconnected.
function CustomTabBar({
  state,
  descriptors,
  navigation,
  scaleByRoute,
  blurTarget,
}: BottomTabBarProps & {
  scaleByRoute: Record<string, SharedValue<number>>
  blurTarget: RefObject<View | null>
}) {
  const { colors, mode } = useTheme()
  const insets = useSafeAreaInsets()
  const { overlay, sheet } = useOverlay()
  const progress = useSheetExpandProgress()

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, BAR_DISENGAGE_SCALE], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: insets.bottom + TAB_BAR_GAP,
          borderColor: colors.line,
          display: overlay || sheet ? 'none' : 'flex',
        },
        animatedStyle,
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <BlurView
          tint={mode === 'dark' ? 'dark' : 'light'}
          intensity={70}
          blurMethod="dimezisBlurView"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.surface, opacity: mode === 'dark' ? 0.55 : 0.75 },
          ]}
        />
      </View>

      <View style={styles.tabBarRow}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!
          const focused = state.index === index
          const color = focused ? colors.pri : colors.faint
          const scale = scaleByRoute[route.name]!
          const label = typeof options.title === 'string' ? options.title : route.name

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
          }
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              onPressIn={() => {
                scale.value = withTiming(0.8, { duration: 90 })
              }}
              onPressOut={() => {
                scale.value = withTiming(1, { duration: 160 })
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.buttonInner}
            >
              <AnimatedTabIcon scale={scale}>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
              </AnimatedTabIcon>
              <AnimatedTabLabel progress={progress} color={color}>
                {label}
              </AnimatedTabLabel>
            </Pressable>
          )
        })}
      </View>
    </Animated.View>
  )
}

export default function TabsLayout() {
  const { t } = useLanguage()
  const { overlay, sheet, closeSheet } = useOverlay()

  // One press-scale value per tab, shared between that tab's button (sets it
  // on press) and its icon (reads it).
  const mapScale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tripsScale = useSharedValue(1)
  const profileScale = useSharedValue(1)
  const scaleByRoute = {
    map: mapScale,
    saved: savedScale,
    trips: tripsScale,
    profile: profileScale,
  }

  // 0 = sheet at peek (labels shown), 1 = sheet expanded (labels hidden). Written
  // by the map's BottomSheet, read by the tab bar's labels and its own shrink.
  const sheetProgress = useSharedValue(0)

  // Latch the params of the sheet-style overlays so their content stays rendered
  // through the Sheet's exit animation after `sheet` clears.
  const lastTimePicker = useRef<Extract<typeof sheet, { type: 'timePicker' }> | null>(null)
  if (sheet?.type === 'timePicker') lastTimePicker.current = sheet
  const timePicker = lastTimePicker.current

  // What the tab bar's Android blur samples as its background — the screen
  // content underneath it, not the bar itself.
  const blurTarget = useRef<View>(null)

  return (
    <SheetExpandContext.Provider value={sheetProgress}>
      <View style={styles.root}>
        <BlurTargetView ref={blurTarget} style={styles.root}>
          <Tabs
            tabBar={(props) => (
              <CustomTabBar {...props} scaleByRoute={scaleByRoute} blurTarget={blurTarget} />
            )}
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen
              name="map"
              options={{
                title: t('navMap'),
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={size} />
                ),
              }}
            />
            <Tabs.Screen
              name="saved"
              options={{
                title: t('navSaved'),
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons name={focused ? 'star' : 'star-outline'} color={color} size={size} />
                ),
              }}
            />
            <Tabs.Screen
              name="trips"
              options={{
                title: t('navTrips'),
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons
                    name={focused ? 'receipt' : 'receipt-outline'}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: t('navProfile'),
                tabBarIcon: ({ focused, color, size }) => (
                  <Ionicons
                    name={focused ? 'person' : 'person-outline'}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
          </Tabs>
        </BlurTargetView>

        {overlay?.type === 'facilityDetail' && (
          <View style={styles.overlay}>
            <FacilityDetailOverlay facilityId={overlay.facilityId} booking={overlay.booking} />
          </View>
        )}

        {overlay?.type === 'review' && (
          <View style={styles.overlay}>
            <ReviewOverlay
              facilityId={overlay.facilityId}
              facilityName={overlay.facilityName}
              facilityAddress={overlay.facilityAddress}
              booking={overlay.booking}
              quote={overlay.quote}
            />
          </View>
        )}

        {overlay?.type === 'plan' && (
          <View style={styles.overlay}>
            <PlanOverlay />
          </View>
        )}

        {overlay?.type === 'auth' && (
          <View style={styles.overlay}>
            <AuthOverlay mode={overlay.mode} />
          </View>
        )}

        {overlay?.type === 'ticket' && (
          <View style={styles.overlay}>
            <TicketOverlay
              bookingId={overlay.bookingId}
              facilityName={overlay.facilityName}
              code={overlay.code}
              booking={overlay.booking}
              totalCents={overlay.totalCents}
              currency={overlay.currency}
            />
          </View>
        )}

        <Sheet open={sheet?.type === 'timePicker'} onClose={closeSheet}>
          {timePicker ? (
            <TimePickerOverlay
              initial={timePicker.initial}
              onApply={timePicker.onApply}
              showVehicleSelector={timePicker.showVehicleSelector}
            />
          ) : null}
        </Sheet>

        <Sheet open={sheet?.type === 'filters'} onClose={closeSheet}>
          <FiltersOverlay />
        </Sheet>
      </View>
    </SheetExpandContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { position: 'absolute', inset: 0, zIndex: 100 },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBarRow: { flex: 1, flexDirection: 'row' },
  buttonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
  },
  labelWrap: { overflow: 'hidden' },
})
