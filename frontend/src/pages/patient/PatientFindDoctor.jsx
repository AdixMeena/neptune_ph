import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { AuthContext } from '../../App.jsx'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'
import { Card } from '../../components/UI.jsx'

export default function PatientFindDoctor() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [doctors, setDoctors] = useState([])
  const [requests, setRequests] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDoctors() {
      if (!user) return
      setError('')
      setLoading(true)

      const { data: doctorRows, error: doctorError } = await supabase
        .from('profiles')
        .select('id, name, specialization, role')
        .eq('role', 'doctor')
        .order('name', { ascending: true })

      if (doctorError) {
        if (isMounted) {
          setError(doctorError.message)
          setLoading(false)
        }
        return
      }

      const { data: connectionRows, error: connectionError } = await supabase
        .from('connections')
        .select('doctor_id, status')
        .eq('patient_id', user.id)

      if (connectionError) {
        if (isMounted) {
          setError(connectionError.message)
          setLoading(false)
        }
        return
      }

      const statusMap = {}
      ;(connectionRows || []).forEach(row => {
        statusMap[row.doctor_id] = row.status
      })

      if (isMounted) {
        setDoctors(doctorRows || [])
        setRequests(statusMap)
        setLoading(false)
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [user])

  async function handleRequest(doctorId) {
    if (!user) return
    setError('')
    const { error: insertError } = await supabase
      .from('connections')
      .insert({ patient_id: user.id, doctor_id: doctorId, status: 'pending' })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setRequests(prev => ({ ...prev, [doctorId]: 'pending' }))
  }

  async function handleRemove(doctorId) {
    if (!user) return
    setError('')

    const { error: deleteError } = await supabase
      .from('connections')
      .delete()
      .eq('patient_id', user.id)
      .eq('doctor_id', doctorId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setRequests(prev => {
      const next = { ...prev }
      delete next[doctorId]
      return next
    })
  }

  return (
    <div style={{ background: '#f5f5f7', minHeight: '100vh', paddingBottom: 88 }}>

      {/* Sticky header */}
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
              fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 0,
            }}
          >
            ← Back
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 32, fontWeight: 600, color: '#1d1d1f',
            fontFamily: '"Inter Tight", sans-serif', margin: 0,
          }}>
            Find a doctor
          </h1>
          <p style={{ fontSize: 17, color: '#6e6e73', marginTop: 8 }}>
            Request a connection to unlock your exercises and feedback.
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
          <div style={{ textAlign: 'center', color: '#6e6e73', fontSize: 14 }}>
            Loading doctors...
          </div>
        )}

        {!loading && doctors.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6e6e73', fontSize: 14 }}>
            No doctors found yet.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {doctors.map(doctor => {
            const status = requests[doctor.id]
            const isPending = status === 'pending'
            const isApproved = status === 'approved'
            const isRejected = status === 'rejected'
            const label = isApproved ? 'Connected' : isPending ? 'Requested' : isRejected ? 'Rejected' : 'Request'

            return (
              <Card key={doctor.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1d1d1f' }}>{doctor.name}</div>
                  <div style={{ fontSize: 13, color: '#6e6e73', marginTop: 4 }}>{doctor.specialization || 'Physiotherapist'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => handleRequest(doctor.id)}
                    disabled={isPending || isApproved}
                    style={{
                      background: isApproved ? '#34c759' : '#0071e3',
                      color: '#fff', border: 'none', borderRadius: 10,
                      padding: '8px 14px', fontSize: 12, fontWeight: 600,
                      cursor: isPending || isApproved ? 'default' : 'pointer',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {label}
                  </button>
                  {(isApproved || isPending) && (
                    <button
                      onClick={() => handleRemove(doctor.id)}
                      style={{
                        background: '#fff', color: '#ff3b30', border: '1px solid #ff3b3030',
                        borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </main>

      <PatientBottomNav />
    </div>
  )
}
