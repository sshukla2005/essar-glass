import React, { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select,
  Tag, Space, Popconfirm, Typography, Card,
  Switch, App, Row, Col, Checkbox, Divider, Radio, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, LockOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi, companyApi } from '../../api'
import { MODULES, MODULE_SECTIONS, DEFAULT_ROLE_PERMISSIONS } from '../../utils/modules'

const { Title, Text } = Typography

const ROLES = [
  { value: 'superadmin', label: 'Superadmin',         color: 'gold',   desc: 'Cross-company full system access' },
  { value: 'admin',      label: 'Admin',              color: 'red',    desc: 'Full access to company data' },
  { value: 'sales',      label: 'Sales',              color: 'blue',   desc: 'CRM, Quotations, Sales Orders' },
  { value: 'accounts',   label: 'Accounts',           color: 'green',  desc: 'Invoices, Payments' },
  { value: 'warehouse',  label: 'Warehouse',          color: 'orange', desc: 'Inventory, Delivery Challans' },
  { value: 'workshop',   label: 'Workshop',           color: 'purple', desc: 'Workshop Orders only' },
  { value: 'viewer',     label: 'Viewer (Read only)', color: 'default', desc: 'View only, no edits' },
]

const UserManagement = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [selectedPermissions, setSelectedPermissions] = useState([])
  const [hasCustomScopes, setHasCustomScopes] = useState(false)
  const [moduleScopes, setModuleScopes] = useState({
    crm: 'company', sales: 'company', purchase: 'company', inventory: 'company',
    workshop: 'company', reports: 'company', masters: 'company', settings: 'company'
  })
  const [form] = Form.useForm()

  const { data: companiesData } = useQuery({
    queryKey: ['companies-dd'],
    queryFn: () => companyApi.dropdown().then(r => r.data)
  })
  const companies = Array.isArray(companiesData) ? companiesData : (companiesData?.items || [])

  const queryClient = useQueryClient()

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userApi.list({ page: 1, page_size: 200, is_active: 'all' }).then(r => r.data)
  })
  const users = usersData?.items || []

  const createUserMutation = useMutation({
    mutationFn: (data) => userApi.create(data),
    onSuccess: () => {
      message.success('User created')
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      setModalOpen(false)
      form.resetFields()
      setSelectedPermissions([])
      setHasCustomScopes(false)
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to create user')
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => userApi.update(id, data),
    onSuccess: () => {
      message.success('User updated')
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      setModalOpen(false)
      form.resetFields()
      setSelectedPermissions([])
      setHasCustomScopes(false)
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to update user')
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id) => userApi.archive(id),
    onSuccess: () => {
      message.success('User deleted')
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to delete user')
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => userApi.update(id, { is_active }),
    onSuccess: (_, vars) => {
      message.success(vars.is_active ? 'User activated' : 'User deactivated')
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to change user status')
  })

  const handleOpenAdd = () => {
    setEditingUser(null)
    form.resetFields()
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS['sales'] || []
    setSelectedPermissions(defaultPerms)
    setHasCustomScopes(false)
    setModuleScopes({
      crm: 'own', sales: 'own', purchase: 'company', inventory: 'company',
      workshop: 'company', reports: 'own', masters: 'company', settings: 'company'
    })
    form.setFieldsValue({ role: 'sales', data_scope: 'own', permissions: defaultPerms })
    setModalOpen(true)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    const perms = user.permissions || []
    setSelectedPermissions(perms)
    if (user.module_scopes && typeof user.module_scopes === 'object' && Object.keys(user.module_scopes).length > 0) {
      setHasCustomScopes(true)
      setModuleScopes({
        crm: 'company', sales: 'company', purchase: 'company', inventory: 'company',
        workshop: 'company', reports: 'company', masters: 'company', settings: 'company',
        ...user.module_scopes
      })
    } else {
      setHasCustomScopes(false)
      setModuleScopes({
        crm: user.data_scope || 'company', sales: user.data_scope || 'company',
        purchase: user.data_scope || 'company', inventory: user.data_scope || 'company',
        workshop: user.data_scope || 'company', reports: user.data_scope || 'company',
        masters: user.data_scope || 'company', settings: user.data_scope || 'company'
      })
    }
    form.setFieldsValue({ ...user, password: '', data_scope: user.data_scope || 'company', permissions: perms })
    setModalOpen(true)
  }

  const handleDelete = (userId) => {
    deleteUserMutation.mutate(userId)
  }

  const handleToggleActive = (userId, val) => {
    toggleActiveMutation.mutate({ id: userId, is_active: val })
  }

  const handleRoleChange = (role) => {
    const templatePerms = DEFAULT_ROLE_PERMISSIONS[role] || []
    setSelectedPermissions(templatePerms)
    const defScope = (role === 'admin' || role === 'superadmin') ? 'company' : 'own'
    form.setFieldsValue({ permissions: templatePerms, data_scope: defScope })
  }

  const handleCopyPermissions = (sourceUserId) => {
    const srcUser = users.find(u => u.id === sourceUserId)
    if (srcUser) {
      const perms = srcUser.permissions || []
      setSelectedPermissions(perms)
      form.setFieldsValue({ permissions: perms, data_scope: srcUser.data_scope || 'company' })
      if (srcUser.module_scopes && typeof srcUser.module_scopes === 'object' && Object.keys(srcUser.module_scopes).length > 0) {
        setHasCustomScopes(true)
        setModuleScopes(srcUser.module_scopes)
      }
      message.info(`Copied settings from ${srcUser.name}`)
    }
  }

  const handleModuleToggle = (moduleKey, checked) => {
    let nextPerms
    if (checked) {
      nextPerms = [...selectedPermissions.filter(p => p !== 'all'), moduleKey]
    } else {
      nextPerms = selectedPermissions.filter(p => p !== moduleKey && p !== 'all')
    }
    setSelectedPermissions(nextPerms)
    form.setFieldsValue({ permissions: nextPerms })
  }

  const handleSectionToggle = (sectionKey, checked) => {
    const sectionModuleKeys = MODULES.filter(m => m.section === sectionKey).map(m => m.key)
    let nextPerms = selectedPermissions.filter(p => p !== 'all')
    if (checked) {
      nextPerms = Array.from(new Set([...nextPerms, ...sectionModuleKeys]))
    } else {
      nextPerms = nextPerms.filter(p => !sectionModuleKeys.includes(p))
    }
    setSelectedPermissions(nextPerms)
    form.setFieldsValue({ permissions: nextPerms })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        permissions: selectedPermissions,
        module_scopes: hasCustomScopes ? moduleScopes : null
      }
      if (editingUser && !values.password) {
        delete payload.password
      }
      if (editingUser) {
        updateUserMutation.mutate({ id: editingUser.id, data: payload })
      } else {
        createUserMutation.mutate(payload)
      }
    } catch (_) {}
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
    { title: 'Data Scope', key: 'data_scope', render: (_, r) => {
      const mainScope = r.data_scope || 'company'
      const customCount = r.module_scopes && typeof r.module_scopes === 'object' ? Object.keys(r.module_scopes).length : 0
      if (customCount > 0) {
        const tooltipText = Object.entries(r.module_scopes).map(([m, s]) => `${m}: ${s}`).join('\n')
        return (
          <Tooltip title={<pre style={{ margin: 0, fontSize: 11 }}>{tooltipText}</pre>}>
            <Tag color="purple" style={{ cursor: 'pointer' }}>
              Custom ({customCount} modules)
            </Tag>
          </Tooltip>
        )
      }
      return mainScope === 'own' ? <Tag color="purple">Own</Tag> : <Tag color="blue">Company</Tag>
    }},
    { title: 'Permissions', dataIndex: 'permissions', key: 'permissions', render: v => (
      <Space wrap size={4}>
        {(v || []).slice(0, 4).map(p => <Tag key={p} color="blue" style={{ fontSize: 10 }}>{p}</Tag>)}
        {(v || []).length > 4 && <Tag style={{ fontSize: 10 }}>+{v.length - 4} more</Tag>}
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
            <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Create and manage users and module access permissions</Text>
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
        <Table dataSource={users} loading={usersLoading} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} locale={{ emptyText: 'No users yet. Click "New User" to create one.' }} />
      </Card>

      <Modal
        title={<Space><UserOutlined style={{ color: '#6366f1' }} /><span>{editingUser ? 'Edit User' : 'Create New User'}</span></Space>}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setSelectedPermissions([]) }}
        footer={null}
        width={720}
      >
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
              <Form.Item name="role" label="Role Template" rules={[{ required: true, message: 'Select role' }]}>
                <Select
                  placeholder="Select role"
                  onChange={handleRoleChange}
                  options={ROLES.map(r => ({ value: r.value, label: <div><Tag color={r.color}>{r.label}</Tag><Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{r.desc}</Text></div> }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0 12px' }} />

          <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong style={{ fontSize: 14 }}>Default Data Access Scope</Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Form.Item name="data_scope" initialValue="company" style={{ marginBottom: 0 }}>
                <Radio.Group buttonStyle="solid" size="small">
                  <Radio.Button value="company">Company-wide</Radio.Button>
                  <Radio.Button value="own">Own records only</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasCustomScopes ? 12 : 0 }}>
              <div>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>Customize Scope per Module</Text>
                <div style={{ fontSize: 11, color: '#64748b' }}>Override default scope for individual modules</div>
              </div>
              <Checkbox checked={hasCustomScopes} onChange={e => setHasCustomScopes(e.target.checked)}>
                Custom Overrides
              </Checkbox>
            </div>

            {hasCustomScopes && (
              <Row gutter={[12, 8]} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10 }}>
                {MODULE_SECTIONS.map(sec => (
                  <Col span={12} key={sec.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{sec.label}</Text>
                    <Radio.Group
                      size="small"
                      value={moduleScopes[sec.key] || 'company'}
                      onChange={e => setModuleScopes(prev => ({ ...prev, [sec.key]: e.target.value }))}
                    >
                      <Radio value="company" style={{ fontSize: 11 }}>Company</Radio>
                      <Radio value="own" style={{ fontSize: 11 }}>Own</Radio>
                    </Radio.Group>
                  </Col>
                ))}
              </Row>
            )}
          </div>

          <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong style={{ fontSize: 14 }}>Module Access Permissions</Text>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Select
                placeholder="Copy permissions from user..."
                allowClear
                style={{ width: '100%' }}
                onChange={handleCopyPermissions}
                options={users
                  .filter(u => u.id !== editingUser?.id)
                  .map(u => ({
                    value: u.id,
                    label: `Copy from ${u.name} (@${u.username} — ${u.role})`
                  }))
                }
              />
            </Col>
          </Row>

          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', background: '#f8faff', marginBottom: 16 }}>
            {MODULE_SECTIONS.map((sec, idx) => {
              const secModules = MODULES.filter(m => m.section === sec.key)
              const secKeys = secModules.map(m => m.key)
              const isAllChecked = selectedPermissions.includes('all') || (secKeys.length > 0 && secKeys.every(k => selectedPermissions.includes(k)))
              const isSomeChecked = !isAllChecked && secKeys.some(k => selectedPermissions.includes(k))

              return (
                <div key={sec.key} style={{ marginBottom: idx === MODULE_SECTIONS.length - 1 ? 0 : 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eef2ff', padding: '4px 10px', borderRadius: 6, marginBottom: 8 }}>
                    <Text strong style={{ color: '#3730a3' }}>{sec.label}</Text>
                    <Checkbox
                      checked={isAllChecked}
                      indeterminate={isSomeChecked}
                      onChange={(e) => handleSectionToggle(sec.key, e.target.checked)}
                    >
                      <Text style={{ fontSize: 12, color: '#4338ca' }}>Select All in {sec.label}</Text>
                    </Checkbox>
                  </div>
                  <Row gutter={[8, 8]}>
                    {secModules.map(mod => (
                      <Col span={8} key={mod.key}>
                        <Checkbox
                          checked={selectedPermissions.includes('all') || selectedPermissions.includes(mod.key)}
                          onChange={(e) => handleModuleToggle(mod.key, e.target.checked)}
                        >
                          <span style={{ fontSize: 13 }}>{mod.label}</span>
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                  {idx < MODULE_SECTIONS.length - 1 && <Divider style={{ margin: '10px 0' }} />}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); setSelectedPermissions([]) }}>Cancel</Button>
            <Button type="primary" onClick={handleSave} style={{ background: '#6366f1', borderColor: '#6366f1' }}>{editingUser ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
