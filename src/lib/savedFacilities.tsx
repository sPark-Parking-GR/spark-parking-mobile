import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

const SAVED_FACILITIES_STORAGE_KEY = 'spark-saved-facilities'

export interface SavedFacility {
  id: string
  name: string
  address: string
}

async function readSaved(): Promise<SavedFacility[]> {
  const stored = await AsyncStorage.getItem(SAVED_FACILITIES_STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as SavedFacility[]
  } catch {
    return []
  }
}

export interface SavedFacilitiesContextValue {
  saved: SavedFacility[]
  isSaved: (id: string) => boolean
  toggleSaved: (facility: SavedFacility) => void
  reload: () => void
}

const SavedFacilitiesContext = createContext<SavedFacilitiesContextValue | null>(null)

// One shared instance of the saved list, provided once at the app root — every
// screen that reads or toggles it (Saved tab, facility detail star) sees the
// same live state instead of its own disconnected snapshot.
export function SavedFacilitiesProvider({ children }: { children: ReactNode }): ReactElement {
  const [saved, setSaved] = useState<SavedFacility[]>([])

  useEffect(() => {
    let cancelled = false
    void readSaved().then((list) => {
      if (!cancelled) setSaved(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(() => {
    void readSaved().then(setSaved)
  }, [])

  const toggleSaved = useCallback((facility: SavedFacility) => {
    setSaved((prev) => {
      const next = prev.some((f) => f.id === facility.id)
        ? prev.filter((f) => f.id !== facility.id)
        : [...prev, facility]
      void AsyncStorage.setItem(SAVED_FACILITIES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isSaved = useCallback((id: string) => saved.some((f) => f.id === id), [saved])

  const value = useMemo<SavedFacilitiesContextValue>(
    () => ({ saved, isSaved, toggleSaved, reload }),
    [saved, isSaved, toggleSaved, reload],
  )

  return <SavedFacilitiesContext.Provider value={value}>{children}</SavedFacilitiesContext.Provider>
}

export function useSavedFacilities(): SavedFacilitiesContextValue {
  const ctx = useContext(SavedFacilitiesContext)
  if (!ctx) {
    throw new Error('useSavedFacilities must be used within a SavedFacilitiesProvider')
  }
  return ctx
}
