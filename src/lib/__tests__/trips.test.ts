import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'

import { useAuth } from '../../auth/AuthProvider'
import type { MyBooking } from '../api'
import { listMyBookings } from '../api'
import type { TripRecord } from '../trips'
import { useTrips } from '../trips'

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }))
jest.mock('../api', () => ({ listMyBookings: jest.fn() }))

const mockedUseAuth = useAuth as jest.Mock
const mockedListMyBookings = listMyBookings as jest.Mock<Promise<MyBooking[]>>

function asUser(id: string): void {
  mockedUseAuth.mockReturnValue({ user: { id } })
}

function cachedTrip(bookingId: string): TripRecord {
  return {
    bookingId,
    facilityId: 'facility-1',
    facilityName: 'Central Parking',
    code: 'AC1',
    startsAt: '2026-01-01T10:00:00.000Z',
    endsAt: '2026-01-01T12:00:00.000Z',
    vehicleType: 'CAR',
    totalCents: 500,
    currency: 'EUR',
    confirmedAt: '2026-01-01T09:00:00.000Z',
  }
}

function remoteBooking(id: string): MyBooking {
  return {
    id,
    accessCode: 'AC2',
    status: 'CONFIRMED',
    startsAt: '2026-01-02T10:00:00.000Z',
    endsAt: '2026-01-02T12:00:00.000Z',
    vehicleType: 'CAR',
    quotedPriceCents: 700,
    finalPriceCents: 700,
    currency: 'EUR',
    facility: { id: 'facility-2', name: 'Airport Parking' },
    createdAt: '2026-01-02T09:00:00.000Z',
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('cache-first read-through', () => {
  it('keeps serving the cache when the remote refresh fails', async () => {
    await AsyncStorage.setItem('spark-trips:u1', JSON.stringify([cachedTrip('bk_1')]))
    asUser('u1')
    mockedListMyBookings.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useTrips())
    await flush()

    expect(result.current.trips).toEqual([cachedTrip('bk_1')])
  })

  it('replaces state and cache once the remote fetch succeeds', async () => {
    asUser('u1')
    mockedListMyBookings.mockResolvedValue([remoteBooking('bk_2')])

    const { result } = renderHook(() => useTrips())
    await flush()

    expect(result.current.trips).toHaveLength(1)
    expect(result.current.trips[0]?.bookingId).toBe('bk_2')

    const stored = await AsyncStorage.getItem('spark-trips:u1')
    expect(JSON.parse(stored ?? '[]')).toHaveLength(1)
  })

  it('does not clear the list on a failed manual refresh', async () => {
    asUser('u1')
    mockedListMyBookings.mockResolvedValueOnce([remoteBooking('bk_2')])

    const { result } = renderHook(() => useTrips())
    await flush()
    expect(result.current.trips).toHaveLength(1)

    mockedListMyBookings.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await result.current.refreshTrips()
    })

    expect(result.current.trips).toHaveLength(1)
    expect(result.current.trips[0]?.bookingId).toBe('bk_2')
    expect(result.current.refreshing).toBe(false)
  })
})

describe('per-account cache isolation', () => {
  it('does not let a second user read the first user’s cached bookings', async () => {
    await AsyncStorage.setItem('spark-trips:u1', JSON.stringify([cachedTrip('bk_1')]))
    asUser('u2')
    mockedListMyBookings.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useTrips())
    await flush()

    expect(result.current.trips).toEqual([])
  })
})

describe('addTrip', () => {
  it('prepends a new trip and dedupes by bookingId', async () => {
    asUser('u1')
    mockedListMyBookings.mockResolvedValue([])

    const { result } = renderHook(() => useTrips())
    await flush()

    act(() => {
      result.current.addTrip(cachedTrip('bk_1'))
    })
    act(() => {
      result.current.addTrip({ ...cachedTrip('bk_1'), totalCents: 999 })
    })

    expect(result.current.trips).toHaveLength(1)
    expect(result.current.trips[0]?.totalCents).toBe(999)
  })
})
