import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, App, Collapse, Checkbox, Typography, Radio, Tooltip, Modal, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, DownloadOutlined, LineChartOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import MasterForm from '../../components/common/MasterForm'
import { quotationApi, customerApi, productApi, salesOrderApi, processMasterApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'
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
  { value: '60_days', label: '60 Days' }, { value: '90_days', label: '90 Days' },
]

const PRICING_METHODS = [
  { value: 'per_sqft', label: 'Per Sqft' },
  { value: 'per_rft', label: 'Per Running Ft' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'per_charged_sqft', label: 'Per Charged Sqft' },
]

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

const parseGlassDescription = (name, dropdownConfig) => {
  if (!name) return {}

  const result = {
    glass_thickness: null,
    glass_type: null,
    glass_category: null,
  }

  const str = name.trim()

  // ── Thickness: match patterns like "3.5mm", "6 mm", "10MM" ──
  const thicknessMatch = str.match(/(\d+(?:\.\d+)?)\s*mm/i)
  if (thicknessMatch) {
    result.glass_thickness = parseFloat(thicknessMatch[1])
  }

  // ── Glass Types (order matters — check longer names first) ──
  const glassTypes = dropdownConfig?.glass_types?.length
    ? dropdownConfig.glass_types
    : ['Annealed', 'Toughened', 'Laminated', 'DGU']

  const sortedTypes = [...glassTypes].sort((a, b) => b.length - a.length)
  for (const t of sortedTypes) {
    if (str.toLowerCase().includes(t.toLowerCase())) {
      result.glass_type = t
      break
    }
  }

  // ── Glass Categories ──
  const glassCategories = dropdownConfig?.categories?.length
    ? dropdownConfig.categories
    : ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']

  const sortedCats = [...glassCategories].sort((a, b) => b.length - a.length)
  for (const c of sortedCats) {
    if (str.toLowerCase().includes(c.toLowerCase())) {
      result.glass_category = c
      break
    }
  }

  return result
}

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

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }

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
  wizard_cost_ceil_w: 3,
  wizard_cost_ceil_h: 3,
  is_toughened: false,
  base_glass_rate: 0,
  manual_cost_price: null,
  product_id: null,
  description: '',
  rate: 0,
  rate_rft: 0,
  cep: true,
  cep_polish_rate: 15,
  cep_polish_rate_custom: null,
  pricing_method: 'per_sqft',
  discount_pct: 0,
  tax_rate: 18,
  custom_costing: true,
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

const QuotationForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [unit, setUnit] = useState('inch')
  const [groups, setGroups] = useState([emptyGroup()])
  const [dropdownConfig] = useState(getDropdownConfig)
  const [customSearchVal, setCustomSearchVal] = useState({})
  // key format: `${group_key}_thickness` | `${group_key}_type` | `${group_key}_category`
  const [gstMode, setGstMode] = useState('cgst_sgst')
  const [hardwareItems, setHardwareItems] = useState([])
  const [laborItems, setLaborItems] = useState([])
  const [wastageItems, setWastageItems] = useState([])

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

  const [compWizard, setCompWizard] = useState(null)
  const [wizardCostPrice, setWizardCostPrice] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [globalComparison, setGlobalComparison] = useState(null)
  const [marginTarget, setMarginTarget] = useState(null)
  const fileInputRef = useRef(null)

  const { data: record, isLoading } = useQuery({
    queryKey: ['quotations', id], queryFn: () => quotationApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customersData } = useQuery({
    queryKey: ['customers-dd'],
    queryFn: () => customerApi.dropdown().then(r => r.data)
  })
  const { data: productsData } = useQuery({
    queryKey: ['products-dd'],
    queryFn: () => productApi.dropdown().then(r => r.data)
  })
  const { data: processMastersData } = useQuery({
    queryKey: ['process-masters'],
    queryFn: () => processMasterApi.dropdown().then(r => r.data)
  })

  // Safe extraction — works for both array and {items:[]} format
  const customers = Array.isArray(customersData) ? customersData : (customersData?.items || [])
  const products = Array.isArray(productsData) ? productsData : (productsData?.items || [])
  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])

  // Query linked SO when quotation is already converted
  const { data: linkedSoData } = useQuery({
    queryKey: ['so-by-quote', id],
    queryFn: () => salesOrderApi.list({ page: 1, page_size: 10 })
      .then(r => {
        const items = r.data?.items || r.data || []
        return items.find(so =>
          so.quotation_id === parseInt(id) ||
          so.quote_number === record?.quote_number
        ) || null
      }),
    enabled: isEdit && record?.status === 'converted',
  })
  const linkedSoId = linkedSoData?.id || null
  useEffect(() => {
    if (!isEdit) {
      const leadId = searchParams.get('lead_id')
      const customerId = searchParams.get('customer_id')
      if (leadId) form.setFieldValue('crm_lead_id', parseInt(leadId))
      if (customerId) form.setFieldValue('customer_id', parseInt(customerId))
      form.setFieldValue('quote_date', dayjs())
      form.setFieldValue('valid_until', dayjs().add(30, 'day'))
      form.setFieldValue('dc_charges', 0)
      form.setFieldValue('discount_amount', 0)
      form.setFieldValue('advance_received', 0)
    }
  }, [])

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
          cep_polish_rate: line.cep_polish_rate || 15,
          cep_polish_rate_custom: line.cep_polish_rate_custom || null,
          pricing_method: line.pricing_method || 'per_sqft',
          discount_pct: line.discount_pct || 0,
          tax_rate: line.tax_rate || 18,
          custom_costing: line.custom_costing || false,
          manual_rate: line.manual_rate || null,
          cep_rft_multiplier: line.cep_rft_multiplier || null,

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

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        customer_id: record.customer?.id || record.customer_id,
        crm_lead_id: record.crm_lead?.id || record.crm_lead_id,
        quote_date: record.quote_date ? dayjs(record.quote_date) : null,
        valid_until: record.valid_until ? dayjs(record.valid_until) : null,
      })
      if (record.lines?.length) {
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
      setGstMode(record.gst_mode || (record.is_inter_state ? 'igst' : 'cgst_sgst'))
      if (record.hardware_items) setHardwareItems(record.hardware_items)
      if (record.labor_items) setLaborItems(record.labor_items)
      if (record.wastage_items) setWastageItems(record.wastage_items)
    }
  }, [record, form])

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
    // Keep ceilFn for backward compat (uses W ceiling)
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

    const polishRate = group.cep_polish_rate === 'custom'
      ? (group.cep_polish_rate_custom || 15)
      : (group.cep_polish_rate || 15)
    const cep_charges = group.cep
      ? parseFloat((running_ft * polishRate).toFixed(2)) : 0

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
        const cat = updated.glass_category
        const thick = updated.glass_thickness
        if (cat && thick) {
          const baseRate = calcRateFromMatrix(cat, thick)
          updated.base_glass_rate = baseRate
          updated.rate = baseRate
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

      if (field === 'cep_polish_rate' || field === 'cep_polish_rate_custom') {
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
    cost_rate: 0,
    cost_amount: 0,
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
                    ['hole', 'cutout', 'forma', 'farma'].includes(
                      x.process_type
                    )
                  )
                  .find(x => x.id === value)
                if (pm) {
                  updated.charge_type = pm.charge_type
                  updated.rate = pm.rate
                  updated.qty_area = 0
                  updated.amount = 0
                }
              }
              if (field === 'qty_area' || field === 'rate' || field === 'cost_rate') {
                updated.amount = parseFloat(
                  ((updated.qty_area || 0) * (updated.rate || 0)).toFixed(2)
                )
                updated.cost_amount = parseFloat(
                  ((updated.qty_area || 0) * (updated.cost_rate || 0)).toFixed(2)
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

  const dcCharges = Form.useWatch('dc_charges', form) || 0
  const dcCost = Form.useWatch('dc_cost', form) || 0
  const discountAmt = Form.useWatch('discount_amount', form) || 0
  const advanceRec = Form.useWatch('advance_received', form) || 0

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

    let glassCost = 0
    groups.forEach(g => {
      let costPerSqft = 0
      const prod = products.find(x => x.id === g.product_id)
      if (prod?.cost_price) {
        costPerSqft = prod.cost_price
      } else if (g.glass_category && g.glass_thickness) {
        try {
          const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
          const costRate = matrix?.cost_rates?.[g.glass_category]
          if (costRate) costPerSqft = parseFloat((parseFloat(g.glass_thickness) * costRate / 10.764).toFixed(2))
        } catch { }
      }
      if (!costPerSqft && g.rate > 0) costPerSqft = parseFloat((g.rate * 0.70).toFixed(2))
      g.sizes.forEach(s => {
        glassCost += (s.total_sqft || 0) * costPerSqft
      })
        ; (g.processes || []).forEach(p => {
          glassCost += (p.amount || 0) * 0.7
        })
    })

    const totalCost = glassCost + hwCostTotal + lbCostTotal + wstCostTotal + dcCost
    // True selling = grandTotal (includes GST)
    const trueSelling = grandTotal
    const marginAmt = trueSelling - totalCost
    const marginPct = totalCost > 0 ? (marginAmt / totalCost) * 100 : 100

    return {
      subI, procTotal, hwTotal, lbTotal, wstTotal, dcCharges, dcCost, subII,
      discountAmt, subIII, cgst, sgst, igst,
      grandTotal, advanceRec, balance,
      totalCost, glassCost, marginAmt, marginPct,
      hwCostTotal, lbCostTotal, wstCostTotal
    }
  }, [groups, hardwareItems, laborItems, wastageItems, dcCharges, dcCost, discountAmt, advanceRec, gstMode, products])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? quotationApi.update(id, data) : quotationApi.create(data),
    onSuccess: (res) => {
      message.success(`Quotation ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotations-for-lead'] })
      queryClient.invalidateQueries({ queryKey: ['crm_leads'] })
      if (!isEdit && res?.data?.id) navigate(`/quotations/${res.data.id}/edit`)
    },
  })

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
        cep_polish_rate: g.cep_polish_rate || 15,
        cep_polish_rate_custom: g.cep_polish_rate_custom || null,
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

  const convertMutation = useMutation({
    mutationFn: async () => {
      const getProcessName = (process_id) => {
        const pm = processMasters.find(p => p.id === process_id)
        return pm?.name || ''
      }
      const soData = {
        ...form.getFieldsValue(),
        lines: groups.flatMap(group =>
          group.sizes.map(size => ({
            description: group.description || `${group.glass_thickness}mm ${group.glass_type} ${group.glass_category}`,
            product_id: group.product_id || null,
            width_mm: size.width_inch ? Math.round(size.width_inch * 25.4) : null,
            height_mm: size.height_inch ? Math.round(size.height_inch * 25.4) : null,
            cep: (size.cep_charges || 0) > 0 || group.cep,
            pricing_method: group.pricing_method || 'per_sqft',
            quantity: size.quantity || 1,
            unit_price: group.rate || 0,
            subtotal: size.subtotal || 0,
            is_toughened: group.is_toughened || group.glass_type === 'Toughened',
            processes: (group.processes || []).map(p => ({
              process_id: p.process_id,
              process_name: getProcessName(p.process_id),
              charge_type: p.charge_type,
              rate: p.rate,
              qty_area: p.qty_area,
              amount: p.amount,
            })),
            size_processes: (size.size_processes || []).map(p => ({
              process_id: p.process_id,
              process_name: getProcessName(p.process_id),
              charge_type: p.charge_type,
              rate: p.rate,
              qty_area: p.qty_area,
              amount: p.amount,
            })),
          }))
        ),
        groups: groups,
        processes: [],
        hardware_items: hardwareItems,
        labor_items: laborItems,
        wastage_items: wastageItems,
        dc_cost: form.getFieldValue('dc_cost') || 0,
        totals: totals,
        quotation_id: parseInt(id),
        subtotal: totals.subIII,
        tax_amount: totals.cgst + totals.sgst + totals.igst,
        total_amount: totals.grandTotal,
        status: 'confirmed',
      }
      const res = await salesOrderApi.create(soData)
      await quotationApi.changeStatus(id, 'converted')
      return res.data
    },
    onSuccess: (data) => {
      message.success('Converted to Sales Order!')
      queryClient.invalidateQueries({ queryKey: ['so-by-quote', id] })
      navigate(`/sales-orders/${data.id}/edit`)
    }
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await handleSave(false)
      await quotationApi.changeStatus(id, 'confirmed')
    },
    onSuccess: () => {
      message.success('\u2705 Quotation confirmed successfully!')
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      queryClient.invalidateQueries({ queryKey: ['quotations', id] })
    },
    onError: (err) => {
      message.error('Failed to confirm quotation. Please save first and try again.')
      console.error(err)
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.quote_date) values.quote_date = values.quote_date.format('YYYY-MM-DD')
      if (values.valid_until) values.valid_until = values.valid_until.format('YYYY-MM-DD')


      values.lines = getFlatLines()
      values.processes = []
      values.gst_mode = gstMode
      values.is_inter_state = gstMode === 'igst'
      values.hardware_items = hardwareItems
      values.labor_items = laborItems
      values.wastage_items = wastageItems
      values.dc_cost = form.getFieldValue('dc_cost') || 0
      values.subtotal = totals.subIII
      values.tax_amount = totals.cgst + totals.sgst + totals.igst
      values.total_amount = totals.grandTotal
      values.balance_due = totals.balance
      values.groups = groups
      values.totals = totals

      const leadIdFromUrl = searchParams.get('lead_id')
      const existingLeadId = record?.crm_lead_id || record?.crm_lead?.id
      if (!values.crm_lead_id && leadIdFromUrl) values.crm_lead_id = parseInt(leadIdFromUrl)
      if (!values.crm_lead_id && existingLeadId) values.crm_lead_id = existingLeadId

      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setGroups([emptyGroup()])
        navigate('/quotations/new')
      }
    } catch (err) { }
  }

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
          // Same formula as selling: thickness × costRate / 10.764
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
      const cost_ceil_w = group.wizard_cost_ceil_w || 3
      const cost_ceil_h = group.wizard_cost_ceil_h || 3
      const costCeilFn = (x, c) => {
        if (c === 'plus30mm') return x + (30 / 25.4)
        return Math.ceil(x / c) * c
      }
      const cost_charged_w = parseFloat(costCeilFn(w, cost_ceil_w).toFixed(4))
      const cost_charged_h = parseFloat(costCeilFn(h, cost_ceil_h).toFixed(4))
      const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144

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
        width_display: unit === 'inch' ? `${toFraction(w)}"` : `${(w * 25.4).toFixed(1)}mm`,
        height_display: unit === 'inch' ? `${toFraction(h)}"` : `${(h * 25.4).toFixed(1)}mm`,
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
        _w_raw: w,
        _h_raw: h,
        cost_ceil_w,
        cost_ceil_h,
        cost_charged_w,
        cost_charged_h,
        _group_key: group.group_key,
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

  const openGlobalComparison = () => {
    const CEP_COST_RATE = 5
    const allRows = []
    let rowIndex = 0

    groups.forEach((group, gi) => {
      let costPerSqft = 0
      const prod = products.find(p => p.id === group.product_id)
      if (prod?.cost_price) {
        costPerSqft = prod.cost_price
      } else if (group.glass_category && group.glass_thickness) {
        try {
          const matrix = JSON.parse(
            localStorage.getItem('glass_rate_matrix') || '{}'
          )
          const costRate = matrix?.cost_rates?.[group.glass_category]
          if (costRate) costPerSqft = parseFloat(
            (parseFloat(group.glass_thickness) * costRate / 10.764).toFixed(2)
          )
        } catch { }
      }
      if (!costPerSqft && group.rate > 0)
        costPerSqft = parseFloat((group.rate * 0.70).toFixed(2))

      group.sizes?.forEach((s, si) => {
        const w = s.width_inch || 0
        const h = s.height_inch || 0
        const qty = s.quantity || 1
        const ceil3 = x => Math.ceil(x / 3) * 3
        const charged_sqft = (ceil3(w) * ceil3(h) * qty) / 144
        const glass_cost = parseFloat((charged_sqft * costPerSqft).toFixed(2))
        const actual_rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(4))
        const cep_cost = group.cep
          ? parseFloat((actual_rft * CEP_COST_RATE).toFixed(2)) : 0
        const cost_amount = parseFloat((glass_cost + cep_cost).toFixed(2))
        const selling_amount = s.subtotal || 0
        const margin_amount = parseFloat((selling_amount - cost_amount).toFixed(2))
        const margin_pct = cost_amount > 0
          ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100

        allRows.push({
          key: rowIndex++,
          is_first_in_group: si === 0,
          group_no: gi + 1,
          group_name: group.description || `Group ${gi + 1}`,
          size_label: String.fromCharCode(97 + si),
          width_display: unit === 'inch' ? `${toFraction(w)}"` : `${(w * 25.4).toFixed(1)}mm`,
          height_display: unit === 'inch' ? `${toFraction(h)}"` : `${(h * 25.4).toFixed(1)}mm`,
          quantity: qty,
          selling_rate: group.rate,
          cost_per_sqft: costPerSqft,
          selling_sqft: (s.total_sqft || 0).toFixed(3),
          charged_sqft: charged_sqft.toFixed(3),
          glass_cost,
          cep_cost,
          selling_amount,
          cost_amount,
          margin_amount,
          margin_pct,
          cep_on: group.cep,
        })
      })
    })

    const glassSellingTotal = allRows.reduce((s, r) => s + r.selling_amount, 0)
    const glassCostTotal = allRows.reduce((s, r) => s + r.cost_amount, 0)
    // Include hardware, labor, wastage, and DC
    const hwSell = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)
    const hwCost = hardwareItems.reduce((s, h) => s + (h.cost_amount || (h.qty || 0) * (h.cost_rate || 0)), 0)
    const lbSell = laborItems.reduce((s, l) => s + (l.amount || 0), 0)
    const lbCost = laborItems.reduce((s, l) => s + (l.cost_amount || (l.qty || 0) * (l.cost_rate || 0)), 0)
    const wstSell = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
    const wstCost = wastageItems.reduce((s, w) => s + (w.cost_amount || (w.qty || 0) * (w.cost_rate || 0)), 0)
    const dcSell = parseFloat(dcCharges || 0)
    const subBeforeGst = glassSellingTotal + hwSell + lbSell + wstSell + dcSell
    // Add GST
    let gstAmt = 0
    if (gstMode === 'igst') gstAmt = subBeforeGst * 0.18
    else if (gstMode === 'cgst_sgst') gstAmt = subBeforeGst * 0.18
    const totalSelling = parseFloat((subBeforeGst + gstAmt).toFixed(2))
    const totalCost = parseFloat((glassCostTotal + hwCost + lbCost + wstCost + dcCost).toFixed(2))
    const totalMargin = parseFloat((totalSelling - totalCost).toFixed(2))
    const totalMarginPct = totalCost > 0
      ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100

    setGlobalComparison({
      allRows, totalSelling, totalCost, totalMargin, totalMarginPct,
      glassSellingTotal, glassCostTotal, hwSell, hwCost, lbSell, lbCost, wstSell, wstCost, dcSell, dcCost, gstAmt
    })
  }

  const handleExcelImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })

      const wsName = wb.SheetNames.find(n => n.includes('S.O.') || n === 'S.O.')
      if (!wsName) {
        message.error('Could not find S.O. sheet in the Excel file')
        return
      }
      const ws = wb.Sheets[wsName]
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

      let orderNo = null
      let clientName = null

      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i]
        if (row && row[0] === 'Order No:') orderNo = row[1]
        if (row && String(row[0] || '').includes('Client')) clientName = row[1]
      }

      const parsedGroups = []
      let currentGroup = null

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        if (!row) continue

        const itemName = row[2]  // Column C
        const cep = String(row[3] || '').toUpperCase() === 'Y'
        const w_inch = typeof row[4] === 'number' ? row[4] : null
        const h_inch = typeof row[5] === 'number' ? row[5] : null
        const qty = typeof row[6] === 'number' ? row[6] : null
        const rft_rate = typeof row[9] === 'number' ? row[9] : 0
        const sqft_rate = typeof row[13] === 'number' ? row[13] : 0

        if (!w_inch || !h_inch) continue

        if (itemName && typeof itemName === 'string' && itemName.trim()) {
          const matchedProduct = products.find(p =>
            p.name.toLowerCase().includes(itemName.toLowerCase().split(' ')[0]) ||
            itemName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
          )

          // Parse glass attributes from description
          const parsed = parseGlassDescription(itemName.trim(), dropdownConfig)

          // Auto-calculate rate from matrix if thickness + category found
          let autoRate = sqft_rate || matchedProduct?.sale_price || 0
          if (!autoRate && parsed.glass_category && parsed.glass_thickness) {
            autoRate = calcRateFromMatrix(parsed.glass_category, parsed.glass_thickness)
          }

          currentGroup = {
            group_key: Date.now() + Math.random() + i,
            product_id: matchedProduct?.id || null,
            description: itemName.trim(),
            glass_thickness: parsed.glass_thickness || matchedProduct?.thickness_mm || null,
            glass_type: parsed.glass_type || null,
            glass_category: parsed.glass_category || null,
            is_toughened: parsed.glass_type === 'Toughened',
            ceiling_inches: 6,
            rate: autoRate,
            rate_rft: rft_rate || 0,
            cep: cep,
            cep_polish_rate: 15,
            cep_polish_rate_custom: null,
            pricing_method: 'per_sqft',
            discount_pct: 0,
            tax_rate: 18,
            custom_costing: true,
            manual_rate: null,
            cep_rft_multiplier: null,
            sizes: [],
            processes: []
          }
          parsedGroups.push(currentGroup)
        }

        if (!currentGroup) {
          currentGroup = {
            group_key: Date.now() + Math.random() + i,
            product_id: null,
            description: 'Imported Glass',
            glass_thickness: null,
            glass_type: null,
            glass_category: null,
            is_toughened: false,
            ceiling_inches: 6,
            rate: sqft_rate || 0,
            rate_rft: rft_rate || 0,
            cep: cep,
            cep_polish_rate: 15,
            cep_polish_rate_custom: null,
            pricing_method: 'per_sqft',
            discount_pct: 0,
            tax_rate: 18,
            custom_costing: true,
            manual_rate: null,
            cep_rft_multiplier: null,
            sizes: [],
            processes: []
          }
          parsedGroups.push(currentGroup)
        }

        if (sqft_rate > 0) currentGroup.rate = sqft_rate
        if (rft_rate > 0) currentGroup.rate_rft = rft_rate

        const sizeData = {
          size_key: Date.now() + Math.random() + i,
          width_inch: w_inch,
          height_inch: h_inch,
          quantity: qty || 1,
        }
        const calculatedSize = calcGroupSize(currentGroup, sizeData)
        currentGroup.sizes.push(calculatedSize)
      }

      if (parsedGroups.length === 0) {
        message.error('No glass items found in the Excel file')
        return
      }

      setImportPreview({
        orderNo,
        clientName,
        groups: parsedGroups,
        totalItems: parsedGroups.reduce((s, g) => s + g.sizes.length, 0),
        totalProducts: parsedGroups.length
      })

    } catch (err) {
      console.error(err)
      message.error('Failed to read Excel file. Make sure it is a valid .xlsx file.')
    }

    e.target.value = ''
  }

  const status = record?.status || 'draft'
  const fmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleCustomerChange = (val) => {
    const c = customers.find(x => x.id === val)
    if (c) {
      form.setFieldsValue({ payment_terms: c.payment_terms || 'immediate', delivery_address: c.address || '', salesperson: c.salesperson || '' })
    }
  }

  return (
    <MasterForm title="Quotation" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Quotations', path: '/quotations' }, { label: isEdit ? record?.quote_number || 'Edit' : 'New' }]}
      onSave={status === 'converted' ? null : () => handleSave(false)}
      onSaveNew={status === 'converted' ? null : () => handleSave(true)}
      onDiscard={() => navigate('/quotations')}>

      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleExcelImport}
      />

      {status === 'converted' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#065f46', fontWeight: 500, fontSize: 16 }}>✅ Converted to Sales Order</span>
          <Button type="primary" onClick={() => navigate(linkedSoId ? `/sales-orders/${linkedSoId}/edit` : '/sales-orders')} style={{ background: '#10b981', borderColor: '#10b981' }}>View Sales Order →</Button>
        </div>
      )}

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}><Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.toUpperCase() }))} /></Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            <Button
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}
            >
              Import Excel
            </Button>
            {isEdit && (
              <Button
                icon={<LineChartOutlined />}
                onClick={openGlobalComparison}
                style={{
                  borderColor: '#6366f1',
                  color: '#6366f1',
                  fontWeight: 600
                }}
              >
                Cost vs Selling
              </Button>
            )}
            {isEdit && (
              <Button icon={<DownloadOutlined />} onClick={() => {
                generateQuotationPDF({
                  quote_number: record?.quote_number,
                  quote_date: form.getFieldValue('quote_date')?.format?.('YYYY-MM-DD') || form.getFieldValue('quote_date'),
                  valid_until: form.getFieldValue('valid_until')?.format?.('YYYY-MM-DD') || form.getFieldValue('valid_until'),
                  salesperson: form.getFieldValue('salesperson'),
                  payment_terms: form.getFieldValue('payment_terms'),
                  delivery_address: form.getFieldValue('delivery_address'),
                  company_id: form.getFieldValue('company_id'),
                  customer_name: customers.find(c => c.id === form.getFieldValue('customer_id'))?.name || '',
                  customer_phone: customers.find(c => c.id === form.getFieldValue('customer_id'))?.phone || '',
                  customer_gstin: customers.find(c => c.id === form.getFieldValue('customer_id'))?.gstin || '',
                  advance_received: advanceRec || 0,
                  groups: groups,
                  totals: totals,
                  lines: getFlatLines(),
                  hardware_items: hardwareItems,
                  labor_items: laborItems,
                })
              }}>PDF</Button>
            )}
            {status === 'confirmed' && (
              <>
                <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => convertMutation.mutate()} loading={convertMutation.isPending} style={{ background: '#6366f1' }}>Convert to SO</Button>
                <Popconfirm title="Cancel this quotation?" onConfirm={async () => { await quotationApi.changeStatus(id, 'cancelled'); queryClient.invalidateQueries({ queryKey: ['quotations'] }); queryClient.invalidateQueries({ queryKey: ['quotations', id] }); message.info('Quotation cancelled') }}><Button danger>Cancel</Button></Popconfirm>
              </>
            )}
            {status === 'draft' && (
              <Button
                type="primary"
                onClick={() => {
                  if (!id) {
                    message.warning('Please save the quotation first before confirming.')
                    handleSave(false)
                    return
                  }
                  confirmMutation.mutate()
                }}
                loading={confirmMutation.isPending}
                style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
              >
                Confirm
              </Button>
            )}
            {status === 'cancelled' && <Tag color="red">CANCELLED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" disabled={status === 'converted'}>
        <Form.Item name="crm_lead_id" hidden><input type="hidden" /></Form.Item>
        <CompanySelector form={form} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Radio.Group value={unit} onChange={e => setUnit(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="inch">inch</Radio.Button>
              <Radio.Button value="mm">MM</Radio.Button>
            </Radio.Group>
            <Text type="secondary" style={{ fontSize: 11 }}>(Default: Inch)</Text>
          </Space>
        </div>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                onChange={handleCustomerChange}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        color: '#6366f1',
                        fontWeight: 600,
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onMouseDown={async (e) => {
                        e.preventDefault()
                        const name = prompt('Enter customer name:')
                        if (!name?.trim()) return
                        try {
                          const res = await customerApi.create({
                            name: name.trim(),
                            customer_type: 'individual',
                            payment_terms: 'immediate',
                          })
                          queryClient.invalidateQueries({ queryKey: ['customers-dd'] })
                          form.setFieldValue('customer_id', res.data.id)
                          message.success(`Customer "${name}" created!`)
                        } catch {
                          message.error('Failed to create customer')
                        }
                      }}
                    >
                      <PlusOutlined /> Create new customer
                    </div>
                  </>
                )}
              />
            </Form.Item>
          </Col>
          <Col span={4}><Form.Item name="quote_date" label="Quote Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="valid_until" label="Valid Until"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={4}><Form.Item name="salesperson" label="Salesperson"><Input /></Form.Item></Col>
          <Col span={4}><Form.Item name="payment_terms" label="Payment Terms"><Select options={PAYMENT_TERMS} /></Form.Item></Col>
        </Row>

        <Divider orientation="left" style={{ color: '#6366f1' }}>Glass Line Items</Divider>

        {groups.map(group => (
          <Card
            key={group.group_key}
            style={{ marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}
            bodyStyle={{ padding: '14px 16px' }}
          >
            {/* ── Row 1: Glass Attribute Selectors ── */}
            <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col flex="30px">
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 700 }}>{groups.indexOf(group) + 1}.</Text>
              </Col>
              <Col flex="110px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>THICKNESS</Text>
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
                    if (val === '__custom__') {
                      const raw = customSearchVal[`${group.group_key}_thickness`]
                      const num = parseFloat(raw)
                      if (!raw || isNaN(num)) return
                      try {
                        const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                        const existing = cfg.thicknesses || [3.5, 4, 5, 6, 8, 10, 12]
                        if (!existing.includes(num)) {
                          const updated = [...existing, num].sort((a, b) => a - b)
                          localStorage.setItem('glass_dropdown_config', JSON.stringify({ ...cfg, thicknesses: updated }))
                          message.success(`${num}mm added!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_thickness', num)
                      setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_thickness`]: '' }))
                      return
                    }
                    updateGroup(group.group_key, 'glass_thickness', val)
                  }}
                  onSearch={val => {
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_thickness`]: val }))
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
              <Col flex="130px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>TYPE</Text>
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
                  onSearch={val => {
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_type`]: val }))
                  }}
                  onChange={val => {
                    if (val === '__custom__') {
                      const raw = (customSearchVal[`${group.group_key}_type`] || '').trim()
                      if (!raw) return
                      try {
                        const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                        const existing = cfg.glass_types || ['Annealed', 'Toughened', 'Laminated', 'DGU']
                        if (!existing.includes(raw)) {
                          localStorage.setItem('glass_dropdown_config', JSON.stringify({ ...cfg, glass_types: [...existing, raw] }))
                          message.success(`"${raw}" added to types!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_type', raw)
                      setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_type`]: '' }))
                      return
                    }
                    updateGroup(group.group_key, 'glass_type', val)
                  }}
                  onInputKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim()
                      if (!val || val === '__custom__') return
                      try {
                        const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                        const existing = cfg.glass_types || ['Annealed', 'Toughened', 'Laminated', 'DGU']
                        if (!existing.includes(val)) {
                          localStorage.setItem('glass_dropdown_config', JSON.stringify({ ...cfg, glass_types: [...existing, val] }))
                          message.success(`"${val}" added to types!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_type', val)
                    }
                  }}
                />
              </Col>
              <Col flex="130px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>CATEGORY</Text>
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
                  onSearch={val => {
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_category`]: val }))
                  }}
                  onChange={val => {
                    if (val === '__custom__') {
                      const raw = (customSearchVal[`${group.group_key}_category`] || '').trim()
                      if (!raw) return
                      try {
                        const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                        const existing = cfg.categories || ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
                        if (!existing.includes(raw)) {
                          localStorage.setItem('glass_dropdown_config', JSON.stringify({ ...cfg, categories: [...existing, raw] }))
                          message.success(`"${raw}" added to categories!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_category', raw)
                      setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_category`]: '' }))
                      return
                    }
                    updateGroup(group.group_key, 'glass_category', val)
                  }}
                  onInputKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim()
                      if (!val || val === '__custom__') return
                      try {
                        const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                        const existing = cfg.categories || ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
                        if (!existing.includes(val)) {
                          localStorage.setItem('glass_dropdown_config', JSON.stringify({ ...cfg, categories: [...existing, val] }))
                          message.success(`"${val}" added to categories!`)
                        }
                      } catch { }
                      updateGroup(group.group_key, 'glass_category', val)
                    }
                  }}
                />
              </Col>
              <Col flex="auto">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>PRODUCT NAME</Text>
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
                  {group.description && group.glass_thickness && group.glass_category && group.glass_type && (
                    <Tooltip title="Save this product to Product Masters">
                      <Button
                        size="small"
                        type="dashed"
                        icon={<PlusOutlined />}
                        style={{ fontSize: 10, color: '#3b82f6', borderColor: '#3b82f6', padding: '0 6px', height: 20 }}
                        onClick={async () => {
                          try {
                            await productApi.create({
                              name: group.description,
                              glass_type: group.glass_type,
                              glass_category: group.glass_category,
                              thickness_mm: group.glass_thickness,
                              hsn_code: '7007',
                              sale_price: group.rate || 0,
                              cost_price: 0,
                              product_type: 'storable',
                              internal_ref: '',
                            })
                            message.success('Product added to Masters!')
                            queryClient.invalidateQueries({ queryKey: ['products-dd'] })
                          } catch (err) {
                            message.error('Failed to add product')
                          }
                        }}
                      >
                        + Save to Masters
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </Col>
              <Col flex="120px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>W CEILING</Text>
                <Select
                  size="small"
                  value={group.ceiling_w_inches ?? 6}
                  style={{ width: '100%' }}
                  options={CEILING_OPTIONS}
                  onChange={val => updateGroup(group.group_key, 'ceiling_w_inches', val)}
                />
              </Col>
              <Col flex="120px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>H CEILING</Text>
                <Select
                  size="small"
                  value={group.ceiling_h_inches ?? 6}
                  style={{ width: '100%' }}
                  options={CEILING_OPTIONS}
                  onChange={val => updateGroup(group.group_key, 'ceiling_h_inches', val)}
                />
              </Col>
            </Row>

            {/* ── Row 2: Rate, CEP, Total, Actions ── */}
            <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
              <Col flex="30px" />
              <Col flex="200px">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>RATE/SQFT</Text>
                  <Tooltip title={group.custom_costing ? 'Custom Rate' : 'Auto from Matrix'}>
                    <Switch
                      size="small"
                      checked={group.custom_costing}
                      checkedChildren="Custom"
                      unCheckedChildren="Auto ✓"
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
              <Col flex="220px">
                <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 }}>CEP (Polish)</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Switch
                    size="small"
                    checked={group.cep}
                    onChange={val => updateGroup(group.group_key, 'cep', val)}
                  />
                  {group.cep && (
                    <Select
                      size="small"
                      value={group.cep_polish_rate || 15}
                      style={{ width: 100 }}
                      options={[
                        { value: 7, label: '₹7/rft' },
                        { value: 10, label: '₹10/rft' },
                        { value: 15, label: '₹15/rft' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                      onChange={val =>
                        updateGroup(group.group_key, 'cep_polish_rate', val)
                      }
                    />
                  )}
                  {group.cep && group.cep_polish_rate === 'custom' && (
                    <InputNumber
                      size="small"
                      value={group.cep_polish_rate_custom || 15}
                      min={0}
                      prefix="₹"
                      style={{ width: 80 }}
                      onChange={val =>
                        updateGroup(group.group_key, 'cep_polish_rate_custom', val)
                      }
                    />
                  )}
                </div>
              </Col>
              <Col flex="auto" />
              <Col flex="none">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong style={{ color: '#059669', fontSize: 15, whiteSpace: 'nowrap' }}>
                    ₹{group.sizes
                      .reduce((s, x) => s + (x.subtotal || 0), 0)
                      .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <Tooltip title="Cost vs Selling">
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
                            '200px 80px 50px 110px 110px 110px 40px',
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
                          <div style={{ color: '#f59e0b' }}>Cost Rate</div>
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
                              '200px 80px 50px 110px 110px 110px 40px',
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
                          <InputNumber
                            size="small"
                            value={proc.cost_rate || 0}
                            min={0}
                            prefix="₹"
                            placeholder="Cost"
                            style={{ width: '100%', borderColor: '#f59e0b' }}
                            onChange={val =>
                              updateSizeProcess(
                                group.group_key, size.size_key,
                                proc.sproc_key, 'cost_rate', val
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
                {
                  title: '#', width: 30,
                  render: (_, __, i) => (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {String.fromCharCode(97 + i)}
                    </Text>
                  )
                },
                {
                  title: `Actual W (${unit === 'inch' ? 'inch' : 'mm'})`,
                  width: 110, dataIndex: 'width_inch',
                  render: (v, row) => unit === 'inch' ? (
                    <FractionInput
                      value={v}
                      onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val)}
                      placeholder="84 1/4"
                    />
                  ) : (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat((v * 25.4).toFixed(2)) : null}
                      min={0} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val ? val / 25.4 : null)}
                    />
                  )
                },
                {
                  title: `Actual H (${unit === 'inch' ? 'inch' : 'mm'})`,
                  width: 110, dataIndex: 'height_inch',
                  render: (v, row) => unit === 'inch' ? (
                    <FractionInput
                      value={v}
                      onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val)}
                      placeholder="48 1/2"
                    />
                  ) : (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat((v * 25.4).toFixed(2)) : null}
                      min={0} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val ? val / 25.4 : null)}
                    />
                  )
                },

                {
                  title: 'Qty', width: 60, dataIndex: 'quantity',
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={1} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'quantity', val)}
                    />
                  )
                },
                {
                  title: 'Chg W', width: 88, dataIndex: 'charged_w_inch',
                  render: (v, row) => (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat(v.toFixed(3)) : null}
                      min={0} step={0.5}
                      style={{ width: '100%', borderColor: '#f59e0b' }}
                      onChange={val => setGroups(prev => prev.map(g => {
                        if (g.group_key !== group.group_key) return g
                        return {
                          ...g,
                          sizes: g.sizes.map(s => {
                            if (s.size_key !== row.size_key) return s
                            const cW = val || 0
                            const cH = s.charged_h_inch || 0
                            const qty = s.quantity || 1
                            const charged_sqft = parseFloat(((cW * cH * qty) / 144).toFixed(4))
                            const eff = g.pricing_method === 'per_rft' ? s.running_ft
                              : g.pricing_method === 'per_piece' ? qty : charged_sqft
                            const sub = parseFloat((eff * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (s.cep_charges || 0)).toFixed(2))
                            return { ...s, charged_w_inch: val, charged_sqft, subtotal: sub }
                          })
                        }
                      }))}
                    />
                  )
                },
                {
                  title: 'Chg H', width: 88, dataIndex: 'charged_h_inch',
                  render: (v, row) => (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat(v.toFixed(3)) : null}
                      min={0} step={0.5}
                      style={{ width: '100%', borderColor: '#f59e0b' }}
                      onChange={val => setGroups(prev => prev.map(g => {
                        if (g.group_key !== group.group_key) return g
                        return {
                          ...g,
                          sizes: g.sizes.map(s => {
                            if (s.size_key !== row.size_key) return s
                            const cW = s.charged_w_inch || 0
                            const cH = val || 0
                            const qty = s.quantity || 1
                            const charged_sqft = parseFloat(((cW * cH * qty) / 144).toFixed(4))
                            const eff = g.pricing_method === 'per_rft' ? s.running_ft
                              : g.pricing_method === 'per_piece' ? qty : charged_sqft
                            const sub = parseFloat((eff * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (s.cep_charges || 0)).toFixed(2))
                            return { ...s, charged_h_inch: val, charged_sqft, subtotal: sub }
                          })
                        }
                      }))}
                    />
                  )
                },
                {
                  title: 'Sqft', width: 80, dataIndex: 'charged_sqft',
                  render: (v, row) => (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat(v.toFixed(3)) : null}
                      min={0} step={0.001} style={{ width: '100%' }}
                      onChange={val => setGroups(prev => prev.map(g => {
                        if (g.group_key !== group.group_key) return g
                        return {
                          ...g,
                          sizes: g.sizes.map(s => {
                            if (s.size_key !== row.size_key) return s
                            const charged_sqft = parseFloat((val || 0).toFixed(4))
                            const eff = g.pricing_method === 'per_rft' ? s.running_ft
                              : g.pricing_method === 'per_piece' ? (s.quantity || 1) : charged_sqft
                            const sub = parseFloat(
                              (eff * (g.rate || 0) *
                                (1 - (g.discount_pct || 0) / 100) +
                                (s.cep_charges || 0)).toFixed(2)
                            )
                            return { ...s, charged_sqft, subtotal: sub }
                          })
                        }
                      }))}
                    />
                  )
                },
                ...(group.cep ? [{
                  title: <span>CEP <Tag color="blue" style={{ fontSize: 9 }}>Polish</Tag></span>,
                  width: 90, dataIndex: 'cep_charges',
                  render: (v, row) => (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat(v.toFixed(2)) : 0}
                      min={0} prefix="₹"
                      style={{ width: '100%', borderColor: '#3b82f6' }}
                      onChange={val => setGroups(prev => prev.map(g => {
                        if (g.group_key !== group.group_key) return g
                        return {
                          ...g,
                          sizes: g.sizes.map(s => {
                            if (s.size_key !== row.size_key) return s
                            const sub = parseFloat(
                              ((s.total_sqft || 0) * (g.rate || 0) *
                                (1 - (g.discount_pct || 0) / 100) +
                                (val || 0)).toFixed(2)
                            )
                            return { ...s, cep_charges: val, subtotal: sub }
                          })
                        }
                      }))}
                    />
                  )
                }] : []),

                {
                  title: 'Amount', width: 110, dataIndex: 'subtotal', align: 'right',
                  render: (v, row) => (
                    <InputNumber
                      size="small"
                      value={v ? parseFloat(v.toFixed(2)) : 0}
                      min={0} prefix="₹" style={{ width: '100%' }}
                      onChange={val => setGroups(prev => prev.map(g => {
                        if (g.group_key !== group.group_key) return g
                        return {
                          ...g,
                          sizes: g.sizes.map(s =>
                            s.size_key !== row.size_key ? s : { ...s, subtotal: val }
                          )
                        }
                      }))}
                    />
                  )
                },
                {
                  title: '', width: 40,
                  render: (_, row) => (
                    <Button
                      size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => removeSize(group.group_key, row.size_key)}
                    />
                  )
                },
              ]}
              footer={() => (
                <Button
                  type="dashed" size="small" icon={<PlusOutlined />}
                  onClick={() => addSize(group.group_key)}
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
                <span>🗑️ Wastage</span>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Total: ₹{wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Space>
            }
            size="small"
            style={{ marginTop: 16, border: '1px solid #fecaca' }}
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
                  title: 'Qty (Sqft)', dataIndex: 'qty', width: 120,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} addonAfter="sqft"
                      style={{ width: '100%' }}
                      onChange={val => setWastageItems(prev =>
                        prev.map(w => w.wst_key !== row.wst_key ? w : {
                          ...w,
                          qty: val,
                          amount: parseFloat(((val || 0) * (w.rate || 0)).toFixed(2)),
                          cost_amount: parseFloat(((val || 0) * (w.cost_rate || 0)).toFixed(2)),
                        })
                      )}
                    />
                  )
                },
                {
                  title: 'Cost Rate', dataIndex: 'cost_rate', width: 130,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      addonAfter="/sqft"
                      style={{ width: '100%', borderColor: '#f59e0b' }}
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
                  title: 'Selling Rate', dataIndex: 'rate', width: 130,
                  render: (v, row) => (
                    <InputNumber
                      size="small" value={v} min={0} prefix="₹"
                      addonAfter="/sqft"
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

            <Collapse style={{ marginTop: 16 }}>
              {groups.map((group, gi) => {
                const groupSubtotal = group.sizes.reduce((s, x) => s + (x.subtotal || 0), 0)
                const prod = products.find(p => p.id === group.product_id)
                let costPerSqft = 0
                if (prod?.cost_price) {
                  costPerSqft = prod.cost_price
                } else if (group.glass_category && group.glass_thickness) {
                  try {
                    const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
                    const costRate = matrix?.cost_rates?.[group.glass_category]
                    if (costRate) costPerSqft = parseFloat(
                      (parseFloat(group.glass_thickness) * costRate / 10.764).toFixed(2)
                    )
                  } catch { }
                }
                if (!costPerSqft && group.rate > 0)
                  costPerSqft = parseFloat((group.rate * 0.70).toFixed(2))
                const groupSqft = group.sizes.reduce((s, x) => s + (x.total_sqft || 0), 0)
                const groupCost = groupSqft * costPerSqft
                const groupMarginAmt = groupSubtotal - groupCost
                const groupMarginPct = groupCost > 0
                  ? ((groupMarginAmt / groupCost) * 100).toFixed(2)
                  : '100'

                return (
                  <Collapse.Panel
                    key={gi}
                    header={
                      <Space>
                        <LineChartOutlined />
                        <span>{group.description || `Group ${gi + 1}`} — Margin Analysis</span>
                        <Tag color={
                          parseFloat(groupMarginPct) > 20 ? 'green' :
                            parseFloat(groupMarginPct) > 10 ? 'orange' : 'red'
                        }>
                          {groupMarginPct}%
                        </Tag>
                      </Space>
                    }
                  >
                    <Row justify="space-between">
                      <Col>Cost Price (₹/sqft)</Col>
                      <Col>{fmt(costPerSqft)}</Col>
                    </Row>
                    <Row justify="space-between">
                      <Col>Total Cost</Col>
                      <Col>{fmt(groupCost)}</Col>
                    </Row>
                    <Row justify="space-between">
                      <Col>Selling Price</Col>
                      <Col>{fmt(groupSubtotal)}</Col>
                    </Row>
                    <Divider style={{ margin: '8px 0' }} />
                    <Row justify="space-between">
                      <Col>Margin</Col>
                      <Col>
                        <span style={{
                          fontWeight: 'bold',
                          color: parseFloat(groupMarginPct) > 20 ? '#16a34a' :
                            parseFloat(groupMarginPct) > 10 ? '#f59e0b' : '#dc2626'
                        }}>
                          {fmt(groupMarginAmt)} ({groupMarginPct}%)
                        </span>
                      </Col>
                    </Row>
                  </Collapse.Panel>
                )
              })}
            </Collapse>
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
        </Row>
      </Form>



      <Modal
        title={
          <Space>
            <UploadOutlined style={{ color: '#0ea5e9' }} />
            <span>Excel Import Preview</span>
          </Space>
        }
        open={importPreview !== null}
        onCancel={() => setImportPreview(null)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setImportPreview(null)}>Cancel</Button>,
          <Button
            key="import"
            type="primary"
            style={{ background: '#0ea5e9', borderColor: '#0ea5e9' }}
            onClick={() => {
              setGroups(importPreview.groups)
              const matchedCustomer = customers.find(c =>
                c.name.toLowerCase().includes((importPreview.clientName || '').toLowerCase()) ||
                (importPreview.clientName || '').toLowerCase().includes(c.name.toLowerCase())
              )
              if (matchedCustomer) form.setFieldValue('customer_id', matchedCustomer.id)
              message.success(`Imported ${importPreview.totalItems} sizes across ${importPreview.totalProducts} products!`)
              setImportPreview(null)
            }}
          >
            Import {importPreview?.totalItems} Items
          </Button>
        ]}
      >
        {importPreview && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              {importPreview.orderNo && (
                <Col span={12}>
                  <Text type="secondary">Order No: </Text>
                  <Text strong>{importPreview.orderNo}</Text>
                </Col>
              )}
              {importPreview.clientName && (
                <Col span={12}>
                  <Text type="secondary">Client: </Text>
                  <Text strong>{importPreview.clientName}</Text>
                </Col>
              )}
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f0fdf4' }}>
                  <Text type="secondary">Products Found</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>
                    {importPreview.totalProducts}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#eff6ff' }}>
                  <Text type="secondary">Total Sizes</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8' }}>
                    {importPreview.totalItems}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff7ed' }}>
                  <Text type="secondary">Est. Total (₹)</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ea580c' }}>
                    ₹{importPreview.groups
                      .flatMap(g => g.sizes)
                      .reduce((s, sz) => s + (sz.subtotal || 0), 0)
                      .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </Card>
              </Col>
            </Row>

            <Collapse size="small">
              {importPreview.groups.map((g, gi) => (
                <Collapse.Panel
                  key={gi}
                  header={
                    <Space>
                      <Tag color="blue">{gi + 1}</Tag>
                      <Text strong>{g.description}</Text>
                      <Tag>{g.sizes.length} sizes</Tag>
                      <Tag color="green">₹{g.rate}/sqft</Tag>
                      {g.cep && <Tag color="orange">CEP</Tag>}
                    </Space>
                  }
                >
                  {g.sizes.map((s, si) => (
                    <div key={si} style={{ fontSize: 12, marginBottom: 4 }}>
                      {String.fromCharCode(97 + si)}.{' '}
                      {unit === 'inch' ? `${toFraction(s.width_inch)}"` : `${(s.width_inch * 25.4).toFixed(1)}mm`}
                      {' × '}
                      {unit === 'inch' ? `${toFraction(s.height_inch)}"` : `${(s.height_inch * 25.4).toFixed(1)}mm`}
                      {' × '}{s.quantity} pcs
                      {' = '}
                      <Text strong>
                        {s.total_sqft?.toFixed(3)} sqft
                      </Text>
                      {' → '}
                      <Text strong style={{ color: '#059669' }}>
                        ₹{(s.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                  ))}
                </Collapse.Panel>
              ))}
            </Collapse>
          </>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <LineChartOutlined style={{ color: '#6366f1' }} />
            <span>Cost vs Selling — {compWizard?.product_name}</span>
          </Space>
        }
        open={compWizard !== null}
        onCancel={() => {
          setCompWizard(null)
          setWizardCostPrice(null)
        }}
        footer={
          <Space>
            <Button
              style={{ borderColor: '#10b981', color: '#10b981' }}
              disabled={!wizardCostPrice || wizardCostPrice <= 0}
              onClick={() => {
                if (compWizard?.group_key && wizardCostPrice > 0) {
                  updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice)
                  message.success(`Cost price ₹${wizardCostPrice}/sqft saved — selling rate unchanged`)
                }
                setCompWizard(null)
                setWizardCostPrice(null)
              }}
            >
              💾 Save Cost Price
            </Button>
            <Button
              type="primary"
              style={{ background: '#6366f1', borderColor: '#6366f1' }}
              disabled={!wizardCostPrice || wizardCostPrice <= 0}
              onClick={() => {
                if (compWizard?.group_key && wizardCostPrice > 0) {
                  const currentMarginPct = compWizard.totalMarginPct || 20
                  const divisor = 1 - currentMarginPct / 100
                  const newRate = divisor > 0
                    ? parseFloat((wizardCostPrice / divisor).toFixed(2))
                    : wizardCostPrice
                  updateGroup(compWizard.group_key, 'custom_costing', true)
                  updateGroup(compWizard.group_key, 'rate', newRate)
                  updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice)
                  message.success(
                    `Rate updated to ₹${newRate}/sqft based on cost ₹${wizardCostPrice}/sqft`
                  )
                }
                setCompWizard(null)
                setWizardCostPrice(null)
              }}
            >
              💾 Apply New Rate
            </Button>
            <Button onClick={() => {
              setCompWizard(null)
              setWizardCostPrice(null)
            }}>
              Close
            </Button>
          </Space>
        }
        width={820}
      >
        {compWizard && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: '#f0fdf4', borderColor: '#86efac' }}
                >
                  <Text type="secondary">Selling Rate</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
                    ₹{compWizard.selling_rate}/sqft
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
                >
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
                        const newCost = val || 0
                        const newRows = compWizard.rows.map(r => {
                          const glass_cost = parseFloat(
                            ((r.cost_charged_w && r.cost_charged_h
                              ? (r.cost_charged_w * r.cost_charged_h * r.quantity) / 144
                              : parseFloat(r.charged_sqft)) * newCost).toFixed(2)
                          )
                          const cost_amount = parseFloat(
                            (glass_cost + (r.cep_cost || 0)).toFixed(2)
                          )
                          const margin_amount = parseFloat(
                            (r.selling_amount - cost_amount).toFixed(2)
                          )
                          const margin_pct = cost_amount > 0
                            ? parseFloat(
                              ((margin_amount / cost_amount) * 100).toFixed(2)
                            )
                            : 100
                          return { ...r, glass_cost, cost_amount, margin_amount, margin_pct }
                        })
                        const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0)
                        const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0)
                        const totalMargin = compWizard.totalSelling - totalCost
                        const totalMarginPct = totalCost > 0
                          ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2))
                          : 100
                        setCompWizard(prev => ({
                          ...prev,
                          // DO NOT update cost_price here — keeps original auto-calc
                          rows: newRows,
                          totalCost,
                          totalCepCost,
                          totalMargin,
                          totalMarginPct,
                        }))
                      }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                    Edit to recalculate margin live
                  </Text>
                </Card>
              </Col>
            </Row>

            {compWizard.cep_on && (
              <div style={{
                background: '#f5f3ff', border: '1px solid #ddd6fe',
                borderRadius: 8, padding: '8px 14px', marginBottom: 12,
                fontSize: 12, color: '#6d28d9',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
              }}>
                🔵 <strong>CEP (Polish - 4 sides)</strong> cost:
                <Select
                  size="small"
                  value={compWizard.cep_cost_rate}
                  style={{ width: 110 }}
                  options={[
                    { value: 5, label: '₹5/rft' },
                    { value: 7, label: '₹7/rft' },
                    { value: 15, label: '₹15/rft' },
                  ]}
                  onChange={val => {
                    const newRows = compWizard.rows.map(r => {
                      const cep_cost = parseFloat((parseFloat(r.actual_rft) * val).toFixed(2))
                      const cost_amount = parseFloat((r.glass_cost + cep_cost).toFixed(2))
                      const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2))
                      const margin_pct = cost_amount > 0
                        ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100
                      return { ...r, cep_cost, cost_amount, margin_amount, margin_pct }
                    })
                    const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0)
                    const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0)
                    const totalMargin = compWizard.totalSelling - totalCost
                    const totalMarginPct = totalCost > 0
                      ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                    setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cep_cost_rate: val }))
                  }}
                />
                <Text style={{ color: '#6d28d9', fontSize: 12 }}>× Actual running ft per size</Text>
              </div>
            )}

            <Table
              dataSource={compWizard.rows}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Size', key: 'size', width: 130,
                  render: (_, r) => (
                    <Text strong style={{ fontSize: 12 }}>
                      {r.label}. {r.width_display} × {r.height_display}
                    </Text>
                  )
                },
                { title: 'Qty', dataIndex: 'quantity', width: 45 },
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
                  title: 'Cost Chg W', key: 'cost_chg_w', width: 110, align: 'center',
                  render: (_, r) => {
                    const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : Math.ceil(x / c) * c
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Select
                          size="small"
                          value={r.cost_ceil_w}
                          style={{ width: '100%' }}
                          options={[
                            { value: 3, label: '3" (Tight)' },
                            { value: 6, label: '6" (Standard)' },
                            { value: 'plus30mm', label: '+30mm' },
                          ]}
                          onChange={val => {
                            const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                            setCompWizard(prev => {
                              const newRows = prev.rows.map(row => {
                                if (row.key !== r.key) return row
                                const cost_charged_w = parseFloat(costCeilFn(row._w_raw || 0, val).toFixed(4))
                                const cost_charged_h = row.cost_charged_h || 0
                                const qty = row.quantity || 1
                                const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144
                                const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2))
                                const cep_cost = parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2))
                                const cost_amount = parseFloat((glass_cost + cep_cost).toFixed(2))
                                const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2))
                                const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100
                                return { ...row, cost_ceil_w: val, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct }
                              })
                              const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0)
                              const totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0)
                              const totalMargin = prev.totalSelling - totalCost
                              const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                              return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct }
                            })
                            if (r._group_key) updateGroup(r._group_key, 'wizard_cost_ceil_w', val)
                          }}
                        />
                        <Text style={{ fontSize: 10, color: '#6366f1', textAlign: 'center' }}>
                          {r.cost_charged_w ? parseFloat(r.cost_charged_w.toFixed(3)) : '—'}
                        </Text>
                      </div>
                    )
                  }
                },
                {
                  title: 'Cost Chg H', key: 'cost_chg_h', width: 110, align: 'center',
                  render: (_, r) => {
                    const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : Math.ceil(x / c) * c
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Select
                          size="small"
                          value={r.cost_ceil_h}
                          style={{ width: '100%' }}
                          options={[
                            { value: 3, label: '3" (Tight)' },
                            { value: 6, label: '6" (Standard)' },
                            { value: 'plus30mm', label: '+30mm' },
                          ]}
                          onChange={val => {
                            const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                            setCompWizard(prev => {
                              const newRows = prev.rows.map(row => {
                                if (row.key !== r.key) return row
                                const cost_charged_w = row.cost_charged_w || 0
                                const cost_charged_h = parseFloat(costCeilFn(row._h_raw || 0, val).toFixed(4))
                                const qty = row.quantity || 1
                                const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144
                                const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2))
                                const cep_cost = parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2))
                                const cost_amount = parseFloat((glass_cost + cep_cost).toFixed(2))
                                const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2))
                                const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100
                                return { ...row, cost_ceil_h: val, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct }
                              })
                              const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0)
                              const totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0)
                              const totalMargin = prev.totalSelling - totalCost
                              const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                              return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct }
                            })
                            if (r._group_key) updateGroup(r._group_key, 'wizard_cost_ceil_h', val)
                          }}
                        />
                        <Text style={{ fontSize: 10, color: '#6366f1', textAlign: 'center' }}>
                          {r.cost_charged_h ? parseFloat(r.cost_charged_h.toFixed(3)) : '—'}
                        </Text>
                      </div>
                    )
                  }
                },
                {
                  title: 'Selling Amt', dataIndex: 'selling_amount', width: 100, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#16a34a' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: 'Glass Cost', dataIndex: 'glass_cost', width: 100, align: 'right',
                  render: v => (
                    <Text style={{ color: '#ea580c' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                ...(compWizard.cep_on ? [{
                  title: (
                    <span>
                      CEP Cost<br />
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>
                        Rft × ₹{compWizard.cep_cost_rate}
                      </Text>
                    </span>
                  ),
                  dataIndex: 'cep_cost', width: 100, align: 'right',
                  render: v => (
                    <Text style={{ color: '#7c3aed' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                }] : []),
                {
                  title: 'Total Cost', dataIndex: 'cost_amount', width: 100, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#dc2626' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: 'Margin', dataIndex: 'margin_amount', width: 120, align: 'right',
                  render: (v, r) => (
                    <Text strong style={{
                      color: r.margin_pct >= 20 ? '#16a34a' :
                        r.margin_pct >= 10 ? '#f59e0b' : '#dc2626'
                    }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <br />
                      <Text style={{ fontSize: 11, color: 'inherit' }}>
                        ({r.margin_pct}%)
                      </Text>
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

      <Modal
        title={
          <Space>
            <LineChartOutlined style={{ color: '#6366f1' }} />
            <span>Cost vs Selling — Full Quotation Analysis</span>
          </Space>
        }
        open={globalComparison !== null}
        onCancel={() => setGlobalComparison(null)}
        footer={
          <Button onClick={() => setGlobalComparison(null)}>Close</Button>
        }
        width={1050}
      >
        {globalComparison && (
          <>
            {/* Margin Target Panel */}
            <div style={{
              background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <Text strong style={{ color: '#4338ca' }}>🎯 Target Margin:</Text>
              <InputNumber
                value={marginTarget} min={0} max={99} placeholder="e.g. 20"
                addonAfter="%" style={{ width: 150 }}
                onChange={val => setMarginTarget(val > 99 ? 99 : val)} />
              {marginTarget > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  New Rate = Cost ÷ (1 - {marginTarget}/100) &nbsp;|&nbsp; CEP & Process charges unchanged
                </Text>
              )}
              {marginTarget > 0 && (
                <Button
                  type="primary"
                  style={{ background: '#6366f1', borderColor: '#6366f1' }}
                  onClick={() => {
                    if (!marginTarget || marginTarget <= 0 || marginTarget >= 100) {
                      message.error('Target margin must be between 1% and 99%')
                      return
                    }
                    setGroups(prev => prev.map((g, gi) => {
                      // Use cost_per_sqft directly from the already-displayed allRows
                      // instead of re-fetching from master — stays consistent with what user sees
                      const matchingRow = globalComparison.allRows.find(
                        r => r.group_no === gi + 1 && r.is_first_in_group
                      )
                      const costPerSqft = matchingRow?.cost_per_sqft || 0
                      if (!costPerSqft) return g
                      const newRate = parseFloat((costPerSqft / (1 - marginTarget / 100)).toFixed(2))
                      const updatedGroup = { ...g, rate: newRate, manual_cost_price: costPerSqft }
                      updatedGroup.sizes = g.sizes.map(s => calcGroupSize(updatedGroup, s))
                      return updatedGroup
                    }))
                    message.success(`Quote updated with ${marginTarget}% margin target!`)
                    setGlobalComparison(null)
                    setMarginTarget(null)
                  }}
                >
                  ✓ Update Quote
                </Button>
              )}
            </div>

            <Table
              dataSource={globalComparison.allRows}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              rowClassName={(record) =>
                record.group_no % 2 === 0 ? 'row-group-even' : 'row-group-odd'
              }
              onRow={(record) => ({
                style: record.is_first_in_group ? { borderTop: '2px solid #6366f1' } : {}
              })}
              columns={[
                {
                  title: '#', key: 'group_no', width: 180,
                  render: (_, r) => r.is_first_in_group ? (
                    <Text strong style={{ color: '#6366f1', fontSize: 12 }}>
                      {r.group_no}) {r.group_name}
                    </Text>
                  ) : null,
                },
                {
                  title: 'Size', key: 'size', width: 140,
                  render: (_, r) => (
                    <Text style={{ fontSize: 12 }}>
                      {r.size_label}. {r.width_display} × {r.height_display}
                    </Text>
                  )
                },
                { title: 'Qty', dataIndex: 'quantity', width: 45, align: 'center' },
                {
                  title: 'Charged Sqft', dataIndex: 'selling_rate', width: 90, align: 'right',
                  render: v => `₹${v}/sqft`
                },
                {
                  title: 'Cost Rate', dataIndex: 'cost_per_sqft', width: 90, align: 'right',
                  render: v => <Text style={{ color: '#ea580c' }}>₹{v}/sqft</Text>
                },
                {
                  title: 'Selling Amt', dataIndex: 'selling_amount', width: 110, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#16a34a' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: 'Cost Amt', dataIndex: 'cost_amount', width: 110, align: 'right',
                  render: v => (
                    <Text strong style={{ color: '#dc2626' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )
                },
                {
                  title: 'Margin', dataIndex: 'margin_amount', width: 130, align: 'right',
                  render: (v, r) => (
                    <Text strong style={{ color: r.margin_pct >= 20 ? '#16a34a' : r.margin_pct >= 10 ? '#f59e0b' : '#dc2626' }}>
                      ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      <br />
                      <span style={{ fontSize: 11 }}>({r.margin_pct}%)</span>
                    </Text>
                  )
                },
                ...(marginTarget > 0 ? [
                  {
                    title: (
                      <span style={{ color: '#6366f1' }}>
                        New Rate<br />
                        <Text type="secondary" style={{ fontSize: 10 }}>@ {marginTarget}% margin</Text>
                      </span>
                    ),
                    key: 'new_rate', width: 110, align: 'right',
                    render: (_, r) => {
                      if (!marginTarget || marginTarget >= 100) return <Text type="secondary">—</Text>
                      const divisor = 1 - marginTarget / 100
                      if (divisor <= 0) return <Text type="secondary">—</Text>
                      const newRate = r.cost_per_sqft > 0
                        ? parseFloat((r.cost_per_sqft / divisor).toFixed(2))
                        : r.selling_rate
                      return <Text strong style={{ color: '#6366f1' }}>₹{newRate}/sqft</Text>
                    }
                  },
                  {
                    title: (
                      <span style={{ color: '#6366f1' }}>
                        New Amount<br />
                        <Text type="secondary" style={{ fontSize: 10 }}>@ {marginTarget}% margin</Text>
                      </span>
                    ),
                    key: 'new_amount', width: 120, align: 'right',
                    render: (_, r) => {
                      if (!marginTarget || marginTarget >= 100) return <Text type="secondary">—</Text>
                      const divisor = 1 - marginTarget / 100
                      if (divisor <= 0) return <Text type="secondary">—</Text>
                      const newRate = r.cost_per_sqft > 0
                        ? parseFloat((r.cost_per_sqft / divisor).toFixed(2))
                        : r.selling_rate
                      const newAmount = parseFloat((parseFloat(r.selling_sqft) * newRate).toFixed(2))
                      return (
                        <Text strong style={{ color: '#0ea5e9' }}>
                          ₹{newAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      )
                    }
                  }
                ] : []),
              ]}

              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row
                    style={{ background: '#f0f4ff', fontWeight: 700 }}
                  >
                    <Table.Summary.Cell colSpan={5}>
                      <Text strong>GRAND TOTAL</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell align="right">
                      <Text strong style={{ color: '#16a34a' }}>
                        ₹{globalComparison.totalSelling.toLocaleString(
                          'en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell align="right">
                      <Text strong style={{ color: '#dc2626' }}>
                        ₹{globalComparison.totalCost.toLocaleString(
                          'en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell align="right">
                      <Text strong style={{
                        fontSize: 14,
                        color: globalComparison.totalMarginPct >= 20
                          ? '#16a34a'
                          : globalComparison.totalMarginPct >= 10
                            ? '#f59e0b'
                            : '#dc2626'
                      }}>
                        ₹{globalComparison.totalMargin.toLocaleString(
                          'en-IN', { minimumFractionDigits: 2 })}
                        <br />
                        <span style={{ fontSize: 13 }}>
                          ({globalComparison.totalMarginPct}%)
                        </span>
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />

            {/* Hardware & Labor Breakdown */}
            {(hardwareItems.length > 0 || laborItems.length > 0) && (
              <div style={{ marginTop: 20 }}>
                <Divider orientation="left">
                  <Text strong style={{ fontSize: 13, color: '#6366f1' }}>
                    🛠️ Hardware & Labor Costing Breakdown
                  </Text>
                </Divider>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={[
                    ...hardwareItems.map(h => ({
                      key: h.hw_key,
                      type: 'Hardware',
                      description: h.description || '(No description)',
                      qty: h.qty || 0,
                      uom: h.uom || '—',
                      cost_rate: h.cost_rate || 0,
                      selling_rate: h.rate || 0,
                      cost_amount: h.cost_amount || (h.qty || 0) * (h.cost_rate || 0),
                      selling_amount: h.amount || (h.qty || 0) * (h.rate || 0),
                    })),
                    ...laborItems.map(l => ({
                      key: l.lb_key,
                      type: 'Labor',
                      description: l.description || '(No description)',
                      qty: l.qty || 0,
                      uom: l.uom || '—',
                      cost_rate: l.cost_rate || 0,
                      selling_rate: l.rate || 0,
                      cost_amount: l.cost_amount || (l.qty || 0) * (l.cost_rate || 0),
                      selling_amount: l.amount || (l.qty || 0) * (l.rate || 0),
                    })),
                    ...wastageItems.map(w => ({
                      key: w.wst_key,
                      type: 'Wastage',
                      description: w.description || '(No description)',
                      qty: w.qty || 0,
                      uom: 'sqft',
                      cost_rate: w.cost_rate || 0,
                      selling_rate: w.rate || 0,
                      cost_amount: w.cost_amount || (w.qty || 0) * (w.cost_rate || 0),
                      selling_amount: w.amount || (w.qty || 0) * (w.rate || 0),
                    })),
                    ...(totals.dcCharges > 0 || totals.dcCost > 0 ? [{
                      key: 'dc_charges',
                      type: 'DC',
                      description: 'Delivery / Transport Charges',
                      qty: 1,
                      uom: 'fixed',
                      cost_rate: totals.dcCost || 0,
                      selling_rate: totals.dcCharges || 0,
                      cost_amount: totals.dcCost || 0,
                      selling_amount: totals.dcCharges || 0,
                    }] : []),
                  ]}
                  columns={[
                    {
                      title: 'Type', dataIndex: 'type', width: 100,
                      render: t => (
                        <Tag color={
                          t === 'Hardware' ? 'blue' :
                            t === 'Labor' ? 'orange' :
                              t === 'Wastage' ? 'red' :
                                t === 'DC' ? 'purple' : 'default'
                        }>{t}</Tag>
                      )
                    },
                    { title: 'Description', dataIndex: 'description' },
                    { title: 'Qty', dataIndex: 'qty', width: 60, align: 'right' },
                    { title: 'UOM', dataIndex: 'uom', width: 70 },
                    {
                      title: 'Cost Rate', dataIndex: 'cost_rate', width: 100, align: 'right',
                      render: v => <Text style={{ color: '#f59e0b' }}>₹{Number(v).toFixed(2)}</Text>
                    },
                    {
                      title: 'Selling Rate', dataIndex: 'selling_rate', width: 100, align: 'right',
                      render: v => <Text style={{ color: '#10b981' }}>₹{Number(v).toFixed(2)}</Text>
                    },
                    {
                      title: 'Cost Amt', dataIndex: 'cost_amount', width: 110, align: 'right',
                      render: v => (
                        <Text strong style={{ color: '#dc2626' }}>
                          ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      )
                    },
                    {
                      title: 'Selling Amt', dataIndex: 'selling_amount', width: 110, align: 'right',
                      render: v => (
                        <Text strong style={{ color: '#16a34a' }}>
                          ₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      )
                    },
                    {
                      title: 'Margin', width: 130, align: 'right',
                      render: (_, r) => {
                        const margin = r.selling_amount - r.cost_amount
                        const pct = r.cost_amount > 0
                          ? ((margin / r.cost_amount) * 100).toFixed(1)
                          : '100'
                        return (
                          <Text strong style={{ color: margin >= 0 ? '#16a34a' : '#dc2626' }}>
                            ₹{margin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <br />
                            <span style={{ fontSize: 10 }}>({pct}%)</span>
                          </Text>
                        )
                      }
                    }
                  ]}
                  summary={() => {
                    const hwSell = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)
                    const hwCost = hardwareItems.reduce((s, h) => s + (h.cost_amount || (h.qty || 0) * (h.cost_rate || 0)), 0)
                    const lbSell = laborItems.reduce((s, l) => s + (l.amount || 0), 0)
                    const lbCost = laborItems.reduce((s, l) => s + (l.cost_amount || (l.qty || 0) * (l.cost_rate || 0)), 0)
                    const wstSell = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
                    const wstCost = wastageItems.reduce((s, w) => s + (w.cost_amount || (w.qty || 0) * (w.cost_rate || 0)), 0)
                    const totalHwLbSell = hwSell + lbSell + wstSell
                    const totalHwLbCost = hwCost + lbCost + wstCost
                    const totalHwLbMargin = totalHwLbSell - totalHwLbCost
                    const totalHwLbPct = totalHwLbCost > 0
                      ? ((totalHwLbMargin / totalHwLbCost) * 100).toFixed(1)
                      : '100'
                    return (
                      <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
                        <Table.Summary.Cell colSpan={6}>
                          <Text strong>HW + Labor + Wastage Subtotal</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell align="right">
                          <Text strong style={{ color: '#dc2626' }}>
                            ₹{totalHwLbCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell align="right">
                          <Text strong style={{ color: '#16a34a' }}>
                            ₹{totalHwLbSell.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell align="right">
                          <Text strong style={{ color: totalHwLbMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                            ₹{totalHwLbMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <br />
                            <span style={{ fontSize: 10 }}>({totalHwLbPct}%)</span>
                          </Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )
                  }}
                />
              </div>
            )}

            {/* Grand Total Breakdown interleaved div */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11, fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                <span style={{ flex: 1 }}>Grand Total Breakdown</span>
                <span style={{ minWidth: 90, textAlign: 'right' }}>Selling</span>
                <span style={{ minWidth: 90, textAlign: 'right' }}>Cost</span>
              </div>
              {(() => {
                const ceil3 = x => Math.ceil(x / 3) * 3
                const rows = []

                // 1) Glass group rows and their processes
                groups.forEach((group, gi) => {
                  const sell = group.sizes?.reduce((s, x) => s + (x.subtotal || 0), 0) || 0

                  // Cost price lookup logic
                  let costPerSqft = 0
                  if (group.manual_cost_price && group.manual_cost_price > 0) {
                    costPerSqft = group.manual_cost_price
                  } else {
                    const prod = products.find(p => p.id === group.product_id)
                    if (prod?.cost_price) {
                      costPerSqft = prod.cost_price
                    } else if (group.glass_category && group.glass_thickness) {
                      try {
                        const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
                        const costRate = matrix?.cost_rates?.[group.glass_category]
                        if (costRate) costPerSqft = parseFloat((parseFloat(group.glass_thickness) * costRate / 10.764).toFixed(2))
                      } catch { }
                    }
                    if (!costPerSqft && (group.base_glass_rate || group.rate) > 0) {
                      costPerSqft = parseFloat(((group.base_glass_rate || group.rate) * 0.70).toFixed(2))
                    }
                    if (group.is_toughened || group.glass_type === 'Toughened') {
                      try {
                        const tghPm = JSON.parse(localStorage.getItem('process_masters') || '[]')
                        const toughProc = tghPm.find(p => p.process_type === 'toughening' && p.is_active !== false)
                        if (toughProc && toughProc.rate > 0) {
                          const avgAddon = group.sizes.length > 0
                            ? group.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / group.sizes.length
                            : 0
                          if (avgAddon > 0) costPerSqft = parseFloat((costPerSqft + avgAddon).toFixed(2))
                        }
                      } catch { }
                    }
                  }

                  const cost = group.sizes?.reduce((s, sz) => {
                    const w = sz.width_inch || 0
                    const h = sz.height_inch || 0
                    const qty = sz.quantity || 1
                    const charged_sqft = (ceil3(w) * ceil3(h) * qty) / 144
                    const glass_cost = charged_sqft * costPerSqft
                    const actual_rft = ((w + h) * 2 / 12 * qty)
                    const cep_cost = group.cep ? (actual_rft * 5) : 0
                    return s + glass_cost + cep_cost
                  }, 0) || 0

                  rows.push(
                    <div key={`group-${gi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>{gi + 1}) {group.description || `Group ${gi + 1}`}</span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(sell).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )

                  // Process rows
                  const processes = [
                    ...(group.processes || []),
                    ...(group.sizes?.flatMap(s => s.size_processes || []) || [])
                  ]
                  processes.forEach((p, pi) => {
                    if (p.amount > 0) {
                      rows.push(
                        <div key={`proc-${gi}-${pi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, color: '#6366f1', paddingLeft: 20, borderLeft: '2px solid #e9d5ff', marginLeft: 8 }}>
                          <span style={{ flex: 1 }}>└ {p.process_name || p.name || 'Process'}</span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(p.amount * 0.70).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    }
                  })
                })

                // 2) Hardware rows
                hardwareItems.forEach((h, hi) => {
                  const sell = h.amount || 0
                  const cost = h.cost_amount || (h.qty * h.cost_rate) || 0
                  rows.push(
                    <div key={`hw-${hi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>
                        <span style={{ color: '#6b7280', fontSize: 11, marginRight: 6 }}>[HW]</span>
                        {h.description || '(No description)'}
                      </span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(sell).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                })

                // 3) Labor rows
                laborItems.forEach((l, li) => {
                  const sell = l.amount || 0
                  const cost = l.cost_amount || (l.qty * l.cost_rate) || 0
                  rows.push(
                    <div key={`labor-${li}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>
                        <span style={{ color: '#6b7280', fontSize: 11, marginRight: 6 }}>[Labor]</span>
                        {l.description || '(No description)'}
                      </span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(sell).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                })

                // 4) Wastage rows
                wastageItems.forEach((w, wi) => {
                  const sell = w.amount || 0
                  const cost = w.cost_amount || (w.qty * w.cost_rate) || 0
                  rows.push(
                    <div key={`wastage-${wi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>
                        <span style={{ color: '#6b7280', fontSize: 11, marginRight: 6 }}>[Wastage]</span>
                        {w.description || '(No description)'}
                      </span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(sell).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                })

                // 5) DC Charges row
                if (totals.dcCharges > 0 || totals.dcCost > 0) {
                  rows.push(
                    <div key="dc-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>D/C Charges</span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(totals.dcCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(totals.dcCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                }

                // 6) GST row
                if (globalComparison.gstAmt > 0) {
                  rows.push(
                    <div key="gst-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>GST (18%)</span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(globalComparison.gstAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(globalComparison.costGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                }

                return rows
              })()}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 13 }}>
                <span style={{ flex: 1 }}>
                  Grand Total (incl. GST) &nbsp;
                  <span style={{
                    color: globalComparison.totalMarginPct >= 20 ? '#16a34a' :
                           globalComparison.totalMarginPct >= 10 ? '#f59e0b' : '#dc2626',
                    fontSize: 11,
                    fontWeight: 'normal'
                  }}>
                    (Margin: ₹{Number(globalComparison.totalMargin).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | {globalComparison.totalMarginPct}%)
                  </span>
                </span>
                <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(globalComparison.totalSelling).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(globalComparison.totalCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Dark background True Margin panel */}
            <div style={{
              marginTop: 12,
              background: '#0f172a',
              borderRadius: 8,
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}>
              {(() => {
                const hwSell = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)
                const hwCost = hardwareItems.reduce((s, h) => s + (h.cost_amount || (h.qty || 0) * (h.cost_rate || 0)), 0)
                const lbSell = laborItems.reduce((s, l) => s + (l.amount || 0), 0)
                const lbCost = laborItems.reduce((s, l) => s + (l.cost_amount || (l.qty || 0) * (l.cost_rate || 0)), 0)
                const wstSell = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
                const wstCost = wastageItems.reduce((s, w) => s + (w.cost_amount || (w.qty || 0) * (w.cost_rate || 0)), 0)
                const trueSell = globalComparison.totalSelling + hwSell + lbSell + wstSell
                const trueCost = globalComparison.totalCost + hwCost + lbCost + wstCost
                const trueMargin = trueSell - trueCost
                const truePct = trueCost > 0
                  ? ((trueMargin / trueCost) * 100).toFixed(2)
                  : '100'
                const color = parseFloat(truePct) >= 20 ? '#4ade80'
                  : parseFloat(truePct) >= 10 ? '#fbbf24' : '#f87171'
                return (
                  <>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Total Selling</div>
                      <div style={{ color: '#4ade80', fontSize: 16, fontWeight: 700 }}>
                        ₹{trueSell.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Glass + HW + Labor + Wastage</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Total Cost</div>
                      <div style={{ color: '#f87171', fontSize: 16, fontWeight: 700 }}>
                        ₹{trueCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Glass + HW + Labor</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Margin</div>
                      <div style={{ color, fontSize: 16, fontWeight: 700 }}>
                        ₹{trueMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Margin %</div>
                      <div style={{ color, fontSize: 28, fontWeight: 800 }}>
                        {truePct}%
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </>
        )}
      </Modal>

    </MasterForm>
  )
}

export default QuotationForm
