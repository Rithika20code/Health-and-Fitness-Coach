import { useState, useEffect } from 'react'
import { storage, type UserProfile } from '../lib/storage'

interface ProfileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<UserProfile | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = () => {
    const userProfile = storage.getUserProfile()
    setProfile(userProfile)
    setEditData(userProfile)
  }

  const handleLogout = () => {
    localStorage.removeItem('healthtracker_initialized')
    localStorage.removeItem('healthtracker_user')
    window.location.reload()
  }

  const handleSave = () => {
    if (editData) {
      storage.saveUserProfile(editData)
      localStorage.setItem('healthtracker_initialized', 'true')
      setProfile(editData)
      setIsEditing(false)
    }
  }

  const calculateBMI = (): string => {
    if (!profile) return '0'
    const heightM = profile.height / 100
    return (profile.weight / (heightM * heightM)).toFixed(1)
  }

  const getBMICategory = (bmiStr: string) => {
    const bmi = parseFloat(bmiStr)
    if (isNaN(bmi)) return { label: 'Unknown', color: '#6b7280' }
    if (bmi < 18.5) return { label: 'Underweight', color: '#f59e0b' }
    if (bmi < 25) return { label: 'Normal', color: '#10b981' }
    if (bmi < 30) return { label: 'Overweight', color: '#f59e0b' }
    return { label: 'Obese', color: '#ef4444' }
  }

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <div className={`profile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Profile</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {profile && !isEditing && (
          <div className="profile-content">
            <div className="profile-avatar">
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            </div>
            <h3 className="profile-name">{profile.name}</h3>
            <p className="profile-level">{profile.fitnessLevel.charAt(0).toUpperCase() + profile.fitnessLevel.slice(1)}</p>

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{profile.age}</span>
                <span className="stat-label">Age</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{profile.weight}kg</span>
                <span className="stat-label">Weight</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{profile.height}cm</span>
                <span className="stat-label">Height</span>
              </div>
            </div>

            <div className="bmi-section">
              <div className="bmi-header">
                <span>BMI</span>
                <span className="bmi-value">{calculateBMI()}</span>
              </div>
              <div className="bmi-bar">
                <div 
                  className="bmi-fill" 
                  style={{ 
                    width: `${Math.min(100, (parseFloat(calculateBMI()) / 40) * 100)}%`,
                    background: getBMICategory(calculateBMI()).color 
                  }} 
                />
              </div>
              <span className="bmi-category" style={{ color: getBMICategory(calculateBMI()).color }}>
                {getBMICategory(calculateBMI()).label}
              </span>
            </div>

            {profile.goals.length > 0 && (
              <div className="goals-section">
                <h4>Your Goals</h4>
                <div className="goals-list">
                  {profile.goals.map(goal => (
                    <span key={goal} className="goal-tag">
                      {goal === 'weight_loss' && '⚖️ Weight Loss'}
                      {goal === 'muscle_gain' && '💪 Muscle Gain'}
                      {goal === 'endurance' && '🏃 Endurance'}
                      {goal === 'flexibility' && '🧘 Flexibility'}
                      {goal === 'stress_relief' && '😌 Stress Relief'}
                      {goal === 'general' && '❤️ General Health'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-actions">
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                ✏️ Edit Profile
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        )}

        {isEditing && editData && (
          <div className="edit-form">
            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Age: {editData.age}</label>
              <input
                type="range"
                min="10"
                max="100"
                value={editData.age}
                onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) })}
              />
            </div>
            <div className="input-group">
              <label>Weight: {editData.weight}kg</label>
              <input
                type="range"
                min="30"
                max="200"
                value={editData.weight}
                onChange={(e) => setEditData({ ...editData, weight: parseInt(e.target.value) })}
              />
            </div>
            <div className="input-group">
              <label>Height: {editData.height}cm</label>
              <input
                type="range"
                min="100"
                max="220"
                value={editData.height}
                onChange={(e) => setEditData({ ...editData, height: parseInt(e.target.value) })}
              />
            </div>
            <div className="input-group">
              <label>Fitness Level</label>
              <select
                value={editData.fitnessLevel}
                onChange={(e) => setEditData({ ...editData, fitnessLevel: e.target.value as UserProfile['fitnessLevel'] })}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="sidebar-actions">
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
