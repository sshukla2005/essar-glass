import React, { useState, useEffect } from 'react'
import { settingsApi } from '../../api/settingsApi'
import {
  Card, Button, Tag, Input, Select, InputNumber,
  Divider, Row, Col, Typography, App, Space,
  Popconfirm
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SaveOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

const DEFAULT_CONFIG = {
  thicknesses:  [3.5, 4, 5, 6, 8, 10, 12],
  glass_types:  ['Annealed', 'Toughened', 'Laminated', 'DGU'],
  categories:   ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'],
}

const GlassDropdownSettings = () => {
  const { message } = App.useApp()

  const getConfig = () => {
    try {
      return JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
    } catch { return {} }
  }

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONFIG,
    ...getConfig(),
  }))

  // Load from backend on mount
  useEffect(() => {
    settingsApi.get(settingsApi.KEYS.GLASS_DROPDOWN_CONFIG).then(data => {
      if (data && Object.keys(data).length > 0) {
        setConfig(prev => ({ ...DEFAULT_CONFIG, ...prev, ...data }))
        localStorage.setItem('glass_dropdown_config', JSON.stringify(data))
      }
    }).catch(() => {})
  }, [])

  // New value inputs
  const [newThickness, setNewThickness] = useState('')
  const [newType,      setNewType]      = useState('')
  const [newCategory,  setNewCategory]  = useState('')

  // Processes
  const getProcesses = () => {
    try {
      return JSON.parse(localStorage.getItem('process_masters') || '[]')
    } catch { return [] }
  }
  const [processes, setProcesses]     = useState(getProcesses)
  const [newProcName, setNewProcName] = useState('')
  const [newProcType, setNewProcType] = useState('other')
  const [newProcCharge, setNewProcCharge] = useState('per_sqft')
  const [newProcRate, setNewProcRate] = useState(0)
  const [newProcUnit, setNewProcUnit] = useState('sqft')

  const saveConfig = async () => {
    const toSave = { ...config, updated_at: new Date().toISOString() }
    localStorage.setItem('glass_dropdown_config', JSON.stringify(toSave))
    await settingsApi.save(settingsApi.KEYS.GLASS_DROPDOWN_CONFIG, toSave)
    message.success('✅ Dropdown settings saved!')
  }

  const saveProcesses = () => {
    localStorage.setItem('process_masters', JSON.stringify(processes))
    message.success('✅ Process masters saved!')
  }

  // Thickness
  const addThickness = () => {
    const val = parseFloat(newThickness)
    if (isNaN(val) || val <= 0) return message.error('Enter valid thickness')
    if (config.thicknesses.includes(val)) return message.error('Already exists')
    setConfig(prev => ({
      ...prev,
      thicknesses: [...prev.thicknesses, val].sort((a,b) => a-b)
    }))
    setNewThickness('')
  }
  const removeThickness = (val) =>
    setConfig(prev => ({ ...prev, thicknesses: prev.thicknesses.filter(t => t !== val) }))

  // Glass Type
  const addType = () => {
    if (!newType.trim()) return message.error('Enter type name')
    if (config.glass_types.includes(newType.trim()))
      return message.error('Already exists')
    setConfig(prev => ({ ...prev, glass_types: [...prev.glass_types, newType.trim()] }))
    setNewType('')
  }
  const removeType = (val) =>
    setConfig(prev => ({ ...prev, glass_types: prev.glass_types.filter(t => t !== val) }))

  // Category
  const addCategory = () => {
    if (!newCategory.trim()) return message.error('Enter category name')
    if (config.categories.includes(newCategory.trim()))
      return message.error('Already exists')
    setConfig(prev => ({ ...prev, categories: [...prev.categories, newCategory.trim()] }))
    setNewCategory('')
  }
  const removeCategory = (val) =>
    setConfig(prev => ({ ...prev, categories: prev.categories.filter(c => c !== val) }))

  // Process
  const addProcess = () => {
    if (!newProcName.trim()) return message.error('Enter process name')
    const newId = processes.length
      ? Math.max(...processes.map(p => p.id)) + 1
      : 1
    const code = `PRC${String(newId).padStart(4, '0')}`
    setProcesses(prev => [...prev, {
      id: newId, code, name: newProcName.trim(),
      process_type: newProcType,
      charge_type:  newProcCharge,
      rate:         newProcRate,
      unit:         newProcUnit,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    setNewProcName('')
    setNewProcRate(0)
  }

  const removeProcess = (id) =>
    setProcesses(prev => prev.filter(p => p.id !== id))

  const toggleProcess = (id, val) =>
    setProcesses(prev => prev.map(p =>
      p.id === id ? { ...p, is_active: val } : p
    ))

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
      }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          Glass Dropdown Settings
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
          Configure thickness, type, category options and process masters
        </Text>
      </div>

      {/* Thickness */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong>Thickness (mm)</Text>
        </Divider>
        <div style={{ marginBottom: 12 }}>
          {config.thicknesses.map(t => (
            <Tag
              key={t}
              closable
              onClose={() => removeThickness(t)}
              style={{ marginBottom: 6, fontSize: 13, padding: '2px 10px' }}
              color="blue"
            >
              {t}mm
            </Tag>
          ))}
        </div>
        <Space>
          <InputNumber
            value={newThickness}
            onChange={setNewThickness}
            placeholder="e.g. 15"
            min={0} step={0.5}
            style={{ width: 120 }}
            addonAfter="mm"
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addThickness}>
            Add Thickness
          </Button>
        </Space>
      </Card>

      {/* Glass Type */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong>Glass Type</Text>
        </Divider>
        <div style={{ marginBottom: 12 }}>
          {config.glass_types.map(t => (
            <Tag
              key={t}
              closable
              onClose={() => removeType(t)}
              style={{ marginBottom: 6, fontSize: 13, padding: '2px 10px' }}
              color="purple"
            >
              {t}
            </Tag>
          ))}
        </div>
        <Space>
          <Input
            value={newType}
            onChange={e => setNewType(e.target.value)}
            placeholder="e.g. Wired Glass"
            style={{ width: 180 }}
            onPressEnter={addType}
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addType}>
            Add Type
          </Button>
        </Space>
      </Card>

      {/* Category */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong>Glass Category</Text>
        </Divider>
        <div style={{ marginBottom: 12 }}>
          {config.categories.map(c => (
            <Tag
              key={c}
              closable
              onClose={() => removeCategory(c)}
              style={{ marginBottom: 6, fontSize: 13, padding: '2px 10px' }}
              color="green"
            >
              {c}
            </Tag>
          ))}
        </div>
        <Space>
          <Input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="e.g. Bronze"
            style={{ width: 180 }}
            onPressEnter={addCategory}
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addCategory}>
            Add Category
          </Button>
        </Space>
      </Card>

      <Button
        type="primary" icon={<SaveOutlined />} size="large"
        style={{ background: '#7c3aed', marginBottom: 24 }}
        onClick={saveConfig}
      >
        Save Dropdown Settings
      </Button>

      {/* Process Masters */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong>Process Masters</Text>
        </Divider>

        {/* Existing processes */}
        <div style={{ marginBottom: 16 }}>
          {processes.map(p => (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              marginBottom: 6,
              background: p.is_active !== false ? '#f8faff' : '#f9f9f9',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              opacity: p.is_active === false ? 0.5 : 1,
            }}>
              <Tag color="blue" style={{ minWidth: 60 }}>{p.code}</Tag>
              <Text strong style={{ flex: 1 }}>{p.name}</Text>
              <Tag>{p.process_type}</Tag>
              <Tag color="orange">{p.charge_type}</Tag>
              <Text>₹{p.rate}/{p.unit}</Text>
              <Button
                size="small"
                type={p.is_active !== false ? 'default' : 'primary'}
                onClick={() => toggleProcess(p.id, p.is_active === false)}
              >
                {p.is_active !== false ? 'Disable' : 'Enable'}
              </Button>
              <Popconfirm
                title="Remove this process?"
                onConfirm={() => removeProcess(p.id)}
                okText="Remove" okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </div>

        {/* Add new process */}
        <div style={{
          background: '#f8faff',
          borderRadius: 8,
          padding: 16,
          border: '1px dashed #c7d2fe',
        }}>
          <Text strong style={{ display: 'block', marginBottom: 10, color: '#4f46e5' }}>
            + Add New Process
          </Text>
          <Row gutter={[8, 8]}>
            <Col span={6}>
              <Input
                placeholder="Process name"
                value={newProcName}
                onChange={e => setNewProcName(e.target.value)}
              />
            </Col>
            <Col span={4}>
              <Select
                value={newProcType}
                onChange={setNewProcType}
                style={{ width: '100%' }}
                options={[
                  { value: 'cutting',     label: 'Cutting'     },
                  { value: 'polishing',   label: 'Polishing'   },
                  { value: 'hole',        label: 'Hole'        },
                  { value: 'cutout',      label: 'Cutout'      },
                  { value: 'fabrication', label: 'Fabrication' },
                  { value: 'toughening',  label: 'Toughening'  },
                  { value: 'beveling',    label: 'Beveling'    },
                  { value: 'forma',       label: 'Farma'       },
                  { value: 'temporary',   label: 'Temporary'   },
                  { value: 'handling',    label: 'Handling'    },
                  { value: 'delivery',    label: 'Delivery'    },
                  { value: 'other',       label: 'Other'       },
                ]}
              />
            </Col>
            <Col span={4}>
              <Select
                value={newProcCharge}
                onChange={setNewProcCharge}
                style={{ width: '100%' }}
                options={[
                  { value: 'per_sqft',  label: 'Per Sqft'  },
                  { value: 'per_rft',   label: 'Per Rft'   },
                  { value: 'per_sqmt',  label: 'Per Sqmt'  },
                  { value: 'per_piece', label: 'Per Piece' },
                  { value: 'fixed',     label: 'Fixed'     },
                ]}
              />
            </Col>
            <Col span={3}>
              <InputNumber
                value={newProcRate}
                onChange={setNewProcRate}
                min={0} prefix="₹"
                style={{ width: '100%' }}
                placeholder="Rate"
              />
            </Col>
            <Col span={3}>
              <Input
                value={newProcUnit}
                onChange={e => setNewProcUnit(e.target.value)}
                placeholder="sqft/rft/hole"
              />
            </Col>
            <Col span={4}>
              <Button
                type="dashed" icon={<PlusOutlined />}
                block onClick={addProcess}
              >
                Add
              </Button>
            </Col>
          </Row>
        </div>
      </Card>

      <Button
        type="primary" icon={<SaveOutlined />} size="large"
        style={{ background: '#4f46e5' }}
        onClick={saveProcesses}
      >
        Save Process Masters
      </Button>
    </div>
  )
}

export default GlassDropdownSettings
