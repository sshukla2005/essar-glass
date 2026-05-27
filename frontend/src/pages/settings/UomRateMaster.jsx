import React, { useState, useEffect } from 'react'
import { Table, InputNumber, Button, App, Typography, Card, Tag, Divider } from 'antd'
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Text } = Typography

const STORAGE_KEY = 'uom_rate_master'

const DEFAULT_UOMS = [
  { uom: 'PCS',  cost_rate: 0, selling_rate: 0 },
  { uom: 'RFT',  cost_rate: 0, selling_rate: 0 },
  { uom: 'SQFT', cost_rate: 0, selling_rate: 0 },
  { uom: 'HRS',  cost_rate: 0, selling_rate: 0 },
  { uom: 'SQMT', cost_rate: 0, selling_rate: 0 },
]

const UomRateMaster = () => {
  const { message } = App.useApp()
  const [rows, setRows] = useState([])
  const [newUom, setNewUom] = useState('')

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (stored.length === 0) {
        setRows(DEFAULT_UOMS.map((r, i) => ({ ...r, key: i })))
      } else {
        setRows(stored.map((r, i) => ({ ...r, key: i })))
      }
    } catch {
      setRows(DEFAULT_UOMS.map((r, i) => ({ ...r, key: i })))
    }
  }, [])

  const save = (list) => {
    setRows(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      list.map(({ key, ...rest }) => rest)
    ))
  }

  const handleChange = (key, field, value) => {
    save(rows.map(r => r.key === key ? { ...r, [field]: value } : r))
  }

  const handleAdd = () => {
    const trimmed = newUom.trim().toUpperCase()
    if (!trimmed) return message.warning('Enter a UOM name')
    if (rows.find(r => r.uom.toUpperCase() === trimmed)) {
      return message.warning('UOM already exists')
    }
    save([...rows, { key: Date.now(), uom: trimmed, cost_rate: 0, selling_rate: 0 }])
    setNewUom('')
    message.success(`"${trimmed}" added!`)
  }

  const handleDelete = (key) => {
    save(rows.filter(r => r.key !== key))
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      rows.map(({ key, ...rest }) => rest)
    ))
    message.success('UOM rates saved!')
  }

  const columns = [
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 120,
      render: v => <Tag color="blue" style={{ fontWeight: 700, fontSize: 13 }}>{v}</Tag>
    },
    {
      title: 'Cost Rate (to us)',
      dataIndex: 'cost_rate',
      width: 180,
      render: (v, row) => (
        <InputNumber
          value={v}
          min={0}
          prefix="₹"
          addonAfter={`/${row.uom}`}
          style={{ width: '100%' }}
          onChange={val => handleChange(row.key, 'cost_rate', val || 0)}
        />
      )
    },
    {
      title: 'Selling Rate (to customer)',
      dataIndex: 'selling_rate',
      width: 200,
      render: (v, row) => (
        <InputNumber
          value={v}
          min={0}
          prefix="₹"
          addonAfter={`/${row.uom}`}
          style={{ width: '100%', borderColor: '#10b981' }}
          onChange={val => handleChange(row.key, 'selling_rate', val || 0)}
        />
      )
    },
    {
      title: 'Margin',
      width: 120,
      render: (_, row) => {
        const margin = row.selling_rate - row.cost_rate
        const pct = row.cost_rate > 0
          ? ((margin / row.cost_rate) * 100).toFixed(1)
          : '—'
        return (
          <Text strong style={{
            color: margin >= 0 ? '#16a34a' : '#dc2626'
          }}>
            ₹{margin.toFixed(2)}
            {row.cost_rate > 0 && (
              <span style={{ fontSize: 11, marginLeft: 4 }}>({pct}%)</span>
            )}
          </Text>
        )
      }
    },
    {
      title: '',
      width: 50,
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(row.key)}
        />
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 20, fontWeight: 700 }}>📐 UOM Rate Master</Text>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Default cost and selling rates per unit of measure — auto-fills in Hardware & Labor rows
          </div>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          style={{ background: '#10b981', borderColor: '#10b981' }}
        >
          Save All
        </Button>
      </div>

      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            placeholder="New UOM e.g. KG, LOT, DAY..."
            value={newUom}
            onChange={e => setNewUom(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{
              border: '1px solid #d1d5db', borderRadius: 6,
              padding: '6px 12px', fontSize: 13, width: 220,
              outline: 'none'
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ background: '#6366f1' }}
          >
            Add UOM
          </Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 8 }}>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="key"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}

export default UomRateMaster
