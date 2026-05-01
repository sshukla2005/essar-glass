import React from 'react'
import { Tag } from 'antd'
import { useSearchParams } from 'react-router-dom'
import MasterList from '../../components/common/MasterList'
import { quotationApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'
import { Button, Tooltip } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'

const STATUS_COLORS = { draft: 'blue', sent: 'orange', confirmed: 'green', converted: 'purple', cancelled: 'red' }

const QuotationList = () => {
  const [searchParams] = useSearchParams()
  const leadId = searchParams.get('lead_id')

  return (
    <MasterList
      title={leadId ? `Quotations for Lead #${leadId}` : 'Quotations'}
      queryKey="quotations"
      api={quotationApi}
      nameField="quote_number"
      extraFilters={leadId ? { crm_lead_id: leadId } : undefined}
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
  )
}

export default QuotationList
