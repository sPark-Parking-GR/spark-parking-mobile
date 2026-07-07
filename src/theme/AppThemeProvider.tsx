import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeProvider } from '@spark/ui'
import type { ThemeOverride, ThemeStorageAdapter } from '@spark/ui'
import type { ReactElement, ReactNode } from 'react'
import { useColorScheme } from 'react-native'

const THEME_STORAGE_KEY = 'spark-theme'

const themeStorage: ThemeStorageAdapter = {
  async get() {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  },
  async set(mode: ThemeOverride) {
    if (mode === null) {
      await AsyncStorage.removeItem(THEME_STORAGE_KEY)
      return
    }
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode)
  },
}

export interface AppThemeProviderProps {
  children: ReactNode
}

export function AppThemeProvider(props: AppThemeProviderProps): ReactElement {
  const { children } = props
  const colorScheme = useColorScheme()
  const systemScheme = colorScheme === 'light' ? 'light' : 'dark'

  return (
    <ThemeProvider systemScheme={systemScheme} storage={themeStorage}>
      {children}
    </ThemeProvider>
  )
}
