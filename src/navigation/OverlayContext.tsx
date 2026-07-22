import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { BookingValue } from '../components/BookingForm'
import type { PriceQuote } from '../lib/api'
import { useTrips, type TripRecord } from '../lib/trips'

export type OverlayState =
  | { type: 'facilityDetail'; facilityId: string; booking?: BookingValue }
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

// Bottom-sheet overlays live in their own slot, independent of `overlay` — they
// layer on top of whatever's currently showing (a base overlay or a tab screen)
// rather than replacing it. Sharing one slot used to mean opening the time/vehicle
// sheet from the facility detail screen unmounted it, exposing the map underneath.
export type SheetState =
  | {
      type: 'timePicker'
      initial: BookingValue
      onApply: (next: BookingValue) => void
      showVehicleSelector: boolean
    }
  | { type: 'filters' }
  | null

export interface OverlayContextValue {
  overlay: OverlayState
  sheet: SheetState
  trips: TripRecord[]
  openFacilityDetail: (facilityId: string, booking?: BookingValue) => void
  openTimePicker: (
    initial: BookingValue,
    onApply: (next: BookingValue) => void,
    showVehicleSelector?: boolean,
  ) => void
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
  viewTicket: (trip: TripRecord) => void
  closeOverlay: () => void
  closeSheet: () => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }): ReactElement {
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const { trips, addTrip } = useTrips()

  const openFacilityDetail = useCallback((facilityId: string, booking?: BookingValue) => {
    setOverlay({ type: 'facilityDetail', facilityId, booking })
  }, [])

  const openTimePicker = useCallback(
    (
      initial: BookingValue,
      onApply: (next: BookingValue) => void,
      showVehicleSelector = true,
    ) => {
      setSheet({ type: 'timePicker', initial, onApply, showVehicleSelector })
    },
    [],
  )

  const openFilters = useCallback(() => {
    setSheet({ type: 'filters' })
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

  const viewTicket = useCallback((trip: TripRecord) => {
    setOverlay({
      type: 'ticket',
      facilityId: trip.facilityId,
      facilityName: trip.facilityName,
      code: trip.code,
      booking: { startsAt: trip.startsAt, endsAt: trip.endsAt, vehicleType: trip.vehicleType },
      totalCents: trip.totalCents,
      currency: trip.currency,
    })
  }, [])

  const closeOverlay = useCallback(() => {
    setOverlay(null)
  }, [])

  const closeSheet = useCallback(() => {
    setSheet(null)
  }, [])

  const value = useMemo<OverlayContextValue>(
    () => ({
      overlay,
      sheet,
      trips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      viewTicket,
      closeOverlay,
      closeSheet,
    }),
    [
      overlay,
      sheet,
      trips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      viewTicket,
      closeOverlay,
      closeSheet,
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
