import React, { useState, useMemo } from 'react'
import {
  Card, Row, Col, Typography, Table, Tag, Button,
  Input, Modal, Form, InputNumber, Select, App,
  Statistic, Alert, Space, Badge
} from 'antd'
import {
  AppstoreOutlined, WarningOutlined, DollarOutlined,
  SearchOutlined, ToolOutlined, PlusOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined, HistoryOutlined, DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { productApi, stockMovementApi, warehouseApi } from '../../api'
import OpeningStockImportModal from './OpeningStockImportModal'

const { Title, Text } = Typography

const StockOverview = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [openingModalOpen, setOpeningModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [adjForm] = Form.useForm()
  const [openingForm] = Form.useForm()

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productApi.list({ page_size: 1000 }).then(r => r.data)
  })

  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements-overview'],
    queryFn: () => stockMovementApi.list({ page_size: 2000 }).then(r => r.data)
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-dd'],
    queryFn: () => warehouseApi.dropdown().then(r => r.data)
  })

  const rawProducts = productsData?.items || []
  const movements = movementsData?.items || []

  // Filter out non-stock / service products
  const products = useMemo(() => {
    return rawProducts.filter(p => p.stock_uom !== 'service' && p.product_type !== 'service')
  }, [rawProducts])

  // Mutations
  const adjustMutation = useMutation({
    mutationFn: async (values) => {
      const p = products.find(item => item.id === values.product_id)
      let qtySqm = (values.qty_change !== undefined && values.qty_change !== null && values.qty_change !== '')
        ? parseFloat(values.qty_change)
        : ((values.quantity_sqm !== undefined && values.quantity_sqm !== null && values.quantity_sqm !== '')
          ? parseFloat(values.quantity_sqm)
          : ((values.quantity !== undefined && values.quantity !== null && values.quantity !== '')
            ? parseFloat(values.quantity)
            : null))

      let qtySheets = (values.quantity_sheets !== undefined && values.quantity_sheets !== null && values.quantity_sheets !== '')
        ? parseFloat(values.quantity_sheets)
        : null

      // Derive missing unit based on product sheet dimensions (X1)
      const widthM = p?.sheet_width_mm ? p.sheet_width_mm / 1000.0 : 0
      const heightM = p?.sheet_height_mm ? p.sheet_height_mm / 1000.0 : 0
      const sheetArea = widthM * heightM

      if (qtySqm !== null && !isNaN(qtySqm)) {
        if (qtySheets === null || isNaN(qtySheets)) {
          qtySheets = sheetArea > 0 ? Math.round((qtySqm / sheetArea) * 10000) / 10000 : 0
        }
      } else if (qtySheets !== null && !isNaN(qtySheets)) {
        if (qtySqm === null || isNaN(qtySqm)) {
          qtySqm = sheetArea > 0 ? Math.round((qtySheets * sheetArea) * 10000) / 10000 : 0
        }
      }

      if (qtySqm === null || isNaN(qtySqm)) qtySqm = 0
      if (qtySheets === null || isNaN(qtySheets)) qtySheets = 0

      const warehouseId = values.warehouse_id || warehouses[0]?.id || 1

      return stockMovementApi.create({
        product_id: values.product_id,
        movement_type: 'adjustment',
        quantity: qtySqm,
        quantity_sqm: qtySqm,
        quantity_sheets: qtySheets,
        warehouse_id: warehouseId,
        reference: 'MANUAL-ADJ',
        remarks: values.remarks || 'Stock adjustment'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-all'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements-overview'] })
      message.success('Stock movement posted successfully')
      setAdjModalOpen(false)
      adjForm.resetFields()
    },
    onError: (err) => {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to post stock adjustment'
      message.error(errorMsg)
    }
  })

  const openingStockMutation = useMutation({
    mutationFn: async (values) => {
      const p = products.find(item => item.id === values.product_id)
      let qtySqm = (values.opening_qty !== undefined && values.opening_qty !== null && values.opening_qty !== '')
        ? parseFloat(values.opening_qty)
        : ((values.quantity_sqm !== undefined && values.quantity_sqm !== null && values.quantity_sqm !== '')
          ? parseFloat(values.quantity_sqm)
          : ((values.quantity !== undefined && values.quantity !== null && values.quantity !== '')
            ? parseFloat(values.quantity)
            : null))

      let qtySheets = (values.quantity_sheets !== undefined && values.quantity_sheets !== null && values.quantity_sheets !== '')
        ? parseFloat(values.quantity_sheets)
        : null

      // Derive missing unit based on product sheet dimensions (X1)
      const widthM = p?.sheet_width_mm ? p.sheet_width_mm / 1000.0 : 0
      const heightM = p?.sheet_height_mm ? p.sheet_height_mm / 1000.0 : 0
      const sheetArea = widthM * heightM

      if (qtySqm !== null && !isNaN(qtySqm)) {
        if (qtySheets === null || isNaN(qtySheets)) {
          qtySheets = sheetArea > 0 ? Math.round((qtySqm / sheetArea) * 10000) / 10000 : 0
        }
      } else if (qtySheets !== null && !isNaN(qtySheets)) {
        if (qtySqm === null || isNaN(qtySqm)) {
          qtySqm = sheetArea > 0 ? Math.round((qtySheets * sheetArea) * 10000) / 10000 : 0
        }
      }

      if (qtySqm === null || isNaN(qtySqm)) qtySqm = 0
      if (qtySheets === null || isNaN(qtySheets)) qtySheets = 0

      const warehouseId = values.warehouse_id || warehouses[0]?.id || 1

      return stockMovementApi.create({
        product_id: values.product_id,
        movement_type: 'adjustment',
        quantity: qtySqm,
        quantity_sqm: qtySqm,
        quantity_sheets: qtySheets,
        warehouse_id: warehouseId,
        reference: 'OPENING-BAL',
        remarks: values.remarks || 'Physical stock audit count'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-all'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements-overview'] })
      message.success('Opening stock balance set successfully')
      setOpeningModalOpen(false)
      openingForm.resetFields()
    },
    onError: (err) => {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to set opening stock balance'
      message.error(errorMsg)
    }
  })

  // Map latest movement date per product
  const lastMoveMap = useMemo(() => {
    const map = {}
    movements.forEach(m => {
      if (!m.product_id) return
      const mDate = m.date || m.created_at
      if (!map[m.product_id] || (mDate && new Date(mDate) > new Date(map[m.product_id]))) {
        map[m.product_id] = mDate
      }
    })
    return map
  }, [movements])

  // Check if any product has uninitialized opening stock (no movements recorded)
  const uninitializedCount = useMemo(() => {
    return products.filter(p => !lastMoveMap[p.id]).length
  }, [products, lastMoveMap])

  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState(null)

  // Compute warehouse-specific stock map when a warehouse filter is active
  const warehouseStockMap = useMemo(() => {
    if (!selectedWarehouseFilter) return null
    const map = {}
    movements.forEach(m => {
      if (m.warehouse_id !== selectedWarehouseFilter || !m.product_id) return
      const pid = m.product_id
      if (!map[pid]) map[pid] = { sqm: 0, sheets: 0 }
      const mtype = (m.movement_type || '').toLowerCase().trim()
      const qSqm = m.quantity_sqm !== undefined && m.quantity_sqm !== null ? m.quantity_sqm : (m.quantity || 0)
      const qSheets = m.quantity_sheets || 0

      if (mtype === 'in') {
        map[pid].sqm += qSqm
        map[pid].sheets += qSheets
      } else if (mtype === 'out') {
        map[pid].sqm -= qSqm
        map[pid].sheets -= qSheets
      } else if (mtype === 'adjustment') {
        map[pid].sqm = qSqm
        map[pid].sheets = qSheets
      }
    })
    return map
  }, [movements, selectedWarehouseFilter])

  // Helper to get effective sqm and sheets for a product given current warehouse filter
  const getProductStock = (p) => {
    if (selectedWarehouseFilter && warehouseStockMap) {
      const wData = warehouseStockMap[p.id] || { sqm: 0, sheets: 0 }
      return {
        sqm: Math.round(wData.sqm * 10000) / 10000,
        sheets: Math.round(wData.sheets * 10000) / 10000
      }
    }
    const sqm = p.on_hand_sqm !== undefined && p.on_hand_sqm !== null ? p.on_hand_sqm : (p.on_hand_qty || 0)
    const sheets = p.on_hand_sheets || 0
    return { sqm, sheets }
  }

  const stats = useMemo(() => {
    let lowCount = 0, outCount = 0, totalValue = 0, totalSqm = 0, totalSheets = 0
    products.forEach(p => {
      const { sqm, sheets } = getProductStock(p)
      const min = p.min_qty || 0
      if (sqm === 0 && sheets === 0) outCount++
      else if (sqm < min) lowCount++
      totalSqm += sqm
      totalSheets += sheets
      totalValue += sqm * (p.cost_price || 0)
    })
    return {
      totalProducts: products.length,
      lowCount, outCount, totalValue, totalSqm, totalSheets
    }
  }, [products, warehouseStockMap, selectedWarehouseFilter])

  const filteredProducts = useMemo(() => {
    let list = products
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(s) ||
        (p.internal_ref || '').toLowerCase().includes(s) ||
        (p.glass_type || '').toLowerCase().includes(s) ||
        (p.brand || '').toLowerCase().includes(s)
      )
    }
    return list
  }, [products, search])

  const getStockStatus = (p) => {
    const { sqm } = getProductStock(p)
    const min = p.min_qty || 0
    if (sqm === 0) return { color: 'red', text: 'Out of Stock', icon: <CloseCircleOutlined /> }
    if (sqm < min) return { color: 'orange', text: 'Low Stock', icon: <ExclamationCircleOutlined /> }
    return { color: 'green', text: 'In Stock', icon: <CheckCircleOutlined /> }
  }

  const columns = [
    {
      title: 'Product', dataIndex: 'name', key: 'name', width: 260,
      render: (v, r) => (
        <div>
          <Text strong style={{ color: '#1e293b' }}>{v}</Text>
          <div style={{ marginTop: 2 }}>
            <Space size={4}>
              <Text type="secondary" style={{ fontSize: 11 }}>{r.internal_ref}</Text>
              {r.brand && <Tag color="purple" style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px' }}>{r.brand}</Tag>}
            </Space>
          </div>
        </div>
      )
    },
    {
      title: 'Glass Type', dataIndex: 'glass_type', key: 'glass_type', width: 140,
      render: v => v ? <Tag color="blue">{v}</Tag> : '—'
    },
    {
      title: 'Thickness', dataIndex: 'thickness_mm', key: 'thickness_mm', width: 90,
      render: v => v ? `${v} mm` : '—'
    },
    {
      title: 'Dimensions', key: 'dims', width: 120,
      render: (_, r) => r.sheet_width_mm && r.sheet_height_mm ? `${r.sheet_width_mm}×${r.sheet_height_mm}mm` : '—'
    },
    {
      title: 'On Hand Stock (Derived)', key: 'on_hand_qty', width: 180,
      render: (_, r) => {
        const status = getStockStatus(r)
        const { sqm, sheets } = getProductStock(r)
        return (
          <div>
            <Text strong style={{ color: status.color === 'green' ? '#16a34a' : status.color === 'orange' ? '#ea580c' : '#dc2626', fontSize: 15 }}>
              {sqm.toLocaleString(undefined, { maximumFractionDigits: 4 })} sqm
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({sheets.toLocaleString(undefined, { maximumFractionDigits: 2 })} sheets)
            </Text>
          </div>
        )
      }
    },
    {
      title: 'Stock Valuation', key: 'value', width: 120,
      render: (_, r) => {
        const { sqm } = getProductStock(r)
        const val = sqm * (r.cost_price || 0)
        return <Text strong style={{ color: '#1e293b' }}>₹{val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
      }
    },
    {
      title: 'Last Movement', key: 'last_move', width: 140,
      render: (_, r) => {
        const lastDate = lastMoveMap[r.id]
        if (!lastDate) {
          return <Tag color="default" style={{ fontSize: 11 }}>No movements</Tag>
        }
        return <Text style={{ fontSize: 12 }}>{String(lastDate).slice(0, 10)}</Text>
      }
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => {
        const s = getStockStatus(r)
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>
      }
    },
    {
      title: 'Actions', key: 'action', width: 170, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ToolOutlined />}
            onClick={() => {
              adjForm.setFieldsValue({ product_id: r.id, qty_change: 0 })
              setAdjModalOpen(true)
            }}
          >
            Adjust
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => navigate(`/inventory/movements?product_id=${r.id}`)}
          >
            History
          </Button>
        </Space>
      )
    }
  ]

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Template with Example Row (U1)
    const templateData = [
      {
        'Product Code': 'CLR-6MM-2440',
        'Product Name': 'Clear Annealed Glass 6mm',
        'Glass Type': 'Clear',
        'Thickness (mm)': 6,
        'Sheet W (mm)': 2440,
        'Sheet H (mm)': 3660,
        'UoM': 'sheet',
        'Quantity': 100,
        'Rate': 450
      }
    ]
    const wsTemplate = XLSX.utils.json_to_sheet(templateData)
    wsTemplate['!cols'] = [
      { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 15 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }
    ]
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Opening Stock Template')

    // Sheet 2: Note / Instructions (U1)
    const instructions = [
      { 'Note': 'Paste your Tally or Excel stock summary into this template format.' },
      { 'Note': 'Required fields: Product Code or Product Name, Quantity.' },
      { 'Note': 'UoM options: sheet (for glass sheets), nos (for accessories/hardware), service (non-stock).' },
      { 'Note': 'Matching Order: Exact Product Code -> Exact Name -> Name + Thickness.' },
    ]
    const wsNotes = XLSX.utils.json_to_sheet(instructions)
    wsNotes['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Instructions')

    XLSX.writeFile(wb, 'Tally_Opening_Stock_Template.xlsx')
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>Stock Overview</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
          {stats.totalProducts} stock-tracked products (dual-unit sqm & sheet tracking)
        </Text>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
            <Statistic title="Stock Products" value={stats.totalProducts} prefix={<AppstoreOutlined style={{ color: '#16a34a' }} />} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #fef3c7', background: '#fffbeb' }}>
            <Statistic title="Low Stock Items" value={stats.lowCount} prefix={<WarningOutlined style={{ color: '#d97706' }} />} valueStyle={{ color: '#d97706' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #fee2e2', background: '#fef2f2' }}>
            <Statistic title="Out of Stock" value={stats.outCount} prefix={<CloseCircleOutlined style={{ color: '#dc2626' }} />} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
            <Statistic title="Total Stock Value" value={stats.totalValue} prefix="₹" valueStyle={{ color: '#1d4ed8', fontSize: 20 }} formatter={v => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} />
          </Card>
        </Col>
      </Row>

      {/* Opening Stock Warning Banner */}
      {uninitializedCount > 0 && (
        <Alert
          message="Opening stock not yet entered"
          description={`${uninitializedCount} product(s) have no recorded movement history. Stock counts reflect movement audit history only. Import Tally Godown Summary to initialize baseline stock.`}
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          action={
            <Space wrap>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Download Template
              </Button>
              <Button size="small" type="primary" icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                Import Tally Opening Stock
              </Button>
            </Space>
          }
        />
      )}

      {/* Low stock alert */}
      {stats.lowCount > 0 && (
        <Alert
          message={`⚠️ ${stats.lowCount} product(s) are below minimum stock level — consider placing a Purchase Order`}
          type="warning" showIcon closable style={{ marginBottom: 16, borderRadius: 8 }}
          action={<Button size="small" onClick={() => window.location.href = '/purchase-orders/new'}>Create PO</Button>}
        />
      )}

      {/* Search + Warehouse Filter + Table */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Input
              placeholder="Search product, brand, code..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            {warehouses.length > 0 && (
              <Select
                placeholder="All Warehouses"
                style={{ width: 180 }}
                allowClear
                value={selectedWarehouseFilter}
                onChange={val => setSelectedWarehouseFilter(val)}
                options={warehouses.map(w => ({ value: w.id, label: `🏢 ${w.name}` }))}
              />
            )}
          </Space>
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setImportModalOpen(true)}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              Import Tally Stock (.xlsx)
            </Button>
            <Button
              onClick={() => { openingForm.resetFields(); setOpeningModalOpen(true) }}
            >
              Set Opening Balance
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => { adjForm.resetFields(); setAdjModalOpen(true) }}
            >
              Adjust Stock
            </Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          dataSource={filteredProducts}
          columns={columns}
          loading={isProductsLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          rowClassName={r => {
            const qty = r.on_hand_sqm !== undefined && r.on_hand_sqm !== null ? r.on_hand_sqm : (r.on_hand_qty || 0)
            if (qty === 0) return 'row-out-of-stock'
            if (qty < (r.min_qty || 0)) return 'row-low-stock'
            return ''
          }}
        />
      </Card>

      {/* Adjust Stock Modal */}
      <Modal
        title="📦 Adjust Stock"
        open={adjModalOpen}
        onCancel={() => setAdjModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={adjForm} layout="vertical" initialValues={{ warehouse_id: warehouses[0]?.id }} onFinish={v => adjustMutation.mutate(v)}>
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select
              showSearch
              placeholder="Select product"
              options={products.map(p => ({
                value: p.id,
                label: `${p.name} (Current Stock: ${p.on_hand_sqm || 0} sqm)`
              }))}
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="qty_change" label="Quantity Change (sqm)" tooltip="Use positive to add stock, negative to reduce" rules={[{ required: true, message: 'Please enter quantity change' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="+10 sqm to add, -5 sqm to reduce" />
          </Form.Item>
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Please select a warehouse' }]}>
            <Select
              placeholder="Select warehouse"
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Reason / Remarks">
            <Input.TextArea rows={2} placeholder="e.g., Physical count, damaged goods, etc." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setAdjModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={adjustMutation.isPending}>Post Movement</Button>
          </div>
        </Form>
      </Modal>

      {/* Set Opening Balance Modal */}
      <Modal
        title="📋 Set Opening Stock Balance"
        open={openingModalOpen}
        onCancel={() => setOpeningModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={openingForm} layout="vertical" initialValues={{ warehouse_id: warehouses[0]?.id, remarks: 'Physical stock audit count' }} onFinish={v => openingStockMutation.mutate(v)}>
          <Alert
            message="This creates an adjustment baseline movement and sets the initial stock for the selected product."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select
              showSearch
              placeholder="Select product"
              options={products.map(p => ({
                value: p.id,
                label: `${p.name}`
              }))}
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="opening_qty" label="Physical Opening Count (sqm)" rules={[{ required: true, message: 'Please enter physical count' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter initial count in sqm (e.g. 50 sqm)" />
          </Form.Item>
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Please select a warehouse' }]}>
            <Select
              placeholder="Select warehouse"
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} placeholder="Physical stock audit count" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpeningModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={openingStockMutation.isPending}>Set Opening Stock</Button>
          </div>
        </Form>
      </Modal>

      {/* Opening Stock Excel Import Modal */}
      <OpeningStockImportModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        products={products}
        movements={movements}
        warehouses={warehouses}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products-all'] })
          queryClient.invalidateQueries({ queryKey: ['stock-movements-overview'] })
          queryClient.invalidateQueries({ queryKey: ['warehouses-dd'] })
        }}
      />


      <style>{`
        .row-out-of-stock td { background: #fff1f2 !important; }
        .row-low-stock td { background: #fff7ed !important; }
      `}</style>
    </div>
  )
}

export default StockOverview
