import { listMyBookings } from '../api'
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
