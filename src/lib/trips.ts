import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'

import type { MyBooking } from './api'
import { listMyBookings } from './api'
import { identity } from './identity'
import { useAuth } from '../auth/AuthProvider'

// Scoped to the account: a second sign-in on a shared device must not read the previous
// user's bookings back out of the cache.
function cacheKey(userId: string): string {
  return `spark-trips:${userId}`
}

export interface TripRecord {
  bookingId: string
  facilityId: string
  facilityName: string
  code: string
  startsAt: string
  endsAt: string
  vehicleType: string
  totalCents: number
  currency: string
  confirmedAt: string
  /** Absent on records cached before the field was carried; treat as unknown, not active. */
  status?: string
}

// Re-validated on read so a cache written by an older build degrades to empty instead of
// handing a screen a record with no bookingId to build a QR from.
const tripSchema = z.object({
  bookingId: z.string().min(1),
  facilityId: z.string().min(1),
  facilityName: z.string(),
  code: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  vehicleType: z.string(),
  totalCents: z.number(),
  currency: z.string(),
  confirmedAt: z.string(),
  status: z.string().optional(),
})

async function readCache(userId: string): Promise<TripRecord[]> {
  const raw = await AsyncStorage.getItem(cacheKey(userId)).catch(() => null)
  if (!raw) return []
  try {
    const parsed = z.array(tripSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeCache(userId: string, trips: TripRecord[]): Promise<void> {
  return AsyncStorage.setItem(cacheKey(userId), JSON.stringify(trips)).catch(() => undefined)
}

function fromRemote(booking: MyBooking): TripRecord {
  return {
    bookingId: booking.id,
    facilityId: booking.facility.id,
    facilityName: booking.facility.name,
    code: booking.accessCode,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    vehicleType: booking.vehicleType,
    totalCents: booking.finalPriceCents ?? booking.quotedPriceCents,
    currency: booking.currency,
    confirmedAt: booking.createdAt,
    status: booking.status,
  }
}

export interface TripsStore {
  trips: TripRecord[]
  refreshing: boolean
  addTrip: (trip: TripRecord) => void
  refreshTrips: () => Promise<void>
}

/**
 * The server owns the booking history; AsyncStorage is only a read-through cache of it.
 * That ordering is what survives a reinstall, and the cache is what survives an
 * underground barrier with no signal.
 */
export function useTrips(): TripsStore {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!userId) {
      setTrips([])
      return
    }

    let cancelled = false

    const hydrate = async (): Promise<void> => {
      const cached = await readCache(userId)
      if (cancelled) return
      if (cached.length > 0) setTrips(cached)

      const remote = await listMyBookings(identity).catch(() => null)
      if (cancelled || !remote) return

      const records = remote.map(fromRemote)
      setTrips(records)
      await writeCache(userId, records)
    }

    hydrate().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshTrips = useCallback(async (): Promise<void> => {
    if (!userId) return
    setRefreshing(true)
    try {
      const records = (await listMyBookings(identity)).map(fromRemote)
      setTrips(records)
      await writeCache(userId, records)
    } catch {
      // Offline, or the endpoint is not deployed yet. The cached list already on screen
      // stays valid, so a failed refresh is a no-op rather than an error state.
    } finally {
      setRefreshing(false)
    }
  }, [userId])

  const addTrip = useCallback(
    (trip: TripRecord) => {
      if (!userId) return
      setTrips((prev) => {
        const next = [trip, ...prev.filter((existing) => existing.bookingId !== trip.bookingId)]
        writeCache(userId, next).catch(() => undefined)
        return next
      })
    },
    [userId],
  )

  return { trips, refreshing, addTrip, refreshTrips }
}
