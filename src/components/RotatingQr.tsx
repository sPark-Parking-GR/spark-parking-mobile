import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

import { getBookingQr } from '../lib/api'
import { ApiError } from '../lib/http'
import { identity } from '../lib/identity'

// Scanners read contrast, not themes: the code stays black on white in dark mode too.
const QR_FOREGROUND = '#0C1B2A'
const QR_BACKGROUND = '#FFFFFF'

const ROTATION_MS = 60_000

// Fetching a beat past the boundary rather than on it, so a device clock running slightly
// ahead of the server's cannot ask for the minute the server has not reached yet.
const BOUNDARY_LAG_MS = 750

export type QrFailure =
  'offline' | 'signedOut' | 'notFound' | 'notIssuable' | 'rateLimited' | 'failed'

export type QrTicketState =
  | { status: 'loading' }
  | { status: 'ready'; payload: string }
  | { status: 'unavailable'; reason: QrFailure }

// Time to the next wall-clock minute, not a flat 60s: the server keys the payload on
// Math.floor(now / 60000), so a timer anchored to mount drifts off that edge and spends
// half of every code's life showing the one before it.
function msUntilNextMinute(at: number = Date.now()): number {
  return ROTATION_MS - (at % ROTATION_MS)
}

function failureReason(error: unknown): QrFailure {
  // Anything the API layer did not turn into an ApiError never reached the server.
  if (!(error instanceof ApiError)) return 'offline'

  switch (error.status) {
    // The shared refresh in ApiIdentity has already tried and failed by this point.
    case 401:
      return 'signedOut'
    case 404:
      return 'notFound'
    case 409:
      return 'notIssuable'
    case 429:
      return 'rateLimited'
    default:
      return 'failed'
  }
}

/**
 * Polls the booking's rotating code for as long as the ticket is on screen and in the
 * foreground. One request per wall-clock minute, which is both the rate the endpoint is
 * budgeted for and the rate at which the payload it returns goes out of date.
 */
export function useQrTicket(bookingId: string): {
  state: QrTicketState
  retry: () => void
} {
  const [state, setState] = useState<QrTicketState>({ status: 'loading' })
  const retryRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let attempts = 0
    // When the payload on screen stops being accepted anywhere. Zero whenever nothing
    // showable is held, which is the safe reading of a date the server sent malformed.
    let liveUntil = 0

    const refresh = (): void => {
      const attempt = ++attempts
      getBookingQr(bookingId, identity)
        .then((ticket) => {
          if (disposed || attempt !== attempts) return
          const expiresAt = Date.parse(ticket.expiresAt)
          liveUntil = Number.isFinite(expiresAt) ? expiresAt : 0
          setState({ status: 'ready', payload: ticket.payload })
        })
        .catch((error: unknown) => {
          if (disposed || attempt !== attempts) return
          // A code the server has stopped accepting looks exactly like a working one, so a
          // failed refresh drops it rather than let the driver find out at the barrier.
          liveUntil = 0
          setState({ status: 'unavailable', reason: failureReason(error) })
        })
    }

    const arm = (): void => {
      timer = setTimeout(() => {
        refresh()
        arm()
      }, msUntilNextMinute() + BOUNDARY_LAG_MS)
    }

    const start = (): void => {
      refresh()
      arm()
    }

    const stop = (): void => {
      clearTimeout(timer)
      timer = undefined
    }

    retryRef.current = () => {
      stop()
      liveUntil = 0
      setState({ status: 'loading' })
      start()
    }

    start()

    // Timers are throttled while backgrounded, so the poll is dropped on the way out and
    // re-anchored to the wall clock on the way back in rather than left to fire on a
    // schedule that drifted while away. A code that died in the meantime is cleared before
    // its replacement is asked for, because the seconds an in-flight refresh takes are
    // exactly the seconds the user is holding a dead code up to the scanner.
    const subscription = AppState.addEventListener('change', (next) => {
      stop()
      if (next !== 'active') return

      if (liveUntil > Date.now()) {
        // Still inside the window the server accepts, so re-anchoring the timer is enough:
        // re-fetching on every app switch would spend the rate limit on nothing.
        arm()
        return
      }

      liveUntil = 0
      setState((current) => (current.status === 'ready' ? { status: 'loading' } : current))
      start()
    })

    return () => {
      disposed = true
      stop()
      subscription.remove()
    }
  }, [bookingId])

  const retry = useCallback(() => retryRef.current(), [])

  return { state, retry }
}

export function RotatingQr({ payload, size }: { payload: string; size: number }) {
  return (
    <View style={[styles.frame, { backgroundColor: QR_BACKGROUND }]}>
      <QRCode
        value={payload}
        size={size}
        color={QR_FOREGROUND}
        backgroundColor={QR_BACKGROUND}
        ecl="M"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { padding: 14, borderRadius: 16 },
})
