import { createContext, useContext } from 'react'
import type { SharedValue } from 'react-native-reanimated'

export const SheetExpandContext = createContext<SharedValue<number> | null>(null)

export function useSheetExpandProgress(): SharedValue<number> {
  const ctx = useContext(SheetExpandContext)
  if (!ctx) {
    throw new Error('useSheetExpandProgress must be used within a SheetExpandContext.Provider')
  }
  return ctx
}
