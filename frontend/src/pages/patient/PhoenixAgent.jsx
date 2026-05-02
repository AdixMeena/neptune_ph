// src/pages/patient/PhoenixAgent.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CONNECT INSTRUCTIONS (for your agent):
//   1. Place this file at:  src/pages/patient/PhoenixAgent.jsx
//   2. Add route in App.jsx:  <Route path="/patient/agent" element={<PhoenixAgent />} />
//   3. Add tab to PatientBottomNav — see PROMPT at bottom of this file
//   4. Run SQL:  ALTER TABLE patient_exercises ADD COLUMN IF NOT EXISTS assigned_by text DEFAULT 'doctor';
//   5. Add VITE_GROQ_API_KEY to .env if not already present
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'
import PatientHeader from '../../components/PatientHeader.jsx'
import PatientApprovalGate from '../../components/PatientApprovalGate.jsx'
import { supabase } from '../../lib/supabase.js'
import { AuthContext } from '../../App.jsx'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

// ── Phoenix Logo ──────────────────────────────────────────────────────────────
function PhoenixLogo({ size = 22, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 750 750" xmlns="http://www.w3.org/2000/svg">
      <path fill={color} strokeWidth="0" d="m208.00003,254.6l3.6,-0.6c-20.9,9.9 -49,30.4 -67.8,44.9c-30.4,23.3 -54.1,57.9 -74,92.9c84.1,-45.7 161.8,-52.4 178.5,-48.2c0.2,0.1 -7.7,45.5 -36.7,83.6c-30.5,39.9 -82.2,72.4 -82.2,72.4c18.9,2.2 37.9,2.6 56.7,0.8c32.2,-3 65.3,-12.4 91.5,-34.7c11.6,-9.9 32.8,-39 30.5,-34.8c-12.5,31.2 -14.3,66.7 -12.3,100.6c1.1,19.9 3.2,39.6 9.1,58.4c5,16.1 12.3,31.2 20.6,45.3l8.2,6.5c0.1,-0.7 -7.9,-111.8 48.5,-166.7c102.6,-99.8 216,-4.9 216,-4.9s-4.5,-75.2 -89.6,-111.7c203.8,-18.8 159.7,102 159.7,102s69.8,-29.8 59.1,-114.9c-9.7,-77 -85,-95.3 -100.7,-98.3c-13.2,-21.7 -113.2,-186.8 -279.8,-121.9c-180.6,70.3 -326.9,53.6 -326.9,53.6c21.5,24.7 46.7,44.6 74.1,58.7c35.6,18.4 75.3,23.8 113.9,17zm314,-15.9c6.3,2.1 12.7,4.2 19.1,6.2c-0.5,6.1 -4.8,10.9 -10,10.9c-5.5,0 -10.1,-5.4 -10.1,-12.1c0.1,-1.8 0.4,-3.5 1,-5zm-40.1,2.4c0,-5.1 0.9,-9.9 2.6,-14.4c3.8,0.9 7.6,1.8 11.2,3c3.8,1.2 7.5,2.5 11.3,3.8c-1.1,3.1 -1.8,6.5 -1.8,10.1c0,15.4 11.6,27.9 25.9,27.9c12.6,0 23,-9.7 25.4,-22.5c2.7,0.6 5.3,1.3 8,1.8c-4.4,18.5 -20.9,32.3 -40.7,32.3c-23.2,0 -41.9,-18.8 -41.9,-42z"/>
    </svg>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────
const INJURY_CATEGORIES = [
  { value: '', label: 'Select injury area...' },
  { value: 'knee', label: '🦵 Knee' },
  { value: 'lower_back', label: '🔙 Lower Back' },
  { value: 'shoulder', label: '💪 Shoulder' },
  { value: 'hip', label: '🦴 Hip' },
  { value: 'ankle', label: '🦶 Ankle' },
  { value: 'neck', label: '🫙 Neck & Cervical' },
  { value: 'wrist', label: '✋ Wrist & Hand' },
  { value: 'upper_back', label: '🏋️ Upper Back' },
  { value: 'general', label: '⚡ General Fitness & Recovery' },
]

const DIFFICULTY_COLORS = {
  easy: { bg: '#f0fff4', color: '#34c759', border: '#34c75930' },
  moderate: { bg: '#fff8e6', color: '#ff9f0a', border: '#ff9f0a30' },
  hard: { bg: '#fff0f0', color: '#ff3b30', border: '#ff3b3030' },
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#0071e3',
          animation: `agentDot 1.3s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Exercise card (library + suggestions) ─────────────────────────────────────
function ExerciseCard({ exercise, isAdded, onAdd, onView, compact = false }) {
  const [adding, setAdding] = useState(false)
  const diff = (exercise.difficulty || 'moderate').toLowerCase()
  const diffStyle = DIFFICULTY_COLORS[diff] || DIFFICULTY_COLORS.moderate

  async function handleAdd() {
    if (isAdded || adding) return
    setAdding(true)
    await onAdd(exercise)
    setAdding(false)
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e5ea',
      borderRadius: 16,
      padding: compact ? '14px 16px' : '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.15s, transform 0.15s',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)' }}
    onClick={() => onView && onView(exercise)}
    >
      {/* Category tag top-left */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: '#0071e3',
          background: 'rgba(0,113,227,0.08)',
          borderRadius: 6, padding: '3px 8px',
        }}>
          {exercise.category || 'General'}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: diffStyle.color,
          background: diffStyle.bg,
          border: `1px solid ${diffStyle.border}`,
          borderRadius: 6, padding: '3px 8px',
        }}>
          {diff.charAt(0).toUpperCase() + diff.slice(1)}
        </span>
      </div>

      {/* Name + duration */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', marginBottom: 3 }}>
          {exercise.name}
        </div>
        {exercise.duration && (
          <div style={{ fontSize: 12, color: '#6e6e73' }}>{exercise.duration}</div>
        )}
      </div>

      {/* Instructions preview */}
      {!compact && exercise.instructions && (
        <div style={{
          fontSize: 13, color: '#6e6e73', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {exercise.instructions}
        </div>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={handleAdd}
          disabled={isAdded || adding}
          style={{
            flex: 1,
            fontSize: 13, fontWeight: 600,
            background: isAdded ? '#f0fff4' : '#0071e3',
            color: isAdded ? '#34c759' : '#fff',
            border: isAdded ? '1px solid #34c75930' : 'none',
            borderRadius: 10, padding: '9px 0',
            cursor: isAdded ? 'default' : 'pointer',
            transition: 'background 0.15s',
            fontFamily: '"Inter", sans-serif',
          }}
        >
          {adding ? 'Adding...' : isAdded ? '✓ Added to plan' : '+ Add to my plan'}
        </button>
        <button
          onClick={() => onView && onView(exercise)}
          style={{
            fontSize: 13, fontWeight: 500,
            background: 'none',
            color: '#0071e3',
            border: '1px solid #d2d2d7',
            borderRadius: 10, padding: '9px 14px',
            cursor: 'pointer',
            fontFamily: '"Inter", sans-serif',
          }}
        >
          View
        </button>
      </div>
    </div>
  )
}

// ── Suggestion card (AI result) ───────────────────────────────────────────────
function SuggestionCard({ suggestion, matchedExercise, isAdded, onAdd, onView }) {
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!matchedExercise || isAdded || adding) return
    setAdding(true)
    await onAdd(matchedExercise)
    setAdding(false)
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e5ea',
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      borderLeft: '3px solid #0071e3',
    }}>
      {/* Exercise name + match indicator */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', lineHeight: 1.3 }}>
          {suggestion.name}
        </div>
        {matchedExercise ? (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#34c759',
            background: '#f0fff4', border: '1px solid #34c75930',
            borderRadius: 6, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            ✓ In library
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#ff9f0a',
            background: '#fff8e6', border: '1px solid #ff9f0a30',
            borderRadius: 6, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            Not in library
          </span>
        )}
      </div>

      {/* AI reasoning */}
      <p style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.6, margin: '0 0 14px' }}>
        {suggestion.reason}
      </p>

      {/* Sets/reps if given */}
      {suggestion.prescription && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#0071e3',
          background: 'rgba(0,113,227,0.06)', borderRadius: 8, padding: '7px 12px',
          marginBottom: 14,
        }}>
          📋 {suggestion.prescription}
        </div>
      )}

      {/* Actions */}
      {matchedExercise && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAdd}
            disabled={isAdded || adding}
            style={{
              flex: 1, fontSize: 13, fontWeight: 600,
              background: isAdded ? '#f0fff4' : '#0071e3',
              color: isAdded ? '#34c759' : '#fff',
              border: isAdded ? '1px solid #34c75930' : 'none',
              borderRadius: 10, padding: '9px 0',
              cursor: isAdded ? 'default' : 'pointer',
              fontFamily: '"Inter", sans-serif',
            }}
          >
            {adding ? 'Adding...' : isAdded ? '✓ Added to plan' : '+ Add to my plan'}
          </button>
          <button
            onClick={() => onView && onView(matchedExercise)}
            style={{
              fontSize: 13, fontWeight: 500, color: '#0071e3',
              background: 'none', border: '1px solid #d2d2d7',
              borderRadius: 10, padding: '9px 14px',
              cursor: 'pointer', fontFamily: '"Inter", sans-serif',
            }}
          >
            View
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PhoenixAgent() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)

  // Data
  const [allExercises, setAllExercises] = useState([])
  const [myExerciseIds, setMyExerciseIds] = useState(new Set())
  const [patientId, setPatientId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Tabs
  const [activeTab, setActiveTab] = useState('agent') // 'agent' | 'library'

  // Library
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Agent
  const [injuryCategory, setInjuryCategory] = useState('')
  const [injuryDesc, setInjuryDesc] = useState('')
  const [descFocused, setDescFocused] = useState(false)
  const [agentLoading, setAgentLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([]) // [{name, reason, prescription}]
  const [agentError, setAgentError] = useState('')
  const [addAllLoading, setAddAllLoading] = useState(false)

  const resultsRef = useRef(null)

  // ── Load data ──
  useEffect(() => {
    if (!user) return
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      const [exResult, patResult] = await Promise.all([
        supabase.from('exercises').select('*').order('name'),
        supabase.from('patients').select('id').eq('user_id', user.id).limit(1),
      ])

      if (!mounted) return

      if (exResult.error) { setError(exResult.error.message); setLoading(false); return }
      if (patResult.error) { setError(patResult.error.message); setLoading(false); return }

      const pid = patResult.data?.[0]?.id
      setAllExercises(exResult.data || [])
      setPatientId(pid)

      if (pid) {
        const { data: myRows } = await supabase
          .from('patient_exercises')
          .select('exercise_id')
          .eq('patient_id', pid)

        if (mounted && myRows) {
          setMyExerciseIds(new Set(myRows.map(r => r.exercise_id)))
        }
      }

      if (mounted) setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [user])

  // ── Add single exercise ──
  const addExercise = useCallback(async (exercise) => {
    if (!patientId || myExerciseIds.has(exercise.id)) return

    const { error: insertError } = await supabase
      .from('patient_exercises')
      .insert({
        patient_id: patientId,
        exercise_id: exercise.id,
        status: 'pending',
        assigned_by: 'patient',
      })

    if (!insertError) {
      setMyExerciseIds(prev => new Set([...prev, exercise.id]))
    }
  }, [patientId, myExerciseIds])

  // ── Add all suggested ──
  async function addAllSuggested() {
    setAddAllLoading(true)
    const toAdd = suggestions
      .map(s => matchExercise(s.name))
      .filter(ex => ex && !myExerciseIds.has(ex.id))

    for (const ex of toAdd) {
      await addExercise(ex)
    }
    setAddAllLoading(false)
  }

  // ── Match AI suggestion name to library ──
  function matchExercise(name) {
    if (!name) return null
    const n = name.toLowerCase().trim()
    return allExercises.find(ex =>
      ex.name.toLowerCase().includes(n) ||
      n.includes(ex.name.toLowerCase().split(' ').slice(0, 2).join(' '))
    ) || null
  }

  // ── AI agent ──
  async function runAgent() {
    if (!injuryCategory && !injuryDesc.trim()) return
    setAgentLoading(true)
    setAgentError('')
    setSuggestions([])

    const exerciseList = allExercises.map(ex =>
      `- "${ex.name}" (category: ${ex.category || 'general'}, difficulty: ${ex.difficulty || 'moderate'}, duration: ${ex.duration || 'N/A'})`
    ).join('\n')

    const prompt = `You are a professional physiotherapist AI inside the Phoenix-AI rehabilitation app. A patient needs personalized exercise recommendations.

Patient's injury area: ${injuryCategory || 'Not specified'}
Patient's description: ${injuryDesc.trim() || 'No additional description provided'}

Available exercises in our library:
${exerciseList}

Your task:
- Recommend 4 to 6 exercises from the list above that are MOST suitable for this patient's condition
- Only recommend exercises that are in the list above — do not invent new ones
- For each exercise, explain WHY it helps their specific condition (1-2 sentences, warm and encouraging)
- Give a simple prescription (sets × reps or duration)

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "summary": "A 2-sentence empathetic summary of the patient's situation and your approach",
  "suggestions": [
    {
      "name": "exact exercise name from the list",
      "reason": "why this helps their condition",
      "prescription": "e.g. 3 sets × 12 reps or 20 minutes daily"
    }
  ]
}`

    try {
      if (!GROQ_API_KEY) throw new Error('NO_KEY')

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1200,
          temperature: 0.4,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      setSuggestions(parsed.suggestions || [])
      if (parsed.summary) {
        setSuggestions(prev => prev.length ? prev : [])
        // store summary separately
        window.__agentSummary = parsed.summary
      }
      window.__agentSummary = parsed.summary || ''

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)

    } catch (err) {
      let msg = 'Something went wrong. Please try again.'
      if (err.message === 'NO_KEY') msg = 'Groq API key not found. Add VITE_GROQ_API_KEY to your .env file.'
      else if (err.message?.includes('401')) msg = 'Invalid API key.'
      else if (err.message?.includes('429')) msg = 'Too many requests. Wait a moment and try again.'
      else if (err instanceof SyntaxError) msg = 'AI returned an unexpected response. Please try again.'
      setAgentError(msg)
    } finally {
      setAgentLoading(false)
    }
  }

  // ── Filtered library ──
  const filteredExercises = allExercises.filter(ex => {
    const matchSearch = !search ||
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (ex.instructions || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || (ex.category || '').toLowerCase().includes(filterCategory)
    const matchDiff = !filterDiff || (ex.difficulty || '').toLowerCase() === filterDiff
    return matchSearch && matchCat && matchDiff
  })

  const uniqueCategories = [...new Set(allExercises.map(ex => ex.category).filter(Boolean))]

  // ── Summary state for display ──
  const [agentSummary, setAgentSummary] = useState('')
  useEffect(() => {
    if (suggestions.length > 0) {
      setAgentSummary(window.__agentSummary || '')
    }
  }, [suggestions])

  return (
    <PatientApprovalGate showNav>
      <div style={{
        background: '#f5f5f7', minHeight: '100vh',
        paddingBottom: 88, fontFamily: '"Inter", sans-serif',
      }}>
        <PatientHeader />

        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 48px' }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#0071e3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,113,227,0.28)',
              }}>
                <PhoenixLogo size={26} color="#fff" />
              </div>
              <div>
                <h1 style={{
                  fontSize: 32, fontWeight: 600, color: '#1d1d1f',
                  fontFamily: '"Inter Tight", sans-serif',
                  margin: 0, letterSpacing: '-0.5px',
                }}>
                  Phoenix Agent
                </h1>
                <p style={{ fontSize: 14, color: '#6e6e73', margin: 0, marginTop: 2 }}>
                  AI-powered exercise recommendations & full library
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#ff3b3010', border: '1px solid #ff3b3030',
              borderRadius: 12, padding: '12px 16px',
              fontSize: 13, color: '#ff3b30', marginBottom: 24,
            }}>
              {error}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{
            display: 'flex', gap: 6,
            background: '#e5e5ea', borderRadius: 14,
            padding: 4, marginBottom: 32, width: 'fit-content',
          }}>
            {[
              { key: 'agent', label: '✦ Phoenix Agent' },
              { key: 'library', label: '📚 Exercise Library' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  fontSize: 14, fontWeight: 600,
                  padding: '9px 22px', borderRadius: 10, border: 'none',
                  background: activeTab === tab.key ? '#fff' : 'none',
                  color: activeTab === tab.key ? '#0071e3' : '#6e6e73',
                  cursor: 'pointer',
                  boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.18s ease',
                  fontFamily: '"Inter", sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: PHOENIX AGENT                                                */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'agent' && (
            <div>
              {/* Input card */}
              <div style={{
                background: '#fff',
                border: '1px solid #e5e5ea',
                borderRadius: 20,
                padding: '28px 28px',
                marginBottom: 28,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'linear-gradient(135deg, #0071e3, #34c759)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PhoenixLogo size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif' }}>
                      Describe your condition
                    </div>
                    <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 1 }}>
                      The agent will find the best exercises from your library
                    </div>
                  </div>
                </div>

                {/* Injury category dropdown */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', display: 'block', marginBottom: 8 }}>
                    Injury or problem area
                  </label>
                  <select
                    value={injuryCategory}
                    onChange={e => setInjuryCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '11px 14px',
                      fontSize: 14, color: injuryCategory ? '#1d1d1f' : '#86868b',
                      background: '#f5f5f7', border: '1px solid #d2d2d7',
                      borderRadius: 12, outline: 'none',
                      fontFamily: '"Inter", sans-serif',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%236e6e73' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 14px center',
                      paddingRight: 36,
                    }}
                  >
                    {INJURY_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Free text description */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', display: 'block', marginBottom: 8 }}>
                    Describe your symptoms or goals
                    <span style={{ fontWeight: 400, color: '#86868b', marginLeft: 6 }}>(optional but helps)</span>
                  </label>
                  <textarea
                    value={injuryDesc}
                    onChange={e => setInjuryDesc(e.target.value)}
                    onFocus={() => setDescFocused(true)}
                    onBlur={() => setDescFocused(false)}
                    placeholder="e.g. Sharp pain on the inside of my left knee when going down stairs. Recovering from meniscus surgery 6 weeks ago..."
                    rows={4}
                    style={{
                      width: '100%', padding: '12px 16px',
                      fontSize: 14, color: '#1d1d1f', lineHeight: 1.6,
                      background: '#f5f5f7',
                      border: `1.5px solid ${descFocused ? '#0071e3' : '#d2d2d7'}`,
                      borderRadius: 12, outline: 'none', resize: 'vertical',
                      fontFamily: '"Inter", sans-serif',
                      transition: 'border-color 0.15s',
                      boxShadow: descFocused ? '0 0 0 3px rgba(0,113,227,0.1)' : 'none',
                    }}
                  />
                </div>

                {/* CTA button */}
                <button
                  onClick={runAgent}
                  disabled={agentLoading || loading || (!injuryCategory && !injuryDesc.trim())}
                  style={{
                    width: '100%', padding: '14px 0',
                    fontSize: 15, fontWeight: 600,
                    background: agentLoading || (!injuryCategory && !injuryDesc.trim())
                      ? '#d2d2d7'
                      : '#0071e3',
                    color: '#fff', border: 'none',
                    borderRadius: 14, cursor: agentLoading || (!injuryCategory && !injuryDesc.trim()) ? 'default' : 'pointer',
                    fontFamily: '"Inter", sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    transition: 'background 0.15s',
                    boxShadow: (!agentLoading && (injuryCategory || injuryDesc.trim()))
                      ? '0 4px 14px rgba(0,113,227,0.3)' : 'none',
                  }}
                >
                  {agentLoading ? (
                    <>
                      <TypingDots />
                      <span>Analyzing your condition...</span>
                    </>
                  ) : (
                    <>
                      <PhoenixLogo size={18} color="#fff" />
                      <span>Get personalized recommendations</span>
                    </>
                  )}
                </button>

                {agentError && (
                  <div style={{
                    marginTop: 14, background: '#ff3b3010', border: '1px solid #ff3b3030',
                    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff3b30',
                  }}>
                    {agentError}
                  </div>
                )}
              </div>

              {/* ── Results ── */}
              {suggestions.length > 0 && (
                <div ref={resultsRef}>
                  {/* Summary card */}
                  {agentSummary && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(0,113,227,0.06), rgba(52,199,89,0.06))',
                      border: '1px solid rgba(0,113,227,0.15)',
                      borderRadius: 16, padding: '18px 20px',
                      marginBottom: 20,
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: '#0071e3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <PhoenixLogo size={20} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0071e3', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                          Phoenix Agent Assessment
                        </div>
                        <p style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 1.6, margin: 0 }}>
                          {agentSummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Results header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1d1d1f', margin: 0, fontFamily: '"Inter Tight", sans-serif' }}>
                        Recommended for you
                      </h2>
                      <p style={{ fontSize: 13, color: '#6e6e73', margin: '4px 0 0' }}>
                        {suggestions.filter(s => matchExercise(s.name)).length} of {suggestions.length} available in your library
                      </p>
                    </div>
                    <button
                      onClick={addAllSuggested}
                      disabled={addAllLoading}
                      style={{
                        fontSize: 13, fontWeight: 600,
                        background: '#0071e3', color: '#fff',
                        border: 'none', borderRadius: 10, padding: '9px 18px',
                        cursor: 'pointer', fontFamily: '"Inter", sans-serif',
                        opacity: addAllLoading ? 0.7 : 1,
                      }}
                    >
                      {addAllLoading ? 'Adding...' : '+ Add all to plan'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {suggestions.map((s, i) => {
                      const matched = matchExercise(s.name)
                      return (
                        <SuggestionCard
                          key={i}
                          suggestion={s}
                          matchedExercise={matched}
                          isAdded={matched ? myExerciseIds.has(matched.id) : false}
                          onAdd={addExercise}
                          onView={ex => navigate(`/patient/exercise/${ex.id}`)}
                        />
                      )
                    })}
                  </div>

                  {/* Disclaimer */}
                  <div style={{
                    marginTop: 20, padding: '12px 16px',
                    background: '#fff8e6', border: '1px solid #ff9f0a20',
                    borderRadius: 12, fontSize: 12, color: '#86868b', lineHeight: 1.5,
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff9f0a" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    These are AI-generated suggestions based on common physiotherapy protocols. Always consult your assigned doctor before starting a new exercise plan, especially if recovering from surgery or injury.
                  </div>
                </div>
              )}

              {/* Empty agent state */}
              {suggestions.length === 0 && !agentLoading && (
                <div style={{
                  background: '#fff', border: '1px solid #e5e5ea',
                  borderRadius: 20, padding: '48px 32px', textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, background: '#f0f7ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <PhoenixLogo size={30} color="#0071e3" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1d1d1f', margin: '0 0 8px', fontFamily: '"Inter Tight", sans-serif' }}>
                    Tell me about your condition
                  </h3>
                  <p style={{ fontSize: 14, color: '#6e6e73', margin: 0, lineHeight: 1.6, maxWidth: 340, marginInline: 'auto' }}>
                    Select your injury area and describe your symptoms above. Phoenix Agent will recommend the best exercises from your library — just like your doctor would.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TAB: EXERCISE LIBRARY                                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'library' && (
            <div>
              {/* Search + filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search exercises..."
                  style={{
                    flex: '1 1 240px', padding: '10px 16px',
                    fontSize: 14, color: '#1d1d1f',
                    background: '#fff',
                    border: `1.5px solid ${searchFocused ? '#0071e3' : '#d2d2d7'}`,
                    borderRadius: 12, outline: 'none',
                    fontFamily: '"Inter", sans-serif',
                    transition: 'border-color 0.15s',
                    boxShadow: searchFocused ? '0 0 0 3px rgba(0,113,227,0.08)' : 'none',
                  }}
                />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{
                    flex: '0 1 180px', padding: '10px 14px',
                    fontSize: 13, color: filterCategory ? '#1d1d1f' : '#86868b',
                    background: '#fff', border: '1px solid #d2d2d7',
                    borderRadius: 12, outline: 'none',
                    fontFamily: '"Inter", sans-serif', cursor: 'pointer',
                    appearance: 'none',
                  }}
                >
                  <option value="">All categories</option>
                  {uniqueCategories.map(c => (
                    <option key={c} value={c.toLowerCase()}>{c}</option>
                  ))}
                </select>
                <select
                  value={filterDiff}
                  onChange={e => setFilterDiff(e.target.value)}
                  style={{
                    flex: '0 1 150px', padding: '10px 14px',
                    fontSize: 13, color: filterDiff ? '#1d1d1f' : '#86868b',
                    background: '#fff', border: '1px solid #d2d2d7',
                    borderRadius: 12, outline: 'none',
                    fontFamily: '"Inter", sans-serif', cursor: 'pointer',
                    appearance: 'none',
                  }}
                >
                  <option value="">All levels</option>
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total exercises', value: allExercises.length },
                  { label: 'In my plan', value: myExerciseIds.size },
                  { label: 'Showing', value: filteredExercises.length },
                ].map(stat => (
                  <div key={stat.label} style={{
                    flex: 1, minWidth: 120,
                    background: '#fff', border: '1px solid #e5e5ea',
                    borderRadius: 14, padding: '14px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ fontSize: 11, color: '#86868b', fontWeight: 500, marginBottom: 4 }}>{stat.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 600, color: '#1d1d1f', lineHeight: 1 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {loading && (
                <div style={{ textAlign: 'center', color: '#6e6e73', fontSize: 14, padding: '40px 0' }}>
                  Loading library...
                </div>
              )}

              {!loading && filteredExercises.length === 0 && (
                <div style={{
                  background: '#fff', border: '1px solid #e5e5ea',
                  borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 15, color: '#6e6e73', margin: 0 }}>No exercises found matching your filters.</p>
                </div>
              )}

              {/* Exercise grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 14,
              }}>
                {filteredExercises.map(ex => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    isAdded={myExerciseIds.has(ex.id)}
                    onAdd={addExercise}
                    onView={ex => navigate(`/patient/exercise/${ex.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>

        <PatientBottomNav />

        <style>{`
          @keyframes agentDot {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
            30% { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
      </div>
    </PatientApprovalGate>
  )
}
