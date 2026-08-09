import React from 'react'
import { Tag, Button, Tooltip, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import MasterList from '../../components/common/MasterList'
import { tougheningBatchApi } from '../../api'
import { generateTougheningChallanPDF } from '../../utils/pdfGenerator'

const renderStatusTag = (row) => {
  const status = row.status || 'draft'
  const rawItems = row.lines?.length ? row.lines : (row.items?.length ? row.items : [])
  const totalQty = rawItems.reduce((s, it) => s + (it.qty || it.quantity || 1), 0)

  if (status === 'draft') {
    return <Tag color="default">DRAFT</Tag>
  }

  const totalReceived = rawItems.reduce((s, it) => {
    let rec = typeof it.qty_received === 'number' ? it.qty_received : 0
    if (typeof it.qty_received !== 'number') {
      if (it.item_status === 'received' || it.received_done === true) {
        rec = it.qty || it.quantity || 1
      }
    }
    return s + rec
  }, 0)

  const totalShort = rawItems.reduce((s, it) => {
    let sh = typeof it.qty_short === 'number' ? it.qty_short : 0
    if (typeof it.qty_short !== 'number' && it.item_status === 'rejected') {
      sh = it.qty || it.quantity || 1
    }
    return s + sh
  }, 0)

  const isFullyAccounted = totalQty > 0 && (totalReceived + totalShort >= totalQty)

  if (isFullyAccounted || status === 'received') {
    return <Tag color="success">RECEIVED ({totalReceived}/{totalQty})</Tag>
  }

  if (totalReceived > 0 || status === 'partial_received') {
    return <Tag color="warning">PARTIAL ({totalReceived}/{totalQty})</Tag>
  }

  return <Tag color="processing">SENT (0/{totalQty})</Tag>
}

const columns = [
  { title: 'Batch #', dataIndex: 'tb_number', width: 120, render: v => <span style={{ fontWeight: 600, color: '#dc2626' }}>{v}</span> },
  { title: 'Vendor', dataIndex: 'vendor_name', width: 200 },
  { title: 'WO #', dataIndex: 'wo_number', width: 120 },
  { title: 'Sent Date', dataIndex: 'sent_date', width: 120 },
  { title: 'Items', dataIndex: 'lines', width: 80, render: v => v?.length || 0 },
  { title: 'Total Sqmt', dataIndex: 'total_sqmt', width: 120, render: v => v ? v.toFixed(4) : '—' },
  { title: 'Amount', dataIndex: 'total_amount', width: 120, render: v => `₹ ${Number(v || 0).toLocaleString('en-IN')}` },
  { title: 'Status', key: 'status', width: 160, render: (_, r) => renderStatusTag(r) },
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
