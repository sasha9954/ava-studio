import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ProjectProvider } from './context/ProjectContext.jsx'
import App from './App.jsx'
import './styles/ava-theme.css'
import './styles/ava-shell.css'
import './styles/ava-pages.css'
import './styles/ava-public.css'
import './styles/ava-modals.css'
import './styles/ava-credits.css'
import './styles/ava-auth.css'
import './styles/ava-jobs.css'
import './styles/ava-settings.css'
import './styles/ava-timing.css'

createRoot(document.getElementById('root')).render(
  // AVA_F5_RESTORE_NO_STRICT_DOUBLE_MOUNT_V200J:
  // React.StrictMode intentionally double-mounts effects in dev. In Ava Board this
  // duplicated initial /projects, /auth/me, /snapshots and asset-restore requests,
  // making F5 look much slower than the real app. Keep the local repair build single-pass.
  <BrowserRouter>
    <AuthProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </AuthProvider>
  </BrowserRouter>,
)
