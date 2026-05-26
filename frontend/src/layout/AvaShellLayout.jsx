import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Brain, ChevronLeft, ChevronRight, FolderKanban, Home, LogOut, PlusCircle, Settings, WalletCards, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'
import { getProjectTheme } from '../utils/projectTheme.js'

const navItems = [
  { to: '/app/dashboard', label: 'Главная', icon: Home },
  { to: '/app/projects', label: 'Мои проекты', icon: FolderKanban },
  { to: '/app/projects/new', label: 'Создать проект', icon: PlusCircle },
  { to: '/app/account', label: 'Кабинет', icon: UserRound },
  { to: '/app/credits', label: 'Пополнить счёт', icon: WalletCards },
]

const SIDEBAR_OPEN_KEY = 'ava_sidebar_open'

export default function AvaShellLayout() {
  const { user, logout } = useAuth()
  const { projects, activeProject, lastSavedAt, exitProject } = useProjects()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_OPEN_KEY) === '1')
  const projectTheme = useMemo(() => getProjectTheme(activeProject, projects), [activeProject, projects])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? '1' : '0')
  }, [sidebarOpen])

  function handleLogout() {
    logout()
    navigate('/')
  }

  function handleExitProject() {
    exitProject()
    navigate('/app/dashboard')
  }

  const shellModeClass = activeProject ? 'isProjectMode' : 'isWorkspaceMode'
  const sidebarClass = sidebarOpen ? 'isSidebarOpen' : 'isSidebarClosed'

  return (
    <div className={`avaShell ${shellModeClass} ${sidebarClass}`} style={projectTheme.style}>
      <aside className="avaSidebar" aria-label="Основное меню ava-studio">
        <button
          className="avaSidebarToggle"
          type="button"
          onClick={() => setSidebarOpen((value) => !value)}
          title={sidebarOpen ? 'Свернуть меню' : 'Открыть меню'}
          aria-label={sidebarOpen ? 'Свернуть меню' : 'Открыть меню'}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        <Link to="/app/dashboard" className="avaBrand" title="ava-studio">
          <span className="avaBrandIcon"><Brain size={24} /></span>
          <span className="avaSidebarText">
            <strong>ava-studio</strong>
            <em>AI video workflow</em>
          </span>
        </Link>

        <nav className="avaNav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => `avaNavItem ${isActive ? 'isActive' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="avaSidebarProject" title={activeProject?.name || 'Рабочая область'}>
          <span>{activeProject ? `Проектный режим · ${projectTheme.name}` : 'Рабочая область'}</span>
          <strong>{activeProject?.name || 'без проекта'}</strong>
          <small>{activeProject?.format || 'автосохранение черновиков'}</small>
        </div>

        <button className="avaGhostButton" type="button" title="Настройки позже">
          <Settings size={16} /> <span className="avaSidebarText">Настройки позже</span>
        </button>
      </aside>

      <main className="avaMain">
        <header className="avaTopbar">
          <div className="avaTopbarLeft">
            <p>{activeProject ? `Проект открыт · ${activeProject.format}` : 'Рабочая область'}</p>
            <h1>{activeProject ? activeProject.name : 'ava-studio'}</h1>
          </div>
          <div className="avaTopbarRight">
            <span className="avaModePill">{activeProject ? 'project mode' : 'workspace mode'}</span>
            <span className="avaSavePill">{lastSavedAt ? 'Сохранено' : 'autosave ready'}</span>
            <span className="avaCreditPill">{user?.credits_balance ?? 0} credits</span>
            {activeProject && (
              <button className="avaExitProjectButton" type="button" onClick={handleExitProject}>
                Выйти из проекта
              </button>
            )}
            <button className="avaUserPill" onClick={handleLogout} title="Выйти из аккаунта">
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
