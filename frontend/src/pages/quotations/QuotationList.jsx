import React, { useState } from 'react'
import { Tag, Button, Tooltip, Typography, Space, App } from 'antd'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, DownloadOutlined, FileImageOutlined, WhatsAppOutlined } from '@ant-design/icons'
import MasterList from '../../components/common/MasterList'
import { quotationApi, customerApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'
import { sendQuotationOnWhatsApp, buildQuotationRecordPdfBlob } from '../../utils/quotationWhatsApp'
import { QUOTE_STATUS_LABELS } from './components/ActionToolbar'
import CuttingListImportModal from '../../components/CuttingListImportModal'

const { Text } = Typography

const WHATSAPP_STATUSES = ['confirmed', 'converted']

const STATUS_COLORS = { draft: 'blue', sent: 'orange', confirmed: 'green', converted: 'purple', cancelled: 'red', lost: 'red' }

const QuotationList = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const leadId = searchParams.get('lead_id')

  const [statusTab, setStatusTab] = useState('active')
  const [counts, setCounts] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState(null)
  const { message } = App.useApp()

  // The list row is not used for the PDF: fetch the full quotation and its customer first.
  const handleSendWhatsApp = async (row) => {
    setSendingWhatsAppId(row.id)
    try {
      let quotation, customer
      try {
        quotation = (await quotationApi.get(row.id)).data
        customer = quotation.customer_id ? (await customerApi.get(quotation.customer_id)).data : null
      } catch (err) {
        message.error('Could not load the quotation to send it')
        return
      }
      await sendQuotationOnWhatsApp({
        quotationId: quotation.id,
        quoteNumber: quotation.quote_number,
        customer,
        record: quotation,
        buildBlob: () => buildQuotationRecordPdfBlob(quotation),
        message,
      })
    } finally {
      setSendingWhatsAppId(null)
    }
  }

  const tabs = [
    { key: 'active', label: 'Active', count: counts?.active },
    { key: 'converted', label: 'Confirmed', count: counts?.converted },
    { key: 'lost', label: 'Lost', count: counts?.lost },
    { key: 'all', label: 'All', count: counts?.all },
  ]

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
        tabs={tabs}
        activeTab={statusTab}
        onTabChange={setStatusTab}
        onDataLoad={(data) => setCounts(data?.counts)}
        apiFilters={{
          ...(leadId ? { crm_lead_id: leadId } : {}),
          status: statusTab,
        }}
        columns={[
          { title: 'Quote No.',  dataIndex: 'quote_number', key: 'quote_number', width: 130 },
          { title: 'Customer',   dataIndex: 'customer_name', key: 'customer_name', width: 200, render: (v, r) => v || r.customer?.name || '—' },
          { title: 'Date',       dataIndex: 'quote_date',   key: 'quote_date',   width: 120 },
          { title: 'Valid Until', dataIndex: 'valid_until',  key: 'valid_until',  width: 120 },
          { title: 'Salesperson', dataIndex: 'salesperson',  key: 'salesperson',  width: 140 },
          { title: 'Subtotal',   dataIndex: 'subtotal',     key: 'subtotal',     width: 120,
            render: v => v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—' },
          { title: 'Tax',        dataIndex: 'totals',       key: 'tax_amount',   width: 100,
            render: (_, r) => {
              const t = r.totals || {}
              const tax = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0)
              return tax > 0 ? `₹ ${Number(tax.toFixed(2)).toLocaleString('en-IN')}` : '—' } },
          { title: 'Total',      dataIndex: 'total_amount', key: 'total_amount', width: 130,
            render: v => v != null ? <b>₹ {Math.round(Number(v)).toLocaleString('en-IN')}</b> : '—' },
          { title: 'Status',     dataIndex: 'status',       key: 'status',       width: 200,
            render: (v, r) => v === 'converted' ? (
              <Space size={4} wrap>
                <Tag color="purple">🔄 Confirmed</Tag>
                {r.so_id && (
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/sales-orders/${r.so_id}/edit`)
                    }}
                  >
                    {r.so_number || `SO#${r.so_id}`} ↗
                  </Tag>
                )}
              </Space>
            ) : <Tag color={STATUS_COLORS[v] || 'default'}>{QUOTE_STATUS_LABELS[v] || v?.toUpperCase()}</Tag> },
        ]}
        createPath={leadId ? `/quotations/new?lead_id=${leadId}` : '/quotations/new'}
        editPath={(r) => `/quotations/${r.id}/edit`}
        searchPlaceholder="Search by quote number or salesperson..."
        extraHeaderActions={
          <Button
            icon={<FileImageOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            Import from Photo
          </Button>
        }
        extraActions={(r) => (
          <>
            <Tooltip title="Download PDF">
              <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: '#10b981' }} onClick={() => generateQuotationPDF(r)} />
            </Tooltip>
            {WHATSAPP_STATUSES.includes(r.status) && (
              <Tooltip title="Send on WhatsApp">
                <Button
                  type="text"
                  size="small"
                  icon={<WhatsAppOutlined />}
                  style={{ color: '#25D366' }}
                  loading={sendingWhatsAppId === r.id}
                  disabled={sendingWhatsAppId !== null && sendingWhatsAppId !== r.id}
                  onClick={() => handleSendWhatsApp(r)}
                  aria-label="Send on WhatsApp"
                />
              </Tooltip>
            )}
          </>
        )}
      />
      <CuttingListImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </>
  )
}

export default QuotationList
