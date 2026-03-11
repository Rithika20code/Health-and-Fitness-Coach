import { useState, useEffect } from 'react'
import { TextGeneration, ensureLLM } from '../lib/runanywhere'
import { storage, type MoodEntry } from '../lib/storage'

const MOOD_OPTIONS: { value: MoodEntry['mood']; label: string; emoji: string }[] = [
  { value: 'great', label: 'Great', emoji: '🤩' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'bad', label: 'Bad', emoji: '😔' },
  { value: 'terrible', label: 'Terrible', emoji: '😢' },
]

const WELLNESS_ACTIVITIES = [
  'Deep breathing exercises',
  '10-minute meditation',
  'Short walk outside',
  'Listen to calming music',
  'Journal your thoughts',
  'Stretching routine',
  'Connect with a friend',
  'Practice gratitude',
]

type AnalysisType = 'wellness' | 'mentalHealth' | 'triggers' | 'relaxation' | 'habits'

export default function MoodTracker() {
  const [selectedMood, setSelectedMood] = useState<MoodEntry['mood'] | null>(null)
  const [energy, setEnergy] = useState(5)
  const [notes, setNotes] = useState('')
  const [activities, setActivities] = useState<string[]>([])
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([])
  const [wellnessSuggestion, setWellnessSuggestion] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('wellness')
  const [status, setStatus] = useState('')

  useEffect(() => {
    loadMoodHistory()
  }, [])

  const loadMoodHistory = () => {
    setMoodHistory(storage.getMoodEntries())
  }

  const toggleActivity = (activity: string) => {
    setActivities(prev => 
      prev.includes(activity) 
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    )
  }

  const saveMood = () => {
    if (!selectedMood) return
    
    storage.saveMoodEntry({
      date: new Date().toISOString(),
      mood: selectedMood,
      energy,
      notes: notes,
      activities,
    })
    
    generateWellnessSuggestion()
    loadMoodHistory()
    setSelectedMood(null)
    setEnergy(5)
    setNotes('')
    setActivities([])
  }

  const generateWellnessSuggestion = async () => {
    const recentMoods = moodHistory.slice(0, 7)
    const moodSummary = recentMoods.map(m => m.mood).join(', ')
    
    const prompt = `Based on recent mood patterns: ${moodSummary || 'no data'}, and today's mood: ${selectedMood}, suggest 2-3 wellness activities from this list that would be most beneficial: ${WELLNESS_ACTIVITIES.join(', ')}. Also provide a brief encouraging message. Keep response under 100 words.`

    try {
      await ensureLLM()
      const result = await TextGeneration.generate(prompt, {
        maxTokens: 150,
        temperature: 0.8,
      })
      
      const suggestion = result.text.trim()
      setWellnessSuggestion(suggestion)
    } catch (err) {
      console.error('Failed to generate suggestion:', err)
      const randomActivities = [...WELLNESS_ACTIVITIES]
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
      setWellnessSuggestion(`Try: ${randomActivities.join(', ')}. Take care of yourself!`)
    }
  }

  const analyzeMoodPatterns = async (type: AnalysisType) => {
    setIsAnalyzing(true)
    setStatus('Analyzing mood patterns...')
    setAnalysisType(type)

    const moods = storage.getMoodEntries()
    const recentMoods = moods.slice(0, 7)
    const moodSummary = recentMoods.map(m => `${m.mood} (energy: ${m.energy})`).join(', ')
    
    let prompt = ''
    
    switch (type) {
      case 'wellness':
        prompt = `The user has been feeling: ${moodSummary || 'no recent data'}. They want wellness activities. Suggest 2-3 activities from this list that would help: ${WELLNESS_ACTIVITIES.join(', ')}. Provide a brief encouraging message. Keep under 100 words.`
        break
      case 'mentalHealth':
        prompt = `Based on recent mood logs: ${moodSummary || 'not enough data'}, suggest activities to improve mental health. Focus on activities that address the mood patterns shown. Include both immediate actions and long-term habits. Keep under 120 words.`
        break
      case 'triggers':
        prompt = `Analyze these mood entries: ${moodSummary || 'not enough data'}. Identify possible triggers for negative moods and patterns. Look for correlations between activities, energy levels, and mood. Keep suggestions practical. Under 100 words.`
        break
      case 'relaxation':
        prompt = `Based on the user's mood history: ${moodSummary || 'neutral'}, recommend a short relaxation routine. Include breathing exercises, stretching, or mindfulness techniques. Make it easy to follow. Keep under 80 words.`
        break
      case 'habits':
        prompt = `Suggest daily habits to maintain emotional balance based on this mood data: ${moodSummary || 'no data'}. Include morning routines, throughout the day practices, and evening wind-down habits. Keep practical and under 100 words.`
        break
    }

    try {
      await ensureLLM()
      const result = await TextGeneration.generate(prompt, {
        maxTokens: 200,
        temperature: 0.8,
      })
      setWellnessSuggestion(result.text.trim())
      setStatus('')
    } catch (err) {
      console.error('Analysis error:', err)
      setWellnessSuggestion(getFallbackAnalysis(type))
      setStatus('')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getFallbackAnalysis = (type: AnalysisType): string => {
    switch (type) {
      case 'wellness':
        return "Try these activities: Deep breathing exercises, 10-minute meditation, and a short walk outside. Remember to take care of yourself!"
      case 'mentalHealth':
        return "For mental health: Practice daily gratitude, connect with friends or family, exercise regularly, and ensure adequate sleep. Small steps make big differences."
      case 'triggers':
        return "Common mood triggers include: lack of sleep, poor diet, inactivity, and social isolation. Try tracking your mood alongside daily activities to identify patterns."
      case 'relaxation':
        return "Try this: 1) Deep breath in for 4 counts, hold for 4, exhale for 4. Repeat 5 times. 2) Progressive muscle relaxation. 3) 5-minute body scan meditation."
      case 'habits':
        return "Daily habits for emotional balance: Morning - stretch and hydrate. Mid-day - short walks and breaks. Evening - digital detox and journaling. Consistency is key!"
    }
  }

  const speakText = async () => {
    if (!wellnessSuggestion) return
    
    try {
      setIsSpeaking(true)
      const { speakText: speak } = await import('../lib/runanywhere')
      await speak(wellnessSuggestion)
    } catch (err) {
      console.error('TTS error:', err)
    } finally {
      setIsSpeaking(false)
    }
  }

  const getMoodEmoji = (mood: MoodEntry['mood']) => {
    return MOOD_OPTIONS.find(m => m.value === mood)?.emoji || '😐'
  }

  return (
    <div className="mood-tracker">
      <div className="feature-header">
        <h2>Mood Tracker</h2>
        <p>Track your mood patterns and get personalized wellness suggestions</p>
      </div>

      <div className="analysis-type-selector">
        <label>What would you like to analyze?</label>
        <div className="analysis-options">
          <button 
            className={`analysis-type-btn ${analysisType === 'wellness' ? 'selected' : ''}`}
            onClick={() => analyzeMoodPatterns('wellness')}
            disabled={isAnalyzing}
          >
            🌟 Wellness Activities
          </button>
          <button 
            className={`analysis-type-btn ${analysisType === 'mentalHealth' ? 'selected' : ''}`}
            onClick={() => analyzeMoodPatterns('mentalHealth')}
            disabled={isAnalyzing}
          >
            🧠 Mental Health
          </button>
          <button 
            className={`analysis-type-btn ${analysisType === 'triggers' ? 'selected' : ''}`}
            onClick={() => analyzeMoodPatterns('triggers')}
            disabled={isAnalyzing}
          >
            🔍 Mood Triggers
          </button>
          <button 
            className={`analysis-type-btn ${analysisType === 'relaxation' ? 'selected' : ''}`}
            onClick={() => analyzeMoodPatterns('relaxation')}
            disabled={isAnalyzing}
          >
            🧘 Relaxation Routine
          </button>
          <button 
            className={`analysis-type-btn ${analysisType === 'habits' ? 'selected' : ''}`}
            onClick={() => analyzeMoodPatterns('habits')}
            disabled={isAnalyzing}
          >
            📅 Daily Habits
          </button>
        </div>
        {isAnalyzing && <p className="status-text">{status}</p>}
      </div>

      <div className="mood-input-section">
        <div className="mood-selector">
          <label>How are you feeling?</label>
          <div className="mood-options">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`mood-btn ${selectedMood === option.value ? 'selected' : ''}`}
                onClick={() => setSelectedMood(option.value)}
              >
                <span className="mood-emoji">{option.emoji}</span>
                <span className="mood-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="energy-slider">
          <label>Energy Level: {energy}/10</label>
          <input
            type="range"
            min="1"
            max="10"
            value={energy}
            onChange={(e) => setEnergy(parseInt(e.target.value))}
          />
        </div>

        <div className="notes-section">
          <label>Notes (optional):</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How was your day? Any thoughts..."
            rows={3}
          />
        </div>

        <div className="activities-section">
          <label>Recent Activities:</label>
          <div className="activity-tags">
            {WELLNESS_ACTIVITIES.map((activity) => (
              <button
                key={activity}
                className={`activity-tag ${activities.includes(activity) ? 'selected' : ''}`}
                onClick={() => toggleActivity(activity)}
              >
                {activity}
              </button>
            ))}
          </div>
        </div>

        <button 
          className="btn btn-primary"
          onClick={saveMood}
          disabled={!selectedMood}
        >
          💾 Save Mood Entry
        </button>
      </div>

      {wellnessSuggestion && (
        <div className="wellness-suggestion">
          <h3>🌟 AI Analysis Result</h3>
          <p>{wellnessSuggestion}</p>
          <button 
            className="btn btn-secondary"
            onClick={speakText}
            disabled={isSpeaking}
          >
            {isSpeaking ? '🔊 Speaking...' : '🔊 Read Aloud'}
          </button>
        </div>
      )}

      <div className="mood-history">
        <h3>Mood History</h3>
        {moodHistory.length === 0 ? (
          <p className="empty-state">No mood entries yet. Start tracking today!</p>
        ) : (
          <div className="history-list">
            {moodHistory.slice(0, 10).map((entry) => (
              <div key={entry.id} className="history-item">
                <span className="history-mood">{getMoodEmoji(entry.mood)}</span>
                <div className="history-details">
                  <span className="history-date">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                  <span className="history-notes">
                    {entry.notes || 'No notes'}
                  </span>
                </div>
                <span className="history-energy">
                  ⚡ {entry.energy}/10
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
