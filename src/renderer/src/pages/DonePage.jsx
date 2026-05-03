import { useEffect } from 'react'

export default function DonePage() {
  useEffect(() => {
    const t = setTimeout(() => window.xfoto?.reset(), 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="page">
      <div style={{ fontSize: 100 }}>🎉</div>
      <h2 style={{ fontSize: 48 }}>照片打印完成！</h2>
      <p style={{ opacity: 0.5, fontSize: 22 }}>8 秒后自动返回</p>
    </div>
  )
}
