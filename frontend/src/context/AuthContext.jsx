import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/apiClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ava_token'))
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(Boolean(token))

  useEffect(() => {
    function readCreditBalance(value) {
      if (!value || typeof value !== 'object') return null
      for (const key of ['balance', 'creditBalance', 'credit_balance', 'credits_balance', 'credits']) {
        const raw = value?.[key]
        if (raw === 0 || raw) {
          const numberValue = Number(raw)
          if (Number.isFinite(numberValue)) return numberValue
        }
      }
      return null
    }

    function handleUserUpdated(event) {
      if (event?.detail) setUser(event.detail)
    }

    function handleCreditsUpdated(event) {
      const nextBalance = readCreditBalance(event?.detail)
      if (nextBalance === null) return

      setUser((oldUser) => oldUser ? {
        ...oldUser,
        credits_balance: nextBalance,
        creditBalance: nextBalance,
      } : oldUser)
    }

    window.addEventListener('ava:user-updated', handleUserUpdated)
    window.addEventListener('ava:credits-updated', handleCreditsUpdated)
    return () => {
      window.removeEventListener('ava:user-updated', handleUserUpdated)
      window.removeEventListener('ava:credits-updated', handleCreditsUpdated)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function boot() {
      if (!token) {
        setBooting(false)
        return
      }
      try {
        const data = await apiRequest('/auth/me')
        if (active) setUser(data.user)
      } catch (error) {
        localStorage.removeItem('ava_token')
        if (active) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (active) setBooting(false)
      }
    }
    boot()
    return () => { active = false }
  }, [token])

  async function login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('ava_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  async function register(name, email, password) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    localStorage.setItem('ava_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  async function refreshUser() {
    const data = await apiRequest('/auth/me')
    setUser(data.user)
    return data.user
  }

  function setCurrentUser(nextUser) {
    if (nextUser) setUser(nextUser)
  }

  function logout() {
    localStorage.removeItem('ava_token')
    setToken(null)
    setUser(null)
  }

  const value = useMemo(() => ({ token, user, booting, login, register, logout, refreshUser, setCurrentUser }), [token, user, booting])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside ProjectProvider')
  return value
}
