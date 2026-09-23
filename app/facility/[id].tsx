import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import type { BookingValue } from '../../src/components/BookingForm'
import { useOverlay } from '../../src/navigation/OverlayContext'

// Legacy deep-link route. Facility detail now lives in an overlay above the tabs,
// so this screen forwards the id (and any booking params) into that overlay and
// redirects to the map tab, preserving shared /facility/:id links.
export default function FacilityRedirect() {
  const { openFacilityDetail } = useOverlay()
  const params = useLocalSearchParams<{
    id: string
    startsAt?: string
    endsAt?: string
    vehicleType?: string
  }>()

  useEffect(() => {
    if (!params.id) return
    const booking: BookingValue | undefined =
      params.startsAt && params.endsAt && params.vehicleType
        ? {
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            vehicleType: params.vehicleType,
          }
        : undefined
    openFacilityDetail(params.id, booking)
    router.replace('/map')
  }, [params.id, params.startsAt, params.endsAt, params.vehicleType, openFacilityDetail])

  return null
}
