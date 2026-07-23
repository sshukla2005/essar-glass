import React, { useState } from 'react'
import { Form, Input, Button, Typography, Space, App } from 'antd'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

const LoginPage = () => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const handleLogin = async (values) => {
    setLoading(true)
    try {
      // Call backend auth endpoint
      const formData = new FormData()
      formData.append('username', values.username)
      formData.append('password', values.password)

      const response = await fetch(
        'http://localhost:8000/api/v1/auth/login',
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const err = await response.json()
        message.error(err.detail || 'Invalid username or password')
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

      message.success(`Welcome, ${data.user.name}! 👋`)

      // Route based on role
      if (data.user.role === 'superadmin') {
        navigate('/super-dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      message.error('Connection error. Is the backend running?')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fff' }}>
      
      {/* LEFT SIDE — Login Form */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '40px' 
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 40 }}>
            <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>Welcome back</Title>
            <Text style={{ color: '#64748b', fontSize: 16 }}>Sign in to your account to continue</Text>
          </div>

          <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleLogin} 
            requiredMark={false}
          >
            <Form.Item 
              name="username" 
              label={<Text strong style={{ color: '#1e293b' }}>Email or Username</Text>}
              rules={[{ required: true, message: 'Please enter your username' }]}
              style={{ marginBottom: 24 }}
            >
              <Input 
                placeholder="admin" 
                style={{ height: 50, borderRadius: 10, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item 
              name="password" 
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Text strong style={{ color: '#1e293b' }}>Password</Text>
                  <Text style={{ color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}></Text>
                </div>
              }
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 32 }}
            >
              <Input.Password 
                placeholder="••••••••"
                style={{ height: 50, borderRadius: 10, fontSize: 15 }}
              />
            </Form.Item>

            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              style={{ 
                height: 50, 
                borderRadius: 10, 
                backgroundColor: '#1a337e', 
                border: 'none',
                fontSize: 16,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(26, 51, 126, 0.2)'
              }}
            >
              Sign In
            </Button>
          </Form>

          <div style={{ marginTop: 40 }}>
            <div style={{ background: '#f8faff', borderRadius: 8, padding: '10px 14px' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                🔑 Demo Credentials:
              </Text>
              <div style={{ fontSize: 12, lineHeight: 2 }}>
                <Text>Super Admin: </Text><Text code>superadmin</Text>
                {' / '}<Text code>super@123</Text><br/>
                <Text>Admin (Essar): </Text><Text code>admin</Text>
                {' / '}<Text code>essar@123</Text><br/>
                <Text>Sales: </Text><Text code>sales</Text>
                {' / '}<Text code>sales@123</Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — Branding Area */}
      <div style={{ 
        flex: 1.2, 
        backgroundColor: '#1a337e', // Same Royal Blue as Sidebar
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '60px',
        color: '#fff',
        flexDirection: 'column',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: 80, height: 80, backgroundColor: '#fff', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, padding: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <img src="/src/public/Essar-logo.webp" alt="Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
        </div>
        
        <Title level={1} style={{ color: '#fff', fontSize: 48, fontWeight: 800, margin: '0 0 16px 0' }}>
          Essar Glass
        </Title>
        
        <Text style={{ 
          color: 'rgba(255,255,255,0.7)', 
          fontSize: 18, 
          maxWidth: 460, 
          lineHeight: 1.6,
          fontWeight: 500
        }}>
          The complete platform for glass manufacturing, order management, and operational tracking.
        </Text>
      </div>
    </div>
  )
}

export default LoginPage
