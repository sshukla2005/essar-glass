import React, { useState, useMemo, useEffect } from 'react'
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

const buildProductName = ({ glassType, brand, thicknessMm, widthMm, heightMm }) => {
  const parts = []
  const gt = Array.isArray(glassType) ? glassType[0] : glassType
  if (gt && String(gt).trim()) parts.push(String(gt).trim().toUpperCase())
  if (brand && String(brand).trim()) parts.push(String(brand).trim().toUpperCase())
  if (thicknessMm !== undefined && thicknessMm !== null && thicknessMm !== '' && !isNaN(parseFloat(thicknessMm))) {
    parts.push(String(parseFloat(thicknessMm)))
  }
  const wCm = widthMm && !isNaN(parseFloat(widthMm)) ? Math.round(parseFloat(widthMm) / 10) : null
  const hCm = heightMm && !isNaN(parseFloat(heightMm)) ? Math.round(parseFloat(heightMm) / 10) : null
  if (wCm && hCm) parts.push(`X ${wCm} X ${hCm}`)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

const NewProductFields = ({ form, products, section = 'all' }) => {
  const [manualName, setManualName] = useState(false)

  // Hooks must run unconditionally every render — never short-circuit them with ||
  const gtA = Form.useWatch('glass_type', form)
  const gtB = Form.useWatch('new_glass_type', form)
  const brA = Form.useWatch('new_brand', form)
  const brB = Form.useWatch('brand', form)
  const thA = Form.useWatch('new_thickness_mm', form)
  const thB = Form.useWatch('thickness_mm', form)
  const wA  = Form.useWatch('sheet_width_mm', form)
  const wB  = Form.useWatch('new_sheet_width_mm', form)
  const hA  = Form.useWatch('sheet_height_mm', form)
  const hB  = Form.useWatch('new_sheet_height_mm', form)
  const glassType  = gtA || gtB
  const brand      = brA || brB
  const thicknessMm = thA || thB
  const widthMm    = wA || wB
  const heightMm   = hA || hB
  const newName = Form.useWatch('new_name', form)

  useEffect(() => {
    if (!manualName) {
      const generated = buildProductName({ glassType, brand, thicknessMm, widthMm, heightMm })
      form.setFieldsValue({ new_name: generated })
    }
  }, [glassType, brand, thicknessMm, widthMm, heightMm, manualName, form])

  const similarProducts = useMemo(() => {
    if (!newName || !newName.trim()) return []
    const normTyped = newName.trim().toLowerCase().replace(/\s+/g, ' ')
    return products.filter(p => {
      const normName = (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
      return normName.includes(normTyped) || normTyped.includes(normName)
    }).slice(0, 3)
  }, [newName, products])

  const renderDetails = () => (
    <div style={{ border: '1px dashed #3b82f6', borderRadius: 8, padding: 12, marginBottom: 16, background: '#eff6ff' }}>
      <Text strong style={{ display: 'block', marginBottom: 8, color: '#1d4ed8', fontSize: 13 }}>
        ✨ New Product Master Details
      </Text>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="new_brand" label="Brand" style={{ marginBottom: 0 }}>
            <Input placeholder="e.g. SG" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="new_thickness_mm"
            label="Thickness (mm)"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 4" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="new_cost_price" label="Cost Rate (₹/sqm)" style={{ marginBottom: 0 }}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 450" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  )

  const renderName = () => (
    <div style={{ border: '1px dashed #3b82f6', borderRadius: 8, padding: 12, marginBottom: 16, background: '#eff6ff' }}>
      {similarProducts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <div>
              Similar products already exist — select one instead of creating a duplicate:
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {similarProducts.map(p => (
                  <li key={p.id}>{p.name} ({p.sheet_width_mm}×{p.sheet_height_mm}mm)</li>
                ))}
              </ul>
            </div>
          }
        />
      )}

      <Form.Item
        name="new_name"
        label={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Product Name</span>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 12, height: 'auto', marginLeft: 8 }}
              onClick={() => {
                if (manualName) {
                  setManualName(false)
                  const generated = buildProductName({ glassType, brand, thicknessMm, widthMm, heightMm })
                  form.setFieldsValue({ new_name: generated })
                } else {
                  setManualName(true)
                }
              }}
            >
              {manualName ? 'Use generated name' : 'Edit manually'}
            </Button>
          </div>
        }
        rules={[{ required: true, message: 'Please enter product name' }]}
        style={{ marginBottom: 0 }}
      >
        <Input
          readOnly={!manualName}
          style={{
            backgroundColor: manualName ? '#ffffff' : '#f5f5f5',
            color: manualName ? 'inherit' : '#595959',
            fontWeight: manualName ? 'normal' : '500'
          }}
          placeholder="e.g. CLEAR FLOAT IMP 12 X 214 X 366"
        />
      </Form.Item>
    </div>
  )

  if (section === 'details') return renderDetails()
  if (section === 'name') return renderName()

  return (
    <>
      {renderDetails()}
      {renderName()}
    </>
  )
}

const StockOverview = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [adjModalOpen, setAdjModalOpen] = useState(false)
  const [openingModalOpen, setOpeningModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [adjForm] = Form.useForm()
  const [openingForm] = Form.useForm()
  const [search, setSearch] = useState('')
  const [openingSearchText, setOpeningSearchText] = useState('')
  const [openingIsNew, setOpeningIsNew] = useState(false)
  const [adjSearchText, setAdjSearchText] = useState('')
  const [adjIsNew, setAdjIsNew] = useState(false)

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productApi.list({ page_size: 1000 }).then(r => r.data)
  })

  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements-overview'],
    queryFn: () => stockMovementApi.list({ page_size: 1000 }).then(r => r.data)
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

  const distinctGlassTypes = useMemo(() => {
    const typesSet = new Set()
    products.forEach(p => {
      if (p.glass_type && p.glass_type.trim()) {
        typesSet.add(p.glass_type.trim())
      }
    })
    const defaults = ['Clear', 'Tinted', 'Reflective', 'Mirror', 'Low-E', 'Frosted']
    defaults.forEach(d => typesSet.add(d))
    return Array.from(typesSet).map(gt => ({ value: gt, label: gt }))
  }, [products])

  const openingProductOptions = useMemo(() => {
    const opts = products.map(p => ({
      value: p.id,
      label: `${p.name}${p.sheet_width_mm && p.sheet_height_mm ? ` — ${p.sheet_width_mm}×${p.sheet_height_mm}mm` : ''}`
    }))
    if (openingSearchText && openingSearchText.trim()) {
      const trimmed = openingSearchText.trim()
      const exactMatch = products.some(p => (p.name || '').toLowerCase() === trimmed.toLowerCase())
      if (!exactMatch || products.length === 0) {
        opts.unshift({
          value: '__NEW__',
          label: `✨ Create new product: "${trimmed}"`
        })
      }
    } else if (products.length === 0) {
      opts.unshift({
        value: '__NEW__',
        label: `✨ Create new product`
      })
    }
    return opts
  }, [products, openingSearchText])

  const adjProductOptions = useMemo(() => {
    const opts = products.map(p => ({
      value: p.id,
      label: `${p.name}${p.sheet_width_mm && p.sheet_height_mm ? ` — ${p.sheet_width_mm}×${p.sheet_height_mm}mm` : ''} (Current Stock: ${p.on_hand_sqm || 0} sqm)`
    }))
    if (adjSearchText && adjSearchText.trim()) {
      const trimmed = adjSearchText.trim()
      const exactMatch = products.some(p => (p.name || '').toLowerCase() === trimmed.toLowerCase())
      if (!exactMatch || products.length === 0) {
        opts.unshift({
          value: '__NEW__',
          label: `✨ Create new product: "${trimmed}"`
        })
      }
    } else if (products.length === 0) {
      opts.unshift({
        value: '__NEW__',
        label: `✨ Create new product`
      })
    }
    return opts
  }, [products, adjSearchText])

  const warehouseOptions = useMemo(() => {
    const opts = (warehouses || []).map(w => ({
      value: w.id,
      label: w.name || w.label
    }))
    opts.unshift({
      value: '__NEW__',
      label: '+ Create new warehouse'
    })
    return opts
  }, [warehouses])

  // Mutations
  const adjustMutation = useMutation({
    mutationFn: async (values) => {
      let productId = values.product_id
      let p = products.find(item => item.id === productId)

      // Inline product creation (AI4 & AI5)
      if (values.is_new_product || productId === '__NEW__') {
        const rawGt = values.glass_type || values.new_glass_type
        const glassTypeVal = Array.isArray(rawGt) ? rawGt[0] : rawGt
        const widthVal = values.sheet_width_mm || values.new_sheet_width_mm
        const heightVal = values.sheet_height_mm || values.new_sheet_height_mm

        const created = await productApi.create({
          name: values.new_name,
          glass_type: glassTypeVal,
          brand: values.new_brand || null,
          thickness_mm: values.new_thickness_mm ? parseFloat(values.new_thickness_mm) : null,
          sheet_width_mm: widthVal ? parseFloat(widthVal) : null,
          sheet_height_mm: heightVal ? parseFloat(heightVal) : null,
          cost_price: values.new_cost_price ? parseFloat(values.new_cost_price) : 0,
          stock_uom: 'sheet',
        })
        const newProd = created?.data || created
        productId = newProd.id
        p = newProd
      }

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

      let warehouseId = values.warehouse_id
      if (warehouseId === '__NEW__' || values.new_warehouse_name) {
        if (!values.new_warehouse_name || !values.new_warehouse_name.trim()) {
          throw new Error('Warehouse name is required for creating a new warehouse')
        }
        const createdWh = await warehouseApi.create({ name: values.new_warehouse_name.trim() })
        const newWh = createdWh?.data || createdWh
        warehouseId = newWh.id
      }
      warehouseId = warehouseId || warehouses[0]?.id
      if (!warehouseId) {
        throw new Error('No valid warehouse available for the active company. Please select or create a warehouse first.')
      }

      return stockMovementApi.create({
        product_id: productId,
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
      queryClient.invalidateQueries({ queryKey: ['warehouses-dd'] })
      message.success('Stock movement posted successfully')
      setAdjModalOpen(false)
      adjForm.resetFields()
      setAdjIsNew(false)
      setAdjSearchText('')
    },
    onError: (err) => {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to post stock adjustment'
      message.error(errorMsg)
    }
  })

  const openingStockMutation = useMutation({
    mutationFn: async (values) => {
      let productId = values.product_id
      let p = products.find(item => item.id === productId)

      // Inline product creation (AI4)
      if (values.is_new_product || productId === '__NEW__') {
        const rawGt = values.glass_type || values.new_glass_type
        const glassTypeVal = Array.isArray(rawGt) ? rawGt[0] : rawGt
        const widthVal = values.sheet_width_mm || values.new_sheet_width_mm
        const heightVal = values.sheet_height_mm || values.new_sheet_height_mm

        const created = await productApi.create({
          name: values.new_name,
          glass_type: glassTypeVal,
          brand: values.new_brand || null,
          thickness_mm: values.new_thickness_mm ? parseFloat(values.new_thickness_mm) : null,
          sheet_width_mm: widthVal ? parseFloat(widthVal) : null,
          sheet_height_mm: heightVal ? parseFloat(heightVal) : null,
          cost_price: values.new_cost_price ? parseFloat(values.new_cost_price) : 0,
          stock_uom: 'sheet',
        })
        const newProd = created?.data || created
        productId = newProd.id
        p = newProd
      }

      let qtySheets = (values.quantity_sheets !== undefined && values.quantity_sheets !== null && values.quantity_sheets !== '')
        ? parseFloat(values.quantity_sheets)
        : null

      let qtySqm = (values.quantity_sqm !== undefined && values.quantity_sqm !== null && values.quantity_sqm !== '')
        ? parseFloat(values.quantity_sqm)
        : ((values.opening_qty !== undefined && values.opening_qty !== null && values.opening_qty !== '')
          ? parseFloat(values.opening_qty)
          : ((values.quantity !== undefined && values.quantity !== null && values.quantity !== '')
            ? parseFloat(values.quantity)
            : null))

      // Derive missing unit based on product sheet dimensions
      const widthM = p?.sheet_width_mm ? p.sheet_width_mm / 1000.0 : 0
      const heightM = p?.sheet_height_mm ? p.sheet_height_mm / 1000.0 : 0
      const sheetArea = widthM * heightM

      if (qtySheets !== null && !isNaN(qtySheets)) {
        if (qtySqm === null || isNaN(qtySqm)) {
          qtySqm = sheetArea > 0 ? Math.round((qtySheets * sheetArea) * 10000) / 10000 : 0
        }
      } else if (qtySqm !== null && !isNaN(qtySqm)) {
        if (qtySheets === null || isNaN(qtySheets)) {
          qtySheets = sheetArea > 0 ? Math.round((qtySqm / sheetArea) * 10000) / 10000 : 0
        }
      }

      if (qtySqm === null || isNaN(qtySqm)) qtySqm = 0
      if (qtySheets === null || isNaN(qtySheets)) qtySheets = 0

      let warehouseId = values.warehouse_id
      if (warehouseId === '__NEW__' || values.new_warehouse_name) {
        if (!values.new_warehouse_name || !values.new_warehouse_name.trim()) {
          throw new Error('Warehouse name is required for creating a new warehouse')
        }
        const createdWh = await warehouseApi.create({ name: values.new_warehouse_name.trim() })
        const newWh = createdWh?.data || createdWh
        warehouseId = newWh.id
      }
      warehouseId = warehouseId || warehouses[0]?.id
      if (!warehouseId) {
        throw new Error('No valid warehouse available for the active company. Please select or create a warehouse first.')
      }

      return stockMovementApi.create({
        product_id: productId,
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
      queryClient.invalidateQueries({ queryKey: ['warehouses-dd'] })
      message.success('Opening stock balance set successfully')
      setOpeningModalOpen(false)
      openingForm.resetFields()
      setOpeningIsNew(false)
      setOpeningSearchText('')
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
      title: 'Company Warehouse', key: 'warehouse', width: 160,
      render: (_, r) => {
        // When a warehouse filter is active, show that warehouse.
        // Otherwise list every warehouse holding stock of this product.
        if (selectedWarehouseFilter) {
          const w = warehouses.find(x => x.id === selectedWarehouseFilter)
          return w ? <Tag color="geekblue">{w.name || w.label}</Tag> : '—'
        }
        const ids = [...new Set(
          (movements || [])
            .filter(m => m.product_id === r.id && m.warehouse_id)
            .map(m => m.warehouse_id)
        )]
        if (!ids.length) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        return (
          <Space size={2} wrap>
            {ids.map(id => {
              const w = warehouses.find(x => x.id === id)
              return <Tag key={id} color="geekblue" style={{ fontSize: 10, marginInlineEnd: 2 }}>{w?.name || w?.label || `#${id}`}</Tag>
            })}
          </Space>
        )
      }
    },
    {
      title: 'Sheet Size', key: 'dims', width: 130,
      render: (_, r) => r.sheet_width_mm && r.sheet_height_mm
        ? <Text style={{ fontSize: 12 }}>{r.sheet_width_mm} × {r.sheet_height_mm} mm</Text>
        : <Text type="secondary">—</Text>
    },
    {
      title: 'QTY', key: 'qty_sheets', width: 110, align: 'right',
      render: (_, r) => {
        const status = getStockStatus(r)
        const { sheets } = getProductStock(r)
        const col = status.color === 'green' ? '#16a34a' : status.color === 'orange' ? '#ea580c' : '#dc2626'
        return (
          <div>
            <Text strong style={{ color: col, fontSize: 15 }}>
              {sheets.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
            <div><Text type="secondary" style={{ fontSize: 10 }}>sheets</Text></div>
          </div>
        )
      }
    },
    {
      title: 'Balance', key: 'balance_sqm', width: 130, align: 'right',
      render: (_, r) => {
        const { sqm } = getProductStock(r)
        return (
          <div>
            <Text strong style={{ color: '#1e293b', fontSize: 14 }}>
              {sqm.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </Text>
            <div><Text type="secondary" style={{ fontSize: 10 }}>sqm</Text></div>
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
              const gt = r.glass_type ? (Array.isArray(r.glass_type) ? r.glass_type : [r.glass_type]) : []
              adjForm.resetFields()
              adjForm.setFieldsValue({
                product_id: r.id,
                is_new_product: false,
                glass_type: gt,
                sheet_width_mm: r.sheet_width_mm,
                sheet_height_mm: r.sheet_height_mm,
                quantity_sheets: undefined,
                qty_change: undefined,
                warehouse_id: warehouses[0]?.id
              })
              setAdjIsNew(false)
              setAdjSearchText('')
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
              onClick={() => { openingForm.resetFields(); setOpeningIsNew(false); setOpeningSearchText(''); setOpeningModalOpen(true) }}
            >
              Set Opening Balance
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => { adjForm.resetFields(); setAdjIsNew(false); setAdjSearchText(''); setAdjModalOpen(true) }}
            >
              Add Stock
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

      {/* Add Stock Modal */}
      <Modal
        title="📦 Add Stock"
        open={adjModalOpen}
        onCancel={() => setAdjModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={adjForm}
          layout="vertical"
          initialValues={{ warehouse_id: warehouses[0]?.id, is_new_product: false }}
          onFinish={v => adjustMutation.mutate(v)}
          onValuesChange={(changedValues, allValues) => {
            const { product_id, sheet_width_mm, sheet_height_mm } = allValues
            const p = products.find(x => x.id === product_id || String(x.id) === String(product_id))
            const w = sheet_width_mm || p?.sheet_width_mm || 0
            const h = sheet_height_mm || p?.sheet_height_mm || 0
            const area = (w / 1000.0) * (h / 1000.0)

            if ('quantity_sheets' in changedValues) {
              const s = changedValues.quantity_sheets
              if (s !== undefined && s !== null && s !== '' && !isNaN(s) && area > 0) {
                adjForm.setFieldsValue({ qty_change: Math.round(s * area * 10000) / 10000 })
              } else if (s === undefined || s === null || s === '') {
                adjForm.setFieldsValue({ qty_change: undefined })
              }
            } else if ('qty_change' in changedValues) {
              const q = changedValues.qty_change
              if (q !== undefined && q !== null && q !== '' && !isNaN(q) && area > 0) {
                adjForm.setFieldsValue({ quantity_sheets: Math.round((q / area) * 10000) / 10000 })
              } else if (q === undefined || q === null || q === '') {
                adjForm.setFieldsValue({ quantity_sheets: undefined })
              }
            }
          }}
        >
          <Form.Item name="is_new_product" hidden initialValue={false}>
            <Input type="hidden" />
          </Form.Item>

          {/* 1. Product */}
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select
              showSearch
              placeholder="Select or search product"
              options={adjProductOptions}
              onSearch={val => setAdjSearchText(val)}
              onChange={(val) => {
                if (val === '__NEW__') {
                  setAdjIsNew(true)
                  adjForm.setFieldsValue({
                    product_id: '__NEW__',
                    is_new_product: true,
                    new_name: adjSearchText.trim(),
                    glass_type: undefined,
                    sheet_width_mm: undefined,
                    sheet_height_mm: undefined,
                  })
                } else {
                  setAdjIsNew(false)
                  const p = products.find(x => x.id === val || String(x.id) === String(val))
                  const gt = p?.glass_type ? (Array.isArray(p.glass_type) ? p.glass_type : [p.glass_type]) : undefined
                  adjForm.setFieldsValue({
                    is_new_product: false,
                    glass_type: gt,
                    sheet_width_mm: p?.sheet_width_mm ?? undefined,
                    sheet_height_mm: p?.sheet_height_mm ?? undefined,
                  })
                  const sheets = adjForm.getFieldValue('quantity_sheets')
                  const qtyChange = adjForm.getFieldValue('qty_change')
                  if (p?.sheet_width_mm && p?.sheet_height_mm) {
                    const area = (p.sheet_width_mm / 1000.0) * (p.sheet_height_mm / 1000.0)
                    if (sheets !== undefined && sheets !== null && sheets !== '' && !isNaN(sheets) && area > 0) {
                      adjForm.setFieldsValue({ qty_change: Math.round(sheets * area * 10000) / 10000 })
                    } else if (qtyChange !== undefined && qtyChange !== null && qtyChange !== '' && !isNaN(qtyChange) && area > 0) {
                      adjForm.setFieldsValue({ quantity_sheets: Math.round((qtyChange / area) * 10000) / 10000 })
                    }
                  }
                }
              }}
              filterOption={(input, option) => {
                if (option?.value === '__NEW__') return true
                return (option?.label || '').toLowerCase().includes(input.toLowerCase())
              }}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {() => {
              const pid = adjForm.getFieldValue('product_id')
              const isNew = pid === '__NEW__' || adjForm.getFieldValue('is_new_product') === true || adjIsNew
              const p = products.find(x => x.id === pid || String(x.id) === String(pid))
              const isExisting = !isNew && !!p

              return (
                <>
                  {/* 1. Glass Type */}
                  <Form.Item
                    name="glass_type"
                    label="Glass Type"
                    rules={isNew ? [{ required: true, message: 'Please select or enter glass type' }] : []}
                    extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      disabled={!isNew}
                      placeholder="Select or type glass type"
                      options={distinctGlassTypes}
                    />
                  </Form.Item>

                  {/* 2. Brand, Thickness, Cost Rate (for new product) */}
                  {isNew && <NewProductFields form={adjForm} products={products} section="details" />}

                  {/* 3. Sheet Size */}
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="sheet_width_mm"
                        label="Width (mm)"
                        rules={isNew ? [{ required: true, message: 'Width required' }] : []}
                        extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                      >
                        <InputNumber disabled={!isNew} style={{ width: '100%' }} placeholder="e.g. 2440" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="sheet_height_mm"
                        label="Height (mm)"
                        rules={isNew ? [{ required: true, message: 'Height required' }] : []}
                        extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                      >
                        <InputNumber disabled={!isNew} style={{ width: '100%' }} placeholder="e.g. 3660" />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* 4. Generated Product Name & Duplicate Warning (for new product) */}
                  {isNew && <NewProductFields form={adjForm} products={products} section="name" />}

                  {/* 5. Company Warehouse */}
                  <Form.Item name="warehouse_id" label="Company Warehouse" rules={[{ required: true, message: 'Please select a warehouse' }]}>
                    <Select
                      placeholder="Select warehouse"
                      options={warehouseOptions}
                    />
                  </Form.Item>

                  <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.warehouse_id !== currentValues.warehouse_id} noStyle>
                    {({ getFieldValue }) => {
                      const isNewWh = getFieldValue('warehouse_id') === '__NEW__'
                      if (!isNewWh) return null
                      return (
                        <Form.Item
                          name="new_warehouse_name"
                          label="New Warehouse Name"
                          rules={[{ required: true, message: 'Please enter warehouse name' }]}
                        >
                          <Input placeholder="e.g. Storage Yard B" />
                        </Form.Item>
                      )
                    }}
                  </Form.Item>

                  {/* 6. QTY (sheets) & Balance (sqm) */}
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="quantity_sheets"
                        label="QTY (sheets)"
                        rules={[{ required: true, message: 'Please enter sheet count' }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="e.g. 10" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="qty_change"
                        label="Balance (sqm)"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="e.g. 89.304" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
            }}
          </Form.Item>

          {/* 6. Reason / Remarks */}
          <Form.Item name="remarks" label="Reason / Remarks">
            <Input.TextArea rows={2} placeholder="e.g., Physical count, damaged goods, etc." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setAdjModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={adjustMutation.isPending}>Save</Button>
          </div>
        </Form>
      </Modal>

      {/* Set Opening Balance Modal */}
      <Modal
        title="📋 Set Opening Stock Balance"
        open={openingModalOpen}
        onCancel={() => setOpeningModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={openingForm}
          layout="vertical"
          initialValues={{ warehouse_id: warehouses[0]?.id, is_new_product: false, remarks: 'Physical stock audit count' }}
          onFinish={v => openingStockMutation.mutate(v)}
          onValuesChange={(changedValues, allValues) => {
            const { product_id, sheet_width_mm, sheet_height_mm } = allValues
            const p = products.find(x => x.id === product_id || String(x.id) === String(product_id))
            const w = sheet_width_mm || p?.sheet_width_mm || 0
            const h = sheet_height_mm || p?.sheet_height_mm || 0
            const area = (w / 1000.0) * (h / 1000.0)

            if ('quantity_sheets' in changedValues) {
              const s = changedValues.quantity_sheets
              if (s !== undefined && s !== null && s !== '' && !isNaN(s) && area > 0) {
                const calculatedSqm = Math.round(s * area * 10000) / 10000
                openingForm.setFieldsValue({ quantity_sqm: calculatedSqm, qty_change: calculatedSqm })
              } else if (s === undefined || s === null || s === '') {
                openingForm.setFieldsValue({ quantity_sqm: undefined, qty_change: undefined })
              }
            } else if ('quantity_sqm' in changedValues || 'qty_change' in changedValues) {
              const q = changedValues.quantity_sqm ?? changedValues.qty_change
              if (q !== undefined && q !== null && q !== '' && !isNaN(q) && area > 0) {
                openingForm.setFieldsValue({ quantity_sheets: Math.round((q / area) * 10000) / 10000 })
              } else if (q === undefined || q === null || q === '') {
                openingForm.setFieldsValue({ quantity_sheets: undefined })
              }
            }
          }}
        >
          <Form.Item name="is_new_product" hidden initialValue={false}>
            <Input type="hidden" />
          </Form.Item>
          <Alert
            message="This creates an adjustment baseline movement and sets the initial stock for the selected product."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* 1. Product */}
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select
              showSearch
              placeholder="Select or search product"
              options={openingProductOptions}
              onSearch={val => setOpeningSearchText(val)}
              onChange={(val) => {
                if (val === '__NEW__') {
                  setOpeningIsNew(true)
                  openingForm.setFieldsValue({
                    product_id: '__NEW__',
                    is_new_product: true,
                    new_name: openingSearchText.trim(),
                    glass_type: undefined,
                    sheet_width_mm: undefined,
                    sheet_height_mm: undefined,
                  })
                } else {
                  setOpeningIsNew(false)
                  const p = products.find(x => x.id === val || String(x.id) === String(val))
                  const gt = p?.glass_type ? (Array.isArray(p.glass_type) ? p.glass_type : [p.glass_type]) : undefined
                  openingForm.setFieldsValue({
                    is_new_product: false,
                    glass_type: gt,
                    sheet_width_mm: p?.sheet_width_mm ?? undefined,
                    sheet_height_mm: p?.sheet_height_mm ?? undefined,
                  })
                  const sheets = openingForm.getFieldValue('quantity_sheets')
                  const qtySqm = openingForm.getFieldValue('quantity_sqm') ?? openingForm.getFieldValue('qty_change')
                  if (p?.sheet_width_mm && p?.sheet_height_mm) {
                    const area = (p.sheet_width_mm / 1000.0) * (p.sheet_height_mm / 1000.0)
                    if (sheets !== undefined && sheets !== null && sheets !== '' && !isNaN(sheets) && area > 0) {
                      const calculatedSqm = Math.round(sheets * area * 10000) / 10000
                      openingForm.setFieldsValue({ quantity_sqm: calculatedSqm, qty_change: calculatedSqm })
                    } else if (qtySqm !== undefined && qtySqm !== null && qtySqm !== '' && !isNaN(qtySqm) && area > 0) {
                      openingForm.setFieldsValue({ quantity_sheets: Math.round((qtySqm / area) * 10000) / 10000 })
                    }
                  }
                }
              }}
              filterOption={(input, option) => {
                if (option?.value === '__NEW__') return true
                return (option?.label || '').toLowerCase().includes(input.toLowerCase())
              }}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {() => {
              const pid = openingForm.getFieldValue('product_id')
              const isNew = pid === '__NEW__' || openingForm.getFieldValue('is_new_product') === true || openingIsNew
              const p = products.find(x => x.id === pid || String(x.id) === String(pid))
              const isExisting = !isNew && !!p

              return (
                <>
                  {/* 1. Glass Type */}
                  <Form.Item
                    name="glass_type"
                    label="Glass Type"
                    rules={isNew ? [{ required: true, message: 'Please select or enter glass type' }] : []}
                    extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      disabled={!isNew}
                      placeholder="Select or type glass type"
                      options={distinctGlassTypes}
                    />
                  </Form.Item>

                  {/* 2. Brand, Thickness, Cost Rate (for new product) */}
                  {isNew && <NewProductFields form={openingForm} products={products} section="details" />}

                  {/* 3. Sheet Size */}
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="sheet_width_mm"
                        label="Width (mm)"
                        rules={isNew ? [{ required: true, message: 'Width required' }] : []}
                        extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                      >
                        <InputNumber disabled={!isNew} style={{ width: '100%' }} placeholder="e.g. 2440" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="sheet_height_mm"
                        label="Height (mm)"
                        rules={isNew ? [{ required: true, message: 'Height required' }] : []}
                        extra={isExisting ? <Text type="secondary" style={{ fontSize: 11 }}>From product master</Text> : null}
                      >
                        <InputNumber disabled={!isNew} style={{ width: '100%' }} placeholder="e.g. 3660" />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* 4. Generated Product Name & Duplicate Warning (for new product) */}
                  {isNew && <NewProductFields form={openingForm} products={products} section="name" />}

                  {/* 5. Company Warehouse */}
                  <Form.Item name="warehouse_id" label="Company Warehouse" rules={[{ required: true, message: 'Please select a warehouse' }]}>
                    <Select
                      placeholder="Select warehouse"
                      options={warehouseOptions}
                    />
                  </Form.Item>

                  <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.warehouse_id !== currentValues.warehouse_id} noStyle>
                    {({ getFieldValue }) => {
                      const isNewWh = getFieldValue('warehouse_id') === '__NEW__'
                      if (!isNewWh) return null
                      return (
                        <Form.Item
                          name="new_warehouse_name"
                          label="New Warehouse Name"
                          rules={[{ required: true, message: 'Please enter warehouse name' }]}
                        >
                          <Input placeholder="e.g. Storage Yard B" />
                        </Form.Item>
                      )
                    }}
                  </Form.Item>

                  {/* 6. QTY (sheets) & Balance (sqm) */}
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="quantity_sheets"
                        label="QTY (sheets)"
                        rules={[{ required: true, message: 'Please enter sheet count' }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="e.g. 10" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="quantity_sqm"
                        label="Balance (sqm)"
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="e.g. 89.304" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
            }}
          </Form.Item>

          {/* 6. Reason / Remarks */}
          <Form.Item name="remarks" label="Reason / Remarks">
            <Input.TextArea rows={2} placeholder="Physical stock audit count" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setOpeningModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={openingStockMutation.isPending}>Save</Button>
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
