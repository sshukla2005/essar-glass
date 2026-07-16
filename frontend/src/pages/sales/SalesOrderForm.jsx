import React, { useEffect, useMemo, useState } from 'react'
import { Form, Row, Col, Divider, Button, Space, Tag, Badge, App, Modal, Typography, Table, InputNumber, Select, Card } from 'antd'
import { PlusOutlined, ShoppingCartOutlined, FileTextOutlined, CarOutlined, DollarOutlined, ToolOutlined, DownloadOutlined, AimOutlined, LineChartOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import { salesOrderApi, customerApi, productApi, quotationApi, purchaseOrderApi, deliveryChallanApi, invoiceApi, warehouseApi, workshopOrderApi, processMasterApi, employeeApi } from '../../api'
import { generateSOPDF } from '../../utils/pdfGenerator'
import {
  getGroupBaseCostRate as sharedGetGroupBaseCostRate,
  getGroupLoadedCostRate as sharedGetGroupLoadedCostRate,
  calcGroupSize as sharedCalcGroupSize,
  getAutoChargedDim,
} from '../../utils/quotationCalc'
import CompanySelector from '../../components/common/CompanySelector'

// Shared quotation components
import ActionToolbar from '../quotations/components/ActionToolbar'
import QuotationDetailsCard from '../quotations/components/QuotationDetailsCard'
import GlassCard from '../quotations/components/GlassCard'
import HardwareCard from '../quotations/components/HardwareCard'
import LabourCard from '../quotations/components/LabourCard'
import WastageCard from '../quotations/components/WastageCard'
import NotesCard from '../quotations/components/NotesCard'
import StickySummary from '../quotations/components/StickySummary'
import CostAnalysisCard from '../quotations/components/CostAnalysisCard'
import FractionInput, { toFraction } from '../quotations/components/FractionInput'

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

const { Text } = Typography

const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Immediate' }, { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' }, { value: '45_days', label: '45 Days' },
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
  { value: 'custom', label: 'Custom mm' },
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

const SalesOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [soUnit, setSoUnit] = useState('inch')
  const [dropdownConfig] = useState(getDropdownConfig())
  const [customSearchVal, setCustomSearchVal] = useState({})
  const [hardwareItems, setHardwareItems] = useState([])
  const [laborItems, setLaborItems] = useState([])
  const [wastageItems, setWastageItems] = useState([])
  const [gstMode, setGstMode] = useState('cgst_sgst')
  const [compWizard, setCompWizard] = useState(null)
  const [wizardCostPrice, setWizardCostPrice] = useState(null)

  const { data: record, isLoading } = useQuery({
    queryKey: ['sales_orders', id], queryFn: () => salesOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customersData } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: productsData } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: processMastersData } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })
  const { data: quotationsData } = useQuery({ queryKey: ['quotations-dd'], queryFn: () => quotationApi.dropdown().then(r => r.data) })
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses-dd'], queryFn: () => warehouseApi.dropdown().then(r => r.data) })
  const { data: employeesData } = useQuery({ queryKey: ['employees-dd'], queryFn: () => employeeApi.dropdown().then(r => r.data) })

  const { data: posData } = useQuery({ queryKey: ['pos-so', id], queryFn: () => purchaseOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: dcsData } = useQuery({ queryKey: ['dcs-so', id], queryFn: () => deliveryChallanApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: invData } = useQuery({ queryKey: ['inv-so', id], queryFn: () => invoiceApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })
  const { data: woData } = useQuery({ queryKey: ['wo-so', id], queryFn: () => workshopOrderApi.list({ so_id: id }).then(r => r.data), enabled: isEdit })

  const customers = Array.isArray(customersData) ? customersData : (customersData?.items || [])
  const products = Array.isArray(productsData) ? productsData : (productsData?.items || [])
  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])
  const quotations = Array.isArray(quotationsData) ? quotationsData : (quotationsData?.items || [])
  const warehouses = Array.isArray(warehousesData) ? warehousesData : (warehousesData?.items || [])
  const employees = Array.isArray(employeesData) ? employeesData : (employeesData?.items || [])

  const getPolishingRate = () => {
    try {
      const polish = processMasters.find(p =>
        p.process_type === 'polishing' &&
        (p.name?.toLowerCase().includes('4') || p.name?.toLowerCase().includes('four'))
      ) || processMasters.find(p => p.process_type === 'polishing')
      return polish?.rate || 15
    } catch { return 15 }
  }

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
    wizard_cost_ceil_w_custom_mm: 30,
    wizard_cost_ceil_h_custom_mm: 30,
    wizard_cep_cost_rate: 5,
    ceiling_w_custom_mm: 30,
    ceiling_h_custom_mm: 30,
    cep_polish_rate: getPolishingRate(),
    cep_polish_rate_custom: null,
    artwork_master_id: null,
    artwork_name: null,
    artwork_file_data: null,
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

  const [groups, setGroups] = useState([emptyGroup()])

  const emptyHardware = () => ({
    hw_key: Date.now() + Math.random(),
    description: '',
    qty: 1,
    uom: '',
    cost_rate: 0,
    rate: 0,
    cost_amount: 0,
    amount: 0,
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
          artwork_master_id: line.artwork_master_id || null,
          artwork_file_data: line.artwork_file_data || null,
          wizard_cost_ceil_w: line.wizard_cost_ceil_w || 3,
          wizard_cost_ceil_h: line.wizard_cost_ceil_h || 3,
          wizard_cost_ceil_w_custom_mm: line.wizard_cost_ceil_w_custom_mm || 30,
          wizard_cost_ceil_h_custom_mm: line.wizard_cost_ceil_h_custom_mm || 30,
          wizard_cep_cost_rate: line.wizard_cep_cost_rate ?? 5,
          ceiling_w_custom_mm: line.ceiling_w_custom_mm || 30,
          ceiling_h_custom_mm: line.ceiling_h_custom_mm || 30,
          cep_polish_rate: line.cep_polish_rate || 15,
          cep_polish_rate_custom: line.cep_polish_rate_custom ?? null,
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
        _charged_w_manual: line._charged_w_manual || false,
        _charged_h_manual: line._charged_h_manual || false,
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

  // ── Calculation engine shared with QuotationForm ──
  const getGroupBaseCostRate = (g, prods = products) => sharedGetGroupBaseCostRate(g, prods)
  const getGroupLoadedCostRate = (g, prods = products) => sharedGetGroupLoadedCostRate(g, prods)
  const calcGroupSize = (group, size) => sharedCalcGroupSize(group, size, products)

  const autoSuggestProcesses = (group) => []

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

      if (!updatedGroup.custom_costing && (updatedGroup.is_toughened || updatedGroup.glass_type === 'Toughened')) {
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
                    ['hole', 'cutout', 'farma', 'beveling'].includes(x.process_type)
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
        wizard_cost_ceil_w: g.wizard_cost_ceil_w ?? 3,
        wizard_cost_ceil_h: g.wizard_cost_ceil_h ?? 3,
        wizard_cost_ceil_w_custom_mm: g.wizard_cost_ceil_w_custom_mm ?? 30,
        wizard_cost_ceil_h_custom_mm: g.wizard_cost_ceil_h_custom_mm ?? 30,
        wizard_cep_cost_rate: g.wizard_cep_cost_rate ?? 5,
        ceiling_w_custom_mm: g.ceiling_w_custom_mm ?? 30,
        ceiling_h_custom_mm: g.ceiling_h_custom_mm ?? 30,
        cep_polish_rate: g.cep_polish_rate ?? 15,
        cep_polish_rate_custom: g.cep_polish_rate_custom ?? null,
        artwork_master_id: g.artwork_master_id || null,
        artwork_name: g.artwork_name || null,
        artwork_file_data: g.artwork_file_data || null,
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
        _charged_w_manual: s._charged_w_manual || false,
        _charged_h_manual: s._charged_h_manual || false,
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
        const mappedGroups = record.groups.map(g => ({
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
        }))
        mappedGroups.forEach(g => {
          g.sizes = g.sizes.map(s => {
            const autoW = parseFloat(getAutoChargedDim(g, s.width_inch || 0, 'w').toFixed(4))
            const autoH = parseFloat(getAutoChargedDim(g, s.height_inch || 0, 'h').toFixed(4))
            if (!s._charged_w_manual && s.charged_w_inch > 0 && Math.abs(s.charged_w_inch - autoW) > 0.01) {
              s._charged_w_manual = true
            }
            if (!s._charged_h_manual && s.charged_h_inch > 0 && Math.abs(s.charged_h_inch - autoH) > 0.01) {
              s._charged_h_manual = true
            }
            return calcGroupSize(g, s)
          })
        })
        setGroups(mappedGroups)
      } else if (record.lines?.length) {
        const reconstructed = reconstructGroups(record.lines)
        if (record.groups?.length) {
          reconstructed.forEach((g, idx) => {
            const saved = record.groups[idx]
            if (saved?.manual_cost_price) g.manual_cost_price = saved.manual_cost_price
            if (saved?.wizard_cost_ceil_w) g.wizard_cost_ceil_w = saved.wizard_cost_ceil_w
            if (saved?.wizard_cost_ceil_h) g.wizard_cost_ceil_h = saved.wizard_cost_ceil_h
            if (saved?.wizard_cep_cost_rate != null) g.wizard_cep_cost_rate = saved.wizard_cep_cost_rate
            if (saved?.target_margin) g.target_margin = saved.target_margin
          })
        }
        reconstructed.forEach(g => {
          g.sizes = g.sizes.map(s => {
            const autoW = parseFloat(getAutoChargedDim(g, s.width_inch || 0, 'w').toFixed(4))
            const autoH = parseFloat(getAutoChargedDim(g, s.height_inch || 0, 'h').toFixed(4))
            if (!s._charged_w_manual && s.charged_w_inch > 0 && Math.abs(s.charged_w_inch - autoW) > 0.01) {
              s._charged_w_manual = true
            }
            if (!s._charged_h_manual && s.charged_h_inch > 0 && Math.abs(s.charged_h_inch - autoH) > 0.01) {
              s._charged_h_manual = true
            }
            return calcGroupSize(g, s)
          })
        })
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

    let glassCostTotal = allSizes.reduce((s, x) => s + (x.cost_amount || 0), 0)
    let procCostTotal = allGroupProcesses.reduce((s, p) => {
      const procCostRate = p.cost_rate ?? (p.rate * 0.70)
      return s + ((p.qty_area || 0) * procCostRate)
    }, 0)

    const sellableCost = glassCostTotal + procCostTotal + hwCostTotal + lbCostTotal + wstCostTotal + (dcCost || 0)
    const sellableTotal = subIII - (dcCharges || 0)
    const marginAmt = sellableTotal - sellableCost
    const marginPct = sellableCost > 0 ? (marginAmt / sellableCost) * 100 : 100

    return {
      subI, procTotal, hwTotal, lbTotal, wstTotal, dcCharges, dcCost, subII,
      discountAmt, subIII, cgst, sgst, igst,
      grandTotal, advanceRec, balance,
      totalCost: sellableCost, marginAmt, marginPct,
      hwCostTotal, lbCostTotal, wstCostTotal
    }
  }, [groups, hardwareItems, laborItems, wastageItems, dcCharges, dcCost, discountAmt, advanceRec, gstMode, products])

  const flushWizardRowsToSizes = () => {
    if (!compWizard?.group_key || !Array.isArray(compWizard.rows)) return
    setGroups(prev => prev.map(g => {
      if (g.group_key !== compWizard.group_key) return g
      const ceilFn = (x, c, customMm) => {
        if (c === 'plus30mm') return x + (30 / 25.4)
        if (c === 'custom') return x + ((customMm || 30) / 25.4)
        return Math.ceil(x / c) * c
      }
      const sizes = g.sizes.map((s, i) => {
        const r = compWizard.rows[i]
        if (!r) return s
        const autoW = parseFloat(ceilFn(r._w_raw || 0, r.cost_ceil_w || 3, g.wizard_cost_ceil_w_custom_mm || 30).toFixed(4))
        const autoH = parseFloat(ceilFn(r._h_raw || 0, r.cost_ceil_h || 3, g.wizard_cost_ceil_h_custom_mm || 30).toFixed(4))
        const wManual = (r.cost_charged_w > 0) && Math.abs(r.cost_charged_w - autoW) > 0.001
        const hManual = (r.cost_charged_h > 0) && Math.abs(r.cost_charged_h - autoH) > 0.001
        return {
          ...s,
          cost_ceil_w: r.cost_ceil_w,
          cost_ceil_h: r.cost_ceil_h,
          cost_charged_w: r.cost_charged_w,
          cost_charged_h: r.cost_charged_h,
          _cost_charged_w_manual: wManual,
          _cost_charged_h_manual: hManual,
          cost_charged_sqft: parseFloat(r.charged_sqft) || 0,
          glass_cost: r.glass_cost || 0,
          cep_cost: r.cep_cost || 0,
          proc_cost: r.proc_cost || 0,
          cost_amount: r.cost_amount || 0,
          margin_amount: r.margin_amount || 0,
          margin_pct: r.margin_pct || 0,
        }
      })
      return { ...g, sizes }
    }))
  }

  const openComparisonWizard = (group) => {
    setWizardCostPrice(null)
    setCompWizard(null)

    const { loadedCost: costPerSqft, baseCost: wizardBaseCost, addon: wizardCostAddon } = getGroupLoadedCostRate(group, products)
    setWizardCostPrice(costPerSqft)

    const CEP_COST_RATE = 5

    const rows = group.sizes.map((s, i) => {
      const w = s.width_inch || 0
      const h = s.height_inch || 0
      const qty = s.quantity || 1

      const selling_sqft = s.total_sqft || 0
      const selling_amount = s.subtotal || 0

      const cost_ceil_w = s.cost_ceil_w || group.wizard_cost_ceil_w || 3
      const cost_ceil_h = s.cost_ceil_h || group.wizard_cost_ceil_h || 3
      const cost_charged_w = s.cost_charged_w !== undefined ? s.cost_charged_w : w
      const cost_charged_h = s.cost_charged_h !== undefined ? s.cost_charged_h : h
      const charged_sqft = (s.cost_charged_sqft !== undefined && s.cost_charged_sqft !== null)
        ? s.cost_charged_sqft : (s.charged_sqft || 0)
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
        width_display: soUnit === 'inch' ? `${toFraction(w)}"` : `${(w * 25.4).toFixed(1)}mm`,
        height_display: soUnit === 'inch' ? `${toFraction(h)}"` : `${(h * 25.4).toFixed(1)}mm`,
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

    const glassSellingTotal = rows.reduce((s, r) => s + r.selling_amount, 0)
    const glassCostTotal = rows.reduce((s, r) => s + (r.glass_cost || 0), 0)
    const totalCepCost = rows.reduce((s, r) => s + (r.cep_cost || 0), 0)
    const totalSizeProcCost = rows.reduce((s, r) => s + (r.proc_cost || 0), 0)

    const procSelling = (group.processes || []).reduce((s, p) => s + (p.amount || 0), 0)
    const groupProcCost = parseFloat(((group.processes || []).reduce((s, p) => {
      const cr = p.cost_rate ?? ((p.rate || 0) * 0.70)
      return s + (p.qty_area || 0) * cr
    }, 0)).toFixed(2))

    const sizeProcSelling = (group.sizes || [])
      .flatMap(s => s.size_processes || [])
      .reduce((s, p) => s + (p.amount || 0), 0)

    const totalProcSelling = procSelling + sizeProcSelling

    const totalSelling = parseFloat((glassSellingTotal).toFixed(2))
    const totalCost = parseFloat((glassCostTotal + totalCepCost + totalSizeProcCost + groupProcCost).toFixed(2))

    const totalMargin = parseFloat((totalSelling - totalCost).toFixed(2))
    const totalMarginPct = totalCost > 0
      ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100

    setCompWizard({
      product_name: group.description || 'Product',
      cost_price: costPerSqft,
      cost_base: wizardBaseCost,
      cost_addon: wizardCostAddon,
      selling_rate: group.rate,
      cep_on: group.cep,
      cep_cost_rate: (typeof group.wizard_cep_cost_rate === 'number' || group.wizard_cep_cost_rate === 'custom') ? group.wizard_cep_cost_rate : 5,
      cost_ceil_w: group.wizard_cost_ceil_w || 3,
      cost_ceil_h: group.wizard_cost_ceil_h || 3,
      cost_ceil_w_custom_mm: group.wizard_cost_ceil_w_custom_mm || 30,
      cost_ceil_h_custom_mm: group.wizard_cost_ceil_h_custom_mm || 30,
      rows,
      glassSellingTotal,
      totalProcSelling,
      totalSelling, totalCost, totalCepCost, totalMargin, totalMarginPct,
      group_key: group.group_key,
    })
  }

  const saveMutation = useMutation({
    onSuccess: (res) => {
      message.success(`SO ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['sales_orders'] })
      if (!isEdit && res?.data?.id) navigate(`/sales-orders/${res.data.id}/edit`)
    },
    mutationFn: (data) => isEdit ? salesOrderApi.update(id, data) : salesOrderApi.create(data),
  })

  const statusMutation = useMutation({
    mutationFn: async (newStatus) => {
      await salesOrderApi.changeStatus(id, newStatus)

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

  const handleQuotationChange = async (val) => {
    if (!val) return
    try {
      const res = await quotationApi.get(val)
      const quotation = res.data

      form.setFieldsValue({
        customer_id: quotation.customer_id,
        payment_terms: quotation.payment_terms,
        salesperson: quotation.salesperson,
        notes: quotation.customer_notes,
      })

      if (quotation.groups?.length) {
        const mappedGroups = quotation.groups.map(g => ({
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
        }))
        // Recalculate
        mappedGroups.forEach(g => {
          g.sizes = g.sizes.map(s => calcGroupSize(g, s))
        })
        setGroups(mappedGroups)
      }

      if (quotation.hardware_items?.length) {
        setHardwareItems(quotation.hardware_items.map((h, i) => ({
          hw_key: h.hw_key || Date.now() + Math.random() + i,
          ...h
        })))
      }
      if (quotation.labor_items?.length) {
        setLaborItems(quotation.labor_items.map((l, i) => ({
          lb_key: l.lb_key || Date.now() + Math.random() + i,
          ...l
        })))
      }
      if (quotation.wastage_items?.length) {
        setWastageItems(quotation.wastage_items.map((w, i) => ({
          wst_key: w.wst_key || Date.now() + Math.random() + i,
          ...w
        })))
      }
      if (quotation.customer_notes) {
        form.setFieldValue('notes', quotation.customer_notes)
      }
      message.success('Copied lines and details from Quotation reference!')
    } catch (e) {
      message.error('Failed to load quotation details')
    }
  }

  const status = record?.status || 'draft'
  const soId = id ? parseInt(id) : null

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
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <ActionToolbar
        type="sales_order"
        status={status}
        isEdit={isEdit}
        onGeneratePDF={async () => {
          const recordData = {
            ...form.getFieldsValue(),
            so_number: record?.so_number,
            company_id: form.getFieldValue('company_id') || record?.company_id || 1,
            customer_id: form.getFieldValue('customer_id') || record?.customer_id,
            customer_name: form.getFieldValue('customer_name') || record?.customer_name,
            order_date: form.getFieldValue('order_date') || record?.order_date,
            delivery_date: form.getFieldValue('delivery_date') || record?.delivery_date,
            salesperson: form.getFieldValue('salesperson') || record?.salesperson,
            payment_terms: form.getFieldValue('payment_terms') || record?.payment_terms,
            gst_mode: gstMode,
            discount_amount: discountAmt,
            dc_charges: dcCharges,
            advance_received: advanceRec,
            lines: getFlatLines(),
            groups,
            hardware_items: hardwareItems,
            labor_items: laborItems,
            wastage_items: wastageItems,
            totals,
            subtotal: totals.subI,
            tax_amount: totals.cgst + totals.sgst + totals.igst,
            total_amount: totals.grandTotal
          }
          const hide = message.loading('Generating Proforma Invoice PDF...', 0)
          try {
            await generateSOPDF(recordData)
          } catch (err) {
            message.error('Failed to generate PDF')
          } finally {
            hide()
          }
        }}
        onConfirm={() => statusMutation.mutate('confirmed')}
        isConfirming={statusMutation.isPending && statusMutation.variables === 'confirmed'}
        onCreatePO={() => createPOMutation.mutate()}
        isCreatingPO={createPOMutation.isPending}
        onProduction={() => statusMutation.mutate('in_production')}
        isStartingProduction={statusMutation.isPending && statusMutation.variables === 'in_production'}
        onReady={() => statusMutation.mutate('ready')}
        isMarkingReady={statusMutation.isPending && statusMutation.variables === 'ready'}
        onCreateDelivery={() => createDCMutation.mutate()}
        isCreatingDelivery={createDCMutation.isPending}
        onCreateInvoice={() => createInvoiceMutation.mutate()}
        isCreatingInvoice={createInvoiceMutation.isPending}
      />

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
            onClick={() => navigate(`/workshop/orders/new?so_id={id}`)}
          >
            + New WO
          </Button>
        </div>
      )}

      <Form form={form} layout="vertical" initialValues={{ status: 'draft' }}>
        <CompanySelector form={form} />

        <Row gutter={16}>
          <Col xs={24} lg={18}>
            {/* Details Card */}
            <QuotationDetailsCard
              form={form}
              unit={soUnit}
              setUnit={setSoUnit}
              customers={customers}
              employees={employees}
              paymentTerms={PAYMENT_TERMS}
              handleCustomerChange={(val) => {
                const c = customers.find(x => x.id === val)
                if (c) form.setFieldsValue({ payment_terms: c.payment_terms })
              }}
              customerApi={customerApi}
              employeeApi={employeeApi}
              queryClient={queryClient}
              message={message}
              type="sales_order"
              warehouses={warehouses}
              quotations={quotations}
              handleQuotationChange={handleQuotationChange}
            />

            {/* Glass line items */}
            <Divider orientation="left" style={{ color: '#3b82f6', marginTop: 24, fontSize: 15, fontWeight: 600 }}>Glass Items</Divider>
            {groups.map((group, gi) => (
              <GlassCard
                key={group.group_key}
                group={group}
                gi={gi}
                unit={soUnit}
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

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addGroup}
              style={{ width: '100%', marginBottom: 20, height: 40, borderRadius: 10, fontWeight: 500 }}
            >
              Add Product Group
            </Button>

            {/* Hardware Card */}
            <HardwareCard
              hardwareItems={hardwareItems}
              setHardwareItems={setHardwareItems}
              getUomRates={getUomRates}
            />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderColor: '#d97706', color: '#d97706', borderRadius: 8 }} onClick={() => setHardwareItems(prev => [...prev, emptyHardware()])}>
                + Add Hardware
              </Button>
            </div>

            {/* Labour Card */}
            <LabourCard
              laborItems={laborItems}
              setLaborItems={setLaborItems}
              getUomRates={getUomRates}
            />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderColor: '#7c3aed', color: '#7c3aed', borderRadius: 8 }} onClick={() => setLaborItems(prev => [...prev, emptyLabor()])}>
                + Add Labor Charge
              </Button>
            </div>

            {/* Wastage Card */}
            <WastageCard
              wastageItems={wastageItems}
              setWastageItems={setWastageItems}
            />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <Button type="dashed" icon={<PlusOutlined />} style={{ borderColor: '#e11d48', color: '#e11d48', borderRadius: 8 }} onClick={() => setWastageItems(prev => [...prev, emptyWastage()])}>
                + Add Wastage
              </Button>
            </div>

            {/* Notes Card */}
            <NotesCard />

            {/* Cost Analysis Card */}
            <CostAnalysisCard
              groups={groups}
              products={products}
            />
          </Col>

          {/* Right Summary Sidebar */}
          <Col xs={24} lg={6}>
            <StickySummary
              totals={totals}
              gstMode={gstMode}
              setGstMode={setGstMode}
            />
          </Col>
        </Row>
      </Form>

      {/* ── Modal: Cost vs Selling (Per-Product) ── */}
      <Modal title={<Space><LineChartOutlined style={{ color: '#6366f1' }} /><span>Cost vs Selling — {compWizard?.product_name}</span></Space>}
        open={compWizard !== null} onCancel={() => { flushWizardRowsToSizes(); setCompWizard(null); setWizardCostPrice(null) }} width={820}
        footer={<Space>
          <Button style={{ borderColor: '#10b981', color: '#10b981' }} disabled={!wizardCostPrice || wizardCostPrice <= 0}
            onClick={() => { flushWizardRowsToSizes(); if (compWizard?.group_key && wizardCostPrice > 0) { updateGroup(compWizard.group_key, 'manual_cost_price', wizardCostPrice); message.success(`Cost price ₹${wizardCostPrice}/sqft saved`) } setCompWizard(null); setWizardCostPrice(null) }}>
            Save Cost Price Only
          </Button>
          <Button onClick={() => { flushWizardRowsToSizes(); setCompWizard(null); setWizardCostPrice(null) }}>Close</Button>
        </Space>}>
        {compWizard && (<>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}><Card size="small" style={{ background: '#f0fdf4', borderColor: '#86efac' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Text type="secondary">Selling Rate (Current)</Text><Tag color="green" style={{ fontSize: 10, margin: 0 }}>LOCKED</Tag></div><div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>₹{compWizard.selling_rate}/sqft</div><Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>Cost ceiling changes do NOT affect this</Text></Card></Col>
            <Col span={12}><Card size="small" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}><Text type="secondary">Cost Price (editable, fully loaded)</Text><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <InputNumber value={wizardCostPrice !== null && wizardCostPrice !== undefined ? wizardCostPrice : compWizard.cost_price} min={0} prefix="₹" addonAfter="/sqft" style={{ width: '100%' }}
                onChange={val => {
                  setWizardCostPrice(val); const newCost = val || 0
                  const newRows = compWizard.rows.map(r => { const glass_cost = parseFloat(((r.cost_charged_w && r.cost_charged_h ? (r.cost_charged_w * r.cost_charged_h * r.quantity) / 144 : parseFloat(r.charged_sqft)) * newCost).toFixed(2)); const cost_amount = parseFloat((glass_cost + (r.cep_cost || 0) + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...r, glass_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_base_overridden: true }))
                }} />
            </div>
            {compWizard.cost_addon > 0 && !compWizard.cost_base_overridden && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, color: '#9a3412' }}>
                Base ₹{compWizard.cost_base.toFixed(2)} + Tgh addon ₹{compWizard.cost_addon.toFixed(2)} = ₹{(compWizard.cost_base + compWizard.cost_addon).toFixed(2)}/sqft
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>Edit to recalculate margin live</Text></Card></Col>
          </Row>

          {compWizard.cep_on && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>CEP (Polish - 4 sides)</strong> cost:
              <Select size="small" value={[5,7,15].includes(compWizard.cep_cost_rate) ? compWizard.cep_cost_rate : 'custom'} style={{ width: 110 }}
                options={[{ value: 5, label: '₹5/rft' }, { value: 7, label: '₹7/rft' }, { value: 15, label: '₹15/rft' }, { value: 'custom', label: 'Custom' }]}
                onChange={val => {
                  if (val === 'custom') { setCompWizard(prev => ({ ...prev, cep_cost_rate: 'custom' })); if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', 'custom'); return }
                  const newRate = typeof val === 'number' ? val : null; if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', newRate)
                  const newRows = compWizard.rows.map(r => { const cep_cost = parseFloat((parseFloat(r.actual_rft) * (typeof newRate === 'number' ? newRate : 5)).toFixed(2)); const cost_amount = parseFloat((r.glass_cost + cep_cost + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...r, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cep_cost_rate: newRate }))
                }} />
              {(compWizard.cep_cost_rate === 'custom' || (![5, 7, 15].includes(compWizard.cep_cost_rate) && compWizard.cep_cost_rate != null)) && (
                <InputNumber size="small" min={0} prefix="₹" placeholder="Enter rate" style={{ width: 120 }}
                  value={typeof compWizard.cep_cost_rate === 'number' ? compWizard.cep_cost_rate : undefined}
                  onChange={val => {
                    const newRate = typeof val === 'number' ? val : 'custom'; if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cep_cost_rate', newRate)
                    const newRows = compWizard.rows.map(r => { const cep_cost = parseFloat((parseFloat(r.actual_rft) * (typeof newRate === 'number' ? newRate : 5)).toFixed(2)); const cost_amount = parseFloat((r.glass_cost + cep_cost + (r.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((r.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...r, cep_cost, cost_amount, margin_amount, margin_pct } })
                    const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                    setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cep_cost_rate: newRate }))
                  }} />
              )}
              <Text style={{ color: '#6d28d9', fontSize: 12 }}>× Actual running ft per size</Text>
            </div>
          )}

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Cost Ceiling:</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>W:</Text>
              <Select size="small" value={compWizard.cost_ceil_w} style={{ width: 140 }}
                options={[{ value: 3, label: '3" (Tight)' }, { value: 6, label: '6" (Standard)' }, { value: 'plus30mm', label: '+30mm' }, { value: 'custom', label: 'Custom mm' }]}
                onChange={val => {
                  const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                  const customMm = compWizard.cost_ceil_w_custom_mm || 30
                  const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : c === 'custom' ? x + (customMm / 25.4) : Math.ceil(x / c) * c
                  const newRows = compWizard.rows.map(row => { const cost_charged_w = parseFloat(costCeilFn(row._w_raw || 0, val).toFixed(4)); const cost_charged_h = row.cost_charged_h || 0; const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (typeof compWizard.cep_cost_rate === 'number' ? compWizard.cep_cost_rate : 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_ceil_w: val, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_w: val }))
                  if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_w', val)
                }} />
              {compWizard.cost_ceil_w === 'custom' && (
                <InputNumber
                  size="small"
                  value={compWizard.cost_ceil_w_custom_mm ?? 30}
                  min={1} max={500}
                  addonAfter="mm"
                  style={{ width: 110 }}
                  onChange={val => {
                    const mm = val || 30
                    const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                    const costCeilFn = (x) => x + (mm / 25.4)
                    const newRows = compWizard.rows.map(row => { const cost_charged_w = parseFloat(costCeilFn(row._w_raw || 0).toFixed(4)); const cost_charged_h = row.cost_charged_h || 0; const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (typeof compWizard.cep_cost_rate === 'number' ? compWizard.cep_cost_rate : 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                    const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                    setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_w_custom_mm: mm }))
                    if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_w_custom_mm', mm)
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>H:</Text>
              <Select size="small" value={compWizard.cost_ceil_h} style={{ width: 140 }}
                options={[{ value: 3, label: '3" (Tight)' }, { value: 6, label: '6" (Standard)' }, { value: 'plus30mm', label: '+30mm' }, { value: 'custom', label: 'Custom mm' }]}
                onChange={val => {
                  const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                  const customMm = compWizard.cost_ceil_h_custom_mm || 30
                  const costCeilFn = (x, c) => c === 'plus30mm' ? x + (30 / 25.4) : c === 'custom' ? x + (customMm / 25.4) : Math.ceil(x / c) * c
                  const newRows = compWizard.rows.map(row => { const cost_charged_w = row.cost_charged_w || 0; const cost_charged_h = parseFloat(costCeilFn(row._h_raw || 0, val).toFixed(4)); const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (typeof compWizard.cep_cost_rate === 'number' ? compWizard.cep_cost_rate : 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_ceil_h: val, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                  const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                  setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_h: val }))
                  if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_h', val)
                }} />
              {compWizard.cost_ceil_h === 'custom' && (
                <InputNumber
                  size="small"
                  value={compWizard.cost_ceil_h_custom_mm ?? 30}
                  min={1} max={500}
                  addonAfter="mm"
                  style={{ width: 110 }}
                  onChange={val => {
                    const mm = val || 30
                    const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0
                    const costCeilFn = (x) => x + (mm / 25.4)
                    const newRows = compWizard.rows.map(row => { const cost_charged_w = row.cost_charged_w || 0; const cost_charged_h = parseFloat(costCeilFn(row._h_raw || 0).toFixed(4)); const qty = row.quantity || 1; const charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144; const glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)); const cep_cost = parseFloat((parseFloat(row.actual_rft) * (typeof compWizard.cep_cost_rate === 'number' ? compWizard.cep_cost_rate : 5)).toFixed(2)); const cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)); const margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)); const margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } })
                    const totalCost = newRows.reduce((s, r) => s + r.cost_amount, 0); const totalCepCost = newRows.reduce((s, r) => s + (r.cep_cost || 0), 0); const totalMargin = compWizard.totalSelling - totalCost; const totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100
                    setCompWizard(prev => ({ ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct, cost_ceil_h_custom_mm: mm }))
                    if (compWizard.group_key) updateGroup(compWizard.group_key, 'wizard_cost_ceil_h_custom_mm', mm)
                  }}
                />
              )}
            </div>
          </div>

          <Table dataSource={compWizard.rows} pagination={false} size="small" scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Size', key: 'size', width: 130, render: (_, r) => <Text strong style={{ fontSize: 12 }}>{r.label}. {r.width_display} × {r.height_display}</Text> },
              { title: 'Qty', dataIndex: 'quantity', width: 45 },
              { title: 'Charged Sqft', dataIndex: 'selling_sqft', width: 90, render: v => <Text>{v}</Text> },
              { title: 'Cost Sqft', dataIndex: 'charged_sqft', width: 90, render: v => <Text type="secondary">{v}</Text> },
              { title: 'Actual Rft', dataIndex: 'actual_rft', width: 80, render: v => <Text type="secondary">{v}</Text> },
              { title: 'Cost Chg W', key: 'cost_chg_w', width: 90, align: 'center', render: (_, r) => <InputNumber size="small" value={r.cost_charged_w ? parseFloat(r.cost_charged_w.toFixed(3)) : null} min={0} step={0.5} style={{ width: '100%', borderColor: '#6366f1' }} onChange={val => { const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; setCompWizard(prev => { const newRows = prev.rows.map(row => { if (row.key !== r.key) return row; const cost_charged_w = val || 0, cost_charged_h = row.cost_charged_h || 0, qty = row.quantity || 1, charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144, glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)), cep_cost = typeof prev.cep_cost_rate === 'number' ? parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2)) : row.cep_cost || 0, cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)), margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)), margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_w, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } }); const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0), totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0), totalMargin = prev.totalSelling - totalCost, totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100; return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct } }) }} /> },
              { title: 'Cost Chg H', key: 'cost_chg_h', width: 90, align: 'center', render: (_, r) => <InputNumber size="small" value={r.cost_charged_h ? parseFloat(r.cost_charged_h.toFixed(3)) : null} min={0} step={0.5} style={{ width: '100%', borderColor: '#6366f1' }} onChange={val => { const effectiveCostPrice = wizardCostPrice ?? compWizard?.cost_price ?? 0; setCompWizard(prev => { const newRows = prev.rows.map(row => { if (row.key !== r.key) return row; const cost_charged_w = row.cost_charged_w || 0, cost_charged_h = val || 0, qty = row.quantity || 1, charged_sqft = (cost_charged_w * cost_charged_h * qty) / 144, glass_cost = parseFloat((charged_sqft * effectiveCostPrice).toFixed(2)), cep_cost = typeof prev.cep_cost_rate === 'number' ? parseFloat((parseFloat(row.actual_rft) * prev.cep_cost_rate).toFixed(2)) : row.cep_cost || 0, cost_amount = parseFloat((glass_cost + cep_cost + (row.proc_cost || 0)).toFixed(2)), margin_amount = parseFloat((row.selling_amount - cost_amount).toFixed(2)), margin_pct = cost_amount > 0 ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2)) : 100; return { ...row, cost_charged_h, charged_sqft: charged_sqft.toFixed(3), glass_cost, cep_cost, cost_amount, margin_amount, margin_pct } }); const totalCost = newRows.reduce((s, row) => s + row.cost_amount, 0), totalCepCost = newRows.reduce((s, row) => s + (row.cep_cost || 0), 0), totalMargin = prev.totalSelling - totalCost, totalMarginPct = totalCost > 0 ? parseFloat(((totalMargin / totalCost) * 100).toFixed(2)) : 100; return { ...prev, rows: newRows, totalCost, totalCepCost, totalMargin, totalMarginPct } }) }} /> },
              { title: 'Selling Amt', dataIndex: 'selling_amount', width: 100, align: 'right', render: v => <Text strong style={{ color: '#16a34a' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              { title: 'Glass Cost', dataIndex: 'glass_cost', width: 100, align: 'right', render: v => <Text style={{ color: '#ea580c' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              { title: 'Proc Cost', dataIndex: 'proc_cost', width: 90, align: 'right', render: v => <Text style={{ color: '#f59e0b' }}>₹{Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
              ...(compWizard.cep_on ? [{ title: <span>CEP Cost<br /><Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>Rft × ₹{compWizard.cep_cost_rate}</Text></span>, dataIndex: 'cep_cost', width: 100, align: 'right', render: v => <Text style={{ color: '#7c3aed' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> }] : []),
              { title: 'Total Cost', dataIndex: 'cost_amount', width: 100, align: 'right', render: v => <Text strong style={{ color: '#dc2626' }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
            ]} />

          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={[12, 8]}>
            <Col span={6}><Text type="secondary">Glass Selling</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>₹{compWizard.glassSellingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>
            {(compWizard.totalProcSelling || 0) > 0 && <Col span={6}><Text type="secondary">Selling Process Charges</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>₹{(compWizard.totalProcSelling || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>}
            {(compWizard.rows?.reduce((s, r) => s + (r.proc_cost || 0), 0) || 0) > 0 && <Col span={6}><Text type="secondary">Costing Process Charges</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>₹{(compWizard.rows?.reduce((s, r) => s + (r.proc_cost || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>}
            <Col span={6}><Text type="secondary">Total Cost</Text><div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>₹{compWizard.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div><Text type="secondary" style={{ fontSize: 10 }}>Glass + CEP + Process</Text></Col>
            <Col span={6}><Text type="secondary">Margin</Text><div style={{ fontSize: 15, fontWeight: 700, color: compWizard.totalMargin >= 0 ? '#16a34a' : '#dc2626' }}>₹{compWizard.totalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></Col>
            <Col span={6}><Text type="secondary">Margin %</Text><div style={{ fontSize: 22, fontWeight: 800, color: compWizard.totalMarginPct >= 20 ? '#16a34a' : compWizard.totalMarginPct >= 10 ? '#f59e0b' : '#dc2626' }}>{compWizard.totalMarginPct}%</div></Col>
          </Row>
        </>)}
      </Modal>
    </MasterForm>
  )
}

export default SalesOrderForm
