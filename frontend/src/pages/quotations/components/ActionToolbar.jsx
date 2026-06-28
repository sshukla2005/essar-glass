import React from 'react'
import { Steps, Space, Button, Tag, Popconfirm } from 'antd'
import { 
  UploadOutlined, 
  LineChartOutlined, 
  DownloadOutlined, 
  ShoppingCartOutlined, 
  CheckCircleOutlined 
} from '@ant-design/icons'

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }

const ActionToolbar = ({
  status = 'draft',
  isEdit = false,
  record,
  onImportExcel,
  onCostAnalysis,
  onGeneratePDF,
  onConvertToSO,
  isConverting = false,
  onCancel,
  onConfirm,
  isConfirming = false,
  queryClient
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20, 
      background: '#fff', 
      padding: '14px 24px', 
      borderRadius: 14, 
      border: '1px solid #E2E8F0', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      flexWrap: 'wrap',
      gap: 16
    }}>
      <div style={{ flex: 1, minWidth: 280, maxWidth: 500 }}>
        <Steps 
          size="small" 
          current={STATUS_IDX[status] || 0} 
          items={STATUS_STEPS.map(s => ({ 
            title: s.charAt(0).toUpperCase() + s.slice(1) 
          }))} 
          style={{ padding: '4px 0' }}
        />
      </div>

      <Space wrap style={{ gap: 8 }}>
        <Button 
          icon={<UploadOutlined style={{ color: '#0ea5e9' }} />} 
          onClick={onImportExcel} 
          style={{ 
            borderColor: '#E2E8F0', 
            color: '#0f172a', 
            borderRadius: 8, 
            height: 38,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          Import Excel
        </Button>

        {isEdit && (
          <Button 
            icon={<LineChartOutlined style={{ color: '#6366f1' }} />} 
            onClick={onCostAnalysis} 
            style={{ 
              borderColor: '#E2E8F0', 
              color: '#0f172a', 
              borderRadius: 8, 
              height: 38,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Cost Analysis
          </Button>
        )}

        {isEdit && (
          <Button 
            icon={<DownloadOutlined style={{ color: '#64748b' }} />} 
            onClick={onGeneratePDF}
            style={{ 
              borderColor: '#E2E8F0', 
              color: '#0f172a', 
              borderRadius: 8, 
              height: 38,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Generate PDF
          </Button>
        )}

        {status === 'confirmed' && (
          <>
            <Button 
              type="primary" 
              icon={<ShoppingCartOutlined />} 
              onClick={onConvertToSO} 
              loading={isConverting} 
              style={{ 
                background: '#6366f1', 
                borderColor: '#6366f1', 
                borderRadius: 8,
                height: 38,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
              }}
            >
              Convert to SO
            </Button>
            <Popconfirm 
              title="Cancel this quotation?" 
              onConfirm={onCancel}
              okText="Yes, Cancel"
              cancelText="No"
            >
              <Button 
                danger 
                style={{ 
                  borderRadius: 8,
                  height: 38,
                  fontWeight: 500
                }}
              >
                Cancel
              </Button>
            </Popconfirm>
          </>
        )}

        {status === 'draft' && (
          <Button 
            type="primary" 
            onClick={onConfirm} 
            loading={isConfirming} 
            style={{ 
              background: '#10b981', 
              borderColor: '#10b981', 
              borderRadius: 8, 
              height: 38,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
            }}
          >
            Confirm
          </Button>
        )}

        {status === 'cancelled' && (
          <Tag color="red" style={{ padding: '6px 16px', fontSize: 13, borderRadius: 8, border: '1px solid #fca5a5', fontWeight: 600 }}>
            CANCELLED
          </Tag>
        )}
      </Space>
    </div>
  )
}

export default ActionToolbar
