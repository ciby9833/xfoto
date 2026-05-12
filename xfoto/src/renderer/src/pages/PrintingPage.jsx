import { useEffect } from 'react'

export default function PrintingPage({ data }) {
  useEffect(() => {
    const { finalPath } = data
    window.xfoto?.print({ imagePath: finalPath }).then(() => {
      window.xfoto?.transition('DONE')
    })
  }, [])

  return (
    <div className="page">
      <div style={{ fontSize: 80 }}>🖨️</div>
      <p style={{ fontSize: 28 }}>打印中，请稍候…</p>
    </div>
  )
}
