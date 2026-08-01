import type * as StripeModule from '@stripe/stripe-react-native'

import type * as PaymentsModule from '../payments'

function loadPayments(publishableKey: string): {
  payments: typeof PaymentsModule
  stripe: typeof StripeModule
} {
  let payments!: typeof PaymentsModule
  let stripe!: typeof StripeModule
  jest.isolateModules(() => {
    process.env['EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'] = publishableKey
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    stripe = require('@stripe/stripe-react-native')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    payments = require('../payments')
  })
  return { payments, stripe }
}

const params = { clientSecret: 'pi_1_secret', currency: 'EUR' }

describe('paymentsConfigured', () => {
  it('is false without a publishable key', () => {
    expect(loadPayments('').payments.paymentsConfigured()).toBe(false)
  })

  it('is true with a publishable key', () => {
    expect(loadPayments('pk_test_123').payments.paymentsConfigured()).toBe(true)
  })
})

describe('collectPayment', () => {
  it('is unavailable without presenting anything when unconfigured', async () => {
    const { payments, stripe } = loadPayments('')

    await expect(payments.collectPayment(params)).resolves.toEqual({ status: 'unavailable' })
    expect(stripe.initPaymentSheet).not.toHaveBeenCalled()
  })

  it('returns paid when the sheet resolves without error', async () => {
    const { payments, stripe } = loadPayments('pk_test_123')
    ;(stripe.presentPaymentSheet as jest.Mock).mockResolvedValue({ error: null })

    await expect(payments.collectPayment(params)).resolves.toEqual({ status: 'paid' })
  })

  it('treats a cancelled sheet as a neutral outcome, not an error', async () => {
    const { payments, stripe } = loadPayments('pk_test_123')
    ;(stripe.presentPaymentSheet as jest.Mock).mockResolvedValue({
      error: { code: stripe.PaymentSheetError.Canceled, message: 'Canceled by user' },
    })

    await expect(payments.collectPayment(params)).resolves.toEqual({ status: 'cancelled' })
  })

  it('surfaces other presentation errors as failed with a message', async () => {
    const { payments, stripe } = loadPayments('pk_test_123')
    ;(stripe.presentPaymentSheet as jest.Mock).mockResolvedValue({
      error: {
        code: stripe.PaymentSheetError.Failed,
        message: 'card declined',
        localizedMessage: 'Your card was declined.',
      },
    })

    await expect(payments.collectPayment(params)).resolves.toEqual({
      status: 'failed',
      message: 'Your card was declined.',
    })
  })

  it('fails before presenting when sheet initialisation errors', async () => {
    const { payments, stripe } = loadPayments('pk_test_123')
    ;(stripe.initPaymentSheet as jest.Mock).mockResolvedValue({
      error: { message: 'invalid client secret' },
    })

    await expect(payments.collectPayment(params)).resolves.toEqual({
      status: 'failed',
      message: 'invalid client secret',
    })
    expect(stripe.presentPaymentSheet).not.toHaveBeenCalled()
  })
})
