import { lazy, Suspense } from 'react'
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

// AVA_ROUTE_LAZY_LOAD_V200C:
// Board/Timing/Assembly/Generator pages are heavy; do not put all of them into the first app bundle.
const ManualTimingPage = lazy(() => import('./pages/ManualTimingPage.jsx'))
const BoardPage = lazy(() => import('./pages/BoardPage.jsx'))
const BoardAssemblyPage = lazy(() => import('./pages/BoardAssemblyPage.jsx'))
const PodcastAudioComposerPage = lazy(() => import('./pages/podcast_audio/PodcastAudioComposerPage.jsx'))
const VideoMatchBoardPage = lazy(() => import('./pages/video_match_board/VideoMatchBoardPage.jsx'))
const StandaloneGeneratorPage = lazy(() => import('./pages/standalone_generator/StandaloneGeneratorPage.jsx'))
const AudioStudioPage = lazy(() => import('./pages/audio_studio/AudioStudioPage.jsx'))
const RulesPackPage = lazy(() => import('./pages/RulesPackPage.jsx'))

function Protected({ children }) {
  const { token, booting } = useAuth()
  if (booting) return <div className="avaBoot">Загрузка ava-studio…</div>
  if (!token) return <Navigate to="/register" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<div className="avaBoot">Загрузка модуля ava-studio…</div>}>
      <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/studio/podcast-audio-composer" element={<Protected><PodcastAudioComposerPage /></Protected>} />
      <Route path="/studio/video-node" element={<Protected><VideoMatchBoardPage /></Protected>} />
      <Route path="/generator" element={<Protected><StandaloneGeneratorPage /></Protected>} />
      <Route path="/studio/generator" element={<Protected><StandaloneGeneratorPage /></Protected>} />
      <Route path="/studio/video-match-board" element={<Protected><VideoMatchBoardPage /></Protected>} />
      <Route path="/rules/:packId" element={<Protected><RulesPackPage /></Protected>} />
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
        <Route path="workspace/video-node" element={<VideoMatchBoardPage />} />
        <Route path="workspace/video-match-board" element={<VideoMatchBoardPage />} />
        <Route path="workspace/generator" element={<StandaloneGeneratorPage />} />
        <Route path="workspace/audio-studio" element={<AudioStudioPage />} />
        <Route path="projects/:projectId/timing" element={<ManualTimingPage />} />
        <Route path="projects/:projectId/podcast" element={<PodcastAudioComposerPage />} />
        <Route path="projects/:projectId/board" element={<BoardPage />} />
        <Route path="projects/:projectId/board-assembly" element={<BoardAssemblyPage />} />
        <Route path="projects/:projectId/video-node" element={<VideoMatchBoardPage />} />
        <Route path="projects/:projectId/video-match-board" element={<VideoMatchBoardPage />} />
        <Route path="projects/:projectId/generator" element={<StandaloneGeneratorPage />} />
        <Route path="projects/:projectId/audio-studio" element={<AudioStudioPage />} />
        <Route path="rules/:packId" element={<RulesPackPage />} />
        <Route path="projects/:projectId/rules/:packId" element={<RulesPackPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
