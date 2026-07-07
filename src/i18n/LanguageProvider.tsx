import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import type { Locale } from './messages'
import { messages } from './messages'

const LANGUAGE_STORAGE_KEY = 'spark-lang'

function detectLocale(): Locale {
  const languageCode = getLocales()[0]?.languageCode
  return languageCode?.startsWith('el') ? 'el' : 'en'
}

export interface LanguageContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider(props: LanguageProviderProps): ReactElement {
  const { children } = props
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (!cancelled && (stored === 'en' || stored === 'el')) {
        setLocaleState(stored)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  const t = useCallback((key: string) => messages[locale][key] ?? key, [locale])

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}
