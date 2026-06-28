import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, App, Collapse, Checkbox, Typography, Radio, Tooltip, Modal, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, DownloadOutlined, LineChartOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import MasterForm from '../../components/common/MasterForm'
import { quotationApi, customerApi, productApi, salesOrderApi, processMasterApi, employeeApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'
import CompanySelector from '../../components/common/CompanySelector'

// Import modular components
import FractionInput, { toFraction } from './components/FractionInput'
import ActionToolbar from './components/ActionToolbar'
import QuotationDetailsCard from './components/QuotationDetailsCard'
import GlassCard from './components/GlassCard'
import HardwareCard from './components/HardwareCard'
import LabourCard from './components/LabourCard'
import WastageCard from './components/WastageCard'
import StickySummary from './components/StickySummary'
import NotesCard from './components/NotesCard'
import CostAnalysisCard from './components/CostAnalysisCard'

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
  wizard_cep_cost_rate: 5,
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



// Extracted local sub-components have been moved to separate files under ./components/


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

  const { data: employeesData } = useQuery({
    queryKey: ['employees-dd'],
    queryFn: () => employeeApi.dropdown().then(r => r.data)
  })
  const employees = Array.isArray(employeesData) ? employeesData : (employeesData?.items || [])

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
          wizard_cost_ceil_w: line.wizard_cost_ceil_w || 3,
          wizard_cost_ceil_h: line.wizard_cost_ceil_h || 3,
          wizard_cep_cost_rate: line.wizard_cep_cost_rate || 5,

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
          reconstructed.forEach((g, idx) => {
            const saved = record.groups[idx]  // match by INDEX not description
            if (saved?.manual_cost_price) g.manual_cost_price = saved.manual_cost_price
            if (saved?.wizard_cost_ceil_w) g.wizard_cost_ceil_w = saved.wizard_cost_ceil_w
            if (saved?.wizard_cost_ceil_h) g.wizard_cost_ceil_h = saved.wizard_cost_ceil_h
            if (saved?.wizard_cep_cost_rate) g.wizard_cep_cost_rate = saved.wizard_cep_cost_rate
            if (saved?.target_margin) g.target_margin = saved.target_margin
          })
        }
        reconstructed.forEach(g => {
          g.sizes = g.sizes.map(s => calcGroupSize(g, s))
        })
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

  const getGroupBaseCostRate = (g, products) => {
    let costPerSqft = g.manual_cost_price || 0
    if (!costPerSqft) {
      const prod = products.find(p => p.id === g.product_id)
      if (prod?.cost_price) {
        costPerSqft = prod.cost_price
      } else if (g.glass_category && g.glass_thickness) {
        try {
          const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
          const costRate = matrix?.cost_rates?.[g.glass_category]
          if (costRate) costPerSqft = parseFloat((parseFloat(g.glass_thickness) * costRate / 10.764).toFixed(2))
        } catch { }
      }
      if (!costPerSqft && (g.base_glass_rate || g.rate) > 0) {
        costPerSqft = parseFloat(((g.base_glass_rate || g.rate) * 0.70).toFixed(2))
      }
    }
    return costPerSqft
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
      ? (group.cep_polish_rate_custom ?? 15)
      : (group.cep_polish_rate || 15)
    const cep_charges = group.cep
      ? parseFloat((running_ft * polishRate).toFixed(2)) : 0

    let effective_qty = 0
    if (group.pricing_method === 'per_sqft')
      effective_qty = group.cep ? charged_sqft : total_sqft
    else if (group.pricing_method === 'per_rft') effective_qty = running_ft
    else effective_qty = qty

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

    // ── COST SIDE ── (stable & immutable)
    let costPerSqft = getGroupBaseCostRate(group, products)
    
    // Add toughening cost addon if applicable
    if (group.is_toughened || group.glass_type === 'Toughened') {
      try {
        const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
        const toughProc = pm.find(p => p.process_type === 'toughening' && p.is_active !== false)
        if (toughProc && toughProc.rate > 0) {
          const size_tgh_sqmt = ((size.width_inch || 0) * 25.4 + 30) * ((size.height_inch || 0) * 25.4 + 30) * qty / 1000000
          const size_tgh_charge = parseFloat((size_tgh_sqmt * toughProc.rate).toFixed(2))
          const size_base_sqft = effective_qty || total_sqft || 0.001
          const size_addon = size_base_sqft > 0 ? parseFloat((size_tgh_charge / size_base_sqft).toFixed(4)) : 0
          if (size_addon > 0) costPerSqft = parseFloat((costPerSqft + size_addon).toFixed(2))
        }
      } catch { }
    }

    const cost_ceil_w = group.wizard_cost_ceil_w || 3
    const cost_ceil_h = group.wizard_cost_ceil_h || 3
    const costCeilFn = (x, c) => {
      if (c === 'plus30mm') return x + (30 / 25.4)
      return Math.ceil(x / c) * c
    }
    const cost_charged_w = parseFloat(costCeilFn(w_inch, cost_ceil_w).toFixed(4))
    const cost_charged_h = parseFloat(costCeilFn(h_inch, cost_ceil_h).toFixed(4))
    const cost_charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144
    const glass_cost = parseFloat((cost_charged_sqft * costPerSqft).toFixed(2))

    const CEP_COST_RATE = 5
    const initCepRate = (typeof group.wizard_cep_cost_rate === 'number' && group.wizard_cep_cost_rate > 0)
      ? group.wizard_cep_cost_rate
      : CEP_COST_RATE
    const cep_cost = group.cep
      ? parseFloat((running_ft * initCepRate).toFixed(2))
      : 0

    const proc_cost = parseFloat(
      ((size.size_processes || []).reduce((sum, p) => {
        const spCostRate = p.cost_rate ?? (p.rate * 0.70)
        return sum + ((p.qty_area || 0) * spCostRate)
      }, 0)).toFixed(2)
    )

    const cost_amount = parseFloat((glass_cost + cep_cost + proc_cost).toFixed(2))

    // ── SELLING SIDE ──
    const sqft_amt = effective_qty * (group.rate || 0)
    const rft_amt = running_ft * (group.rate_rft || 0)
    let subtotal = (sqft_amt + rft_amt) * (1 - (group.discount_pct || 0) / 100)
    subtotal = parseFloat((subtotal + cep_charges).toFixed(2))

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
      subtotal,
      tax_amount: tax_amt,
      line_total,

      // Cost Side properties
      cost_charged_w,
      cost_charged_h,
      glass_cost,
      cep_cost,
      proc_cost,
      cost_amount,
      margin_amount: parseFloat((subtotal - cost_amount).toFixed(2)),
      margin_pct: subtotal > 0 ? parseFloat((((subtotal - cost_amount) / subtotal) * 100).toFixed(2)) : 100
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

      if (['rate', 'rate_rft', 'discount_pct', 'pricing_method', 'product_id', 'glass_thickness', 'glass_type', 'glass_category', 'custom_costing'].includes(field)) {
        updated.target_margin = null
      }

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
      g.sizes.forEach(s => {
        glassCost += s.cost_amount || 0
      })
      ;(g.processes || []).forEach(p => {
        const procCostRate = p.cost_rate ?? (p.rate * 0.70)
        glassCost += (p.qty_area || 0) * procCostRate
      })
    })

    const totalCost = glassCost + hwCostTotal + lbCostTotal + wstCostTotal + (dcCost || 0)
    
    // Margin calculation: exclude GST and DC charges, use Gross Margin formula
    const sellableTotal = subI + procTotal + hwTotal + lbTotal + wstTotal
    const sellableCost = glassCost + hwCostTotal + lbCostTotal + wstCostTotal
    const marginAmt = sellableTotal - sellableCost
    const marginPct = sellableTotal > 0 ? (marginAmt / sellableTotal) * 100 : 100

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
        wizard_cost_ceil_w: g.wizard_cost_ceil_w ?? 3,
        wizard_cost_ceil_h: g.wizard_cost_ceil_h ?? 3,
        wizard_cep_cost_rate: g.wizard_cep_cost_rate ?? 5,
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

  const costPerSqft = getGroupBaseCostRate(group, products)
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
      const cost_ceil_w = s.cost_ceil_w || group.wizard_cost_ceil_w || 3
      const cost_ceil_h = s.cost_ceil_h || group.wizard_cost_ceil_h || 3
      const cost_charged_w = s.cost_charged_w !== undefined ? s.cost_charged_w : w
      const cost_charged_h = s.cost_charged_h !== undefined ? s.cost_charged_h : h
      const charged_sqft = s.charged_sqft || 0
      const glass_cost = s.glass_cost || 0
      const actual_rft = parseFloat(((w + h) * 2 / 12 * qty).toFixed(4))
      const cep_cost = s.cep_cost || 0
      const proc_cost = s.proc_cost || 0
      const cost_amount = s.cost_amount || 0
      const margin_amount = s.margin_amount || 0
      const margin_pct = s.margin_pct || 0

      return {
        key: i,
        label: String.fromCharCode(97 + i),
        width_display: unit === 'inch' ? `${toFraction(w)}"` : `${(w * 25.4).toFixed(1)}mm`,
        height_display: unit === 'inch' ? `${toFraction(h)}"` : `${(h * 25.4).toFixed(1)}mm`,
        quantity: qty,
        selling_sqft: selling_sqft.toFixed(3),
        charged_sqft: Number(charged_sqft).toFixed(3),
        actual_rft: actual_rft.toFixed(3),
        glass_cost,
        cep_cost,
        proc_cost,
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

    // Group-level processes — no cost_rate field, use 70% estimate
    const procSelling = (group.processes || []).reduce((s, p) => s + (p.amount || 0), 0)
    const groupProcCost = parseFloat((procSelling * 0.70).toFixed(2))

    // Size-level processes — actual cost_rate already included in glassCostTotal via proc_cost
    // Only add their selling amount here; their cost is already counted above
    const sizeProcSelling = (group.sizes || [])
      .flatMap(s => s.size_processes || [])
      .reduce((s, p) => s + (p.amount || 0), 0)

    const totalProcSelling = procSelling + sizeProcSelling

    // totalCost = glass rows cost (includes size proc actual cost) + group proc 70% estimate only
    const totalSelling = parseFloat((glassSellingTotal + totalProcSelling).toFixed(2))
    const totalCost = parseFloat((glassCostTotal + groupProcCost).toFixed(2))

    const totalMargin = parseFloat((totalSelling - totalCost).toFixed(2))
    const totalMarginPct = totalSelling > 0
      ? parseFloat(((totalMargin / totalSelling) * 100).toFixed(2)) : 100

    setCompWizard({
      product_name: group.description || 'Product',
      cost_price: costPerSqft,
      selling_rate: group.rate,
      cep_on: group.cep,
      cep_cost_rate: group.wizard_cep_cost_rate || CEP_COST_RATE,
      cost_ceil_w: group.wizard_cost_ceil_w || 3,
      cost_ceil_h: group.wizard_cost_ceil_h || 3,
      rows,
      glassSellingTotal,
      totalProcSelling,
      totalSelling, totalCost, totalCepCost, totalMargin, totalMarginPct,
      group_key: group.group_key,
    })
  }

  // ── True Margin Helpers ───────────────────────────────────────
  /**
   * Given a cost (excl. GST) and a target margin %, returns the required
   * selling price (excl. GST) such that:
   *   margin% = (selling - cost) / selling × 100
   * which rearranges to: selling = cost / (1 - margin/100)
   * Returns cost unchanged for zero cost or invalid margin.
   */
  const calculateSellingPriceForTargetMargin = (cost, targetMarginPct) => {
    if (!cost || cost <= 0) return 0
    const t = parseFloat(targetMarginPct)
    if (isNaN(t) || t <= 0 || t >= 100) return cost
    return parseFloat((cost / (1 - t / 100)).toFixed(2))
  }

  /**
   * Apply the target margin % to every sellable quotation component:
   *   - Glass groups  → recalculate `rate` (per-sqft selling rate) from cost-per-sqft
   *   - Group processes → recalculate `rate` from cost estimate (70%)
   *   - Size processes  → recalculate `rate` from actual cost_rate
   *   - Hardware items  → recalculate `rate` from cost_rate
   *   - Labour items    → recalculate `rate` from cost_rate
   *   - Wastage items   → recalculate `rate` from cost_rate
   *   - DC Charges      → NEVER modified
   */
  const applyTrueMarginToAll = (targetMarginPct) => {
    if (!targetMarginPct || targetMarginPct <= 0 || targetMarginPct >= 100) {
      message.error('True Margin must be between 1% and 99%')
      return
    }

    // ── 1. Glass groups ──────────────────────────────────────────
    setGroups(prev => prev.map(g => {
      // Resolve cost per sqft (excl. toughening)
      const baseCostRate = getGroupBaseCostRate(g, products)

      // Add toughening cost addon if applicable
      let avgTghCostAddon = 0
      if (g.is_toughened || g.glass_type === 'Toughened') {
        try {
          const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
          const toughProc = pm.find(p => p.process_type === 'toughening' && p.is_active !== false)
          if (toughProc && toughProc.rate > 0) {
            avgTghCostAddon = g.sizes.length > 0
              ? g.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / g.sizes.length
              : 0
          }
        } catch { }
      }

      // Compute total glass cost rate including toughening
      const totalGlassCostRate = baseCostRate + avgTghCostAddon

      // Read sizes directly to compute total glass cost with toughening addon
      const totalGlassCost = g.sizes.reduce((sum, sz) => sum + (sz.glass_cost || 0), 0)
      const totalEffectiveQty = g.sizes.reduce((sum, sz) => sum + (sz.effective_qty || sz.total_sqft || 0.001), 0)
      const totalGlassSelling = totalGlassCost / (1 - targetMarginPct / 100)
      
      const newRateFallback = totalGlassCostRate > 0 ? calculateSellingPriceForTargetMargin(totalGlassCostRate, targetMarginPct) : g.rate
      const newRate = totalGlassCost > 0
        ? (totalEffectiveQty > 0 ? parseFloat((totalGlassSelling / totalEffectiveQty).toFixed(2)) : g.rate)
        : newRateFallback

      // Update group processes
      const updatedProcesses = (g.processes || []).map(p => {
        const procCostRate = p.cost_rate ?? (p.rate * 0.70)
        const newProcRate = procCostRate > 0
          ? calculateSellingPriceForTargetMargin(procCostRate, targetMarginPct)
          : (p.rate || 0)
        const newAmt = parseFloat(((p.qty_area || 0) * newProcRate).toFixed(2))
        return { ...p, cost_rate: procCostRate, rate: newProcRate, amount: newAmt }
      })

      // Update size processes
      const updatedSizesWithProcs = g.sizes.map(s => {
        const newSizeProcs = (s.size_processes || []).map(sp => {
          const spCostRate = sp.cost_rate ?? (sp.rate * 0.70)
          const newSpRate = spCostRate > 0
            ? calculateSellingPriceForTargetMargin(spCostRate, targetMarginPct)
            : (sp.rate || 0)
          const newSpAmt = parseFloat(((sp.qty_area || 0) * newSpRate).toFixed(2))
          return { ...sp, cost_rate: spCostRate, rate: newSpRate, amount: newSpAmt }
        })
        return { ...s, size_processes: newSizeProcs }
      })

      const updatedG = {
        ...g,
        rate: newRate,
        custom_costing: true,
        target_margin: null, // clear target_margin override
        manual_cost_price: baseCostRate,
        processes: updatedProcesses,
        sizes: updatedSizesWithProcs
      }

      if (g.cep) {
        const cepCostRate = g.wizard_cep_cost_rate || 5
        const newCepPolishRateCustom = calculateSellingPriceForTargetMargin(cepCostRate, targetMarginPct)
        updatedG.cep_polish_rate = 'custom'
        updatedG.cep_polish_rate_custom = newCepPolishRateCustom
      }

      // Recalculate sizes with new selling rates
      updatedG.sizes = updatedG.sizes.map(s => calcGroupSize(updatedG, s))

      return updatedG
    }))

    // ── 2. Hardware items ────────────────────────────────────────
    setHardwareItems(prev => prev.map(h => {
      const cost = h.cost_amount || (h.qty || 0) * (h.cost_rate || 0)
      if (!cost || cost <= 0) return h
      const newSellingAmt = calculateSellingPriceForTargetMargin(cost, targetMarginPct)
      const qty = h.qty || 1
      const newRate = parseFloat((newSellingAmt / qty).toFixed(4))
      return { ...h, rate: newRate, amount: parseFloat(newSellingAmt.toFixed(2)) }
    }))

    // ── 3. Labour items ──────────────────────────────────────────
    setLaborItems(prev => prev.map(l => {
      const cost = l.cost_amount || (l.qty || 0) * (l.cost_rate || 0)
      if (!cost || cost <= 0) return l
      const newSellingAmt = calculateSellingPriceForTargetMargin(cost, targetMarginPct)
      const qty = l.qty || 1
      const newRate = parseFloat((newSellingAmt / qty).toFixed(4))
      return { ...l, rate: newRate, amount: parseFloat(newSellingAmt.toFixed(2)) }
    }))

    // ── 4. Wastage items ─────────────────────────────────────────
    setWastageItems(prev => prev.map(w => {
      const cost = w.cost_amount || (w.qty || 0) * (w.cost_rate || 0)
      if (!cost || cost <= 0) return w
      const newSellingAmt = calculateSellingPriceForTargetMargin(cost, targetMarginPct)
      const qty = w.qty || 1
      const newRate = parseFloat((newSellingAmt / qty).toFixed(4))
      return { ...w, rate: newRate, amount: parseFloat(newSellingAmt.toFixed(2)) }
    }))

    message.success(`✓ All components updated to ${targetMarginPct}% margin (DC Charges unchanged, GST excluded)`)
    setGlobalComparison(null)
    setMarginTarget(null)
  }

  const openGlobalComparison = () => {
    const CEP_COST_RATE = 5
    const allRows = []
    let rowIndex = 0

    groups.forEach((group, gi) => {
      group.sizes?.forEach((s, si) => {
        const w = s.width_inch || 0
        const h = s.height_inch || 0
        const qty = s.quantity || 1

        const glass_cost = s.glass_cost || 0
        const cep_cost = s.cep_cost || 0
        const cost_amount = s.cost_amount || 0
        const selling_amount = s.subtotal || 0
        const margin_amount = s.margin_amount || 0
        const margin_pct = s.margin_pct || 0
        const charged_sqft = s.charged_sqft || 0

        // Resolve cost per sqft for display
        let costPerSqft = group.manual_cost_price || 0
        if (!costPerSqft) {
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
        }

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
    
    // Exclude DC and GST from margins, use Gross Margin formula
    const sellableTotal = glassSellingTotal + hwSell + lbSell + wstSell
    const sellableCost = glassCostTotal + hwCost + lbCost + wstCost
    const totalMargin = parseFloat((sellableTotal - sellableCost).toFixed(2))
    const totalMarginPct = sellableTotal > 0
      ? parseFloat(((totalMargin / sellableTotal) * 100).toFixed(2)) : 100

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


  // ── Design helpers ─────────────────────────────────────────────
  const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }
  const sectionHeader = (title, right) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#1E40AF', letterSpacing: 0.2 }}>{title}</span>
      {right && <div>{right}</div>}
    </div>
  )
  const lbl = (text) => <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{text}</span>
  const fmtAmt = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <MasterForm title="Quotation" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Sales' }, { label: 'Quotations', path: '/quotations' }, { label: isEdit ? record?.quote_number || 'Edit' : 'New' }]}
      onSave={status === 'converted' ? null : () => handleSave(false)}
      onSaveNew={status === 'converted' ? null : () => handleSave(true)}
      onDiscard={() => navigate('/quotations')}>

      <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{ display: 'none' }} onChange={handleExcelImport} />

      {/* ── Converted Banner ── */}
      {status === 'converted' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: '12px 20px', borderRadius: 12, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space><CheckCircleOutlined style={{ color: '#10b981', fontSize: 18 }} /><span style={{ color: '#065f46', fontWeight: 600, fontSize: 15 }}>Converted to Sales Order</span></Space>
          <Button type="primary" onClick={() => navigate(linkedSoId ? `/sales-orders/${linkedSoId}/edit` : '/sales-orders')} style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8 }}>View Sales Order →</Button>
        </div>
      )}

      {/* ── Action Bar ── */}
      <ActionToolbar
        status={status}
        isEdit={isEdit}
        record={record}
        onImportExcel={() => fileInputRef.current?.click()}
        onCostAnalysis={openGlobalComparison}
        onGeneratePDF={() => generateQuotationPDF({
          quote_number: record?.quote_number,
          quote_date: form.getFieldValue('quote_date')?.format?.('YYYY-MM-DD') || form.getFieldValue('quote_date'),
          valid_until: form.getFieldValue('valid_until')?.format?.('YYYY-MM-DD') || form.getFieldValue('valid_until'),
          salesperson: form.getFieldValue('salesperson'), payment_terms: form.getFieldValue('payment_terms'),
          delivery_address: form.getFieldValue('delivery_address'), company_id: form.getFieldValue('company_id'),
          customer_name: customers.find(c => c.id === form.getFieldValue('customer_id'))?.name || '',
          customer_phone: customers.find(c => c.id === form.getFieldValue('customer_id'))?.phone || '',
          customer_gstin: customers.find(c => c.id === form.getFieldValue('customer_id'))?.gstin || '',
          advance_received: advanceRec || 0, groups, totals, lines: getFlatLines(),
          hardware_items: hardwareItems, labor_items: laborItems,
        })}
        onConvertToSO={() => convertMutation.mutate()}
        isConverting={convertMutation.isPending}
        onCancel={async () => {
          await quotationApi.changeStatus(id, 'cancelled');
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
          queryClient.invalidateQueries({ queryKey: ['quotations', id] });
          message.info('Quotation cancelled')
        }}
        onConfirm={() => {
          if (!id) {
            message.warning('Please save first.');
            handleSave(false);
            return
          }
          confirmMutation.mutate()
        }}
        isConfirming={confirmMutation.isPending}
      />

      <Form form={form} layout="vertical" disabled={status === 'converted'}>
        <Form.Item name="crm_lead_id" hidden><input type="hidden" /></Form.Item>
        <CompanySelector form={form} />

        <Row gutter={24} style={{ marginTop: 12 }}>
          {/* Left Column: Form & Item details (18 cols, 75%) */}
          <Col xs={24} lg={18}>
            {/* ── Section 1: Quotation Details ── */}
            <QuotationDetailsCard
              form={form}
              unit={unit}
              setUnit={setUnit}
              customers={customers}
              employees={employees}
              paymentTerms={PAYMENT_TERMS}
              handleCustomerChange={handleCustomerChange}
              customerApi={customerApi}
              queryClient={queryClient}
              message={message}
            />

            {/* ── Section 2: Glass Groups ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', letterSpacing: -0.1 }}>Glass Line Items</span>
                <Text type="secondary" style={{ fontSize: 12 }}>{groups.length} product{groups.length !== 1 ? 's' : ''}</Text>
              </div>

              {groups.map((group, gi) => (
                <GlassCard
                  key={group.group_key}
                  group={group}
                  gi={gi}
                  unit={unit}
                  dropdownConfig={dropdownConfig}
                  customSearchVal={customSearchVal}
                  setCustomSearchVal={setCustomSearchVal}
                  products={products}
                  processMasters={processMasters}
                  updateGroup={updateGroup}
                  removeGroup={removeGroup}
                  openComparisonWizard={openComparisonWizard}
                  updateSize={updateSize}
                  updateSizeProcess={updateSizeProcess}
                  removeSizeProcess={removeSizeProcess}
                  addSizeProcess={addSizeProcess}
                  addSize={addSize}
                  removeSize={removeSize}
                  updateGroupProcess={updateGroupProcess}
                  removeGroupProcess={removeGroupProcess}
                  addGroupProcess={addGroupProcess}
                  setGroups={setGroups}
                  queryClient={queryClient}
                  message={message}
                  CEILING_OPTIONS={CEILING_OPTIONS}
                  productApi={productApi}
                />
              ))}
            </div>

            {/* ── Add Item Buttons Row ── */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              flexWrap: 'wrap', 
              marginBottom: 24, 
              padding: '16px 20px', 
              background: '#f8fafc', 
              borderRadius: 12, 
              border: '1px dashed #cbd5e1' 
            }}>
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8, background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 500 }} onClick={addGroup}>Add Glass Product</Button>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderRadius: 8, borderColor: '#f59e0b', color: '#d97706' }} onClick={() => setHardwareItems(prev => [...prev, emptyHardware()])}>Add Hardware</Button>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderRadius: 8, borderColor: '#7c3aed', color: '#6d28d9' }} onClick={() => setLaborItems(prev => [...prev, emptyLabor()])}>Add Labor</Button>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderRadius: 8, borderColor: '#ef4444', color: '#dc2626' }} onClick={() => setWastageItems(prev => [...prev, emptyWastage()])}>Add Wastage</Button>
            </div>

            {/* ── Section 3: Hardware ── */}
            {hardwareItems.length > 0 && (
              <HardwareCard
                hardwareItems={hardwareItems}
                setHardwareItems={setHardwareItems}
                getUomRates={getUomRates}
                fmtAmt={fmtAmt}
                sectionHeader={sectionHeader}
                cardStyle={cardStyle}
              />
            )}

            {/* ── Section 4: Labor ── */}
            {laborItems.length > 0 && (
              <LabourCard
                laborItems={laborItems}
                setLaborItems={setLaborItems}
                getUomRates={getUomRates}
                fmtAmt={fmtAmt}
                sectionHeader={sectionHeader}
                cardStyle={cardStyle}
              />
            )}

            {/* ── Section 5: Wastage ── */}
            {wastageItems.length > 0 && (
              <WastageCard
                wastageItems={wastageItems}
                setWastageItems={setWastageItems}
                fmtAmt={fmtAmt}
                sectionHeader={sectionHeader}
                cardStyle={cardStyle}
              />
            )}

            {/* ── Section 6: Notes ── */}
            <NotesCard />

            {/* ── Section 7: Cost Analysis ── */}
            <CostAnalysisCard groups={groups} products={products} />
          </Col>

          {/* Right Column: Sticky Summary (6 cols, 25%) */}
          <Col xs={24} lg={6}>
            <StickySummary
              totals={totals}
              gstMode={gstMode}
              setGstMode={setGstMode}
            />
          </Col>
        </Row>
      </Form>

      {/* ── Modal 1: Import Preview ── */}
      <Modal title={<Space><UploadOutlined style={{ color: '#0ea5e9' }} /><span>Excel Import Preview</span></Space>}
        open={importPreview !== null} onCancel={() => setImportPreview(null)} width={700}
        footer={[
          <Button key="cancel" onClick={() => setImportPreview(null)}>Cancel</Button>,
          <Button key="import" type="primary" style={{ background: '#0ea5e9', borderColor: '#0ea5e9' }}
            onClick={() => {
              setGroups(importPreview.groups)
              const matchedCustomer = customers.find(c => c.name.toLowerCase().includes((importPreview.clientName || '').toLowerCase()) || (importPreview.clientName || '').toLowerCase().includes(c.name.toLowerCase()))
              if (matchedCustomer) form.setFieldValue('customer_id', matchedCustomer.id)
              message.success(`Imported ${importPreview.totalItems} sizes across ${importPreview.totalProducts} products!`)
              setImportPreview(null)
            }}>Import {importPreview?.totalItems} Items</Button>
        ]}>
        {importPreview && (<>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {importPreview.orderNo && <Col span={12}><Text type="secondary">Order No: </Text><Text strong>{importPreview.orderNo}</Text></Col>}
            {importPreview.clientName && <Col span={12}><Text type="secondary">Client: </Text><Text strong>{importPreview.clientName}</Text></Col>}
          </Row>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small" style={{ textAlign: 'center', background: '#f0fdf4' }}><Text type="secondary">Products Found</Text><div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{importPreview.totalProducts}</div></Card></Col>
            <Col span={8}><Card size="small" style={{ textAlign: 'center', background: '#eff6ff' }}><Text type="secondary">Total Sizes</Text><div style={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8' }}>{importPreview.totalItems}</div></Card></Col>
            <Col span={8}><Card size="small" style={{ textAlign: 'center', background: '#fff7ed' }}><Text type="secondary">Est. Total (₹)</Text><div style={{ fontSize: 18, fontWeight: 700, color: '#ea580c' }}>₹{importPreview.groups.flatMap(g => g.sizes).reduce((s, sz) => s + (sz.subtotal || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></Card></Col>
          </Row>
          <Collapse size="small">
            {importPreview.groups.map((g, gi) => (
              <Collapse.Panel key={gi} header={<Space><Tag color="blue">{gi + 1}</Tag><Text strong>{g.description}</Text><Tag>{g.sizes.length} sizes</Tag><Tag color="green">₹{g.rate}/sqft</Tag>{g.cep && <Tag color="orange">CEP</Tag>}</Space>}>
                {g.sizes.map((s, si) => (
                  <div key={si} style={{ fontSize: 12, marginBottom: 4 }}>
                    {String.fromCharCode(97 + si)}.{' '}{unit === 'inch' ? `${toFraction(s.width_inch)}"` : `${(s.width_inch * 25.4).toFixed(1)}mm`}{' × '}{unit === 'inch' ? `${toFraction(s.height_inch)}"` : `${(s.height_inch * 25.4).toFixed(1)}mm`}{' × '}{s.quantity} pcs{' = '}<Text strong>{s.total_sqft?.toFixed(3)} sqft</Text>{' → '}<Text strong style={{ color: '#059669' }}>₹{(s.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </div>
                ))}
              </Collapse.Panel>
            ))}
          </Collapse>
        </>)}
      </Modal>

      {/* ── Modal 2: Cost vs Selling (Per-Product) ── */}
      <Modal title={<Space><LineChartOutlined style={{ color: '#6366f1' }} /><span>Cost vs Selling — {compWizard?.product_name}</span></Space>}
        open={compWizard !== null} onCancel={() => { setCompWizard(null); setWizardCostPrice(null) }} width={820}
        footer={<Space>
          <Button style={{ borderColor: '#10b981', color: '#10b981' }} disabled={!wizardCostPrice || wizardCostPrice <= 0}
            onClick={() => { if (compWizard?.group_key && wizardCostPrice > 0) { updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice); message.success(`Cost price ₹${wizardCostPrice}/sqft saved`) } setCompWizard(null); setWizardCostPrice(null) }}>
            Save Cost Price Only
          </Button>
          <Button type="primary" style={{ background: '#f59e0b', borderColor: '#f59e0b' }} disabled={!wizardCostPrice || wizardCostPrice <= 0}
            onClick={() => { if (compWizard?.group_key && wizardCostPrice > 0) { const currentMarginPct = compWizard.totalMarginPct || 20; const divisor = 1 - currentMarginPct / 100; const newRate = divisor > 0 ? parseFloat((wizardCostPrice / divisor).toFixed(2)) : wizardCostPrice; updateGroup(compWizard.group_key, 'custom_costing', true); updateGroup(compWizard.group_key, 'rate', newRate); updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice); message.success(`Selling rate updated to ₹${newRate}/sqft`) } setCompWizard(null); setWizardCostPrice(null) }}>
            Apply as Selling Rate
          </Button>
          <Button onClick={() => { setCompWizard(null); setWizardCostPrice(null) }}>Close</Button>
        </Space>}>
        {compWizard && (<>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}><Card size="small" style={{ background: '#f0fdf4', borderColor: '#86efac' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Text type="secondary">Selling Rate (Current)</Text><Tag color="green" style={{ fontSize: 10, margin: 0 }}>LOCKED</Tag></div><div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>₹{compWizard.selling_rate}/sqft</div><Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>Cost ceiling changes do NOT affect this</Text></Card></Col>
            <Col span={12}><Card size="small" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}><Text type="secondary">Cost Price (editable)</Text><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <InputNumber value={wizardCostPrice !== null && wizardCostPrice !== undefined ? wizardCostPrice : compWizard.cost_price} min={0} prefix="₹" addonAfter="/sqft" style={{ width: '100%' }}
                onChange={val => {
                  setWizardCostPrice(val); const newCost = val || 0
                  const newRows = compWizard.rows.map(r => { const glass_cost = parseFloat(((r.cost_charged_w && r.cost_charged_h ? (r.cost_charged_w * r.cost_charged_h * r.quantity) / 144 : parseFloat(r.charged_sqft)) * newCost).toFixed(2)); const cost_amount = parseFloat((glass_cost + (r.cep_cost || 0) + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = r.selling_amount > 0 ? parseFloat(((margin_amount / r.selling_amount) * 100).toFixed(2)) : 100; return { ...r, glass_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = compWizard.totalSelling > 0 ? parseFloat(((totalMargin / compWizard.totalSelling) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct }))
                }} />
            </div><Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>Edit to recalculate margin live</Text></Card></Col>
          </Row>

          {compWizard.cep_on && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>CEP (Polish - 4 sides)</strong> cost:
              <Select size="small" value={[5,7,15].includes(compWizard.cep_cost_rate) ? compWizard.cep_cost_rate : 'custom'} style={{ width: 110 }}
                options={[{ value: 5, label: '₹5/rft' }, { value: 7, label: '₹7/rft' }, { value: 15, label: '₹15/rft' }, { value: 'custom', label: 'Custom' }]}
                onChange={val => {
                  if (val === 'custom') { setCompWizard(prev => ({ ...prev, cep_cost_rate: 'custom' })); if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', 'custom'); return }
                  const newRate = val || 0; if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', newRate)
                  const newRows = compWizard.rows.map(r => { const cep_cost = parseFloat((parseFloat(r.actual_rft) * newRate).toFixed(2)); const cost_amount = parseFloat((r.glass_cost + cep_cost + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = r.selling_amount > 0 ? parseFloat(((margin_amount / r.selling_amount) * 100).toFixed(2)) : 100; return { ...r, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = compWizard.totalSelling > 0 ? parseFloat(((totalMargin / compWizard.totalSelling) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cep_cost_rate: newRate }))
                }} />
              {compWizard.cep_cost_rate === 'custom' && (
                <InputNumber size="small" min={0} prefix="₹" placeholder="Enter rate" style={{ width: 120 }}
                  onChange={val => {
                    const newRate = val || 0; if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', newRate)
                    const newRows = compWizard.rows.map(r => { const cep_cost = parseFloat((parseFloat(r.actual_rft) * newRate).toFixed(2)); const cost_amount = parseFloat((r.glass_cost + cep_cost + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = r.selling_amount > 0 ? parseFloat(((margin_amount / r.selling_amount) * 100).toFixed(2)) : 100; return { ...r, cep_cost, cost_amount, margin_amount, margin_pct } })
                    const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = compWizard.totalSelling > 0 ? parseFloat(((totalMargin / compWizard.totalSelling) * 100).toFixed(2)) : 100
                    setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cep_cost_rate: newRate }))
                  }} />
              )}
              <Text style={{ color: '#6d28d9', fontSize: 12 }}>× Actual running ft per size</Text>
            </div>
          )}

          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', marginBottom: 8, fontSize: 12, color: '#92400e' }}>
            Cost Ceiling sirf cost side ka calculation change karta hai. Selling rate tab tak nahi badlega jab tak <strong>Apply as Selling Rate</strong> click nahi karte.
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Cost Ceiling:</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>W:</Text>
              <Select size="small" value={compWizard.cost_ceil_w} style={{ width: 130 }} options={[{ value: 3, label: '3" (Tight)' }, { value: 6, label: '6" (Standard)' }, { value: 'plus30mm', label: '+30mm' }]}
                onChange={val => {
                  const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : Math.ceil(x / c) * c
                  const newRows = compWizard.rows.map(row => { const cost_charged_w = parseFloat(costCeilFn(row._w_raw || 0, val).toFixed(4)); const cost_charged_h = row.cost_charged_h || 0; const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (compWizard.cep_cost_rate || 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = row.selling_amount > 0 ? parseFloat(((margin_amount / row.selling_amount) * 100).toFixed(2)) : 100; return { ...row, cost_ceil_w: val, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = compWizard.totalSelling > 0 ? parseFloat(((totalMargin / compWizard.totalSelling) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_w: val })); if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_w', val)
                }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>H:</Text>
              <Select size="small" value={compWizard.cost_ceil_h} style={{ width: 130 }} options={[{ value: 3, label: '3" (Tight)' }, { value: 6, label: '6" (Standard)' }, { value: 'plus30mm', label: '+30mm' }]}
                onChange={val => {
                  const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : Math.ceil(x / c) * c
                  const newRows = compWizard.rows.map(row => { const cost_charged_w = row.cost_charged_w || 0; const cost_charged_h = parseFloat(costCeilFn(row._h_raw || 0, val).toFixed(4)); const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (compWizard.cep_cost_rate || 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = row.selling_amount > 0 ? parseFloat(((margin_amount / row.selling_amount) * 100).toFixed(2)) : 100; return { ...row, cost_ceil_h: val, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = compWizard.totalSelling > 0 ? parseFloat(((totalMargin / compWizard.totalSelling) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_h: val })); if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_h', val)
                }} />
            </div>
          </div>

          <Table dataSource={compWizard.rows} pagination={false} size="small" scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Size', key: 'size', width: 130, render: (_, r) => <Text strong style={{ fontSize: 12 }}>{r.label}. {r.width_display} × {r.height_display}</Text> },
              { title: 'Qty', dataIndex: 'quantity', width: 45 },
              { title: 'Charged Sqft', dataIndex: 'selling_sqft', width: 90, render: v => <Text>{v}</Text> },
              { title: 'Cost Sqft', dataIndex: 'charged_sqft', width: 90, render: v => <Text type="secondary">{v}</Text> },
              { title: 'Actual Rft', dataIndex: 'actual_rft', width: 80, render: v => <Text type="secondary">{v}</Text> },
              { title: 'Cost Chg W', key: 'cost_chg_w', width: 90, align: 'center', render: (_, r) => <InputNumber size="small" value={r.cost_charged_w ? parseFloat(r.cost_charged_w.toFixed(3)) : null} min={0} step={0.5} style={{ width: '100%', borderColor: '#6366f1' }} onChange={val => { const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; setCompWizard(prev => { const newRows = prev.rows.map(row => { if (row.key !== r.key) return row; const cost_charged_w = val || 0, cost_charged_h = row.cost_charged_h || 0, qty = row.quantity || 1, charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144, glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)), cep_cost = typeof prev.cep_cost_rate === 'number' ? parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2)) : row.cep_cost || 0, cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)), margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)), margin_pct = row.selling_amount > 0 ? parseFloat(((margin_amount / row.selling_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } }); const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0), totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0), totalMargin = prev.totalSelling - totalCost, totalMarginPct = prev.totalSelling > 0 ? parseFloat(((totalMargin / prev.totalSelling) * 100).toFixed(2)) : 100; return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct } }) }} /> },
              { title: 'Cost Chg H', key: 'cost_chg_h', width: 90, align: 'center', render: (_, r) => <InputNumber size="small" value={r.cost_charged_h ? parseFloat(r.cost_charged_h.toFixed(3)) : null} min={0} step={0.5} style={{ width: '100%', borderColor: '#6366f1' }} onChange={val => { const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; setCompWizard(prev => { const newRows = prev.rows.map(row => { if (row.key !== r.key) return row; const cost_charged_w = row.cost_charged_w || 0, cost_charged_h = val || 0, qty = row.quantity || 1, charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144, glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)), cep_cost = typeof prev.cep_cost_rate === 'number' ? parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2)) : row.cep_cost || 0, cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)), margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)), margin_pct = row.selling_amount > 0 ? parseFloat(((margin_amount / row.selling_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } }); const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0), totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0), totalMargin = prev.totalSelling - totalCost, totalMarginPct = prev.totalSelling > 0 ? parseFloat(((totalMargin / prev.totalSelling) * 100).toFixed(2)) : 100; return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct } }) }} /> },
              { title: 'Selling Amt', dataIndex: 'selling_amount', width: 100, align: 'right', render: v => <Text strong style={{ color: '#16a34a' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              { title: 'Glass Cost', dataIndex: 'glass_cost', width: 100, align: 'right', render: v => <Text style={{ color: '#ea580c' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              { title: 'Proc Cost', dataIndex: 'proc_cost', width: 90, align: 'right', render: v => <Text style={{ color: '#f59e0b' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              ...(compWizard.cep_on ? [{ title: <span>CEP Cost<br /><Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>Rft × ₹{compWizard.cep_cost_rate}</Text></span>, dataIndex: 'cep_cost', width: 100, align: 'right', render: v => <Text style={{ color: '#7c3aed' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> }] : []),
              { title: 'Total Cost', dataIndex: 'cost_amount', width: 100, align: 'right', render: v => <Text strong style={{ color: '#dc2626' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              { title: 'Margin', dataIndex: 'margin_amount', width: 120, align: 'right', render: (v, r) => <Text strong style={{ color: r.margin_pct >= 20 ? '#16a34a' : r.margin_pct >= 10 ? '#f59e0b' : '#dc2626' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br /><Text style={{ fontSize: 11, color: 'inherit' }}>({r.margin_pct}%)</Text></Text> },
            ]} />

          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={[12, 8]}>
            <Col span={6}><Text type="secondary">Glass Selling</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>₹{compWizard.glassSellingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>
            {(compWizard.totalProcSelling || 0) > 0 && <Col span={6}><Text type="secondary">Process Charges</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>₹{(compWizard.totalProcSelling || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div><Text type="secondary" style={{ fontSize: 10 }}>Cost est. @70%</Text></Col>}
            <Col span={6}><Text type="secondary">Glass Cost (excl. CEP)</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#ea580c' }}>₹{(compWizard.totalCost - (compWizard.totalCepCost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>
            {compWizard.cep_on && <Col span={6}><Text type="secondary">CEP Cost (₹{compWizard.cep_cost_rate}/rft)</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>₹{(compWizard.totalCepCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>}
            <Col span={6}><Text type="secondary">Total Glass Cost</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>₹{compWizard.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div><Text type="secondary" style={{ fontSize: 10 }}>Glass + CEP</Text></Col>
            <Col span={6}><Text type="secondary">Margin</Text><div style={{ fontSize: 15, fontWeight: 700, color: compWizard.totalMargin >= 0 ? '#16a34a' : '#dc2626' }}>₹{compWizard.totalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>
            <Col span={6}><Text type="secondary">Margin %</Text><div style={{ fontSize: 22, fontWeight: 800, color: compWizard.totalMarginPct >= 20 ? '#16a34a' : compWizard.totalMarginPct >= 10 ? '#f59e0b' : '#dc2626' }}>{compWizard.totalMarginPct}%</div></Col>
          </Row>
        </>)}
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
            {/* True Margin Panel */}
            <div style={{
              background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <Text strong style={{ color: '#4338ca' }}>🎯 True Margin (%):</Text>
              <InputNumber
                value={marginTarget} min={1} max={99} step={0.5} placeholder="e.g. 20"
                addonAfter="%" style={{ width: 160 }}
                onChange={val => setMarginTarget(val > 99 ? 99 : val < 0 ? 0 : val)} />
              {marginTarget > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Every component: Selling = Cost ÷ (1 − {marginTarget}/100) &nbsp;|&nbsp; DC Charges unchanged &nbsp;|&nbsp; GST excluded
                </Text>
              )}
              {marginTarget > 0 && (
                <Button
                  type="primary"
                  style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
                  onClick={() => applyTrueMarginToAll(marginTarget)}
                >
                  ✓ Apply {marginTarget}% to All Items
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
                  let costPerSqft = getGroupBaseCostRate(group, products)
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

                  const cost = group.sizes?.reduce((s, sz) => {
                    const w = sz.width_inch || 0
                    const h = sz.height_inch || 0
                    const qty = sz.quantity || 1
                    const gcw = group.wizard_cost_ceil_w || 3
                    const gch = group.wizard_cost_ceil_h || 3
                    const gcFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : Math.ceil(x / c) * c
                    const charged_sqft = (gcFn(w, gcw) * gcFn(h, gch) * qty) / 144
                    const glass_cost = charged_sqft * costPerSqft
                    const actual_rft = ((w + h) * 2 / 12 * qty)
                    const gCepRate = (typeof group.wizard_cep_cost_rate === 'number' && group.wizard_cep_cost_rate > 0)
                      ? group.wizard_cep_cost_rate : 5
                    const cep_cost = group.cep ? (actual_rft * gCepRate) : 0
                    return s + glass_cost + cep_cost
                  }, 0) || 0

                  rows.push(
                    <div key={`group-${gi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', flex: 1 }}>{gi + 1}) {group.description || `Group ${gi + 1}`}</span>
                      <span style={{ color: '#16a34a', minWidth: 90, textAlign: 'right' }}>₹{Number(sell).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: '#dc2626', minWidth: 90, textAlign: 'right' }}>₹{Number(cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )

                  // Group processes — no cost_rate field, use 70% estimate
                  const groupProcesses = (group.processes || [])
                  // Size processes — use actual cost_amount (cost_rate × qty_area)
                  const sizeProcesses = (group.sizes?.flatMap(s => s.size_processes || []) || [])

                  groupProcesses.forEach((p, pi) => {
                    if (p.amount > 0) {
                      rows.push(
                        <div key={`proc-${gi}-${pi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, color: '#6366f1', paddingLeft: 20, borderLeft: '2px solid #e9d5ff', marginLeft: 8 }}>
                          <span style={{ flex: 1 }}>└ {p.process_name || p.name || 'Process'} <span style={{ color: '#9ca3af', fontSize: 10 }}>(est. @70%)</span></span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(p.amount * 0.70).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    }
                  })

                  sizeProcesses.forEach((p, pi) => {
                    if (p.amount > 0) {
                      const actualCost = p.cost_amount || ((p.qty_area || 0) * (p.cost_rate || 0))
                      rows.push(
                        <div key={`sproc-${gi}-${pi}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11, color: '#6366f1', paddingLeft: 20, borderLeft: '2px solid #e9d5ff', marginLeft: 8 }}>
                          <span style={{ flex: 1 }}>└ {p.process_name || p.name || 'Process'}</span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <span style={{ minWidth: 90, textAlign: 'right' }}>₹{Number(actualCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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

            {/* ── Overall Analysis / True Margin Panel ── */}
            {(() => {
              // Compute pre-GST selling totals for margin analysis
              // (DC charges excluded from margin per spec)
              const glassSell = groups.reduce((s, g) =>
                s + g.sizes.reduce((ss, sz) => ss + (sz.subtotal || 0), 0), 0)
              const procSell = groups.reduce((s, g) =>
                s + (g.processes || []).reduce((ss, p) => ss + (p.amount || 0), 0)
                + g.sizes.reduce((ss, sz) =>
                  ss + (sz.size_processes || []).reduce((sss, sp) => sss + (sp.amount || 0), 0), 0), 0)
              const hwSell = hardwareItems.reduce((s, h) => s + (h.amount || 0), 0)
              const lbSell = laborItems.reduce((s, l) => s + (l.amount || 0), 0)
              const wstSell = wastageItems.reduce((s, w) => s + (w.amount || 0), 0)
              const totalSellBeforeGst = glassSell + procSell + hwSell + lbSell + wstSell

              // Cost (same as totals useMemo, without GST)
              const trueCost = globalComparison.totalCost - (totals.dcCost || 0)  // excl DC cost from margin
              const trueMarginAmt = totalSellBeforeGst - trueCost
              const truePct = trueCost > 0
                ? parseFloat(((trueMarginAmt / totalSellBeforeGst) * 100).toFixed(2))
                : 100
              const color = truePct >= 20 ? '#4ade80'
                : truePct >= 10 ? '#fbbf24' : '#f87171'

              return (
                <div style={{
                  marginTop: 12,
                  background: '#0f172a',
                  borderRadius: 10,
                  padding: '16px 20px',
                  border: '1px solid #1e293b',
                }}>
                  {/* Top row: metric tiles */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 16,
                  }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Total Selling (excl. GST & DC)</div>
                      <div style={{ color: '#4ade80', fontSize: 16, fontWeight: 700 }}>
                        ₹{totalSellBeforeGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Glass + Processes + HW + Labor + Wastage</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Total Cost (excl. DC)</div>
                      <div style={{ color: '#f87171', fontSize: 16, fontWeight: 700 }}>
                        ₹{trueCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Glass + HW + Labor + Wastage</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Margin (excl. GST)</div>
                      <div style={{ color, fontSize: 16, fontWeight: 700 }}>
                        ₹{trueMarginAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>True Margin %</div>
                      <div style={{ color, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                        {truePct}%
                      </div>
                      <div style={{ color: '#475569', fontSize: 10 }}>= (Selling − Cost) ÷ Selling</div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </Modal>

    </MasterForm>
  )
}

export default QuotationForm
