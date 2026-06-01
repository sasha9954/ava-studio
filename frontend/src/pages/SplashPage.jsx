import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, LogIn, ShieldCheck, Sparkles, UserPlus, Workflow } from 'lucide-react'

export default function SplashPage() {
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="avaSplash">
      <div className="avaGlow avaGlowOne" />
      <div className="avaGlow avaGlowTwo" />

      {!introDone && (
        <div className="avaIntroSplash">
          <div className="avaIntroLogo">
            <Brain size={54} />
          </div>
          <div className="avaIntroTitle">ava-studio</div>
          <div className="avaIntroSub">AI video workflow studio</div>
          <div className="avaIntroLoader"><span /></div>
        </div>
      )}

      <div className={`avaSplashCard ${introDone ? 'isVisible' : 'isHidden'}`}>
        <div className="avaSplashLogo"><Brain size={44} /></div>
        <p className="avaEyebrow"><Sparkles size={16} /> AI video workflow studio</p>
        <h1>ava-studio</h1>
        <p className="avaSplashText">
          Один проект для аудио, тайминга, подкаста, доски, генерации сцен и финальной сборки видео.
        </p>
        <div className="avaSplashActions">
          <Link className="avaPrimaryButton" to="/login"><LogIn size={16} /> Войти</Link>
          <Link className="avaSecondaryButton" to="/register"><UserPlus size={16} /> Создать аккаунт</Link>
        </div>
        <div className="avaSplashFeatures">
          <span><Workflow size={16} /> project workflow</span>
          <span><ShieldCheck size={16} /> account-scoped save</span>
          <span><Brain size={16} /> ready for Codex</span>
        </div>
      </div>
    </div>
  )
}
