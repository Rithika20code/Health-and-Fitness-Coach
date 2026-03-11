import { initializeLLM, initializeVLM } from './lib/runanywhere'
import { useState, useEffect } from 'react'
import { RunAnywhereProvider } from './lib/runanywhere'
import Navigation from './components/Navigation'
import MealAnalyzer from './components/MealAnalyzer'
import MoodTracker from './components/MoodTracker'
import WorkoutGenerator from './components/WorkoutGenerator'
import VoiceAssistant from './components/VoiceAssistant'
import UserOnboarding from './components/UserOnboarding'

export type TabType = 'assistant' | 'meal' | 'mood' | 'workout'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('assistant')
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Starting AI...')

  useEffect(() => {
    const initialized = localStorage.getItem('healthtracker_initialized')
    setShowOnboarding(!initialized)
    
    async function initAI() {
      try {
        setLoadingStatus('Loading language model...')
        await initializeLLM()
        setLoadingStatus('Loading vision model...')
        await initializeVLM()
        setLoadingStatus('Ready!')
      } catch (err) {
        console.error('AI init error:', err)
        setLoadingStatus('AI ready (offline mode)')
      } finally {
        setTimeout(() => setIsLoading(false), 500)
      }
    }

    initAI()
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  const dismissLoading = () => {
    setIsLoading(false)
  }

  if (showOnboarding === null) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <RunAnywhereProvider>
        <UserOnboarding onComplete={handleOnboardingComplete} />
      </RunAnywhereProvider>
    )
  }

  return (
    <RunAnywhereProvider>
      <div className="app-container">
        <header className="app-header">
          <h1>Health Tracker AI</h1>
          <p className="subtitle">Private, on-device AI health assistant</p>
        </header>
        
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        
        <main className="main-content">
          {activeTab === 'assistant' && <VoiceAssistant />}
          {activeTab === 'meal' && <MealAnalyzer />}
          {activeTab === 'mood' && <MoodTracker />}
          {activeTab === 'workout' && <WorkoutGenerator />}
        </main>
        
        <footer className="app-footer">
          <p>All processing happens locally on your device</p>
        </footer>

        {isLoading && (
          <div className="loading-overlay" onClick={dismissLoading}>
            <div className="loading-toast">
              <div className="loading-spinner"></div>
              <span>{loadingStatus}</span>
              <button onClick={dismissLoading}>Skip</button>
            </div>
          </div>
        )}
      </div>
    </RunAnywhereProvider>
  )
}

export default App
