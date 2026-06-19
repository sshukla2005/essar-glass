import React, { useState, useEffect } from 'react'
import {
  Card, Button, Input, Select, Tag, Space,
  Typography, Divider, Popconfirm, App, Row, Col
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import { settingsApi } from '../../api/settingsApi'

const { Text, Title } = Typography

const STORAGE_KEY = 'payment_accounts'

const PaymentAccounts = () => {
  const { message } = App.useApp()
  const [accounts, setAccounts] = useState([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('upi')
  const [newDetail, setNewDetail] = useState('')

  useEffect(() => {
    settingsApi.get(STORAGE_KEY).then(data => {
      if (data && Array.isArray(data)) {
        setAccounts(data)
      } else {
        try {
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
          setAccounts(stored)
        } catch { setAccounts([]) }
      }
    }).catch(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        setAccounts(stored)
      } catch { setAccounts([]) }
    })
  }, [])

  const save = async (updated) => {
    setAccounts(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    await settingsApi.save(STORAGE_KEY, updated)
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newDetail.trim()) {
      message.warning('Enter name and account detail')
      return
    }
    const updated = [
      ...accounts,
      {
        id: Date.now(),
        type: newType,
        name: newName.trim(),
        detail: newDetail.trim(),
      },
    ]
    await save(updated)
    setNewName('')
    setNewDetail('')
    message.success('Account added!')
  }

  const handleDelete = async (id) => {
    await save(accounts.filter(a => a.id !== id))
    message.success('Account removed')
  }

  const upiAccounts = accounts.filter(a => a.type === 'upi')
  const neftAccounts = accounts.filter(a => a.type === 'neft')

  const AccountCard = ({ account }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: '#f8fafc', borderRadius: 8,
      border: '1px solid #e2e8f0', marginBottom: 8,
    }}>
      <Space>
        <Tag color={account.type === 'upi' ? 'blue' : 'green'}>
          {account.type.toUpperCase()}
        </Tag>
        <div>
          <Text strong style={{ fontSize: 13 }}>{account.name}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            {account.detail}
          </Text>
        </div>
      </Space>
      <Popconfirm
        title="Remove this account?"
        onConfirm={() => handleDelete(account.id)}
      >
        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a237e, #3949ab)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
      }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          💳 Payment Accounts
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
          Configure your UPI IDs and bank accounts — shown to staff when recording payments
        </Text>
      </div>

      {/* Add new */}
      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>
          Add New Account
        </Text>
        <Row gutter={12} align="middle">
          <Col span={5}>
            <Select
              value={newType}
              onChange={setNewType}
              style={{ width: '100%' }}
              options={[
                { value: 'upi', label: '📱 UPI' },
                { value: 'neft', label: '🏦 NEFT / Bank' },
              ]}
            />
          </Col>
          <Col span={7}>
            <Input
              placeholder={newType === 'upi' ? 'Name (e.g. HDFC UPI)' : 'Bank Name (e.g. HDFC Bank)'}
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </Col>
          <Col span={8}>
            <Input
              placeholder={newType === 'upi' ? 'UPI ID (e.g. essar@hdfcbank)' : 'Acc No / IFSC'}
              value={newDetail}
              onChange={e => setNewDetail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{ width: '100%', background: '#6366f1' }}
            >
              Add
            </Button>
          </Col>
        </Row>
      </Card>

      {/* UPI Accounts */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Tag color="blue">📱 UPI Accounts ({upiAccounts.length})</Tag>
        </Divider>
        {upiAccounts.length === 0
          ? <Text type="secondary">No UPI accounts added yet</Text>
          : upiAccounts.map(a => <AccountCard key={a.id} account={a} />)
        }
      </Card>

      {/* NEFT Accounts */}
      <Card style={{ borderRadius: 12 }}>
        <Divider orientation="left">
          <Tag color="green">🏦 Bank Accounts / NEFT ({neftAccounts.length})</Tag>
        </Divider>
        {neftAccounts.length === 0
          ? <Text type="secondary">No bank accounts added yet</Text>
          : neftAccounts.map(a => <AccountCard key={a.id} account={a} />)
        }
      </Card>
    </div>
  )
}

export default PaymentAccounts
