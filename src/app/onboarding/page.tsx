'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ALLERGY_OPTIONS = ['dairy', 'egg', 'nuts', 'gluten']

const field = 'mt-1 w-full rounded border border-gray-300 px-3 py-2'
const label = 'block text-sm font-medium'

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const payload = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, allergies }),
    })

    setBusy(false)
    if (!res.ok) {
      const data = await res.json()
      return setError(data.error ?? 'Could not save your profile')
    }
    router.push('/dashboard')
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">Set up your profile</h1>
      <p className="mt-1 text-sm text-gray-600">
        Six quick questions. We use these to calculate your calorie target.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className={label}>
          Name
          <input name="name" required className={field} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Age
            <input name="age" type="number" required min={10} max={120} className={field} />
          </label>
          <label className={label}>
            Gender
            <select name="gender" required defaultValue="male" className={field}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className={label}>
            Height (cm)
            <input name="heightCm" type="number" step="0.5" required min={80} max={250} className={field} />
          </label>
          <label className={label}>
            Weight (kg)
            <input name="weightKg" type="number" step="0.1" required min={25} max={300} className={field} />
          </label>
        </div>

        <label className={label}>
          Activity level
          <select name="activityLevel" required defaultValue="moderate" className={field}>
            <option value="sedentary">Sedentary — desk job, little exercise</option>
            <option value="light">Light — exercise 1-3 days a week</option>
            <option value="moderate">Moderate — exercise 3-5 days a week</option>
            <option value="active">Active — exercise 6-7 days a week</option>
            <option value="very_active">Very active — physical job or twice daily</option>
          </select>
        </label>

        <label className={label}>
          Goal
          <select name="goal" required defaultValue="general_fitness" className={field}>
            <option value="weight_loss">Weight loss</option>
            <option value="maintenance">Weight maintenance</option>
            <option value="muscle_gain">Muscle gain</option>
            <option value="general_fitness">General fitness</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="self-start text-sm text-gray-600 underline"
        >
          {showOptional ? 'Hide' : 'Show'} optional preferences
        </button>

        {showOptional && (
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
            <label className={label}>
              Experience
              <select name="experience" defaultValue="beginner" className={field}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Workout days per week
                <input name="workoutDays" type="number" min={1} max={7} defaultValue={3} className={field} />
              </label>
              <label className={label}>
                Session length (min)
                <input name="sessionMinutes" type="number" min={15} max={120} defaultValue={45} className={field} />
              </label>
            </div>

            <label className={label}>
              Diet
              <select name="dietaryPreference" defaultValue="non_veg" className={field}>
                <option value="non_veg">No restriction</option>
                <option value="vegetarian">Vegetarian</option>
              </select>
            </label>

            <label className={label}>
              Budget
              <select name="budget" defaultValue="any" className={field}>
                <option value="any">No preference</option>
                <option value="low">Budget-friendly foods only</option>
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Avoid these</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {ALLERGY_OPTIONS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={allergies.includes(a)}
                      onChange={(e) =>
                        setAllergies((prev) =>
                          e.target.checked ? [...prev, a] : prev.filter((x) => x !== a),
                        )
                      }
                    />
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </main>
  )
}
