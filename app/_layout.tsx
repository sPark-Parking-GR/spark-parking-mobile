import { useTheme } from '@spark/ui'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '../src/auth/AuthProvider'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { SavedFacilitiesProvider } from '../src/lib/savedFacilities'
import { OverlayProvider } from '../src/navigation/OverlayContext'
import { AppThemeProvider } from '../src/theme/AppThemeProvider'

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
  return (
    <LanguageProvider>
      <AppThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemedStatusBar />
            <AuthProvider>
              <SavedFacilitiesProvider>
                <OverlayProvider>
                  <RootNavigator />
                </OverlayProvider>
              </SavedFacilitiesProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppThemeProvider>
    </LanguageProvider>
  )
}
