import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import LandingPage from './pages/shared/LandingPage.jsx'
import LoginPage from './pages/shared/LoginPage.jsx'
import DoctorDashboard from './pages/doctor/DoctorDashboard.jsx'
import DoctorPatientDetail from './pages/doctor/DoctorPatientDetail.jsx'
import DoctorAssignExercise from './pages/doctor/DoctorAssignExercise.jsx'
import DoctorAddPatient from './pages/doctor/DoctorAddPatient.jsx'
import DoctorProfile from './pages/doctor/DoctorProfile.jsx'
import PatientDashboard from './pages/patient/PatientDashboard.jsx'
import PatientExerciseDetail from './pages/patient/PatientExerciseDetail.jsx'
import PatientCameraSession from './pages/patient/PatientCameraSession.jsx'
import PatientScoreScreen from './pages/patient/PatientScoreScreen.jsx'
import PatientFeedback from './pages/patient/PatientFeedback.jsx'
import PatientFindDoctor from './pages/patient/PatientFindDoctor.jsx'
import PatientProfile from './pages/patient/PatientProfile.jsx'
import PatientHealthChat from './pages/patient/PatientHealthChat.jsx'
import VantaBg from './components/VantaBg'


export const AuthContext = React.createContext(null)

// ── Spinner shown while we restore the session ──────────────
function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter Tight", sans-serif',
    }}>
      <div style={{ fontSize: 32, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
        Phoenix-AI
      </div>
      {/* Pulsing dot */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#0071e3',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}

// ── Route guards ─────────────────────────────────────────────
function RequireAuth({ user, role, allowedRole, children }) {
  if (!user) return <Navigate to="/login" replace />
  if (role && role !== allowedRole) return <Navigate to={role === 'doctor' ? '/doctor' : '/patient'} replace />
  return children
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Keep state in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <LoadingScreen />

  const role = user?.user_metadata?.role   // 'doctor' | 'patient'

  return (
    <div>
      <VantaBg />
      <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          {/* Root → redirect if already logged in */}
          <Route
            path="/"
            element={
              user
                ? <Navigate to={role === 'doctor' ? '/doctor' : '/patient'} replace />
                : <LandingPage />
            }
          />

          <Route
            path="/login"
            element={
              user
                ? <Navigate to={role === 'doctor' ? '/doctor' : '/patient'} replace />
                : <LoginPage />
            }
          />

          {/* ── Doctor routes ── */}
          <Route path="/doctor" element={
            <RequireAuth user={user} role={role} allowedRole="doctor">
              <DoctorDashboard />
            </RequireAuth>
          } />
          <Route path="/doctor/patient/:id" element={
            <RequireAuth user={user} role={role} allowedRole="doctor">
              <DoctorPatientDetail />
            </RequireAuth>
          } />
          <Route path="/doctor/assign/:id" element={
            <RequireAuth user={user} role={role} allowedRole="doctor">
              <DoctorAssignExercise />
            </RequireAuth>
          } />
          <Route path="/doctor/add-patient" element={
            <RequireAuth user={user} role={role} allowedRole="doctor">
              <DoctorAddPatient />
            </RequireAuth>
          } />
          <Route path="/doctor/profile" element={
            <RequireAuth user={user} role={role} allowedRole="doctor">
              <DoctorProfile />
            </RequireAuth>
          } />

          {/* ── Patient routes ── */}
          <Route path="/patient" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientDashboard />
            </RequireAuth>
          } />
          <Route path="/patient/exercise/:id" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientExerciseDetail />
            </RequireAuth>
          } />
          <Route path="/patient/session/:id" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientCameraSession />
            </RequireAuth>
          } />
          <Route path="/patient/score" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientScoreScreen />
            </RequireAuth>
          } />
          <Route path="/patient/feedback" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientFeedback />
            </RequireAuth>
          } />
          <Route path="/patient/find-doctor" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientFindDoctor />
            </RequireAuth>
          } />
          <Route path="/patient/profile" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientProfile />
            </RequireAuth>
          } />
          <Route path="/patient/chat" element={
            <RequireAuth user={user} role={role} allowedRole="patient">
              <PatientHealthChat />
            </RequireAuth>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AuthContext.Provider>
    </div>
  )
}
