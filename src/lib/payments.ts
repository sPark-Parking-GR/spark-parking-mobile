import {
  initPaymentSheet,
  presentPaymentSheet,
  PaymentSheetError,
} from '@stripe/stripe-react-native'

// Publishable key only. It is designed to be shipped in the client; the secret key stays
// on the API and must never reach this bundle.
export const STRIPE_PUBLISHABLE_KEY = process.env['EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? ''

const MERCHANT_NAME = 'sPark'
const MERCHANT_COUNTRY = 'GR'
// Matches `scheme` in app.json so 3DS web views hand control back to the app.
const RETURN_URL = 'spark://payment-return'

export type PaymentOutcome =
  | { status: 'paid' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'unavailable' }

export function paymentsConfigured(): boolean {
  return STRIPE_PUBLISHABLE_KEY.length > 0
}

/**
 * Presents the Stripe payment sheet against a manual-capture PaymentIntent created by
 * `POST /bookings`. Authorises only — `POST /bookings/:id/confirm` captures.
 *
 * `clientSecret` is passed straight to the SDK and is never logged or persisted.
 */
export async function collectPayment(params: {
  clientSecret: string
  currency: string
}): Promise<PaymentOutcome> {
  if (!paymentsConfigured()) return { status: 'unavailable' }

  const prepared = await initPaymentSheet({
    merchantDisplayName: MERCHANT_NAME,
    paymentIntentClientSecret: params.clientSecret,
    returnURL: RETURN_URL,
    applePay: { merchantCountryCode: MERCHANT_COUNTRY },
    googlePay: {
      merchantCountryCode: MERCHANT_COUNTRY,
      currencyCode: params.currency,
      testEnv: STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'),
    },
    // Everything the sheet offers must authorise now; a method that settles days later
    // cannot back a barrier that opens in minutes.
    allowsDelayedPaymentMethods: false,
  })

  if (prepared.error) {
    return { status: 'failed', message: prepared.error.localizedMessage ?? prepared.error.message }
  }

  const { error } = await presentPaymentSheet()
  if (!error) return { status: 'paid' }

  // Dismissing the sheet is a choice, not a failure: nothing was charged and the hold is
  // still live, so the caller offers the booking back rather than reporting an error.
  if (error.code === PaymentSheetError.Canceled) return { status: 'cancelled' }

  return { status: 'failed', message: error.localizedMessage ?? error.message }
}
