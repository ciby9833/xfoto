/**
 * src/renderer/src/hooks/useSessionData.js
 *
 * Custom React hook that reads the current flow state + sessionData directly
 * from the main process via IPC.
 *
 * Why call getState() instead of using props?
 * React's useEffect runs AFTER the first render, so if a page reads data
 * from props that were set by a stateChanged event, there can be a single-
 * frame gap where data is undefined.  Calling getState() directly inside
 * an async effect guarantees the data is available before any rendering work.
 *
 * Usage:
 *   const { state, data, loading } = useSessionData()
 *
 * Upstream : window.xfoto.getState() (preload → main/ipc/index.js)
 * Downstream: ShootingPage, PreviewPage, FilterPage, RenderingPage
 */

import { useState, useEffect } from 'react'

export function useSessionData() {
  const [state, setState] = useState(null)
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.xfoto.getState().then(({ state, data }) => {
      setState(state)
      setData(data)
      setLoading(false)
    })
  }, [])

  return { state, data, loading }
}
