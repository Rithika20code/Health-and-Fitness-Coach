import { useState, useEffect } from 'react'
import type { TabType } from '../App'
import { storage, type UserProfile } from '../lib/storage'
import ProfileSidebar from './ProfileSidebar'

interface NavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'assistant', label: 'Assistant', icon: '🤖' },
  { id: 'meal', label: 'Meal Analysis', icon: '🍎' },
  { id: 'mood', label: 'Mood Tracker', icon: '😊' },
  { id: 'workout', label: 'Workouts', icon: '💪' },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const userProfile = storage.getUserProfile()
    setProfile(userProfile)
  }, [])

  return (
    <>
      <nav className="navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
        <button
          className="nav-tab profile-tab"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="nav-icon">
            {profile ? profile.name.charAt(0).toUpperCase() : '👤'}
          </span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>

      <ProfileSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
    </>
  )
}
