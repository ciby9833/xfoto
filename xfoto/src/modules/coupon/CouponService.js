/**
 * src/modules/coupon/CouponService.js
 *
 * Validates coupon codes and calculates discounts.
 *
 * V1: Hardcoded demo coupons stored in memory.
 * V2: Will query the cloud API (POST /coupons/validate) and optionally cache
 *     results in the local SQLite DB for offline grace periods.
 *
 * Upstream : main/ipc/index.js exposes 'coupon:validate' IPC handler which
 *            calls validate() here.
 * Downstream: CouponPage.jsx receives { valid, discountPercent, discountAmount,
 *             finalPrice, message } and stores the result in sessionData.coupon.
 */

// V1 demo coupons — key = code (case-insensitive), value = discount config
const DEMO_COUPONS = {
  FREE100:  { discountPercent: 100, label: '免费体验券' },
  HALF50:   { discountPercent: 50,  label: '半价优惠' },
  XFOTO20:  { discountPercent: 20,  label: '8折优惠' }
}

class CouponService {
  /**
   * Validate a coupon code against a base price.
   * @param {string} code       - User-entered coupon string
   * @param {number} basePrice  - Full price before discount
   * @returns {{ valid: boolean, discountPercent: number, discountAmount: number,
   *             finalPrice: number, message: string }}
   */
  validate(code, basePrice) {
    const entry = DEMO_COUPONS[code.trim().toUpperCase()]

    if (!entry) {
      return {
        valid: false,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: basePrice,
        message: '优惠码无效，请检查后重试'
      }
    }

    const discountAmount = Math.round(basePrice * entry.discountPercent / 100)
    const finalPrice = basePrice - discountAmount

    return {
      valid: true,
      discountPercent: entry.discountPercent,
      discountAmount,
      finalPrice,
      code: code.trim().toUpperCase(),
      label: entry.label,
      message: `${entry.label}：优惠 ${entry.discountPercent}%`
    }
  }
}

export default new CouponService()
