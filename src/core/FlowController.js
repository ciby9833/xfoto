import { EventEmitter } from 'events'

export const STATES = {
  IDLE: 'IDLE',
  SELECT_TEMPLATE: 'SELECT_TEMPLATE',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  SHOOTING: 'SHOOTING',
  PREVIEW: 'PREVIEW',
  RENDERING: 'RENDERING',
  PRINTING: 'PRINTING',
  DONE: 'DONE'
}

// Which transitions are legal
const TRANSITIONS = {
  [STATES.IDLE]:            [STATES.SELECT_TEMPLATE],
  [STATES.SELECT_TEMPLATE]: [STATES.PAYMENT_PENDING, STATES.IDLE],
  [STATES.PAYMENT_PENDING]: [STATES.PAYMENT_SUCCESS, STATES.IDLE],
  [STATES.PAYMENT_SUCCESS]: [STATES.SHOOTING],
  [STATES.SHOOTING]:        [STATES.PREVIEW],
  [STATES.PREVIEW]:         [STATES.RENDERING],
  [STATES.RENDERING]:       [STATES.PRINTING],
  [STATES.PRINTING]:        [STATES.DONE],
  [STATES.DONE]:            [STATES.IDLE]
}

class FlowController extends EventEmitter {
  constructor() {
    super()
    this.state = STATES.IDLE
    this.sessionData = {}
  }

  getState() {
    return this.state
  }

  getSessionData() {
    return { ...this.sessionData }
  }

  transition(nextState, data = {}) {
    const allowed = TRANSITIONS[this.state] ?? []
    if (!allowed.includes(nextState)) {
      throw new Error(`Invalid transition: ${this.state} → ${nextState}`)
    }
    const prevState = this.state
    this.state = nextState
    this.sessionData = { ...this.sessionData, ...data }
    this.emit('stateChanged', { prev: prevState, next: nextState, data: this.sessionData })
  }

  reset() {
    this.state = STATES.IDLE
    this.sessionData = {}
    this.emit('stateChanged', { prev: null, next: STATES.IDLE, data: {} })
  }
}

export default new FlowController()
