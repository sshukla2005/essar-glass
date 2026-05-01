import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Divider, App } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

// Simple localStorage-based auth
// Default credentials: admin / essar@123
const USERS = [
  { username: 'admin',   password: 'essar@123',  name: 'Admin',          role: 'admin' },
  { username: 'sales',   password: 'sales@123',  name: 'Sales Manager',  role: 'sales' },
  { username: 'accounts',password: 'acc@123',    name: 'Accounts',       role: 'accounts' },
]

const LoginPage = () => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const handleLogin = async (values) => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 800)) // simulate auth
    
    const user = USERS.find(u => 
      u.username === values.username && u.password === values.password
    )
    
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user))
      localStorage.setItem('auth_token', 'essar_token_' + Date.now())
      message.success(`Welcome back, ${user.name}! 👋`)
      navigate('/')
    } else {
      message.error('Invalid username or password')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a237e 0%, #283593 40%, #3949ab 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Background glass effect elements */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,215,0,0.08)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(60px)' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28, fontWeight: 900, color: '#1a237e',
            boxShadow: '0 8px 32px rgba(255,215,0,0.3)',
          }}>
            EG
          </div>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>ESSAR Glass</Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            AN ESSAR GROUP COMPANY
          </Text>
        </div>

        {/* Login Card */}
        <Card style={{
          borderRadius: 16,
          border: 'none',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
        }}>
          <Title level={4} style={{ marginBottom: 4, textAlign: 'center' }}>Welcome Back 👋</Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
            Sign in to your ERP account
          </Text>

          <Form form={form} layout="vertical" onFinish={handleLogin} size="large">
            <Form.Item 
              name="username" 
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Enter username"
              />
            </Form.Item>

            <Form.Item 
              name="password" 
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Enter password"
                iconRender={visible => visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />}
              />
            </Form.Item>

            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              size="large"
              style={{ 
                height: 48, fontSize: 16, fontWeight: 600,
                background: 'linear-gradient(135deg, #1a237e, #3949ab)',
                border: 'none', borderRadius: 10,
              }}
            >
              Sign In
            </Button>
          </Form>

          <Divider style={{ margin: '20px 0 12px' }} />
          
          {/* Demo credentials */}
          <div style={{ background: '#f8faff', borderRadius: 8, padding: '10px 14px' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              🔑 Demo Credentials:
            </Text>
            <Text style={{ fontSize: 12 }}>
              Admin: <Text code>admin</Text> / <Text code>essar@123</Text>
            </Text>
          </div>
        </Card>

        <Text style={{ color: 'rgba(255,255,255,0.5)', display: 'block', textAlign: 'center', marginTop: 24, fontSize: 12 }}>
          © 2026 Essar Sons, Vasai Virar. All rights reserved.
        </Text>
      </div>
    </div>
  )
}

export default LoginPage
