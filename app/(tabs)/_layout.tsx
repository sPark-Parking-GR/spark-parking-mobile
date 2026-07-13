import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@spark/ui'
import { Tabs } from 'expo-router'
import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Sheet } from '../../src/components/Sheet'
import { useLanguage } from '../../src/i18n/LanguageProvider'
import { useOverlay } from '../../src/navigation/OverlayContext'
import { FacilityDetailOverlay } from '../../src/screens/FacilityDetailOverlay'
import { FiltersOverlay } from '../../src/screens/FiltersOverlay'
import { ReviewOverlay } from '../../src/screens/ReviewOverlay'
import { TicketOverlay } from '../../src/screens/TicketOverlay'
import { TimePickerOverlay } from '../../src/screens/TimePickerOverlay'

export default function TabsLayout() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { overlay, closeOverlay } = useOverlay()
  const insets = useSafeAreaInsets()

  // Latch the params of the sheet-style overlays so their content stays rendered
  // through the Sheet's exit animation after `overlay` clears.
  const lastTimePicker = useRef<Extract<typeof overlay, { type: 'timePicker' }> | null>(null)
  if (overlay?.type === 'timePicker') lastTimePicker.current = overlay
  const timePicker = lastTimePicker.current

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.pri,
          tabBarInactiveTintColor: colors.faint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: overlay
            ? styles.hidden
            : [
                styles.tabBar,
                {
                  backgroundColor: colors.tabbar,
                  borderTopColor: colors.line,
                  height: 58 + insets.bottom,
                  paddingBottom: insets.bottom + 12,
                },
              ],
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: t('navMap'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'map' : 'map-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="saved"
          options={{
            title: t('navSaved'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'bookmark' : 'bookmark-outline'}
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: t('navTrips'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'receipt' : 'receipt-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('navProfile'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
            ),
          }}
        />
      </Tabs>

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

      {overlay?.type === 'ticket' && (
        <View style={styles.overlay}>
          <TicketOverlay
            facilityName={overlay.facilityName}
            code={overlay.code}
            booking={overlay.booking}
            totalCents={overlay.totalCents}
            currency={overlay.currency}
          />
        </View>
      )}

      <Sheet open={overlay?.type === 'timePicker'} onClose={closeOverlay}>
        {timePicker ? (
          <TimePickerOverlay initial={timePicker.initial} onApply={timePicker.onApply} />
        ) : null}
      </Sheet>

      <Sheet open={overlay?.type === 'filters'} onClose={closeOverlay}>
        <FiltersOverlay />
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
  overlay: { position: 'absolute', inset: 0, zIndex: 100 },
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 9,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
})
