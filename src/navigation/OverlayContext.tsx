import type { ReactElement, ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { BookingValue } from '../components/BookingForm'
import type { PriceQuote } from '../lib/api'
import { identity } from '../lib/identity'
import { useTrips, type TripRecord } from '../lib/trips'

export type AuthMode = 'signIn' | 'signUp' | 'forgotPassword'

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
      bookingId: string
      facilityId: string
      facilityName: string
      code: string
      booking: BookingValue
      totalCents: number
      currency: string
    }
  // `next` is where a successful sign-in lands and `back` where a cancel does — the two
  // differ whenever auth was interposed: succeeding continues the booking, backing out
  // returns to the screen the user tapped from.
  | { type: 'auth'; mode: AuthMode; next: OverlayState; back: OverlayState }
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
  tripsRefreshing: boolean
  refreshTrips: () => Promise<void>
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
    bookingId: string
    facilityId: string
    facilityName: string
    code: string
    booking: BookingValue
    totalCents: number
    currency: string
  }) => void
  viewTicket: (trip: TripRecord) => void
  openAuth: (mode: AuthMode, next?: OverlayState) => void
  completeAuth: () => void
  cancelAuth: () => void
  closeOverlay: () => void
  closeSheet: () => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }): ReactElement {
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const { trips, refreshing: tripsRefreshing, addTrip, refreshTrips } = useTrips()

  const openFacilityDetail = useCallback((facilityId: string, booking?: BookingValue) => {
    setOverlay({ type: 'facilityDetail', facilityId, booking })
  }, [])

  const openTimePicker = useCallback(
    (initial: BookingValue, onApply: (next: BookingValue) => void, showVehicleSelector = true) => {
      setSheet({ type: 'timePicker', initial, onApply, showVehicleSelector })
    },
    [],
  )

  const openFilters = useCallback(() => {
    setSheet({ type: 'filters' })
  }, [])

  const openAuth = useCallback((mode: AuthMode, next: OverlayState = null) => {
    setOverlay((current) => ({
      type: 'auth',
      mode,
      next,
      back: current?.type === 'auth' ? current.back : current,
    }))
  }, [])

  const completeAuth = useCallback(() => {
    setOverlay((current) => (current?.type === 'auth' ? current.next : current))
  }, [])

  const cancelAuth = useCallback(() => {
    setOverlay((current) => (current?.type === 'auth' ? current.back : current))
  }, [])

  const openReview = useCallback(
    (
      facilityId: string,
      facilityName: string,
      facilityAddress: string,
      booking: BookingValue,
      quote: PriceQuote,
    ) => {
      const review: OverlayState = {
        type: 'review',
        facilityId,
        facilityName,
        facilityAddress,
        booking,
        quote,
      }
      // The auth gate on booking. Interposing sign-in here rather than at the confirm
      // button means the in-progress booking travels as `next` and the user lands back
      // on it, instead of being dropped on the home screen. Asked of the strategy at tap
      // time so a session that lapsed since the last render is caught too.
      setOverlay((current) =>
        identity.canBook() ? review : { type: 'auth', mode: 'signIn', next: review, back: current },
      )
    },
    [],
  )

  const openTicket = useCallback(
    (args: {
      bookingId: string
      facilityId: string
      facilityName: string
      code: string
      booking: BookingValue
      totalCents: number
      currency: string
    }) => {
      setOverlay({ type: 'ticket', ...args })
      // Written locally the moment the booking confirms so the ticket survives closing the
      // app before the next server refresh, and shows offline.
      const trip: TripRecord = {
        bookingId: args.bookingId,
        facilityId: args.facilityId,
        facilityName: args.facilityName,
        code: args.code,
        startsAt: args.booking.startsAt,
        endsAt: args.booking.endsAt,
        vehicleType: args.booking.vehicleType,
        totalCents: args.totalCents,
        currency: args.currency,
        confirmedAt: new Date().toISOString(),
        status: 'CONFIRMED',
      }
      addTrip(trip)
    },
    [addTrip],
  )

  const viewTicket = useCallback((trip: TripRecord) => {
    setOverlay({
      type: 'ticket',
      bookingId: trip.bookingId,
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
      tripsRefreshing,
      refreshTrips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      viewTicket,
      openAuth,
      completeAuth,
      cancelAuth,
      closeOverlay,
      closeSheet,
    }),
    [
      overlay,
      sheet,
      trips,
      tripsRefreshing,
      refreshTrips,
      openFacilityDetail,
      openTimePicker,
      openFilters,
      openReview,
      openTicket,
      viewTicket,
      openAuth,
      completeAuth,
      cancelAuth,
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
