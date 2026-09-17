import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { colors, radii, shadows } from './tokens'
import type { ThemeMode } from './tokens'

export type ThemeOverride = ThemeMode | null

export interface ThemeStorageAdapter {
  get(): ThemeOverride | Promise<ThemeOverride>
  set(mode: ThemeOverride): void | Promise<void>
}

export interface ThemeProviderProps {
  children: ReactNode
  systemScheme: ThemeMode
  storage?: ThemeStorageAdapter
}

export interface ThemeContextValue {
  mode: ThemeMode
  override: ThemeOverride
  colors: typeof colors.light
  radii: typeof radii
  shadows: typeof shadows.light
  setOverride: (next: ThemeOverride) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider(props: ThemeProviderProps): ReactElement {
  const { children, systemScheme, storage } = props
  const [override, setOverrideState] = useState<ThemeOverride>(null)

  useEffect(() => {
    if (!storage) return
    let cancelled = false
    void Promise.resolve(storage.get()).then((stored) => {
      if (!cancelled) setOverrideState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [storage])

  const setOverride = useCallback(
    (next: ThemeOverride) => {
      setOverrideState(next)
      void Promise.resolve(storage?.set(next))
    },
    [storage],
  )

  const mode = override ?? systemScheme

  const toggle = useCallback(() => {
    setOverride(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setOverride])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      override,
      colors: colors[mode] as typeof colors.light,
      radii,
      shadows: shadows[mode] as typeof shadows.light,
      setOverride,
      toggle,
    }),
    [mode, override, setOverride, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
