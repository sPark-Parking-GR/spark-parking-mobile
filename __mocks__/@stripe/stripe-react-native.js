module.exports = {
  initPaymentSheet: jest.fn(() => Promise.resolve({ error: null })),
  presentPaymentSheet: jest.fn(() => Promise.resolve({ error: null })),
  PaymentSheetError: { Failed: 'Failed', Canceled: 'Canceled', Timeout: 'Timeout' },
}
