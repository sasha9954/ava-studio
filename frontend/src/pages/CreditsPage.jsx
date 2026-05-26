import { useEffect, useState } from 'react'
import { Gift, History, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../services/apiClient.js'

export default function CreditsPage() {
  const { setCurrentUser } = useAuth()
  const [summary, setSummary] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadSummary() {
    const data = await apiRequest('/credits/summary')
    setSummary(data)
    return data
  }

  useEffect(() => {
    loadSummary().catch((err) => setError(err.message))
  }, [])

  async function applyInvite(event) {
    event.preventDefault()
    setError('')
    setStatus('')
    setLoading(true)
    try {
      const result = await apiRequest('/credits/invite', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode }),
      })
      setCurrentUser(result.user)
      await loadSummary()
      setInviteCode('')
      setStatus('Инвайт-код применён. На аккаунте активирован demo-баланс 1000 credits.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function topupDemo(packageId) {
    setError('')
    setStatus('')
    setLoading(true)
    try {
      const result = await apiRequest('/credits/topup-demo', {
        method: 'POST',
        body: JSON.stringify({ package_id: packageId }),
      })
      setCurrentUser(result.user)
      await loadSummary()
      setStatus('Demo-пополнение добавлено в ledger.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Пополнить счёт</h2>
          <p>Credits Ledger v1: demo-пополнение, инвайт-код, история операций.</p>
        </div>
        <span className="avaCreditPill">{summary?.balance ?? 0} credits</span>
      </div>

      {error && <div className="avaError">{error}</div>}
      {status && <div className="avaInfoBox">{status}</div>}

      <div className="avaCreditsLayout">
        <form className="avaPanel avaCreditsInvitePanel" onSubmit={applyInvite}>
          <p className="avaEyebrow"><KeyRound size={15} /> Invite access</p>
          <h2>Инвайт-код</h2>
          <p>
            Служебный demo-код вводится один раз на аккаунт и поднимает баланс до 1000 credits.
            Это нужно для твоих тестовых аккаунтов до подключения реальной оплаты.
          </p>
          <label>
            Код доступа
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Введите инвайт-код"
              disabled={summary?.invite_used || loading}
            />
          </label>
          <button className="avaPrimaryButton" disabled={summary?.invite_used || loading || !inviteCode.trim()}>
            <ShieldCheck size={16} /> {summary?.invite_used ? 'Код уже применён' : 'Активировать 1000 credits'}
          </button>
        </form>

        <div className="avaPanel avaCreditsHistoryPanel">
          <p className="avaEyebrow"><History size={15} /> Ledger</p>
          <h2>История</h2>
          <div className="avaLedgerList">
            {(summary?.ledger || []).slice(0, 8).map((item) => (
              <div className="avaLedgerItem" key={item.id}>
                <strong>{item.action_type}</strong>
                <span>{item.amount > 0 ? '+' : ''}{item.amount} credits</span>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
            ))}
            {summary?.ledger?.length === 0 && <p>Операций пока нет.</p>}
          </div>
        </div>
      </div>

      <div className="avaSectionHeader">
        <div>
          <h3>Demo-пакеты</h3>
          <p>Пока без оплаты. Позже здесь будет реальный billing.</p>
        </div>
      </div>

      <div className="avaModuleGrid">
        {summary?.packages?.map((pack) => (
          <div className="avaModuleCard" key={pack.id}>
            <div className="avaModuleIcon"><Gift size={22} /></div>
            <h4>{pack.label}</h4>
            <p>Тестовое пополнение для проверки credits ledger.</p>
            <button className="avaMiniActionButton" type="button" onClick={() => topupDemo(pack.id)} disabled={loading}>
              <Plus size={14} /> Добавить
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}