import { useState } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { apiRequest } from '../services/apiClient.js'

function CheckRow({ item }) {
  const Icon = item.ok ? CheckCircle2 : XCircle
  return (
    <div className={`avaSystemCheckRow ${item.ok ? 'isOk' : 'isBad'}`}>
      <Icon size={16} />
      <strong>{item.label}</strong>
      <span>{item.message}</span>
    </div>
  )
}

export default function SystemCheckPanel() {
  const [checks, setChecks] = useState([])
  const [checking, setChecking] = useState(false)

  async function runCheck() {
    setChecking(true)
    const next = []

    async function check(label, fn) {
      try {
        await fn()
        next.push({ label, ok: true, message: 'OK' })
      } catch (err) {
        next.push({ label, ok: false, message: err.message })
      }
    }

    await check('Backend /health', () => apiRequest('/health'))
    await check('Auth /me', () => apiRequest('/auth/me'))
    await check('Storage summary', () => apiRequest('/storage/summary'))
    await check('Workspace current', () => apiRequest('/workspace/current'))
    await check('Credits summary', () => apiRequest('/credits/summary'))
    await check('Jobs list', () => apiRequest('/jobs'))

    setChecks(next)
    setChecking(false)
  }

  return (
    <section className="avaPanel avaSettingsPanel">
      <p className="avaEyebrow"><ShieldCheck size={15} /> system check</p>
      <h3>Проверка системы</h3>
      <p>Быстрая проверка основных API перед переносом больших модулей.</p>
      <button className="avaSecondaryButton" type="button" onClick={runCheck} disabled={checking}>
        <ShieldCheck size={16} /> {checking ? 'Проверяем…' : 'Проверить систему'}
      </button>
      {checks.length > 0 && (
        <div className="avaSystemCheckList">
          {checks.map((item) => <CheckRow item={item} key={item.label} />)}
        </div>
      )}
    </section>
  )
}
