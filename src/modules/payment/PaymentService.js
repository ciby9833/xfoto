// Phase 2: integrate Xendit or Midtrans
// Phase 1: stub that immediately returns success

class PaymentService {
  createOrder(amount, currency = 'IDR') {
    // TODO: call Xendit/Midtrans API, return { orderId, qrCodeUrl }
    return Promise.resolve({
      orderId: `mock_${Date.now()}`,
      qrCodeUrl: null
    })
  }

  pollStatus(orderId) {
    // TODO: GET /orders/:orderId/status from payment provider
    // Returns 'pending' | 'success' | 'failed'
    return Promise.resolve('success')
  }
}

export default new PaymentService()
