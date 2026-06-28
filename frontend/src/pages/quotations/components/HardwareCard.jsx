import React from 'react'
import { Table, Input, InputNumber, Select, Button, Typography, Tag } from 'antd'
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons'

const { Text } = Typography

const HardwareCard = ({
  hardwareItems = [],
  setHardwareItems,
  getUomRates
}) => {
  const hwTotal = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)

  const uomOptions = [
    { value: 'PCS', label: 'PCS' }, 
    { value: 'RFT', label: 'RFT' }, 
    { value: 'SQFT', label: 'SQFT' }, 
    { value: 'HRS', label: 'HRS' }, 
    { value: 'SQMT', label: 'SQMT' }
  ].concat((() => { 
    try { 
      return JSON.parse(localStorage.getItem('uom_rate_master') || '[]')
        .filter(u => !['PCS','RFT','SQFT','HRS','SQMT'].includes(u.uom))
        .map(u => ({ value: u.uom, label: u.uom })) 
    } catch { 
      return [] 
    } 
  })())

  const columns = [
    { 
      title: 'Description', 
      dataIndex: 'description', 
      width: 320, 
      render: (v, row) => (
        <Input 
          size="small" 
          value={v} 
          placeholder="Enter hardware description" 
          style={{ borderRadius: 6 }}
          onChange={e => setHardwareItems(prev => prev.map(h => h.hw_key !== row.hw_key ? h : { ...h, description: e.target.value }))} 
        />
      ) 
    },
    { 
      title: 'Qty', 
      dataIndex: 'qty', 
      width: 90, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          style={{ width: '100%', borderRadius: 6 }} 
          onChange={val => setHardwareItems(prev => prev.map(h => h.hw_key !== row.hw_key ? h : { ...h, qty: val, amount: parseFloat(((val || 0) * (h.rate || 0)).toFixed(2)), cost_amount: parseFloat(((val || 0) * (h.cost_rate || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'UOM', 
      dataIndex: 'uom', 
      width: 110, 
      render: (v, row) => (
        <Select 
          size="small" 
          value={v || undefined} 
          placeholder="UOM" 
          style={{ width: '100%', borderRadius: 6 }} 
          allowClear 
          options={uomOptions} 
          onChange={val => { 
            const rates = getUomRates(val)
            setHardwareItems(prev => prev.map(h => h.hw_key !== row.hw_key ? h : { ...h, uom: val, cost_rate: rates.cost_rate, rate: rates.selling_rate, cost_amount: parseFloat(((h.qty || 0) * rates.cost_rate).toFixed(2)), amount: parseFloat(((h.qty || 0) * rates.selling_rate).toFixed(2)) })) 
          }} 
        />
      ) 
    },
    { 
      title: 'Cost Rate', 
      dataIndex: 'cost_rate', 
      width: 130, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          prefix="₹" 
          style={{ width: '100%', borderColor: '#f59e0b', borderRadius: 6 }} 
          onChange={val => setHardwareItems(prev => prev.map(h => h.hw_key !== row.hw_key ? h : { ...h, cost_rate: val, cost_amount: parseFloat(((h.qty || 0) * (val || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'Rate', 
      dataIndex: 'rate', 
      width: 130, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          prefix="₹" 
          style={{ width: '100%', borderRadius: 6 }} 
          onChange={val => setHardwareItems(prev => prev.map(h => h.hw_key !== row.hw_key ? h : { ...h, rate: val, amount: parseFloat(((h.qty || 0) * (val || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      width: 130, 
      align: 'right', 
      render: v => (
        <Text strong style={{ color: '#ea580c' }}>
          ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ) 
    },
    { 
      title: '', 
      width: 50, 
      align: 'center',
      render: (_, row) => (
        <Button 
          size="small" 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => setHardwareItems(prev => prev.filter(h => h.hw_key !== row.hw_key))} 
        />
      ) 
    }
  ]

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 14, 
      border: '1px solid #E2E8F0', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      marginBottom: 20,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFD'
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCartOutlined style={{ color: '#d97706' }} /> Hardware Items
        </span>
        <Tag color="warning" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #fde047' }}>
          Total: ₹{hwTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Tag>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <Table 
          dataSource={hardwareItems} 
          rowKey="hw_key" 
          size="small" 
          pagination={false}
          columns={columns}
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            overflow: 'hidden'
          }}
        />
      </div>
    </div>
  )
}

export default HardwareCard
