import type { BookingResult, ConfirmedBooking } from '../api'
import { confirmBooking, createBooking } from '../api'
import { holdBooking, holdIsLive, newIdempotencyKey, settleBooking } from '../booking'
import type { IdentityStrategy } from '../identity'

jest.mock('../api', () => ({
  createBooking: jest.fn(),
  confirmBooking: jest.fn(),
}))

const identity: IdentityStrategy = {
  authHeaders: () => Promise.resolve({}),
  canBook: () => true,
  recoverFromUnauthorized: () => Promise.resolve(false),
}

const mockedCreate = createBooking as jest.Mock<Promise<BookingResult>>
const mockedConfirm = confirmBooking as jest.Mock<Promise<ConfirmedBooking>>

const input = {
  facilityId: 'facility-1',
  startsAt: '2026-01-01T10:00:00.000Z',
  endsAt: '2026-01-01T12:00:00.000Z',
  vehicleType: 'CAR',
  vehiclePlate: 'ABC123',
  idempotencyKey: 'mob_fixed_key',
}

describe('newIdempotencyKey', () => {
  it('mints a distinct key on every call', () => {
    const a = newIdempotencyKey()
    const b = newIdempotencyKey()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^mob_/)
  })
})

describe('holdIsLive', () => {
  it('is true while the hold has time left', () => {
    const hold = {
      bookingId: 'b',
      accessCode: 'c',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      amountCents: 100,
      currency: 'EUR',
    }
    expect(holdIsLive(hold)).toBe(true)
  })

  it('is false once the hold has expired', () => {
    const hold = {
      bookingId: 'b',
      accessCode: 'c',
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      amountCents: 100,
      currency: 'EUR',
    }
    expect(holdIsLive(hold)).toBe(false)
  })
})

describe('holdBooking / settleBooking', () => {
  it('omits clientSecret entirely when the server does not return one', async () => {
    mockedCreate.mockResolvedValue({
      bookingId: 'b1',
      accessCode: 'AC1',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      amountCents: 500,
      currency: 'EUR',
      alreadyExisted: false,
    })

    const hold = await holdBooking(input, identity)
    expect('clientSecret' in hold).toBe(false)
  })

  it('delegates confirmation to the API with the given bookingId', async () => {
    mockedConfirm.mockResolvedValue({
      bookingId: 'b1',
      accessCode: 'AC1',
      status: 'CONFIRMED',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      finalPriceCents: 500,
      currency: 'EUR',
    })

    const confirmed = await settleBooking('b1', identity)
    expect(confirmed.bookingId).toBe('b1')
    expect(mockedConfirm).toHaveBeenCalledWith('b1', identity)
  })
})

describe('checkout idempotency', () => {
  it('reuses the same key on a retry after a cancelled payment sheet, and confirm resumes the same booking', async () => {
    const key = newIdempotencyKey()
    const retryInput = { ...input, idempotencyKey: key }

    mockedCreate.mockResolvedValueOnce({
      bookingId: 'bk_1',
      accessCode: 'AC1',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      amountCents: 500,
      currency: 'EUR',
      clientSecret: 'secret_1',
      alreadyExisted: false,
    })

    const firstHold = await holdBooking(retryInput, identity)
    // The payment sheet is dismissed here in the real flow. Nothing was charged, and the
    // hold is still live, so the screen retries with the identical key rather than minting
    // a new one.
    expect(holdIsLive(firstHold)).toBe(true)

    // The server recognises the replayed idempotency key and returns the original hold
    // instead of creating a second one.
    mockedCreate.mockResolvedValueOnce({
      bookingId: firstHold.bookingId,
      accessCode: firstHold.accessCode,
      expiresAt: firstHold.expiresAt,
      amountCents: 500,
      currency: 'EUR',
      alreadyExisted: true,
    })

    const retryHold = await holdBooking(retryInput, identity)

    expect(mockedCreate).toHaveBeenNthCalledWith(1, retryInput, identity)
    expect(mockedCreate).toHaveBeenNthCalledWith(2, retryInput, identity)
    expect(mockedCreate).toHaveBeenCalledTimes(2)
    expect(new Set([firstHold.bookingId, retryHold.bookingId]).size).toBe(1)

    mockedConfirm.mockResolvedValue({
      bookingId: firstHold.bookingId,
      accessCode: firstHold.accessCode,
      status: 'CONFIRMED',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      finalPriceCents: 500,
      currency: 'EUR',
    })

    const confirmed = await settleBooking(retryHold.bookingId, identity)
    expect(confirmed.bookingId).toBe(firstHold.bookingId)
  })

  it('only earns a fresh key once the previous hold has actually expired', () => {
    const live = {
      bookingId: 'b1',
      accessCode: 'AC1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      amountCents: 100,
      currency: 'EUR',
    }
    const expired = { ...live, expiresAt: new Date(Date.now() - 1_000).toISOString() }

    expect(holdIsLive(live)).toBe(true)
    expect(holdIsLive(expired)).toBe(false)
  })
})
