import { useState, useEffect } from 'react'
import { storage } from '../lib/storage'

interface UserProfile {
  name: string
  age: number
  weight: number
  height: number
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
}

const INITIAL_PROFILE_KEY = 'healthtracker_initialized'

export default function UserOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    age: 30,
    weight: 70,
    height: 170,
    fitnessLevel: 'beginner',
    goals: [],
  })

  useEffect(() => {
    const initialized = localStorage.getItem(INITIAL_PROFILE_KEY)
    if (initialized) {
      onComplete()
    } else {
      setIsLoading(false)
    }
  }, [onComplete])

  const updateField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }))
  }

  const handleComplete = () => {
    storage.saveUserProfile(formData)
    localStorage.setItem(INITIAL_PROFILE_KEY, 'true')
    onComplete()
  }

  const canProceed = () => {
    if (step === 1) return formData.name.trim().length > 0
    if (step === 2) return formData.age > 0 && formData.weight > 0 && formData.height > 0
    if (step === 3) return formData.fitnessLevel !== undefined && formData.goals.length > 0
    return true
  }

  if (isLoading) {
    return (
      <div className="onboarding-loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <div className="onboarding-progress">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3</div>
          </div>
        </div>

        <div className="onboarding-content">
          {step === 1 && (
            <div className="onboarding-step">
              <div className="step-icon">👋</div>
              <h2>Welcome! Let's get started</h2>
              <p>What should we call you?</p>
              
              <div className="input-group">
                <label>Your Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <div className="step-icon">📊</div>
              <h2>Your Body Metrics</h2>
              <p>This helps us personalize recommendations</p>
              
              <div className="input-group">
                <label>Age</label>
                <div className="slider-input">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={formData.age}
                    onChange={(e) => updateField('age', parseInt(e.target.value))}
                  />
                  <span className="slider-value">{formData.age} years</span>
                </div>
              </div>

              <div className="input-group">
                <label>Weight</label>
                <div className="slider-input">
                  <input
                    type="range"
                    min="30"
                    max="200"
                    value={formData.weight}
                    onChange={(e) => updateField('weight', parseInt(e.target.value))}
                  />
                  <span className="slider-value">{formData.weight} kg</span>
                </div>
              </div>

              <div className="input-group">
                <label>Height</label>
                <div className="slider-input">
                  <input
                    type="range"
                    min="100"
                    max="220"
                    value={formData.height}
                    onChange={(e) => updateField('height', parseInt(e.target.value))}
                  />
                  <span className="slider-value">{formData.height} cm</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <div className="step-icon">🎯</div>
              <h2>Your Fitness Goals</h2>
              <p>Select all that apply</p>
              
              <div className="goals-grid">
                {[
                  { id: 'weight_loss', icon: '⚖️', label: 'Weight Loss' },
                  { id: 'muscle_gain', icon: '💪', label: 'Muscle Gain' },
                  { id: 'endurance', icon: '🏃', label: 'Better Endurance' },
                  { id: 'flexibility', icon: '🧘', label: 'Flexibility' },
                  { id: 'stress_relief', icon: '😌', label: 'Stress Relief' },
                  { id: 'general', icon: '❤️', label: 'General Health' },
                ].map(goal => (
                  <button
                    key={goal.id}
                    className={`goal-card ${formData.goals.includes(goal.id) ? 'selected' : ''}`}
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <span className="goal-icon">{goal.icon}</span>
                    <span className="goal-label">{goal.label}</span>
                  </button>
                ))}
              </div>

              <div className="fitness-level-section">
                <label>Current Fitness Level</label>
                <div className="level-options">
                  {(['beginner', 'intermediate', 'advanced'] as const).map(level => (
                    <button
                      key={level}
                      className={`level-btn ${formData.fitnessLevel === level ? 'selected' : ''}`}
                      onClick={() => updateField('fitnessLevel', level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          {step > 1 && (
            <button className="btn-back" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleComplete}
              disabled={formData.goals.length === 0}
            >
              Get Started 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
