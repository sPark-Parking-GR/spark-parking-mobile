import { act, renderHook } from '@testing-library/react-native'

import type { IssuedTicket } from '../../lib/api'
import { getBookingQr } from '../../lib/api'
import { ApiError } from '../../lib/http'
import { useQrTicket } from '../RotatingQr'

jest.mock('../../lib/api', () => ({ getBookingQr: jest.fn() }))
jest.mock('../../lib/identity', () => ({ identity: {} }))

const mockedGetBookingQr = getBookingQr as jest.Mock<Promise<IssuedTicket>>

function ticket(payload: string): IssuedTicket {
  return {
    bookingId: 'b1',
    payload,
    unixMinute: 1,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

const MINUTE_BOUNDARY = Date.parse('2026-01-01T00:00:00.000Z')

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('poll scheduling', () => {
  it.each([
    ['exactly on the minute boundary', 0, 60_750],
    ['1ms past the boundary', 1, 60_749],
    ['45s into the minute', 45_000, 15_750],
  ])(
    'from %s, the next refresh lands on the wall-clock boundary (+%ims)',
    async (_label, offsetMs, waitMs) => {
      jest.setSystemTime(MINUTE_BOUNDARY + (offsetMs as number))
      mockedGetBookingQr.mockResolvedValue(ticket('p1'))

      renderHook(() => useQrTicket('b1'))
      await flush()
      expect(mockedGetBookingQr).toHaveBeenCalledTimes(1)

      await act(async () => {
        await jest.advanceTimersByTimeAsync((waitMs as number) - 1)
      })
      expect(mockedGetBookingQr).toHaveBeenCalledTimes(1)

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1)
      })
      expect(mockedGetBookingQr).toHaveBeenCalledTimes(2)
    },
  )
})

describe('failed refresh', () => {
  it('drops the stale payload instead of re-displaying it', async () => {
    jest.setSystemTime(MINUTE_BOUNDARY)
    mockedGetBookingQr.mockResolvedValueOnce(ticket('p1'))

    const { result } = renderHook(() => useQrTicket('b1'))
    await flush()
    expect(result.current.state).toEqual({ status: 'ready', payload: 'p1' })

    mockedGetBookingQr.mockRejectedValueOnce(new ApiError('server fault', 500))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_750)
    })

    expect(result.current.state).toEqual({ status: 'unavailable', reason: 'failed' })
  })
})

describe('unmount', () => {
  it('tears down the poll timer so no further refresh ever fires', async () => {
    jest.setSystemTime(MINUTE_BOUNDARY)
    mockedGetBookingQr.mockResolvedValue(ticket('p1'))

    const { unmount } = renderHook(() => useQrTicket('b1'))
    await flush()
    expect(mockedGetBookingQr).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10 * 60_000)
    })
    expect(mockedGetBookingQr).toHaveBeenCalledTimes(1)
  })
})
