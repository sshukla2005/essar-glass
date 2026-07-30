import React, { useState, useEffect } from 'react'
import { Card, Typography, Form, Input, Button, Space, Alert, App, Divider } from 'antd'
import { SaveOutlined, ApiOutlined, RobotOutlined, KeyOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const AISettings = () => {
  const { message } = App.useApp()
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { success: boolean, message: string }

  useEffect(() => {
    const savedKey = localStorage.getItem('ai_api_key') || ''
    setApiKey(savedKey)
  }, [])

  const handleSave = () => {
    const trimmed = apiKey.trim()
    localStorage.setItem('ai_api_key', trimmed)
    message.success('Anthropic API Key saved successfully!')
  }

  const handleTestKey = async () => {
    const keyToTest = apiKey.trim()
    if (!keyToTest) {
      message.warning('Please enter an API Key to test')
      setTestResult({ success: false, message: 'No API Key entered.' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // The API key lives in the browser (localStorage) and is visible in DevTools/network to anyone
      // using this browser. Acceptable for trusted internal users; for public/multi-tenant use, proxy
      // these calls through the backend so the key stays server-side.
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keyToTest,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        }),
      })

      if (r.ok) {
        setTestResult({ success: true, message: 'API Key verified successfully!' })
        message.success('API Key is valid and working!')
      } else {
        const errText = await r.text()
        const errMsg = `API Error ${r.status}: ${errText.slice(0, 200)}`
        setTestResult({ success: false, message: errMsg })
        message.error(errMsg)
      }
    } catch (err) {
      const errMsg = `Connection Error: ${err.message || 'Failed to reach Anthropic API'}`
      setTestResult({ success: false, message: errMsg })
      message.error(errMsg)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
        <Link to="/">Home</Link> / <Link to="/settings">Settings</Link> / AI Assistant
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: '#6366f1' }} /> AI Assistant Settings
          </Title>
          <Text type="secondary">Configure your Anthropic API Key to enable the AI ERP Assistant</Text>
        </div>
        <Space>
          <Button
            type="default"
            icon={<ApiOutlined />}
            loading={testing}
            onClick={handleTestKey}
          >
            Test Connection
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            style={{ background: '#6366f1' }}
            onClick={handleSave}
          >
            Save Key
          </Button>
        </Space>
      </div>

      <Card>
        <Form layout="vertical">
          <Form.Item
            label={
              <span style={{ fontWeight: 600 }}>
                <KeyOutlined style={{ marginRight: 6 }} /> Anthropic API Key
              </span>
            }
            help={
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                🔒 Your key is stored in this browser only.{' '}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6366f1', textDecoration: 'underline' }}
                >
                  Get an Anthropic API Key
                </a>
              </div>
            }
          >
            <Input.Password
              size="large"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>

        {testResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={testResult.success ? 'success' : 'error'}
            message={testResult.success ? 'Success' : 'API Key Error'}
            description={testResult.message}
            showIcon
          />
        )}

        <Divider style={{ margin: '24px 0 16px' }} />

        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
            🤖 What can the AI Assistant do?
          </Text>
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            Once configured with a valid API key, the floating AI Assistant button allows you to use natural language to create leads, generate glass quotations, search active CRM records, view financial revenue summaries, and update deal statuses directly within Essar ERP.
          </Paragraph>
        </div>
      </Card>
    </div>
  )
}

export default AISettings
