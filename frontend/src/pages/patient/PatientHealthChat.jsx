// src/pages/patient/PatientHealthChat.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react'
import PatientBottomNav from '../../components/PatientBottomNav.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Message bubble ────────────────────────────────────────────────────────────

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
      {/* Avatar — only for AI */}
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: isError ? '#ff3b3015' : 'linear-gradient(135deg, #0071e3, #34c759)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginBottom: 18,
        }}>
          {isError
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          }
        </div>
      )}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
        {/* Sender label */}
        {!isUser && (
          <span style={{ fontSize: 11, fontWeight: 600, color: isError ? '#ff3b30' : '#0071e3', paddingLeft: 4 }}>
            {isError ? 'Error' : 'Phoenix Health AI'}
          </span>
        )}

        {/* Bubble */}
        <div style={{
          background: isUser ? '#0071e3' : isError ? '#fff5f5' : '#fff',
          color: isUser ? '#fff' : isError ? '#ff3b30' : '#1d1d1f',
          border: isUser ? 'none' : `1px solid ${isError ? '#ff3b3030' : '#d2d2d7'}`,
          borderRadius: isUser
            ? '18px 18px 4px 18px'
            : '18px 18px 18px 4px',
          padding: '12px 16px',
          fontSize: 15,
          lineHeight: 1.5,
          letterSpacing: '-0.2px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>

        {/* Timestamp */}
        <span style={{ fontSize: 10, color: '#86868b', paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientHealthChat() {
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [showSuggested, setShowSuggested] = useState(true)
  const [inputFocused, setInputFocused]   = useState(false)
  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const chatHistoryRef  = useRef([]) // keeps full conversation history for multi-turn context

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Send message to Groq API
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg = { role: 'user', content: trimmed, timestamp: new Date() }

    // Add user message to UI
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setShowSuggested(false)

    // Add to history for multi-turn context
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

      // Add assistant reply to history
      chatHistoryRef.current.push({ role: 'assistant', content: replyText })

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: replyText,
        timestamp: new Date(),
      }])

    } catch (err) {
      let errorMsg = 'Something went wrong. Please check your connection and try again.'
      if (err.message === 'NO_KEY') {
        errorMsg = 'API key not configured. Add VITE_GROQ_API_KEY to your .env file.'
      } else if (err.message?.includes('401')) {
        errorMsg = 'Invalid API key. Please check your VITE_GROQ_API_KEY in .env.'
      } else if (err.message?.includes('429')) {
        errorMsg = 'Too many requests. Please wait a moment and try again.'
      }

      // Remove the failed user message from history
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

  function handleSuggestion(q) {
    sendMessage(q)
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
      background: '#f5f5f7', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter", sans-serif',
      position: 'relative',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #d2d2d7',
        padding: '52px 24px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* AI Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0071e3, #34c759)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', margin: 0, fontFamily: '"Inter Tight", sans-serif' }}>
                Phoenix Health AI
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34c759', animation: 'pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: '#34c759', fontWeight: 600 }}>Online</span>
              </div>
            </div>
          </div>

          {/* Clear button — only show when there are messages */}
          {hasMessages && (
            <button onClick={clearChat} style={{
              background: 'none', border: '1px solid #d2d2d7',
              borderRadius: 980, padding: '5px 14px',
              fontSize: 12, fontWeight: 600, color: '#6e6e73',
              cursor: 'pointer',
            }}>Clear</button>
          )}
        </div>

        {/* Disclaimer strip */}
        <div style={{
          background: '#fff8e6', borderRadius: 10,
          padding: '8px 12px', marginBottom: 12,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9f0a" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ fontSize: 11, color: '#86868b', lineHeight: 1.4, margin: 0 }}>
            For general guidance only. Always consult your doctor for diagnosis and treatment decisions.
          </p>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px 16px',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Empty state + suggested questions */}
        {!hasMessages && showSuggested && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Welcome card */}
            <div style={{
              background: '#fff', borderRadius: 20, padding: 24,
              border: '1px solid #d2d2d7', marginBottom: 24, textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0071e3, #34c759)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 600, color: '#1d1d1f', fontFamily: '"Inter Tight", sans-serif', marginBottom: 8 }}>
                Hi, I'm your health companion
              </h2>
              <p style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5, margin: 0 }}>
                Ask me anything about your recovery, exercises, pain management, or general health. I'm here to help.
              </p>
            </div>

            {/* Suggested questions */}
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#86868b', marginBottom: 12, textAlign: 'center', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Suggested questions
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => handleSuggestion(q)} style={{
                    background: '#fff', border: '1px solid #d2d2d7',
                    borderRadius: 14, padding: '12px 16px',
                    fontSize: 14, color: '#1d1d1f', fontWeight: 400,
                    textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: '"Inter", sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.background = '#f0f7ff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#d2d2d7'; e.currentTarget.style.background = '#fff' }}
                  >
                    <span>{q}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6e6e73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message list */}
        {hasMessages && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0071e3, #34c759)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div style={{
                  background: '#fff', border: '1px solid #d2d2d7',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '10px 16px',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #d2d2d7',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        flexShrink: 0,
        marginBottom: 64, // above bottom nav
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: '#f5f5f7',
          borderRadius: 20,
          border: `1px solid ${inputFocused ? '#0071e3' : '#d2d2d7'}`,
          padding: '8px 8px 8px 16px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              // Auto-resize
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
              fontSize: 15, color: '#1d1d1f', lineHeight: 1.5,
              resize: 'none', fontFamily: '"Inter", sans-serif',
              paddingTop: 4, paddingBottom: 4,
              maxHeight: 120, overflowY: 'auto',
            }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !loading ? '#0071e3' : '#d2d2d7',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseDown={e => input.trim() && !loading && (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {/* Shift+Enter hint */}
        <p style={{ fontSize: 10, color: '#86868b', textAlign: 'center', marginTop: 6 }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <PatientBottomNav />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
