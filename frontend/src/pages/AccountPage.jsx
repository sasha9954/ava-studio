import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FolderKanban, LogOut, ShieldCheck, Sparkles, UserRound, WalletCards } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'

function getDisplayName(user) {
  return user?.name || user?.email?.split('@')?.[0] || 'User'
}

function getInitials(name) {
  return String(name || 'A')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A'
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { projects, exitProject } = useProjects()
  const navigate = useNavigate()

  const displayName = getDisplayName(user)
  const initials = getInitials(displayName)
  const credits = user?.credits_balance ?? 0

  function handleLogout() {
    exitProject()
    logout()
    navigate('/')
  }

  return (
    <div className="avaPage avaAccountPage">
      <section className="avaAccountHero">
        <div className="avaAccountGlow is-one" />
        <div className="avaAccountGlow is-two" />

        <div className="avaAccountHeader">
          <div className="avaAccountAvatar" aria-hidden="true">
            <span>{initials}</span>
          </div>
          <div className="avaAccountIdentity">
            <p className="avaAccountEyebrow"><UserRound size={15} /> Личный кабинет</p>
            <h2>{displayName}</h2>
            <p>{user?.email || 'email не указан'}</p>
          </div>
          <div className="avaAccountPlan">
            <Sparkles size={16} />
            <span>Pro workspace</span>
          </div>
        </div>

        <div className="avaAccountStats">
          <div className="avaAccountStat is-credits">
            <span><WalletCards size={18} /> Баланс</span>
            <strong>{credits}</strong>
            <small>credits</small>
          </div>
          <div className="avaAccountStat is-projects">
            <span><FolderKanban size={18} /> Проекты</span>
            <strong>{projects.length}</strong>
            <small>создано</small>
          </div>
          <div className="avaAccountStat is-access">
            <span><ShieldCheck size={18} /> Доступ</span>
            <strong>active</strong>
            <small>workspace ready</small>
          </div>
        </div>

        <div className="avaAccountNotice">
          <ShieldCheck size={19} />
          <div>
            <strong>Аккаунт активен</strong>
            <p>
              Рабочая область, проекты, кредиты и модули доступны после входа. При выходе ты переходишь в гостевой режим.
            </p>
          </div>
        </div>

        <div className="avaAccountActions">
          <Link className="avaAccountPrimary" to="/app/projects">
            <FolderKanban size={17} /> Мои проекты <ArrowRight size={16} />
          </Link>
          <Link className="avaAccountSecondary" to="/app/credits">
            <WalletCards size={17} /> Credits
          </Link>
          <button className="avaAccountGhost" type="button" onClick={handleLogout}>
            <LogOut size={16} /> Выйти из аккаунта
          </button>
        </div>
      </section>
    </div>
  )
}
