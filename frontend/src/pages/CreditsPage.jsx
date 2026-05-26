import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient.js'

export default function CreditsPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/credits/summary').then(setSummary).catch((err) => setError(err.message))
  }, [])

  return (
    <div className="avaPage">
      <div className="avaSectionHeader">
        <div>
          <h2>Пополнить счёт</h2>
          <p>Пока это демо-экран. Позже подключаем оплату и реальный ledger.</p>
        </div>
        <span className="avaCreditPill">{summary?.balance ?? 0} credits</span>
      </div>
      {error && <div className="avaError">{error}</div>}
      <div className="avaModuleGrid">
        {summary?.packages?.map((pack) => (
          <div className="avaModuleCard" key={pack.id}>
            <h4>{pack.label}</h4>
            <p>Пакет для генераций. Оплата будет подключена позже.</p>
            <span className="avaModuleStatus">coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}
