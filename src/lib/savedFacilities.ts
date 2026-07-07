import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

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

export interface UseSavedFacilitiesResult {
  saved: SavedFacility[]
  isSaved: (id: string) => boolean
  toggleSaved: (facility: SavedFacility) => void
  reload: () => void
}

export function useSavedFacilities(): UseSavedFacilitiesResult {
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

  return { saved, isSaved, toggleSaved, reload }
}
