import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ProjectProvider } from './context/ProjectContext.jsx'
import App from './App.jsx'
import './styles/ava-theme.css'
import './styles/ava-shell.css'
import './styles/ava-pages.css'
import './styles/ava-modals.css'
import './styles/ava-credits.css'
import './styles/ava-auth.css'
import './styles/ava-jobs.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
