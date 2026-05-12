/**
 * src/renderer/src/App.jsx
 *
 * Root renderer component.  Listens to the main-process flow state and
 * renders the matching page.  All routing lives here.
 *
 * State → Page mapping:
 *   IDLE            → IdlePage
 *   SELECT_TEMPLATE → SelectTemplatePage
 *   PAYMENT_PENDING → PaymentPage   (QR + inline coupon)
 *   PAYMENT_SUCCESS → PaymentPage   (success sub-view)
 *   SHOOTING        → ShootingPage  (fullscreen viewfinder)
 *   PREVIEW         → PreviewPage   (auto-composited preview + frame swap)
 *   FILTER_SELECT   → FilterPage
 *   RENDERING       → RenderingPage
 *   PRINTING        → PrintingPage
 *   DONE            → DonePage
 *
 * Upstream : preload/index.js (window.xfoto.getState / onStateChanged)
 * Downstream: individual page components
 */

import { useEffect, useState } from 'react'
import IdlePage             from './pages/IdlePage.jsx'
import SelectTemplatePage   from './pages/SelectTemplatePage.jsx'
import PaymentPage          from './pages/PaymentPage.jsx'
import ShootingPage         from './pages/ShootingPage.jsx'
import PreviewPage          from './pages/PreviewPage.jsx'
import FilterPage           from './pages/FilterPage.jsx'
import RenderingPage        from './pages/RenderingPage.jsx'
import PrintingPage         from './pages/PrintingPage.jsx'
import DonePage             from './pages/DonePage.jsx'

const PAGE_MAP = {
  IDLE:             IdlePage,
  SELECT_TEMPLATE:  SelectTemplatePage,
  PAYMENT_PENDING:  PaymentPage,
  PAYMENT_SUCCESS:  PaymentPage,
  SHOOTING:         ShootingPage,
  PREVIEW:          PreviewPage,
  FILTER_SELECT:    FilterPage,
  RENDERING:        RenderingPage,
  PRINTING:         PrintingPage,
  DONE:             DonePage
}

export default function App() {
  const [flowState, setFlowState]     = useState('IDLE')
  const [sessionData, setSessionData] = useState({})

  useEffect(() => {
    window.xfoto?.getState().then(({ state, data }) => {
      setFlowState(state)
      setSessionData(data)
    })
    const unsub = window.xfoto?.onStateChanged(({ next, data }) => {
      setFlowState(next)
      setSessionData(data)
    })
    return () => unsub?.()
  }, [])

  const Page = PAGE_MAP[flowState] ?? IdlePage
  return <Page state={flowState} data={sessionData} />
}
