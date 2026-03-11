import { useState, useEffect } from 'react'

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Initializing...')

  useEffect(() => {
    const steps = [
      { progress: 10, status: 'Loading RunAnywhere SDK...' },
      { progress: 30, status: 'Initializing AI models...' },
      { progress: 60, status: 'Setting up vision capabilities...' },
      { progress: 80, status: 'Configuring voice features...' },
      { progress: 100, status: 'Ready!' },
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].progress)
        setStatus(steps[currentStep].status)
        currentStep++
      } else {
        clearInterval(interval)
      }
    }, 800)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <span className="logo-icon">🏥</span>
          <h1>Health Tracker AI</h1>
        </div>
        <div className="loading-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="loading-status">{status}</p>
        </div>
        <p className="loading-note">
          All AI processing happens locally on your device
        </p>
      </div>
    </div>
  )
}
