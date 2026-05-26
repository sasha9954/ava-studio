import { Link } from 'react-router-dom'
import { Brain, Sparkles, Workflow, ShieldCheck } from 'lucide-react'

export default function SplashPage() {
  return (
    <div className="avaSplash">
      <div className="avaGlow avaGlowOne" />
      <div className="avaGlow avaGlowTwo" />
      <div className="avaSplashCard">
        <div className="avaSplashLogo"><Brain size={44} /></div>
        <p className="avaEyebrow"><Sparkles size={16} /> AI video workflow studio</p>
        <h1>ava-studio</h1>
        <p className="avaSplashText">
          Один проект для аудио, тайминга, подкаста, доски, генерации сцен и финальной сборки видео.
        </p>
        <div className="avaSplashActions">
          <Link className="avaPrimaryButton" to="/login">Войти</Link>
          <Link className="avaSecondaryButton" to="/register">Создать аккаунт</Link>
        </div>
        <div className="avaSplashFeatures">
          <span><Workflow size={16} /> проектный workflow</span>
          <span><ShieldCheck size={16} /> account-scoped save</span>
          <span><Brain size={16} /> готово для Codex</span>
        </div>
      </div>
    </div>
  )
}
