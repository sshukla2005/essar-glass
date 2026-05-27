import React, { useState } from 'react'
import {
  Table, Button, Input, Space, Tag, Tooltip, Popconfirm, Select, Card,
  Typography, Row, Col, Badge, Dropdown, App, Modal, Divider
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EditOutlined, CopyOutlined,
  StopOutlined, CheckCircleOutlined, MoreOutlined, ReloadOutlined,
  FilterOutlined, DeleteOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { workshopOrderApi, tougheningBatchApi, vendorApi } from '../../api'

const { Search } = Input
const { Title, Text } = Typography
const DEFAULT_PAGE_SIZE = 20

const STATUS_COLORS = {
  draft: 'default',
  in_progress: 'processing',
  completed: 'success',
  cancelled: 'error'
}

const WorkshopOrderList = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── TABLE & LIST STATE ──────────────────────────────
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [isActive, setIsActive] = useState(undefined) // undefined = all

  // ── SELECTION & BATCH STATE ──────────────────────────
  const [selectedWoIds, setSelectedWoIds] = useState([])
  const [batchModal, setBatchModal] = useState(false)
  const [batchLines, setBatchLines] = useState([])
  const [batchLoadingIds, setBatchLoadingIds] = useState([])
  const [batchVendor, setBatchVendor] = useState(null)

  // ── FETCH WORKSHOP ORDERS ──────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['workshop_orders', page, pageSize, search, isActive],
    queryFn: () => workshopOrderApi.list({
      page,
      page_size: pageSize,
      search,
      is_active: isActive,
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-dd'],
    queryFn: () => vendorApi.dropdown().then(r => r.data)
  })
  const vendorList = Array.isArray(vendorsData)
    ? vendorsData
    : (vendorsData?.items || [])

  // ── ARCHIVE & CLONE MUTATIONS ──────────────────────
  const archiveMutation = useMutation({
    mutationFn: ({ id, active }) => workshopOrderApi.archive(id, active),
    onSuccess: (_, { active }) => {
      message.success(active ? 'Record activated' : 'Record archived')
      queryClient.invalidateQueries({ queryKey: ['workshop_orders'] })
    },
  })

  const cloneMutation = useMutation({
    mutationFn: (id) => workshopOrderApi.clone(id),
    onSuccess: (res) => {
      message.success('Record cloned successfully')
      queryClient.invalidateQueries({ queryKey: ['workshop_orders'] })
      navigate(`/workshop/orders/${res.data.id}/edit`)
    },
  })

  // ── TOUGHENING DISPATCH CHALLAN PDF GENERATOR ─────
  const generateToughChallanPDF = (lines, vendor, woIds) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 14

      // ── HEADER ──────────────────────────────────────
      doc.setFillColor(220, 38, 38) // red
      doc.rect(0, 0, pageW, 30, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('ESSAR GLASS', margin, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Toughening Dispatch Challan', margin, 19)
      doc.text('CENTER EG', margin, 25)

      // Challan number + date top right
      const challanNo = `TC-${dayjs().format('YYYYMMDD-HHmm')}`
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(challanNo, pageW - margin, 12, { align: 'right' })
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(dayjs().format('DD/MM/YYYY HH:mm'), pageW - margin, 19, { align: 'right' })

      // ── META ─────────────────────────────────────────
      doc.setTextColor(15, 23, 42)
      const metaY = 38

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Vendor:', margin, metaY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(vendor || '—', margin + 16, metaY)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Work Orders:', pageW / 2, metaY)
      doc.setFont('helvetica', 'normal')

      // Get WO numbers from lines
      const woNums = [...new Set(lines.map(l => l.source_wo).filter(Boolean))]
      doc.text(woNums.join(', '), pageW / 2 + 24, metaY)

      // Summary tags
      const totalPcs = lines.reduce((s, l) => s + (l.qty || 1), 0)
      const totalSqmt = lines.reduce((s, l) => {
        const w = ((l.act_w_mm || 0) + 30) / 1000
        const h = ((l.act_h_mm || 0) + 30) / 1000
        return s + w * h * (l.qty || 1)
      }, 0)

      doc.setFontSize(9)
      doc.text(`Total Pieces: ${totalPcs}`, margin, metaY + 7)
      doc.text(`Total Sqmt (with +30mm): ${totalSqmt.toFixed(4)} m²`, margin + 40, metaY + 7)
      doc.text(`Date: ${dayjs().format('DD/MM/YYYY')}`, pageW - margin, metaY + 7, { align: 'right' })

      // Divider
      doc.setDrawColor(220, 38, 38)
      doc.setLineWidth(0.5)
      doc.line(margin, metaY + 12, pageW - margin, metaY + 12)

      // ── GROUP BY THICKNESS ───────────────────────────
      const getThickness = (desc) => {
        const m = String(desc || '').match(/(\d+(?:\.\d+)?)mm/)
        return m ? parseFloat(m[1]) : 999
      }

      // Get unique thicknesses sorted ascending
      const thicknesses = [...new Set(lines.map(l => getThickness(l.description)))]
        .sort((a, b) => a - b)

      let currentY = metaY + 16

      thicknesses.forEach((thickness, ti) => {
        const groupLines = lines.filter(l => getThickness(l.description) === thickness)
        const groupPcs = groupLines.reduce((s, l) => s + (l.qty || 1), 0)
        const groupSqmt = groupLines.reduce((s, l) => {
          const w = ((l.act_w_mm || 0) + 30) / 1000
          const h = ((l.act_h_mm || 0) + 30) / 1000
          return s + w * h * (l.qty || 1)
        }, 0)

        // Thickness group header
        if (currentY + 8 > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage()
          currentY = 20
        }

        doc.setFillColor(30, 41, 59)
        doc.rect(margin, currentY, pageW - margin * 2, 7, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(
          `${thickness}mm TOUGHENED GLASS — ${groupPcs} pcs / ${groupSqmt.toFixed(4)} m²`,
          margin + 3,
          currentY + 5
        )
        currentY += 9

        // Table rows for this thickness group
        const tableRows = groupLines.map((line, i) => {
          const w30 = (line.act_w_mm || 0) + 30
          const h30 = (line.act_h_mm || 0) + 30
          const sqmt = ((w30 / 1000) * (h30 / 1000) * (line.qty || 1)).toFixed(4)
          return [
            i + 1,
            line.description || '—',
            line.act_w_mm || '—',
            line.act_h_mm || '—',
            w30,
            h30,
            line.qty || 1,
            sqmt,
            `${line.source_wo || ''} / ${line.source_so || ''}`,
            '', // Received (blank for vendor to fill)
          ]
        })

        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Description', 'W (mm)', 'H (mm)', 'W+30', 'H+30', 'Qty', 'Sqmt', 'Source', 'Rcvd ✓']],
          body: tableRows,
          styles: {
            fontSize: 9,
            cellPadding: 3,
            font: 'helvetica',
          },
          headStyles: {
            fillColor: [99, 102, 241],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 14, halign: 'center', textColor: [100, 116, 139] },
            5: { cellWidth: 14, halign: 'center', textColor: [100, 116, 139] },
            6: { cellWidth: 8, halign: 'center' },
            7: { cellWidth: 16, halign: 'right', textColor: [5, 150, 105] },
            8: { cellWidth: 30, fontSize: 8, textColor: [100, 116, 139] },
            9: { cellWidth: 14, halign: 'center' }, // blank received col
          },
          margin: { left: margin, right: margin },
        })

        currentY = doc.lastAutoTable.finalY + 6

        // Thickness subtotal
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(220, 38, 38)
        doc.text(
          `${thickness}mm Subtotal: ${groupPcs} pcs | ${groupSqmt.toFixed(4)} m²`,
          pageW - margin,
          currentY,
          { align: 'right' }
        )
        currentY += 8
      })

      // ── GRAND TOTAL BOX ──────────────────────────────
      if (currentY + 20 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        currentY = 20
      }

      doc.setDrawColor(220, 38, 38)
      doc.setLineWidth(0.5)
      doc.line(margin, currentY, pageW - margin, currentY)
      currentY += 6

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('GRAND TOTAL:', margin, currentY)
      doc.text(`${totalPcs} pieces`, margin + 35, currentY)
      doc.text(`${totalSqmt.toFixed(4)} m²`, margin + 70, currentY)

      // Signature blocks
      currentY += 16
      const sigY = currentY
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)

      doc.line(margin, sigY + 10, margin + 55, sigY + 10)
      doc.text('Dispatched By (Essar Glass)', margin, sigY + 14)

      doc.line(pageW / 2 - 20, sigY + 10, pageW / 2 + 35, sigY + 10)
      doc.text('Received By (Vendor)', pageW / 2 - 20, sigY + 14)

      doc.line(pageW - margin - 55, sigY + 10, pageW - margin, sigY + 10)
      doc.text('Return Date', pageW - margin - 55, sigY + 14)

      // ── FOOTER ───────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        const footY = doc.internal.pageSize.getHeight() - 8
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Challan: ${challanNo} | Generated: ${dayjs().format('DD/MM/YYYY HH:mm')} | Toughening Dispatch`,
          margin, footY
        )
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, footY, { align: 'right' })
      }

      doc.save(`ToughChallan_${challanNo}.pdf`)
      message.success('PDF downloaded!')
    } catch (err) {
      console.error('PDF error:', err)
      message.error('PDF failed: ' + (err?.message || ''))
    }
  }

  // ── COLUMNS ─────────────────────────────────────────
  const statusColumn = {
    title: 'Status',
    key: 'status_active',
    width: 90,
    render: (_, record) =>
      record.is_active
        ? <Badge status="success" text="Active" />
        : <Badge status="default" text="Archived" />,
  }

  const actionColumn = {
    title: 'Actions',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: (_, record) => {
      const menuItems = [
        {
          key: 'clone',
          icon: <CopyOutlined />,
          label: 'Duplicate',
          onClick: () => cloneMutation.mutate(record.id),
        },
        {
          key: 'archive',
          icon: record.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
          label: record.is_active ? 'Archive' : 'Unarchive',
          onClick: () => archiveMutation.mutate({ id: record.id, active: !record.is_active }),
          danger: record.is_active,
        },
      ]
      return (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#3b82f6' }}
              onClick={() => navigate(`/workshop/orders/${record.id}/edit`)}
            />
          </Tooltip>
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button size="small" type="text" icon={<MoreOutlined />} />
          </Dropdown>
          {workshopOrderApi.archive && (
            <Popconfirm title="Delete this record completely?" onConfirm={() => {
              archiveMutation.mutate({ id: record.id, active: false })
            }}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    },
  }

  const columns = [
    {
      title: 'WO #',
      dataIndex: 'wo_number',
      width: 120,
      render: (v, record) => (
        <a
          onClick={() => navigate(`/workshop/orders/${record.id}/edit`)}
          style={{ fontWeight: 600, color: '#ea580c', cursor: 'pointer' }}
        >
          {v}
        </a>
      )
    },
    { title: 'SO #', dataIndex: 'so_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_name', width: 200 },
    { title: 'Order Date', dataIndex: 'order_date', width: 120 },
    { title: 'Required By', dataIndex: 'required_by', width: 120 },
    { title: 'Items', dataIndex: 'lines', width: 80, render: v => v?.length || 0 },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 100,
      render: v => {
        const c = { urgent: 'red', high: 'orange', normal: 'blue' }
        return <Tag color={c[v] || 'blue'}>{(v || 'normal').toUpperCase()}</Tag>
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{(v || 'draft').replace('_', ' ').toUpperCase()}</Tag>
    },
    statusColumn,
    actionColumn
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* [ignoring loop detection] */}
      {/* ── PAGE HEADER ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #3b82f6 0%, #1e3a8a 100%)',
        padding: '16px 24px', borderRadius: 8, marginBottom: 16, color: 'white'
      }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0, color: 'white' }}>Workshop Orders</Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{data?.total ?? 0} records</Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/workshop/orders/new')}
              style={{ background: 'white', color: '#1e3a8a', fontWeight: 'bold' }}
            >
              New Workshop Order
            </Button>
          </Col>
        </Row>
      </div>

      {/* ── ACTION BAR (WHEN SELECTIONS EXIST) ────────────────────── */}
      {selectedWoIds.length >= 1 && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 8, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontWeight: 600, color: '#92400e' }}>
            🔥 {selectedWoIds.length} WO(s) selected
          </span>
          <Button
            type="primary"
            size="small"
            style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 600 }}
            onClick={async () => {
              setBatchLoadingIds(selectedWoIds)
              try {
                // Fetch all selected WOs
                const woDetails = await Promise.all(
                  selectedWoIds.map(woId =>
                    workshopOrderApi.get(woId).then(r => r.data)
                  )
                )

                // Extract toughened lines from all WOs
                const allLines = woDetails.flatMap(wo =>
                  (wo.lines || [])
                    .filter(l => l.is_toughened)
                    .map(l => ({
                      ...l,
                      source_wo: wo.wo_number,
                      source_so: wo.so_number,
                      wo_id: wo.id,
                      // Ensure mm values exist
                      act_w_mm: l.act_w_mm || (l.act_w_in ? Math.round(l.act_w_in * 25.4) : 0),
                      act_h_mm: l.act_h_mm || (l.act_h_in ? Math.round(l.act_h_in * 25.4) : 0),
                    }))
                )

                if (allLines.length === 0) {
                  message.warning('No toughened glass lines found in selected WOs')
                  return
                }

                // Smart sort: by thickness (from description) → then by area ascending
                const getThickness = (desc) => {
                  const match = String(desc || '').match(/(\d+(?:\.\d+)?)mm/)
                  return match ? parseFloat(match[1]) : 999
                }
                const getArea = (l) => (l.act_w_mm || 0) * (l.act_h_mm || 0)

                const sorted = [...allLines].sort((a, b) => {
                  const tA = getThickness(a.description)
                  const tB = getThickness(b.description)
                  if (tA !== tB) return tA - tB
                  return getArea(a) - getArea(b)
                })

                setBatchLines(sorted)
                setBatchModal(true)
              } catch (err) {
                message.error('Failed to load WO details: ' + (err?.message || ''))
              } finally {
                setBatchLoadingIds([])
              }
            }}
            loading={batchLoadingIds.length > 0}
          >
            🔥 Create Batch Toughening Challan
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedWoIds([])}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* ── FILTERS CARD ─────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Search
              placeholder="Search workshop orders..."
              allowClear
              prefix={<SearchOutlined />}
              onSearch={(val) => { setSearch(val); setPage(1) }}
              onChange={(e) => !e.target.value && setSearch('')}
              style={{ maxWidth: 340 }}
            />
          </Col>
          <Col>
            <Select
              placeholder={<><FilterOutlined /> Status</>}
              allowClear
              style={{ width: 140 }}
              value={isActive}
              onChange={(val) => { setIsActive(val); setPage(1) }}
              options={[
                { value: true, label: 'Active' },
                { value: false, label: 'Archived' },
              ]}
            />
          </Col>
          <Col>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['workshop_orders'] })}
              />
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* ── WORKSHOP ORDERS TABLE ────────────────────────────────── */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          dataSource={data?.items || []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          rowClassName={(r) => !r.is_active ? 'row-archived' : ''}
          rowSelection={{
            selectedRowKeys: selectedWoIds,
            onChange: keys => setSelectedWoIds(keys),
            getCheckboxProps: record => ({
              disabled: !record.lines?.some(l => l.is_toughened) &&
                        record.status !== 'in_progress'
            })
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </Card>

      {/* ── BATCH TOUGHENING MODAL ───────────────────────────────── */}
      <Modal
        title={
          <Space>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontWeight: 700 }}>
              Batch Toughening Challan — {selectedWoIds.length} WO(s)
            </span>
          </Space>
        }
        open={batchModal}
        onCancel={() => { setBatchModal(false); setBatchLines([]) }}
        width={900}
        footer={null}
      >
        {/* Vendor selector */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={10}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>
              Toughening Vendor <span style={{ color: 'red' }}>*</span>
            </div>
            <Select
              showSearch
              placeholder="Select toughening vendor"
              style={{ width: '100%' }}
              value={batchVendor}
              onChange={setBatchVendor}
              options={vendorList.map(v => ({ value: v.name, label: v.name }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Col>
          <Col span={14}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Summary</div>
            <Space wrap>
              <Tag color="blue">{batchLines.length} pieces total</Tag>
              <Tag color="orange">
                {[...new Set(batchLines.map(l => {
                  const m = String(l.description || '').match(/(\d+(?:\.\d+)?)mm/)
                  return m ? `${m[1]}mm` : '?mm'
                }))].join(', ')} thicknesses
              </Tag>
              <Tag color="green">
                {(batchLines.reduce((s, l) => {
                  const w = (l.act_w_mm || 0) / 1000
                  const h = (l.act_h_mm || 0) / 1000
                  return s + w * h * (l.qty || 1)
                }, 0)).toFixed(3)} sqm total
              </Tag>
            </Space>
          </Col>
        </Row>

        {/* Lines preview table — grouped by thickness */}
        {(() => {
          const getThickness = (desc) => {
            const m = String(desc || '').match(/(\d+(?:\.\d+)?)mm/)
            return m ? `${m[1]}mm` : 'Unknown'
          }
          const groups = {}
          batchLines.forEach(l => {
            const t = getThickness(l.description)
            if (!groups[t]) groups[t] = []
            groups[t].push(l)
          })

          return Object.entries(groups).map(([thickness, gLines]) => (
            <div key={thickness} style={{ marginBottom: 16 }}>
              <div style={{
                background: '#1e293b', color: '#fff',
                padding: '6px 12px', borderRadius: '6px 6px 0 0',
                fontWeight: 700, fontSize: 13,
                display: 'flex', justifyContent: 'space-between'
              }}>
                <span>🔲 {thickness} Toughened Glass</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
                  {gLines.length} pcs |{' '}
                  {gLines.reduce((s, l) => s + (l.qty || 1), 0)} qty total |{' '}
                  {(gLines.reduce((s, l) => {
                    const w = (l.act_w_mm || 0) / 1000
                    const h = (l.act_h_mm || 0) / 1000
                    return s + w * h * (l.qty || 1)
                  }, 0)).toFixed(3)} sqm
                </span>
              </div>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                border: '1px solid #e2e8f0', fontSize: 12
              }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['#', 'Description', 'W (mm)', 'H (mm)', 'W+30', 'H+30', 'Qty', 'Sqmt', 'Source'].map(h => (
                      <th key={h} style={{
                        padding: '6px 8px', textAlign: 'left',
                        borderBottom: '1px solid #e2e8f0', fontWeight: 600
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gLines.map((line, i) => {
                    const w30 = (line.act_w_mm || 0) + 30
                    const h30 = (line.act_h_mm || 0) + 30
                    const sqmt = (w30 / 1000) * (h30 / 1000) * (line.qty || 1)
                    return (
                      <tr key={i} style={{
                        background: i % 2 === 0 ? '#fff' : '#f8fafc'
                      }}>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                          {line.description}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                          {line.act_w_mm || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                          {line.act_h_mm || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                          {w30}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                          {h30}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                          {line.qty || 1}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#059669' }}>
                          {sqmt.toFixed(4)}
                        </td>
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                          <Tag color="purple" style={{ fontSize: 10 }}>
                            {line.source_wo}
                          </Tag>
                          <Tag color="blue" style={{ fontSize: 10 }}>
                            {line.source_so}
                          </Tag>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
        })()}

        {/* Action buttons */}
        <Row gutter={12} style={{ marginTop: 20 }}>
          <Col span={8}>
            <Button
              block
              icon={<span>📄</span>}
              style={{ borderColor: '#6366f1', color: '#6366f1', height: 42, fontWeight: 600 }}
              onClick={() => generateToughChallanPDF(batchLines, batchVendor, selectedWoIds)}
            >
              Download PDF Challan
            </Button>
          </Col>
          <Col span={8}>
            <Button
              block
              type="primary"
              icon={<span>🔥</span>}
              style={{ background: '#dc2626', borderColor: '#dc2626', height: 42, fontWeight: 600 }}
              disabled={!batchVendor}
              onClick={async () => {
                if (!batchVendor) {
                  message.warning('Please select a toughening vendor first')
                  return
                }
                try {
                  const tghItems = batchLines.map((l, i) => {
                    const qty = l.qty || l.quantity || 1
                    const w_mm = l.act_w_mm || 0
                    const h_mm = l.act_h_mm || 0
                    const w30 = w_mm + 30
                    const h30 = h_mm + 30
                    const sqmt = parseFloat(((w30 * h30 * qty) / 1000000).toFixed(6))
                    const rate = 1200
                    return {
                      wo_id: l.wo_id,
                      wo_number: l.source_wo,
                      so_number: l.source_so,
                      description: l.description,
                      width_mm: w_mm,
                      height_mm: h_mm,
                      quantity: qty,
                      qty: qty,
                      charged_w_mm: w30,
                      charged_h_mm: h30,
                      charged_sqmt: sqmt,
                      tgh_rate: rate,
                      tgh_amount: parseFloat((sqmt * rate).toFixed(2)),
                      item_status: 'pending',
                    }
                  })

                  await tougheningBatchApi.create({
                    vendor_name: batchVendor,
                    wo_ids: selectedWoIds,
                    lines: batchLines,
                    items: tghItems,
                    status: 'sent',
                    batch_date: dayjs().format('YYYY-MM-DD'),
                    total_pieces: batchLines.reduce((s, l) => s + (l.qty || 1), 0),
                    total_sqmt: batchLines.reduce((s, l) => {
                      const w = ((l.act_w_mm || 0) + 30) / 1000
                      const h = ((l.act_h_mm || 0) + 30) / 1000
                      return s + w * h * (l.qty || 1)
                    }, 0).toFixed(4),
                  })
                  message.success('Toughening batch created successfully!')
                  setBatchModal(false)
                  setBatchLines([])
                  setSelectedWoIds([])
                  queryClient.invalidateQueries({ queryKey: ['workshop_orders'] })
                } catch (err) {
                  message.error('Failed to create batch: ' + (err?.message || ''))
                }
              }}
            >
              Confirm & Save Batch
            </Button>
          </Col>
          <Col span={8}>
            <Button
              block
              style={{ height: 42 }}
              onClick={() => { setBatchModal(false); setBatchLines([]) }}
            >
              Cancel
            </Button>
          </Col>
        </Row>
      </Modal>

      <style>{`
        .row-archived td { opacity: 0.5; text-decoration: line-through; }
        .ant-table-row:hover > td { background-color: #f0f9ff !important; }
      `}</style>
    </div>
  )
}

export default WorkshopOrderList
