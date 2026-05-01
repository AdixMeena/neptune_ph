// src/pages/patient/PatientHealthChat.jsx
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'
import PatientHeader from '../../components/PatientHeader.jsx'
import { AuthContext } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'

const API_KEY = import.meta.env.VITE_GROQ_API_KEY

const SYSTEM_PROMPT = `You are Phoenix Health Assistant, an AI health companion embedded inside Phoenix-AI, a physiotherapy rehabilitation app. 

Your role is to help patients understand their health, recovery journey, exercises, and general wellbeing. You are warm, clear, and clinically grounded.

Guidelines:
- Answer health and physiotherapy related questions clearly and concisely
- When discussing exercises, relate them to rehabilitation and recovery
- For pain or symptoms, always suggest consulting their assigned doctor for diagnosis
- Never diagnose conditions — you provide information and guidance only
- Keep responses focused and mobile-friendly (short paragraphs, no walls of text)
- If someone describes a medical emergency, immediately tell them to call emergency services
- You are aware the patient is using a rehabilitation app and may be recovering from injury or surgery
- Be encouraging about their recovery journey
- Format responses with line breaks for readability but avoid markdown headers or bullet symbols — use plain text only

Always end responses about serious symptoms with: "Please share this with your doctor through the Feedback section."

You are not a replacement for medical advice. You are a supportive health companion.`

const SUGGESTED_QUESTIONS = [
  "Why does my knee feel stiff after exercise?",
  "How much pain is normal during rehab?",
  "What foods help with muscle recovery?",
  "Can I exercise if I'm feeling sore?",
  "How do I know if I'm doing an exercise correctly?",
  "What should I do if I miss a session?",
]

// Phoenix logo SVG
function PhoenixLogo({ size = 22, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 750 750" xmlns="http://www.w3.org/2000/svg">
      <path fill={color} strokeWidth="0" d="m208.00003,254.6l3.6,-0.6c-20.9,9.9 -49,30.4 -67.8,44.9c-30.4,23.3 -54.1,57.9 -74,92.9c84.1,-45.7 161.8,-52.4 178.5,-48.2c0.2,0.1 -7.7,45.5 -36.7,83.6c-30.5,39.9 -82.2,72.4 -82.2,72.4c18.9,2.2 37.9,2.6 56.7,0.8c32.2,-3 65.3,-12.4 91.5,-34.7c11.6,-9.9 32.8,-39 30.5,-34.8c-12.5,31.2 -14.3,66.7 -12.3,100.6c1.1,19.9 3.2,39.6 9.1,58.4c5,16.1 12.3,31.2 20.6,45.3l8.2,6.5c0.1,-0.7 -7.9,-111.8 48.5,-166.7c102.6,-99.8 216,-4.9 216,-4.9s-4.5,-75.2 -89.6,-111.7c203.8,-18.8 159.7,102 159.7,102s69.8,-29.8 59.1,-114.9c-9.7,-77 -85,-95.3 -100.7,-98.3c-13.2,-21.7 -113.2,-186.8 -279.8,-121.9c-180.6,70.3 -326.9,53.6 -326.9,53.6c21.5,24.7 46.7,44.6 74.1,58.7c35.6,18.4 75.3,23.8 113.9,17zm314,-15.9c6.3,2.1 12.7,4.2 19.1,6.2c-0.5,6.1 -4.8,10.9 -10,10.9c-5.5,0 -10.1,-5.4 -10.1,-12.1c0.1,-1.8 0.4,-3.5 1,-5zm-40.1,2.4c0,-5.1 0.9,-9.9 2.6,-14.4c3.8,0.9 7.6,1.8 11.2,3c3.8,1.2 7.5,2.5 11.3,3.8c-1.1,3.1 -1.8,6.5 -1.8,10.1c0,15.4 11.6,27.9 25.9,27.9c12.6,0 23,-9.7 25.4,-22.5c2.7,0.6 5.3,1.3 8,1.8c-4.4,18.5 -20.9,32.3 -40.7,32.3c-23.2,0 -41.9,-18.8 -41.9,-42z" />
    </svg>
  )
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#6e6e73',
          animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = message.isError

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 16,
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: isError ? '#ff3b3015' : '#0071e3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginBottom: 18,
        }}>
          {isError
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            : <PhoenixLogo size={16} color="#fff" />
          }
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
        {!isUser && (
          <span style={{ fontSize: 11, fontWeight: 600, color: isError ? '#ff3b30' : '#0071e3', paddingLeft: 4 }}>
            {isError ? 'Error' : 'Phoenix Health AI'}
          </span>
        )}

        <div style={{
          background: isUser ? '#0071e3' : isError ? '#fff5f5' : '#fff',
          color: isUser ? '#fff' : isError ? '#ff3b30' : '#1d1d1f',
          border: isUser ? 'none' : `1px solid ${isError ? '#ff3b3030' : '#e5e5ea'}`,
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '12px 16px',
          fontSize: 15,
          lineHeight: 1.6,
          letterSpacing: '-0.2px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: isUser ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          {message.content}
        </div>

        <span style={{ fontSize: 10, color: '#86868b', paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default function PatientHealthChat() {
  const { user } = useContext(AuthContext)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggested, setShowSuggested] = useState(true)
  const [inputFocused, setInputFocused] = useState(false)
  const [doctorName, setDoctorName] = useState('Call Doctor')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const chatHistoryRef = useRef([])

  useEffect(() => {
    async function getDoctor() {
      if (!user) return
      try {
        const { data: pData } = await supabase
          .from('patients')
          .select('doctor_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (pData?.doctor_id) {
          const { data: dProf } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', pData.doctor_id)
            .maybeSingle()
          if (dProf?.name) setDoctorName(dProf.name)
        }
      } catch (e) {
        console.error("Error fetching doctor:", e)
      }
    }
    getDoctor()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg = { role: 'user', content: trimmed, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setShowSuggested(false)
    chatHistoryRef.current.push({ role: 'user', content: trimmed })

    try {
      if (!API_KEY) throw new Error('NO_KEY')

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 600,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistoryRef.current,
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const replyText = data.choices?.[0]?.message?.content || 'Sorry, I did not get a response. Please try again.'

      chatHistoryRef.current.push({ role: 'assistant', content: replyText })

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: replyText,
        timestamp: new Date(),
      }])

    } catch (err) {
      let errorMsg = 'Something went wrong. Please check your connection and try again.'
      if (err.message === 'NO_KEY') errorMsg = 'API key not configured. Add VITE_GROQ_API_KEY to your .env file.'
      else if (err.message?.includes('401')) errorMsg = 'Invalid API key. Please check your VITE_GROQ_API_KEY in .env.'
      else if (err.message?.includes('429')) errorMsg = 'Too many requests. Please wait a moment and try again.'

      chatHistoryRef.current.pop()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
        isError: true,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearChat() {
    setMessages([])
    chatHistoryRef.current = []
    setShowSuggested(true)
    setInput('')
  }

  const hasMessages = messages.length > 0

  return (
    <div style={{
      background: '#f5f5f7',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter", sans-serif',
    }}>
      <PatientHeader />

      {/* Disclaimer strip */}
      <div style={{ background: '#fff8e6', borderBottom: '1px solid #ff9f0a20', flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff9f0a" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 11, color: '#86868b', margin: 0, fontWeight: 500 }}>
            Phoenix Health AI provides general guidance only. Always consult your doctor for medical decisions.
          </p>
        </div>
      </div>

      {/* Doctor Contact Strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#0071e310', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>{doctorName}</div>
              <div style={{ fontSize: 11, color: '#6e6e73' }}>+91 7489877983</div>
            </div>
          </div>
          <a
            href="tel:+917489877983"
            style={{
              background: '#0071e3', color: '#fff',
              border: 'none', borderRadius: 12,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.2s',
              boxShadow: '0 2px 8px rgba(0,113,227,0.25)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Call now
          </a>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '24px 24px 16px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}>

          {/* Empty / welcome state */}
          {!hasMessages && showSuggested && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 24 }}>

              {/* Welcome card */}
              <div style={{
                background: '#fff',
                borderRadius: 20,
                padding: '32px 24px',
                border: '1px solid #e5e5ea',
                marginBottom: 20,
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {/* Logo */}
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: '#0071e3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 4px 16px rgba(0,113,227,0.25)',
                }}>
                  <PhoenixLogo size={36} color="#fff" />
                </div>

                <h2 style={{
                  fontSize: 22, fontWeight: 600, color: '#1d1d1f',
                  fontFamily: '"Inter Tight", sans-serif',
                  marginBottom: 10, letterSpacing: '-0.3px',
                }}>
                  Hi, I'm your health companion
                </h2>
                <p style={{ fontSize: 15, color: '#6e6e73', lineHeight: 1.6, margin: 0, maxWidth: 380, marginInline: 'auto' }}>
                  Ask me anything about your recovery, exercises, pain management, or general wellbeing.
                </p>
              </div>

              {/* Suggested questions */}
              <p style={{
                fontSize: 11, fontWeight: 600, color: '#86868b',
                marginBottom: 10, textAlign: 'center',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Suggested questions
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e5ea',
                      borderRadius: 14,
                      padding: '13px 18px',
                      fontSize: 14, color: '#1d1d1f', fontWeight: 400,
                      textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      transition: 'border-color 0.15s, background 0.15s',
                      fontFamily: '"Inter", sans-serif',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.background = '#f0f7ff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e5ea'; e.currentTarget.style.background = '#fff' }}
                  >
                    <span>{q}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b0b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {hasMessages && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Clear chat button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <button
                  onClick={clearChat}
                  style={{
                    fontSize: 12, color: '#86868b', background: '#fff',
                    border: '1px solid #e5e5ea', borderRadius: 20,
                    padding: '5px 14px', cursor: 'pointer',
                    fontFamily: '"Inter", sans-serif',
                  }}
                >
                  Clear chat
                </button>
              </div>

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: '#0071e3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <PhoenixLogo size={16} color="#fff" />
                  </div>
                  <div style={{
                    background: '#fff', border: '1px solid #e5e5ea',
                    borderRadius: '18px 18px 18px 4px',
                    padding: '10px 16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    <TypingDots />
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #e5e5ea',
        flexShrink: 0,
        paddingBottom: 72, // clearance for PatientBottomNav
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: '#f5f5f7',
            borderRadius: 22,
            border: `1.5px solid ${inputFocused ? '#0071e3' : '#e5e5ea'}`,
            padding: '10px 10px 10px 18px',
            transition: 'border-color 0.15s',
            boxShadow: inputFocused ? '0 0 0 3px rgba(0,113,227,0.1)' : 'none',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Ask anything about your health..."
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 15, color: '#1d1d1f', lineHeight: 1.6,
                resize: 'none', fontFamily: '"Inter", sans-serif',
                paddingTop: 2, paddingBottom: 2,
                maxHeight: 120, overflowY: 'auto',
              }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38,
                borderRadius: '50%',
                flexShrink: 0,
                background: input.trim() && !loading ? '#0071e3' : '#d2d2d7',
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, transform 0.1s',
                boxShadow: input.trim() && !loading ? '0 2px 8px rgba(0,113,227,0.3)' : 'none',
              }}
              onMouseDown={e => input.trim() && !loading && (e.currentTarget.style.transform = 'scale(0.9)')}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <p style={{ fontSize: 10, color: '#b0b0b8', textAlign: 'center', marginTop: 8 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      <PatientBottomNav />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}