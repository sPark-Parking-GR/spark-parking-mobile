import * as Location from 'expo-location'
import { useCallback, useEffect, useState } from 'react'

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'unavailable'

export interface UserLocation {
  coords: { lat: number; lng: number } | null
  status: LocationStatus
  retry: () => void
}

export function useUserLocation(options?: { auto?: boolean }): UserLocation {
  const auto = options?.auto ?? true
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<LocationStatus>(auto ? 'loading' : 'unavailable')

  const locate = useCallback(async () => {
    setStatus('loading')
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync()
      if (perm !== 'granted') {
        setStatus('denied')
        return
      }

      // Last known fix is instant; show it while the precise one resolves.
      const last = await Location.getLastKnownPositionAsync()
      if (last) setCoords({ lat: last.coords.latitude, lng: last.coords.longitude })

      const enabled = await Location.hasServicesEnabledAsync()
      if (!enabled) {
        setStatus(last ? 'granted' : 'unavailable')
        return
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setStatus('granted')
    } catch {
      setStatus((prev) => (prev === 'loading' ? 'unavailable' : prev))
    }
  }, [])

  useEffect(() => {
    if (auto) locate()
  }, [auto, locate])

  return { coords, status, retry: locate }
}
