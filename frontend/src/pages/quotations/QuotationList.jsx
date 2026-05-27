import React from 'react'
import { Tag, Button, Tooltip, Typography } from 'antd'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons'
import MasterList from '../../components/common/MasterList'
import { quotationApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'

const { Text } = Typography

const STATUS_COLORS = { draft: 'blue', sent: 'orange', confirmed: 'green', converted: 'purple', cancelled: 'red' }

const QuotationList = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const leadId = searchParams.get('lead_id')

  return (
    <>
      {leadId && (
        <div style={{
          padding: '8px 24px',
          background: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/crm/leads/${leadId}/edit`)}
          >
            Back to Lead
          </Button>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Showing quotations linked to Lead #{leadId}
          </Text>
        </div>
      )}
      <MasterList
        title={leadId ? `Quotations — Lead #${leadId}` : 'Quotations'}
        queryKey="quotations"
        api={quotationApi}
        nameField="quote_number"
        apiFilters={leadId ? { crm_lead_id: leadId } : undefined}
        columns={[
          { title: 'Quote No.',  dataIndex: 'quote_number', key: 'quote_number', width: 130 },
          { title: 'Customer',   dataIndex: 'customer',     key: 'customer',     width: 200, render: v => v?.name || '—' },
          { title: 'Date',       dataIndex: 'quote_date',   key: 'quote_date',   width: 120 },
          { title: 'Valid Until', dataIndex: 'valid_until',  key: 'valid_until',  width: 120 },
          { title: 'Salesperson', dataIndex: 'salesperson',  key: 'salesperson',  width: 140 },
          { title: 'Subtotal',   dataIndex: 'subtotal',     key: 'subtotal',     width: 120,
            render: v => v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—' },
          { title: 'Tax',        dataIndex: 'tax_amount',   key: 'tax_amount',   width: 100,
            render: v => v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—' },
          { title: 'Total',      dataIndex: 'total_amount', key: 'total_amount', width: 130,
            render: v => v != null ? <b>₹ {Number(v).toLocaleString('en-IN')}</b> : '—' },
          { title: 'Status',     dataIndex: 'status',       key: 'status',       width: 120,
            render: v => v === 'converted' ? <Tag color="purple">🔄 Converted</Tag> : <Tag color={STATUS_COLORS[v] || 'default'}>{v?.toUpperCase()}</Tag> },
        ]}
        createPath={leadId ? `/quotations/new?lead_id=${leadId}` : '/quotations/new'}
        editPath={(r) => `/quotations/${r.id}/edit`}
        searchPlaceholder="Search by quote number, salesperson..."
        extraActions={(r) => (
          <Tooltip title="Download PDF">
            <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#10b981' }} onClick={() => generateQuotationPDF(r)} />
          </Tooltip>
        )}
      />
    </>
  )
}

export default QuotationList
