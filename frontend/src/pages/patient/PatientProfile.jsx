import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'
import { Card } from '../../components/UI.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase.js'
import { AuthContext } from '../../App.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 72 }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #0071e3 0%, #34c759 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 600, color: '#fff',
      flexShrink: 0, fontFamily: '"Inter Tight", sans-serif',
      letterSpacing: '-0.5px',
    }}>{initials}</div>
  )
}

function ScoreRing({ score }) {
  const r = 36, circ = 2 * Math.PI * r
  const fill = circ - (score / 100) * circ
  const color = score >= 75 ? '#34c759' : score >= 50 ? '#ff9f0a' : '#ff3b30'
  return (
    <div style={{ position: 'relative', width: 88, height: 88 }}>
      <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={r} stroke="#f5f5f7" strokeWidth="6" fill="none" />
        <circle cx="44" cy="44" r={r} stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circ} strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 20, fontWeight: 600, color, fontFamily: '"Inter Tight", sans-serif', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: '#86868b', marginTop: 1 }}>score</span>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 0', borderBottom: '1px solid #f5f5f7',
    }}>
      <span style={{ fontSize: 14, color: '#6e6e73' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{value}</span>
    </div>
  )
}

function MiniStatCard({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '16px 8px' }}>
      <div style={{ fontSize: 24, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 6 }}>{label}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PatientProfile() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [tab, setTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [patient, setPatient] = useState(null)
  const [doctorName, setDoctorName] = useState('Not assigned')
  const [progressData, setProgressData] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [sessionsCount, setSessionsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!user) return
      setError('')
      setLoading(true)

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        if (isMounted) {
          setError(profileError.message)
          setLoading(false)
        }
        return
      }

      const { data: patientRow, error: patientError } = await supabase
        .from('patients')
        .select('id, name, condition, age, score, streak, progress')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (patientError) {
        if (isMounted) {
          setError(patientError.message)
          setLoading(false)
        }
        return
      }

      const { data: connectionRow } = await supabase
        .from('connections')
        .select('doctor_id')
        .eq('patient_id', user.id)
        .eq('status', 'approved')
        .maybeSingle()

      let doctorProfileName = 'Not assigned'
      if (connectionRow?.doctor_id) {
        const { data: doctorProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', connectionRow.doctor_id)
          .maybeSingle()

        doctorProfileName = doctorProfile?.name || doctorProfileName
      }

      const { data: sessionRows, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, score, reps, created_at, label, exercises(name)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4)

      if (sessionsError) {
        if (isMounted) {
          setError(sessionsError.message)
          setLoading(false)
        }
        return
      }

      const { count: totalSessionCount, error: countError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', user.id)

      if (countError) {
        if (isMounted) {
          setError(countError.message)
          setLoading(false)
        }
        return
      }

      const progressValues = Array.isArray(patientRow?.progress) ? patientRow.progress : []
      const fallbackProgress = (sessionRows || []).slice().reverse().map(row => row.score)
      const effectiveProgress = progressValues.length > 0 ? progressValues : fallbackProgress
      const progressChart = effectiveProgress.map((score, idx) => ({
        week: `W${idx + 1}`,
        score,
      }))

      if (isMounted) {
        setProfile(profileRow || null)
        setPatient(patientRow || null)
        setDoctorName(doctorProfileName)
        setProgressData(progressChart)
        setRecentSessions(sessionRows || [])
        setSessionsCount(totalSessionCount || 0)
        setName(profileRow?.name || user?.user_metadata?.name || '')
        setLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [user])

  async function handleSave() {
    if (!user) return
    const trimmedName = name.trim() || 'Patient'

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ name: trimmedName })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setProfile(prev => ({
      ...(prev || {}),
      name: trimmedName,
    }))
    setEditing(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const patientName = name || profile?.name || user?.user_metadata?.name || 'Patient'
  const condition = patient?.condition || 'Recovery plan'
  const age = patient?.age ?? 'Not set'
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Not set'
  const score = patient?.score ?? 0
  const streak = patient?.streak ?? 0
  const avgScore = progressData.length > 0
    ? Math.round(progressData.reduce((sum, row) => sum + row.score, 0) / progressData.length)
    : score

  return (
    <div style={{ background: '#f5f5f7', minHeight: '100vh', paddingBottom: 88, fontFamily: '"Inter", sans-serif' }}>

      {/* ── Sticky header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#ffffff',
        borderBottom: '1px solid #e5e5ea',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: '"Inter Tight", sans-serif', color: '#1d1d1f' }}>
              My profile
            </div>
            <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 2 }}>
              Your recovery details and account settings
            </div>
          </div>
          {!editing
            ? <button onClick={() => setEditing(true)} style={{
                background: 'none', border: '1px solid #d2d2d7', borderRadius: 10,
                padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#1d1d1f',
                cursor: 'pointer',
              }}>Edit</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{
                  background: 'none', border: '1px solid #d2d2d7', borderRadius: 10,
                  padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#6e6e73', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={handleSave} style={{
                  background: '#0071e3', border: 'none', borderRadius: 10,
                  padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                }}>Save</button>
              </div>
          }
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', margin: 0 }}>
            My profile
          </h1>
          <p style={{ fontSize: 17, color: '#6e6e73', marginTop: 8 }}>
            Your recovery details and account settings
          </p>
        </div>

        {error && (
          <div style={{
            background: '#ff3b3010', border: '1px solid #ff3b3030',
            borderRadius: 12, padding: '12px 16px',
            fontSize: 13, color: '#ff3b30', lineHeight: 1.5,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#6e6e73', fontSize: 14, padding: '12px 0' }}>
            Loading profile...
          </div>
        )}

        {/* Identity + Stats Card */}
        <Card style={{ marginBottom: 16 }}>
          {/* Avatar + name + score ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <Avatar name={patientName} size={64} />
            <div style={{ flex: 1 }}>
              {editing
                ? <input value={name} onChange={e => setName(e.target.value)} style={{
                    fontSize: 19, fontWeight: 600, color: '#1d1d1f',
                    border: '1px solid #0071e3', borderRadius: 10,
                    padding: '6px 10px', outline: 'none', width: '100%',
                    fontFamily: '"Inter Tight", sans-serif', marginBottom: 4,
                  }} />
                : <div style={{ fontSize: 19, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', marginBottom: 2 }}>{name}</div>
              }
              <div style={{ fontSize: 13, color: '#6e6e73' }}>{condition}</div>
              <div style={{ fontSize: 12, color: '#0071e3', marginTop: 3 }}>
                Under {doctorName}
              </div>
            </div>
            <ScoreRing score={score} />
          </div>

          {/* Stats row — StatCard mini pattern */}
          <div style={{
            display: 'flex', borderTop: '1px solid #f5f5f7',
            marginLeft: -20, marginRight: -20, marginBottom: -20,
          }}>
            {[
              { label: 'Sessions', value: sessionsCount },
              { label: 'Streak', value: `${streak}d 🔥` },
              { label: 'Avg score', value: avgScore },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, borderRight: i < 2 ? '1px solid #f5f5f7' : 'none',
              }}>
                <MiniStatCard label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        </Card>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: '#fff',
          borderRadius: 12, border: '1px solid #d2d2d7',
          marginBottom: 16, overflow: 'hidden',
        }}>
          {['overview', 'progress', 'sessions'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #0071e3' : '2px solid transparent',
              padding: '12px 0', fontSize: 13, fontWeight: 600,
              color: tab === t ? '#1d1d1f' : '#6e6e73',
              cursor: 'pointer', textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}>{t}</button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {/* Personal information */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 4 }}>Personal information</div>
              <div style={{ fontSize: 12, color: '#6e6e73', marginBottom: 16 }}>Visible only to you and your doctor</div>
              <InfoRow label="Email" value={user?.email || 'Not set'} />
              <InfoRow label="Age" value={age} />
              <InfoRow label="Member since" value={joinedDate} />
            </Card>

            {/* Medical details */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 16 }}>Medical details</div>
              <InfoRow label="Condition" value={condition} />
              <InfoRow label="Assigned doctor" value={doctorName} />
              <div style={{ paddingTop: 14 }}>
                <button onClick={() => navigate('/patient/find-doctor')} style={{
                  background: 'none', border: 'none', color: '#0071e3',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
                }}>Change doctor →</button>
              </div>
            </Card>

            {/* Account */}
            <Card>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f', marginBottom: 4 }}>Account</div>
              <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 16 }}>Manage your account settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleSignOut} style={{
                  background: '#f5f5f7', border: '1px solid #d2d2d7', borderRadius: 12,
                  padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#1d1d1f',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>Sign out</button>
                <button style={{
                  background: 'none', border: 'none',
                  padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#ff3b30',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>Delete account</button>
              </div>
            </Card>
          </>
        )}

        {/* PROGRESS TAB */}
        {tab === 'progress' && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', marginBottom: 4 }}>Score over time</div>
              <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 20 }}>Past 7 weeks</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={progressData}>
                  <CartesianGrid stroke="#f5f5f7" strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #d2d2d7', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600, color: '#1d1d1f' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#0071e3" strokeWidth={2}
                    dot={{ fill: '#fff', stroke: '#0071e3', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Achievements */}
            <Card>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', marginBottom: 16 }}>Achievements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '🔥', label: '7-day streak', sub: 'Completed exercises 7 days in a row', earned: true },
                  { icon: '⭐', label: 'Score 80+',    sub: 'Achieved a session score above 80',  earned: true },
                  { icon: '💪', label: '50 sessions',  sub: `${sessionsCount} / 50 sessions completed`, earned: sessionsCount >= 50 },
                ].map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 0', borderBottom: i < 2 ? '1px solid #f5f5f7' : 'none',
                    opacity: a.earned ? 1 : 0.4,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: a.earned ? '#0071e315' : '#f5f5f7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>{a.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 2 }}>{a.sub}</div>
                    </div>
                    {a.earned && (
                      <div style={{ marginLeft: 'auto' }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <circle cx="9" cy="9" r="9" fill="#34c75920" />
                          <path d="M5 9l3 3 5-5" stroke="#34c759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* SESSIONS TAB */}
        {tab === 'sessions' && (
          <Card>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', marginBottom: 4 }}>Recent sessions</div>
            <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 20 }}>{sessionsCount} total sessions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentSessions.length === 0 && (
                <div style={{ fontSize: 13, color: '#6e6e73', padding: '6px 0' }}>No sessions yet.</div>
              )}
              {recentSessions.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 0',
                  borderBottom: i < recentSessions.length - 1 ? '1px solid #f5f5f7' : 'none',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: s.score >= 75 ? '#34c75920' : '#ff9f0a20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    color: s.score >= 75 ? '#34c759' : '#ff9f0a',
                  }}>{s.score ?? 0}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>
                      {s.exercises?.name || s.label || 'Session'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6e6e73', marginTop: 2 }}>
                      {s.created_at ? new Date(s.created_at).toLocaleString() : ''} · {s.reps ?? 0} reps
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <PatientBottomNav />
    </div>
  )
}
