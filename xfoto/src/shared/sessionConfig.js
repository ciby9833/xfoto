/**
 * src/shared/sessionConfig.js
 *
 * Default device configuration for a single photo-booth session.
 *
 * V1: Hardcoded defaults used by all pages.
 * V2: Cloud API (device management) will return per-device overrides that get
 *     merged on top of these defaults at app startup.
 *
 * Upstream : SelectTemplatePage passes this config into sessionData via
 *            the flow:selectTemplate IPC call.
 * Downstream: ShootingPage, PreviewPage, FilterPage, RenderingPage all read
 *             sessionData.config to drive their behavior.
 */

// ─── Shooting modes ────────────────────────────────────────────────────────
// 'A'  Take N shots → user sees all → confirm or retake ALL
// 'B'  Take N shots → user assigns each frame slot individually → per-slot reshoot
export const SHOOT_MODE_A = 'A'
export const SHOOT_MODE_B = 'B'

// ─── Filter definitions ────────────────────────────────────────────────────
// css: value passed to ctx.filter in Canvas when rendering the final composite.
// label: Chinese display name shown in FilterPage.
export const FILTER_PRESETS = {
  none:    { label: '原片',   css: 'none' },
  warm:    { label: '暖调',   css: 'sepia(0.35) saturate(1.4) brightness(1.05)' },
  cool:    { label: '冷调',   css: 'hue-rotate(195deg) saturate(0.85) brightness(1.08)' },
  bw:      { label: '黑白',   css: 'grayscale(1) contrast(1.1)' },
  vintage: { label: '复古',   css: 'sepia(0.55) saturate(0.8) contrast(1.15) brightness(0.95)' },
  vivid:   { label: '鲜艳',   css: 'saturate(1.9) contrast(1.1)' }
}

// ─── Default device config ─────────────────────────────────────────────────
export const DEFAULT_SESSION_CONFIG = {
  // Which shooting mode (see above)
  shootMode: SHOOT_MODE_B,

  // Total number of shots taken in one session (must be >= slotsCount for mode B)
  totalShots: 6,

  // Number of photo slots in the selected frame template
  // V2: frame metadata from cloud will provide this
  slotsCount: 3,

  // Visible countdown per shot (seconds)
  countdownSeconds: 3,

  // Minimum gap between shots including shutter time (ms)
  shotIntervalMs: 3500,

  // Filters the user can choose from (keys must exist in FILTER_PRESETS)
  availableFilters: ['none', 'warm', 'cool', 'bw', 'vintage', 'vivid'],

  // Default filter applied before user chooses (usually 'none')
  defaultFilter: 'none',

  // Session price in smallest local currency unit (e.g. IDR)
  price: 15000,

  // Whether to show the coupon input screen before payment
  showCouponInput: true
}
