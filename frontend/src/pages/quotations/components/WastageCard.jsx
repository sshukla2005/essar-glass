import React from 'react'
import { Table, Input, InputNumber, Button, Typography, Tag } from 'antd'
import { DeleteOutlined, DeleteColumnOutlined } from '@ant-design/icons'

const { Text } = Typography

const WastageCard = ({
  wastageItems = [],
  setWastageItems
}) => {
  const wstTotal = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)

  const columns = [
    { 
      title: 'Description', 
      dataIndex: 'description', 
      width: 320, 
      render: (v, row) => (
        <Input 
          size="small" 
          value={v} 
          placeholder="Enter wastage description" 
          style={{ borderRadius: 6 }}
          onChange={e => setWastageItems(prev => prev.map(w => w.wst_key !== row.wst_key ? w : { ...w, description: e.target.value }))} 
        />
      ) 
    },
    { 
      title: 'Qty (Sqft)', 
      dataIndex: 'qty', 
      width: 120, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          addonAfter="sqft" 
          style={{ width: '100%' }} 
          onChange={val => setWastageItems(prev => prev.map(w => w.wst_key !== row.wst_key ? w : { ...w, qty: val, amount: parseFloat(((val || 0) * (w.rate || 0)).toFixed(2)), cost_amount: parseFloat(((val || 0) * (w.cost_rate || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'Cost Rate', 
      dataIndex: 'cost_rate', 
      width: 140, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          prefix="₹" 
          addonAfter="/sqft" 
          style={{ width: '100%', borderColor: '#f59e0b', borderRadius: 6 }} 
          onChange={val => setWastageItems(prev => prev.map(w => w.wst_key !== row.wst_key ? w : { ...w, cost_rate: val, cost_amount: parseFloat(((w.qty || 0) * (val || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'Selling Rate', 
      dataIndex: 'rate', 
      width: 140, 
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={0} 
          prefix="₹" 
          addonAfter="/sqft" 
          style={{ width: '100%', borderRadius: 6 }} 
          onChange={val => setWastageItems(prev => prev.map(w => w.wst_key !== row.wst_key ? w : { ...w, rate: val, amount: parseFloat(((w.qty || 0) * (val || 0)).toFixed(2)) }))} 
        />
      ) 
    },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      width: 130, 
      align: 'right', 
      render: v => (
        <Text strong style={{ color: '#e11d48' }}>
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
          onClick={() => setWastageItems(prev => prev.filter(w => w.wst_key !== row.wst_key))} 
        />
      ) 
    }
  ]

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 14, 
      border: '1px solid #fecaca', // Reddish border for wastage
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      marginBottom: 20,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid #fee2e2',
        background: '#fffbfb'
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <DeleteColumnOutlined style={{ color: '#ef4444' }} /> Wastage
        </span>
        <Tag color="error" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5' }}>
          Total: ₹{wstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Tag>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <Table 
          dataSource={wastageItems} 
          rowKey="wst_key" 
          size="small" 
          pagination={false}
          columns={columns}
          style={{
            border: '1px solid #fee2e2',
            borderRadius: 10,
            overflow: 'hidden'
          }}
        />
      </div>
    </div>
  )
}

export default WastageCard
