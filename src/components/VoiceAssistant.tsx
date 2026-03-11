import { useState, useRef, useEffect, useCallback } from 'react'
import { TextGeneration, speakText, ensureLLM } from '../lib/runanywhere'
import { storage, type MoodEntry, type WorkoutProfile, type GeneratedWorkout } from '../lib/storage'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
      isFinal: boolean
    }
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

const VOICE_COMMANDS = {
  nutrition: ['analyze', 'meal', 'food', 'nutrition', 'calories', 'protein', 'carbs', 'fat', 'eating', 'breakfast', 'lunch', 'dinner'],
  mood: ['mood', 'feeling', 'stressed', 'happy', 'sad', 'emotional', 'mental health', 'wellness'],
  workout: ['workout', 'exercise', 'training', 'fitness', 'cardio', 'strength', 'stretch'],
  voice: ['log', 'add', 'what should i do', 'give me', 'create', 'suggest', 'recommend'],
  productivity: ['productivity', 'focus', 'routine', 'daily', 'work session', 'break'],
}

export default function VoiceAssistant() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcribedText, setTranscribedText] = useState('')
  const [useVoice, setUseVoice] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'
      
      recognitionRef.current.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setTranscribedText(transcript)
        if (event.results[0].isFinal) {
          setInput(transcript)
          setIsListening(false)
        }
      }
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscribedText('')
      setIsListening(true)
      try {
        recognitionRef.current.start()
      } catch (err) {
        console.error('Failed to start recognition:', err)
        setIsListening(false)
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date()
    }])
  }

  const detectIntent = (text: string): string => {
    const lower = text.toLowerCase()
    
    if (VOICE_COMMANDS.nutrition.some(w => lower.includes(w))) return 'nutrition_analysis'
    if (VOICE_COMMANDS.workout.some(w => lower.includes(w))) return 'workout_generate'
    if (VOICE_COMMANDS.mood.some(w => lower.includes(w)) && (lower.includes('log') || lower.includes('add') || lower.includes('feeling') || lower.includes('mood'))) return 'mood_log'
    if (VOICE_COMMANDS.mood.some(w => lower.includes(w))) return 'wellness_suggestion'
    if (lower.includes('summary') || lower.includes('week') || lower.includes('activity')) return 'summary'
    if (VOICE_COMMANDS.productivity.some(w => lower.includes(w))) return 'productivity'
    if (VOICE_COMMANDS.voice.some(w => lower.includes(w))) return 'voice_command'
    
    return 'general'
  }

  const processCommand = async (text: string): Promise<string> => {
    await ensureLLM()
    
    const intent = detectIntent(text)

    switch (intent) {
      case 'nutrition_analysis':
        return await handleNutritionQuery(text)
      case 'mood_log':
        return await handleMoodLog(text)
      case 'wellness_suggestion':
        return await handleWellnessSuggestion(text)
      case 'workout_generate':
        return await handleWorkoutGeneration(text)
      case 'summary':
        return await handleSummary()
      case 'productivity':
        return await handleProductivity(text)
      case 'voice_command':
        return await handleVoiceCommand(text)
      default:
        return await handleGeneralQuery(text)
    }
  }

  const handleNutritionQuery = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()
    const meals = storage.getMealEntries()
    const recentMeal = meals[0]

    let prompt = ''
    if (lower.includes('analyze') || lower.includes('break down') || lower.includes('nutritional')) {
      prompt = `You are a nutrition expert. The user wants nutritional analysis. `
      if (recentMeal) {
        prompt += `Their most recent logged meal had ${recentMeal.calories} calories, ${recentMeal.protein}g protein, ${recentMeal.carbs}g carbs, and ${recentMeal.fat}g fat. `
      }
      prompt += `Provide a detailed nutritional breakdown and suggestions for improvement. Keep it under 100 words.`
    } else if (lower.includes('identify') || lower.includes('food items')) {
      prompt = `You are a nutrition expert. Analyze the food items in the meal and suggest healthier alternatives if needed. Keep it under 80 words.`
    } else if (lower.includes('weight loss')) {
      prompt = `You are a nutrition expert. Based on the meal information, tell if it supports a weight loss diet. Provide suggestions if needed. Keep under 60 words.`
    } else if (lower.includes('muscle') || lower.includes('build muscle')) {
      prompt = `You are a nutrition expert. Tell if this meal is balanced for muscle building. Suggest improvements if needed. Keep under 60 words.`
    } else {
      prompt = `You are a nutrition expert. Answer the user's nutrition question: "${text}". Keep it helpful and under 80 words.`
    }

    try {
      const result = await TextGeneration.generate(prompt, { maxTokens: 200, temperature: 0.7 })
      return result.text.trim()
    } catch (err) {
      return 'I need to analyze a meal photo first. Please upload a meal photo in the Meal Analysis tab, then I can provide insights.'
    }
  }

  const handleMoodLog = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()
    let mood: MoodEntry['mood'] = 'okay'
    let energy = 5

    if (lower.includes('happy') || lower.includes('great') || lower.includes('good')) {
      mood = 'good'
      energy = 8
    } else if (lower.includes('sad') || lower.includes('terrible')) {
      mood = 'bad'
      energy = 3
    } else if (lower.includes('stressed') || lower.includes('anxious')) {
      mood = 'okay'
      energy = 4
    }

    const activities: string[] = []
    if (lower.includes('exercise') || lower.includes('worked out')) activities.push('Exercise')
    if (lower.includes('meditat')) activities.push('Meditation')
    if (lower.includes('walk')) activities.push('Walking')

    storage.saveMoodEntry({
      date: new Date().toISOString(),
      mood,
      energy,
      notes: text,
      activities
    })

    return `I've logged your mood as ${mood} with energy level ${energy}/10. Would you like me to suggest some wellness activities?`
  }

  const handleWellnessSuggestion = async (text: string): Promise<string> => {
    const moods = storage.getMoodEntries()
    const recentMoods = moods.slice(0, 7)
    const moodSummary = recentMoods.map(m => m.mood).join(', ')

    const lower = text.toLowerCase()
    let prompt = ''
    
    if (lower.includes('stressed')) {
      prompt = `The user is feeling stressed. Based on their recent mood patterns (${moodSummary || 'no data'}), recommend: 1) A short relaxation routine 2) Daily habits for emotional balance 3) Quick stress relief techniques. Keep response under 100 words.`
    } else if (lower.includes('trigger')) {
      prompt = `Analyze possible mood triggers based on these recent mood entries: ${moodSummary || 'Not enough data yet'}. Also suggest activities to improve mental health. Keep under 80 words.`
    } else if (lower.includes('relaxation') || lower.includes('relax')) {
      prompt = `Recommend a short relaxation routine based on current mood: ${moodSummary || 'neutral'}. Include breathing exercises and simple activities. Keep under 60 words.`
    } else if (lower.includes('habit') || lower.includes('balance')) {
      prompt = `Suggest daily habits to maintain emotional balance based on recent moods: ${moodSummary || 'no data'}. Keep suggestions practical and under 80 words.`
    } else {
      prompt = `Based on mood patterns: ${moodSummary || 'no data yet'}, suggest wellness activities to improve mental health. Keep under 80 words.`
    }

    try {
      const result = await TextGeneration.generate(prompt, { maxTokens: 200, temperature: 0.8 })
      return result.text.trim()
    } catch (err) {
      const activities = ['Deep breathing exercises', '10-minute meditation', 'Short walk outside', 'Journal your thoughts']
      return `Here are some wellness activities: ${activities.join(', ')}. Take care of yourself!`
    }
  }

  const handleWorkoutGeneration = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()
    let level: WorkoutProfile['fitnessLevel'] = 'beginner'
    let focus = 'general fitness'
    let duration = '20'

    if (lower.includes('intermediate') || lower.includes('advanced')) {
      level = 'intermediate'
    }
    if (lower.includes('advanced')) {
      level = 'advanced'
    }
    if (lower.includes('fat loss') || lower.includes('weight loss')) {
      focus = 'Fat Loss'
    } else if (lower.includes('muscle') || lower.includes('strength')) {
      focus = 'Strength Training'
    } else if (lower.includes('cardio')) {
      focus = 'Cardio'
    } else if (lower.includes('stretch')) {
      focus = 'Stretching'
    }

    if (lower.includes('20 minute')) duration = '20'
    if (lower.includes('30 minute')) duration = '30'
    if (lower.includes('3 day') || lower.includes('3 days')) {
      return generateWeeklyWorkout(level, focus)
    }

    try {
      const prompt = `Generate a ${duration}-minute ${level} level workout for ${focus}. 
Equipment: No equipment mentioned, assume bodyweight.
Provide JSON with: {"focus": "name", "exercises": [{"name": "exercise", "sets": number, "reps": "X-Y", "rest": "X seconds"}]}
Include 4-6 exercises. Only output valid JSON.`

      const result = await TextGeneration.generate(prompt, { maxTokens: 400, temperature: 0.7 })
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const workoutData = JSON.parse(jsonMatch[0])
        const workout: Omit<GeneratedWorkout, 'id'> = {
          date: new Date().toISOString(),
          focus: workoutData.focus,
          exercises: workoutData.exercises.map((e: any) => ({
            name: e.name,
            sets: Number(e.sets),
            reps: e.reps,
            rest: e.rest
          }))
        }
        storage.addGeneratedWorkout(workout)

        let response = `Here's your ${workoutData.focus} workout:\n\n`
        workoutData.exercises.forEach((e: any, i: number) => {
          response += `${i + 1}. ${e.name}: ${e.sets} sets × ${e.reps}, rest ${e.rest}\n`
        })
        return response
      }
      return 'I generated a workout but had trouble formatting it. Try the Workouts tab for full details.'
    } catch (err) {
      return 'I need more specific details. Please set your fitness level in the Workouts tab, then I can generate a personalized routine.'
    }
  }

  const generateWeeklyWorkout = async (level: WorkoutProfile['fitnessLevel'], focus: string): Promise<string> => {
    try {
      const prompt = `Generate a weekly workout plan for ${level} level focusing on ${focus}. 
3 days per week.
Provide a brief summary of each day's workout focus. Keep under 100 words total.`

      const result = await TextGeneration.generate(prompt, { maxTokens: 300, temperature: 0.7 })
      
      const profile = storage.getWorkoutProfile()
      storage.saveWorkoutProfile({
        fitnessLevel: level,
        goals: [focus],
        injuries: profile?.injuries || ['None'],
        equipment: profile?.equipment || ['No Equipment']
      })

      return result.text.trim()
    } catch (err) {
      return `Here's a sample 3-day weekly plan for ${level} level:\n\nDay 1: Full Body (push, pull, legs)\nDay 2: Rest or Light Cardio\nDay 3: Upper Body Strength\nDay 4: Rest\nDay 5: Lower Body + Core\nDay 6-7: Rest`
    }
  }

  const handleSummary = async (): Promise<string> => {
    const meals = storage.getMealEntries()
    const moods = storage.getMoodEntries()
    const profile = storage.getWorkoutProfile()
    const workouts = profile?.generatedWorkouts || []

    const weekMeals = meals.filter(m => new Date(m.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const weekMoods = moods.filter(m => new Date(m.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

    const avgCalories = weekMeals.length > 0 
      ? Math.round(weekMeals.reduce((sum, m) => sum + (m.calories || 0), 0) / weekMeals.length)
      : 0

    const moodCounts = weekMoods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    let response = `📊 Your Weekly Health Summary:\n\n`
    response += `🍎 Nutrition: ${weekMeals.length} meals logged, avg ${avgCalories} cal/day\n`
    response += `😊 Mood: ${weekMoods.length} entries, mostly ${Object.keys(moodCounts)[0] || 'neutral'}\n`
    response += `💪 Workouts: ${workouts.length} generated this week`

    return response
  }

  const handleProductivity = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()
    let prompt = ''

    if (lower.includes('routine') || lower.includes('daily')) {
      prompt = `Create a healthy daily routine for maximum productivity. Include exercise, work blocks, meals, and rest. Keep it practical and under 100 words.`
    } else if (lower.includes('break')) {
      prompt = `Suggest break activities during long work sessions that are healthy and refreshing. Include quick exercises, mental activities, and rest. Keep under 60 words.`
    } else {
      prompt = `Answer: "${text}". Focus on staying focused while maintaining good health habits. Keep under 80 words.`
    }

    try {
      const result = await TextGeneration.generate(prompt, { maxTokens: 200, temperature: 0.7 })
      return result.text.trim()
    } catch (err) {
      return 'Here are some tips: Take regular breaks every 25-30 minutes, stay hydrated, do quick stretches, and maintain a consistent sleep schedule.'
    }
  }

  const handleVoiceCommand = async (text: string): Promise<string> => {
    const lower = text.toLowerCase()

    if (lower.includes('log my mood') || lower.includes('add my mood')) {
      return await handleMoodLog(lower.replace('log my mood', '').replace('add my mood', '').trim() || 'feeling okay')
    }
    if (lower.includes("what workout") || lower.includes("should i do")) {
      return await handleWorkoutGeneration('generate a workout')
    }
    if (lower.includes('meditation') || lower.includes('meditate')) {
      return 'Try this: Sit comfortably, close eyes, breathe deeply for 4 counts, hold for 4, exhale for 4. Repeat 5 times. This takes about 2 minutes.'
    }
    if (lower.includes('summarize') || lower.includes('summary')) {
      return await handleSummary()
    }

    return await handleGeneralQuery(text)
  }

  const handleGeneralQuery = async (text: string): Promise<string> => {
    try {
      const prompt = `You are a helpful health and wellness assistant. The user asks: "${text}". Provide a helpful, concise answer related to health, nutrition, fitness, or wellness. Keep under 80 words.`
      const result = await TextGeneration.generate(prompt, { maxTokens: 150, temperature: 0.7 })
      return result.text.trim()
    } catch (err) {
      return "I'm here to help with your health journey! Ask me about nutrition, mood tracking, workouts, or general wellness."
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userInput = input.trim()
    setInput('')
    addMessage('user', userInput)
    setIsProcessing(true)

    try {
      const response = await processCommand(userInput)
      addMessage('assistant', response)

      if (useVoice) {
        await speakResponse(response)
      }
    } catch (err) {
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = async (text: string) => {
    try {
      await speakText(text)
    } catch (err) {
      console.error('TTS error:', err)
    }
  }

  const handleSTT = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const quickActions = [
    { label: 'Analyze Meal', icon: '🍎', cmd: 'Analyze this meal photo and estimate calories, protein, carbs, and fats.' },
    { label: 'Log Mood', icon: '😊', cmd: 'Log my mood as happy today' },
    { label: 'Get Workout', icon: '💪', cmd: 'Generate a 20-minute home workout with no equipment' },
    { label: 'Wellness Tips', icon: '🧘', cmd: 'I\'ve been feeling stressed. What wellness activities do you recommend?' },
    { label: 'Weekly Summary', icon: '📊', cmd: 'Summarize my health activity for the week' },
    { label: 'Daily Routine', icon: '📅', cmd: 'Suggest a healthy daily routine for productivity' },
  ]

  return (
    <div className="voice-assistant">
      <div className="feature-header">
        <h2>AI Health Assistant</h2>
        <p>Ask me anything about nutrition, mood, workouts, or wellness</p>
      </div>

      <div className="quick-actions">
        {quickActions.map((action, i) => (
          <button
            key={i}
            className="quick-action-btn"
            onClick={() => setInput(action.cmd)}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <div className="chat-container">
        <div className="messages-list">
          {messages.length === 0 && (
            <div className="welcome-message">
              <p>👋 Hi! I'm your AI Health Assistant.</p>
              <p>Try these commands:</p>
              <ul>
                <li>"Analyze this meal photo and estimate calories"</li>
                <li>"Log my mood as happy today"</li>
                <li>"Generate a beginner workout plan"</li>
                <li>"I've been stressed, suggest activities"</li>
                <li>"Summarize my health activity for the week"</li>
                <li>"Suggest a healthy daily routine"</li>
              </ul>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-area">
          <div className="input-controls">
            <button
              type="button"
              className={`voice-btn ${isListening ? 'recording' : ''}`}
              onClick={handleSTT}
              title="Voice input"
            >
              {isListening ? '⏹️' : '🎤'}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isProcessing}
            />
            <button
              type="button"
              className={`speak-btn ${useVoice ? 'active' : ''}`}
              onClick={() => setUseVoice(!useVoice)}
              title="Auto-speak responses"
            >
              🔊
            </button>
            <button type="submit" disabled={!input.trim() || isProcessing}>
              {isProcessing ? '⏳' : '➤'}
            </button>
          </div>
          {transcribedText && (
            <p className="transcribed">{transcribedText}</p>
          )}
        </form>
      </div>
    </div>
  )
}
