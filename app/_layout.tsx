import { useTheme } from '@spark/ui'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { ONBOARDED_STORAGE_KEY } from '../src/lib/constants'
import { OverlayProvider } from '../src/navigation/OverlayContext'
import { colors as staticColors } from '../src/theme'
import { AppThemeProvider } from '../src/theme/AppThemeProvider'

function RootNavigator({ onboarded }: { onboarded: boolean }): ReactElement {
  const { colors } = useTheme()

  return (
    <Stack
      initialRouteName={onboarded ? '(tabs)' : 'onboarding'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.pri,
        headerTitleStyle: { color: colors.ink, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="facility/[id]" options={{ headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(ONBOARDED_STORAGE_KEY).then((stored) => {
      if (!cancelled) setOnboarded(stored === 'true')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (onboarded === null) {
    return <View style={{ flex: 1, backgroundColor: staticColors.bg }} />
  }

  return (
    <LanguageProvider>
      <AppThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <OverlayProvider>
              <RootNavigator onboarded={onboarded} />
            </OverlayProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppThemeProvider>
    </LanguageProvider>
  )
}
