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
import { Button, Card, CardBody, Field, Notice, Select, Spinner, cn } from '@/components/ui'
import { IconCamera } from '@/components/ui/icons'

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
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Field label="Exercise">
            {(p) => (
              <Select
                {...p}
                value={exercise}
                disabled={status === 'running' || status === 'saving'}
                onChange={(e) => setExercise(e.target.value as ExerciseKey)}
              >
                {Object.values(EXERCISE_CONFIGS).map((c) => (
                  <option key={c.key} value={c.key}>{c.displayName}</option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex gap-2.5 rounded-[var(--radius-control)] bg-accent-soft px-3.5 py-3">
            <IconCamera className="mt-0.5 size-4 shrink-0 text-accent-soft-fg" />
            <p className="text-sm leading-relaxed text-accent-soft-fg">{cfg.setupHint}</p>
          </div>
        </CardBody>
      </Card>

      {error && <Notice tone="danger">{error}</Notice>}

      {/* Video stage */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink-950 shadow-[var(--shadow-lg)]">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-white">
              <Spinner className="size-6" />
              <p className="text-sm font-medium">Loading pose model…</p>
              <p className="text-xs text-white/60">About 5 MB, first time only</p>
            </div>
          </div>
        )}

        {/* Live rep counter floats over the video while a session runs */}
        {status === 'running' && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-ink-950/70 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="tabular text-xl font-bold leading-none text-white">{reps}</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-white/70">
              reps
            </span>
          </div>
        )}

        {status === 'running' && lastRepGood !== null && (
          <div
            key={reps}
            className={cn(
              'animate-scale-in pointer-events-none absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold',
              lastRepGood ? 'bg-success text-white' : 'bg-warning text-white',
            )}
          >
            {lastRepGood ? 'CORRECT' : 'NEEDS WORK'}
          </div>
        )}

        {status !== 'loading' && status !== 'idle' && !inFrame && (
          <div className="absolute inset-x-0 bottom-0 bg-warning px-3 py-2.5 text-center text-sm font-medium text-white">
            Step back into frame
          </div>
        )}
      </div>

      {status === 'running' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card><CardBody className="p-3.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-fg-subtle">Correct</p>
              <p className="tabular mt-1 text-2xl font-bold text-success">{correct}</p>
            </CardBody></Card>
            <Card><CardBody className="p-3.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-fg-subtle">Needs work</p>
              <p className="tabular mt-1 text-2xl font-bold text-warning">{incorrect}</p>
            </CardBody></Card>
            <Card><CardBody className="p-3.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-fg-subtle">Score</p>
              <p className="tabular mt-1 text-2xl font-bold text-fg">{score}</p>
            </CardBody></Card>
          </div>

          <p
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-card)] bg-ink-900 px-5 py-4 text-center text-lg font-semibold text-white dark:bg-surface-raised dark:text-fg"
          >
            {feedback}
          </p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {status !== 'running' && status !== 'done' && (
          <Button size="lg" onClick={start} disabled={!canStart || status !== 'ready'} className="w-full sm:w-auto">
            {status === 'loading'
              ? 'Loading…'
              : canStart
                ? 'Start session'
                : 'Get fully in frame to start'}
          </Button>
        )}

        {status === 'running' && (
          <Button size="lg" onClick={finish} className="w-full sm:w-auto">
            Finish and save
          </Button>
        )}

        {status === 'saving' && (
          <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> Saving…</p>
        )}

        {status === 'done' && (
          <Card className="animate-scale-in w-full border-success/30 bg-success-soft">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-success">Session saved</p>
                <p className="tabular mt-0.5 text-sm text-fg-muted">
                  {correct} correct · {incorrect} needing work · form score {score}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setStatus('ready')}>
                Start another
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      <p className="text-xs leading-relaxed text-fg-subtle">
        Video is processed entirely in your browser and is never uploaded. Only the rep counts and
        form score are saved.
      </p>
    </div>
  )
}
