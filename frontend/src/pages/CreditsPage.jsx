import { useEffect, useState } from 'react'
import { CreditCard, Gift, History, KeyRound, Plus, ShieldCheck, WalletCards, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../services/apiClient.js'

const emptyPaymentForm = {
  cardNumber: '',
  expiry: '',
  cvc: '',
}

export default function CreditsPage() {
  const { setCurrentUser } = useAuth()
  const [summary, setSummary] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [selectedPack, setSelectedPack] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
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
      setStatus('Инвайт-код применён. Баланс восстановлен до 1000 credits.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openPaymentModal(pack) {
    setError('')
    setStatus('')
    setSelectedPack(pack)
    setPaymentForm(emptyPaymentForm)
  }

  function closePaymentModal() {
    if (loading) return
    setSelectedPack(null)
    setPaymentForm(emptyPaymentForm)
  }

  function updatePaymentField(key, value) {
    setPaymentForm((prev) => ({ ...prev, [key]: value }))
  }

  async function confirmTopup(event) {
    event.preventDefault()
    if (!selectedPack) return
    setError('')
    setStatus('')
    setLoading(true)
    try {
      const result = await apiRequest('/credits/topup-demo', {
        method: 'POST',
        body: JSON.stringify({ package_id: selectedPack.id }),
      })
      setCurrentUser(result.user)
      await loadSummary()
      setSelectedPack(null)
      setPaymentForm(emptyPaymentForm)
      setStatus(`Пакет ${selectedPack.label} добавлен. Позже здесь подключим реальный billing.`)
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
          <p>Credits Ledger v1: пакеты, инвайт-код, история операций.</p>
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
            Служебный код можно вводить повторно: он восстанавливает demo-баланс до 1000 credits.
            Это нужно для твоих тестовых аккаунтов.
          </p>
          <label>
            Код доступа
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Введите инвайт-код"
              disabled={loading}
            />
          </label>
          <button className="avaPrimaryButton" disabled={loading || !inviteCode.trim()}>
            <ShieldCheck size={16} /> Активировать 1000 credits
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
          <h3>Пакеты credits</h3>
          <p>Пока это mock-форма оплаты. Реальный billing подключим позже.</p>
        </div>
      </div>

      <div className="avaModuleGrid">
        {summary?.packages?.map((pack) => (
          <div className="avaModuleCard" key={pack.id}>
            <div className="avaModuleIcon"><Gift size={22} /></div>
            <h4>{pack.label}</h4>
            <p className="avaPriceLine">${pack.usd ?? 0}</p>
            <button className="avaMiniActionButton" type="button" onClick={() => openPaymentModal(pack)} disabled={loading}>
              <Plus size={14} /> Купить
            </button>
          </div>
        ))}
      </div>

      {selectedPack && (
        <div className="avaModalOverlay" role="presentation" onMouseDown={closePaymentModal}>
          <form className="avaConfirmModal avaPaymentModal" onSubmit={confirmTopup} onMouseDown={(event) => event.stopPropagation()}>
            <button className="avaModalClose" type="button" onClick={closePaymentModal} aria-label="Закрыть" disabled={loading}>
              <X size={18} />
            </button>
            <div className="avaConfirmIcon"><WalletCards size={26} /></div>
            <p className="avaEyebrow"><CreditCard size={15} /> Payment mock</p>
            <h3>{selectedPack.label} · ${selectedPack.usd ?? 0}</h3>
            <p>Введите данные карты для демо-окна. На этом этапе данные никуда не отправляются, backend получает только выбранный пакет.</p>

            <label>
              Номер карты
              <input
                value={paymentForm.cardNumber}
                onChange={(event) => updatePaymentField('cardNumber', event.target.value)}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                required
              />
            </label>
            <div className="avaPaymentRow">
              <label>
                Дата
                <input
                  value={paymentForm.expiry}
                  onChange={(event) => updatePaymentField('expiry', event.target.value)}
                  placeholder="MM/YY"
                  required
                />
              </label>
              <label>
                CVC
                <input
                  value={paymentForm.cvc}
                  onChange={(event) => updatePaymentField('cvc', event.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                  required
                />
              </label>
            </div>

            <div className="avaModalActions">
              <button className="avaPrimaryButton" disabled={loading}>
                <WalletCards size={16} /> {loading ? 'Обработка…' : `Оплатить $${selectedPack.usd ?? 0}`}
              </button>
              <button className="avaSecondaryButton" type="button" onClick={closePaymentModal} disabled={loading}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}