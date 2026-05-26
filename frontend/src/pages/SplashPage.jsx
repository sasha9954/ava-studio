import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Clapperboard, Film, GalleryHorizontalEnd, LogIn, Mic2, Scissors, ShieldCheck, Sparkles, UserPlus, Workflow } from 'lucide-react'

const publicModules = [
  { title: 'Тайминг', icon: Mic2, text: 'Разбивка аудио на сцены, фразы и смысловые блоки.' },
  { title: 'Подкаст', icon: Scissors, text: 'Роли, реплики, паузы и финальное аудио.' },
  { title: 'Доска', icon: GalleryHorizontalEnd, text: 'Сцены, кадры, промты и генерация по частям.' },
  { title: 'Сборка', icon: Clapperboard, text: 'Финальный ролик из готовых сцен.' },
  { title: 'Генератор', icon: Film, text: 'Быстрые тесты видео из изображения, аудио и кадров.' },
]

export default function SplashPage() {
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 3000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="avaSplash avaPublicHome">
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

      <div className={`avaPublicHomeInner ${introDone ? 'isVisible' : 'isHidden'}`}>
        <div className="avaPublicTopbar">
          <div className="avaMiniLogo"><Brain size={24} /> ava-studio</div>
          <div className="avaPublicTopbarActions">
            <Link className="avaSecondaryButton" to="/login"><LogIn size={16} /> Войти</Link>
            <Link className="avaPrimaryButton" to="/register"><UserPlus size={16} /> Создать аккаунт</Link>
          </div>
        </div>

        <div className="avaSplashCard avaPublicHero">
          <div className="avaSplashLogo"><Brain size={44} /></div>
          <p className="avaEyebrow"><Sparkles size={16} /> AI video workflow studio</p>
          <h1>ava-studio</h1>
          <p className="avaSplashText">
            Один проект для аудио, тайминга, подкаста, доски, генерации сцен и финальной сборки видео.
          </p>
          <div className="avaSplashActions">
            <Link className="avaPrimaryButton" to="/register">Начать работу</Link>
            <Link className="avaSecondaryButton" to="/login">Уже есть аккаунт</Link>
          </div>
          <div className="avaSplashFeatures">
            <span><Workflow size={16} /> project workflow</span>
            <span><ShieldCheck size={16} /> account-scoped save</span>
            <span><Brain size={16} /> ready for Codex</span>
          </div>
        </div>

        <div className="avaPublicModules">
          {publicModules.map((module) => {
            const Icon = module.icon
            return (
              <Link className="avaPublicModuleCard" to="/register" key={module.title}>
                <div className="avaModuleIcon"><Icon size={22} /></div>
                <h3>{module.title}</h3>
                <p>{module.text}</p>
                <span>Регистрация для доступа</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
