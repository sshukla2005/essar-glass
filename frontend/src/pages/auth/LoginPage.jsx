import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginPage.css'

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const usernameInputRef = useRef(null)
  const canvasRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    // AA6: Autofocus the username field on mount
    if (usernameInputRef.current) {
      usernameInputRef.current.focus()
    }
  }, [])

  // AA4: Halved intensity mouse-tracking light
  const handleMouseMove = (e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    canvasRef.current.style.setProperty('--mouse-x', `${x}px`)
    canvasRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    try {
      // Call backend auth endpoint
      const formData = new FormData()
      formData.append('username', username)
      formData.append('password', password)

      const response = await fetch(
        'http://localhost:8000/api/v1/auth/login',
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const err = await response.json()
        setErrorMessage(err.detail || 'Invalid username or password')
        setLoading(false)
        return
      }

      const data = await response.json()

      // Store JWT token and user info
      localStorage.setItem('auth_token', data.access_token)
      localStorage.setItem('auth_user', JSON.stringify(data.user))

      // ── Superadmin: ensure a concrete company scope is always set ──────
      // If the login token carries active_company_id = null the backend's
      // apply_company_filter skips filtering entirely and the user sees ALL
      // companies' data.  Immediately switch to home_company_id (or the
      // first available company) so the JWT is always scoped.
      if (data.user?.role === 'superadmin' && !data.active_company_id) {
        const fallbackId =
          data.user?.home_company_id ||
          data.user?.company_id ||
          null

        if (fallbackId) {
          try {
            const switchRes = await fetch(
              'http://localhost:8000/api/v1/auth/switch-company',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${data.access_token}`,
                },
                body: JSON.stringify({ company_id: fallbackId }),
              }
            )
            if (switchRes.ok) {
              const switchData = await switchRes.json()
              // Replace the initial token with the scoped one
              localStorage.setItem('auth_token', switchData.access_token)
              localStorage.setItem('active_company_id', String(fallbackId))
            }
          } catch {}
        }
      }

      // Route based on role
      if (data.user.role === 'superadmin') {
        navigate('/super-dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      setErrorMessage('Connection error. Is the backend running?')
    }
    setLoading(false)
  }

  const gaugeThicknesses = [
    { label: '04', class: 't-04' },
    { label: '05', class: 't-05' },
    { label: '06', class: 't-06', active: true },
    { label: '08', class: 't-08' },
    { label: '10', class: 't-10' },
    { label: '12', class: 't-12' },
  ]

  const companyChips = [
    { code: 'ESSAR', lit: true },
    { code: 'EXCEL', lit: false },
    { code: 'ALFA-E', lit: false },
    { code: 'ALFA-L', lit: false },
  ]

  return (
    <div
      ref={canvasRef}
      className="login-canvas"
      onMouseMove={handleMouseMove}
    >
      {/* ── Background Translucent Glass Panes & Cursor Light ── */}
      <div className="glass-panes-bg">
        <div className="pane pane-1"></div>
        <div className="pane pane-2"></div>
        <div className="pane pane-3"></div>
        <div className="pane pane-4"></div>
      </div>
      <div className="cursor-light"></div>

      {/* ── Header ── */}
      <header className="login-header">
        <div className="header-brand">
          <span className="wordmark">ESSAR GLASS</span>
          <span className="brand-sub">Manufacturing & Processing</span>
        </div>
        <div className="header-chips">
          {companyChips.map((chip) => (
            <span
              key={chip.code}
              className={`chip ${chip.lit ? 'lit' : ''}`}
            >
              {chip.code}
            </span>
          ))}
        </div>
      </header>

      {/* ── Centred Middle Section ── */}
      <main className="login-middle">
        <div className="console-wrapper">
          {/* Thickness Gauge */}
          <div className="gauge-column" aria-hidden="true">
            {gaugeThicknesses.map((item) => (
              <div
                key={item.label}
                className={`gauge-item ${item.active ? 'active' : ''}`}
              >
                <span className="gauge-label">{item.label}</span>
                <div className="gauge-bar-track">
                  <div className={`gauge-bar ${item.class}`}></div>
                  {/* AA4: Brass marker static on one thickness (06) */}
                  {item.active && <div className="brass-marker"></div>}
                </div>
              </div>
            ))}
          </div>

          {/* Sign-in Column */}
          <div className="signin-column">
            <div className="signin-header">
              <span className="eyebrow">OPERATIONS CONSOLE</span>
              <h1 className="signin-title">Sign in to the floor.</h1>
              <p className="signin-desc">
                Enter your credentials to access system routing and dispatch.
              </p>
            </div>

            {/* AA6: Inline Error Alert */}
            {errorMessage && (
              <div className="inline-error" role="alert">
                <span className="inline-error-icon">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleLogin}>
              <div className="field-group">
                <label className="field-label" htmlFor="login-username">
                  USERNAME
                </label>
                <div className="input-wrapper">
                  <input
                    id="login-username"
                    ref={usernameInputRef}
                    type="text"
                    className="console-input"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="login-password">
                  PASSWORD
                </label>
                <div className="input-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="console-input password-input"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-pwd-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    <span>SIGNING IN...</span>
                  </>
                ) : (
                  <span>SIGN IN</span>
                )}
              </button>

              <p className="helper-text">
                Protected operational network. All sessions logged.
              </p>
            </form>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="login-footer">
        <span className="footer-left">Virar West · Palghar · Maharashtra</span>
        <span className="footer-right">Four companies · One system</span>
      </footer>
    </div>
  )
}

export default LoginPage
