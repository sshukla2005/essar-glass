import React from 'react'
import { Steps, Space, Button, Tag, Popconfirm } from 'antd'
import { 
  UploadOutlined, 
  LineChartOutlined, 
  DownloadOutlined, 
  ShoppingCartOutlined, 
  CheckCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CarOutlined,
  DollarOutlined
} from '@ant-design/icons'

const QUOTE_STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']
const QUOTE_STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }

const SO_STATUS_STEPS = ['draft', 'confirmed', 'in_production', 'ready', 'delivered']
const SO_STATUS_IDX = { draft: 0, confirmed: 1, in_production: 2, ready: 3, delivered: 4, cancelled: 0 }

const ActionToolbar = ({
  type = 'quotation',
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
  // SO-specific props
  onCreatePO,
  isCreatingPO = false,
  onProduction,
  isStartingProduction = false,
  onReady,
  isMarkingReady = false,
  onCreateDelivery,
  isCreatingDelivery = false,
  onCreateInvoice,
  isCreatingInvoice = false,
  queryClient
}) => {
  const isSO = type === 'sales_order'
  const steps = isSO ? SO_STATUS_STEPS : QUOTE_STATUS_STEPS
  const currentIdx = isSO ? (SO_STATUS_IDX[status] ?? 0) : (QUOTE_STATUS_IDX[status] ?? 0)

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
          current={currentIdx} 
          items={steps.map(s => ({ 
            title: s.replace('_', ' ').toUpperCase()
          }))} 
          style={{ padding: '4px 0' }}
        />
      </div>

      <Space wrap style={{ gap: 8 }}>
        {!isSO && (
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
        )}

        {isEdit && onCostAnalysis && (
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
            {isSO ? 'PDF' : 'Generate PDF'}
          </Button>
        )}

        {isSO ? (
          <>
            {status === 'draft' && (
              <>
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />} 
                  onClick={onConfirm} 
                  loading={isConfirming} 
                  style={{ background: '#3b82f6', borderColor: '#3b82f6', borderRadius: 8, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center' }}
                >
                  Confirm Order
                </Button>
                <Button 
                  icon={<ShoppingCartOutlined style={{ color: '#f59e0b' }} />} 
                  onClick={onCreatePO} 
                  loading={isCreatingPO}
                  style={{ color: '#f59e0b', borderColor: '#f59e0b', borderRadius: 8, height: 38, fontWeight: 500, display: 'flex', alignItems: 'center' }}
                >
                  Create PO
                </Button>
              </>
            )}

            {status === 'confirmed' && (
              <Button 
                type="primary" 
                icon={<SettingOutlined style={{ color: '#fff' }} />} 
                onClick={onProduction} 
                loading={isStartingProduction} 
                style={{ background: '#f59e0b', borderColor: '#f59e0b', borderRadius: 8, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center' }}
              >
                Production
              </Button>
            )}

            {status === 'in_production' && (
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined style={{ color: '#fff' }} />} 
                onClick={onReady} 
                loading={isMarkingReady} 
                style={{ background: '#a855f7', borderColor: '#a855f7', borderRadius: 8, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center' }}
              >
                Ready
              </Button>
            )}

            {status === 'ready' && (
              <>
                <Button 
                  type="primary" 
                  icon={<CarOutlined style={{ color: '#fff' }} />} 
                  onClick={onCreateDelivery} 
                  loading={isCreatingDelivery} 
                  style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center' }}
                >
                  Delivery
                </Button>
                <Button 
                  type="primary" 
                  icon={<DollarOutlined style={{ color: '#fff' }} />} 
                  onClick={onCreateInvoice} 
                  loading={isCreatingInvoice} 
                  style={{ background: '#3b82f6', borderColor: '#3b82f6', borderRadius: 8, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center' }}
                >
                  Invoice
                </Button>
              </>
            )}

            {status === 'delivered' && (
              <Tag color="green" style={{ padding: '6px 16px', fontSize: 13, borderRadius: 8, border: '1px solid #86efac', fontWeight: 600 }}>
                COMPLETED
              </Tag>
            )}

            {status === 'cancelled' && (
              <Tag color="red" style={{ padding: '6px 16px', fontSize: 13, borderRadius: 8, border: '1px solid #fca5a5', fontWeight: 600 }}>
                CANCELLED
              </Tag>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </Space>
    </div>
  )
}

export default ActionToolbar
