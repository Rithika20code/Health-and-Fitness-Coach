export interface MoodEntry {
  id: string
  date: string
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible'
  energy: number
  notes: string
  activities: string[]
}

export interface UserProfile {
  name: string
  age: number
  weight: number
  height: number
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
}

export interface MealEntry {
  id: string
  date: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  imageUrl?: string
  analysis?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface WorkoutProfile {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  injuries: string[]
  equipment: string[]
  generatedWorkouts: GeneratedWorkout[]
}

export interface GeneratedWorkout {
  id: string
  date: string
  focus: string
  exercises: Exercise[]
}

export interface Exercise {
  name: string
  sets: number
  reps: string
  rest: string
  notes?: string
}

const STORAGE_KEYS = {
  MOOD: 'healthtracker_mood',
  MEALS: 'healthtracker_meals',
  WORKOUT_PROFILE: 'healthtracker_workout',
  USER_PROFILE: 'healthtracker_user',
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const storage = {
  getMoodEntries(): MoodEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.MOOD)
    return data ? JSON.parse(data) : []
  },

  saveMoodEntry(entry: Omit<MoodEntry, 'id'>): MoodEntry {
    const entries = this.getMoodEntries()
    const newEntry: MoodEntry = { ...entry, id: generateId() }
    entries.unshift(newEntry)
    localStorage.setItem(STORAGE_KEYS.MOOD, JSON.stringify(entries))
    return newEntry
  },

  getMealEntries(): MealEntry[] {
    const data = localStorage.getItem(STORAGE_KEYS.MEALS)
    return data ? JSON.parse(data) : []
  },

  saveMealEntry(entry: Omit<MealEntry, 'id'>): MealEntry {
    const entries = this.getMealEntries()
    const newEntry: MealEntry = { ...entry, id: generateId() }
    entries.unshift(newEntry)
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(entries))
    return newEntry
  },

  getWorkoutProfile(): WorkoutProfile | null {
    const data = localStorage.getItem(STORAGE_KEYS.WORKOUT_PROFILE)
    return data ? JSON.parse(data) : null
  },

  saveWorkoutProfile(profile: Omit<WorkoutProfile, 'generatedWorkouts'>): WorkoutProfile {
    const existing = this.getWorkoutProfile()
    const fullProfile: WorkoutProfile = {
      ...existing,
      ...profile,
      generatedWorkouts: existing?.generatedWorkouts || [],
    }
    localStorage.setItem(STORAGE_KEYS.WORKOUT_PROFILE, JSON.stringify(fullProfile))
    return fullProfile
  },

  addGeneratedWorkout(workout: Omit<GeneratedWorkout, 'id'>): GeneratedWorkout {
    const profile = this.getWorkoutProfile()
    if (!profile) throw new Error('No workout profile found')
    
    const newWorkout: GeneratedWorkout = { ...workout, id: generateId() }
    profile.generatedWorkouts.unshift(newWorkout)
    localStorage.setItem(STORAGE_KEYS.WORKOUT_PROFILE, JSON.stringify(profile))
    return newWorkout
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.MOOD)
    localStorage.removeItem(STORAGE_KEYS.MEALS)
    localStorage.removeItem(STORAGE_KEYS.WORKOUT_PROFILE)
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
  },

  getUserProfile(): UserProfile | null {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    return data ? JSON.parse(data) : null
  },

  saveUserProfile(profile: UserProfile): UserProfile {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
    return profile
  },
}
