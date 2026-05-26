import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Brain, FolderKanban, Home, LogOut, PlusCircle, Settings, WalletCards, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'

const navItems = [
  { to: '/app/dashboard', label: 'Главная', icon: Home },
  { to: '/app/projects', label: 'Мои проекты', icon: FolderKanban },
  { to: '/app/projects/new', label: 'Создать проект', icon: PlusCircle },
  { to: '/app/account', label: 'Кабинет', icon: UserRound },
  { to: '/app/credits', label: 'Пополнить счёт', icon: WalletCards },
]

export default function AvaShellLayout() {
  const { user, logout } = useAuth()
  const { activeProject, lastSavedAt } = useProjects()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="avaShell">
      <aside className="avaSidebar">
        <Link to="/app/dashboard" className="avaBrand">
          <span className="avaBrandIcon"><Brain size={24} /></span>
          <span>
            <strong>ava-studio</strong>
            <em>AI video workflow</em>
          </span>
        </Link>

        <nav className="avaNav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `avaNavItem ${isActive ? 'isActive' : ''}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="avaSidebarProject">
          <span>Активный проект</span>
          <strong>{activeProject?.name || 'не выбран'}</strong>
          <small>{activeProject?.format || 'создай или открой проект'}</small>
        </div>

        <button className="avaGhostButton" type="button">
          <Settings size={16} /> Настройки позже
        </button>
      </aside>

      <main className="avaMain">
        <header className="avaTopbar">
          <div>
            <p>Рабочая область</p>
            <h1>{activeProject ? activeProject.name : 'ava-studio'}</h1>
          </div>
          <div className="avaTopbarRight">
            <span className="avaSavePill">{lastSavedAt ? 'Сохранено' : 'autosave ready'}</span>
            <span className="avaCreditPill">{user?.credits_balance ?? 0} credits</span>
            <button className="avaUserPill" onClick={handleLogout} title="Выйти">
              {user?.name || user?.email || 'User'} <LogOut size={15} />
            </button>
          </div>
        </header>
        <section className="avaContent">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
