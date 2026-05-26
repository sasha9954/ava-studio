import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
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
        <h1>Вход</h1>
        <p>Вернись к своим проектам, сценам и сборкам.</p>
        {error && <div className="avaError">{error}</div>}
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Пароль<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
        <button className="avaPrimaryButton" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button>
        <span className="avaAuthSwitch">Нет аккаунта? <Link to="/register">Создать</Link></span>
      </form>
    </div>
  )
}
