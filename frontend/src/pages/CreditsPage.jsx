import { useEffect, useState } from 'react'
import { CreditCard, Gift, History, KeyRound, Plus, ShieldCheck, WalletCards, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../services/apiClient.js'

const emptyPaymentForm = {
  cardNumber: '',
  expiry: '',
  cvc: '',
}

const CREDIT_PACKAGE_COPY = {
  pack_100: {
    badge: 'Старт',
    caption: 'Для быстрых тестов и проверки пайплайна.',
  },
  pack_250: {
    badge: 'Практично',
    caption: 'Нормальный запас для регулярной работы.',
  },
  pack_600: {
    badge: 'Выгодно',
    caption: 'Лучший баланс цены и количества тестов.',
    featured: true,
  },
  pack_1000: {
    badge: 'Студия',
    caption: 'Для длинных проектов и активной генерации.',
  },
}

function packageMeta(pack = {}) {
  const fallbackCredits = Number(String(pack.label || '').match(/\d+/)?.[0] || 0)
  const credits = Number(pack.credits || fallbackCredits || 0)
  const usd = Number(pack.usd || 0)
  const rate = usd > 0 ? Math.round((credits / usd) * 10) / 10 : 0
  const copy = CREDIT_PACKAGE_COPY[pack.id] || {}

  return {
    credits,
    usd,
    rate,
    badge: copy.badge || 'Пакет',
    caption: copy.caption || 'Пакет credits для работы в Ava Studio.',
    featured: Boolean(copy.featured),
  }
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

      <div className="avaCreditsPackagesGrid">
        {summary?.packages?.map((pack) => {
          const meta = packageMeta(pack)
          return (
            <div className={`avaCreditPackCard ${meta.featured ? 'isFeatured' : ''}`} key={pack.id}>
              {meta.featured && <span className="avaCreditPackRibbon">Лучший выбор</span>}
              <div className="avaCreditPackTop">
                <div className="avaCreditPackIcon"><Gift size={22} /></div>
                <span className="avaCreditPackBadge">{meta.badge}</span>
              </div>
              <h4>{meta.credits} credits</h4>
              <div className="avaCreditPackPrice"><span>$</span>{meta.usd}</div>
              <div className="avaCreditPackRate">{meta.rate} credits / $1</div>
              <p>{meta.caption}</p>
              <button className="avaCreditPackButton" type="button" onClick={() => openPaymentModal(pack)} disabled={loading}>
                <Plus size={14} /> Купить пакет
              </button>
            </div>
          )
        })}
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