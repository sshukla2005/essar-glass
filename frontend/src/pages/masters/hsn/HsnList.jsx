// ─── HsnList.jsx ─────────────────────────────────────────────────────────────
import React from 'react'
import { Tag } from 'antd'
import MasterList from '../../../components/common/MasterList'
import { hsnApi } from '../../../api'

export const HsnList = () => (
  <MasterList
    title="HSN / SAC Codes"
    queryKey="hsn-codes"
    api={hsnApi}
    columns={[
      { title: 'Code',        dataIndex: 'code',            key: 'code',        width: 120, render: v => <Tag color="geekblue">{v}</Tag> },
      { title: 'Type',        dataIndex: 'hsn_type',        key: 'hsn_type',    width: 80,  render: v => <Tag color={v === 'HSN' ? 'blue' : 'purple'}>{v}</Tag> },
      { title: 'Description', dataIndex: 'description',     key: 'description', width: 320, ellipsis: true },
      { title: 'Chapter',     dataIndex: 'chapter_heading', key: 'chapter',     width: 180, render: v => v || '—', ellipsis: true },
      { title: 'GST Rate',    dataIndex: 'gst_rate',        key: 'gst_rate',    width: 100, render: v => v != null ? `${v}%` : '—' },
      { title: 'CGST',        dataIndex: 'cgst_rate',       key: 'cgst_rate',   width: 90,  render: v => v != null ? `${v}%` : '—' },
      { title: 'SGST',        dataIndex: 'sgst_rate',       key: 'sgst_rate',   width: 90,  render: v => v != null ? `${v}%` : '—' },
      { title: 'IGST',        dataIndex: 'igst_rate',       key: 'igst_rate',   width: 90,  render: v => v != null ? `${v}%` : '—' },
    ]}
    createPath="/masters/hsn-codes/new"
    editPath={(r) => `/masters/hsn-codes/${r.id}/edit`}
    searchPlaceholder="Search by code or description..."
  />
)
