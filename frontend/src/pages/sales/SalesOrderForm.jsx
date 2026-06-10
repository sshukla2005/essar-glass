import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, Badge, App, Radio, Tooltip, Card, Modal, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, FileTextOutlined, CarOutlined, DollarOutlined, ToolOutlined, GiftOutlined, DownloadOutlined, AimOutlined, LineChartOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { salesOrderApi, customerApi, productApi, quotationApi, purchaseOrderApi, deliveryChallanApi, invoiceApi, warehouseApi, workshopOrderApi, processMasterApi } from '../../api'
import { generateSOPDF } from '../../utils/pdfGenerator'
import CompanySelector from '../../components/common/CompanySelector'

const getUomRates = (uom) => {
  try {
    const master = JSON.parse(
      localStorage.getItem('uom_rate_master') || '[]'
    )
    const found = master.find(
      r => r.uom?.toUpperCase() === (uom || '').toUpperCase()
    )
    return {
      cost_rate: found?.cost_rate || 0,
      selling_rate: found?.selling_rate || 0,
    }
  } catch {
    return { cost_rate: 0, selling_rate: 0 }
  }
}

const { TextArea } = Input
const { Text } = Typography

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
]

const STATUS_STEPS = ['draft', 'confirmed', 'in_production', 'ready', 'delivered']
const STATUS_IDX = { draft: 0, confirmed: 1, in_production: 2, ready: 3, delivered: 4, cancelled: 0 }

const getDropdownConfig = () => {
  try {
    const cfg = JSON.parse(
      localStorage.getItem('glass_dropdown_config') || '{}'
    )
    return {
      thicknesses: cfg.thicknesses?.length ? cfg.thicknesses : [3.5, 4, 5, 6, 8, 10, 12],
      glass_types: cfg.glass_types?.length ? cfg.glass_types : ['Annealed', 'Toughened', 'Laminated', 'DGU'],
      categories: cfg.categories?.length ? cfg.categories : ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'],
    }
  } catch {
    return {
      thicknesses: [3.5, 4, 5, 6, 8, 10, 12],
      glass_types: ['Annealed', 'Toughened', 'Laminated', 'DGU'],
      categories: ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'],
    }
  }
}

const CEILING_OPTIONS = [
  { value: 3, label: '3" (Tight)' },
  { value: 6, label: '6" (Standard)' },
  { value: 'plus30mm', label: '+30mm' },
]

const buildDescription = (group) => {
  const parts = []
  if (group.glass_category) parts.push(group.glass_category)
  if (group.glass_type) parts.push(group.glass_type)
  if (group.glass_thickness) parts.push(`${group.glass_thickness}mm`)
  return parts.join(' ') || ''
}

const calcRateFromMatrix = (category, thickness) => {
  if (!category || !thickness) return 0
  try {
    const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
    const baseRate = matrix?.base_rates?.[category]
    if (!baseRate) return 0
    return parseFloat((parseFloat(thickness) * baseRate / 10.764).toFixed(2))
  } catch { return 0 }
}

const emptySize = () => ({
  size_key: Date.now() + Math.random(),
  width_inch: null,
  height_inch: null,
  quantity: 1,
  area_sqft_pc: 0, total_sqft: 0, running_ft: 0,
  charged_sqft: 0, charged_w_inch: 0, charged_h_inch: 0,
  cep_rft: 0, cep_charges: 0, tgh_sqmt: 0,
  tgh_charge: 0,
  subtotal: 0, tax_amount: 0, line_total: 0,
  size_processes: [],
})

const emptyGroupProcess = () => ({
  proc_key: Date.now() + Math.random(),
  process_id: null,
  charge_type: 'per_sqft',
  qty_area: 0,
  rate: 0,
  amount: 0,
})

const emptyGroup = () => ({
  group_key: Date.now() + Math.random(),
  glass_thickness: null,
  glass_type: null,
  glass_category: null,
  ceiling_inches: 6,
  ceiling_w_inches: 6,
  ceiling_h_inches: 6,
  is_toughened: false,
  base_glass_rate: 0,
  manual_cost_price: null,
  product_id: null,
  description: '',
  rate: 0,
  rate_rft: 0,
  cep: false,
  pricing_method: 'per_sqft',
  discount_pct: 0,
  tax_rate: 18,
  custom_costing: false,
  manual_rate: null,
  cep_rft_multiplier: null,
  sizes: [emptySize()],
  processes: []
})


// ── Convert decimal inches to fraction display string ──────────
const toFraction = (decimal) => {
  if (decimal === null || decimal === undefined || decimal === '') return ''
  const num = parseFloat(decimal)
  if (isNaN(num)) return ''

  const whole = Math.floor(num)
  const remainder = num - whole

  if (remainder === 0) return `${whole}`

  const sixteenths = Math.round(remainder * 16)

  if (sixteenths === 0) return `${whole}`
  if (sixteenths === 16) return `${whole + 1}`

  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
  const g = gcd(sixteenths, 16)
  const num_simplified = sixteenths / g
  const den_simplified = 16 / g

  if (whole === 0) return `${num_simplified}/${den_simplified}`
  return `${whole} ${num_simplified}/${den_simplified}`
}

// ── Convert fraction string back to decimal ────────────────────
const fromFraction = (str) => {
  if (str === null || str === undefined || str === '') return null
  const s = String(str).trim()

  if (!s.includes('/') && !isNaN(parseFloat(s))) {
    return parseFloat(s)
  }

  const parts = s.split(' ')
  if (parts.length === 2) {
    const whole = parseFloat(parts[0])
    const fracParts = parts[1].split('/')
    if (fracParts.length === 2) {
      const numerator = parseFloat(fracParts[0])
      const denominator = parseFloat(fracParts[1])
      if (!isNaN(whole) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return parseFloat((whole + numerator / denominator).toFixed(6))
      }
    }
  }

  if (parts.length === 1 && s.includes('/')) {
    const fracParts = s.split('/')
    if (fracParts.length === 2) {
      const numerator = parseFloat(fracParts[0])
      const denominator = parseFloat(fracParts[1])
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return parseFloat((numerator / denominator).toFixed(6))
      }
    }
  }

  return null
}

const isValidFractionInput = (str) => {
  if (!str) return true
  return /^[\d\s./]*$/.test(str)
}

const FractionInput = ({ value, onChange, placeholder, style, size }) => {
  const [inputVal, setInputVal] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) {
      setInputVal(value !== null && value !== undefined ? toFraction(value) : '')
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    setInputVal(value !== null && value !== undefined ? String(value) : '')
  }

  const handleBlur = () => {
    setIsFocused(false)
    const decimal = fromFraction(inputVal)
    if (decimal !== null) {
      onChange && onChange(decimal)
      setInputVal(toFraction(decimal))
    } else if (inputVal === '' || inputVal === null) {
      onChange && onChange(null)
      setInputVal('')
    } else {
      setInputVal(value !== null && value !== undefined ? toFraction(value) : '')
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    if (isValidFractionInput(val)) {
      setInputVal(val)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  return (
    <Input
      size={size || 'small'}
      value={inputVal}
      placeholder={isFocused ? '84.25 or 84 1/4' : (placeholder || 'e.g. 84 1/4')}
      style={{ width: '100%', fontFamily: 'monospace', ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  )
}



const SalesOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [soUnit, setSoUnit] = useState('inch')
  const [groups, setGroups] = useState([emptyGroup()])
  const [dropdownConfig] = useState(getDropdownConfig())
  const [customSearchVal, setCustomSearchVal] = useState({})
  const [hardwareItems, setHardwareItems] = useState([])
  const [laborItems, setLaborItems] = useState([])
  const [wastageItems, setWastageItems] = useState([])
  const [gstMode, setGstMode] = useState('cgst_sgst')
  const [compWizard, setCompWizard] = useState(null)
  const [wizardCostPrice, setWizardCostPrice] = useState(null)

  const emptyHardware = () => ({
    hw_key: Date.now() + Math.random(),
    description: '',
    qty: 1,
    uom: '',
    cost_rate: 0,
    rate: 0,       // selling rate
    cost_amount: 0,
    amount: 0,     // selling amount
  })

  const emptyLabor = () => ({
    lb_key: Date.now() + Math.random(),
    description: '',
    qty: 1,
    uom: '',
    cost_rate: 0,
    rate: 0,
    cost_amount: 0,
    amount: 0,
  })

  const emptyWastage = () => ({
    wst_key: Date.now() + Math.random(),
    description: '',
    qty: 1,
    cost_rate: 0,
    rate: 0,
    cost_amount: 0,
    amount: 0,
  })

  const { data: record, isLoading } = useQuery({
    queryKey: ['sales_orders', id], queryFn: () => salesOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customersData } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: productsData } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: processMastersData } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })
  const { data: quotationsData } = useQuery({ queryKey: ['quotations-dd'], queryFn: () => quotationApi.dropdown().then(r => r.data) })
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })

  const { data: posData } = useQuery({ queryKey: ['pos-so', id], queryFn: () => purchaseOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: dcsData } = useQuery({ queryKey: ['dcs-so', id], queryFn: () => deliveryChallanApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: invData } = useQuery({ queryKey: ['inv-so', id], queryFn: () => invoiceApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: woData } = useQuery({ queryKey: ['wo-so', id], queryFn: () => workshopOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })

  const customers = Array.isArray(customersData) ? customersData : (customersData?.items || [])
  const products = Array.isArray(productsData) ? productsData : (productsData?.items || [])
  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])
  const quotations = Array.isArray(quotationsData) ? quotationsData : (quotationsData?.items || [])
  const warehouses = Array.isArray(warehousesData) ? warehousesData : (warehousesData?.items || [])
  const reconstructGroups = (flatLines) => {
    const groupMap = new Map()
    flatLines.forEach((line, i) => {
      const gkey = line.product_id || line.description || `solo_${i}`
      if (!groupMap.has(gkey)) {
        groupMap.set(gkey, {
          group_key: Date.now() + Math.random() + i,
          glass_thickness: line.glass_thickness || null,
          glass_type: line.glass_type || null,
          glass_category: line.glass_category || null,
          ceiling_inches: line.ceiling_inches || 6,
          ceiling_w_inches: line.ceiling_w_inches || line.ceiling_inches || 6,
          ceiling_h_inches: line.ceiling_h_inches || line.ceiling_inches || 6,
          is_toughened: line.is_toughened || false,
          base_glass_rate: line.base_glass_rate || 0,
          manual_cost_price: line.manual_cost_price || null,
          product_id: line.product_id,
          description: line.description || '',
          rate: line.rate || line.unit_price || 0,
          rate_rft: line.rate_rft || 0,
          cep: line.cep || false,
          pricing_method: line.pricing_method || 'per_sqft',
          discount_pct: line.discount_pct || 0,
          tax_rate: line.tax_rate || 18,
          custom_costing: line.custom_costing || false,
          manual_rate: line.manual_rate || null,
          cep_rft_multiplier: line.cep_rft_multiplier || null,
          artwork_file: line.artwork_file || null,
          artwork_name: line.artwork_name || null,
          sizes: [],
          processes: (line.processes || []).map(p => ({
            ...p,
            proc_key: Date.now() + Math.random() + i,
          }))
        })
      }
      groupMap.get(gkey).sizes.push({
        size_key: Date.now() + Math.random() + i,
        width_inch: line.width_inch || (line.width_mm ? line.width_mm / 25.4 : null),
        height_inch: line.height_inch || (line.height_mm ? line.height_mm / 25.4 : null),
        quantity: line.quantity || 1,
        area_sqft_pc: line.area_sqft_pc || 0,
        total_sqft: line.total_sqft || 0,
        running_ft: line.running_ft || 0,
        charged_sqft: line.charged_sqft || 0,
        charged_w_inch: line.charged_w_inch || 0,
        charged_h_inch: line.charged_h_inch || 0,
        cep_rft: line.cep_rft || 0,
        cep_charges: line.cep_charges || 0,
        tgh_sqmt: line.tgh_sqmt || 0,
        tgh_charge: line.tgh_charge || 0,
        _tgh_charge_manual: line.tgh_charge > 0,
        subtotal: line.subtotal || 0,
        tax_amount: line.tax_amount || 0,
        line_total: line.line_total || 0,
        size_processes: (line.size_processes || []).map(p => ({
          ...p,
          sproc_key: Date.now() + Math.random() + i,
        })),
      })
    })
    return Array.from(groupMap.values())
  }

  const getPolishingRate = () => {
    try {
      const polish = processMasters.find(p =>
        p.process_type === 'polishing' &&
        (p.name?.toLowerCase().includes('4') || p.name?.toLowerCase().includes('four'))
      ) || processMasters.find(p => p.process_type === 'polishing')
      return polish?.rate || 15
    } catch { return 15 }
  }

  const calcGroupSize = (group, size) => {
    const w_inch = size.width_inch || 0
    const h_inch = size.height_inch || 0
    const qty = size.quantity || 1

    // Separate ceiling for W and H
    const ceilW = group.ceiling_w_inches ?? group.ceiling_inches ?? 6
    const ceilH = group.ceiling_h_inches ?? group.ceiling_inches ?? 6

    const ceilFnW = (x) => {
      if (ceilW === 'plus30mm') return x + (30 / 25.4)
      return Math.ceil(x / ceilW) * ceilW
    }
    const ceilFnH = (x) => {
      if (ceilH === 'plus30mm') return x + (30 / 25.4)
      return Math.ceil(x / ceilH) * ceilH
    }
    const ceilFn = ceilFnW
    const ceilN = typeof ceilW === 'number' ? ceilW : 6
    const ceil3 = (x) => Math.ceil(x / 3) * 3
    const area_sqft_pc = (ceilFnW(w_inch) * ceilFnH(h_inch)) / 144
    const total_sqft = area_sqft_pc * qty
    const running_ft = (w_inch + h_inch) * 2 * qty / 12
    const charged_w_inch = parseFloat(ceilFnW(w_inch).toFixed(4))
    const charged_h_inch = parseFloat(ceilFnH(h_inch).toFixed(4))
    const charged_sqft = (charged_w_inch * charged_h_inch * qty) / 144
    const getCepMultiplier = () => {
      if (group.cep_rft_multiplier) return group.cep_rft_multiplier
      try {
        const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
        return matrix?.cep_rft_default || 5
      } catch { return 5 }
    }
    const cepMult = getCepMultiplier()
    const cep_rft = parseFloat(((w_inch + h_inch) * 2 / 12 * qty * cepMult).toFixed(4))
    const tgh_sqmt = ((size.width_inch || 0) * 25.4 + 30) * ((size.height_inch || 0) * 25.4 + 30) * qty / 1000000

    const polishRate = getPolishingRate()
    const cep_charges = group.cep ? parseFloat((running_ft * polishRate).toFixed(2)) : 0

    let effective_qty = 0
    if (group.pricing_method === 'per_sqft')
      effective_qty = group.cep ? charged_sqft : total_sqft
    else if (group.pricing_method === 'per_rft') effective_qty = running_ft
    else effective_qty = qty

    const sqft_amt = effective_qty * (group.rate || 0)
    const rft_amt = running_ft * (group.rate_rft || 0)
    let subtotal = (sqft_amt + rft_amt) * (1 - (group.discount_pct || 0) / 100)
    subtotal = parseFloat((subtotal + cep_charges).toFixed(2))

    // Toughening — compute per-sqft addon (NOT added to subtotal here)
    // It will be incorporated into group.rate directly
    let tgh_charge = 0
    let tgh_rate_addon = 0

    if (group.glass_type === 'Toughened' || group.is_toughened) {
      try {
        const pm = JSON.parse(
          localStorage.getItem('process_masters') || '[]'
        )
        const toughProc = pm.find(p =>
          p.process_type === 'toughening' &&
          p.is_active !== false
        )
        if (toughProc && toughProc.rate > 0) {
          tgh_charge = parseFloat((tgh_sqmt * toughProc.rate).toFixed(2))
          const base_sqft = effective_qty || total_sqft || 0.001
          tgh_rate_addon = base_sqft > 0
            ? parseFloat((tgh_charge / base_sqft).toFixed(4))
            : 0
          // DO NOT add to subtotal — tgh is included in group.rate already
        }
      } catch { }
    }
    const tax_amt = parseFloat((subtotal * (group.tax_rate || 18) / 100).toFixed(2))
    const line_total = parseFloat((subtotal + tax_amt).toFixed(2))

    return {
      ...size,
      area_sqft_pc: parseFloat(area_sqft_pc.toFixed(4)),
      total_sqft: parseFloat(total_sqft.toFixed(4)),
      running_ft: parseFloat(running_ft.toFixed(4)),
      charged_sqft: parseFloat(charged_sqft.toFixed(4)),
      charged_w_inch,
      charged_h_inch,
      cep_rft: parseFloat(cep_rft.toFixed(4)),
      cep_charges,
      tgh_sqmt: parseFloat(tgh_sqmt.toFixed(6)),
      tgh_charge: parseFloat(tgh_charge.toFixed(2)),
      tgh_rate_addon: parseFloat(tgh_rate_addon.toFixed(4)),
      effective_qty: parseFloat(effective_qty.toFixed(4)),
      subtotal, tax_amount: tax_amt, line_total
    }
  }

  const autoSuggestProcesses = (group) => {
    // No auto-suggest — client adds processes manually
    // Only hole, cutout, big hole, big cutout, farma allowed
    return []
  }

  const updateGroup = (gkey, field, value) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      const updated = { ...g, [field]: value }

      if (['glass_thickness', 'glass_type', 'glass_category'].includes(field)) {
        updated.description = buildDescription(updated)
        if (field === 'glass_type') {
          updated.is_toughened = (value === 'Toughened')
        }
        if (!g.custom_costing) {
          const cat = updated.glass_category
          const thick = updated.glass_thickness
          if (cat && thick) {
            const baseRate = calcRateFromMatrix(cat, thick)
            updated.base_glass_rate = baseRate
            updated.rate = baseRate
          }
        }
        // First pass — calculate sizes to get tgh_rate_addon
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
        // If toughened — add avg tgh_rate_addon to rate
        if (updated.is_toughened || updated.glass_type === 'Toughened') {
          const avgAddon = updated.sizes.length > 0
            ? updated.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / updated.sizes.length
            : 0
          if (avgAddon > 0) {
            updated.rate = parseFloat(((updated.base_glass_rate || updated.rate) + avgAddon).toFixed(2))
            // Recalculate sizes with new effective rate
            updated.sizes = updated.sizes.map(s => calcGroupSize(updated, s))
          }
        }
        if (!g.processes?.length) {
          updated.processes = autoSuggestProcesses(updated)
        }
      }

      if (field === 'ceiling_inches') {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      if (field === 'ceiling_w_inches' || field === 'ceiling_h_inches') {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      if (field === 'cep') {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      if (['rate', 'rate_rft', 'pricing_method', 'discount_pct', 'tax_rate'].includes(field)) {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          if (!g.custom_costing) {
            try {
              const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
              const baseRate = matrix?.base_rates?.[prod.glass_category]
              if (baseRate && prod.thickness_mm) {
                updated.rate = parseFloat((parseFloat(prod.thickness_mm) * baseRate / 10.764).toFixed(2))
              } else {
                updated.rate = prod.sale_price || 0
              }
            } catch {
              updated.rate = prod.sale_price || 0
            }
          } else {
            updated.rate = prod.sale_price || 0
          }
          updated.description = prod.name
          updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
          if (!g.processes?.length) {
            updated.processes = autoSuggestProcesses(updated)
          }
        }
      }

      if (field === 'custom_costing') {
        if (value === false) {
          const cat = g.glass_category
          const thick = g.glass_thickness
          if (cat && thick) {
            updated.rate = calcRateFromMatrix(cat, thick)
          } else {
            const prod = products.find(p => p.id === g.product_id)
            if (prod) {
              try {
                const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
                const baseRate = matrix?.base_rates?.[prod.glass_category]
                if (baseRate && prod.thickness_mm) {
                  updated.rate = parseFloat((parseFloat(prod.thickness_mm) * baseRate / 10.764).toFixed(2))
                }
              } catch { }
            }
          }
          updated.manual_rate = null
          updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
        }
      }

      if (field === 'cep_rft_multiplier') {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      return updated
    }))
  }

  const updateSize = (gkey, skey, field, value) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      const updatedSizes = g.sizes.map(s => {
        if (s.size_key !== skey) return s
        const updated = { ...s, [field]: value }
        return calcGroupSize(g, updated)
      })
      let updatedGroup = { ...g, sizes: updatedSizes }

      // Recalculate effective rate for toughened groups when sizes change
      if (updatedGroup.is_toughened || updatedGroup.glass_type === 'Toughened') {
        const avgAddon = updatedSizes.length > 0
          ? updatedSizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / updatedSizes.length
          : 0
        const baseRate = updatedGroup.base_glass_rate || 0
        if (avgAddon > 0 && baseRate > 0) {
          updatedGroup.rate = parseFloat((baseRate + avgAddon).toFixed(2))
          updatedGroup.sizes = updatedSizes.map(s => calcGroupSize(updatedGroup, s))
        }
      }

      const totalSqft = updatedSizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
      const totalRft = updatedSizes.reduce((s, sz) => s + (sz.running_ft || 0), 0)
      const totalSqmt = updatedSizes.reduce((s, sz) => s + (sz.tgh_sqmt || 0), 0)
      const totalPcs = updatedSizes.reduce((s, sz) => s + (sz.quantity || 0), 0)

      updatedGroup.processes = (g.processes || []).map(p => {
        let qty = p.qty_area
        if (p.charge_type === 'per_sqft') qty = parseFloat(totalSqft.toFixed(3))
        if (p.charge_type === 'per_rft') qty = parseFloat(totalRft.toFixed(3))
        if (p.charge_type === 'per_sqmt') qty = parseFloat(totalSqmt.toFixed(4))
        if (p.charge_type === 'per_piece') qty = totalPcs
        return {
          ...p,
          qty_area: qty,
          amount: parseFloat((qty * (p.rate || 0)).toFixed(2))
        }
      })

      return updatedGroup
    }))
  }

  const addSize = (gkey) => {
    setGroups(prev => prev.map(g =>
      g.group_key === gkey ? { ...g, sizes: [...g.sizes, emptySize()] } : g
    ))
  }

  const removeSize = (gkey, skey) => {
    setGroups(prev => prev.map(g =>
      g.group_key === gkey ? { ...g, sizes: g.sizes.filter(s => s.size_key !== skey) } : g
    ))
  }

  const addGroup = () => setGroups(prev => [...prev, emptyGroup()])

  const removeGroup = (gkey) => {
    setGroups(prev => prev.filter(g => g.group_key !== gkey))
  }

  const addGroupProcess = (gkey) => {
    setGroups(prev => prev.map(g =>
      g.group_key !== gkey ? g : {
        ...g,
        processes: [...(g.processes || []), emptyGroupProcess()]
      }
    ))
  }

  const removeGroupProcess = (gkey, pkey) => {
    setGroups(prev => prev.map(g =>
      g.group_key !== gkey ? g : {
        ...g,
        processes: (g.processes || []).filter(p => p.proc_key !== pkey)
      }
    ))
  }

  const emptySizeProcess = () => ({
    sproc_key: Date.now() + Math.random(),
    process_id: null,
    charge_type: 'per_piece',
    qty_area: 0,
    rate: 0,
    amount: 0,
  })

  const addSizeProcess = (gkey, skey) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      return {
        ...g,
        sizes: g.sizes.map(s => {
          if (s.size_key !== skey) return s
          return {
            ...s,
            size_processes: [
              ...(s.size_processes || []),
              emptySizeProcess()
            ]
          }
        })
      }
    }))
  }

  const removeSizeProcess = (gkey, skey, spkey) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      return {
        ...g,
        sizes: g.sizes.map(s => {
          if (s.size_key !== skey) return s
          return {
            ...s,
            size_processes: (s.size_processes || [])
              .filter(p => p.sproc_key !== spkey)
          }
        })
      }
    }))
  }

  const updateSizeProcess = (gkey, skey, spkey, field, value) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      return {
        ...g,
        sizes: g.sizes.map(s => {
          if (s.size_key !== skey) return s
          return {
            ...s,
            size_processes: (s.size_processes || []).map(p => {
              if (p.sproc_key !== spkey) return p
              const updated = { ...p, [field]: value }
              if (field === 'process_id') {
                const pm = processMasters
                  .filter(x =>
                    ['hole', 'cutout', 'forma', 'farma'].includes(x.process_type)
                  )
                  .find(x => x.id === value)
                if (pm) {
                  updated.charge_type = pm.charge_type
                  updated.rate = pm.rate
                  updated.qty_area = 0
                  updated.amount = 0
                }
              }
              if (field === 'qty_area' || field === 'rate') {
                updated.amount = parseFloat(
                  ((updated.qty_area || 0) * (updated.rate || 0)).toFixed(2)
                )
              }
              return updated
            })
          }
        })
      }
    }))
  }

  const updateGroupProcess = (gkey, pkey, field, value) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      return {
        ...g,
        processes: (g.processes || []).map(p => {
          if (p.proc_key !== pkey) return p
          const updated = { ...p, [field]: value }

          if (field === 'process_id') {
            const pm = processMasters.find(x => x.id === value)
            if (pm) {
              updated.charge_type = pm.charge_type
              updated.rate = pm.rate

              const allSizes = g.sizes || []
              const totalSqft = allSizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
              const totalRft = allSizes.reduce((s, sz) => s + (sz.running_ft || 0), 0)
              const totalSqmt = allSizes.reduce((s, sz) => s + (sz.tgh_sqmt || 0), 0)
              const totalPcs = allSizes.reduce((s, sz) => s + (sz.quantity || 0), 0)

              if (pm.charge_type === 'per_sqft') updated.qty_area = parseFloat(totalSqft.toFixed(3))
              if (pm.charge_type === 'per_rft') updated.qty_area = parseFloat(totalRft.toFixed(3))
              if (pm.charge_type === 'per_sqmt') updated.qty_area = parseFloat(totalSqmt.toFixed(4))
              if (pm.charge_type === 'per_piece') updated.qty_area = totalPcs
              if (pm.charge_type === 'fixed') updated.qty_area = 1

              updated.amount = parseFloat(((updated.qty_area || 0) * pm.rate).toFixed(2))
            }
          }

          if (field === 'qty_area' || field === 'rate') {
            updated.amount = parseFloat(
              ((updated.qty_area || 0) * (updated.rate || 0)).toFixed(2)
            )
          }

          return updated
        })
      }
    }))
  }

  const getFlatLines = () => {
    return groups.flatMap((g, gi) =>
      g.sizes.map((s, idx) => ({
        glass_thickness: g.glass_thickness,
        glass_type: g.glass_type,
        glass_category: g.glass_category,
        ceiling_inches: g.ceiling_inches,
        ceiling_w_inches: g.ceiling_w_inches ?? g.ceiling_inches ?? 6,
        ceiling_h_inches: g.ceiling_h_inches ?? g.ceiling_inches ?? 6,
        is_toughened: g.is_toughened,
        product_id: g.product_id,
        description: g.description,
        rate: g.rate,
        base_glass_rate: g.base_glass_rate || 0,
        manual_cost_price: g.manual_cost_price || null,
        rate_rft: g.rate_rft,
        cep: g.cep,
        pricing_method: g.pricing_method,
        discount_pct: g.discount_pct,
        tax_rate: g.tax_rate,
        custom_costing: g.custom_costing,
        manual_rate: g.manual_rate,
        cep_rft_multiplier: g.cep_rft_multiplier,
        processes: idx === 0 ? (g.processes || []).map(({ proc_key, ...rest }) => rest) : [],
        size_processes: (s.size_processes || []).map(({ sproc_key, ...rest }) => rest),
        width_inch: s.width_inch,
        height_inch: s.height_inch,
        quantity: s.quantity,
        area_sqft_pc: s.area_sqft_pc,
        total_sqft: s.total_sqft,
        running_ft: s.running_ft,
        charged_sqft: s.charged_sqft,
        charged_w_inch: s.charged_w_inch,
        charged_h_inch: s.charged_h_inch,
        cep_rft: s.cep_rft,
        cep_charges: s.cep_charges,
        tgh_sqmt: s.tgh_sqmt,
        tgh_charge: s.tgh_charge || 0,
        subtotal: s.subtotal,
        tax_amount: s.tax_amount,
        line_total: s.line_total,
      }))
    )
  }


  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('order_date', dayjs())
    }
  }, [])

  useEffect(() => {
    if (record) {
      const sanitize = (obj) => Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
      )
      form.setFieldsValue({
        ...sanitize(record),
        customer_id: record.customer_id,
        order_date: record.order_date ? dayjs(record.order_date) : null,
        delivery_date: record.delivery_date ? dayjs(record.delivery_date) : null,
      })

      if (record.groups?.length) {
        setGroups(record.groups.map(g => ({
          ...emptyGroup(),
          ...g,
          group_key: Date.now() + Math.random(),
          sizes: (g.sizes || []).map(s => ({
            ...emptySize(),
            ...s,
            size_key: Date.now() + Math.random(),
          })),
          processes: (g.processes || []).map(p => ({
            ...emptyGroupProcess(),
            ...p,
            proc_key: Date.now() + Math.random(),
          }))
        })))
      } else if (record.lines?.length) {
        const reconstructed = reconstructGroups(record.lines)
        // Backend valid_columns filter strips manual_cost_price from lines
        // Restore from record.groups which is saved as-is
        if (record.groups?.length) {
          reconstructed.forEach(g => {
            const saved = record.groups.find(sg => sg.description === g.description)
            if (saved?.manual_cost_price) g.manual_cost_price = saved.manual_cost_price
          })
        }
        setGroups(reconstructed)
      }

      if (record.hardware_items?.length) {
        setHardwareItems(record.hardware_items.map((h, i) => ({
          hw_key: h.hw_key || Date.now() + Math.random() + i,
          description: h.description || '',
          qty: h.qty || 1,
          uom: h.uom || '',
          cost_rate: h.cost_rate || 0,
          rate: h.rate || 0,
          cost_amount: h.cost_amount || (h.qty || 0) * (h.cost_rate || 0),
          amount: h.amount || (h.qty || 0) * (h.rate || 0),
        })))
      }
      if (record.labor_items?.length) {
        setLaborItems(record.labor_items.map((l, i) => ({
          lb_key: l.lb_key || Date.now() + Math.random() + i,
          description: l.description || '',
          qty: l.qty || 1,
          uom: l.uom || '',
          cost_rate: l.cost_rate || 0,
          rate: l.rate || 0,
          cost_amount: l.cost_amount || (l.qty || 0) * (l.cost_rate || 0),
          amount: l.amount || (l.qty || 0) * (l.rate || 0),
        })))
      }
      if (record.wastage_items?.length) {
        setWastageItems(record.wastage_items.map((w, i) => ({
          wst_key: w.wst_key || Date.now() + Math.random() + i,
          description: w.description || '',
          qty: w.qty || 1,
          cost_rate: w.cost_rate || 0,
          rate: w.rate || 0,
          cost_amount: w.cost_amount || (w.qty || 0) * (w.cost_rate || 0),
          amount: w.amount || (w.qty || 0) * (w.rate || 0),
        })))
      }
      setGstMode(record.gst_mode || (record.is_inter_state ? 'igst' : 'cgst_sgst'))
    }
  }, [record, form])

  const dcCharges = Form.useWatch('dc_charges', form) || 0
  const dcCost = Form.useWatch('dc_cost', form) || 0
  const discountAmt = Form.useWatch('discount_amount', form) || 0
  const advanceRec = Form.useWatch('advance_received', form) || 0
  const handlingCharges = Form.useWatch('handling_charges', form) || 0
  const otherCharges = Form.useWatch('other_charges', form) || 0

  const totals = useMemo(() => {
    const allSizes = groups.flatMap(g => g.sizes)
    const allGroupProcesses = groups.flatMap(g => g.processes || [])
    const allSizeProcesses = groups.flatMap(g =>
      g.sizes.flatMap(s => s.size_processes || [])
    )
    const allProcesses = [...allGroupProcesses, ...allSizeProcesses]

    const subI = allSizes.reduce((s, l) => s + (l.subtotal || 0), 0)
    const procTotal = allProcesses.reduce((s, p) => s + (p.amount || 0), 0)
    const hwTotal = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)
    const lbTotal = laborItems.reduce((s, l) => s + (l.amount || 0), 0)
    const wstTotal = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
    const hwCostTotal = hardwareItems.reduce(
      (s, h) => s + (h.cost_amount || (h.qty || 0) * (h.cost_rate || 0)), 0
    )
    const lbCostTotal = laborItems.reduce(
      (s, l) => s + (l.cost_amount || (l.qty || 0) * (l.cost_rate || 0)), 0
    )
    const wstCostTotal = wastageItems.reduce(
      (s, w) => s + (w.cost_amount || (w.qty || 0) * (w.cost_rate || 0)), 0
    )

    const subII = subI + procTotal + hwTotal + lbTotal + wstTotal + (dcCharges || 0)
    const subIII = Math.max(0, subII - (discountAmt || 0))

    let cgst = 0, sgst = 0, igst = 0
    if (gstMode === 'igst') {
      igst = subIII * 0.18
    } else if (gstMode === 'cgst_sgst') {
      cgst = subIII * 0.09
      sgst = subIII * 0.09
    }
    const grandTotal = subIII + cgst + sgst + igst
    const balance = grandTotal - (advanceRec || 0)

    let totalCost = 0
    groups.forEach(g => {
      const prod = products.find(x => x.id === g.product_id)
      if (prod?.cost_price) {
        g.sizes.forEach(s => {
          totalCost += (s.total_sqft || 0) * prod.cost_price
        })
      }
      ; (g.processes || []).forEach(p => {
        totalCost += (p.amount || 0) * 0.7
      })
    })
    const marginAmt = subIII - totalCost
    const marginPct = totalCost > 0 ? (marginAmt / totalCost) * 100 : 100

    return {
      subI, procTotal, hwTotal, lbTotal, wstTotal, dcCharges, dcCost, subII,
      discountAmt, subIII, cgst, sgst, igst,
      grandTotal, advanceRec, balance,
      totalCost, marginAmt, marginPct,
      hwCostTotal, lbCostTotal, wstCostTotal
    }
  }, [groups, hardwareItems, laborItems, wastageItems, dcCharges, dcCost, discountAmt, advanceRec, gstMode, products])

  const openComparisonWizard = (group) => {
    // Always reset to null first — ensures fresh calc every open
    setWizardCostPrice(null)
    setCompWizard(null)

  // If user previously saved a manual cost price, use it directly
  // Otherwise auto-calculate from matrix / product master
  let costPerSqft = 0

  if (group.manual_cost_price && group.manual_cost_price > 0) {
    // Use saved manual cost price
    costPerSqft = group.manual_cost_price
  } else {
    // Try product master first
    const prod = products.find(p => p.id === group.product_id)
    if (prod?.cost_price) {
      costPerSqft = prod.cost_price
    }

    // If no product or no cost_price, use rate matrix cost_rates
    if (!costPerSqft && group.glass_category && group.glass_thickness) {
      try {
        const matrix = JSON.parse(
          localStorage.getItem('glass_rate_matrix') || '{}'
        )
        const costRate = matrix?.cost_rates?.[group.glass_category]
        if (costRate && group.glass_thickness) {
          costPerSqft = parseFloat(
            (parseFloat(group.glass_thickness) * costRate / 10.764).toFixed(2)
          )
        }
      } catch { }
    }

    // If still 0, estimate as 70% of base glass rate (last resort)
    if (!costPerSqft && group.rate > 0) {
      const baseRate = group.base_glass_rate || group.rate
      costPerSqft = parseFloat((baseRate * 0.70).toFixed(2))
    }
  }

  // Only add toughening addon if user has NOT manually set cost price
  if (!group.manual_cost_price && (group.is_toughened || group.glass_type === 'Toughened')) {
    try {
      const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
      const toughProc = pm.find(p =>
        p.process_type === 'toughening' && p.is_active !== false
      )
      if (toughProc && toughProc.rate > 0) {
        // Get avg tgh_rate_addon from sizes (already calculated)
        const avgAddon = group.sizes.length > 0
          ? group.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / group.sizes.length
          : 0
        if (avgAddon > 0) {
          costPerSqft = parseFloat((costPerSqft + avgAddon).toFixed(2))
        }
      }
    } catch { }
  }

    setWizardCostPrice(costPerSqft)

    const CEP_COST_RATE = 5  // ₹5 per running foot (client confirmed)

    const rows = group.sizes.map((s, i) => {
      const w = s.width_inch || 0
      const h = s.height_inch || 0
      const qty = s.quantity || 1

      // ── SELLING SIDE ──
      const selling_sqft = s.total_sqft || 0
      const selling_amount = s.subtotal || 0

      // ── COST SIDE ──
      const ceil3 = (x) => Math.ceil(x / 3) * 3
      const charged_sqft = (ceil3(w) * ceil3(h) * qty) / 144

      // Glass cost = charged sqft × cost price
      const glass_cost = parseFloat((charged_sqft * costPerSqft).toFixed(2))

      // CEP cost = actual running ft × ₹5 (inch to inch, no ceiling)
      const actual_rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(4))
      const cep_cost = group.cep
        ? parseFloat((actual_rft * CEP_COST_RATE).toFixed(2))
        : 0

      // Total cost = glass cost + CEP cost
      const cost_amount = parseFloat((glass_cost + cep_cost).toFixed(2))
      const margin_amount = parseFloat((selling_amount - cost_amount).toFixed(2))
      const margin_pct = cost_amount > 0
        ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2))
        : 100

      return {
        key: i,
        label: String.fromCharCode(97 + i),
        width_display: soUnit === 'inch' ? `${toFraction(w)}"` : `${(w * 25.4).toFixed(1)}mm`,
        height_display: soUnit === 'inch' ? `${toFraction(h)}"` : `${(h * 25.4).toFixed(1)}mm`,
        quantity: qty,
        selling_sqft: selling_sqft.toFixed(3),
        charged_sqft: charged_sqft.toFixed(3),
        actual_rft: actual_rft.toFixed(3),
        glass_cost,
        cep_cost,
        selling_amount,
        cost_amount,
        margin_amount,
        margin_pct,
      }
    })

    // Per-product wizard: glass + process charges
    const glassSellingTotal = rows.reduce((s, r) => s + r.selling_amount, 0)
    const glassCostTotal = rows.reduce((s, r) => s + r.cost_amount, 0)
    const totalCepCost = rows.reduce((s, r) => s + r.cep_cost, 0)

    // Include group-level + size-level process charges
    const procSelling = (group.processes || []).reduce((s, p) => s + (p.amount || 0), 0)
    const sizeProcSelling = (group.sizes || [])
      .flatMap(s => s.size_processes || [])
      .reduce((s, p) => s + (p.amount || 0), 0)
    const totalProcSelling = procSelling + sizeProcSelling
    const totalProcCost = parseFloat((totalProcSelling * 0.70).toFixed(2))

    const totalSelling = parseFloat((glassSellingTotal + totalProcSelling).toFixed(2))
    const totalCost = parseFloat((glassCostTotal + totalProcCost).toFixed(2))

    const totalMargin = parseFloat((totalSelling - totalCost).toFixed(2))
    const totalMarginPct = totalCost > 0
      ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100

    setCompWizard({
      product_name: group.description || 'Product',
      cost_price: costPerSqft,
      selling_rate: group.rate,
      cep_on: group.cep,
      cep_cost_rate: CEP_COST_RATE,
      rows,
      glassSellingTotal,
      totalProcSelling,
      totalSelling, totalCost, totalCepCost, totalMargin, totalMarginPct,
      group_key: group.group_key,
    })
  }

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? salesOrderApi.update(id, data) : salesOrderApi.create(data),
    onSuccess: (res) => { message.success(`SO ${isEdit ? 'updated' : 'created'}`); queryClient.invalidateQueries({ queryKey: ['sales_orders'] }); if (!isEdit && res?.data?.id) navigate(`/sales-orders/${res.data.id}/edit`) },
  })

  const statusMutation = useMutation({
    mutationFn: async (newStatus) => {
      await salesOrderApi.changeStatus(id, newStatus)

      // When SO is confirmed → auto-win the linked CRM lead
      if (newStatus === 'confirmed' && record?.crm_lead_id) {
        try {
          const stages = JSON.parse(localStorage.getItem('crm_stages') || '[]')
          const wonStage = stages.find(s => s.is_won === true)
          if (wonStage) {
            const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]')
            const idx = leads.findIndex(l => l.id === record.crm_lead_id)
            if (idx !== -1 && !leads[idx].stage?.is_won) {
              leads[idx].stage_id = wonStage.id
              leads[idx].updated_at = new Date().toISOString()
              localStorage.setItem('crm_leads', JSON.stringify(leads))
            }
          }
        } catch (e) {
          console.warn('Could not auto-win lead:', e)
        }
      }

      return newStatus
    },
    onSuccess: (newStatus) => {
      message.success(
        newStatus === 'confirmed'
          ? '✅ Order Confirmed! CRM Lead marked as Won.'
          : `Status updated to ${newStatus}`
      )
      queryClient.invalidateQueries({ queryKey: ['sales_orders', id] })
      queryClient.invalidateQueries({ queryKey: ['sales_orders'] })
      queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
    },
  })

  // Document creation actions
  const createPOMutation = useMutation({
    mutationFn: async () => {
      const poData = { so_id: parseInt(id), vendor_reference: record?.so_number, lines: getFlatLines().map(l => ({ ...l, unit_price: 0 })) }
      const res = await purchaseOrderApi.create(poData)
      return res.data
    },
    onSuccess: (data) => { message.success('PO Created'); navigate(`/purchase-orders/${data.id}/edit`) }
  })

  const createDCMutation = useMutation({
    mutationFn: async () => {
      const dcData = { so_id: parseInt(id), customer_id: record?.customer_id, lines: getFlatLines().map(l => ({ ...l, qty_dispatched: l.quantity })) }
      const res = await deliveryChallanApi.create(dcData)
      return res.data
    },
    onSuccess: (data) => { message.success('Delivery Challan Created'); navigate(`/delivery-challans/${data.id}/edit`) }
  })

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const invData = { so_id: parseInt(id), customer_id: record?.customer_id, lines: getFlatLines(), ...totals }
      const res = await invoiceApi.create(invData)
      return res.data
    },
    onSuccess: (data) => { message.success('Invoice Created'); navigate(`/invoices/${data.id}/edit`) }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.order_date) values.order_date = values.order_date.format('YYYY-MM-DD')
      if (values.delivery_date) values.delivery_date = values.delivery_date.format('YYYY-MM-DD')

      values.lines = getFlatLines()
      values.groups = groups
      values.hardware_items = hardwareItems
      values.labor_items = laborItems
      values.wastage_items = wastageItems
      values.dc_cost = dcCost || 0
      values.totals = totals
      values.subtotal = totals.subIII
      values.tax_amount = totals.cgst + totals.sgst + totals.igst
      values.total_amount = totals.grandTotal

      // Preserve crm_lead_id from existing record or URL
      if (!values.crm_lead_id && record?.crm_lead_id) {
        values.crm_lead_id = record.crm_lead_id
      }
      const soLeadId = new URLSearchParams(window.location.search).get('lead_id')
      if (!values.crm_lead_id && soLeadId) {
        values.crm_lead_id = parseInt(soLeadId)
      }

      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); setGroups([emptyGroup()]); navigate('/sales-orders/new') }
    } catch (err) { }
  }



  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const soId = id ? parseInt(id) : null

  // Derive counts AND first linked record id from existing query data
  const poItems = Array.isArray(posData) ? posData : (posData?.items || [])
  const dcItems = Array.isArray(dcsData) ? dcsData : (dcsData?.items || [])
  const invItems = Array.isArray(invData) ? invData : (invData?.items || [])
  const woItems = Array.isArray(woData) ? woData : (woData?.items || [])

  const linkedPo = poItems.find(p => p.so_id === soId)
  const linkedDc = dcItems.find(d => d.so_id === soId)
  const linkedInv = invItems.find(i => i.so_id === soId)
  const linkedWo = woItems.find(w => w.so_id === soId)

  const poCount = poItems.filter(p => p.so_id === soId).length
  const deliveryCount = dcItems.filter(d => d.so_id === soId).length
  const invoiceCount = invItems.filter(i => i.so_id === soId).length
  const woCount = woItems.filter(w => w.so_id === soId).length


  return (
    <MasterForm title="Sales Order" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Orders', path: '/sales-orders' }, { label: isEdit ? record?.so_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => navigate('/sales-orders')}>

      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.quotation_id && (
            <Button icon={<FileTextOutlined />} onClick={() => navigate(`/quotations/${record.quotation_id}/edit`)}>Quotation</Button>
          )}
          {record?.crm_lead_id && (
            <Button
              size="small"
              icon={<AimOutlined />}
              onClick={() => navigate(`/crm/leads/${record.crm_lead_id}/edit`)}
              style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
            >
              CRM Lead
            </Button>
          )}
          <Badge count={poCount}>
            <Button
              icon={<ShoppingCartOutlined />}
              onClick={() => linkedPo?.id
                ? navigate(`/purchase-orders/${linkedPo.id}/edit`)
                : navigate(`/purchase-orders/new?so_id=${soId}`)}
            >
              Purchase Orders
            </Button>
          </Badge>
          <Badge count={deliveryCount}>
            <Button
              icon={<CarOutlined />}
              onClick={() => linkedDc?.id
                ? navigate(`/delivery-challans/${linkedDc.id}/edit`)
                : navigate(`/delivery-challans/new?so_id=${soId}`)}
            >
              Deliveries
            </Button>
          </Badge>
          <Badge count={invoiceCount}>
            <Button
              icon={<DollarOutlined />}
              onClick={() => linkedInv?.id
                ? navigate(`/invoices/${linkedInv.id}/edit`)
                : navigate(`/invoices/new?so_id=${soId}`)}
            >
              Invoices
            </Button>
          </Badge>
          {woCount > 0
            ? <Badge count={woCount}>
              <Button
                icon={<ToolOutlined />}
                onClick={() => linkedWo?.id
                  ? navigate(`/workshop/orders/${linkedWo.id}/edit`)
                  : navigate(`/workshop/orders/new?so_id=${soId}`)}
              >
                Workshop Orders
              </Button>
            </Badge>
            : ['confirmed', 'in_production'].includes(status) && (
              <Button type="primary" icon={<ToolOutlined />} style={{ background: '#ea580c', borderColor: '#ea580c' }}
                onClick={async () => {
                  const woData = {
                    so_id: parseInt(id), customer_id: record?.customer_id,
                    customer_name: customers.find(c => c.id === record?.customer_id)?.name || '',
                    so_number: record?.so_number, order_date: new Date().toISOString().split('T')[0],
                    priority: 'normal', status: 'draft',
                    lines: getFlatLines().map(l => {
                      const prod = products.find(p => p.id === l.product_id)
                      const w_mm = l.width_inch ? Math.round(l.width_inch * 25.4) : null
                      const h_mm = l.height_inch ? Math.round(l.height_inch * 25.4) : null
                      return {
                        ...l,
                        act_w_mm: w_mm,
                        act_h_mm: h_mm,
                        act_w_in: l.width_inch ? parseFloat(l.width_inch.toFixed(4)) : null,
                        act_h_in: l.height_inch ? parseFloat(l.height_inch.toFixed(4)) : null,
                        glass_type: prod?.glass_type || '',
                        processes: l.processes,
                        size_processes: l.size_processes || [],
                        has_process: (l.processes?.length > 0) || (l.size_processes?.length > 0),
                        process_label: [
                          ...(l.processes || []),
                          ...(l.size_processes || [])
                        ].map(p => p.process_name || p.name || '').filter(Boolean).join(', '),
                        cep: l.cep || false,
                        is_toughened: l.is_toughened || false,
                        line_status: 'pending',
                        holes_qty: 0,
                        remarks: ''
                      }
                    })
                  }
                  const res = await workshopOrderApi.create(woData)
                  message.success('Workshop Order created')
                  navigate(`/workshop/orders/${res.data.id}/edit`)
                }}>
                Create Workshop Order
              </Button>
            )
          }
        </div>
      )}

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.replace('_', ' ').toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={10} style={{ textAlign: 'right' }}>
          <Space wrap>
            {isEdit && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => {
                  const recordData = form.getFieldsValue()
                  recordData.lines = getFlatLines()
                  recordData.so_number = record?.so_number
                  recordData.subtotal = totals.subtotal
                  recordData.tax_amount = totals.tax_amount
                  recordData.total_amount = totals.total_amount
                  generateSOPDF(recordData)
                }}
              >
                PDF
              </Button>
            )}
            {status === 'draft' && <>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => statusMutation.mutate('confirmed')} style={{ background: '#3b82f6' }}>Confirm Order</Button>
              <Button icon={<ShoppingCartOutlined />} onClick={() => createPOMutation.mutate()} style={{ color: '#f59e0b', borderColor: '#f59e0b' }}>Create PO</Button>
            </>}
            {status === 'confirmed' && <Button type="primary" icon={<ToolOutlined />} onClick={() => statusMutation.mutate('in_production')} style={{ background: '#f59e0b' }}>Production</Button>}
            {status === 'in_production' && <Button type="primary" icon={<GiftOutlined />} onClick={() => statusMutation.mutate('ready')} style={{ background: '#a855f7' }}>Ready</Button>}
            {status === 'ready' && <>
              <Button type="primary" icon={<CarOutlined />} onClick={() => createDCMutation.mutate()} style={{ background: '#10b981' }}>Delivery</Button>
              <Button type="primary" icon={<DollarOutlined />} onClick={() => createInvoiceMutation.mutate()} style={{ background: '#3b82f6' }}>Invoice</Button>
            </>}
            {status === 'delivered' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ COMPLETED</Tag>}
            {status === 'cancelled' && <Tag color="red" style={{ padding: '6px 12px', fontSize: 14 }}>❌ CANCELLED</Tag>}
          </Space>
        </Col>
      </Row>

      {isEdit && woData?.items?.length > 0 && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, color: '#15803d' }}>
            🔧 Linked Workshop Orders:
          </span>
          {woData.items.map(wo => (
            <Button
              key={wo.id}
              size="small"
              style={{
                background: wo.status === 'completed' ? '#dcfce7' : '#fef3c7',
                borderColor: wo.status === 'completed' ? '#86efac' : '#fcd34d',
                color: wo.status === 'completed' ? '#15803d' : '#92400e',
                fontWeight: 600,
              }}
              onClick={() => navigate(`/workshop/orders/${wo.id}/edit`)}
            >
              {wo.wo_number} — {wo.status?.toUpperCase()}
            </Button>
          ))}
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#6366f1', borderColor: '#6366f1' }}
            onClick={() => navigate(`/workshop/orders/new?so_id=${id}`)}
          >
            + New WO
          </Button>
        </div>
      )}

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <CompanySelector form={form} />
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                onChange={(val) => {
                  const c = customers.find(x => x.id === val); if (c) form.setFieldsValue({ payment_terms: c.payment_terms })
                }}
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="order_date" label="Order Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="delivery_date" label="Delivery Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="warehouse_id" label="Warehouse"><Select options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Form.Item></Col>
          <Col span={4}>
            <Form.Item name="quotation_id" label="Quotation Ref">
              <Select
                options={quotations.map(q => ({ value: q.id, label: q.quote_number }))}
                allowClear
                onChange={async (val) => {
                  if (!val) return
                  try {
                    const res = await quotationApi.get(val)
                    const quotation = res.data

                    form.setFieldsValue({
                      customer_id: quotation.customer_id,
                      payment_terms: quotation.payment_terms,
                      salesperson: quotation.salesperson,
                      notes: quotation.customer_notes,
                      subtotal: quotation.subtotal,
                      tax_amount: (quotation.cgst || 0) + (quotation.sgst || 0) + (quotation.igst || 0),
                      total_amount: quotation.total_amount,
                    })

                    if (quotation.groups) {
                      const newLines = quotation.groups.flatMap(group =>
                        group.sizes.map(size => ({
                          key: Date.now() + Math.random(),
                          description: group.description || `${group.glass_thickness}mm ${group.glass_type} ${group.glass_category}`,
                          product_id: group.product_id || null,
                          width_mm: Math.round((size.width_inch || 0) * 25.4),
                          height_mm: Math.round((size.height_inch || 0) * 25.4),
                          cep: (size.cep_charges || 0) > 0 || group.cep,
                          pricing_method: group.pricing_method || 'per_sqft',
                          quantity: size.quantity || 1,
                          unit_price: group.rate || 0,
                          subtotal: size.subtotal || 0,
                        }))
                      )
                      setLines(newLines)
                    }
                  } catch (e) { }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ color: '#3b82f6' }}>Order Lines</Divider>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Radio.Group value={soUnit} onChange={e => setSoUnit(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="inch">inch</Radio.Button>
              <Radio.Button value="mm">MM</Radio.Button>
            </Radio.Group>
            <Text type="secondary" style={{ fontSize: 11 }}>(Default: Inch)</Text>
          </Space>
        </div>
        {groups.map(group => (
          <Card
            key={group.group_key}
            style={{ marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {/* ── Row 1: Glass Attribute Selectors ── */}
            <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
              <Col span={1}>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 700 }}>{groups.indexOf(group) + 1}.</Text>
              </Col>
              <Col span={3}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>THICKNESS</Text></div>
                <Select
                  size="small"
                  placeholder="mm"
                  value={group.glass_thickness}
                  style={{ width: '100%' }}
                  showSearch
                  options={[
                    ...dropdownConfig.thicknesses.map(t => ({
                      value: t, label: `${t}mm`
                    })),
                    { value: '__custom__', label: '+ Add custom...' }
                  ]}
                  onChange={val => {
                    if (val === '__custom__') return
                    updateGroup(group.group_key, 'glass_thickness', val)
                  }}
                  onSearch={searchVal => {
                  }}
                  filterOption={(input, option) => {
                    if (option.value === '__custom__') return true
                    return String(option.label).toLowerCase()
                      .includes(input.toLowerCase())
                  }}
                  onInputKeyDown={e => {
                    if (e.key === 'Enter') {
                      const num = parseFloat(e.target.value)
                      if (!num || isNaN(num)) return
                      try {
                        const cfg = JSON.parse(
                          localStorage.getItem('glass_dropdown_config') || '{}'
                        )
                        const existing = cfg.thicknesses || [3.5, 4, 5, 6, 8, 10, 12]
                        if (!existing.includes(num)) {
                          const updated = [...existing, num].sort((a, b) => a - b)
                          localStorage.setItem('glass_dropdown_config',
                            JSON.stringify({ ...cfg, thicknesses: updated })
                          )
                          message.success(`${num}mm added!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_thickness', num)
                    }
                  }}
                />
              </Col>
              <Col span={3}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>TYPE</Text></div>
                <Select
                  size="small"
                  placeholder="Type"
                  value={group.glass_type}
                  style={{ width: '100%' }}
                  showSearch
                  options={[
                    ...dropdownConfig.glass_types.map(t => ({
                      value: t, label: t
                    })),
                    { value: '__custom__', label: '+ Add custom...' }
                  ]}
                  filterOption={(input, option) => {
                    if (option.value === '__custom__') return true
                    return String(option.label).toLowerCase()
                      .includes(input.toLowerCase())
                  }}
                  onChange={val => {
                    if (val === '__custom__') return
                    updateGroup(group.group_key, 'glass_type', val)
                  }}
                  onInputKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim()
                      if (!val || val === '__custom__') return
                      try {
                        const cfg = JSON.parse(
                          localStorage.getItem('glass_dropdown_config') || '{}'
                        )
                        const existing = cfg.glass_types ||
                          ['Annealed', 'Toughened', 'Laminated', 'DGU']
                        if (!existing.includes(val)) {
                          localStorage.setItem('glass_dropdown_config',
                            JSON.stringify({
                              ...cfg, glass_types: [...existing, val]
                            })
                          )
                          message.success(`"${val}" added to types!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_type', val)
                    }
                  }}
                />
              </Col>
              <Col span={3}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>CATEGORY</Text></div>
                <Select
                  size="small"
                  placeholder="Category"
                  value={group.glass_category}
                  style={{ width: '100%' }}
                  showSearch
                  options={[
                    ...dropdownConfig.categories.map(c => ({
                      value: c, label: c
                    })),
                    { value: '__custom__', label: '+ Add custom...' }
                  ]}
                  filterOption={(input, option) => {
                    if (option.value === '__custom__') return true
                    return String(option.label).toLowerCase()
                      .includes(input.toLowerCase())
                  }}
                  onChange={val => {
                    if (val === '__custom__') return
                    updateGroup(group.group_key, 'glass_category', val)
                  }}
                  onInputKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim()
                      if (!val || val === '__custom__') return
                      try {
                        const cfg = JSON.parse(
                          localStorage.getItem('glass_dropdown_config') || '{}'
                        )
                        const existing = cfg.categories ||
                          ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
                        if (!existing.includes(val)) {
                          localStorage.setItem('glass_dropdown_config',
                            JSON.stringify({
                              ...cfg, categories: [...existing, val]
                            })
                          )
                          message.success(`"${val}" added to categories!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_category', val)
                    }
                  }}
                />
              </Col>
              <Col span={4}>
                <div style={{ marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>PRODUCT NAME</Text>
                </div>
                <div style={{
                  padding: '3px 8px', background: '#f0fdf4',
                  border: '1px solid #86efac', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, color: '#16a34a',
                  minHeight: 26, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  {group.description ||
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Auto-generated
                    </Text>
                  }
                  {group.is_toughened &&
                    <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>
                      Toughened
                    </Tag>
                  }
                </div>
              </Col>
              <Col span={2}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>W CEILING</Text></div>
                <Select size="small" value={group.ceiling_w_inches ?? 6} style={{ width: '100%' }}
                  options={CEILING_OPTIONS}
                  onChange={val => updateGroup(group.group_key, 'ceiling_w_inches', val)} />
              </Col>
              <Col span={2}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>H CEILING</Text></div>
                <Select size="small" value={group.ceiling_h_inches ?? 6} style={{ width: '100%' }}
                  options={CEILING_OPTIONS}
                  onChange={val => updateGroup(group.group_key, 'ceiling_h_inches', val)} />
              </Col>
              <Col span={3}>
                <div style={{
                  marginBottom: 2,
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>RATE/SQFT</Text>
                  <Tooltip title={group.custom_costing ? 'Custom Rate' : 'Auto from Matrix'}>
                    <Switch
                      size="small"
                      checked={group.custom_costing}
                      checkedChildren="Custom"
                      unCheckedChildren="Auto"
                      onChange={val =>
                        updateGroup(group.group_key, 'custom_costing', val)
                      }
                      style={{ transform: 'scale(0.75)' }}
                    />
                  </Tooltip>
                </div>
                <div>
                  <InputNumber
                    size="small"
                    value={group.rate}
                    min={0}
                    prefix="₹"
                    disabled={!group.custom_costing}
                    style={{
                      width: '100%',
                      borderColor: group.custom_costing ? '#f59e0b' : undefined
                    }}
                    onChange={val =>
                      updateGroup(group.group_key, 'rate', val)
                    }
                  />
                  {(group.is_toughened || group.glass_type === 'Toughened') && group.base_glass_rate > 0 && (
                    <Text style={{ fontSize: 10, color: '#f97316', display: 'block', marginTop: 2 }}>
                      Base ₹{group.base_glass_rate.toFixed(2)} + Tgh included
                    </Text>
                  )}
                </div>
              </Col>
              <Col span={2}>
                <div style={{ marginBottom: 2 }}><Text style={{ fontSize: 10, color: '#94a3b8' }}>CEP (Polish)</Text></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 4 }}>
                  <Switch size="small" checked={group.cep} onChange={val => updateGroup(group.group_key, 'cep', val)} />
                  {group.cep && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>ON</Tag>}
                </div>
              </Col>
              <Col span={3} style={{ textAlign: 'right' }}>
                <Text strong style={{ color: '#059669', fontSize: 13 }}>
                  ₹{group.sizes
                    .reduce((s, x) => s + (x.subtotal || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
                <div style={{
                  display: 'flex', gap: 4,
                  justifyContent: 'flex-end', marginTop: 4
                }}>
                  <Tooltip title="Cost vs Selling Comparison">
                    <Button
                      size="small"
                      icon={<LineChartOutlined />}
                      style={{ color: '#6366f1', borderColor: '#6366f1' }}
                      onClick={() => openComparisonWizard(group)}
                    />
                  </Tooltip>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeGroup(group.group_key)}
                  />
                </div>
              </Col>
            </Row>





            <Table
              dataSource={group.sizes}
              rowKey="size_key"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              style={{ marginLeft: 24 }}
              expandable={{
                expandedRowRender: (size) => {
                  const sizeProcesses = size.size_processes || []
                  return (
                    <div style={{
                      padding: '8px 12px',
                      background: '#faf5ff',
                      borderRadius: 6,
                      border: '1px solid #e9d5ff',
                      marginLeft: 8,
                    }}>
                      {sizeProcesses.length > 0 && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '200px 80px 50px 110px 110px 40px',
                          gap: 6,
                          padding: '4px 0',
                          marginBottom: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#6d28d9',
                        }}>
                          <div>Process</div>
                          <div>Qty</div>
                          <div>Unit</div>
                          <div>Rate</div>
                          <div>Amount</div>
                          <div></div>
                        </div>
                      )}

                      {sizeProcesses.map(proc => (
                        <div
                          key={proc.sproc_key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              '200px 80px 50px 110px 110px 40px',
                            gap: 6,
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <Select
                            size="small"
                            placeholder="Select process"
                            value={proc.process_id}
                            style={{ width: '100%' }}
                            options={processMasters
                              .filter(p =>
                                ['hole', 'cutout', 'forma', 'farma']
                                  .includes(p.process_type)
                              )
                              .map(p => ({ value: p.id, label: p.name }))
                            }
                            onChange={val =>
                              updateSizeProcess(
                                group.group_key, size.size_key,
                                proc.sproc_key, 'process_id', val
                              )
                            }
                          />
                          <InputNumber
                            size="small"
                            value={proc.qty_area}
                            min={0}
                            style={{ width: '100%' }}
                            placeholder="Qty"
                            onChange={val =>
                              updateSizeProcess(
                                group.group_key, size.size_key,
                                proc.sproc_key, 'qty_area', val
                              )
                            }
                          />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {proc.charge_type === 'per_piece' ? 'pcs' :
                              proc.charge_type === 'per_sqft' ? 'sqft' :
                                proc.charge_type === 'per_rft' ? 'rft' :
                                  proc.charge_type === 'fixed' ? 'fixed' : 'pcs'}
                          </Text>
                          <InputNumber
                            size="small"
                            value={proc.rate}
                            min={0}
                            prefix="₹"
                            style={{ width: '100%' }}
                            onChange={val =>
                              updateSizeProcess(
                                group.group_key, size.size_key,
                                proc.sproc_key, 'rate', val
                              )
                            }
                          />
                          <Text strong style={{ color: '#6366f1', fontSize: 12 }}>
                            ₹{Number(proc.amount || 0).toLocaleString('en-IN',
                              { minimumFractionDigits: 2 })}
                          </Text>
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              removeSizeProcess(
                                group.group_key, size.size_key,
                                proc.sproc_key
                              )
                            }
                          />
                        </div>
                      ))}

                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          borderColor: '#7c3aed',
                          color: '#7c3aed',
                        }}
                        onClick={() =>
                          addSizeProcess(group.group_key, size.size_key)
                        }
                      >
                        + Add Process
                      </Button>

                      {sizeProcesses.length > 0 && (
                        <div style={{
                          marginTop: 6,
                          textAlign: 'right',
                          fontSize: 12,
                          color: '#6366f1',
                          fontWeight: 600,
                        }}>
                          Process Total: ₹{sizeProcesses
                            .reduce((s, p) => s + (p.amount || 0), 0)
                            .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  )
                },
                rowExpandable: () => true,
                expandIcon: ({ expanded, onExpand, record }) => (
                  <Button
                    size="small"
                    type={
                      (record.size_processes || []).length > 0
                        ? 'primary'
                        : 'default'
                    }
                    icon={expanded ? <CloseCircleOutlined /> : <PlusOutlined />}
                    style={{
                      fontSize: 10,
                      padding: '0 4px',
                      height: 20,
                      background:
                        (record.size_processes || []).length > 0
                          ? '#7c3aed'
                          : undefined,
                      borderColor:
                        (record.size_processes || []).length > 0
                          ? '#7c3aed'
                          : undefined,
                    }}
                    onClick={e => onExpand(record, e)}
                  />
                ),
              }}
              columns={[
                { title: '#', width: 30, render: (_, __, i) => <Text type="secondary" style={{ fontSize: 11 }}>{String.fromCharCode(97 + i)}</Text> },
                {
                  title: `Actual W (${soUnit === 'inch' ? 'inch' : 'mm'})`, width: 100, dataIndex: 'width_inch',
                  render: (v, row) => soUnit === 'inch' ? (
                    <FractionInput value={v} onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val)} placeholder="84 1/4" />
                  ) : (
                    <InputNumber size="small" value={v ? parseFloat((v * 25.4).toFixed(2)) : null} min={0} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val ? val / 25.4 : null)} />
                  )
                },
                {
                  title: `Actual H (${soUnit === 'inch' ? 'inch' : 'mm'})`, width: 100, dataIndex: 'height_inch',
                  render: (v, row) => soUnit === 'inch' ? (
                    <FractionInput value={v} onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val)} placeholder="48 1/2" />
                  ) : (
                    <InputNumber size="small" value={v ? parseFloat((v * 25.4).toFixed(2)) : null} min={0} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val ? val / 25.4 : null)} />
                  )
                },
                {
                  title: 'Qty', width: 60, dataIndex: 'quantity',
                  render: (v, row) => <InputNumber size="small" value={v} min={1} style={{ width: '100%' }}
                    onChange={val => updateSize(group.group_key, row.size_key, 'quantity', val)} />
                },
                {
                  title: 'Chg W', width: 80, dataIndex: 'charged_w_inch',
                  render: (v) => (
                    <Text style={{ fontSize: 12, color: '#475569', paddingLeft: 4 }}>
                      {v ? parseFloat(v.toFixed(3)) : '—'}
                    </Text>
                  )
                },
                {
                  title: 'Chg H', width: 80, dataIndex: 'charged_h_inch',
                  render: (v) => (
                    <Text style={{ fontSize: 12, color: '#475569', paddingLeft: 4 }}>
                      {v ? parseFloat(v.toFixed(3)) : '—'}
                    </Text>
                  )
                },
                {
                  title: 'Sqft', width: 80, dataIndex: 'total_sqft',
                  render: (v, row) => <InputNumber size="small" value={v ? parseFloat(v.toFixed(3)) : null} min={0} step={0.001} style={{ width: '100%' }}
                    onChange={val => setGroups(prev => prev.map(g => {
                      if (g.group_key !== group.group_key) return g
                      return {
                        ...g, sizes: g.sizes.map(s => {
                          if (s.size_key !== row.size_key) return s
                          const sub = parseFloat(((val || 0) * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (s.cep_charges || 0)).toFixed(2))
                          return { ...s, total_sqft: val, subtotal: sub }
                        })
                      }
                    }))} />
                },

                ...(group.cep ? [{
                  title: <span>CEP <Tag color="blue" style={{ fontSize: 9 }}>Polish</Tag></span>, width: 90, dataIndex: 'cep_charges',
                  render: (v, row) => <InputNumber size="small" value={v ? parseFloat(v.toFixed(2)) : 0} min={0} prefix="₹"
                    style={{ width: '100%', borderColor: '#3b82f6' }}
                    onChange={val => setGroups(prev => prev.map(g => {
                      if (g.group_key !== group.group_key) return g
                      return {
                        ...g, sizes: g.sizes.map(s => {
                          if (s.size_key !== row.size_key) return s
                          const sub = parseFloat(((s.total_sqft || 0) * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (val || 0)).toFixed(2))
                          return { ...s, cep_charges: val, subtotal: sub }
                        })
                      }
                    }))} />
                }] : []),

                {
                  title: 'Amount', width: 110, dataIndex: 'subtotal', align: 'right',
                  render: (v, row) => <InputNumber size="small" value={v ? parseFloat(v.toFixed(2)) : 0} min={0} prefix="₹"
                    style={{ width: '100%' }}
                    onChange={val => setGroups(prev => prev.map(g => {
                      if (g.group_key !== group.group_key) return g
                      return { ...g, sizes: g.sizes.map(s => s.size_key !== row.size_key ? s : { ...s, subtotal: val }) }
                    }))} />
                },
                {
                  title: '', width: 40,
                  render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />}
                    onClick={() => removeSize(group.group_key, row.size_key)} />
                },
              ]}
              footer={() => (
                <Button
                  type="dashed" size="small" icon={<PlusOutlined />}
                  onClick={() => addSize(group.group_key)}
                  style={{ marginLeft: 0 }}
                >
                  Add Size
                </Button>
              )}
            />

            {(group.processes?.length > 0 || true) && (
              <div style={{
                marginTop: 10,
                marginLeft: 24,
                padding: '8px 12px',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px dashed #d1d5db'
              }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                      ⚙️ Process Charges
                    </Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Total: <Text strong style={{ color: '#6366f1' }}>
                        ₹{(group.processes || [])
                          .reduce((s, p) => s + (p.amount || 0), 0)
                          .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Text>
                  </Col>
                </Row>

                {(group.processes || []).map((proc, pi) => (
                  <Row key={proc.proc_key} gutter={6} align="middle"
                    style={{ marginBottom: 4 }}>
                    <Col span={7}>
                      <Select
                        size="small"
                        placeholder="Select process"
                        value={proc.process_id}
                        style={{ width: '100%' }}
                        options={processMasters
                          .filter(p =>
                            ['hole', 'cutout', 'farma', 'forma'].includes(p.process_type)
                          )
                          .map(p => ({
                            value: p.id,
                            label: p.name
                          }))
                        }
                        onChange={val => updateGroupProcess(
                          group.group_key, proc.proc_key, 'process_id', val
                        )}
                      />
                    </Col>
                    <Col span={4}>
                      <InputNumber
                        size="small"
                        value={proc.qty_area}
                        min={0}
                        style={{ width: '100%' }}
                        placeholder="Qty/Area"
                        onChange={val => updateGroupProcess(
                          group.group_key, proc.proc_key, 'qty_area', val
                        )}
                      />
                    </Col>
                    <Col span={2}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {proc.charge_type === 'per_sqft' ? 'sqft' :
                          proc.charge_type === 'per_rft' ? 'rft' :
                            proc.charge_type === 'per_sqmt' ? 'sqmt' :
                              proc.charge_type === 'per_piece' ? 'pcs' : 'fixed'}
                      </Text>
                    </Col>
                    <Col span={4}>
                      <InputNumber
                        size="small"
                        value={proc.rate}
                        min={0}
                        prefix="₹"
                        style={{ width: '100%' }}
                        onChange={val => updateGroupProcess(
                          group.group_key, proc.proc_key, 'rate', val
                        )}
                      />
                    </Col>
                    <Col span={4}>
                      <Text strong style={{ color: '#6366f1', fontSize: 13 }}>
                        ₹{(proc.amount || 0).toLocaleString('en-IN',
                          { minimumFractionDigits: 2 })}
                      </Text>
                    </Col>
                    <Col span={3} style={{ textAlign: 'right' }}>
                      <Button
                        size="small" type="text" danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeGroupProcess(
                          group.group_key, proc.proc_key
                        )}
                      />
                    </Col>
                  </Row>
                ))}

                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => addGroupProcess(group.group_key)}
                  style={{ marginTop: 4, fontSize: 12 }}
                >
                  Add Process
                </Button>
              </div>
            )}
          </Card>
        ))}

        <Row gutter={8} style={{ marginTop: 8 }} align="middle">
          <Col>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addGroup}
            >
              + Add Product
            </Button>
          </Col>
          <Col>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
              onClick={() => setHardwareItems(prev => [
                ...prev, emptyHardware()
              ])}
            >
              + Add Hardware
            </Button>
          </Col>
          <Col>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
              onClick={() => setLaborItems(prev => [
                ...prev, emptyLabor()
              ])}
            >
              + Add Labor
            </Button>
          </Col>
          <Col>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
              onClick={() => setWastageItems(prev => [
                ...prev, emptyWastage()
              ])}
            >
              + Add Wastage
            </Button>
          </Col>
        </Row>

        {hardwareItems.length > 0 && (
          <Card
            title={
              <Space>
                <span>🔩 Hardware Items</span>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Total: ₹{hardwareItems.reduce((s, h) => s + (h.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Space>
            }
            size="small"
            style={{ marginTop: 16, border: '1px solid #e2e8f0' }}
          >
            <Table
              dataSource={hardwareItems}
              rowKey="hw_key"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Description', dataIndex: 'description', width: 300,
                  render: (v, row) => (
                    <Input
                      size="small"
                      value={v}
                      placeholder="Enter hardware description"
                      onChange={e => setHardwareItems(prev =>
                        prev.map(h => h.hw_key !== row.hw_key ? h : {
                          ...h, description: e.target.value
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Qty', dataIndex: 'qty', width: 80,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} style={{ width: '100%' }}
                      onChange={val => setHardwareItems(prev =>
                        prev.map(h => h.hw_key !== row.hw_key ? h : {
                          ...h,
                          qty: val,
                          amount: parseFloat(((val || 0) * (h.rate || 0)).toFixed(2)),
                          cost_amount: parseFloat(((val || 0) * (h.cost_rate || 0)).toFixed(2)),
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'UOM', dataIndex: 'uom', width: 100,
                  render: (v, row) => (
                    <Select
                      size="small"
                      value={v || undefined}
                      placeholder="UOM"
                      style={{ width: '100%' }}
                      allowClear
                      options={[
                        { value: 'PCS', label: 'PCS' },
                        { value: 'RFT', label: 'RFT' },
                        { value: 'SQFT', label: 'SQFT' },
                        { value: 'HRS', label: 'HRS' },
                        { value: 'SQMT', label: 'SQMT' },
                      ].concat(
                        (() => {
                          try {
                            return JSON.parse(localStorage.getItem('uom_rate_master') || '[]')
                              .filter(u => !['PCS', 'RFT', 'SQFT', 'HRS', 'SQMT'].includes(u.uom))
                              .map(u => ({ value: u.uom, label: u.uom }))
                          } catch { return [] }
                        })()
                      )}
                      onChange={val => {
                        const rates = getUomRates(val)
                        setHardwareItems(prev => prev.map(h =>
                          h.hw_key !== row.hw_key ? h : {
                            ...h,
                            uom: val,
                            cost_rate: rates.cost_rate,
                            rate: rates.selling_rate,
                            cost_amount: parseFloat(((h.qty || 0) * rates.cost_rate).toFixed(2)),
                            amount: parseFloat(((h.qty || 0) * rates.selling_rate).toFixed(2)),
                          }
                        ))
                      }}
                    />
                  )
                },
                {
                  title: 'Cost Rate',
                  dataIndex: 'cost_rate',
                  width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%', borderColor: '#f59e0b' }}
                      onChange={val => setHardwareItems(prev =>
                        prev.map(h => h.hw_key !== row.hw_key ? h : {
                          ...h,
                          cost_rate: val,
                          cost_amount: parseFloat(((h.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Rate', dataIndex: 'rate', width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%' }}
                      onChange={val => setHardwareItems(prev =>
                        prev.map(h => h.hw_key !== row.hw_key ? h : {
                          ...h,
                          rate: val,
                          amount: parseFloat(((h.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Amount', dataIndex: 'amount', width: 120, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#059669' }}>
                      ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: '', width: 40,
                  render: (_, row) => (
                    <Button
                      size="small" type="text" danger
                      icon={<DeleteOutlined />}
                      onClick={() => setHardwareItems(prev =>
                        prev.filter(h => h.hw_key !== row.hw_key)
                      )}
                    />
                  )
                }
              ]}
            />
          </Card>
        )}

        {laborItems.length > 0 && (
          <Card
            title={
              <Space>
                <span>👷 Labor Charges</span>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Total: ₹{laborItems.reduce((s, l) => s + (l.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Space>
            }
            size="small"
            style={{ marginTop: 16, border: '1px solid #e2e8f0' }}
          >
            <Table
              dataSource={laborItems}
              rowKey="lb_key"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Description', dataIndex: 'description', width: 300,
                  render: (v, row) => (
                    <Input
                      size="small"
                      value={v}
                      placeholder="Enter labor description"
                      onChange={e => setLaborItems(prev =>
                        prev.map(l => l.lb_key !== row.lb_key ? l : {
                          ...l, description: e.target.value
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Qty', dataIndex: 'qty', width: 80,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} style={{ width: '100%' }}
                      onChange={val => setLaborItems(prev =>
                        prev.map(l => l.lb_key !== row.lb_key ? l : {
                          ...l,
                          qty: val,
                          amount: parseFloat(((val || 0) * (l.rate || 0)).toFixed(2)),
                          cost_amount: parseFloat(((val || 0) * (l.cost_rate || 0)).toFixed(2)),
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'UOM', dataIndex: 'uom', width: 100,
                  render: (v, row) => (
                    <Select
                      size="small"
                      value={v || undefined}
                      placeholder="UOM"
                      style={{ width: '100%' }}
                      allowClear
                      options={[
                        { value: 'PCS', label: 'PCS' },
                        { value: 'RFT', label: 'RFT' },
                        { value: 'SQFT', label: 'SQFT' },
                        { value: 'HRS', label: 'HRS' },
                        { value: 'SQMT', label: 'SQMT' },
                      ].concat(
                        (() => {
                          try {
                            return JSON.parse(localStorage.getItem('uom_rate_master') || '[]')
                              .filter(u => !['PCS', 'RFT', 'SQFT', 'HRS', 'SQMT'].includes(u.uom))
                              .map(u => ({ value: u.uom, label: u.uom }))
                          } catch { return [] }
                        })()
                      )}
                      onChange={val => {
                        const rates = getUomRates(val)
                        setLaborItems(prev => prev.map(l =>
                          l.lb_key !== row.lb_key ? l : {
                            ...l,
                            uom: val,
                            cost_rate: rates.cost_rate,
                            rate: rates.selling_rate,
                            cost_amount: parseFloat(((l.qty || 0) * rates.cost_rate).toFixed(2)),
                            amount: parseFloat(((l.qty || 0) * rates.selling_rate).toFixed(2)),
                          }
                        ))
                      }}
                    />
                  )
                },
                {
                  title: 'Cost Rate',
                  dataIndex: 'cost_rate',
                  width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%', borderColor: '#f59e0b' }}
                      onChange={val => setLaborItems(prev =>
                        prev.map(l => l.lb_key !== row.lb_key ? l : {
                          ...l,
                          cost_rate: val,
                          cost_amount: parseFloat(((l.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Rate', dataIndex: 'rate', width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%' }}
                      onChange={val => setLaborItems(prev =>
                        prev.map(l => l.lb_key !== row.lb_key ? l : {
                          ...l,
                          rate: val,
                          amount: parseFloat(((l.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Amount', dataIndex: 'amount', width: 120, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#059669' }}>
                      ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: '', width: 40,
                  render: (_, row) => (
                    <Button
                      size="small" type="text" danger
                      icon={<DeleteOutlined />}
                      onClick={() => setLaborItems(prev =>
                        prev.filter(l => l.lb_key !== row.lb_key)
                      )}
                    />
                  )
                }
              ]}
            />
          </Card>
        )}

        {wastageItems.length > 0 && (
          <Card
            title={
              <Space>
                <span>🗑️ Wastage / Scrap</span>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Total: ₹{wastageItems.reduce((s, w) => s + (w.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Space>
            }
            size="small"
            style={{ marginTop: 16, border: '1px solid #fca5a5' }}
          >
            <Table
              dataSource={wastageItems}
              rowKey="wst_key"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Description', dataIndex: 'description', width: 300,
                  render: (v, row) => (
                    <Input
                      size="small"
                      value={v}
                      placeholder="Enter wastage description"
                      onChange={e => setWastageItems(prev =>
                        prev.map(w => w.wst_key !== row.wst_key ? w : {
                          ...w, description: e.target.value
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Qty', dataIndex: 'qty', width: 80,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0}
                      style={{ width: '100%' }}
                      onChange={val => setWastageItems(prev =>
                        prev.map(w => w.wst_key !== row.wst_key ? w : {
                          ...w,
                          qty: val,
                          cost_amount: parseFloat(((val || 0) * (w.cost_rate || 0)).toFixed(2)),
                          amount: parseFloat(((val || 0) * (w.rate || 0)).toFixed(2)),
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Cost Rate', dataIndex: 'cost_rate', width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%' }}
                      onChange={val => setWastageItems(prev =>
                        prev.map(w => w.wst_key !== row.wst_key ? w : {
                          ...w,
                          cost_rate: val,
                          cost_amount: parseFloat(((w.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Rate', dataIndex: 'rate', width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      style={{ width: '100%' }}
                      onChange={val => setWastageItems(prev =>
                        prev.map(w => w.wst_key !== row.wst_key ? w : {
                          ...w,
                          rate: val,
                          amount: parseFloat(((w.qty || 0) * (val || 0)).toFixed(2))
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Amount', dataIndex: 'amount', width: 120, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#dc2626' }}>
                      ₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: '', width: 40,
                  render: (_, row) => (
                    <Button
                      size="small" type="text" danger
                      icon={<DeleteOutlined />}
                      onClick={() => setWastageItems(prev =>
                        prev.filter(w => w.wst_key !== row.wst_key)
                      )}
                    />
                  )
                }
              ]}
            />
          </Card>
        )}

        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Tabs size="small" items={[
              { key: 'cn', label: 'Customer Notes', children: <Form.Item name="customer_note"><TextArea rows={4} /></Form.Item> },
              { key: 'in', label: 'Internal Notes', children: <Form.Item name="internal_notes"><TextArea rows={4} /></Form.Item> },
            ]} />
          </Col>
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Sub-total I (Glass)</Col><Col>{fmt(totals.subI)}</Col></Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col><Text type="secondary">Process Charges (all products)</Text></Col><Col><Text>{fmt(totals.procTotal)}</Text></Col></Row>
              {totals.hwTotal > 0 && (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Hardware</Col><Col>{fmt(totals.hwTotal)}</Col></Row>
              )}
              {totals.lbTotal > 0 && (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Labor</Col><Col>{fmt(totals.lbTotal)}</Col></Row>
              )}
              {totals.wstTotal > 0 && (
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Col><Text style={{ color: '#dc2626' }}>Wastage</Text></Col>
                  <Col><Text style={{ color: '#dc2626' }}>{fmt(totals.wstTotal)}</Text></Col>
                </Row>
              )}
              <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Form.Item name="dc_charges" label="D/C Charges (Selling)" labelCol={{ span: 14 }} wrapperCol={{ span: 10 }} style={{ marginBottom: 0 }}>
                    <InputNumber style={{ width: '100%' }} prefix="₹" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="dc_cost" label="D/C Cost" labelCol={{ span: 10 }} wrapperCol={{ span: 14 }} style={{ marginBottom: 0 }}>
                    <InputNumber style={{ width: '100%' }} prefix="₹" />
                  </Form.Item>
                </Col>
              </Row>
              <Row justify="space-between" style={{ marginBottom: 8, fontWeight: 600 }}><Col>Sub-total II</Col><Col>{fmt(totals.subII)}</Col></Row>
              <Form.Item name="discount_amount" label="Discount" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }} style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Row justify="space-between" style={{ marginBottom: 12, fontWeight: 600, fontSize: 15 }}><Col>Sub-total III</Col><Col>{fmt(totals.subIII)}</Col></Row>

              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>GST Type</span>
                <Radio.Group
                  value={gstMode}
                  onChange={e => setGstMode(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="cgst_sgst">CGST/SGST</Radio.Button>
                  <Radio.Button value="igst">IGST</Radio.Button>
                  <Radio.Button value="off">No GST</Radio.Button>
                </Radio.Group>
              </div>

              {gstMode === 'cgst_sgst' && (
                <>
                  <Row justify="space-between" style={{ marginBottom: 8 }}><Col>CGST (9%)</Col><Col>{fmt(totals.cgst)}</Col></Row>
                  <Row justify="space-between" style={{ marginBottom: 8 }}><Col>SGST (9%)</Col><Col>{fmt(totals.sgst)}</Col></Row>
                </>
              )}
              {gstMode === 'igst' && (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col>IGST (18%)</Col><Col>{fmt(totals.igst)}</Col></Row>
              )}
              {gstMode === 'off' && (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col><Text type="secondary">No GST Applied</Text></Col><Col></Col></Row>
              )}

              <Divider style={{ margin: '12px 0' }} />
              <Row justify="space-between" style={{ marginBottom: 16 }}><Col><b style={{ fontSize: 18, color: '#0f172a' }}>Grand Total</b></Col><Col><b style={{ fontSize: 18, color: '#16a34a' }}>{fmt(totals.grandTotal)}</b></Col></Row>

              <Form.Item name="advance_received" label="Advance Received" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }} style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Row justify="space-between" style={{ marginTop: 8 }}><Col><b style={{ fontSize: 16 }}>Balance Due</b></Col><Col><b style={{ fontSize: 16, color: totals.balance > 0 ? '#dc2626' : '#16a34a' }}>{fmt(totals.balance)}</b></Col></Row>
            </div>
          </Col>


          <Modal
            title={
              <Space>
                <LineChartOutlined style={{ color: '#6366f1' }} />
                <span>Cost vs Selling Comparison — {compWizard?.product_name}</span>
              </Space>
            }
            open={compWizard !== null}
            onCancel={() => { setCompWizard(null); setWizardCostPrice(null) }}
            footer={
              <Space>
                <Button
                  type="primary"
                  style={{ background: '#6366f1', borderColor: '#6366f1' }}
                  disabled={!wizardCostPrice || wizardCostPrice <= 0}
                  onClick={() => {
                    if (compWizard?.group_key && wizardCostPrice > 0) {
                      // Only save CP — does NOT change selling rate
                      updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice)
                      message.success(`Cost price ₹${wizardCostPrice}/sqft saved`)
                    }
                    setCompWizard(null)
                    setWizardCostPrice(null)
                  }}
                >
                  💾 Save Cost Price
                </Button>
                <Button onClick={() => { setCompWizard(null); setWizardCostPrice(null) }}>
                  Close
                </Button>
              </Space>
            }
            width={800}
          >
            {compWizard && (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                      <Text type="secondary">Selling Rate</Text>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
                        ₹ {compWizard.selling_rate}/sqft
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                      <Text type="secondary">Cost Price (editable)</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <InputNumber
                          value={wizardCostPrice !== null && wizardCostPrice !== undefined ? wizardCostPrice : compWizard.cost_price}
                          min={0}
                          prefix="₹"
                          addonAfter="/sqft"
                          style={{ width: '100%' }}
                          onChange={val => {
                            setWizardCostPrice(val)
                            const newCostPrice = val || 0
                            const newRows = compWizard.rows.map(r => {
                              const glass_cost = parseFloat((parseFloat(r.charged_sqft) * newCostPrice).toFixed(2))
                              const cost_amount = parseFloat((glass_cost + (r.cep_cost || 0)).toFixed(2))
                              const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2))
                              const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100
                              return { ...r, glass_cost, cost_amount, margin_amount, margin_pct }
                            })
                            const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0)
                            const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0)
                            const totalMargin = compWizard.totalSelling - totalCost
                            const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                            setCompWizard(prev => ({
                              ...prev,
                              // DO NOT update cost_price here — keeps original auto-calc
                              rows: newRows,
                              totalCost,
                              totalCepCost,
                              totalMargin,
                              totalMarginPct
                            }))
                          }}
                        />
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>Edit to recalculate margin</Text>
                    </Card>
                  </Col>
                </Row>

                {compWizard?.cep_on && (
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔵</span>
                    <strong>CEP (Polish - 4 sides)</strong> cost is included: Actual running ft × ₹{compWizard.cep_cost_rate}/rft (charged inch to inch, no ceiling)
                  </div>
                )}

                <Table
                  dataSource={compWizard.rows}
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  columns={[
                    {
                      title: 'Size', key: 'size', width: 100,
                      render: (_, r) => <Text strong style={{ fontSize: 12 }}>{r.label}. {r.width_display} × {r.height_display}</Text>
                    },
                    { title: 'Qty', dataIndex: 'quantity', width: 40 },
                    {
                      title: 'Charged Sqft', dataIndex: 'selling_sqft', width: 90,
                      render: v => <Text>{v}</Text>
                    },
                    {
                      title: 'Cost Sqft', dataIndex: 'charged_sqft', width: 90,
                      render: v => <Text type="secondary">{v}</Text>
                    },
                    {
                      title: 'Actual Rft', dataIndex: 'actual_rft', width: 80,
                      render: v => <Text type="secondary">{v}</Text>
                    },
                    {
                      title: 'Selling Amt', dataIndex: 'selling_amount', width: 100, align: 'right',
                      render: v => <Text strong style={{ color: '#16a34a' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    },
                    {
                      title: 'Glass Cost', dataIndex: 'glass_cost', width: 100, align: 'right',
                      render: v => <Text style={{ color: '#ea580c' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    },
                    ...(compWizard?.cep_on ? [{
                      title: <span>CEP Cost<br /><Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>Rft × ₹{compWizard.cep_cost_rate}</Text></span>,
                      dataIndex: 'cep_cost', width: 100, align: 'right',
                      render: v => <Text style={{ color: '#7c3aed' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    }] : []),
                    {
                      title: 'Total Cost', dataIndex: 'cost_amount', width: 110, align: 'right',
                      render: v => <Text strong style={{ color: '#dc2626' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    },
                    {
                      title: 'Margin', dataIndex: 'margin_amount', width: 110, align: 'right',
                      render: (v, r) => (
                        <Text strong style={{ color: r.margin_pct >= 20 ? '#16a34a' : r.margin_pct >= 10 ? '#f59e0b' : '#dc2626' }}>
                          ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <br />
                          <Text style={{ fontSize: 11, color: 'inherit' }}>({r.margin_pct}%)</Text>
                        </Text>
                      )
                    },
                  ]}
                />

                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={[12, 8]}>
                  <Col span={6}>
                    <Text type="secondary">Glass Selling</Text>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>
                      ₹{compWizard.glassSellingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </Col>
                  {(compWizard.totalProcSelling || 0) > 0 && (
                    <Col span={6}>
                      <Text type="secondary">Process Charges</Text>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>
                        ₹{(compWizard.totalProcSelling || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <Text type="secondary" style={{ fontSize: 10 }}>Cost est. @70%</Text>
                    </Col>
                  )}
                  <Col span={6}>
                    <Text type="secondary">Glass Cost (excl. CEP)</Text>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ea580c' }}>
                      ₹{(compWizard.totalCost - (compWizard.totalCepCost || 0))
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </Col>
                  {compWizard.cep_on && (
                    <Col span={6}>
                      <Text type="secondary">CEP Cost (₹{compWizard.cep_cost_rate}/rft)</Text>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>
                        ₹{(compWizard.totalCepCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </Col>
                  )}
                  <Col span={6}>
                    <Text type="secondary">Total Glass Cost</Text>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>
                      ₹{compWizard.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <Text type="secondary" style={{ fontSize: 10 }}>Glass + CEP</Text>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">Margin</Text>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: compWizard.totalMargin >= 0 ? '#16a34a' : '#dc2626'
                    }}>
                      ₹{compWizard.totalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </Col>
                  <Col span={6}>
                    <Text type="secondary">Margin %</Text>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      color: compWizard.totalMarginPct >= 20 ? '#16a34a' :
                             compWizard.totalMarginPct >= 10 ? '#f59e0b' : '#dc2626'
                    }}>
                      {compWizard.totalMarginPct}%
                    </div>
                  </Col>
                </Row>
              </>
            )}
          </Modal>
        </Row>
      </Form>

    </MasterForm>
  )
}

export default SalesOrderForm
