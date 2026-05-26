import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="avaAuthPage">
      <form className="avaAuthCard" onSubmit={submit}>
        <div className="avaMiniLogo"><Brain size={26} /> ava-studio</div>
        <h1>Создать аккаунт</h1>
        <p>Первый аккаунт получает демо-баланс для тестов.</p>
        {error && <div className="avaError">{error}</div>}
        <label>Имя<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>
          Пароль
          <span className="avaPasswordField">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} minLength={6} required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button className="avaPrimaryButton" disabled={loading}>{loading ? 'Создаём…' : 'Создать аккаунт'}</button>
        <span className="avaAuthSwitch">Уже есть аккаунт? <Link to="/login">Войти</Link></span>
      </form>
    </div>
  )
}