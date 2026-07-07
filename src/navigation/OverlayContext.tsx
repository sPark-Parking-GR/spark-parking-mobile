import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { BookingValue } from '../components/BookingForm'
import type { PriceQuote } from '../lib/api'
import { useTrips, type TripRecord } from '../lib/trips'

export type OverlayState =
  | { type: 'facilityDetail'; facilityId: string; booking?: BookingValue }
  | { type: 'timePicker'; initial: BookingValue; onApply: (next: BookingValue) => void }
  | { type: 'filters' }
  | {
      type: 'review'
      facilityId: string
      facilityName: string
      facilityAddress: string
      booking: BookingValue
      quote: PriceQuote
    }
  | {
      type: 'ticket'
      facilityId: string
      facilityName: string
      code: string
      booking: BookingValue
      totalCents: number
      currency: string
    }
  | null

export interface OverlayContextValue {
  overlay: OverlayState
  trips: TripRecord[]
  openFacilityDetail: (facilityId: string, booking?: BookingValue) => void
  openTimePicker: (initial: BookingValue, onApply: (next: BookingValue) => void) => void
  openFilters: () => void
  openReview: (
    facilityId: string,
    facilityName: string,
    facilityAddress: string,
    booking: BookingValue,
    quote: PriceQuote,
  ) => void
  openTicket: (args: {
    facilityId: string
    facilityName: string
    code: string
    booking: BookingValue
    totalCents: number
    currency: string
  }) => void
  closeOverlay: () => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }): ReactElement {
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const { trips, addTrip } = useTrips()

  const openFacilityDetail = useCallback((facilityId: string, booking?: BookingValue) => {
    setOverlay({ type: 'facilityDetail', facilityId, booking })
  }, [])

  const openTimePicker = useCallback(
    (initial: BookingValue, onApply: (next: BookingValue) => void) => {
      setOverlay({ type: 'timePicker', initial, onApply })
    },
    [],
  )

  const openFilters = useCallback(() => {
    setOverlay({ type: 'filters' })
  }, [])

  const openReview = useCallback(
    (
      facilityId: string,
      facilityName: string,
      facilityAddress: string,
      booking: BookingValue,
      quote: PriceQuote,
    ) => {
      setOverlay({ type: 'review', facilityId, facilityName, facilityAddress, booking, quote })
    },
    [],
  )

  const openTicket = useCallback(
    (args: {
      facilityId: string
      facilityName: string
      code: string
      booking: BookingValue
      totalCents: number
      currency: string
    }) => {
      setOverlay({ type: 'ticket', ...args })
      const trip: TripRecord = {
        facilityId: args.facilityId,
        facilityName: args.facilityName,
        code: args.code,
        startsAt: args.booking.startsAt,
        endsAt: args.booking.endsAt,
        vehicleType: args.booking.vehicleType,
        totalCents: args.totalCents,
        currency: args.currency,
        confirmedAt: new Date().toISOString(),
      }
      addTrip(trip)
    },
    [addTrip],
  )

  const closeOverlay = useCallback(() => {
    setOverlay(null)
  }, [])

  const value = useMemo<OverlayContextValue>(
    () => ({
      overlay,
      trips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      closeOverlay,
    }),
    [
      overlay,
      trips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      closeOverlay,
    ],
  )

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext)
  if (!ctx) {
    throw new Error('useOverlay must be used within an OverlayProvider')
  }
  return ctx
}
