import React from 'react'
import { Form, Input, Tabs } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'

const { TextArea } = Input

const NotesCard = () => {
  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 14, 
      border: '1px solid #E2E8F0', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      marginBottom: 16,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFD',
        gap: 8
      }}>
        <FileTextOutlined style={{ color: '#64748b' }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
          Quotation Notes
        </span>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Tabs 
          size="small" 
          items={[
            { 
              key: 'cn', 
              label: 'Customer Notes', 
              children: (
                <Form.Item name="customer_note" style={{ marginBottom: 0 }}>
                  <TextArea 
                    rows={4} 
                    placeholder="Notes visible to the customer on the PDF quotation..." 
                    style={{ borderRadius: 8, padding: 10 }}
                  />
                </Form.Item>
              ) 
            },
            { 
              key: 'in', 
              label: 'Internal Notes', 
              children: (
                <Form.Item name="internal_notes" style={{ marginBottom: 0 }}>
                  <TextArea 
                    rows={4} 
                    placeholder="Private internal notes for team reference only..." 
                    style={{ borderRadius: 8, padding: 10 }}
                  />
                </Form.Item>
              ) 
            },
          ]} 
        />
      </div>
    </div>
  )
}

export default NotesCard
