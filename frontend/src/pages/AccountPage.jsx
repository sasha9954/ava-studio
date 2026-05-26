import { useAuth } from '../context/AuthContext.jsx'
import { useProjects } from '../context/ProjectContext.jsx'

export default function AccountPage() {
  const { user } = useAuth()
  const { projects } = useProjects()
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
      </div>
    </div>
  )
}
