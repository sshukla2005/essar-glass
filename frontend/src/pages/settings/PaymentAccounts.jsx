import React, { useState, useEffect } from 'react'
import {
  Card, Button, Input, Select, Tag, Space,
  Typography, Divider, Popconfirm, App, Row, Col, Modal
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined } from '@ant-design/icons'
import { settingsApi } from '../../api/settingsApi'

const { Text, Title } = Typography

const STORAGE_KEY = 'payment_accounts'

const PaymentAccounts = () => {
  const { message } = App.useApp()
  const [accounts, setAccounts] = useState([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('upi')
  const [newDetail, setNewDetail] = useState('')

  // Bank detail fields for NEFT accounts
  const [newBankAcName, setNewBankAcName] = useState('')
  const [newBankAcNo, setNewBankAcNo] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [newBankBranch, setNewBankBranch] = useState('')
  const [newBankIfsc, setNewBankIfsc] = useState('')

  // Modal edit state
  const [editingAccount, setEditingAccount] = useState(null)

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

  const resetAddForm = () => {
    setNewName('')
    setNewDetail('')
    setNewBankAcName('')
    setNewBankAcNo('')
    setNewBankName('')
    setNewBankBranch('')
    setNewBankIfsc('')
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newDetail.trim()) {
      message.warning('Enter name and account detail')
      return
    }
    const newAccount = {
      id: Date.now(),
      type: newType,
      name: newName.trim(),
      detail: newDetail.trim(),
      ...(newType === 'neft' ? {
        bank_ac_name: newBankAcName.trim(),
        bank_ac_no: newBankAcNo.trim(),
        bank_name: newBankName.trim(),
        bank_branch: newBankBranch.trim(),
        bank_ifsc: newBankIfsc.trim().toUpperCase(),
      } : {}),
    }
    const updated = [...accounts, newAccount]
    await save(updated)
    resetAddForm()
    message.success('Account added!')
  }

  const handleDelete = async (id) => {
    await save(accounts.filter(a => a.id !== id))
    message.success('Account removed')
  }

  const handleOpenEdit = (acc) => {
    setEditingAccount({
      ...acc,
      bank_ac_name: acc.bank_ac_name || '',
      bank_ac_no: acc.bank_ac_no || '',
      bank_name: acc.bank_name || '',
      bank_branch: acc.bank_branch || '',
      bank_ifsc: acc.bank_ifsc || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingAccount.name.trim() || !editingAccount.detail.trim()) {
      message.warning('Enter name and account detail')
      return
    }
    const updatedAccount = {
      ...editingAccount,
      name: editingAccount.name.trim(),
      detail: editingAccount.detail.trim(),
      ...(editingAccount.type === 'neft' ? {
        bank_ac_name: editingAccount.bank_ac_name.trim(),
        bank_ac_no: editingAccount.bank_ac_no.trim(),
        bank_name: editingAccount.bank_name.trim(),
        bank_branch: editingAccount.bank_branch.trim(),
        bank_ifsc: editingAccount.bank_ifsc.trim().toUpperCase(),
      } : {}),
    }
    const updated = accounts.map(a => a.id === editingAccount.id ? updatedAccount : a)
    await save(updated)
    setEditingAccount(null)
    message.success('Account updated!')
  }

  const upiAccounts = accounts.filter(a => a.type === 'upi')
  const neftAccounts = accounts.filter(a => a.type === 'neft')

  const AccountCard = ({ account }) => {
    const bankInfoParts = []
    if (account.bank_name) bankInfoParts.push(account.bank_name)
    if (account.bank_ac_no) bankInfoParts.push(`A/c ${account.bank_ac_no}`)
    if (account.bank_ifsc) bankInfoParts.push(account.bank_ifsc)
    const bankLine = bankInfoParts.join(' · ')

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: '#f8fafc', borderRadius: 8,
        border: '1px solid #e2e8f0', marginBottom: 8,
      }}>
        <Space align="center">
          <Tag color={account.type === 'upi' ? 'blue' : 'green'}>
            {account.type.toUpperCase()}
          </Tag>
          <div>
            <div>
              <Text strong style={{ fontSize: 13 }}>{account.name}</Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {account.detail}
              </Text>
            </div>
            {account.bank_ac_no && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2, color: '#64748b' }}>
                {bankLine}
              </Text>
            )}
          </div>
        </Space>
        <Space>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(account)}
          />
          <Popconfirm
            title="Remove this account?"
            onConfirm={() => handleDelete(account.id)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>
    )
  }

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

        {newType === 'neft' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Bank Account Details (Optional — feeds PDF bank block)
            </Text>
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Input
                  placeholder="A/c Holder Name"
                  value={newBankAcName}
                  onChange={e => setNewBankAcName(e.target.value)}
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="A/c Number"
                  value={newBankAcNo}
                  onChange={e => setNewBankAcNo(e.target.value)}
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="IFSC Code"
                  value={newBankIfsc}
                  onChange={e => setNewBankIfsc(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                />
              </Col>
              <Col span={12}>
                <Input
                  placeholder="Bank Name"
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                />
              </Col>
              <Col span={12}>
                <Input
                  placeholder="Branch"
                  value={newBankBranch}
                  onChange={e => setNewBankBranch(e.target.value)}
                />
              </Col>
            </Row>
          </div>
        )}
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

      {/* Edit Modal */}
      <Modal
        title="Edit Payment Account"
        open={!!editingAccount}
        onOk={handleSaveEdit}
        onCancel={() => setEditingAccount(null)}
        okText="Save Changes"
        destroyOnClose
      >
        {editingAccount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Account Type</Text>
              <Select
                value={editingAccount.type}
                onChange={val => setEditingAccount({ ...editingAccount, type: val })}
                style={{ width: '100%' }}
                options={[
                  { value: 'upi', label: '📱 UPI' },
                  { value: 'neft', label: '🏦 NEFT / Bank' },
                ]}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Account Name</Text>
              <Input
                placeholder={editingAccount.type === 'upi' ? 'Name (e.g. HDFC UPI)' : 'Bank Name (e.g. HDFC Bank)'}
                value={editingAccount.name}
                onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Detail / ID</Text>
              <Input
                placeholder={editingAccount.type === 'upi' ? 'UPI ID (e.g. essar@hdfcbank)' : 'Acc No / IFSC'}
                value={editingAccount.detail}
                onChange={e => setEditingAccount({ ...editingAccount, detail: e.target.value })}
              />
            </div>
            {editingAccount.type === 'neft' && (
              <>
                <Divider style={{ margin: '8px 0' }}>Bank Account Details</Divider>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>A/c Holder Name</Text>
                  <Input
                    placeholder="A/c Holder Name"
                    value={editingAccount.bank_ac_name || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, bank_ac_name: e.target.value })}
                  />
                </div>
                <Row gutter={12}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>A/c Number</Text>
                    <Input
                      placeholder="A/c Number"
                      value={editingAccount.bank_ac_no || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, bank_ac_no: e.target.value })}
                    />
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>IFSC Code</Text>
                    <Input
                      placeholder="IFSC Code"
                      value={editingAccount.bank_ifsc || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, bank_ifsc: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Bank Name</Text>
                    <Input
                      placeholder="Bank Name"
                      value={editingAccount.bank_name || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, bank_name: e.target.value })}
                    />
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Branch</Text>
                    <Input
                      placeholder="Branch"
                      value={editingAccount.bank_branch || ''}
                      onChange={e => setEditingAccount({ ...editingAccount, bank_branch: e.target.value })}
                    />
                  </Col>
                </Row>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default PaymentAccounts

