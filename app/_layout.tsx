import { useTheme } from '../src/theme'
import { StripeProvider } from '@stripe/stripe-react-native'
import * as Notifications from 'expo-notifications'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '../src/auth/AuthProvider'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { STRIPE_PUBLISHABLE_KEY, paymentsConfigured } from '../src/lib/payments'
import { purgeLegacyQrSecrets } from '../src/lib/qrSecretPurge'
import { SavedFacilitiesProvider } from '../src/lib/savedFacilities'
import { OverlayProvider } from '../src/navigation/OverlayContext'
import { AppThemeProvider } from '../src/theme/AppThemeProvider'

// Module-level, once: still shows an alert while the app is foregrounded, matching what
// the OS already does automatically while backgrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Mounting StripeProvider without a key makes the SDK throw on first use, which would take
// the whole app down over a missing env var rather than the one screen that needs it.
function PaymentsProvider({ children }: { children: ReactElement }): ReactElement {
  if (!paymentsConfigured()) return children
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>{children}</StripeProvider>
}

function ThemedStatusBar(): ReactElement {
  const { mode } = useTheme()
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
}

function RootNavigator(): ReactElement {
  const { colors } = useTheme()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.pri,
        headerTitleStyle: { color: colors.ink, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="facility/[id]" options={{ headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  // Ahead of any screen that could rewrite the trips caches this reads booking ids from.
  useEffect(() => {
    purgeLegacyQrSecrets().catch(() => undefined)
  }, [])

  // Deep-links a tapped notification to the screen it's about — today only bookings, and
  // only the list, since there is no per-booking detail screen to land on more precisely.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (data?.['type'] === 'booking') router.push('/(tabs)/trips')
    })
    return () => subscription.remove()
  }, [])

  return (
    <LanguageProvider>
      <AppThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemedStatusBar />
            <AuthProvider>
              <PaymentsProvider>
                <SavedFacilitiesProvider>
                  <OverlayProvider>
                    <RootNavigator />
                  </OverlayProvider>
                </SavedFacilitiesProvider>
              </PaymentsProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppThemeProvider>
    </LanguageProvider>
  )
}
