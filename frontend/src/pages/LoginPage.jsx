import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Eraser, Eye, EyeOff, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function clearForm() {
    setEmail('')
    setPassword('')
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="avaAuthPage">
      <form className="avaAuthCard" onSubmit={submit} autoComplete="off">
        <div className="avaMiniLogo"><Brain size={26} /> ava-studio</div>
        <h1>Вход</h1>
        <p>Вернись к своим проектам, сценам и сборкам.</p>
        {error && <div className="avaError">{error}</div>}
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            name="ava-login-email"
            autoComplete="off"
            placeholder="email аккаунта"
            required
          />
        </label>
        <label>
          Пароль
          <span className="avaPasswordField">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              name="ava-login-password"
              autoComplete="new-password"
              placeholder="пароль"
              required
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <div className="avaAuthActionsRow">
          <button className="avaPrimaryButton" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button>
          <button className="avaSecondaryButton" type="button" onClick={clearForm} disabled={loading}>
            <Eraser size={16} /> Очистить
          </button>
        </div>
        <span className="avaAuthHint">При смене аккаунта нажми “Очистить”, если Chrome подставил старый email.</span>
        <span className="avaAuthSwitch">Нет аккаунта? <Link to="/register">Создать</Link></span>
        <Link className="avaAuthHomeLink" to="/"><Home size={15} /> На главную</Link>
      </form>
    </div>
  )
}