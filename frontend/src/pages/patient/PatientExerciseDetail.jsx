import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'
import { Card, BtnPrimary, BtnOutline } from '../../components/UI.jsx'
import PatientApprovalGate from '../../components/PatientApprovalGate.jsx'
import { supabase } from '../../lib/supabase.js'

export default function PatientExerciseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadExercise() {
      setError('')
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', Number(id))
        .maybeSingle()

      if (!isMounted) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setExercise(data)
      setLoading(false)
    }

    loadExercise()

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div style={{ background: '#f5f5f7', minHeight: '100vh', padding: 24, color: '#6e6e73' }}>Loading exercise...</div>
    )
  }

  if (error) {
    return (
      <div style={{ background: '#f5f5f7', minHeight: '100vh', padding: 24, color: '#ff3b30' }}>{error}</div>
    )
  }

  if (!exercise) return <div style={{ background: '#f5f5f7', minHeight: '100vh', padding: 24 }}>Exercise not found</div>

  const jointColors = ['#34c759', '#ff9f0a', '#34c759', '#34c759']

  return (
    <PatientApprovalGate showNav>
      <div style={{ background: '#f5f5f7', minHeight: '100vh', paddingBottom: 100, fontFamily: '"Inter", sans-serif' }}>

        {/* Sticky header — same pattern as DoctorHeader */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: '#ffffff',
          borderBottom: '1px solid #e5e5ea',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
            <button
              onClick={() => navigate('/patient')}
              style={{
                background: 'none', border: 'none', color: '#0071e3',
                fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12,
                display: 'block',
              }}
            >
              ← Back
            </button>
            <div style={{
              fontSize: 12, color: '#6e6e73', fontWeight: 600,
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {exercise.category}
            </div>
            <h1 style={{
              fontSize: 32, fontWeight: 600, color: '#1d1d1f',
              fontFamily: '"Inter Tight", sans-serif', margin: 0, lineHeight: 1.09,
            }}>
              {exercise.name}
            </h1>
            <p style={{ fontSize: 17, color: '#6e6e73', marginTop: 8 }}>
              {exercise.duration} · {exercise.difficulty}
            </p>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

          {/* Video placeholder */}
          <div style={{
            width: '100%', aspectRatio: '16/9',
            background: '#000', borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28, position: 'relative', overflow: 'hidden',
          }}>
            <svg width="120" height="160" viewBox="0 0 120 160" fill="none" style={{ opacity: 0.3 }}>
              <circle cx="60" cy="20" r="16" stroke="white" strokeWidth="2"/>
              <line x1="60" y1="36" x2="60" y2="90" stroke="white" strokeWidth="2"/>
              <line x1="60" y1="55" x2="30" y2="80" stroke="white" strokeWidth="2"/>
              <line x1="60" y1="55" x2="90" y2="80" stroke="white" strokeWidth="2"/>
              <line x1="60" y1="90" x2="40" y2="130" stroke="white" strokeWidth="2"/>
              <line x1="60" y1="90" x2="80" y2="130" stroke="white" strokeWidth="2"/>
              <circle cx="30" cy="80" r="4" fill="#34c759"/>
              <circle cx="90" cy="80" r="4" fill="#34c759"/>
              <circle cx="40" cy="130" r="4" fill="#ff9f0a"/>
              <circle cx="80" cy="130" r="4" fill="#34c759"/>
            </svg>
            <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 8 }}>Demo preview</div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Instructions — wrapped in Card */}
          <Card style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 12, marginTop: 0 }}>Instructions</h2>
            <p style={{ fontSize: 17, color: '#1d1d1f', lineHeight: 1.47, letterSpacing: '-0.374px', margin: 0 }}>
              {exercise.instructions}
            </p>
          </Card>

          {/* Joints tracked — wrapped in Card */}
          <Card style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 12, marginTop: 0 }}>Joints tracked</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {exercise.joints.map((joint, i) => (
                <div key={joint} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#f5f5f7', borderRadius: 980,
                  padding: '6px 14px',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: jointColors[i % jointColors.length],
                  }} />
                  <span style={{ fontSize: 14, color: '#1d1d1f' }}>{joint}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Target angle */}
          <section style={{
            background: '#f5f5f7', borderRadius: 18,
            padding: 20, marginBottom: 28,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, color: '#6e6e73' }}>Target angle</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1d1d1f', marginTop: 4 }}>{exercise.targetAngle}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#6e6e73' }}>AI monitoring</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#34c759', marginTop: 4 }}>Active</div>
            </div>
          </section>
        </div>

        {/* Sticky start button */}
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0,
          padding: '16px 24px',
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid #d2d2d7',
        }}>
          <BtnPrimary
            fullWidth
            style={{ height: 56, fontSize: 17, fontWeight: 600 }}
            onClick={() => navigate(`/patient/session/${id}`)}
          >
            Start exercise
          </BtnPrimary>
        </div>

        <PatientBottomNav />
      </div>
    </PatientApprovalGate>
  )
}
