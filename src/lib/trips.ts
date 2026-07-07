import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

const TRIPS_STORAGE_KEY = 'spark-trips'

export interface TripRecord {
  facilityId: string
  facilityName: string
  code: string
  startsAt: string
  endsAt: string
  vehicleType: string
  totalCents: number
  currency: string
  confirmedAt: string
}

export function useTrips(): { trips: TripRecord[]; addTrip: (trip: TripRecord) => void } {
  const [trips, setTrips] = useState<TripRecord[]>([])

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(TRIPS_STORAGE_KEY).then((stored) => {
      if (cancelled || !stored) return
      try {
        setTrips(JSON.parse(stored) as TripRecord[])
      } catch {
        setTrips([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const addTrip = useCallback((trip: TripRecord) => {
    setTrips((prev) => {
      const next = [trip, ...prev]
      void AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { trips, addTrip }
}
