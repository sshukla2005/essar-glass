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
import { makePdfFilename, generateTougheningChallanPDF } from '../../utils/pdfGenerator'

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
  const [selectedBatchUids, setSelectedBatchUids] = useState([])

  // ── FETCH WORKSHOP ORDERS ──────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['workshop_orders', page, pageSize, search, isActive],
    queryFn: () => workshopOrderApi.list({
      page,
      page_size: pageSize,
      search,
      is_active: isActive,
    }).then(r => r.data),
    placeholderData: (prev) => prev,
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
  const generateToughChallanPDF = async (lines, vendor, woIds) => {
    try {
      const batch = {
        tb_number: `TC-${dayjs().format('YYYYMMDD-HHmm')}`,
        batch_date: dayjs().format('YYYY-MM-DD'),
        vendor_name: vendor || 'Toughening Vendor',
        lines: lines,
      }
      await generateTougheningChallanPDF(batch)
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
                let _uidSeq = 0
                const allLines = woDetails.flatMap(wo =>
                  (wo.lines || [])
                    .filter(l => l.is_toughened)
                    .map(l => ({
                      ...l,
                      _uid: `bl_${_uidSeq++}`,
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
        onCancel={() => { setBatchModal(false); setBatchLines([]); setSelectedBatchUids([]) }}
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

        {/* Bulk-remove toolbar */}
        {selectedBatchUids.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                setBatchLines(prev => prev.filter(bl => !selectedBatchUids.includes(bl._uid)))
                setSelectedBatchUids([])
              }}
            >
              Remove selected ({selectedBatchUids.length})
            </Button>
          </div>
        )}

        {batchLines.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '24px 0',
            color: '#94a3b8', fontStyle: 'italic'
          }}>
            No glass lines left in this batch.
          </div>
        )}

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
                    {['#', 'Description', 'W (mm)', 'H (mm)', 'W+30', 'H+30', 'Qty', 'Sqmt', 'Source', ''].map(h => (
                      <th key={h} style={{
                        padding: '6px 8px', textAlign: 'left',
                        borderBottom: '1px solid #e2e8f0', fontWeight: 600
                      }}>{h}</th>
                    ))}
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', width: 32 }}>
                      <input
                        type="checkbox"
                        title="Select all in group"
                        checked={gLines.every(l => selectedBatchUids.includes(l._uid))}
                        onChange={e => {
                          const groupUids = gLines.map(l => l._uid)
                          if (e.target.checked) {
                            setSelectedBatchUids(prev => [...new Set([...prev, ...groupUids])])
                          } else {
                            setSelectedBatchUids(prev => prev.filter(u => !groupUids.includes(u)))
                          }
                        }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gLines.map((line, i) => {
                    const w30 = (line.act_w_mm || 0) + 30
                    const h30 = (line.act_h_mm || 0) + 30
                    const sqmt = (w30 / 1000) * (h30 / 1000) * (line.qty || 1)
                    const isChecked = selectedBatchUids.includes(line._uid)
                    return (
                      <tr key={line._uid || i} style={{
                        background: isChecked ? '#fff7ed' : (i % 2 === 0 ? '#fff' : '#f8fafc')
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
                        <td style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', width: 32 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              setSelectedBatchUids(prev =>
                                e.target.checked
                                  ? [...prev, line._uid]
                                  : prev.filter(u => u !== line._uid)
                              )
                            }}
                          />
                        </td>
                        <td style={{ padding: '5px 4px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                          <Button
                            type="text" danger size="small" icon={<DeleteOutlined />}
                            onClick={() => {
                              setBatchLines(prev => prev.filter(bl => bl._uid !== line._uid))
                              setSelectedBatchUids(prev => prev.filter(u => u !== line._uid))
                            }}
                          />
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
              disabled={batchLines.length === 0}
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
              disabled={!batchVendor || batchLines.length === 0}
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
                    // Persist the ENRICHED array (charged dims, sqmt, tgh_rate,
                    // amounts) as `lines` — the model's actual column. The old
                    // `items` key was silently stripped by the backend.
                    lines: tghItems,
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
