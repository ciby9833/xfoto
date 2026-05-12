/**
 * src/core/FlowController.js
 *
 * Singleton EventEmitter-based state machine for the kiosk flow.
 *
 * Full state sequence:
 *   IDLE → SELECT_TEMPLATE → PAYMENT_PENDING → PAYMENT_SUCCESS →
 *   SHOOTING → PREVIEW → FILTER_SELECT → RENDERING → PRINTING → DONE → IDLE
 *
 * PREVIEW can transition back to SHOOTING for a per-slot reshoot.
 * FILTER_SELECT can go back to PREVIEW.
 *
 * Note on coupon: coupon input is an INLINE feature of the PAYMENT_PENDING
 * screen — it does not require a separate state.
 *
 * Upstream : main/ipc/index.js registers IPC handlers that call transition()
 *            and forwards 'stateChanged' events to the renderer.
 * Downstream: renderer App.jsx listens to 'flow:stateChanged' via preload
 *             and swaps the visible page accordingly.
 */

import { EventEmitter } from 'events'

// ─── State constants ────────────────────────────────────────────────────────
export const STATES = {
  IDLE:             'IDLE',
  SELECT_TEMPLATE:  'SELECT_TEMPLATE',
  PAYMENT_PENDING:  'PAYMENT_PENDING',
  PAYMENT_SUCCESS:  'PAYMENT_SUCCESS',
  SHOOTING:         'SHOOTING',
  PREVIEW:          'PREVIEW',
  FILTER_SELECT:    'FILTER_SELECT',
  RENDERING:        'RENDERING',
  PRINTING:         'PRINTING',
  DONE:             'DONE'
}

// ─── Legal transitions ──────────────────────────────────────────────────────
const TRANSITIONS = {
  [STATES.IDLE]:            [STATES.SELECT_TEMPLATE],
  [STATES.SELECT_TEMPLATE]: [STATES.PAYMENT_PENDING, STATES.IDLE],
  [STATES.PAYMENT_PENDING]: [STATES.PAYMENT_SUCCESS, STATES.IDLE],
  [STATES.PAYMENT_SUCCESS]: [STATES.SHOOTING],
  [STATES.SHOOTING]:        [STATES.PREVIEW],
  [STATES.PREVIEW]:         [STATES.FILTER_SELECT, STATES.SHOOTING],  // SHOOTING = reshoot
  [STATES.FILTER_SELECT]:   [STATES.RENDERING, STATES.PREVIEW],
  [STATES.RENDERING]:       [STATES.PRINTING],
  [STATES.PRINTING]:        [STATES.DONE],
  [STATES.DONE]:            [STATES.IDLE]
}

// ─── FlowController ─────────────────────────────────────────────────────────
class FlowController extends EventEmitter {
  constructor() {
    super()
    this.state = STATES.IDLE
    this.sessionData = {}
  }

  getState() { return this.state }

  getSessionData() { return { ...this.sessionData } }

  /**
   * Perform a state transition.
   * @param {string} nextState - Must be a legal target from current state
   * @param {object} data      - Merged into sessionData
   */
  transition(nextState, data = {}) {
    const allowed = TRANSITIONS[this.state] ?? []
    if (!allowed.includes(nextState)) {
      throw new Error(
        `Invalid transition: ${this.state} → ${nextState}. ` +
        `Allowed: ${allowed.join(', ') || 'none'}`
      )
    }
    const prevState = this.state
    this.state = nextState
    this.sessionData = { ...this.sessionData, ...data }
    this.emit('stateChanged', { prev: prevState, next: nextState, data: this.sessionData })
  }

  /**
   * Merge data into sessionData without changing state.
   * Emits 'stateChanged' so the renderer receives the updated data.
   * Use this when you need to store new fields (e.g. orderId, qrCodeUrl)
   * while staying in the current state.
   */
  mergeData(data = {}) {
    this.sessionData = { ...this.sessionData, ...data }
    this.emit('stateChanged', { prev: this.state, next: this.state, data: this.sessionData })
  }

  /** Reset to IDLE and clear all session data. */
  reset() {
    this.state = STATES.IDLE
    this.sessionData = {}
    this.emit('stateChanged', { prev: null, next: STATES.IDLE, data: {} })
  }
}

export default new FlowController()
