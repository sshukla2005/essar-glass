import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginPage.css'

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const usernameInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (usernameInputRef.current) {
      usernameInputRef.current.focus()
    }
  }, [])

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

  const companyChips = [
    { code: 'ESSAR', active: true },
    { code: 'EXCEL', active: false },
    { code: 'ALFA-E', active: false },
    { code: 'ALFA-L', active: false },
  ]

  return (
    <>
      <div className="login-field">
        <img className="login-photo" src="/factory.jpg" alt="" loading="eager" />
        <div className="login-veil" />
      </div>
      <div className="login-shell">
        <header className="login-header">
          <div className="header-brand">
            <div className="brand-logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7L12 3L20 7V17L12 21L4 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 3V21" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/>
                <path d="M4 7L20 17" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
              </svg>
            </div>
            <div className="brand-text">
              <span className="wordmark">ESSAR GLASS</span>
              <span className="brand-sub">Manufacturing & Processing</span>
            </div>
          </div>
          <div className="header-chips">
            {companyChips.map((chip) => (
              <span
                key={chip.code}
                className={`chip ${chip.active ? 'active' : ''}`}
              >
                {chip.code}
              </span>
            ))}
          </div>
        </header>

        <main className="login-main">
          <div className="login-container">
            {/* Left side branding & features */}
            <div className="login-branding">
              <div className="brand-badge">
                <span className="badge-dot"></span>
                <span>PLANT OPERATIONS SYSTEM</span>
              </div>
              
              <h1 className="branding-title">
                WELCOME TO<br />
                OPERATIONS <span className="highlight">CONSOLE</span>
              </h1>
              
              <p className="branding-subtitle">
                Securely manage your plant operations, resources and production in one place.
              </p>

              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  </div>
                  <div className="feature-content">
                    <div className="feature-title">Real-time Insights</div>
                    <div className="feature-desc">Monitor performance in real time</div>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                  </div>
                  <div className="feature-content">
                    <div className="feature-title">End-to-End Control</div>
                    <div className="feature-desc">From raw material to finished glass</div>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <div className="feature-content">
                    <div className="feature-title">Secure & Reliable</div>
                    <div className="feature-desc">Enterprise-grade security</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side login card */}
            <div className="login-pane">
              <div className="pane-top-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>

              <div className="pane-header">
                <span className="eyebrow">OPERATIONS CONSOLE</span>
                <h2 className="pane-title">
                  Sign in to<br /><span className="title-accent">the floor.</span>
                </h2>
                <div className="title-accent-line" />
                <p className="pane-desc">
                  Enter your credentials to access system routing and dispatch.
                </p>
              </div>

              {errorMessage && (
                <div className="inline-error" role="alert">
                  <svg className="inline-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="field-group">
                  <label className="field-label" htmlFor="login-username">
                    USERNAME
                  </label>
                  <div className="input-wrapper">
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <input
                      id="login-username"
                      ref={usernameInputRef}
                      type="text"
                      className="login-input"
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
                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-input password-input"
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
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-options-row">
                  <label className="remember-label">
                    <input
                      type="checkbox"
                      className="remember-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
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
                    <>
                      <span>SIGN IN</span>
                      <svg className="btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </>
                  )}
                </button>

                <hr className="hairline" />

                <div className="helper-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  <p className="helper-text">
                    Protected operational network. All sessions logged.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </main>

        <footer className="login-footer">
          <span className="footer-left">VIRAR WEST <span className="footer-dot">•</span> PALGHAR <span className="footer-dot">•</span> MAHARASHTRA</span>
          <span className="footer-right">FOUR COMPANIES <span className="footer-dot">•</span> ONE SYSTEM</span>
        </footer>
      </div>
    </>
  )
}

export default LoginPage
