import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AvaShellLayout from './layout/AvaShellLayout.jsx'
import SplashPage from './pages/SplashPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProjectsPage from './pages/ProjectsPage.jsx'
import CreateProjectPage from './pages/CreateProjectPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import CreditsPage from './pages/CreditsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ManualTimingPage from './pages/ManualTimingPage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import BoardAssemblyPage from './pages/BoardAssemblyPage.jsx'
import ModulePlaceholderPage from './pages/ModulePlaceholderPage.jsx'
import PodcastAudioComposerPage from './pages/podcast_audio/PodcastAudioComposerPage.jsx'

function Protected({ children }) {
  const { token, booting } = useAuth()
  if (booting) return <div className="avaBoot">Загрузка ava-studio…</div>
  if (!token) return <Navigate to="/register" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/studio/podcast-audio-composer" element={<Protected><PodcastAudioComposerPage /></Protected>} />
      <Route
        path="/app"
        element={
          <Protected>
            <AvaShellLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<CreateProjectPage />} />
        <Route path="workspace/timing" element={<ManualTimingPage />} />
        <Route path="workspace/podcast" element={<PodcastAudioComposerPage />} />
        <Route path="workspace/board" element={<BoardPage />} />
        <Route path="workspace/board-assembly" element={<BoardAssemblyPage />} />
        <Route path="workspace/video-node" element={<ModulePlaceholderPage stage="video_node" />} />
        <Route path="workspace/generator" element={<ModulePlaceholderPage stage="generator" />} />
        <Route path="projects/:projectId/timing" element={<ManualTimingPage />} />
        <Route path="projects/:projectId/podcast" element={<PodcastAudioComposerPage />} />
        <Route path="projects/:projectId/board" element={<BoardPage />} />
        <Route path="projects/:projectId/board-assembly" element={<BoardAssemblyPage />} />
        <Route path="projects/:projectId/video-node" element={<ModulePlaceholderPage stage="video_node" />} />
        <Route path="projects/:projectId/generator" element={<ModulePlaceholderPage stage="generator" />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
