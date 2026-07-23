import React from 'react'
import { Tag, Button, Tooltip, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import MasterList from '../../components/common/MasterList'
import { tougheningBatchApi } from '../../api'
import { generateTougheningChallanPDF } from '../../utils/pdfGenerator'

const STATUS_COLORS = { draft: 'default', sent: 'processing', received: 'success' }

const columns = [
  { title: 'Batch #', dataIndex: 'tb_number', width: 120, render: v => <span style={{ fontWeight: 600, color: '#dc2626' }}>{v}</span> },
  { title: 'Vendor', dataIndex: 'vendor_name', width: 200 },
  { title: 'WO #', dataIndex: 'wo_number', width: 120 },
  { title: 'Sent Date', dataIndex: 'sent_date', width: 120 },
  { title: 'Items', dataIndex: 'lines', width: 80, render: v => v?.length || 0 },
  { title: 'Total Sqmt', dataIndex: 'total_sqmt', width: 120, render: v => v ? v.toFixed(4) : '—' },
  { title: 'Amount', dataIndex: 'total_amount', width: 120, render: v => `₹ ${Number(v || 0).toLocaleString('en-IN')}` },
  { title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{(v || 'draft').toUpperCase()}</Tag> },
]

const TougheningList = () => (
  <MasterList
    title="Toughening Batches"
    queryKey="toughening_batches"
    api={tougheningBatchApi}
    columns={columns}
    createPath="/workshop/toughening/new"
    editPath={(r) => `/workshop/toughening/${r.id}/edit`}
    searchPlaceholder="Search toughening batches..."
    nameField="tb_number"
    extraActions={(r) => (
      <Tooltip title="Download Challan">
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          style={{ color: '#10b981' }}
          onClick={async () => {
            const hide = message.loading('Generating Job Work Challan PDF...', 0)
            try {
              let fullBatch = r
              if (!r.lines || !r.lines.length) {
                try {
                  const res = await tougheningBatchApi.get(r.id)
                  if (res?.data) fullBatch = res.data
                } catch {}
              }
              await generateTougheningChallanPDF(fullBatch)
            } catch (err) {
              message.error('Failed to generate PDF: ' + (err?.message || 'Unknown error'))
            } finally {
              hide()
            }
          }}
        />
      </Tooltip>
    )}
  />
)

export default TougheningList
