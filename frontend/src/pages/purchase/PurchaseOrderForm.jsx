import React, { useEffect, useMemo, useState } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  DatePicker,
  Button,
  Table,
  Steps,
  Space,
  Tag,
  App,
  Typography,
  Collapse
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  DownloadOutlined,
  ShoppingCartOutlined,
  BuildOutlined
} from '@ant-design/icons'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { purchaseOrderApi, vendorApi, productApi, stockMovementApi, salesOrderApi } from '../../api'
import { generatePOPDF } from '../../utils/pdfGenerator'
import CompanySelector from '../../components/common/CompanySelector'
import FractionInput from '../quotations/components/FractionInput'

const { Text } = Typography

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'received']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, received: 3, cancelled: 0 }

const createEmptyGlassSize = () => ({
  key: Date.now() + Math.random(),
  width_inch: 0,
  height_inch: 0,
  sqft: 0,
  quantity: 1,
  unit_price: 0,
  remarks: '',
  subtotal: 0,
})

const createEmptyGlassGroup = (description = '', product_id = null) => ({
  key: Date.now() + Math.random(),
  description,
  product_id,
  sizes: [createEmptyGlassSize()],
})

const groupFlatGlassLines = (lines) => {
  if (!lines || lines.length === 0) return [createEmptyGlassGroup()]

  const groupsMap = new Map()
  lines.forEach((l, idx) => {
    const descKey = (l.description || '').trim()
    if (!groupsMap.has(descKey)) {
      groupsMap.set(descKey, {
        key: Date.now() + idx + Math.random(),
        description: l.description || '',
        product_id: l.product_id || null,
        sizes: []
      })
    }
    const group = groupsMap.get(descKey)
    if (!group.product_id && l.product_id) {
      group.product_id = l.product_id
    }
    const qty = l.quantity || 1
    const sqft = l.sqft ?? 0
    const price = l.unit_price || 0
    const baseQty = sqft > 0 ? sqft : qty
    const sub = l.subtotal || parseFloat((baseQty * price).toFixed(2))
    group.sizes.push({
      key: l.id || l.key || (Date.now() + idx + Math.random()),
      width_inch: l.width_inch ?? (l.width_mm ? parseFloat((l.width_mm / 25.4).toFixed(4)) : 0),
      height_inch: l.height_inch ?? (l.height_mm ? parseFloat((l.height_mm / 25.4).toFixed(4)) : 0),
      sqft: sqft,
      quantity: qty,
      unit_price: price,
      remarks: l.remarks || '',
      subtotal: sub,
    })
  })

  return Array.from(groupsMap.values())
}

const PurchaseOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [glassGroups, setGlassGroups] = useState([createEmptyGlassGroup()])
  const [hardwareItems, setHardwareItems] = useState([])
  const [laborItems, setLaborItems] = useState([])
  const [wastageItems, setWastageItems] = useState([])

  const { data: record, isLoading } = useQuery({
    queryKey: ['purchase_orders', id],
    queryFn: () => purchaseOrderApi.get(id).then(r => r.data),
    enabled: isEdit,
  })
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-dd'], queryFn: () => vendorApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })

  const location = useLocation()
  const [searchParams] = useSearchParams()

  const vendorList = Array.isArray(vendors) ? vendors : (vendors?.items || [])
  const productList = Array.isArray(products) ? products : (products?.items || [])

  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('po_date', dayjs())

      // 1. From WO state
      if (location.state?.from_wo) {
        const stateLines = location.state.lines || []
        const flatGlassLines = stateLines.map((line, idx) => ({
          key: Date.now() + idx + Math.random(),
          description: line.description || '',
          product_id: null,
          width_inch: line.act_w_in ?? 0,
          height_inch: line.act_h_in ?? 0,
          sqft: line.sqft || 0,
          quantity: line.qty || 1,
          unit_price: 0,
          subtotal: 0,
          remarks: '',
          item_type: 'glass',
        }))
        setGlassGroups(groupFlatGlassLines(flatGlassLines))
        if (location.state.vendor_name) {
          const matchedVendor = vendorList.find(v => v.name.toLowerCase() === location.state.vendor_name.toLowerCase())
          if (matchedVendor) {
            form.setFieldValue('vendor_id', matchedVendor.id)
          }
        }
        form.setFieldValue('vendor_reference', `WO #${location.state.from_wo}`)
      }

      // 2. From SO query param
      const soIdParam = searchParams.get('so_id')
      if (soIdParam) {
        const loadPoFromSo = async () => {
          try {
            const so = (await salesOrderApi.get(parseInt(soIdParam))).data
            form.setFieldValue('vendor_reference', so.so_number)

            let groups = []
            if (so.groups?.length) {
              groups = so.groups.map((group, gi) => ({
                key: Date.now() + gi + Math.random(),
                description: group.description || '',
                product_id: group.product_id || null,
                sizes: (group.sizes || []).map((size, si) => {
                  const qty = size.quantity || 1
                  // COST side — a PO is what we pay the vendor, never the selling rate
                  const sqft = size.cost_charged_sqft ?? size.charged_sqft ?? size.total_sqft ?? 0
                  const glassCost = size.glass_cost ?? 0
                  const price = (glassCost > 0 && sqft > 0)
                    ? parseFloat((glassCost / sqft).toFixed(2))
                    : (group.manual_cost_price ?? 0)
                  const baseQty = sqft > 0 ? sqft : qty
                  const subtotal = glassCost > 0
                    ? glassCost
                    : parseFloat((baseQty * price).toFixed(2))
                  return {
                    key: Date.now() + gi + si + Math.random(),
                    // ACTUAL dimensions, not the charged/ceiling ones
                    width_inch: size.width_inch ?? 0,
                    height_inch: size.height_inch ?? 0,
                    sqft,
                    quantity: qty,
                    unit_price: price,
                    remarks: '',
                    subtotal,
                  }
                })
              }))
            } else if (so.lines?.length) {
              const flatGlassLines = so.lines.map((line, idx) => ({
                key: Date.now() + idx + Math.random(),
                description: line.description || '',
                product_id: line.product_id || null,
                width_inch: line.width_inch ?? (line.width_mm ? parseFloat((line.width_mm / 25.4).toFixed(4)) : 0),
                height_inch: line.height_inch ?? (line.height_mm ? parseFloat((line.height_mm / 25.4).toFixed(4)) : 0),
                sqft: line.cost_charged_sqft ?? line.charged_sqft ?? line.total_sqft ?? 0,
                quantity: line.quantity || 1,
                unit_price: (() => {
                  const cs = line.cost_charged_sqft ?? line.charged_sqft ?? line.total_sqft ?? 0
                  const gc = line.glass_cost ?? 0
                  return (gc > 0 && cs > 0) ? parseFloat((gc / cs).toFixed(2)) : 0
                })(),
                subtotal: line.glass_cost ?? 0,
                remarks: '',
                item_type: 'glass',
              }))
              groups = groupFlatGlassLines(flatGlassLines)
            }

            if (groups.length === 0) {
              groups = [createEmptyGlassGroup()]
            }
            setGlassGroups(groups)

            const buildOtherItems = (items, itemType) => {
              if (!Array.isArray(items)) return []
              return items
                .filter(item => Boolean(item.description || item.qty || item.quantity || item.cost_rate || item.rate || item.unit_price))
                .map((item, idx) => {
                  const qty = item.qty || item.quantity || 1
                  const price = item.cost_rate ?? item.rate ?? item.unit_price ?? 0
                  const sub = item.cost_amount ?? item.amount ?? item.subtotal ?? parseFloat((qty * price).toFixed(2))
                  return {
                    key: Date.now() + idx + Math.random(),
                    description: item.description || '',
                    quantity: qty,
                    unit_price: price,
                    subtotal: sub,
                    remarks: item.remarks || '',
                    item_type: itemType,
                  }
                })
            }

            setHardwareItems(buildOtherItems(so.hardware_items, 'hardware'))
            setLaborItems(buildOtherItems(so.labor_items || so.labour_items, 'labour'))
            setWastageItems(buildOtherItems(so.wastage_items, 'wastage'))
          } catch (e) {
            message.error('Failed to load Sales Order data')
          }
        }
        loadPoFromSo()
      }
    }
  }, [location.state, searchParams, vendors])

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        po_date: record.po_date ? dayjs(record.po_date) : null,
        expected_delivery: record.expected_delivery ? dayjs(record.expected_delivery) : null,
      })
      if (record.lines?.length) {
        const rawLines = record.lines

        const hw = []
        const lb = []
        const wst = []
        const glass = []

        rawLines.forEach((line, idx) => {
          const formattedLine = {
            key: line.id || line.key || (Date.now() + idx + Math.random()),
            description: line.description || '',
            product_id: line.product_id || null,
            width_inch: line.width_mm ? parseFloat((line.width_mm / 25.4).toFixed(4)) : 0,
            height_inch: line.height_mm ? parseFloat((line.height_mm / 25.4).toFixed(4)) : 0,
            sqft: line.sqft || 0,
            quantity: line.quantity || 1,
            unit_price: line.unit_price || 0,
            subtotal: line.subtotal || 0,
            remarks: line.remarks || '',
            item_type: line.item_type || 'glass',
          }

          if (line.item_type === 'hardware') {
            hw.push(formattedLine)
          } else if (line.item_type === 'labour' || line.item_type === 'labor') {
            lb.push(formattedLine)
          } else if (line.item_type === 'wastage') {
            wst.push(formattedLine)
          } else {
            glass.push(formattedLine)
          }
        })

        setHardwareItems(hw)
        setLaborItems(lb)
        setWastageItems(wst)
        setGlassGroups(groupFlatGlassLines(glass))
      }
    }
  }, [record, form])

  const getFlatLines = () => {
    const glassLines = glassGroups.flatMap(g =>
      (g.sizes || []).map(s => ({
        description: g.description || '',
        product_id: g.product_id || null,
        width_mm: s.width_inch ? Math.round(s.width_inch * 25.4) : null,
        height_mm: s.height_inch ? Math.round(s.height_inch * 25.4) : null,
        width_inch: s.width_inch || 0,
        height_inch: s.height_inch || 0,
        sqft: s.sqft || 0,
        quantity: s.quantity || 1,
        unit_price: s.unit_price || 0,
        subtotal: s.subtotal || 0,
        is_toughened: false,
        tgh_sqmt: 0,
        item_type: 'glass',
        remarks: s.remarks || '',
      }))
    )

    const hwLines = hardwareItems.map(h => ({
      description: h.description || '',
      product_id: null,
      width_mm: null,
      height_mm: null,
      sqft: 0,
      quantity: h.quantity || 1,
      unit_price: h.unit_price || 0,
      subtotal: h.subtotal || 0,
      is_toughened: false,
      tgh_sqmt: 0,
      item_type: 'hardware',
      remarks: h.remarks || '',
    }))

    const lbLines = laborItems.map(l => ({
      description: l.description || '',
      product_id: null,
      width_mm: null,
      height_mm: null,
      sqft: 0,
      quantity: l.quantity || 1,
      unit_price: l.unit_price || 0,
      subtotal: l.subtotal || 0,
      is_toughened: false,
      tgh_sqmt: 0,
      item_type: 'labour',
      remarks: l.remarks || '',
    }))

    const wstLines = wastageItems.map(w => ({
      description: w.description || '',
      product_id: null,
      width_mm: null,
      height_mm: null,
      sqft: 0,
      quantity: w.quantity || 1,
      unit_price: w.unit_price || 0,
      subtotal: w.subtotal || 0,
      is_toughened: false,
      tgh_sqmt: 0,
      item_type: 'wastage',
      remarks: w.remarks || '',
    }))

    return [...glassLines, ...hwLines, ...lbLines, ...wstLines]
  }

  const totals = useMemo(() => {
    const glassSubtotal = glassGroups.reduce((acc, g) =>
      acc + (g.sizes || []).reduce((s, sz) => s + (sz.subtotal || 0), 0), 0)
    const hwSubtotal = hardwareItems.reduce((acc, h) => acc + (h.subtotal || 0), 0)
    const lbSubtotal = laborItems.reduce((acc, l) => acc + (l.subtotal || 0), 0)
    const wstSubtotal = wastageItems.reduce((acc, w) => acc + (w.subtotal || 0), 0)

    const subtotal = parseFloat((glassSubtotal + hwSubtotal + lbSubtotal + wstSubtotal).toFixed(2))

    let tax_amount = 0
    glassGroups.forEach(g => {
      const prod = productList.find(p => p.id === g.product_id)
      const taxRate = prod?.tax_rate ?? 18
      ;(g.sizes || []).forEach(sz => {
        tax_amount += (sz.subtotal || 0) * taxRate / 100
      })
    })
    hardwareItems.forEach(h => {
      tax_amount += (h.subtotal || 0) * 18 / 100
    })
    laborItems.forEach(l => {
      tax_amount += (l.subtotal || 0) * 18 / 100
    })
    wastageItems.forEach(w => {
      tax_amount += (w.subtotal || 0) * 18 / 100
    })

    tax_amount = parseFloat(tax_amount.toFixed(2))
    const total_amount = parseFloat((subtotal + tax_amount).toFixed(2))

    return {
      glassSubtotal,
      hwSubtotal,
      lbSubtotal,
      wstSubtotal,
      subtotal,
      tax_amount,
      total_amount,
    }
  }, [glassGroups, hardwareItems, laborItems, wastageItems, productList])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? purchaseOrderApi.update(id, data) : purchaseOrderApi.create(data),
    onSuccess: (res) => {
      message.success(`PO ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
      if (!isEdit && res?.data?.id) navigate(`/purchase-orders/${res.data.id}/edit`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => purchaseOrderApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase_orders', id] }),
  })

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const lines = getFlatLines()
      for (const line of lines) {
        if (line.product_id) {
          await stockMovementApi.create({
            product_id: line.product_id,
            quantity: line.quantity,
            movement_type: 'in',
            po_id: parseInt(id),
            reference: record?.po_number,
            date: new Date().toISOString()
          })
        }
      }
      await purchaseOrderApi.changeStatus(id, 'received')
    },
    onSuccess: () => {
      message.success('Stock updated for all products')
      queryClient.invalidateQueries({ queryKey: ['purchase_orders', id] })
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.po_date) values.po_date = values.po_date.format('YYYY-MM-DD')
      if (values.expected_delivery) values.expected_delivery = values.expected_delivery.format('YYYY-MM-DD')
      values.lines = getFlatLines()
      Object.assign(values, totals)
      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setGlassGroups([createEmptyGlassGroup()])
        setHardwareItems([])
        setLaborItems([])
        setWastageItems([])
        navigate('/purchase-orders/new')
      }
    } catch (err) {}
  }

  // State handlers for Glass Groups
  const addGlassGroup = () => {
    setGlassGroups(prev => [...prev, createEmptyGlassGroup()])
  }

  const removeGlassGroup = (groupKey) => {
    setGlassGroups(prev => {
      const remaining = prev.filter(g => g.key !== groupKey)
      return remaining.length > 0 ? remaining : [createEmptyGlassGroup()]
    })
  }

  const updateGlassGroup = (groupKey, field, value) => {
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== groupKey) return g
      const updatedGroup = { ...g, [field]: value }
      if (field === 'product_id') {
        const prod = productList.find(p => p.id === value)
        if (prod) {
          updatedGroup.description = prod.name
          if (prod.cost_price != null) {
            updatedGroup.sizes = updatedGroup.sizes.map(s => {
              const unit_price = prod.cost_price || s.unit_price || 0
              const subtotal = parseFloat(((s.quantity || 1) * unit_price).toFixed(2))
              return { ...s, unit_price, subtotal }
            })
          }
        }
      }
      return updatedGroup
    }))
  }

  const addGlassSize = (groupKey) => {
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== groupKey) return g
      return { ...g, sizes: [...g.sizes, createEmptyGlassSize()] }
    }))
  }

  const removeGlassSize = (groupKey, sizeKey) => {
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== groupKey) return g
      const remaining = g.sizes.filter(s => s.key !== sizeKey)
      return { ...g, sizes: remaining.length > 0 ? remaining : [createEmptyGlassSize()] }
    }))
  }

  const updateGlassSize = (groupKey, sizeKey, field, value) => {
    setGlassGroups(prev => prev.map(g => {
      if (g.key !== groupKey) return g
      return {
        ...g,
        sizes: g.sizes.map(s => {
          if (s.key !== sizeKey) return s
          const updated = { ...s, [field]: value }
          if (field === 'quantity' || field === 'unit_price') {
            const qty = field === 'quantity' ? (value || 1) : (updated.quantity || 1)
            const price = field === 'unit_price' ? (value || 0) : (updated.unit_price || 0)
            updated.subtotal = parseFloat((qty * price).toFixed(2))
          }
          return updated
        })
      }
    }))
  }

  // State handlers for Hardware
  const addHardwareItem = () => {
    setHardwareItems(prev => [...prev, {
      key: Date.now() + Math.random(),
      description: '',
      quantity: 1,
      unit_price: 0,
      remarks: '',
      subtotal: 0,
    }])
  }

  const removeHardwareItem = (key) => {
    setHardwareItems(prev => prev.filter(h => h.key !== key))
  }

  const updateHardwareItem = (key, field, value) => {
    setHardwareItems(prev => prev.map(h => {
      if (h.key !== key) return h
      const updated = { ...h, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (value || 1) : (updated.quantity || 1)
        const price = field === 'unit_price' ? (value || 0) : (updated.unit_price || 0)
        updated.subtotal = parseFloat((qty * price).toFixed(2))
      }
      return updated
    }))
  }

  // State handlers for Labour
  const addLaborItem = () => {
    setLaborItems(prev => [...prev, {
      key: Date.now() + Math.random(),
      description: '',
      quantity: 1,
      unit_price: 0,
      remarks: '',
      subtotal: 0,
    }])
  }

  const removeLaborItem = (key) => {
    setLaborItems(prev => prev.filter(l => l.key !== key))
  }

  const updateLaborItem = (key, field, value) => {
    setLaborItems(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (value || 1) : (updated.quantity || 1)
        const price = field === 'unit_price' ? (value || 0) : (updated.unit_price || 0)
        updated.subtotal = parseFloat((qty * price).toFixed(2))
      }
      return updated
    }))
  }

  // State handlers for Wastage
  const addWastageItem = () => {
    setWastageItems(prev => [...prev, {
      key: Date.now() + Math.random(),
      description: '',
      quantity: 1,
      unit_price: 0,
      remarks: '',
      subtotal: 0,
    }])
  }

  const removeWastageItem = (key) => {
    setWastageItems(prev => prev.filter(w => w.key !== key))
  }

  const updateWastageItem = (key, field, value) => {
    setWastageItems(prev => prev.map(w => {
      if (w.key !== key) return w
      const updated = { ...w, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (value || 1) : (updated.quantity || 1)
        const price = field === 'unit_price' ? (value || 0) : (updated.unit_price || 0)
        updated.subtotal = parseFloat((qty * price).toFixed(2))
      }
      return updated
    }))
  }

  const status = record?.status || 'draft'

  const fmtCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  // Columns for Glass Group Size Table
  const sizeColumns = (group) => [
    {
      title: '#',
      width: 45,
      align: 'center',
      render: (_, __, i) => (
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
          {String.fromCharCode(97 + i)}
        </Text>
      )
    },
    {
      title: 'W (in)',
      width: 100,
      dataIndex: 'width_inch',
      render: (v, row) => (
        <FractionInput
          value={v}
          placeholder="W (in)"
          onChange={val => updateGlassSize(group.key, row.key, 'width_inch', val)}
        />
      )
    },
    {
      title: 'H (in)',
      width: 100,
      dataIndex: 'height_inch',
      render: (v, row) => (
        <FractionInput
          value={v}
          placeholder="H (in)"
          onChange={val => updateGlassSize(group.key, row.key, 'height_inch', val)}
        />
      )
    },
    {
      title: 'Sqft',
      width: 100,
      dataIndex: 'sqft',
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'sqft', val)}
        />
      )
    },
    {
      title: 'Qty',
      width: 90,
      dataIndex: 'quantity',
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={1}
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'quantity', val)}
        />
      )
    },
    {
      title: 'Unit Cost',
      width: 120,
      dataIndex: 'unit_price',
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'unit_price', val)}
        />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 180,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Remarks"
          style={{ borderRadius: 6 }}
          onChange={e => updateGlassSize(group.key, row.key, 'remarks', e.target.value)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'subtotal',
      width: 130,
      align: 'right',
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateGlassSize(group.key, row.key, 'subtotal', val)}
        />
      )
    },
    {
      title: '',
      width: 50,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeGlassSize(group.key, row.key)}
        />
      )
    }
  ]

  // Columns for Hardware Table
  const hardwareColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      width: 320,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Enter hardware description"
          style={{ borderRadius: 6 }}
          onChange={e => updateHardwareItem(row.key, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={1}
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateHardwareItem(row.key, 'quantity', val)}
        />
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_price',
      width: 130,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateHardwareItem(row.key, 'unit_price', val)}
        />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 180,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Remarks"
          style={{ borderRadius: 6 }}
          onChange={e => updateHardwareItem(row.key, 'remarks', e.target.value)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'subtotal',
      width: 130,
      align: 'right',
      render: v => (
        <Text strong style={{ color: '#ea580c' }}>
          {fmtCurrency(v)}
        </Text>
      )
    },
    {
      title: '',
      width: 50,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeHardwareItem(row.key)}
        />
      )
    }
  ]

  // Columns for Labour Table
  const laborColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      width: 320,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Enter labour description"
          style={{ borderRadius: 6 }}
          onChange={e => updateLaborItem(row.key, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={1}
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateLaborItem(row.key, 'quantity', val)}
        />
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_price',
      width: 130,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateLaborItem(row.key, 'unit_price', val)}
        />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 180,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Remarks"
          style={{ borderRadius: 6 }}
          onChange={e => updateLaborItem(row.key, 'remarks', e.target.value)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'subtotal',
      width: 130,
      align: 'right',
      render: v => (
        <Text strong style={{ color: '#6d28d9' }}>
          {fmtCurrency(v)}
        </Text>
      )
    },
    {
      title: '',
      width: 50,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLaborItem(row.key)}
        />
      )
    }
  ]

  // Columns for Wastage Table
  const wastageColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      width: 320,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Enter wastage description"
          style={{ borderRadius: 6 }}
          onChange={e => updateWastageItem(row.key, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      width: 90,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={1}
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateWastageItem(row.key, 'quantity', val)}
        />
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_price',
      width: 130,
      render: (v, row) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 6 }}
          onChange={val => updateWastageItem(row.key, 'unit_price', val)}
        />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 180,
      render: (v, row) => (
        <Input
          size="small"
          value={v}
          placeholder="Remarks"
          style={{ borderRadius: 6 }}
          onChange={e => updateWastageItem(row.key, 'remarks', e.target.value)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'subtotal',
      width: 130,
      align: 'right',
      render: v => (
        <Text strong style={{ color: '#e11d48' }}>
          {fmtCurrency(v)}
        </Text>
      )
    },
    {
      title: '',
      width: 50,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeWastageItem(row.key)}
        />
      )
    }
  ]

  return (
    <MasterForm
      title="Purchase Order"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Purchase' }, { label: 'Purchase Orders', path: '/purchase-orders' }, { label: isEdit ? record?.po_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/purchase-orders')}
    >
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {isEdit && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => {
                  const recordData = form.getFieldsValue()
                  recordData.lines = getFlatLines()
                  recordData.po_number = record?.po_number
                  recordData.subtotal = totals.subtotal
                  recordData.tax_amount = totals.tax_amount
                  recordData.total_amount = totals.total_amount
                  generatePOPDF(recordData)
                }}
              >
                PDF
              </Button>
            )}
            {status === 'draft' && <Button type="primary" icon={<SendOutlined />} onClick={() => statusMutation.mutate('sent')} style={{ background: '#3b82f6' }}>Send to Vendor</Button>}
            {status === 'sent' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => statusMutation.mutate('confirmed')} style={{ background: '#f59e0b' }}>Confirm Receipt</Button>}
            {status === 'confirmed' && <Button type="primary" icon={<InboxOutlined />} onClick={() => receiveMutation.mutate()} style={{ background: '#10b981' }}>Mark Received</Button>}
            {status === 'received' && <Tag color="green">✅ RECEIVED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <Row gutter={24}>
          {/* Main Left Column */}
          <Col xs={24} lg={17}>
            {/* Header Details Card */}
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 20,
              padding: 24
            }}>
              <CompanySelector form={form} />
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="vendor_id" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Vendor</span>} rules={[{ required: true }]}>
                    <Select
                      showSearch
                      placeholder="Select Vendor"
                      options={vendors.map(v => ({ value: v.id, label: v.name }))}
                      filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      style={{ borderRadius: 6 }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="po_date" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Order Date</span>}>
                    <DatePicker style={{ width: '100%', borderRadius: 6 }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="expected_delivery" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Expected Delivery</span>}>
                    <DatePicker style={{ width: '100%', borderRadius: 6 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="vendor_reference" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Vendor Ref / SO #</span>}>
                    <Input placeholder="Reference / SO #" style={{ borderRadius: 6 }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* Glass Line Items Section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                Glass Line Items
              </div>

              {glassGroups.map((group, gi) => {
                const groupTotalSqft = (group.sizes || []).reduce((s, sz) => s + (sz.sqft || 0), 0)
                const groupTotalQty = (group.sizes || []).reduce((s, sz) => s + (sz.quantity || 0), 0)
                const groupTotalAmt = (group.sizes || []).reduce((s, sz) => s + (sz.subtotal || 0), 0)

                return (
                  <Collapse
                    key={group.key}
                    defaultActiveKey={['1']}
                    style={{
                      marginBottom: 16,
                      borderRadius: 14,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      background: '#fff'
                    }}
                  >
                    <Collapse.Panel
                      key="1"
                      style={{ border: 'none' }}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexWrap: 'wrap', paddingRight: 8 }} onClick={e => e.stopPropagation()}>
                          <span style={{
                            background: '#EEF2FF',
                            color: '#4338CA',
                            fontWeight: 700,
                            fontSize: 12,
                            padding: '3px 9px',
                            borderRadius: 6,
                            minWidth: 28,
                            textAlign: 'center'
                          }}>
                            {gi + 1}
                          </span>

                          <Input
                            size="small"
                            placeholder="Glass Spec / Description"
                            value={group.description}
                            style={{ width: 240, fontWeight: 600, borderRadius: 6 }}
                            onChange={e => updateGlassGroup(group.key, 'description', e.target.value)}
                          />

                          <Select
                            size="small"
                            placeholder="Select Product Master"
                            value={group.product_id || undefined}
                            style={{ width: 200, borderRadius: 6 }}
                            showSearch
                            allowClear
                            options={products.map(p => ({ value: p.id, label: p.name }))}
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            onChange={val => updateGlassGroup(group.key, 'product_id', val)}
                          />

                          <Tag color="blue" style={{ margin: 0, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
                            {groupTotalQty} pcs
                          </Tag>

                          <Tag color="purple" style={{ margin: 0, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
                            {groupTotalSqft.toFixed(2)} sqft
                          </Tag>

                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                              {fmtCurrency(groupTotalAmt)}
                            </span>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              style={{
                                borderRadius: 6,
                                height: 28,
                                width: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onClick={e => {
                                e.stopPropagation()
                                removeGlassGroup(group.key)
                              }}
                            />
                          </div>
                        </div>
                      }
                    >
                      <div style={{ padding: '8px 4px' }}>
                        <Table
                          dataSource={group.sizes}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          columns={sizeColumns(group)}
                          footer={() => (
                            <Button
                              type="dashed"
                              size="small"
                              icon={<PlusOutlined />}
                              style={{ borderRadius: 6 }}
                              onClick={() => addGlassSize(group.key)}
                            >
                              Add Size
                            </Button>
                          )}
                          style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: 10,
                            overflow: 'hidden'
                          }}
                        />
                      </div>
                    </Collapse.Panel>
                  </Collapse>
                )
              })}

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addGlassGroup}
                style={{ width: '100%', borderRadius: 8, height: 38 }}
              >
                Add Glass Group
              </Button>
            </div>

            {/* Hardware Items Card */}
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 20,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: '#FAFBFD'
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCartOutlined style={{ color: '#d97706' }} /> Hardware Items
                </span>
                <Tag color="warning" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #fde047' }}>
                  Total: {fmtCurrency(totals.hwSubtotal)}
                </Tag>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <Table
                  dataSource={hardwareItems}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={hardwareColumns}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    overflow: 'hidden',
                    marginBottom: 12
                  }}
                />
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 6 }}
                  onClick={addHardwareItem}
                >
                  Add Hardware Item
                </Button>
              </div>
            </div>

            {/* Labour Charges Card */}
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 20,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: '#FAFBFD'
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BuildOutlined style={{ color: '#7c3aed' }} /> Labour Charges
                </span>
                <Tag color="purple" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #d8b4fe' }}>
                  Total: {fmtCurrency(totals.lbSubtotal)}
                </Tag>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <Table
                  dataSource={laborItems}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={laborColumns}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    overflow: 'hidden',
                    marginBottom: 12
                  }}
                />
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 6 }}
                  onClick={addLaborItem}
                >
                  Add Labour Charge
                </Button>
              </div>
            </div>

            {/* Wastage Charges Card */}
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 20,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: '#FAFBFD'
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DeleteOutlined style={{ color: '#e11d48' }} /> Wastage Charges
                </span>
                <Tag color="error" style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5' }}>
                  Total: {fmtCurrency(totals.wstSubtotal)}
                </Tag>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <Table
                  dataSource={wastageItems}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={wastageColumns}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    overflow: 'hidden',
                    marginBottom: 12
                  }}
                />
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 6 }}
                  onClick={addWastageItem}
                >
                  Add Wastage Charge
                </Button>
              </div>
            </div>
          </Col>

          {/* Right Column: Sticky Summary */}
          <Col xs={24} lg={7}>
            <div style={{ position: 'sticky', top: 24 }}>
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.03), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #F1F5F9',
                  background: '#FAFBFD'
                }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', letterSpacing: -0.1 }}>
                    Summary
                  </span>
                </div>

                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <Text type="secondary">Glass Items</Text>
                      <Text style={{ fontWeight: 600, color: '#0f172a' }}>{fmtCurrency(totals.glassSubtotal)}</Text>
                    </div>

                    {totals.hwSubtotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <Text type="secondary">Hardware Items</Text>
                        <Text style={{ fontWeight: 600, color: '#ea580c' }}>{fmtCurrency(totals.hwSubtotal)}</Text>
                      </div>
                    )}

                    {totals.lbSubtotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <Text type="secondary">Labor Charges</Text>
                        <Text style={{ fontWeight: 600, color: '#7c3aed' }}>{fmtCurrency(totals.lbSubtotal)}</Text>
                      </div>
                    )}

                    {totals.wstSubtotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <Text type="secondary">Wastage Charges</Text>
                        <Text style={{ fontWeight: 600, color: '#e11d48' }}>{fmtCurrency(totals.wstSubtotal)}</Text>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                      <Text style={{ color: '#0f172a' }}>Subtotal</Text>
                      <Text style={{ color: '#0f172a' }}>{fmtCurrency(totals.subtotal)}</Text>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <Text type="secondary">GST Tax (18%)</Text>
                      <Text style={{ fontWeight: 500, color: '#334155' }}>{fmtCurrency(totals.tax_amount)}</Text>
                    </div>
                  </div>

                  <div style={{
                    background: '#2563eb',
                    borderRadius: 12,
                    padding: '14px 20px',
                    marginTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
                  }}>
                    <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Grand Total</Text>
                    <Text style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>{fmtCurrency(totals.total_amount)}</Text>
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Form>
    </MasterForm>
  )
}

export default PurchaseOrderForm
