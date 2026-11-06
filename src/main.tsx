import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-sans/400-italic.css'
import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/ibm-plex-sans-condensed/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/content.css'
import './styles/app.css'
import './styles/checks.css'
import './styles/learn.css'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { ChapterPage } from './pages/Chapter'
import { TopicPage } from './pages/Topic'
import { Guide, ProgressPage } from './pages/Misc'
import { ChapterCheckPage } from './pages/ChapterCheck'
import { PracticePage } from './pages/PracticePage'
import { FlashcardsPage } from './pages/Flashcards'
import { GlossaryPage } from './pages/Glossary'
import { NotFound } from './pages/NotFound'

// Strip the trailing slash from Vite's base so the router sees "/LearningAI" style basenames.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="guide" element={<Guide />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="flashcards" element={<FlashcardsPage />} />
            <Route path="glossary" element={<GlossaryPage />} />
            <Route path=":chapterId/check" element={<ChapterCheckPage />} />
            <Route path=":chapterId" element={<ChapterPage />} />
            <Route path=":chapterId/:topicId" element={<TopicPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
