import React, { useState, useMemo } from 'react'
import {
  Table, Button, Modal, Form, Input, Select,
  Tag, Space, Popconfirm, Typography, Card,
  Switch, App, Row, Col
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, LockOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

const ROLES = [
  { value: 'admin',     label: 'Admin',              color: 'red',    desc: 'Full access to company data' },
  { value: 'sales',     label: 'Sales',              color: 'blue',   desc: 'CRM, Quotations, Sales Orders' },
  { value: 'accounts',  label: 'Accounts',           color: 'green',  desc: 'Invoices, Payments' },
  { value: 'warehouse', label: 'Warehouse',          color: 'orange', desc: 'Inventory, Delivery Challans' },
  { value: 'workshop',  label: 'Workshop',           color: 'purple', desc: 'Workshop Orders only' },
  { value: 'viewer',    label: 'Viewer (Read only)', color: 'default', desc: 'View only, no edits' },
]

const ROLE_PERMISSIONS = {
  admin:     ['all'],
  sales:     ['crm', 'quotations', 'sales_orders'],
  accounts:  ['invoices', 'payments'],
  warehouse: ['inventory', 'delivery_challans', 'stock_movements'],
  workshop:  ['workshop_orders', 'toughening'],
  viewer:    ['view_only'],
}

const UserManagement = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form] = Form.useForm()

  const companies = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('companies_master') || '[]') } catch { return [] }
  }, [])

  const [users, setUsers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('app_users') || '[]').filter(u => u.role !== 'superadmin')
    } catch { return [] }
  })

  const saveUsers = (updatedUsers) => {
    try {
      const allUsers = JSON.parse(localStorage.getItem('app_users') || '[]')
      const superAdmins = allUsers.filter(u => u.role === 'superadmin')
      localStorage.setItem('app_users', JSON.stringify([...superAdmins, ...updatedUsers]))
      setUsers(updatedUsers)
    } catch(e) { message.error('Failed to save users') }
  }

  const handleOpenAdd = () => { setEditingUser(null); form.resetFields(); setModalOpen(true) }

  const handleEdit = (user) => { setEditingUser(user); form.setFieldsValue({ ...user, password: '' }); setModalOpen(true) }

  const handleDelete = (userId) => { saveUsers(users.filter(u => u.id !== userId)); message.success('User deleted') }

  const handleToggleActive = (userId, val) => {
    saveUsers(users.map(u => u.id === userId ? { ...u, is_active: val } : u))
    message.success(val ? 'User activated' : 'User deactivated')
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const allUsers = JSON.parse(localStorage.getItem('app_users') || '[]')
      const duplicate = allUsers.find(u => u.username === values.username && u.id !== editingUser?.id)
      if (duplicate) { message.error('Username already exists'); return }

      if (editingUser) {
        const updated = users.map(u => {
          if (u.id !== editingUser.id) return u
          return { ...u, ...values, permissions: ROLE_PERMISSIONS[values.role] || [], password: values.password || u.password, updated_at: new Date().toISOString() }
        })
        saveUsers(updated)
        message.success('User updated successfully')
      } else {
        const newId = Math.max(0, ...allUsers.map(u => u.id || 0)) + 1
        const newUser = { id: newId, ...values, permissions: ROLE_PERMISSIONS[values.role] || [], is_active: true, created_at: new Date().toISOString() }
        saveUsers([...users, newUser])
        message.success(`User ${newUser.name} created successfully!`)
      }
      setModalOpen(false)
      form.resetFields()
    } catch(e) {}
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v, r) => (
      <Space>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {v?.charAt(0)?.toUpperCase()}
        </div>
        <div><Text strong>{v}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Text></div>
      </Space>
    )},
    { title: 'Company', dataIndex: 'company_id', key: 'company_id', render: v => {
      const c = companies.find(x => x.id === v)
      return c ? <Tag color={c.color}>{c.short_name}</Tag> : <Tag>All Companies</Tag>
    }},
    { title: 'Role', dataIndex: 'role', key: 'role', render: v => {
      const r = ROLES.find(x => x.value === v)
      return <Tag color={r?.color || 'default'}>{r?.label || v}</Tag>
    }},
    { title: 'Permissions', dataIndex: 'permissions', key: 'permissions', render: v => (
      <Space wrap size={4}>
        {(v || []).slice(0, 3).map(p => <Tag key={p} style={{ fontSize: 10 }}>{p}</Tag>)}
        {(v || []).length > 3 && <Tag style={{ fontSize: 10 }}>+{v.length - 3} more</Tag>}
      </Space>
    )},
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', align: 'center',
      render: (v, r) => <Switch size="small" checked={v !== false} onChange={val => handleToggleActive(r.id, val)} />
    },
    { title: 'Actions', key: 'actions', align: 'right', render: (_, r) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} type="primary" ghost />
        <Popconfirm title="Delete this user?" description="This action cannot be undone." onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      </Space>
    )}
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ background: 'linear-gradient(135deg, #1a237e, #3949ab)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/super-dashboard')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff' }} />
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>User Management</Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Create and manage users for all companies</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#ffd700', borderColor: '#ffd700', color: '#1a237e', fontWeight: 700 }} onClick={handleOpenAdd} size="large">New User</Button>
      </div>

      <Row gutter={[16,16]} style={{ marginBottom: 24 }}>
        {companies.map(company => {
          const companyUsers = users.filter(u => u.company_id === company.id)
          return (
            <Col key={company.id} span={6}>
              <Card size="small" style={{ borderLeft: `4px solid ${company.color}`, borderRadius: 8 }}>
                <Text strong>{company.name}</Text>
                <div style={{ fontSize: 24, fontWeight: 700, color: company.color }}>{companyUsers.length}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>users</Text>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table dataSource={users} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} locale={{ emptyText: 'No users yet. Click "New User" to create one.' }} />
      </Card>

      <Modal title={<Space><UserOutlined style={{ color: '#6366f1' }} /><span>{editingUser ? 'Edit User' : 'Create New User'}</span></Space>}
        open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} footer={null} width={560}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Required' }]}>
                <Input prefix={<UserOutlined />} placeholder="e.g. Rajesh Patil" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. rajesh.patil" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="password" label={editingUser ? "New Password (leave blank to keep current)" : "Password"}
            rules={editingUser ? [] : [{ required: true, message: 'Required' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder={editingUser ? "Leave blank to keep current" : "Min 6 characters"} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_id" label="Company" rules={[{ required: true, message: 'Select company' }]}>
                <Select placeholder="Select company" options={companies.map(c => ({ value: c.id, label: <Space><Tag color={c.color}>{c.short_name}</Tag>{c.name}</Space> }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select role' }]}>
                <Select placeholder="Select role" options={ROLES.map(r => ({ value: r.value, label: <div><Tag color={r.color}>{r.label}</Tag><Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{r.desc}</Text></div> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.role !== curr.role}>
            {({ getFieldValue }) => {
              const role = getFieldValue('role')
              const perms = ROLE_PERMISSIONS[role] || []
              return role ? (
                <div style={{ padding: '10px 14px', background: '#f8faff', borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Access permissions:</Text>
                  <div style={{ marginTop: 6 }}>{perms.map(p => <Tag key={p} style={{ marginBottom: 4 }}>{p}</Tag>)}</div>
                </div>
              ) : null
            }}
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Cancel</Button>
            <Button type="primary" onClick={handleSave} style={{ background: '#6366f1', borderColor: '#6366f1' }}>{editingUser ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
