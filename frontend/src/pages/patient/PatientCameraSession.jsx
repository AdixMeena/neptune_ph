import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PatientApprovalGate from '../../components/PatientApprovalGate.jsx'
import { supabase } from '../../lib/supabase.js'

const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24],
  [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32],
]

// ── Voice helper ─────────────────────────────────────────────────────────────
// Uses browser built-in Web Speech API — no API key, completely free
function speak(text, { rate = 0.95, pitch = 1.0, volume = 1.0 } = {}) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()  // stop anything currently speaking
  const utterance    = new SpeechSynthesisUtterance(text)
  utterance.rate     = rate
  utterance.pitch    = pitch
  utterance.volume   = volume
  utterance.lang     = 'en-US'
  window.speechSynthesis.speak(utterance)
}

export default function PatientCameraSession() {
  const { id }     = useParams()
  const navigate   = useNavigate()

  const [exerciseName, setExerciseName] = useState('Exercise')
  const [feedback,     setFeedback]     = useState('Initializing...')
  const [landmarks,    setLandmarks]    = useState([])
  const [reps,         setReps]         = useState(0)
  const [score,        setScore]        = useState(0)
  const [timer,        setTimer]        = useState(0)
  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzingMsg, setAnalyzingMsg] = useState('')

  const videoRef         = useRef(null)
  const overlayRef       = useRef(null)
  const captureRef       = useRef(null)
  const wsRef            = useRef(null)
  const sendTimerRef     = useRef(null)
  const sessionIdRef     = useRef(`${Date.now()}`)
  const jointScoresRef   = useRef({})
  const scoreRef         = useRef(0)
  const repsRef          = useRef(0)
  const timerRef         = useRef(0)
  const lastFeedbackRef  = useRef('')       // track last spoken feedback
  const feedbackTimerRef = useRef(null)     // cooldown timer for voice feedback
  const voiceIntroSaid   = useRef(false)    // only say intro once

  // Keep refs in sync
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { repsRef.current  = reps  }, [reps])
  useEffect(() => { timerRef.current = timer }, [timer])

  // Load exercise name
  useEffect(() => {
    let isMounted = true
    async function loadExercise() {
      const { data } = await supabase
        .from('exercises')
        .select('name')
        .eq('id', Number(id))
        .maybeSingle()
      if (isMounted && data?.name) setExerciseName(data.name)
    }
    loadExercise()
    return () => { isMounted = false }
  }, [id])

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setTimer(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Camera init
  useEffect(() => {
    let isMounted = true
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (!isMounted) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        setFeedback('Camera access denied')
      }
    }
    initCamera()
    return () => {
      isMounted = false
      window.speechSynthesis?.cancel()
      const stream = videoRef.current?.srcObject
      if (stream?.getTracks) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  // WebSocket — receives landmarks, scores, feedback, and voice_intro from backend
  useEffect(() => {
    const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const ws     = new WebSocket(`${wsBase}/ws/session/${sessionIdRef.current}?exercise_id=${id}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (Array.isArray(data.landmarks))          setLandmarks(data.landmarks)
        if (typeof data.session_score === 'number') setScore(data.session_score)
        if (data.rep_counted) {
          setReps(r => r + 1)
          // Speak rep count encouragement
          speak('Good rep', { rate: 1.1 })
          return  // skip feedback cue on rep frames
        }
        if (data.joint_scores && typeof data.joint_scores === 'object') {
          jointScoresRef.current = data.joint_scores
        }

        // ── Voice intro — spoken exactly once when pose first detected ──────
        if (data.voice_intro && !voiceIntroSaid.current) {
          voiceIntroSaid.current = true
          speak(data.voice_intro, { rate: 0.9 })
          setFeedback(data.feedback || 'Get ready')
          return
        }

        // ── Live feedback — spoken at most every 4 seconds, only if changed ─
        if (data.feedback) {
          setFeedback(data.feedback)
          const isNew      = data.feedback !== lastFeedbackRef.current
          const noTimer    = !feedbackTimerRef.current
          if (isNew && noTimer) {
            lastFeedbackRef.current = data.feedback
            speak(data.feedback, { rate: 0.95 })
            // cooldown: don't speak again for 4 seconds
            feedbackTimerRef.current = setTimeout(() => {
              feedbackTimerRef.current = null
            }, 4000)
          }
        }

      } catch {
        setFeedback('Tracking error')
      }
    }

    ws.onclose = () => setFeedback('Connection closed')
    ws.onerror = () => setFeedback('WebSocket error')

    return () => {
      ws.close()
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [id])

  // Frame capture loop
  useEffect(() => {
    const capture = () => {
      const video  = videoRef.current
      const canvas = captureRef.current
      const ws     = wsRef.current
      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return
      if (video.videoWidth === 0 || video.videoHeight === 0) return

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
      }

      const ctx  = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
      ws.send(JSON.stringify({ frame: base64 }))
    }

    sendTimerRef.current = setInterval(capture, 250)
    return () => clearInterval(sendTimerRef.current)
  }, [])

  // Skeleton overlay
  useEffect(() => {
    const canvas = overlayRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const ctx    = canvas.getContext('2d')
    const width  = video.videoWidth  || canvas.width
    const height = video.videoHeight || canvas.height
    canvas.width  = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (!landmarks.length) return

    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth   = 2
    POSE_CONNECTIONS.forEach(([a, b]) => {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x * width, p1.y * height)
      ctx.lineTo(p2.x * width, p2.y * height)
      ctx.stroke()
    })

    landmarks.forEach(point => {
      ctx.beginPath()
      ctx.fillStyle = '#34c759'
      ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [landmarks])

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Stop handler ────────────────────────────────────────────────────────────
  async function handleStop() {
    if (wsRef.current)           wsRef.current.close()
    clearInterval(sendTimerRef.current)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    window.speechSynthesis?.cancel()
    speak('Session complete. Analyzing your performance.')
    setAnalyzing(true)

    const finalScore    = scoreRef.current
    const finalReps     = repsRef.current
    const finalDuration = timerRef.current

    const jointScoresArray = Object.entries(jointScoresRef.current).map(([name, sc]) => ({
      name,
      score:  typeof sc === 'number' ? sc : 0,
      status: typeof sc === 'number' && sc >= 70 ? 'good' : 'warning',
    }))

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    // Get patient id
    let patientId = 'unknown'
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) patientId = user.id
    } catch { /* continue */ }

    // Save session
    setAnalyzingMsg('Saving session...')
    let sessionId = null
    try {
      const res  = await fetch(`${apiBase}/session`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:   patientId,
          exercise_id:  Number(id),
          score:        Math.round(finalScore),
          reps:         finalReps,
          duration:     finalDuration,
          joint_scores: jointScoresArray,
        }),
      })
      const saved = await res.json()
      sessionId   = saved.session_id || null
    } catch { /* continue */ }

    // Run AI analysis
    setAnalyzingMsg('Analyzing your performance...')
    let analysis = null
    if (sessionId) {
      try {
        const res = await fetch(`${apiBase}/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id:  sessionId,
            patient_id:  patientId,
            exercise_id: Number(id),
          }),
        })
        analysis = await res.json()
      } catch { /* continue */ }
    }

    navigate('/patient/score', {
      state: {
        exerciseId:  id,
        reps:        finalReps,
        score:       Math.round(finalScore),
        duration:    finalDuration,
        jointScores: jointScoresArray,
        analysis,
      },
    })
  }

  // ── Analyzing overlay ───────────────────────────────────────────────────────
  if (analyzing) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", sans-serif', gap: 24,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '3px solid #272729',
          borderTop: '3px solid #0071e3',
          animation: 'spin 0.9s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 19, fontWeight: 600, color: '#fff' }}>{analyzingMsg}</div>
        <div style={{ fontSize: 14, color: '#6e6e73' }}>Please wait a moment</div>
      </div>
    )
  }

  return (
    <PatientApprovalGate showNav={false}>
      <div style={{
        position: 'fixed', inset: 0,
        background: '#000', overflow: 'hidden',
        fontFamily: '"Inter", sans-serif',
      }}>
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          playsInline muted
        />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <canvas ref={captureRef} style={{ display: 'none' }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.70)',
          padding: '48px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{exerciseName}</div>
          <div style={{ fontSize: 17, color: '#fff', fontWeight: 600, textAlign: 'center', flex: 1, padding: '0 16px' }}>
            {feedback}
          </div>
          <div style={{ fontSize: 14, color: '#6e6e73', minWidth: 50, textAlign: 'right' }}>{fmt(timer)}</div>
        </div>

        {/* Right score card */}
        <div style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(39,39,41,0.88)', borderRadius: 12,
          padding: '14px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          minWidth: 70,
        }}>
          <div style={{ fontSize: 12, color: '#6e6e73' }}>Score</div>
          <div style={{
            fontSize: 32, fontWeight: 600,
            color: score >= 75 ? '#34c759' : score >= 50 ? '#ff9f0a' : '#ff3b30',
          }}>
            {Math.round(score)}
          </div>
          <div style={{ width: 3, height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: 2, position: 'relative' }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: `${score}%`, background: '#0071e3', borderRadius: 2,
              transition: 'height 0.5s ease',
            }} />
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.70)',
          padding: '20px 32px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#6e6e73' }}>Reps</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#fff' }}>{reps}</div>
          </div>
          <button style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#272729', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <button
            onClick={handleStop}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#ff3b30', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
            onMouseUp={e =>   e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ width: 16, height: 16, background: '#fff', borderRadius: 3 }} />
          </button>
        </div>
      </div>
    </PatientApprovalGate>
  )
}