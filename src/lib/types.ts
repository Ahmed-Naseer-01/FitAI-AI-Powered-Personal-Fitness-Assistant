import { z } from 'zod'

// SQLite has no enum type, so these unions are enforced in application code.

export const GENDERS = ['male', 'female'] as const
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const
export const GOALS = ['weight_loss', 'maintenance', 'muscle_gain', 'general_fitness'] as const
export const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const
export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const
export const DIETARY_PREFERENCES = ['non_veg', 'vegetarian'] as const
export const BUDGETS = ['any', 'low'] as const

export type Gender = (typeof GENDERS)[number]
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]
export type Goal = (typeof GOALS)[number]
export type Experience = (typeof EXPERIENCES)[number]
export type MealSlot = (typeof MEAL_SLOTS)[number]
export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number]
export type Budget = (typeof BUDGETS)[number]

export const zGender = z.enum(GENDERS)
export const zActivityLevel = z.enum(ACTIVITY_LEVELS)
export const zGoal = z.enum(GOALS)
export const zExperience = z.enum(EXPERIENCES)
export const zMealSlot = z.enum(MEAL_SLOTS)
export const zDietaryPreference = z.enum(DIETARY_PREFERENCES)
export const zBudget = z.enum(BUDGETS)
