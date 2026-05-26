import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { projects, exitProject } = useProjects()
  const navigate = useNavigate()

  function handleLogout() {
    exitProject()
    logout()
    navigate('/')
  }

  return (
    <div className="avaPage avaNarrowPage">
      <div className="avaPanel">
        <p className="avaEyebrow">Кабинет</p>
        <h2>{user?.name}</h2>
        <p>{user?.email}</p>
        <div className="avaStatsGrid">
          <div><strong>{user?.credits_balance ?? 0}</strong><span>credits</span></div>
          <div><strong>{projects.length}</strong><span>проектов</span></div>
        </div>
        <div className="avaInfoBox">
          При выходе ты переходишь в гостевой режим. Гость может видеть только стартовый экран,
          вход и регистрацию. Рабочая область, проекты, кредиты и модули доступны только после входа.
        </div>
        <button className="avaSecondaryButton" type="button" onClick={handleLogout}>
          <LogOut size={16} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}