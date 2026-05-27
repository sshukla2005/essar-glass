import re

content = """import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Tabs, DatePicker, Button, Table, Steps, Space, Tag, Popconfirm, Switch, App, Collapse, Checkbox, Typography, Radio, Tooltip, Modal, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, ShoppingCartOutlined, DownloadOutlined, LineChartOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import MasterForm from '../../components/common/MasterForm'
import { quotationApi, customerApi, productApi, salesOrderApi, processMasterApi } from '../../api'
import { generateQuotationPDF } from '../../utils/pdfGenerator'

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

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'converted']
const STATUS_IDX = { draft: 0, sent: 1, confirmed: 2, converted: 3, cancelled: 0 }

const emptySize = () => ({
  size_key: Date.now() + Math.random(),
  width_inch: null,
  height_inch: null,
  quantity: 1,
  area_sqft_pc: 0, total_sqft: 0, running_ft: 0,
  charged_sqft: 0, cep_rft: 0, tgh_sqmt: 0,
  subtotal: 0, tax_amount: 0, line_total: 0
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
  product_id: null,
  description: '',
  rate: 0,
  rate_rft: 0,
  cep: false,
  pricing_method: 'per_sqft',
  discount_pct: 0,
  tax_rate: 18,
  sizes: [emptySize()],
  processes: []
})

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
  const [isInterState, setIsInterState] = useState(false)
  
  const [compWizard, setCompWizard] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const fileInputRef = useRef(null)

  const { data: record, isLoading } = useQuery({
    queryKey: ['quotations', id], queryFn: () => quotationApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: processMasters = [] } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })

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
      const gkey = line.product_id || `solo_${i}`
      if (!groupMap.has(gkey)) {
        groupMap.set(gkey, {
          group_key: Date.now() + Math.random() + i,
          product_id: line.product_id,
          description: line.description || '',
          rate: line.rate || line.unit_price || 0,
          rate_rft: line.rate_rft || 0,
          cep: line.cep || false,
          pricing_method: line.pricing_method || 'per_sqft',
          discount_pct: line.discount_pct || 0,
          tax_rate: line.tax_rate || 18,
          sizes: [],
          processes: (line.processes || []).map(p => ({
            ...p,
            proc_key: Date.now() + Math.random() + i,
          }))
        })
      }
      groupMap.get(gkey).sizes.push({
        size_key: Date.now() + Math.random() + i,
        width_inch: line.width_inch || (line.width_mm ? line.width_mm/25.4 : null),
        height_inch: line.height_inch || (line.height_mm ? line.height_mm/25.4 : null),
        quantity: line.quantity || 1,
        area_sqft_pc: line.area_sqft_pc || 0,
        total_sqft: line.total_sqft || 0,
        running_ft: line.running_ft || 0,
        charged_sqft: line.charged_sqft || 0,
        cep_rft: line.cep_rft || 0,
        tgh_sqmt: line.tgh_sqmt || 0,
        subtotal: line.subtotal || 0,
        tax_amount: line.tax_amount || 0,
        line_total: line.line_total || 0,
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
      if (record.lines?.length) setGroups(reconstructGroups(record.lines))
      setIsInterState(record.is_inter_state || false)
    }
  }, [record, form])

  const calcGroupSize = (group, size) => {
    const w_inch = size.width_inch || 0
    const h_inch = size.height_inch || 0
    const qty    = size.quantity || 1
    const ceil6  = (x) => Math.ceil(x / 6) * 6
    const ceil3  = (x) => Math.ceil(x / 3) * 3
    const area_sqft_pc = (ceil6(w_inch) * ceil6(h_inch)) / 144
    const total_sqft   = area_sqft_pc * qty
    const running_ft   = (w_inch + h_inch) * 2 * qty / 12
    const charged_sqft = (ceil3(w_inch) * ceil3(h_inch) * qty) / 144
    const cep_rft      = (w_inch + h_inch) * 2 / 12 * qty * 7
    const tgh_sqmt     = ((size.width_inch||0)*25.4+30) * ((size.height_inch||0)*25.4+30) * qty / 1000000

    let effective_qty = 0
    if (group.pricing_method === 'per_sqft') 
      effective_qty = group.cep ? charged_sqft : total_sqft
    else if (group.pricing_method === 'per_rft') effective_qty = running_ft
    else effective_qty = qty

    const sqft_amt = effective_qty * (group.rate || 0)
    const rft_amt  = running_ft * (group.rate_rft || 0)
    let subtotal   = (sqft_amt + rft_amt) * (1 - (group.discount_pct||0) / 100)
    subtotal       = parseFloat(subtotal.toFixed(2))
    const tax_amt  = parseFloat((subtotal * (group.tax_rate||18) / 100).toFixed(2))
    const line_total = parseFloat((subtotal + tax_amt).toFixed(2))

    return {
      ...size,
      area_sqft_pc: parseFloat(area_sqft_pc.toFixed(4)),
      total_sqft:   parseFloat(total_sqft.toFixed(4)),
      running_ft:   parseFloat(running_ft.toFixed(4)),
      charged_sqft: parseFloat(charged_sqft.toFixed(4)),
      cep_rft:      parseFloat(cep_rft.toFixed(4)),
      tgh_sqmt:     parseFloat(tgh_sqmt.toFixed(6)),
      effective_qty:parseFloat(effective_qty.toFixed(4)),
      subtotal, tax_amount: tax_amt, line_total
    }
  }

  const autoSuggestProcesses = (group) => {
    const suggested = []
    const allSizes = group.sizes || []
    
    const totalSqft = allSizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
    const totalRft  = allSizes.reduce((s, sz) => s + (sz.running_ft || 0), 0)
    const totalSqmt = allSizes.reduce((s, sz) => s + (sz.tgh_sqmt   || 0), 0)
    const totalPcs  = allSizes.reduce((s, sz) => s + (sz.quantity   || 0), 0)
  
    const cuttingProc    = processMasters.find(p => p.process_type === 'cutting')
    const toughProc      = processMasters.find(p => p.process_type === 'toughening')
    const polishProc     = processMasters.find(p => p.process_type === 'polishing')
  
    if (cuttingProc) {
      suggested.push({
        proc_key: Date.now() + Math.random(),
        process_id: cuttingProc.id,
        charge_type: cuttingProc.charge_type,
        qty_area: parseFloat(totalSqft.toFixed(3)),
        rate: cuttingProc.rate,
        amount: parseFloat((totalSqft * cuttingProc.rate).toFixed(2)),
      })
    }
  
    if (group.cep && toughProc) {
      suggested.push({
        proc_key: Date.now() + Math.random(),
        process_id: toughProc.id,
        charge_type: toughProc.charge_type,
        qty_area: parseFloat(totalSqmt.toFixed(4)),
        rate: toughProc.rate,
        amount: parseFloat((totalSqmt * toughProc.rate).toFixed(2)),
      })
    }
  
    return suggested
  }

  const updateGroup = (gkey, field, value) => {
    setGroups(prev => prev.map(g => {
      if (g.group_key !== gkey) return g
      const updated = { ...g, [field]: value }

      if (['rate','rate_rft','cep','pricing_method','discount_pct','tax_rate'].includes(field)) {
        updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
      }

      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.description = prod.name
          updated.rate = prod.sale_price || 0
          updated.sizes = g.sizes.map(s => calcGroupSize(updated, s))
          if (!g.processes?.length) {
            updated.processes = autoSuggestProcesses(updated)
          }
        }
      }

      if (field === 'cep' && value === true) {
        const toughProc = processMasters.find(p => p.process_type === 'toughening')
        const alreadyHasTough = g.processes?.some(p => p.process_id === toughProc?.id)
        if (toughProc && !alreadyHasTough) {
          const totalSqmt = g.sizes.reduce((s, sz) => s + (sz.tgh_sqmt || 0), 0)
          updated.processes = [
            ...(g.processes || []),
            {
              proc_key: Date.now() + Math.random(),
              process_id: toughProc.id,
              charge_type: toughProc.charge_type,
              qty_area: parseFloat(totalSqmt.toFixed(4)),
              rate: toughProc.rate,
              amount: parseFloat((totalSqmt * toughProc.rate).toFixed(2)),
            }
          ]
        }
      }

      if (field === 'cep' && value === false) {
        const toughProc = processMasters.find(p => p.process_type === 'toughening')
        if (toughProc) {
          updated.processes = (g.processes || []).filter(
            p => p.process_id !== toughProc.id
          )
        }
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
      const updatedGroup = { ...g, sizes: updatedSizes }

      const totalSqft = updatedSizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
      const totalRft  = updatedSizes.reduce((s, sz) => s + (sz.running_ft || 0), 0)
      const totalSqmt = updatedSizes.reduce((s, sz) => s + (sz.tgh_sqmt   || 0), 0)
      const totalPcs  = updatedSizes.reduce((s, sz) => s + (sz.quantity   || 0), 0)

      updatedGroup.processes = (g.processes || []).map(p => {
        let qty = p.qty_area
        if (p.charge_type === 'per_sqft')  qty = parseFloat(totalSqft.toFixed(3))
        if (p.charge_type === 'per_rft')   qty = parseFloat(totalRft.toFixed(3))
        if (p.charge_type === 'per_sqmt')  qty = parseFloat(totalSqmt.toFixed(4))
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
              updated.rate        = pm.rate

              const allSizes = g.sizes || []
              const totalSqft = allSizes.reduce((s, sz) => s + (sz.total_sqft || 0), 0)
              const totalRft  = allSizes.reduce((s, sz) => s + (sz.running_ft || 0), 0)
              const totalSqmt = allSizes.reduce((s, sz) => s + (sz.tgh_sqmt   || 0), 0)
              const totalPcs  = allSizes.reduce((s, sz) => s + (sz.quantity   || 0), 0)

              if (pm.charge_type === 'per_sqft')  updated.qty_area = parseFloat(totalSqft.toFixed(3))
              if (pm.charge_type === 'per_rft')   updated.qty_area = parseFloat(totalRft.toFixed(3))
              if (pm.charge_type === 'per_sqmt')  updated.qty_area = parseFloat(totalSqmt.toFixed(4))
              if (pm.charge_type === 'per_piece') updated.qty_area = totalPcs
              if (pm.charge_type === 'fixed')     updated.qty_area = 1

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
  const discountAmt = Form.useWatch('discount_amount', form) || 0
  const advanceRec = Form.useWatch('advance_received', form) || 0

  const totals = useMemo(() => {
    const allSizes    = groups.flatMap(g => g.sizes)
    const allProcesses = groups.flatMap(g => g.processes || [])
  
    const subI       = allSizes.reduce((s, l) => s + (l.subtotal || 0), 0)
    const procTotal  = allProcesses.reduce((s, p) => s + (p.amount || 0), 0)
    const subII      = subI + procTotal + (dcCharges || 0)
    const subIII     = Math.max(0, subII - (discountAmt || 0))
  
    let cgst = 0, sgst = 0, igst = 0
    if (isInterState) {
      igst = subIII * 0.18
    } else {
      cgst = subIII * 0.09
      sgst = subIII * 0.09
    }
    const grandTotal = subIII + cgst + sgst + igst
    const balance    = grandTotal - (advanceRec || 0)
  
    let totalCost = 0
    groups.forEach(g => {
      const prod = products.find(x => x.id === g.product_id)
      if (prod?.cost_price) {
        g.sizes.forEach(s => {
          totalCost += (s.total_sqft || 0) * prod.cost_price
        })
      }
      ;(g.processes || []).forEach(p => {
        totalCost += (p.amount || 0) * 0.7 
      })
    })
    const marginAmt = subIII - totalCost
    const marginPct = totalCost > 0 ? (marginAmt / totalCost) * 100 : 100
  
    return {
      subI, procTotal, dcCharges, subII,
      discountAmt, subIII, cgst, sgst, igst,
      grandTotal, advanceRec, balance,
      totalCost, marginAmt, marginPct
    }
  }, [groups, dcCharges, discountAmt, advanceRec, isInterState, products])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? quotationApi.update(id, data) : quotationApi.create(data),
    onSuccess: (res) => {
      message.success(`Quotation ${isEdit ? 'updated' : 'created'}`)
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      if (!isEdit && res?.data?.id) navigate(`/quotations/${res.data.id}/edit`)
    },
  })

  const getFlatLines = () => {
    return groups.flatMap(g =>
      g.sizes.map((s, idx) => ({
        product_id:     g.product_id,
        description:    g.description,
        rate:           g.rate,
        rate_rft:       g.rate_rft,
        cep:            g.cep,
        pricing_method: g.pricing_method,
        discount_pct:   g.discount_pct,
        tax_rate:       g.tax_rate,
        processes:      idx === 0 ? (g.processes || []).map(({proc_key,...rest})=>rest) : [],
        width_inch:     s.width_inch,
        height_inch:    s.height_inch,
        quantity:       s.quantity,
        area_sqft_pc:   s.area_sqft_pc,
        total_sqft:     s.total_sqft,
        running_ft:     s.running_ft,
        charged_sqft:   s.charged_sqft,
        cep_rft:        s.cep_rft,
        tgh_sqmt:       s.tgh_sqmt,
        subtotal:       s.subtotal,
        tax_amount:     s.tax_amount,
        line_total:     s.line_total,
      }))
    )
  }

  const convertMutation = useMutation({
    mutationFn: async () => {
      const soData = {
        ...form.getFieldsValue(),
        lines: getFlatLines(),
        processes: [], 
        quotation_id: parseInt(id),
        subtotal: totals.subIII,
        tax_amount: totals.cgst + totals.sgst + totals.igst,
        total_amount: totals.grandTotal,
        status: 'draft',
      }
      const res = await salesOrderApi.create(soData)
      await quotationApi.changeStatus(id, 'converted')
      return res.data
    },
    onSuccess: (data) => {
      message.success('Converted to Sales Order!')
      navigate(`/sales-orders/${data.id}/edit`)
    }
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.quote_date) values.quote_date = values.quote_date.format('YYYY-MM-DD')
      if (values.valid_until) values.valid_until = values.valid_until.format('YYYY-MM-DD')

      values.lines = getFlatLines()
      values.processes = []
      values.is_inter_state = isInterState
      values.subtotal = totals.subIII
      values.tax_amount = totals.cgst + totals.sgst + totals.igst
      values.total_amount = totals.grandTotal
      values.balance_due = totals.balance

      await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        setGroups([emptyGroup()])
        navigate('/quotations/new')
      }
    } catch (err) {}
  }

  const openComparisonWizard = (group) => {
    const prod = products.find(p => p.id === group.product_id)
    const costPerSqft = prod?.cost_price || 0
  
    const groupProcessCost = (group.processes || []).reduce((s, p) => s + (p.amount || 0), 0)

    const rows = group.sizes.map((s, i) => {
      const w = s.width_inch || 0
      const h = s.height_inch || 0
      const qty = s.quantity || 1
  
      const selling_sqft   = s.total_sqft || 0
      const selling_amount = s.subtotal || 0
  
      const ceil3 = (x) => Math.ceil(x/3)*3
      const charged_sqft = (ceil3(w)*ceil3(h)*qty)/144
      const cep_rft_cost = (w+h)*2/12*qty*5
      const cost_amount = parseFloat(
        (charged_sqft * costPerSqft + (group.cep ? cep_rft_cost * costPerSqft : 0)).toFixed(2)
      )
  
      const margin_amount = parseFloat((selling_amount - cost_amount).toFixed(2))
      const margin_pct    = cost_amount > 0
        ? parseFloat(((margin_amount / cost_amount) * 100).toFixed(2))
        : 100
  
      return {
        key: i,
        label: String.fromCharCode(97 + i),
        width_display: unit === 'inch' ? `${w}"` : `${(w*25.4).toFixed(1)}mm`,
        height_display: unit === 'inch' ? `${h}"` : `${(h*25.4).toFixed(1)}mm`,
        quantity: qty,
        selling_sqft: selling_sqft.toFixed(3),
        charged_sqft: charged_sqft.toFixed(3),
        selling_amount,
        cost_amount,
        margin_amount,
        margin_pct,
      }
    })
  
    const totalSelling = rows.reduce((s,r) => s + r.selling_amount, 0) + groupProcessCost
    const totalCost    = rows.reduce((s,r) => s + r.cost_amount, 0) + (groupProcessCost * 0.7)
    const totalMargin  = totalSelling - totalCost
    const totalMarginPct = totalCost > 0
      ? parseFloat(((totalMargin/totalCost)*100).toFixed(2)) : 100
  
    setCompWizard({
      product_name: group.description || 'Product',
      cost_price: costPerSqft,
      selling_rate: group.rate,
      process_cost: groupProcessCost,
      rows,
      totalSelling, totalCost, totalMargin, totalMarginPct
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
        const cep      = String(row[3] || '').toUpperCase() === 'Y'
        const w_inch   = typeof row[4] === 'number' ? row[4] : null
        const h_inch   = typeof row[5] === 'number' ? row[5] : null
        const qty      = typeof row[6] === 'number' ? row[6] : null
        const rft_rate = typeof row[9] === 'number'  ? row[9] : 0
        const sqft_rate= typeof row[13] === 'number' ? row[13]: 0
  
        if (!w_inch || !h_inch) continue
  
        if (itemName && typeof itemName === 'string' && itemName.trim()) {
          const matchedProduct = products.find(p =>
            p.name.toLowerCase().includes(itemName.toLowerCase().split(' ')[0]) ||
            itemName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
          )
  
          currentGroup = {
            group_key: Date.now() + Math.random() + i,
            product_id: matchedProduct?.id || null,
            description: itemName.trim(),
            rate: sqft_rate || matchedProduct?.sale_price || 0,
            rate_rft: rft_rate || 0,
            cep: cep,
            pricing_method: 'per_sqft',
            discount_pct: 0,
            tax_rate: 18,
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
            rate: sqft_rate || 0,
            rate_rft: rft_rate || 0,
            cep: cep,
            pricing_method: 'per_sqft',
            discount_pct: 0,
            tax_rate: 18,
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
          <Button type="primary" onClick={() => navigate('/sales-orders')} style={{ background: '#10b981', borderColor: '#10b981' }}>View Sales Order →</Button>
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
              <Button icon={<DownloadOutlined />} onClick={() => {
                generateQuotationPDF({...form.getFieldsValue(), lines: getFlatLines(), quote_number: record?.quote_number, ...totals})
              }}>PDF</Button>
            )}
            {status === 'confirmed' && (
              <>
                <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => convertMutation.mutate()} loading={convertMutation.isPending} style={{ background: '#6366f1' }}>Convert to SO</Button>
                <Popconfirm title="Cancel?" onConfirm={() => quotationApi.changeStatus(id, 'cancelled')}><Button danger>Cancel</Button></Popconfirm>
              </>
            )}
            {status === 'draft' && <Button type="primary" onClick={() => quotationApi.changeStatus(id, 'confirmed')} style={{ background: '#10b981' }}>Confirm</Button>}
            {status === 'cancelled' && <Tag color="red">CANCELLED</Tag>}
          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" disabled={status === 'converted'}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Radio.Group value={unit} onChange={e => setUnit(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="inch">inch</Radio.Button>
              <Radio.Button value="mm">MM</Radio.Button>
            </Radio.Group>
            <Text type="secondary" style={{fontSize:11}}>(Default: Inch)</Text>
          </Space>
        </div>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select customer" options={customers.map(c => ({ value: c.id, label: c.name }))} filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} onChange={handleCustomerChange} />
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
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col span={1}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {groups.indexOf(group) + 1}.
                </Text>
              </Col>
              <Col span={5}>
                <Select
                  placeholder="Select Product"
                  showSearch
                  size="small"
                  value={group.product_id}
                  options={products.map(p => ({ value: p.id, label: p.name }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                  onChange={val => updateGroup(group.group_key, 'product_id', val)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  size="small" placeholder="Rate/Sqft" prefix="₹"
                  value={group.rate} min={0}
                  style={{ width: '100%' }}
                  onChange={val => updateGroup(group.group_key, 'rate', val)}
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  size="small" placeholder="Rate/Rft" prefix="₹"
                  value={group.rate_rft} min={0}
                  style={{ width: '100%' }}
                  onChange={val => updateGroup(group.group_key, 'rate_rft', val)}
                />
              </Col>
              <Col span={3}>
                <Select
                  size="small" value={group.pricing_method}
                  options={PRICING_METHODS}
                  style={{ width: '100%' }}
                  onChange={val => updateGroup(group.group_key, 'pricing_method', val)}
                />
              </Col>
              <Col span={2}>
                <Space size={4}>
                  <Text style={{ fontSize: 12 }}>CEP</Text>
                  <Checkbox
                    checked={group.cep}
                    onChange={e => updateGroup(group.group_key, 'cep', e.target.checked)}
                  />
                </Space>
              </Col>
              <Col span={2}>
                <InputNumber
                  size="small" placeholder="Disc%" suffix="%"
                  value={group.discount_pct} min={0} max={100}
                  style={{ width: '100%' }}
                  onChange={val => updateGroup(group.group_key, 'discount_pct', val)}
                />
              </Col>
              <Col span={3}>
                <Text strong style={{ color: '#059669' }}>
                  ₹ {group.sizes.reduce((s,x)=>s+(x.subtotal||0),0).toLocaleString('en-IN',{minimumFractionDigits:2})}
                </Text>
              </Col>
              <Col span={2} style={{ textAlign: 'right' }}>
                <Space>
                  <Tooltip title="View cost vs selling comparison">
                    <Button
                      size="small"
                      icon={<LineChartOutlined />}
                      type="default"
                      style={{ color: '#6366f1', borderColor: '#6366f1' }}
                      onClick={() => openComparisonWizard(group)}
                    />
                  </Tooltip>
                  <Button
                    size="small" type="text" danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeGroup(group.group_key)}
                  />
                </Space>
              </Col>
            </Row>

            <Table
              dataSource={group.sizes}
              rowKey="size_key"
              size="small"
              pagination={false}
              style={{ marginLeft: 24 }}
              columns={[
                { title: '#', width: 30, render: (_,__,i) => 
                  <Text type="secondary" style={{fontSize:11}}>{String.fromCharCode(97+i)}</Text>
                },
                {
                  title: unit === 'inch' ? 'W (inch)' : 'W (mm)',
                  width: 80, dataIndex: 'width_inch',
                  render: (v, row) => (
                    <InputNumber
                      size="small" min={0}
                      value={v ? (unit==='inch' ? v : parseFloat((v*25.4).toFixed(2))) : null}
                      style={{ width: '100%' }}
                      onChange={val => updateSize(
                        group.group_key, row.size_key, 'width_inch',
                        val ? (unit==='inch' ? val : val/25.4) : null
                      )}
                    />
                  )
                },
                {
                  title: unit === 'inch' ? 'H (inch)' : 'H (mm)',
                  width: 80, dataIndex: 'height_inch',
                  render: (v, row) => (
                    <InputNumber
                      size="small" min={0}
                      value={v ? (unit==='inch' ? v : parseFloat((v*25.4).toFixed(2))) : null}
                      style={{ width: '100%' }}
                      onChange={val => updateSize(
                        group.group_key, row.size_key, 'height_inch',
                        val ? (unit==='inch' ? val : val/25.4) : null
                      )}
                    />
                  )
                },
                { title: 'Qty', width: 60, dataIndex: 'quantity',
                  render: (v, row) => (
                    <InputNumber size="small" value={v} min={1} style={{ width: '100%' }}
                      onChange={val => updateSize(group.group_key, row.size_key, 'quantity', val)} />
                  )
                },
                { title: 'Sqft/pc', width: 70, dataIndex: 'area_sqft_pc',
                  render: v => <Text type="secondary" style={{fontSize:11}}>{v?.toFixed(3)}</Text>
                },
                { title: 'Total Sqft', width: 80, dataIndex: 'total_sqft',
                  render: v => <Text strong style={{fontSize:12}}>{v?.toFixed(3)}</Text>
                },
                { title: 'Rft', width: 60, dataIndex: 'running_ft',
                  render: v => <Text type="secondary" style={{fontSize:11}}>{v?.toFixed(3)}</Text>
                },
                { title: 'Amount', width: 100, dataIndex: 'subtotal', align: 'right',
                  render: v => <Text strong style={{color:'#059669'}}>
                    ₹{(v||0).toLocaleString('en-IN',{minimumFractionDigits:2})}
                  </Text>
                },
                { title: '', width: 40,
                  render: (_, row) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => removeSize(group.group_key, row.size_key)} />
                  )
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
                        ₹{(group.processes||[])
                          .reduce((s,p) => s+(p.amount||0), 0)
                          .toLocaleString('en-IN', {minimumFractionDigits:2})}
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
                        options={processMasters.map(p => ({
                          value: p.id,
                          label: `${p.name}`
                        }))}
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
                        {proc.charge_type === 'per_sqft'  ? 'sqft' :
                         proc.charge_type === 'per_rft'   ? 'rft'  :
                         proc.charge_type === 'per_sqmt'  ? 'sqmt' :
                         proc.charge_type === 'per_piece' ? 'pcs'  : 'fixed'}
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
                        ₹{(proc.amount||0).toLocaleString('en-IN',
                          {minimumFractionDigits:2})}
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

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addGroup}>
              + Add Product
            </Button>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Tabs size="small" items={[
              { key: 'cn', label: 'Customer Notes', children: <Form.Item name="customer_note"><TextArea rows={4} /></Form.Item> },
              { key: 'in', label: 'Internal Notes', children: <Form.Item name="internal_notes"><TextArea rows={4} /></Form.Item> },
            ]} />

            <Collapse style={{ marginTop: 16 }}>
              <Collapse.Panel header={<><LineChartOutlined /> Margin Analysis</>} key="1">
                <Row justify="space-between"><Col>Total Cost Price</Col><Col>{fmt(totals.totalCost)}</Col></Row>
                <Row justify="space-between"><Col>Selling Price</Col><Col>{fmt(totals.subIII)}</Col></Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Col>Margin</Col>
                  <Col>
                    <span style={{ fontWeight: 'bold', color: totals.marginPct > 20 ? '#16a34a' : totals.marginPct > 10 ? '#f59e0b' : '#dc2626' }}>
                      {fmt(totals.marginAmt)} ({totals.marginPct.toFixed(2)}%)
                    </span>
                  </Col>
                </Row>
              </Collapse.Panel>
            </Collapse>
          </Col>
          
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col>Sub-total I (Glass)</Col><Col>{fmt(totals.subI)}</Col></Row>
              <Row justify="space-between" style={{ marginBottom: 8 }}><Col><Text type="secondary">Process Charges (all products)</Text></Col><Col><Text>{fmt(totals.procTotal)}</Text></Col></Row>
              <Form.Item name="dc_charges" label="D/C Charges" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }} style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Row justify="space-between" style={{ marginBottom: 8, fontWeight: 600 }}><Col>Sub-total II</Col><Col>{fmt(totals.subII)}</Col></Row>
              <Form.Item name="discount_amount" label="Discount" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }} style={{ marginBottom: 8 }}>
                <InputNumber style={{ width: '100%' }} prefix="₹" />
              </Form.Item>
              <Row justify="space-between" style={{ marginBottom: 12, fontWeight: 600, fontSize: 15 }}><Col>Sub-total III</Col><Col>{fmt(totals.subIII)}</Col></Row>
              
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>GST Type</span>
                <Switch checkedChildren="IGST" unCheckedChildren="CGST/SGST" checked={isInterState} onChange={setIsInterState} />
              </div>

              {isInterState ? (
                <Row justify="space-between" style={{ marginBottom: 8 }}><Col>IGST (18%)</Col><Col>{fmt(totals.igst)}</Col></Row>
              ) : (
                <>
                  <Row justify="space-between" style={{ marginBottom: 8 }}><Col>CGST (9%)</Col><Col>{fmt(totals.cgst)}</Col></Row>
                  <Row justify="space-between" style={{ marginBottom: 8 }}><Col>SGST (9%)</Col><Col>{fmt(totals.sgst)}</Col></Row>
                </>
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
            <LineChartOutlined style={{ color: '#6366f1' }} />
            <span>Cost vs Selling Comparison — {compWizard?.product_name}</span>
          </Space>
        }
        open={compWizard !== null}
        onCancel={() => setCompWizard(null)}
        footer={<Button onClick={() => setCompWizard(null)}>Close</Button>}
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
                  <Text type="secondary">Cost Price (from product master)</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>
                    ₹ {compWizard.cost_price}/sqft
                  </div>
                </Card>
              </Col>
            </Row>

            <Table
              dataSource={compWizard.rows}
              pagination={false}
              size="small"
              columns={[
                { title: 'Size', key: 'size', width: 80,
                  render: (_, r) => <Text strong>{r.label}. {r.width_display} × {r.height_display}</Text>
                },
                { title: 'Qty', dataIndex: 'quantity', width: 50 },
                { title: 'Selling Sqft', dataIndex: 'selling_sqft', width: 90,
                  render: v => <Text>{v}</Text>
                },
                { title: 'Charged Sqft', dataIndex: 'charged_sqft', width: 100,
                  render: v => <Text type="secondary">{v}</Text>
                },
                { title: 'Selling Amt', dataIndex: 'selling_amount', width: 110, align: 'right',
                  render: v => <Text strong style={{color:'#16a34a'}}>
                    ₹{v.toLocaleString('en-IN',{minimumFractionDigits:2})}
                  </Text>
                },
                { title: 'Cost Amt', dataIndex: 'cost_amount', width: 110, align: 'right',
                  render: v => <Text style={{color:'#ea580c'}}>
                    ₹{v.toLocaleString('en-IN',{minimumFractionDigits:2})}
                  </Text>
                },
                { title: 'Margin', dataIndex: 'margin_amount', width: 110, align: 'right',
                  render: (v, r) => (
                    <Text strong style={{
                      color: r.margin_pct >= 20 ? '#16a34a' :
                            r.margin_pct >= 10 ? '#f59e0b' : '#dc2626'
                    }}>
                      ₹{v.toLocaleString('en-IN',{minimumFractionDigits:2})}
                      <br/>
                      <Text style={{fontSize:11, color:'inherit'}}>
                        ({r.margin_pct}%)
                      </Text>
                    </Text>
                  )
                },
              ]}
            />

            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={6}>
                <Text type="secondary">Total Selling</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
                  ₹{compWizard.totalSelling.toLocaleString('en-IN',{minimumFractionDigits:2})}
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Total Cost</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ea580c' }}>
                  ₹{compWizard.totalCost.toLocaleString('en-IN',{minimumFractionDigits:2})}
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Total Margin</Text>
                <div style={{ fontSize: 16, fontWeight: 700, color:
                  compWizard.totalMarginPct >= 20 ? '#16a34a' :
                  compWizard.totalMarginPct >= 10 ? '#f59e0b' : '#dc2626'
                }}>
                  ₹{compWizard.totalMargin.toLocaleString('en-IN',{minimumFractionDigits:2})}
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Margin %</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color:
                  compWizard.totalMarginPct >= 20 ? '#16a34a' :
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
                c.name.toLowerCase().includes((importPreview.clientName||'').toLowerCase()) ||
                (importPreview.clientName||'').toLowerCase().includes(c.name.toLowerCase())
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
                      .reduce((s,sz) => s + (sz.subtotal||0), 0)
                      .toLocaleString('en-IN', {maximumFractionDigits:0})}
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
                      <Tag color="blue">{gi+1}</Tag>
                      <Text strong>{g.description}</Text>
                      <Tag>{g.sizes.length} sizes</Tag>
                      <Tag color="green">₹{g.rate}/sqft</Tag>
                      {g.cep && <Tag color="orange">CEP</Tag>}
                    </Space>
                  }
                >
                  {g.sizes.map((s, si) => (
                    <div key={si} style={{ fontSize: 12, marginBottom: 4 }}>
                      {String.fromCharCode(97+si)}.{' '}
                      {unit==='inch' ? `${s.width_inch}"` : `${(s.width_inch*25.4).toFixed(1)}mm`}
                      {' × '}
                      {unit==='inch' ? `${s.height_inch}"` : `${(s.height_inch*25.4).toFixed(1)}mm`}
                      {' × '}{s.quantity} pcs
                      {' = '}
                      <Text strong>
                        {s.total_sqft?.toFixed(3)} sqft
                      </Text>
                      {' → '}
                      <Text strong style={{color:'#059669'}}>
                        ₹{(s.subtotal||0).toLocaleString('en-IN',{minimumFractionDigits:2})}
                      </Text>
                    </div>
                  ))}
                </Collapse.Panel>
              ))}
            </Collapse>
          </>
        )}
      </Modal>

    </MasterForm>
  )
}

export default QuotationForm
"""

with open("src/pages/quotations/QuotationForm.jsx", "w") as f:
    f.write(content)
