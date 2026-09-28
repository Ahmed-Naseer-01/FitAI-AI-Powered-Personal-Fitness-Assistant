'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { Ema } from '@/lib/pose/smoother'
import { RepMachine } from '@/lib/pose/repMachine'
import {
  EXERCISE_CONFIGS, allVisible, emptyStats, worstViolation,
  type ExerciseKey, type RepStats,
} from '@/lib/pose/exercises'
import type { Pt } from '@/lib/pose/angles'

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_PATH = '/models/pose_landmarker_lite.task'

// Drawn connections between landmarks, for the skeleton overlay.
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
]

type Status = 'idle' | 'loading' | 'ready' | 'running' | 'saving' | 'done'

export default function PoseTrainer({ initialExercise }: { initialExercise: ExerciseKey }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const machineRef = useRef<RepMachine | null>(null)
  const emaRef = useRef(new Ema(0.3))
  const statsRef = useRef<RepStats>(emptyStats())
  const startedAtRef = useRef(0)
  const visibleSinceRef = useRef<number | null>(null)
  const exerciseRef = useRef<ExerciseKey>(initialExercise)

  const [exercise, setExercise] = useState<ExerciseKey>(initialExercise)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [inFrame, setInFrame] = useState(false)
  const [canStart, setCanStart] = useState(false)
  const [reps, setReps] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [incorrect, setIncorrect] = useState(0)
  const [feedback, setFeedback] = useState('Get into position')
  const [lastRepGood, setLastRepGood] = useState<boolean | null>(null)
  const [faults, setFaults] = useState<Record<string, number>>({})

  // Keep the ref in step so the animation loop always reads the current one.
  useEffect(() => {
    exerciseRef.current = exercise
  }, [exercise])

  const cfg = EXERCISE_CONFIGS[exercise]

  /** One frame of the pipeline — mirrors lib/pose/pipeline.test.ts exactly. */
  const onFrame = useCallback((result: PoseLandmarkerResult) => {
    const active = EXERCISE_CONFIGS[exerciseRef.current]
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = result.landmarks?.[0] as Pt[] | undefined

    if (!landmarks || !allVisible(landmarks, active.required)) {
      setInFrame(false)
      setCanStart(false)
      visibleSinceRef.current = null
      return // freeze the state machine; the count is retained
    }

    setInFrame(true)
    if (visibleSinceRef.current === null) visibleSinceRef.current = performance.now()
    // Gate Start on one continuous second of full visibility.
    setCanStart(performance.now() - visibleSinceRef.current > 1000)

    // Skeleton overlay.
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 3
    for (const [a, b] of BONES) {
      const pa = landmarks[a]
      const pb = landmarks[b]
      if (!pa || !pb) continue
      ctx.beginPath()
      ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height)
      ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height)
      ctx.stroke()
    }
    ctx.fillStyle = '#16a34a'
    for (const i of active.required) {
      const p = landmarks[i]
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (machineRef.current === null) return // not counting yet

    const smoothed = emaRef.current.push(active.primaryAngle(landmarks))
    statsRef.current = active.observe(landmarks, statsRef.current)
    const tick = machineRef.current.update(smoothed)

    if (tick.enteredBottom) statsRef.current = active.observe(landmarks, emptyStats())

    if (tick.repCompleted) {
      const violation = worstViolation(statsRef.current, active.rules)
      if (violation) {
        setIncorrect((n) => n + 1)
        setFeedback(violation.message)
        setLastRepGood(false)
        setFaults((f) => ({ ...f, [violation.id]: (f[violation.id] ?? 0) + 1 }))
      } else {
        setCorrect((n) => n + 1)
        setFeedback('Good repetition')
        setLastRepGood(true)
      }
      setReps(machineRef.current.reps)
      statsRef.current = emptyStats()
    }
  }, [])

  // Camera and model setup.
  useEffect(() => {
    let cancelled = false

    async function boot() {
      setStatus('loading')
      setError(null)
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) return
        landmarkerRef.current = landmarker

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        // Held in a ref of its own: on unmount React nulls videoRef before
        // cleanup runs, which previously left the camera on.
        streamRef.current = stream

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        video.srcObject = stream
        await video.play()
        setStatus('ready')

        const loop = () => {
          const v = videoRef.current
          const l = landmarkerRef.current
          if (v && l && v.readyState >= 2) {
            onFrame(l.detectForVideo(v, performance.now()))
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        const denied = /permission|denied|notallowed/i.test(message)
        setError(
          denied
            ? 'Camera permission was denied. Allow camera access and reload, or tick this exercise off on the workout page instead.'
            : `Could not start the camera: ${message}`,
        )
        setStatus('idle')
      }
    }

    boot()

    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [onFrame])

  function start() {
    const active = EXERCISE_CONFIGS[exerciseRef.current]
    machineRef.current = new RepMachine({
      enterBottom: active.enterBottom,
      enterTop: active.enterTop,
    })
    emaRef.current.reset()
    statsRef.current = emptyStats()
    startedAtRef.current = performance.now()
    setReps(0)
    setCorrect(0)
    setIncorrect(0)
    setFaults({})
    setLastRepGood(null)
    setFeedback('Begin when ready')
    setStatus('running')
  }

  async function finish() {
    setStatus('saving')
    const durationSec = Math.max(1, Math.round((performance.now() - startedAtRef.current) / 1000))
    const total = correct + incorrect
    const avgFormScore = total === 0 ? 0 : Math.round((correct / total) * 100)

    await fetch('/api/form-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formKey: exerciseRef.current,
        durationSec,
        correctReps: correct,
        incorrectReps: incorrect,
        avgFormScore,
        feedbackTags: Object.keys(faults),
      }),
    })

    machineRef.current = null
    setStatus('done')
    router.refresh()
  }

  const total = correct + incorrect
  const score = total === 0 ? 0 : Math.round((correct / total) * 100)

  return (
    <div className="flex flex-col gap-4">
      <label className="text-sm font-medium">
        Exercise
        <select
          value={exercise}
          disabled={status === 'running' || status === 'saving'}
          onChange={(e) => setExercise(e.target.value as ExerciseKey)}
          className="mt-1 block rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
        >
          {Object.values(EXERCISE_CONFIGS).map((c) => (
            <option key={c.key} value={c.key}>
              {c.displayName}
            </option>
          ))}
        </select>
      </label>

      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{cfg.setupHint}</p>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="w-full" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white">
            Loading pose model…
          </div>
        )}

        {status !== 'loading' && status !== 'idle' && !inFrame && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-500 p-2 text-center text-sm font-medium text-white">
            Step back into frame
          </div>
        )}
      </div>

      {status === 'running' && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">Reps</div>
              <div className="text-3xl font-bold">{reps}</div>
            </div>
            <div
              className={`rounded-lg p-3 ${
                lastRepGood === null
                  ? 'border border-gray-200'
                  : lastRepGood
                    ? 'bg-green-100'
                    : 'bg-amber-100'
              }`}
            >
              <div className="text-xs uppercase text-gray-500">Last rep</div>
              <div className="text-lg font-semibold">
                {lastRepGood === null ? '—' : lastRepGood ? 'CORRECT' : 'NEEDS WORK'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">Form score</div>
              <div className="text-3xl font-bold">{score}</div>
            </div>
          </div>

          <p className="rounded-lg bg-gray-900 p-4 text-center text-lg font-medium text-white">
            {feedback}
          </p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status !== 'running' && status !== 'done' && (
          <button
            onClick={start}
            disabled={!canStart || status !== 'ready'}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
          >
            {status === 'loading'
              ? 'Loading…'
              : canStart
                ? 'Start session'
                : 'Get fully in frame to start'}
          </button>
        )}

        {status === 'running' && (
          <button onClick={finish} className="rounded bg-black px-4 py-2 text-white">
            Finish and save
          </button>
        )}

        {status === 'saving' && <p className="text-sm text-gray-500">Saving…</p>}

        {status === 'done' && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
            Saved — {correct} correct, {incorrect} needing work, form score {score}.
            <button onClick={() => setStatus('ready')} className="ml-3 underline">
              Start another
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Video is processed entirely in your browser and is never uploaded. Only the rep counts and
        form score are saved.
      </p>
    </div>
  )
}
