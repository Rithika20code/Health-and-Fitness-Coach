import { useState, useEffect } from 'react'
import { TextGeneration, ensureLLM } from '../lib/runanywhere'
import { storage, type WorkoutProfile, type GeneratedWorkout } from '../lib/storage'

const FITNESS_LEVELS: WorkoutProfile['fitnessLevel'][] = ['beginner', 'intermediate', 'advanced']

const GOALS = [
  'Weight Loss',
  'Muscle Gain',
  'Endurance',
  'Flexibility',
  'General Fitness',
]

const INJURIES = [
  'None',
  'Knee Issues',
  'Back Pain',
  'Shoulder Injury',
  'Wrist Problems',
]

const EQUIPMENT = [
  'No Equipment',
  'Dumbbells',
  'Resistance Bands',
  'Pull-up Bar',
  'Full Gym',
]

export default function WorkoutGenerator() {
  const [fitnessLevel, setFitnessLevel] = useState<WorkoutProfile['fitnessLevel']>('beginner')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>(['None'])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(['No Equipment'])
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout | null>(null)
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = () => {
    const savedProfile = storage.getWorkoutProfile()
    if (savedProfile) {
      setFitnessLevel(savedProfile.fitnessLevel)
      setSelectedGoals(savedProfile.goals)
      setSelectedInjuries(savedProfile.injuries)
      setSelectedEquipment(savedProfile.equipment)
      setWorkoutHistory(savedProfile.generatedWorkouts)
    }
  }

  const toggleSelection = (item: string, setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelected(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    )
  }

  const saveProfile = () => {
    storage.saveWorkoutProfile({
      fitnessLevel,
      goals: selectedGoals,
      injuries: selectedInjuries,
      equipment: selectedEquipment,
    })
  }

  const generateWorkout = async () => {
    saveProfile()
    setIsGenerating(true)
    setError(null)
    setStatus('Loading AI model...')

    try {
      setStatus('Loading LLM model...')
      await ensureLLM()
      
      setStatus('Generating personalized workout...')
      
      const injuries = selectedInjuries.filter(i => i !== 'None').join(', ') || 'none'
      const equipment = selectedEquipment.join(', ')
      const level = fitnessLevel.charAt(0).toUpperCase() + fitnessLevel.slice(1)
      const goals = selectedGoals.join(', ') || 'general fitness'

      const prompt = `Generate a ${level.toLowerCase()} level workout routine.
Fitness Level: ${level}
Goals: ${goals}
Equipment Available: ${equipment}
Injuries/Limitations: ${injuries}

Provide a JSON response with this exact format:
{
  "focus": "Workout focus name",
  "exercises": [
    {"name": "Exercise name", "sets": number, "reps": "8-12", "rest": "60 seconds", "notes": "optional tip"}
  ]
}

Include 5-7 exercises. Consider the fitness level:
- Beginner: 2-3 sets, 10-15 reps, more rest
- Intermediate: 3-4 sets, 8-12 reps
- Advanced: 4-5 sets, 6-10 reps

For injuries, modify exercises accordingly.
Only output valid JSON, no other text.`

      const result = await TextGeneration.generate(prompt, {
        maxTokens: 500,
        temperature: 0.7,
      })

      let jsonText = result.text.trim()
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      
      if (!jsonMatch) {
        throw new Error('Failed to parse workout')
      }

      const workoutData = JSON.parse(jsonMatch[0])
      
      const workout: Omit<GeneratedWorkout, 'id'> = {
        date: new Date().toISOString(),
        focus: workoutData.focus,
        exercises: workoutData.exercises.map((e: Record<string, unknown>) => ({
          name: String(e.name),
          sets: Number(e.sets),
          reps: String(e.reps),
          rest: String(e.rest),
          notes: e.notes ? String(e.notes) : undefined,
        })),
      }

      const savedWorkout = storage.addGeneratedWorkout(workout)
      setCurrentWorkout(savedWorkout)
      setWorkoutHistory(prev => [savedWorkout, ...prev])
      setStatus('Workout generated!')

    } catch (err) {
      console.error('Generation error:', err)
      setStatus('Generating workout...')
      
      const fallbackWorkout = generateFallbackWorkout(fitnessLevel, selectedGoals, selectedEquipment, selectedInjuries)
      const savedWorkout = storage.addGeneratedWorkout(fallbackWorkout)
      setCurrentWorkout(savedWorkout)
      setWorkoutHistory(prev => [savedWorkout, ...prev])
      setStatus('Workout generated!')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFallbackWorkout = (
    level: WorkoutProfile['fitnessLevel'],
    goals: string[],
    equipment: string[],
    injuries: string[]
  ): Omit<GeneratedWorkout, 'id'> => {
    const hasDumbbells = equipment.includes('Dumbbells')
    const hasBands = equipment.includes('Resistance Bands')
    const hasGym = equipment.includes('Full Gym')
    
    const isBeginner = level === 'beginner'
    const isIntermediate = level === 'intermediate'
    
    const focusOnWeightLoss = goals.includes('Weight Loss')
    const focusOnMuscle = goals.includes('Muscle Gain')
    const focusOnEndurance = goals.includes('Endurance')
    const focusOnFlexibility = goals.includes('Flexibility')
    
    let focus = 'Full Body Workout'
    if (focusOnWeightLoss) focus = 'Fat Loss HIIT'
    else if (focusOnMuscle) focus = 'Strength Training'
    else if (focusOnEndurance) focus = 'Cardio & Endurance'
    else if (focusOnFlexibility) focus = 'Stretching & Flexibility'
    
    const sets = isBeginner ? 3 : isIntermediate ? 4 : 5
    const reps = isBeginner ? '12-15' : isIntermediate ? '10-12' : '8-10'
    const rest = isBeginner ? '90 seconds' : '60 seconds'
    
    const noEquipmentExercises = [
      { name: 'Jumping Jacks', sets, reps: '30 seconds', rest: '15 seconds', notes: 'Warm up exercise' },
      { name: 'Bodyweight Squats', sets, reps, rest, notes: 'Keep chest up, knees over toes' },
      { name: 'Push-ups', sets, reps: isBeginner ? '8-10' : reps, rest, notes: 'Modify on knees if needed' },
      { name: 'Lunges', sets, reps: '10 each leg', rest, notes: 'Step forward, lower back knee' },
      { name: 'Plank', sets, reps: isBeginner ? '20 seconds' : '45 seconds', rest: '30 seconds', notes: 'Keep body straight' },
      { name: 'Mountain Climbers', sets, reps: '20 each leg', rest: '20 seconds', notes: 'Core and cardio' },
      { name: 'Burpees', sets, reps: isBeginner ? '5' : '10', rest, notes: 'Full body explosive' },
    ]
    
    const dumbbellExercises = [
      { name: 'Dumbbell Rows', sets, reps, rest, notes: 'Pull dumbbell to hip' },
      { name: 'Dumbbell Press', sets, reps, rest, notes: 'Lie on bench or floor' },
      { name: 'Dumbbell Curls', sets, reps, rest, notes: 'Bicep isolation' },
      { name: 'Dumbbell Lunges', sets, reps: '10 each leg', rest, notes: 'Hold dumbbells at sides' },
      { name: 'Shoulder Press', sets, reps, rest, notes: 'Overhead press' },
    ]
    
    const gymExercises = [
      { name: 'Bench Press', sets, reps, rest, notes: 'Chest' },
      { name: 'Deadlift', sets, reps, rest, notes: 'Back and legs' },
      { name: 'Lat Pulldown', sets, reps, rest, notes: 'Back' },
      { name: 'Leg Press', sets, reps, rest, notes: 'Legs' },
      { name: 'Cable Rows', sets, reps, rest, notes: 'Core back' },
    ]
    
    let exercises: { name: string; sets: number; reps: string; rest: string; notes?: string }[]
    
    if (hasGym) {
      exercises = gymExercises.slice(0, 6)
    } else if (hasDumbbells && hasBands) {
      exercises = [...dumbbellExercises.slice(0, 3), ...noEquipmentExercises.slice(1, 5)]
    } else if (hasDumbbells) {
      exercises = [...dumbbellExercises.slice(0, 4), noEquipmentExercises[4]]
    } else {
      exercises = noEquipmentExercises
    }
    
    if (injuries.some(i => i !== 'None' && i !== 'None')) {
      exercises = exercises.filter(e => {
        const name = e.name.toLowerCase()
        if (injuries.includes('Knee Issues') && (name.includes('squat') || name.includes('lunge') || name.includes('jump'))) return false
        if (injuries.includes('Back Pain') && (name.includes('deadlift') || name.includes('plank') || name.includes('burpee'))) return false
        if (injuries.includes('Shoulder Injury') && (name.includes('press') || name.includes('push'))) return false
        if (injuries.includes('Wrist Problems') && (name.includes('plank') || name.includes('push'))) return false
        return true
      })
      
      if (exercises.length < 4) {
        exercises.push({ name: 'Walking', sets: 1, reps: '20 minutes', rest: '0', notes: 'Low impact cardio' })
      }
    }
    
    return {
      date: new Date().toISOString(),
      focus,
      exercises,
    }
  }

  const speakWorkout = async () => {
    if (!currentWorkout) return
    
    try {
      let text = `${currentWorkout.focus}. `
      currentWorkout.exercises.forEach((ex, i) => {
        text += `Exercise ${i + 1}: ${ex.name}. ${ex.sets} sets of ${ex.reps}. Rest ${ex.rest}. `
        if (ex.notes) text += `${ex.notes}. `
      })
      
      const { speakText: speak } = await import('../lib/runanywhere')
      await speak(text)
    } catch (err) {
      console.error('TTS error:', err)
    }
  }

  return (
    <div className="workout-generator">
      <div className="feature-header">
        <h2>Personalized Workouts</h2>
        <p>Generate custom workout routines based on your fitness level and goals</p>
      </div>

      <div className="profile-section">
        <h3>Your Profile</h3>
        
        <div className="form-group">
          <label>Fitness Level</label>
          <div className="level-options">
            {FITNESS_LEVELS.map((level) => (
              <button
                key={level}
                className={`level-btn ${fitnessLevel === level ? 'selected' : ''}`}
                onClick={() => setFitnessLevel(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Goals</label>
          <div className="tag-options">
            {GOALS.map((goal) => (
              <button
                key={goal}
                className={`tag-btn ${selectedGoals.includes(goal) ? 'selected' : ''}`}
                onClick={() => toggleSelection(goal, setSelectedGoals)}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Injuries/Limitations</label>
          <div className="tag-options">
            {INJURIES.map((injury) => (
              <button
                key={injury}
                className={`tag-btn ${selectedInjuries.includes(injury) ? 'selected' : ''}`}
                onClick={() => {
                  if (injury === 'None') {
                    setSelectedInjuries(['None'])
                  } else {
                    toggleSelection(injury, setSelectedInjuries)
                    setSelectedInjuries(prev => prev.filter(i => i !== 'None'))
                  }
                }}
              >
                {injury}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Equipment</label>
          <div className="tag-options">
            {EQUIPMENT.map((item) => (
              <button
                key={item}
                className={`tag-btn ${selectedEquipment.includes(item) ? 'selected' : ''}`}
                onClick={() => {
                  if (item === 'No Equipment') {
                    setSelectedEquipment(['No Equipment'])
                  } else {
                    toggleSelection(item, setSelectedEquipment)
                    setSelectedEquipment(prev => prev.filter(i => i !== 'No Equipment'))
                  }
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary generate-btn"
          onClick={generateWorkout}
          disabled={isGenerating}
        >
          {isGenerating ? '🔄 Generating...' : '💪 Generate Workout'}
        </button>

        {status && !error && (
          <p className="status-text">{status}</p>
        )}

        {error && (
          <p className="error-text">{error}</p>
        )}
      </div>

      {currentWorkout && (
        <div className="current-workout">
          <div className="workout-header">
            <h3>{currentWorkout.focus}</h3>
            <button className="btn btn-secondary" onClick={speakWorkout}>
              🔊 Read Aloud
            </button>
          </div>

          <div className="exercises-list">
            {currentWorkout.exercises.map((exercise, index) => (
              <div key={index} className="exercise-card">
                <div className="exercise-number">{index + 1}</div>
                <div className="exercise-details">
                  <h4>{exercise.name}</h4>
                  <div className="exercise-stats">
                    <span>📊 {exercise.sets} sets × {exercise.reps}</span>
                    <span>⏱️ Rest: {exercise.rest}</span>
                  </div>
                  {exercise.notes && (
                    <p className="exercise-notes">{exercise.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workoutHistory.length > 0 && !currentWorkout && (
        <div className="workout-history">
          <h3>Previous Workouts</h3>
          <div className="history-grid">
            {workoutHistory.slice(0, 5).map((workout) => (
              <div 
                key={workout.id} 
                className="history-card"
                onClick={() => setCurrentWorkout(workout)}
              >
                <h4>{workout.focus}</h4>
                <p>{workout.exercises.length} exercises</p>
                <span className="workout-date">
                  {new Date(workout.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
