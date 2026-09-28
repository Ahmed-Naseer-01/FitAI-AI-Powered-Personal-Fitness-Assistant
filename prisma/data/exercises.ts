// MET values follow the Compendium of Physical Activities.
// `formKey` links an exercise to its pose config in src/lib/pose/exercises.ts.
// Only squat and bicep curl have camera form tracking.

export type SeedExercise = {
  name: string
  muscleGroup: 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'fullbody'
  equipment: 'bodyweight' | 'dumbbell' | 'barbell' | 'machine'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  metValue: number
  hasFormTracking: boolean
  formKey?: 'squat' | 'bicep_curl'
  defaultSets: number
  defaultReps: number
  repUnit?: 'reps' | 'seconds'
}

export const EXERCISES: SeedExercise[] = [
  { name: 'Squat', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', metValue: 5.0, hasFormTracking: true, formKey: 'squat', defaultSets: 3, defaultReps: 12 },
  { name: 'Bicep Curl', muscleGroup: 'arms', equipment: 'dumbbell', difficulty: 'beginner', metValue: 3.5, hasFormTracking: true, formKey: 'bicep_curl', defaultSets: 3, defaultReps: 12 },
  { name: 'Push-up', muscleGroup: 'chest', equipment: 'bodyweight', difficulty: 'beginner', metValue: 8.0, hasFormTracking: false, defaultSets: 3, defaultReps: 12 },
  { name: 'Lunge', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', metValue: 5.0, hasFormTracking: false, defaultSets: 3, defaultReps: 10 },
  { name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight', difficulty: 'beginner', metValue: 3.5, hasFormTracking: false, defaultSets: 3, defaultReps: 30, repUnit: 'seconds' },
  { name: 'Glute Bridge', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', metValue: 3.5, hasFormTracking: false, defaultSets: 3, defaultReps: 15 },
  { name: 'Crunch', muscleGroup: 'core', equipment: 'bodyweight', difficulty: 'beginner', metValue: 3.8, hasFormTracking: false, defaultSets: 3, defaultReps: 15 },
  { name: 'Mountain Climber', muscleGroup: 'core', equipment: 'bodyweight', difficulty: 'beginner', metValue: 8.0, hasFormTracking: false, defaultSets: 3, defaultReps: 20 },
  { name: 'Jumping Jack', muscleGroup: 'fullbody', equipment: 'bodyweight', difficulty: 'beginner', metValue: 8.0, hasFormTracking: false, defaultSets: 3, defaultReps: 30 },
  { name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell', difficulty: 'beginner', metValue: 5.0, hasFormTracking: false, defaultSets: 3, defaultReps: 12 },
  { name: 'Shoulder Press', muscleGroup: 'shoulders', equipment: 'dumbbell', difficulty: 'intermediate', metValue: 5.0, hasFormTracking: false, defaultSets: 3, defaultReps: 10 },
  { name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell', difficulty: 'intermediate', metValue: 5.0, hasFormTracking: false, defaultSets: 3, defaultReps: 8 },
  { name: 'Lat Pulldown', muscleGroup: 'back', equipment: 'machine', difficulty: 'intermediate', metValue: 5.0, hasFormTracking: false, defaultSets: 3, defaultReps: 12 },
  { name: 'Burpee', muscleGroup: 'fullbody', equipment: 'bodyweight', difficulty: 'intermediate', metValue: 8.0, hasFormTracking: false, defaultSets: 3, defaultReps: 10 },
  { name: 'Deadlift', muscleGroup: 'back', equipment: 'barbell', difficulty: 'advanced', metValue: 6.0, hasFormTracking: false, defaultSets: 3, defaultReps: 6 },
]
