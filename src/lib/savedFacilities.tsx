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
// device must not leak the previous user's list. A signed-out visitor gets the one fixed
// "guest" slot instead of a userId — there is no account yet to scope it to.
const GUEST_SCOPE = 'guest'

function cacheKey(scope: string): string {
  return `spark-saved-facilities:${scope}`
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

async function readCache(scope: string): Promise<SavedFacility[]> {
  const raw = await AsyncStorage.getItem(cacheKey(scope)).catch(() => null)
  if (!raw) return []
  try {
    const parsed = z.array(savedSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeCache(scope: string, saved: SavedFacility[]): Promise<void> {
  return AsyncStorage.setItem(cacheKey(scope), JSON.stringify(saved)).catch(() => undefined)
}

function clearCache(scope: string): Promise<void> {
  return AsyncStorage.removeItem(cacheKey(scope)).catch(() => undefined)
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
    let cancelled = false

    // A guest's favourites live in the one fixed local slot, with nothing to sync — there
    // is no account yet for the server to attach them to.
    const hydrateGuest = async (): Promise<void> => {
      const cached = await readCache(GUEST_SCOPE)
      if (!cancelled) setSaved(cached)
    }

    // Runs once per device the first time a real session appears. Anything saved as a
    // guest is pushed up before the account's own list is read back, so favourites
    // survive signing up instead of being silently replaced by an empty server list.
    const hydrateAccount = async (uid: string): Promise<void> => {
      const guestSaved = await readCache(GUEST_SCOPE)
      if (guestSaved.length > 0) {
        await Promise.all(
          guestSaved.map((facility) => saveFacility(facility.id, identity).catch(() => undefined)),
        )
        await clearCache(GUEST_SCOPE)
      }

      const cached = await readCache(uid)
      if (cancelled) return
      if (cached.length > 0) setSaved(cached)

      const remote = await listSavedFacilities(identity).catch(() => null)
      if (cancelled || !remote) return

      const records = remote.map(fromRemote)
      setSaved(records)
      await writeCache(uid, records)
    }

    if (userId) {
      hydrateAccount(userId).catch(() => undefined)
    } else {
      hydrateGuest().catch(() => undefined)
    }

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
      const scope = userId ?? GUEST_SCOPE

      const wasSaved = saved.some((entry) => entry.id === facility.id)
      const next = wasSaved
        ? saved.filter((entry) => entry.id !== facility.id)
        : [...saved, facility]

      // Applied locally first: the star must respond at the barrier with no signal. A
      // failed write is reconciled by the next successful list fetch.
      setSaved(next)
      writeCache(scope, next).catch(() => undefined)

      // A guest has no server row to push to yet — the local write above is the whole
      // action, and it travels online once hydrateAccount runs after sign-up.
      if (!userId) return

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
