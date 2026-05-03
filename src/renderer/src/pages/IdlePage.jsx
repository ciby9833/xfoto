export default function IdlePage() {
  const handleStart = () => window.xfoto?.transition('SELECT_TEMPLATE')

  return (
    <div className="page" style={{ background: 'linear-gradient(160deg,#1a0030,#0a0a0a)' }}>
      <h1 style={{ fontSize: 72, letterSpacing: 8 }}>xfoto</h1>
      <p style={{ fontSize: 28, opacity: 0.6 }}>触摸屏幕开始拍照</p>
      <button className="btn-primary" onClick={handleStart}>开始</button>
    </div>
  )
}
