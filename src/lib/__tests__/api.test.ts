import {
  createDriverSubscriptionCheckout,
  getMyDriverSubscription,
  listDriverPlans,
  listMyBookings,
} from '../api'
import { ApiError, request } from '../http'
import type { IdentityStrategy } from '../identity'

jest.mock('../http', () => ({
  ...jest.requireActual('../http'),
  request: jest.fn(),
  requestNoContent: jest.fn(),
}))

const mockedRequest = request as jest.Mock

function makeIdentity(recovers: boolean): IdentityStrategy {
  return {
    authHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
    canBook: jest.fn().mockReturnValue(true),
    recoverFromUnauthorized: jest.fn().mockResolvedValue(recovers),
  }
}

const FREE_ENTITLEMENTS = {
  bookingDiscountBps: null,
  bookingFeeWaived: false,
  freeCancellations: 0,
  features: [],
}

describe('driver subscriptions', () => {
  beforeEach(() => {
    mockedRequest.mockReset()
  })

  it('parses the public plan catalog', async () => {
    mockedRequest.mockResolvedValueOnce([
      {
        id: 'plan_1',
        code: 'plus',
        name: 'Plus',
        description: null,
        priceCents: 990,
        currency: 'EUR',
        interval: 'MONTHLY',
        entitlements: { ...FREE_ENTITLEMENTS, bookingDiscountBps: 1000 },
      },
    ])

    await expect(listDriverPlans()).resolves.toHaveLength(1)
    expect(mockedRequest).toHaveBeenCalledWith('/driver-subscriptions/plans')
  })

  it('rejects a catalog entry whose shape does not match the contract', async () => {
    mockedRequest.mockResolvedValueOnce([{ id: 'plan_1', code: 'plus' }])

    await expect(listDriverPlans()).rejects.toThrow()
  })

  // The normal state for a rider who never subscribed, not an error the screen must handle.
  it('parses the free-tier subscription', async () => {
    mockedRequest.mockResolvedValueOnce({
      planCode: null,
      planName: null,
      status: null,
      currentPeriodEnd: null,
      entitlements: FREE_ENTITLEMENTS,
      source: 'free',
    })

    await expect(getMyDriverSubscription(makeIdentity(false))).resolves.toMatchObject({
      source: 'free',
      planCode: null,
    })
  })

  it('sends the plan id and returns the hosted checkout url', async () => {
    mockedRequest.mockResolvedValueOnce({ checkoutUrl: 'https://checkout.example/session_1' })

    await expect(createDriverSubscriptionCheckout('plan_1', makeIdentity(false))).resolves.toBe(
      'https://checkout.example/session_1',
    )

    expect(mockedRequest).toHaveBeenCalledWith(
      '/driver-subscriptions/checkout',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ planId: 'plan_1' }) }),
    )
  })
})

describe('withAuthRetry', () => {
  it('retries exactly once after a 401 and succeeds with the fresh token', async () => {
    mockedRequest
      .mockRejectedValueOnce(new ApiError('unauthorized', 401))
      .mockResolvedValueOnce({ items: [] })
    const identity = makeIdentity(true)

    await expect(listMyBookings(identity)).resolves.toEqual([])

    expect(mockedRequest).toHaveBeenCalledTimes(2)
    expect(identity.recoverFromUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not retry a second time when the retried request 401s again', async () => {
    mockedRequest.mockRejectedValue(new ApiError('unauthorized', 401))
    const identity = makeIdentity(true)

    await expect(listMyBookings(identity)).rejects.toThrow('unauthorized')

    expect(mockedRequest).toHaveBeenCalledTimes(2)
    expect(identity.recoverFromUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not retry when recovery reports the session cannot be renewed', async () => {
    mockedRequest.mockRejectedValueOnce(new ApiError('unauthorized', 401))
    const identity = makeIdentity(false)

    await expect(listMyBookings(identity)).rejects.toThrow('unauthorized')

    expect(mockedRequest).toHaveBeenCalledTimes(1)
  })

  it('never retries a non-401 failure', async () => {
    mockedRequest.mockRejectedValueOnce(new ApiError('server error', 500))
    const identity = makeIdentity(true)

    await expect(listMyBookings(identity)).rejects.toThrow('server error')

    expect(mockedRequest).toHaveBeenCalledTimes(1)
    expect(identity.recoverFromUnauthorized).not.toHaveBeenCalled()
  })
})
