import { useEffect, useState } from 'react'
import IdlePage from './pages/IdlePage.jsx'
import SelectTemplatePage from './pages/SelectTemplatePage.jsx'
import PaymentPage from './pages/PaymentPage.jsx'
import ShootingPage from './pages/ShootingPage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import RenderingPage from './pages/RenderingPage.jsx'
import PrintingPage from './pages/PrintingPage.jsx'
import DonePage from './pages/DonePage.jsx'

const PAGE_MAP = {
  IDLE:             IdlePage,
  SELECT_TEMPLATE:  SelectTemplatePage,
  PAYMENT_PENDING:  PaymentPage,
  PAYMENT_SUCCESS:  PaymentPage,
  SHOOTING:         ShootingPage,
  PREVIEW:          PreviewPage,
  RENDERING:        RenderingPage,
  PRINTING:         PrintingPage,
  DONE:             DonePage
}

export default function App() {
  const [flowState, setFlowState] = useState('IDLE')
  const [sessionData, setSessionData] = useState({})

  useEffect(() => {
    // Sync initial state from main process
    window.xfoto?.getState().then(({ state, data }) => {
      setFlowState(state)
      setSessionData(data)
    })

    // Listen for subsequent state changes pushed from main
    const unsub = window.xfoto?.onStateChanged(({ next, data }) => {
      setFlowState(next)
      setSessionData(data)
    })
    return () => unsub?.()
  }, [])

  const Page = PAGE_MAP[flowState] ?? IdlePage
  return <Page state={flowState} data={sessionData} />
}
