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
import { z } from 'zod'

import { listSavedFacilities, saveFacility, unsaveFacility, type RemoteSavedFacility } from './api'
import { identity } from './identity'
import { useAuth } from '../auth/AuthProvider'

// Scoped to the account, like the trips cache: saved spots are personal, and a shared
// device must not leak the previous user's list.
function cacheKey(userId: string): string {
  return `spark-saved-facilities:${userId}`
}

export interface SavedFacility {
  id: string
  name: string
  address: string
  /** False once the operator has deactivated, un-verified or restricted the facility. */
  available: boolean
}

// `available` defaults rather than being required, so a cache written before the field
// existed still parses instead of emptying the user's list on the first launch after an
// update. The next successful list fetch replaces the assumption with the server's answer.
const savedSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  address: z.string(),
  available: z.boolean().default(true),
})

function fromRemote(remote: RemoteSavedFacility): SavedFacility {
  return {
    id: remote.facilityId,
    name: remote.name,
    address: remote.address,
    available: remote.available,
  }
}

async function readCache(userId: string): Promise<SavedFacility[]> {
  const raw = await AsyncStorage.getItem(cacheKey(userId)).catch(() => null)
  if (!raw) return []
  try {
    const parsed = z.array(savedSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeCache(userId: string, saved: SavedFacility[]): Promise<void> {
  return AsyncStorage.setItem(cacheKey(userId), JSON.stringify(saved)).catch(() => undefined)
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
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [saved, setSaved] = useState<SavedFacility[]>([])

  useEffect(() => {
    if (!userId) {
      setSaved([])
      return
    }

    let cancelled = false

    const hydrate = async (): Promise<void> => {
      const cached = await readCache(userId)
      if (cancelled) return
      if (cached.length > 0) setSaved(cached)

      const remote = await listSavedFacilities(identity).catch(() => null)
      if (cancelled || !remote) return

      const records = remote.map(fromRemote)
      setSaved(records)
      await writeCache(userId, records)
    }

    hydrate().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [userId])

  const reload = useCallback(() => {
    if (!userId) return

    const refresh = async (): Promise<void> => {
      const remote = await listSavedFacilities(identity).catch(() => null)
      if (remote) {
        const records = remote.map(fromRemote)
        setSaved(records)
        await writeCache(userId, records)
        return
      }
      setSaved(await readCache(userId))
    }

    refresh().catch(() => undefined)
  }, [userId])

  const toggleSaved = useCallback(
    (facility: SavedFacility) => {
      if (!userId) return

      const wasSaved = saved.some((entry) => entry.id === facility.id)
      const next = wasSaved
        ? saved.filter((entry) => entry.id !== facility.id)
        : [...saved, facility]

      // Applied locally first: the star must respond at the barrier with no signal. A
      // failed write is reconciled by the next successful list fetch.
      setSaved(next)
      writeCache(userId, next).catch(() => undefined)

      const push = wasSaved
        ? unsaveFacility(facility.id, identity)
        : saveFacility(facility.id, identity)
      push.catch(() => undefined)
    },
    [saved, userId],
  )

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
