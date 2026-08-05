import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Input, Select, Row, Col, Divider, DatePicker, Button, Table, Steps, Space, Tag, Checkbox, Card, Badge, App, Typography, InputNumber, Switch, Modal } from 'antd'
import { PlusOutlined, DeleteOutlined, ToolOutlined, FireOutlined, FileTextOutlined, CheckCircleOutlined, PlayCircleOutlined, DownloadOutlined, SwapOutlined, LinkOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import MasterForm from '../../components/common/MasterForm'
import ArtworkPanelMapper from '../../components/common/ArtworkPanelMapper'
import { workshopOrderApi, salesOrderApi, customerApi, productApi, tougheningBatchApi, processMasterApi, vendorApi, companyApi, interCompanyApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { settingsApi } from '../../api/settingsApi'
// Note for developer/user to add manually in Masters -> Vendors:
// MEBT, Amath, Sapphire, Al Burhan, RDTuff, Diamond
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import FractionInput, { toFraction } from '../quotations/components/FractionInput'
import InterCompanyBanner from '../../components/common/InterCompanyBanner'
import { computeLineWeightKg } from '../../utils/glassCalc'

const { TextArea } = Input
const { Text } = Typography

const STATUS_STEPS = ['draft', 'in_progress', 'completed']
const STATUS_IDX = { draft: 0, in_progress: 1, completed: 2, cancelled: 0 }

const getArtworkMaster = () => {
  try {
    return JSON.parse(localStorage.getItem('artwork_master') || '[]')
  } catch { return [] }
}

const saveArtworkMaster = async (artworks) => {
  localStorage.setItem('artwork_master', JSON.stringify(artworks))
  // Also save to backend
  try {
    await settingsApi.save(settingsApi.KEYS.ARTWORK_MASTER, artworks)
  } catch { }
}

const WorkshopOrderForm = () => {
  const { message } = App.useApp()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isDirty, setIsDirty] = useState(false)
  const [leavePrompt, setLeavePrompt] = useState(null)
  const hydratedRef = useRef(false)
  const [lines, setLines] = useState([])
  const [selectedJobworkVendor, setSelectedJobworkVendor] = useState(null)
  const [artworkMaster, setArtworkMaster] = useState(getArtworkMaster)
  const [selectedLineKeys, setSelectedLineKeys] = useState([])
  const [bulkArtworkModal, setBulkArtworkModal] = useState(false)
  const [bulkArtworkId, setBulkArtworkId] = useState(null)
  const [bulkArtworkName, setBulkArtworkName] = useState('')
  const [bulkArtworkFileData, setBulkArtworkFileData] = useState(null)
  const [bulkArtworkFileName, setBulkArtworkFileName] = useState(null)

  const [serialModal, setSerialModal] = useState(false)
  const [bulkSerial, setBulkSerial] = useState('')

  const saveToArtworkMaster = (name, fileName, fileData) => {
    const newArtwork = {
      id: Date.now(),
      name,
      file_name: fileName,
      file_data: fileData,
      created_at: new Date().toISOString().split('T')[0]
    }
    setArtworkMaster(prev => {
      const updated = [...prev, newArtwork]
      saveArtworkMaster(updated)
      return updated
    })
    message.success(`"${name}" saved to Artwork Master!`)
    return newArtwork
  }
  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const [exportWizard, setExportWizard] = useState(false)
  const [exportLoading, setExportLoading] = useState(null)
  const [waLink, setWaLink] = useState(null)
  // Multi-artwork panel maps — har artwork ki APNI mapping sheet:
  // [{ name, image, panels: [{x,y,w,h,lineIndex,note,...}] }]
  const [artworkMaps, setArtworkMaps] = useState([])
  const [activeMap, setActiveMap] = useState(0)

  const updateActiveMap = (patch) => {
    setArtworkMaps(prev => {
      // Invalid index (map delete/switch ke beech) pe kuch mat badlo —
      // naya array return karna hi render loop trigger karta hai
      if (!prev[activeMap]) return prev
      return prev.map((m, i) => (i === activeMap ? { ...m, ...patch } : m))
    })
  }

  // Load artwork master from backend on mount
  useEffect(() => {
    settingsApi.get(settingsApi.KEYS.ARTWORK_MASTER).then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setArtworkMaster(data)
        localStorage.setItem('artwork_master', JSON.stringify(data))
      }
    }).catch(() => { })
  }, [])

  const inchToMm = (val) => val ? Math.round(val * 25.4) : null
  const mmToInch = (mm) => mm ? parseFloat((mm / 25.4).toFixed(4)) : null

  const { data: record, isLoading } = useQuery({
    queryKey: ['workshop_orders', id], queryFn: () => workshopOrderApi.get(id).then(r => r.data), enabled: isEdit,
  })
  const { data: salesOrders = [] } = useQuery({ queryKey: ['so-dd'], queryFn: () => salesOrderApi.dropdown().then(r => r.data) })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-dd'], queryFn: () => customerApi.dropdown().then(r => r.data) })
  const { data: products = [] } = useQuery({ queryKey: ['products-dd'], queryFn: () => productApi.dropdown().then(r => r.data) })
  const { data: tbData } = useQuery({ queryKey: ['tb-wo', id], queryFn: () => tougheningBatchApi.list({ wo_id: id }).then(r => r.data), enabled: isEdit })
  const { data: processMastersData } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-dd'], queryFn: () => vendorApi.dropdown().then(r => r.data) })

  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])


  const soList = Array.isArray(salesOrders) ? salesOrders : (salesOrders?.items || [])
  const customerList = Array.isArray(customers) ? customers : (customers?.items || [])
  const productList = Array.isArray(products) ? products : (products?.items || [])

  // ── Inter-Company Link State & Queries ─────────────────
  const { user, isSuperAdmin, activeCompanyId } = useAuth()
  const [linkWizard, setLinkWizard] = useState(false)
  const [selectedSupplierCompanyId, setSelectedSupplierCompanyId] = useState(null)
  const [selectedLinkLineKeys, setSelectedLinkLineKeys] = useState([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkResultModal, setLinkResultModal] = useState(null)

  const { data: companiesData = [] } = useQuery({
    queryKey: ['companies-dropdown'],
    queryFn: () => companyApi.dropdown().then(r => r.data),
  })
  const companyList = Array.isArray(companiesData) ? companiesData : (companiesData?.items || [])

  const currentWoCompanyId = record?.company_id || activeCompanyId || user?.company_id
  const supplierCompanies = companyList.filter(c => c.id !== currentWoCompanyId && c.is_active !== false)

  const handleOpenLinkWizard = () => {
    setSelectedLinkLineKeys(lines.map(l => l.key))
    setSelectedSupplierCompanyId(null)
    setLinkWizard(true)
  }

  const handleConfirmInterCompanyLink = async () => {
    if (!selectedSupplierCompanyId) {
      message.warning('Please select a supplier company.')
      return
    }
    if (selectedLinkLineKeys.length === 0) {
      message.warning('Please select at least one glass line.')
      return
    }

    const selectedLines = lines.filter(l => selectedLinkLineKeys.includes(l.key))
    const payloadLines = selectedLines.map(l => ({
      description: l.description || '',
      glass_thickness: l.glass_thickness || null,
      glass_type: l.glass_type || null,
      glass_category: l.glass_category || null,
      product_id: l.product_id || null,
      product_name: l.product_name || l.description || '',
      ceiling_w_inches: l.ceiling_w_inches || l.ceiling_inches || 6,
      ceiling_h_inches: l.ceiling_h_inches || l.ceiling_inches || 6,
      ceiling_w_custom_mm: l.ceiling_w_custom_mm || 30,
      ceiling_h_custom_mm: l.ceiling_h_custom_mm || 30,
      cep: Boolean(l.cep),
      width_mm: l.act_w_mm || (l.act_w_in ? Math.round(l.act_w_in * 25.4) : null),
      height_mm: l.act_h_mm || (l.act_h_in ? Math.round(l.act_h_in * 25.4) : null),
      width_inch: l.act_w_in || (l.act_w_mm ? parseFloat((l.act_w_mm / 25.4).toFixed(4)) : null),
      height_inch: l.act_h_in || (l.act_h_mm ? parseFloat((l.act_h_mm / 25.4).toFixed(4)) : null),
      qty: l.qty || l.quantity || 1,
      artwork_file_data: l.artwork_file_data || l.artwork_file || null,
      artwork_id: l.artwork_master_id || l.artwork_id || null,
      artwork_name: l.artwork_name || l.artwork_file_name || null,
      has_process: Boolean(l.has_process),
      process: l.process_label || '',
      process_info: l.group_processes || l.size_processes || [],
      is_toughened: Boolean(l.is_toughened),
    }))

    const payload = {
      source_company_id: currentWoCompanyId,
      supplier_company_id: selectedSupplierCompanyId,
      source_wo_id: Number(id),
      lines: payloadLines,
    }

    setLinkLoading(true)
    try {
      const res = await interCompanyApi.link(payload)
      const resultData = res.data
      message.success(`Created PO ${resultData.po_number} (${resultData.source_company}) + SO ${resultData.so_number} & WO ${resultData.wo_number} (${resultData.supplier_company})`)
      setLinkWizard(false)
      setLinkResultModal(resultData)
      queryClient.invalidateQueries({ queryKey: ['workshop_orders', id] })
    } catch (err) {
      console.error('Inter-company link failed:', err)
      let detail = err.response?.data?.detail || err.message || 'Failed to create inter-company link'
      if (typeof detail === 'object') {
        detail = JSON.stringify(detail)
      }
      message.error(detail)
    } finally {
      setLinkLoading(false)
    }
  }

  const [soLoadedFromParam, setSoLoadedFromParam] = useState(false)

  // Effect 1: set defaults on mount
  useEffect(() => {
    if (!isEdit) {
      form.setFieldValue('order_date', dayjs())
      form.setFieldValue('priority', 'normal')
      hydratedRef.current = true
    }
  }, [])

  // Effect 2: load SO data AFTER processMasters loads
  useEffect(() => {
    if (!isEdit && !soLoadedFromParam && processMasters.length > 0) {
      const soId = searchParams.get('so_id')
      if (soId) {
        setSoLoadedFromParam(true)
        handleSOSelect(parseInt(soId))
      }
    }
  }, [processMasters, soLoadedFromParam, isEdit])

  useEffect(() => {
    if (record) {
      const sanitize = (obj) => Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
      )
      form.setFieldsValue(sanitize({
        ...record,
        order_date: record.order_date ? dayjs(record.order_date) : undefined,
        required_by: record.required_by ? dayjs(record.required_by) : undefined,
      }))
      if (record.lines?.length) setLines(record.lines.map((l, i) => {
        // Rebuild process_label from saved processes if missing
        const groupProcs = l.processes || []
        const sizeProcs = l.size_processes || []
        const allProcs = [...groupProcs, ...sizeProcs]
        const rebuiltLabel = allProcs
          .map(p =>
            p.process_name ||
            processMasters.find(pm => pm.id === p.process_id)?.name ||
            ''
          )
          .filter(Boolean)
          .join(', ')

        return {
          ...l,
          key: l.id || Date.now() + i,
          qty: l.qty || l.quantity || 1,
          glass_thickness: l.glass_thickness || null,
          glass_type: l.glass_type || null,
          glass_category: l.glass_category || null,
          product_id: l.product_id || null,
          product_name: l.product_name || l.description || '',
          ceiling_w_inches: l.ceiling_w_inches || l.ceiling_inches || 6,
          ceiling_h_inches: l.ceiling_h_inches || l.ceiling_inches || 6,
          ceiling_w_custom_mm: l.ceiling_w_custom_mm || 30,
          ceiling_h_custom_mm: l.ceiling_h_custom_mm || 30,
          act_w_in: l.act_w_in || l.width_inch || (l.act_w_mm || l.width_mm ? mmToInch(l.act_w_mm || l.width_mm) : null),
          act_h_in: l.act_h_in || l.height_inch || (l.act_h_mm || l.height_mm ? mmToInch(l.act_h_mm || l.height_mm) : null),
          act_w_mm: l.act_w_mm || l.width_mm || (l.act_w_in || l.width_inch ? Math.round((l.act_w_in || l.width_inch) * 25.4) : null),
          act_h_mm: l.act_h_mm || l.height_mm || (l.act_h_in || l.height_inch ? Math.round((l.act_h_in || l.height_inch) * 25.4) : null),
          has_process: Boolean(l.has_process),
          process_label: l.process_label || l.process || rebuiltLabel,
          artwork_file_data: l.artwork_file_data || l.artwork_file || null,
          artwork_file_name: l.artwork_file_name || l.artwork_name || null,
          serial_no: l.serial_no || '',
          remark: l.remark || '',
          is_toughened: Boolean(l.is_toughened),
          cep: Boolean(l.cep)
        }
      }))
      if (record.jobwork_vendor) setSelectedJobworkVendor(record.jobwork_vendor)
      // Naya format: maps ka array [{name,image,panels}]. Purana (legacy):
      // flat panels array + alag artwork_image — usse ek map mein wrap karo.
      if (Array.isArray(record.artwork_panels) && record.artwork_panels.length > 0) {
        if (record.artwork_panels[0]?.panels !== undefined) {
          setArtworkMaps(record.artwork_panels)
        } else {
          setArtworkMaps([{ name: 'Map 1', image: record.artwork_image || null, panels: record.artwork_panels }])
        }
      } else if (record.artwork_image) {
        setArtworkMaps([{ name: 'Map 1', image: record.artwork_image, panels: [] }])
      }
      setActiveMap(0)
      setTimeout(() => { hydratedRef.current = true }, 0)
    }
  }, [record, form, processMasters])

  useEffect(() => {
    setExpandedRowKeys(
      lines.filter(l => l.has_process).map(l => l.key)
    )
  }, [lines])

  // ── Dirty watcher ─────────────────────────────────────────
  useEffect(() => {
    if (hydratedRef.current) setIsDirty(true)
  }, [lines, selectedJobworkVendor, artworkMaps, activeMap])

  // ── Browser close / refresh guard ─────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── Browser / gesture back-button guard (popstate) ──────────────────
  // BrowserRouter has no useBlocker, so we push a sentinel history entry.
  // When the user pops it (back button / two-finger swipe / side mouse
  // button), we re-push the sentinel and show the leave prompt.
  useEffect(() => {
    if (!isDirty) return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
      setLeavePrompt('__back__')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isDirty])

  // ── In-app navigation guard ───────────────────────────────
  const guardedNavigate = (path, options) => {
    if (!isDirty) { navigate(path, options); return }
    setLeavePrompt({ path, options })
  }

  const buildWoLinesFromGroups = (soGroups, soLines) => {
    // Prefer groups (richer data)
    if (soGroups?.length) {
      return soGroups.flatMap((group, gi) =>
        (group.sizes || []).map((size, si) => {
          // Group-level processes
          const groupProcesses = group.processes || []

          // Size-level processes
          const sizeProcesses = size.size_processes || []

          // Combined
          const allProcesses = [...groupProcesses, ...sizeProcesses]
          const hasProcess = allProcesses.length > 0

          // Resolve names
          const resolveNames = (procs) =>
            procs.map(p =>
              p.process_name ||
              processMasters.find(pm => pm.id === p.process_id)?.name ||
              `Process ${p.process_id}`
            ).filter(Boolean)

          const processLabels = hasProcess
            ? [
              ...resolveNames(groupProcesses),
              ...resolveNames(sizeProcesses)
            ].join(', ')
            : ''

          return {
            key: Date.now() + gi + si + Math.random(),
            description: group.description || '',
            glass_thickness: group.glass_thickness || null,
            glass_type: group.glass_type || null,
            glass_category: group.glass_category || null,
            product_id: group.product_id || null,
            product_name: group.product_name || group.description || '',
            ceiling_w_inches: group.ceiling_w_inches || group.ceiling_inches || 6,
            ceiling_h_inches: group.ceiling_h_inches || group.ceiling_inches || 6,
            ceiling_w_custom_mm: group.ceiling_w_custom_mm || 30,
            ceiling_h_custom_mm: group.ceiling_h_custom_mm || 30,
            act_w_in: size.width_inch
              ? parseFloat(size.width_inch.toFixed(4)) : null,
            act_h_in: size.height_inch
              ? parseFloat(size.height_inch.toFixed(4)) : null,
            act_w_mm: size.width_inch
              ? Math.round(size.width_inch * 25.4) : null,
            act_h_mm: size.height_inch
              ? Math.round(size.height_inch * 25.4) : null,
            qty: size.quantity || 1,
            is_toughened: group.is_toughened ||
              group.glass_type === 'Toughened',
            has_process: hasProcess,
            process_label: processLabels,
            cep: group.cep || false,
            group_processes: groupProcesses,
            size_processes: sizeProcesses,
            artwork_file_data: group.artwork_file_data || null,
            artwork_master_id: group.artwork_master_id || null,
            artwork_name: group.artwork_name || null,
            serial_no: size.serial_no || group.serial_no || '',
            remark: '',
          }
        })
      )
    }

    // Fallback: build from flat lines
    return (soLines || []).map((line, idx) => {
      const groupProcs = line.processes || []
      const sizeProcs = line.size_processes || []
      const allProcs = [...groupProcs, ...sizeProcs]
      const hasProcess = allProcs.length > 0
      const processLabels = allProcs
        .map(p =>
          p.process_name ||
          processMasters.find(pm => pm.id === p.process_id)?.name ||
          ''
        )
        .filter(Boolean)
        .join(', ')

      return {
        key: Date.now() + idx + Math.random(),
        description: line.description || '',
        glass_thickness: line.glass_thickness || null,
        glass_type: line.glass_type || null,
        glass_category: line.glass_category || null,
        product_id: line.product_id || null,
        product_name: line.product_name || line.description || '',
        ceiling_w_inches: line.ceiling_w_inches || line.ceiling_inches || 6,
        ceiling_h_inches: line.ceiling_h_inches || line.ceiling_inches || 6,
        ceiling_w_custom_mm: line.ceiling_w_custom_mm || 30,
        ceiling_h_custom_mm: line.ceiling_h_custom_mm || 30,
        act_w_in: line.width_inch
          ? parseFloat(line.width_inch.toFixed(4))
          : line.width_mm
            ? parseFloat((line.width_mm / 25.4).toFixed(4)) : null,
        act_h_in: line.height_inch
          ? parseFloat(line.height_inch.toFixed(4))
          : line.height_mm
            ? parseFloat((line.height_mm / 25.4).toFixed(4)) : null,
        act_w_mm: line.width_mm ||
          (line.width_inch ? Math.round(line.width_inch * 25.4) : null),
        act_h_mm: line.height_mm ||
          (line.height_inch ? Math.round(line.height_inch * 25.4) : null),
        qty: line.quantity || line.qty || 1,
        is_toughened: line.is_toughened || false,
        has_process: hasProcess,
        process_label: processLabels,
        cep: line.cep || false,
        group_processes: groupProcs,
        size_processes: sizeProcs,
        artwork_file_data: line.artwork_file_data || null,
        artwork_master_id: line.artwork_master_id || null,
        artwork_name: line.artwork_name || null,
        serial_no: line.serial_no || '',
        remark: '',
      }
    })
  }

  const handleSOSelect = async (soId) => {
    form.setFieldValue('so_id', soId)
    try {
      const so = (await salesOrderApi.get(soId)).data
      const sanitize = (obj) => Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
      )
      form.setFieldsValue(sanitize({ customer_id: so.customer_id, so_number: so.so_number }))
      const cust = customerList.find(c => c.id === so.customer_id)
      if (cust) form.setFieldValue('customer_name', cust.name)

      if (so.groups?.length || so.lines?.length) {
        setLines(buildWoLinesFromGroups(so.groups, so.lines))
      }
    } catch (e) { message.error('Failed to load SO') }
  }

  const updateLine = (key, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'act_w_in') updated.act_w_mm = inchToMm(value)
      if (field === 'act_h_in') updated.act_h_mm = inchToMm(value)
      return updated
    }))
  }

  const lineColumns = [
    { title: '#', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'CEP',
      width: 50,
      dataIndex: 'cep',
      align: 'center',
      render: (v, row) => (
        <Switch
          size="small"
          checked={Boolean(v)}
          onChange={val => updateLine(row.key, 'cep', val)}
        />
      )
    },
    { title: 'Description', width: 250, dataIndex: 'description', render: (v, row) => <Input size="small" value={v} onChange={e => updateLine(row.key, 'description', e.target.value)} /> },
    {
      title: 'Serial No',
      width: 120,
      dataIndex: 'serial_no',
      render: (v, row) => (
        <Input
          size="small"
          value={v || ''}
          placeholder="Serial #"
          onChange={e => updateLine(row.key, 'serial_no', e.target.value)}
        />
      )
    },
    { title: 'Act W (in)', width: 110, dataIndex: 'act_w_in', render: (v, row) => <FractionInput value={v} onChange={val => updateLine(row.key, 'act_w_in', val)} placeholder="90 1/2" /> },
    { title: 'Act H (in)', width: 110, dataIndex: 'act_h_in', render: (v, row) => <FractionInput value={v} onChange={val => updateLine(row.key, 'act_h_in', val)} placeholder="78 1/8" /> },
    { title: 'Act W (mm)', width: 100, dataIndex: 'act_w_mm', render: (v) => <InputNumber size="small" value={v} disabled /> },
    { title: 'Act H (mm)', width: 100, dataIndex: 'act_h_mm', render: (v) => <InputNumber size="small" value={v} disabled /> },
    { title: 'Qty', width: 80, dataIndex: 'qty', render: (v, row) => <InputNumber size="small" value={v} onChange={val => updateLine(row.key, 'qty', val)} /> },
    {
      title: 'Weight (kg)',
      width: 90,
      align: 'right',
      render: (_, row) => {
        const kg = computeLineWeightKg(row)
        return (
          <span style={{ fontWeight: 600, color: kg > 0 ? '#0f766e' : '#94a3b8', fontSize: 12 }}>
            {kg > 0 ? `${kg} kg` : '—'}
          </span>
        )
      }
    },
    {
      title: 'Actions', width: 280, render: (_, row) => (
        <Space wrap>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Checkbox
              checked={row.has_process}
              onChange={e => {
                updateLine(row.key, 'has_process', e.target.checked)
                if (e.target.checked) {
                  setExpandedRowKeys(prev =>
                    prev.includes(row.key) ? prev : [...prev, row.key]
                  )
                } else {
                  setExpandedRowKeys(prev => prev.filter(k => k !== row.key))
                }
              }}
            >
              Has Process
            </Checkbox>
            {row.has_process && row.process_label && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {row.process_label.split(', ').map((name, i) => (
                  <Tag key={i} color="purple" style={{ fontSize: 10 }}>
                    {name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          <Checkbox
            checked={row.is_toughened}
            onChange={e => updateLine(row.key, 'is_toughened', e.target.checked)}
          >
            Toughened
          </Checkbox>
          <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => setLines(prev => prev.filter(l => l.key !== row.key))} />
        </Space>
      )
    }
  ]

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? workshopOrderApi.update(id, data) : workshopOrderApi.create(data),
    onSuccess: (res) => {
      message.success(`Workshop Order ${isEdit ? 'updated' : 'created'}`)
      setIsDirty(false)
      queryClient.invalidateQueries({ queryKey: ['workshop_orders'] })
      if (!isEdit && res?.data?.id) navigate(`/workshop/orders/${res.data.id}/edit`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus) => workshopOrderApi.changeStatus(id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshop_orders', id] }),
  })

  const lineHasArtwork = (l) =>
    !!(l.artwork_file_data || l.artwork_id || l.artwork_master_id || l.artwork_image || l.artwork_name || l.artwork_file || l.artwork_file_name)

  const missingArtworkLines = () =>
    lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => (l.has_process || l.hasProcess) && !lineHasArtwork(l))

  const changeStatus = (next) => {
    if (next === 'in_progress') {
      const missing = missingArtworkLines()
      if (missing.length > 0) {
        const nums = missing.map(({ i }) => i + 1).join(', ')
        Modal.warning({
          title: 'Artwork required before processing',
          content: `${missing.length} glass line(s) with a process have no artwork uploaded (row ${nums}). Upload artwork for each, or turn off "Has Process", before starting processing.`,
        })
        return
      }
    }
    const label = String(next).replace(/_/g, ' ').toUpperCase()
    Modal.confirm({
      title: 'Change workshop order stage?',
      content: `This will move the order to ${label}. Do you want to continue?`,
      okText: 'Yes, change stage',
      cancelText: 'Cancel',
      onOk: () => statusMutation.mutate(next),
    })
  }

  const handleStartProcessing = () => {
    const missing = missingArtworkLines()
    if (missing.length > 0) {
      const nums = missing.map(({ i }) => i + 1).join(', ')
      Modal.warning({
        title: 'Artwork required before processing',
        content: `${missing.length} glass line(s) with a process have no artwork uploaded (row ${nums}). Upload artwork for each, or turn off "Has Process", before starting processing.`,
      })
      return
    }
    setExportWizard(true)
  }

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      if (values.order_date) values.order_date = values.order_date.format('YYYY-MM-DD')
      if (values.required_by) values.required_by = values.required_by.format('YYYY-MM-DD')
      const cust = customerList.find(c => c.id === values.customer_id)
      values.customer_name = cust?.name || ''
      const so = soList.find(s => s.id === values.so_id)
      values.so_number = so?.so_number || ''
      values.lines = lines.map(({ key, ...rest }) => rest)
      values.jobwork_vendor = selectedJobworkVendor || null
      // Poora maps array artwork_panels JSON mein; artwork_image mein pehli
      // map ki image (backward compatibility ke liye)
      const cleanMaps = artworkMaps.filter(m => m.image || (m.panels || []).length > 0)
      values.artwork_panels = cleanMaps
      values.artwork_image = cleanMaps[0]?.image || null
      await saveMutation.mutateAsync(values)
      setIsDirty(false)
      if (andNew) { form.resetFields(); setLines([]); navigate('/workshop/orders/new') }
    } catch (err) { }
  }

  const status = record?.status || 'draft'

  const generateWOPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 14

      // ── HEADER ──────────────────────────────────────
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, pageW, 28, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('ESSAR GLASS', margin, 11)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Manufacturing & Processing', margin, 17)
      doc.text('CENTER EG', margin, 22)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(record?.wo_number || 'WO-DRAFT', pageW - margin, 12, { align: 'right' })
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('WORKSHOP ORDER', pageW - margin, 18, { align: 'right' })

      // ── META INFO ────────────────────────────────────
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(9)
      const metaY = 36

      const metaLeft = [
        ['Customer', customerList.find(c => c.id === record?.customer_id)?.name || '—'],
        ['Sales Order', record?.so_number || '—'],
        ['Priority', (record?.priority || 'Normal').toUpperCase()],
      ]
      const metaRight = [
        ['Order Date', record?.order_date || dayjs().format('YYYY-MM-DD')],
        ['Required By', record?.required_by || '—'],
        ['WO Status', (record?.status || 'draft').toUpperCase()],
      ]

      metaLeft.forEach(([label, value], i) => {
        doc.setFont('helvetica', 'bold')
        doc.text(`${label}:`, margin, metaY + i * 6)
        doc.setFont('helvetica', 'normal')
        doc.text(value, margin + 28, metaY + i * 6)
      })
      metaRight.forEach(([label, value], i) => {
        doc.setFont('helvetica', 'bold')
        doc.text(`${label}:`, pageW / 2 + 20, metaY + i * 6)
        doc.setFont('helvetica', 'normal')
        doc.text(value, pageW / 2 + 50, metaY + i * 6)
      })

      if (record?.instructions) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Instructions: ${record.instructions}`, margin, metaY + 20)
      }

      // ── DIVIDER ──────────────────────────────────────
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, metaY + 24, pageW - margin, metaY + 24)

      // ── JOB CARDS TABLE ─────────────────────────────
      const groupedRows = []
      const seen = new Map()
      let totalWeightKg = 0
      lines.forEach((line) => {
        const lineWeight = computeLineWeightKg(line)
        totalWeightKg += lineWeight
        const key = (line.description || 'Unspecified').trim()
        if (!seen.has(key)) {
          seen.set(key, true)
          groupedRows.push([{
            content: key.toUpperCase(),
            colSpan: 13,
            styles: {
              fillColor: [227, 242, 253],
              textColor: [10, 40, 120],
              fontStyle: 'bold',
              fontSize: 9.5,
              halign: 'left',
            },
          }])
        }
        groupedRows.push([
          groupedRows.filter(r => r.length > 1).length + 1,
          '',
          line.serial_no || '—',
          line.act_w_in ? `${toFraction(line.act_w_in)}"` : '—',
          line.act_h_in ? `${toFraction(line.act_h_in)}"` : '—',
          line.act_w_mm ? `${line.act_w_mm}mm` : '—',
          line.act_h_mm ? `${line.act_h_mm}mm` : '—',
          line.qty || 1,
          line.cep ? 'YES' : 'NO',
          line.process_label || '—',
          line.is_toughened ? 'YES' : 'NO',
          lineWeight > 0 ? `${lineWeight}` : '—',
          line.remark || '—',
        ])
      })

      autoTable(doc, {
        theme: 'grid',
        startY: metaY + 28,
        head: [['#', 'Description', 'Serial No', 'W (in)', 'H (in)', 'W (mm)', 'H (mm)', 'Qty', 'CEP', 'Process', 'Tgh', 'Wt (kg)', 'Remark']],
        body: groupedRows,
        styles: { fontSize: 7.5, cellPadding: 2.5, lineWidth: 0.15, lineColor: [148, 163, 184] },
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          lineWidth: 0.15,
          lineColor: [99, 102, 241],
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0:  { cellWidth: 9,   halign: 'center' },
          1:  { cellWidth: 45 },
          2:  { cellWidth: 22,  halign: 'center' },
          3:  { cellWidth: 17,  halign: 'center' },
          4:  { cellWidth: 17,  halign: 'center' },
          5:  { cellWidth: 16,  halign: 'center' },
          6:  { cellWidth: 16,  halign: 'center' },
          7:  { cellWidth: 10,  halign: 'center' },
          8:  { cellWidth: 10,  halign: 'center' },
          9:  { cellWidth: 38 },
          10: { cellWidth: 10,  halign: 'center' },
          11: { cellWidth: 18,  halign: 'right' },
          12: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.row.raw.length === 1) return
          // CEP (col 8) & Tgh (col 10): YES → ZapfDingbats tick ✔ (green), NO → cross ✘ (light grey)
          if (data.section === 'body' && (data.column.index === 8 || data.column.index === 10)) {
            const v = data.cell.raw
            if (v === 'YES') {
              data.cell.text = ['4']
              data.cell.styles.font = 'zapfdingbats'
              data.cell.styles.textColor = [22, 163, 74]
              data.cell.styles.fontSize = 8.5
            } else if (v === 'NO') {
              data.cell.text = ['8']
              data.cell.styles.font = 'zapfdingbats'
              data.cell.styles.textColor = [203, 213, 225]
              data.cell.styles.fontSize = 8.5
            }
          }
          // Weight column (col 11): teal + bold
          if (data.section === 'body' && data.column.index === 11 && data.cell.raw !== '—') {
            data.cell.styles.textColor = [15, 118, 110]
            data.cell.styles.fontStyle = 'bold'
          }
        },
        margin: { left: margin, right: margin },
      })

      // ── TOTAL WEIGHT FOOTER ──────────────────────────────────
      const afterTableY = doc.lastAutoTable.finalY + 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(15, 118, 110)
      doc.text(
        `Total Weight: ${parseFloat(totalWeightKg.toFixed(2))} kg`,
        pageW - margin,
        afterTableY,
        { align: 'right' }
      )
      doc.setTextColor(15, 23, 42)


      // ── ARTWORK SHEETS — worker-facing, one FULL PAGE per artwork ──────
      const PANEL_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
      ]
      const pageH = doc.internal.pageSize.getHeight()
      const contentW = pageW - margin * 2

      const drawSheetHeader = (title, subtitle) => {
        doc.setFillColor(124, 58, 237)
        doc.rect(0, 0, pageW, 16, 'F')
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
        doc.text(title, margin, 10)
        doc.setFontSize(8); doc.setFont('helvetica', 'normal')
        doc.text(subtitle, pageW - margin, 10, { align: 'right' })
      }

      const fitDims = (iw, ih, maxW, maxH) => {
        const s = Math.min(maxW / iw, maxH / ih)
        return { w: iw * s, h: ih * s }
      }

      // 1) PANEL MAP SHEETS — har artwork map ka APNA full page, apne panels
      const validMaps = (artworkMaps || []).filter(m => m.image && (m.panels || []).length > 0)
      for (let mi = 0; mi < validMaps.length; mi++) {
        const map = validMaps[mi]
        try {
          const oImg = new Image()
          await new Promise((resolve, reject) => {
            oImg.onload = resolve
            oImg.onerror = reject
            oImg.src = map.image
          })

          const oCanvas = document.createElement('canvas')
          // Upscale small source images so overlays, labels, and the artwork
          // itself render crisp when the PDF stretches this to page width
          const UPSCALE_TARGET = 1400
          const up = Math.max(1, Math.min(3, UPSCALE_TARGET / Math.max(oImg.width, 1)))
          oCanvas.width = Math.round(oImg.width * up)
          oCanvas.height = Math.round(oImg.height * up)
          const oCtx = oCanvas.getContext('2d')
          oCtx.imageSmoothingEnabled = true
          oCtx.imageSmoothingQuality = 'high'
          oCtx.drawImage(oImg, 0, 0, oCanvas.width, oCanvas.height)

          const k = Math.max(oCanvas.width, oCanvas.height) / 800

          map.panels.forEach((p, i) => {
            const color = PANEL_COLORS[i % PANEL_COLORS.length]
            const line = (p.lineIndex != null) ? lines[p.lineIndex] : null
            // Normalized coords reproject exactly onto the full-resolution
            // image; legacy panels (no nx) fall back to raw pixel coords
            const px = (p.nx != null) ? p.nx * oCanvas.width : p.x * up
            const py = (p.ny != null) ? p.ny * oCanvas.height : p.y * up
            const pw = (p.nw != null) ? p.nw * oCanvas.width : p.w * up
            const ph = (p.nh != null) ? p.nh * oCanvas.height : p.h * up
            oCtx.strokeStyle = color
            oCtx.lineWidth = 1.5 * k
            oCtx.strokeRect(px, py, pw, ph)
            oCtx.fillStyle = color + '14'
            oCtx.fillRect(px, py, pw, ph)
            const bs = 34 * k
            oCtx.fillStyle = color
            oCtx.fillRect(px + 3 * k, py + 3 * k, bs, bs)
            oCtx.fillStyle = '#ffffff'
            oCtx.font = `bold ${22 * k}px sans-serif`
            oCtx.fillText(String(i + 1), px + 12 * k, py + 27 * k)
            if (line) {
              const label = `${line.description || 'Line ' + (p.lineIndex + 1)}  ${line.act_w_in ? toFraction(line.act_w_in) : '?'}"x${line.act_h_in ? toFraction(line.act_h_in) : '?'}" x${line.qty || 1}`
              oCtx.font = `bold ${18 * k}px sans-serif`
              const tw = oCtx.measureText(label).width + 14 * k
              oCtx.fillStyle = 'rgba(255,255,255,0.96)'
              oCtx.fillRect(px + 3 * k, py + ph - 26 * k, Math.min(tw, Math.max(pw - 6 * k, 40 * k)), 23 * k)
              oCtx.fillStyle = '#111111'
              oCtx.fillText(label, px + 8 * k, py + ph - 8 * k)
            }
          })

          doc.addPage()
          drawSheetHeader(
            `PANEL MAP ${validMaps.length > 1 ? `${mi + 1}/${validMaps.length} — ` : '— '}${String(map.name || 'ARTWORK').toUpperCase().substring(0, 30)}`,
            `${record?.wo_number || 'WO'}${record?.customer_name ? ' | ' + record.customer_name : ''}`
          )

          const legendH = 12 + map.panels.length * 7
          const maxImgH = pageH - 16 - 12 - legendH - 14
          const dims = fitDims(oCanvas.width, oCanvas.height, contentW, Math.max(90, maxImgH))
          const imgData = oCanvas.toDataURL('image/png')
          doc.addImage(imgData, 'PNG', (pageW - dims.w) / 2, 20, dims.w, dims.h)

          const pmTableRows = map.panels.map((p, i) => {
            const line = (p.lineIndex != null) ? lines[p.lineIndex] : null
            return [
              String(i + 1),
              line ? (line.description || `Line ${p.lineIndex + 1}`) : 'NOT ASSIGNED',
              line ? `${line.act_w_in ? toFraction(line.act_w_in) : '?'}" × ${line.act_h_in ? toFraction(line.act_h_in) : '?'}"` : '—',
              line ? String(line.qty || 1) : '—',
              (line?.toughened || line?.is_toughened) ? 'YES' : '—',
              p.note || '—',
            ]
          })

          autoTable(doc, {
            theme: 'grid',
            startY: 20 + dims.h + 6,
            head: [['Panel', 'Glass Line', 'Size', 'Qty', 'Tgh', 'Note']],
            body: pmTableRows,
            styles: { fontSize: 8.5, cellPadding: 2.5, lineWidth: 0.15, lineColor: [148, 163, 184] },
            headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold', lineWidth: 0.15, lineColor: [99, 102, 241] },
            alternateRowStyles: { fillColor: [245, 243, 255] },
            columnStyles: {
              0: { cellWidth: 14, halign: 'center' },
              1: { cellWidth: 70, fontStyle: 'bold' },
              2: { cellWidth: 35 },
              3: { cellWidth: 12, halign: 'center' },
              4: { cellWidth: 12, halign: 'center' },
              5: { cellWidth: 'auto' },
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
              if (data.row.raw.length === 1) return
              if (data.section === 'body' && data.column.index === 0) {
                const c = PANEL_COLORS[data.row.index % PANEL_COLORS.length]
                data.cell.styles.fillColor = [
                  parseInt(c.slice(1, 3), 16),
                  parseInt(c.slice(3, 5), 16),
                  parseInt(c.slice(5, 7), 16),
                ]
                data.cell.styles.textColor = 255
                data.cell.styles.fontStyle = 'bold'
              }
              if (data.section === 'body' && data.column.index === 1) {
                data.cell.styles.fontStyle = 'bold'
              }
            },
          })
        } catch (imgErr) {
          console.error('Panel map sheet failed:', imgErr)
        }
      }

      // 2) LINE ARTWORK SHEETS — har unique artwork ka apna FULL PAGE:
      //    badi image + neeche kaun si glass lines is design se banni hain
      const processLines = lines.filter(l => l.has_process && l.artwork_file_data)
      const artworkMap = new Map()
      processLines.forEach(l => {
        const key = l.artwork_master_id || l.key
        if (!artworkMap.has(key)) {
          artworkMap.set(key, {
            name: l.artwork_name || l.artwork_file_name || 'Artwork',
            data: l.artwork_file_data,
            rows: []
          })
        }
        artworkMap.get(key).rows.push(l)
      })

      for (const [, art] of artworkMap) {
        // Kisi panel-map sheet pe ye image already full-page aa chuki hai
        if (validMaps.some(m => m.image === art.data)) continue

        if (art.data && art.data.startsWith('data:image/')) {
          try {
            const im = new Image()
            await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = art.data })

            doc.addPage()
            drawSheetHeader(
              `ARTWORK: ${String(art.name).toUpperCase().substring(0, 40)}`,
              `${record?.wo_number || 'WO'}`
            )

            const tblH = 14 + art.rows.length * 7
            const maxImgH = pageH - 16 - 12 - tblH - 14
            const dims = fitDims(im.width, im.height, contentW, Math.max(100, maxImgH))
            const fmt = art.data.includes('data:image/png') ? 'PNG' : 'JPEG'
            doc.addImage(art.data, fmt, (pageW - dims.w) / 2, 20, dims.w, dims.h)

            autoTable(doc, {
              theme: 'grid',
              startY: 20 + dims.h + 6,
              head: [['#', 'Glass Line (uses this artwork)', 'Size', 'Qty', 'Tgh', 'Remark']],
              body: art.rows.map((l, i) => [
                String(i + 1),
                l.description || '—',
                `${l.act_w_in || '?'}" × ${l.act_h_in || '?'}"`,
                String(l.qty || 1),
                (l.toughened || l.is_toughened) ? 'YES' : '—',
                l.remark || '—',
              ]),
              styles: { fontSize: 8.5, cellPadding: 2.5, lineWidth: 0.15, lineColor: [148, 163, 184] },
              headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', lineWidth: 0.15, lineColor: [99, 102, 241] },
              alternateRowStyles: { fillColor: [238, 242, 255] },
              margin: { left: margin, right: margin },
            })
          } catch (e) {
            console.error('Artwork sheet failed:', e)
          }
        } else if (art.data && art.data.startsWith('data:application/pdf')) {
          doc.addPage()
          drawSheetHeader(
            `ARTWORK: ${String(art.name).toUpperCase().substring(0, 40)}`,
            `${record?.wo_number || 'WO'}`
          )
          doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
          doc.text(`PDF artwork attached: "${art.name}" — print/open the PDF file separately.`, margin, 30)
        }
      }

      // ── FOOTER ───────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        const footerY = doc.internal.pageSize.getHeight() - 8
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Generated: ${dayjs().format('DD/MM/YYYY HH:mm')} | For Internal Use Only`,
          margin, footerY
        )
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, footerY, { align: 'right' })
      }

      doc.save(`${record?.wo_number || 'WorkshopOrder'}_${dayjs().format('YYYYMMDD')}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      message.error('PDF generation failed: ' + (err?.message || 'Unknown error'))
    }
  }

  const generateWOExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Essar Glass ERP'
      wb.created = new Date()

      const ws = wb.addWorksheet('Workshop Order', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      })

      const customerName = customerList.find(c => c.id === record?.customer_id)?.name || '—'

      // ── HEADER ROWS ─────────────────────────────────
      ws.mergeCells('A1:L1')
      ws.getCell('A1').value = 'ESSAR GLASS — WORKSHOP ORDER'
      ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(1).height = 30

      ws.addRow([])

      const metaRows = [
        ['WO Number', record?.wo_number || '—', '', 'Order Date', record?.order_date || dayjs().format('YYYY-MM-DD')],
        ['Customer', customerName, '', 'Required By', record?.required_by || '—'],
        ['Sales Order', record?.so_number || '—', '', 'Priority', (record?.priority || 'Normal').toUpperCase()],
        ['Status', (record?.status || 'draft').toUpperCase(), '', 'Instructions', record?.instructions || '—'],
      ]
      metaRows.forEach(rowData => {
        const row = ws.addRow(rowData)
        row.getCell(1).font = { bold: true }
        row.getCell(4).font = { bold: true }
        row.height = 18
      })

      ws.addRow([])

      // ── TABLE HEADER ────────────────────────────────
      const headerRow = ws.addRow([
        '#', 'Description', 'Serial No', 'W (inch)', 'H (inch)',
        'W (mm)', 'H (mm)', 'Qty', 'CEP',
        'Process', 'Toughened', 'Artwork', 'Remark'
      ])
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        }
      })
      headerRow.height = 22

      // ── DATA ROWS ────────────────────────────────────
      lines.forEach((line, i) => {
        const row = ws.addRow([
          i + 1,
          line.description || '',
          line.serial_no || '',
          line.act_w_in ? parseFloat(line.act_w_in.toFixed(4)) : '',
          line.act_h_in ? parseFloat(line.act_h_in.toFixed(4)) : '',
          line.act_w_mm || '',
          line.act_h_mm || '',
          line.qty || 1,
          line.cep ? 'YES' : 'NO',
          line.process_label || '',
          line.is_toughened ? 'YES' : 'NO',
          line.artwork_name || '',
          line.remark || '',
        ])

        const bgColor = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.alignment = { vertical: 'middle', wrapText: true }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }
        })

        if (line.cep) {
          row.getCell(9).font = { bold: true, color: { argb: 'FF3B82F6' } }
        }
        if (line.is_toughened) {
          row.getCell(11).font = { bold: true, color: { argb: 'FFDC2626' } }
        }
        if (line.process_label) {
          row.getCell(10).font = { bold: true, color: { argb: 'FF7C3AED' } }
        }

        row.height = 20
      })

      // ── COLUMN WIDTHS ────────────────────────────────
      ws.columns = [
        { key: 'num', width: 5 },
        { key: 'desc', width: 35 },
        { key: 'serial', width: 15 },
        { key: 'win', width: 12 },
        { key: 'hin', width: 12 },
        { key: 'wmm', width: 10 },
        { key: 'hmm', width: 10 },
        { key: 'qty', width: 6 },
        { key: 'cep', width: 6 },
        { key: 'proc', width: 25 },
        { key: 'tough', width: 10 },
        { key: 'art', width: 30 },
        { key: 'rem', width: 30 },
      ]

      // ── ARTWORK SHEET ────────────────────────────────
      const artworkLines = lines.filter(l => l.has_process && l.artwork_file_data)

      if (artworkLines.length > 0) {
        const artWs = wb.addWorksheet('Artworks')

        artWs.mergeCells('A1:E1')
        artWs.getCell('A1').value = 'ARTWORK REFERENCES'
        artWs.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
        artWs.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
        artWs.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
        artWs.getRow(1).height = 28

        const artHeader = artWs.addRow(['#', 'Description', 'Dimensions', 'Process', 'Artwork Name'])
        artHeader.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        })
        artHeader.height = 20

        const artworkMap = new Map()
        artworkLines.forEach(l => {
          const key = l.artwork_master_id || l.key
          if (!artworkMap.has(key)) {
            artworkMap.set(key, {
              name: l.artwork_name || l.artwork_file_name || 'Artwork',
              data: l.artwork_file_data,
              lines: []
            })
          }
          artworkMap.get(key).lines.push(l)
        })

        Array.from(artworkMap.values()).forEach((art, idx) => {
          const sizeText = art.lines
            .map(l => `${l.description} ${l.act_w_in || '?'}"×${l.act_h_in || '?'}" qty:${l.qty || 1}`)
            .join('; ')
          const processText = art.lines.map(l => l.process_label).filter(Boolean).join(', ')

          const row = artWs.addRow([
            idx + 1,
            art.lines.map(l => l.description).join(', '),
            sizeText,
            processText,
            art.name,
          ])
          row.eachCell(cell => {
            cell.alignment = { vertical: 'middle', wrapText: true }
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            }
          })
          row.height = 40
        })

        artWs.addRow([])
        artWs.addRow(['ARTWORK IMAGES'])
        artWs.lastRow.getCell(1).font = { bold: true, size: 12 }

        let imgRow = artWs.lastRow.number + 1

        for (const [, art] of artworkMap) {
          if (art.data && art.data.startsWith('data:image/')) {
            try {
              const base64Data = art.data.split(',')[1]
              const mimeType = art.data.includes('data:image/png') ? 'png' : 'jpeg'

              const imgId = wb.addImage({
                base64: base64Data,
                extension: mimeType,
              })

              artWs.getRow(imgRow).getCell(1).value = art.name
              artWs.getRow(imgRow).getCell(1).font = { bold: true, color: { argb: 'FF7C3AED' } }

              imgRow++
              art.lines.forEach(l => {
                artWs.getRow(imgRow).getCell(1).value =
                  `  • ${l.description} — ${l.act_w_in || '?'}" × ${l.act_h_in || '?'}" (Qty: ${l.qty || 1})`
                artWs.getRow(imgRow).getCell(1).font = { color: { argb: 'FF64748B' }, size: 9 }
                imgRow++
              })

              artWs.addImage(imgId, {
                tl: { col: 1, row: imgRow },
                ext: { width: 300, height: 200 },
              })

              imgRow += 16

            } catch (imgErr) {
              artWs.getRow(imgRow).getCell(1).value = `[${art.name}] — image could not be embedded`
              imgRow += 2
            }
          } else {
            artWs.getRow(imgRow).getCell(1).value = art.name
            artWs.getRow(imgRow).getCell(1).font = { bold: true }
            imgRow++
            artWs.getRow(imgRow).getCell(1).value = '  [PDF artwork — open separately]'
            artWs.getRow(imgRow).getCell(1).font = { color: { argb: 'FFDC2626' }, italic: true }
            imgRow += 2
          }
        }

        artWs.columns = [
          { width: 5 }, { width: 35 }, { width: 40 }, { width: 25 }, { width: 30 }
        ]
      }

      // ── PANEL MAPPING SHEET ───────────────────────────
      const allPanels = (artworkMaps || []).flatMap((map, mapIdx) =>
        (map.panels || []).map((p) => ({ ...p, mapName: map.name || `Map ${mapIdx + 1}` }))
      )

      if (allPanels.length > 0) {
        const pmWs = wb.addWorksheet('Panel Mapping')

        // Header
        pmWs.mergeCells('A1:E1')
        pmWs.getCell('A1').value = 'MASTER ARTWORK — PANEL MAPPING'
        pmWs.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
        pmWs.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
        pmWs.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
        pmWs.getRow(1).height = 28

        // Sub-header: WO info
        pmWs.addRow([])
        const infoRow1 = pmWs.addRow(['WO Number', record?.wo_number || '—', 'Customer', customerName])
        infoRow1.getCell(1).font = { bold: true }
        infoRow1.getCell(3).font = { bold: true }
        infoRow1.height = 18

        pmWs.addRow([])

        // Table header
        const pmHeader = pmWs.addRow(['Map Name', 'Panel #', 'Assigned Line', 'Dimensions', 'Note'])
        pmHeader.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
          }
        })
        pmHeader.height = 22

        // Data rows
        allPanels.forEach((p, i) => {
          const line = (p.lineIndex != null) ? lines[p.lineIndex] : null
          const lineDesc = line
            ? (line.description || `Line ${p.lineIndex + 1}`)
            : 'Not assigned'
          const lineDims = line
            ? `${line.act_w_in || '?'}" × ${line.act_h_in || '?'}" (Qty: ${line.qty || 1})`
            : '—'

          const row = pmWs.addRow([
            p.mapName,
            i + 1,
            lineDesc,
            lineDims,
            p.note || '—',
          ])

          const bgColor = i % 2 === 0 ? 'FFF5F3FF' : 'FFFFFFFF'
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
            cell.alignment = { vertical: 'middle', wrapText: true }
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            }
            if (!line) {
              row.getCell(3).font = { color: { argb: 'FFEF4444' }, italic: true }
            }
          })
          row.height = 20
        })

        // Column widths
        pmWs.columns = [
          { width: 20 },
          { width: 10 },
          { width: 45 },
          { width: 30 },
          { width: 30 },
        ]

        // Summary row
        pmWs.addRow([])
        const totalRow = pmWs.addRow([
          `Total Panels: ${allPanels.length}`,
          `Assigned: ${allPanels.filter(p => p.lineIndex != null && lines[p.lineIndex]).length}`,
          `Unassigned: ${allPanels.filter(p => p.lineIndex == null || !lines[p.lineIndex]).length}`,
          '',
          '',
        ])
        totalRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FF7C3AED' } }
        })
        totalRow.height = 18
      }

      // ── SAVE ─────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      saveAs(blob, `${record?.wo_number || 'WorkshopOrder'}_${dayjs().format('YYYYMMDD')}.xlsx`)

    } catch (err) {
      console.error('Excel generation error:', err)
      message.error('Excel generation failed: ' + (err?.message || 'Unknown error'))
    }
  }

  return (
    <MasterForm title="Workshop Order" isEdit={isEdit} isLoading={isLoading} isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Workshop' }, { label: 'Workshop Orders', path: '/workshop/orders' }, { label: isEdit ? record?.wo_number || 'Edit' : 'New' }]}
      onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onDiscard={() => guardedNavigate('/workshop/orders')} onBack={() => guardedNavigate('/workshop/orders')}>

      <InterCompanyBanner docType="wo" linkedRef={record?.linked_ref} />

      {/* Smart Buttons */}
      {isEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          {record?.so_id && (
            <Button icon={<FileTextOutlined />} onClick={() => guardedNavigate(`/sales-orders/${record.so_id}/edit`)}>
              📋 SO: {record.so_number || `#${record.so_id}`}
            </Button>
          )}
          <Badge count={tbData?.total || 0}>
            <Button icon={<FireOutlined />} onClick={() => guardedNavigate(`/workshop/toughening?wo_id=${id}`)}>🔥 Toughening Batches</Button>
          </Badge>
        </div>
      )}

      {/* Status Bar */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Steps size="small" current={STATUS_IDX[status] || 0} items={STATUS_STEPS.map(s => ({ title: s.replace('_', ' ').toUpperCase() }))} />
        </Col>
        <Col xs={24} lg={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            {isSuperAdmin && isEdit && (
              <Button
                icon={<SwapOutlined />}
                onClick={handleOpenLinkWizard}
                style={{ borderColor: '#7c3aed', color: '#7c3aed', fontWeight: 500 }}
              >
                Link to Supplier Co.
              </Button>
            )}
            {/* Always-available download — works at every status, like the quotation */}
            <Button
              icon={<DownloadOutlined />}
              disabled={!isEdit}
              loading={exportLoading === 'pdf'}
              onClick={async () => {
                const hide = message.loading('Generating Workshop Order PDF...', 0)
                try {
                  await generateWOPdf()
                } catch (err) {
                  message.error('PDF generation failed: ' + (err?.message || 'Unknown error'))
                } finally {
                  hide()
                }
              }}
              style={{ borderColor: '#6366f1', color: '#6366f1' }}
            >
              Download PDF
            </Button>
            {status === 'draft' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartProcessing}
                style={{ background: '#f59e0b' }}
              >
                Start Processing
              </Button>
            )}
            {status === 'in_progress' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => changeStatus('completed')} style={{ background: '#10b981' }}>Mark Complete</Button>}
            {status === 'completed' && <Tag color="green" style={{ padding: '6px 12px', fontSize: 14 }}>✅ Completed</Tag>}

            {lines.some(l => l.is_toughened) && (
              <Button type="primary" style={{ background: '#dc2626' }} onClick={() => {
                guardedNavigate('/workshop/toughening/new', { state: { from_wo: id, lines: lines.filter(l => l.is_toughened) } })
              }}>Create Toughening Challan</Button>
            )}

          </Space>
        </Col>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ priority: 'normal', instructions: '', required_by: undefined, wo_number: '' }} onValuesChange={() => { if (hydratedRef.current) setIsDirty(true) }}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="so_id" label="Sales Order" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select SO" options={soList.filter(s => ['confirmed', 'in_production', 'ready'].includes(s.status)).map(s => ({ value: s.id, label: `${s.so_number} — ${customerList.find(c => c.id === s.customer_id)?.name || ''}` }))}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                onChange={handleSOSelect} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="customer_id" label="Customer">
              <Select disabled options={customerList.map(c => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </Col>
          <Col span={3}><Form.Item name="order_date" label="Order Date"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={3}><Form.Item name="required_by" label="Required By"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
          <Col span={3}>
            <Form.Item name="priority" label="Priority">
              <Select options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
            </Form.Item>
          </Col>
          <Col span={3}><Form.Item name="wo_number" label="WO #"><Input disabled placeholder="Auto" /></Form.Item></Col>
          <Col span={4}>
            <Form.Item label="Jobwork Vendor">
              <Select
                showSearch
                allowClear
                placeholder="Select Vendor"
                value={selectedJobworkVendor}
                onChange={setSelectedJobworkVendor}
                options={(Array.isArray(vendors) ? vendors : (vendors?.items || []))
                  .map(v => ({ value: v.name || v.id, label: v.name }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                notFoundContent={
                  <div style={{ textAlign: 'center', padding: 8, color: '#94a3b8', fontSize: 12 }}>
                    No vendors found. Add from Masters → Vendors
                  </div>
                }
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="instructions" label="Special Instructions"><TextArea rows={2} placeholder="Instructions for workshop..." /></Form.Item></Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ color: '#ea580c' }}>🔧 Job Cards</Text>
          {selectedLineKeys.length > 0 && (
            <Space>
              <Button
                size="small"
                type="primary"
                style={{ background: '#7c3aed' }}
                onClick={() => setBulkArtworkModal(true)}
              >
                Apply Artwork to {selectedLineKeys.length} Selected
              </Button>
              <Button
                size="small"
                type="primary"
                style={{ background: '#0284c7' }}
                onClick={() => { setBulkSerial(''); setSerialModal(true) }}
              >
                Add Serial Number to {selectedLineKeys.length} Selected
              </Button>
            </Space>
          )}
        </div>
        <Table
          dataSource={lines} columns={lineColumns} rowKey="key" size="small" pagination={false} scroll={{ x: 1000 }} style={{ marginBottom: 16 }}
          rowSelection={{
            selectedRowKeys: selectedLineKeys,
            onChange: keys => setSelectedLineKeys(keys),
            columnWidth: 32,
          }}
          expandable={{
            expandedRowRender: record => record.has_process ? (
              <div style={{ background: '#fafafa', padding: 16, border: '1px solid #e8e8e8', borderRadius: 4 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>Artwork File <span style={{ color: 'red' }}>*</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Select from master */}
                      <Select
                        placeholder="Select from Artwork Master"
                        style={{ width: '100%' }}
                        showSearch
                        allowClear
                        value={record.artwork_master_id || undefined}
                        options={artworkMaster.map(a => ({
                          value: a.id,
                          label: a.name
                        }))}
                        filterOption={(input, option) =>
                          option.label.toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={val => {
                          const artwork = artworkMaster.find(a => a.id === val)
                          updateLine(record.key, 'artwork_master_id', val)
                          updateLine(record.key, 'artwork_name', artwork?.name || '')
                          updateLine(record.key, 'artwork_file_data', artwork?.file_data || null)
                        }}
                      />

                      <Divider style={{ margin: '4px 0' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>or upload new</Text>
                      </Divider>

                      {/* Upload new artwork */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Input
                          placeholder="Artwork name (required to save to master)"
                          size="small"
                          style={{ flex: 1 }}
                          value={record.new_artwork_name || ''}
                          onChange={e => updateLine(record.key, 'new_artwork_name', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          style={{ flex: 1, fontSize: 12 }}
                          onChange={e => {
                            const file = e.target.files[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const base64 = ev.target.result
                              updateLine(record.key, 'artwork_file_data', base64)
                              updateLine(record.key, 'artwork_file_name', file.name)

                              // Save to master if name provided
                              if (record.new_artwork_name?.trim()) {
                                const newArtwork = saveToArtworkMaster(
                                  record.new_artwork_name.trim(),
                                  file.name,
                                  base64
                                )
                                updateLine(record.key, 'artwork_master_id', newArtwork.id)
                                updateLine(record.key, 'artwork_name', newArtwork.name)
                              }
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                        {record.artwork_file_data && (
                          <Tag color="green" style={{ fontSize: 11 }}>
                            ✓ {record.artwork_file_name || 'Attached'}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>Remark <span style={{ color: 'red' }}>*</span></div>
                    <Input placeholder="Enter remark..." value={record.remark} onChange={e => updateLine(record.key, 'remark', e.target.value)} />
                  </Col>
                </Row>
              </div>
            ) : null,
            rowExpandable: record => record.has_process,
            expandedRowKeys: expandedRowKeys,
            onExpandedRowsChange: keys => setExpandedRowKeys(keys),
          expandIconColumnIndex: -1
          }}
        />

        {/* ── Total Weight summary ─────────────────────── */}
        {(() => {
          const totalKg = lines.reduce((sum, l) => sum + computeLineWeightKg(l), 0)
          return totalKg > 0 ? (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 12,
              marginTop: -6,
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                borderRadius: 8,
                padding: '6px 14px',
              }}>
                <span style={{ fontSize: 13, color: '#475569' }}>Total Weight:</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f766e' }}>
                  {parseFloat(totalKg.toFixed(2))} kg
                </span>
              </div>
            </div>
          ) : null
        })()}

        {/* ── Artwork Panel Mapper ────────────────────────── */}
        <Card
          title={
            <span style={{ color: '#7c3aed', fontWeight: 600 }}>
              🎨 Artwork Panel Mapper
            </span>
          }
          size="small"
          style={{ marginBottom: 16, borderColor: '#e0e7ff' }}
          styles={{ header: { background: '#f5f3ff', borderBottom: '1px solid #e0e7ff' } }}
        >
          <Space style={{ marginBottom: 10 }} wrap>
            <Select
              style={{ minWidth: 200 }}
              value={artworkMaps.length ? activeMap : undefined}
              placeholder="No artwork map yet"
              options={artworkMaps.map((m, i) => ({ value: i, label: `Map ${i + 1}: ${m.name || 'untitled'}` }))}
              onChange={setActiveMap}
            />
            <Button onClick={() => {
              setArtworkMaps(p => [...p, { name: `Map ${p.length + 1}`, image: null, panels: [] }])
              setActiveMap(artworkMaps.length)
            }}>+ New Map</Button>
            {artworkMaps.length > 0 && (
              <>
                <Input
                  style={{ width: 180 }}
                  placeholder="Map name (PDF heading)"
                  value={artworkMaps[activeMap]?.name || ''}
                  onChange={e => updateActiveMap({ name: e.target.value })}
                />
                <Button danger onClick={() => {
                  setArtworkMaps(p => p.filter((_, i) => i !== activeMap))
                  setActiveMap(0)
                }}>Delete Map</Button>
              </>
            )}
          </Space>
          <ArtworkPanelMapper
            lines={lines}
            value={artworkMaps[activeMap]?.panels || []}
            onChange={(pnls) => updateActiveMap({ panels: pnls })}
            onImageChange={(img) => {
              if (artworkMaps.length === 0) {
                setArtworkMaps([{ name: 'Map 1', image: img, panels: [] }])
                setActiveMap(0)
              } else {
                updateActiveMap({ image: img })
              }
            }}
            initialImage={artworkMaps[activeMap]?.image || null}
            artworkSources={(() => {
              const seen = new Set()
              const srcs = []
              lines.forEach((l, i) => {
                if (l.artwork_file_data && !seen.has(l.artwork_file_data)) {
                  seen.add(l.artwork_file_data)
                  srcs.push({ label: `Line ${i + 1}: ${l.artwork_name || l.artwork_file_name || 'artwork'}`, data: l.artwork_file_data })
                }
              })
              artworkMaster.forEach(a => {
                if (a.file_data && !seen.has(a.file_data)) {
                  seen.add(a.file_data)
                  srcs.push({ label: `Master: ${a.name}`, data: a.file_data })
                }
              })
              return srcs
            })()}
          />
        </Card>

        <Modal
          title="Apply Artwork to Selected Lines"
          open={bulkArtworkModal}
          onCancel={() => {
            setBulkArtworkModal(false)
            setBulkArtworkId(null)
            setBulkArtworkName('')
            setBulkArtworkFileData(null)
            setBulkArtworkFileName(null)
          }}
          onOk={() => {
            let artToApply = null
            if (bulkArtworkFileData) {
              const nameToUse = bulkArtworkName?.trim() || bulkArtworkFileName || 'New Artwork'
              artToApply = saveToArtworkMaster(nameToUse, bulkArtworkFileName, bulkArtworkFileData)
            } else if (bulkArtworkId) {
              artToApply = artworkMaster.find(a => a.id === bulkArtworkId)
            }

            if (!artToApply) {
              message.warning('Select an artwork or upload a new one')
              return
            }

            setLines(prev => prev.map(l =>
              selectedLineKeys.includes(l.key)
                ? {
                  ...l,
                  artwork_master_id: artToApply.id,
                  artwork_name: artToApply.name,
                  artwork_file_data: artToApply.file_data,
                  artwork_file_name: artToApply.file_name || l.artwork_file_name,
                  has_process: true,
                }
                : l
            ))
            setExpandedRowKeys(prev => {
              const newKeys = selectedLineKeys.filter(k => !prev.includes(k))
              return [...prev, ...newKeys]
            })
            message.success(`Artwork applied to ${selectedLineKeys.length} lines`)
            setBulkArtworkModal(false)
            setSelectedLineKeys([])
            setBulkArtworkId(null)
            setBulkArtworkName('')
            setBulkArtworkFileData(null)
            setBulkArtworkFileName(null)
          }}
          okText="Apply"
          okButtonProps={{ style: { background: '#7c3aed' }, disabled: !bulkArtworkId && !bulkArtworkFileData }}
        >
          <Select
            placeholder="Select artwork from master"
            style={{ width: '100%' }}
            showSearch
            allowClear
            value={bulkArtworkId}
            options={artworkMaster.map(a => ({
              value: a.id, label: a.name
            }))}
            onChange={val => {
              setBulkArtworkId(val)
              if (val) {
                setBulkArtworkFileData(null)
                setBulkArtworkFileName(null)
              }
            }}
          />

          <Divider style={{ margin: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>or upload new</Text>
          </Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input
              placeholder="Artwork name (required to save to master)"
              size="small"
              value={bulkArtworkName}
              onChange={e => setBulkArtworkName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*,.pdf"
                style={{ flex: 1, fontSize: 12 }}
                onChange={e => {
                  const file = e.target.files[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    setBulkArtworkFileData(ev.target.result)
                    setBulkArtworkFileName(file.name)
                    setBulkArtworkId(null)
                  }
                  reader.readAsDataURL(file)
                }}
              />
              {bulkArtworkFileData && (
                <Tag color="green" style={{ fontSize: 11 }}>
                  ✓ {bulkArtworkFileName || 'Attached'}
                </Tag>
              )}
            </div>
          </div>

          {artworkMaster.length === 0 && !bulkArtworkFileData && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              No artworks in master yet. Upload a new artwork or pick one once added.
            </Text>
          )}
        </Modal>

        {/* Bulk Add Serial Number Modal */}
        <Modal
          title="Add Serial Number to Selected Lines"
          open={serialModal}
          onCancel={() => setSerialModal(false)}
          onOk={() => {
            const s = (bulkSerial || '').trim()
            if (!s) { message.warning('Enter a serial number'); return }
            setLines(prev => prev.map(l =>
              selectedLineKeys.includes(l.key) ? { ...l, serial_no: s } : l
            ))
            setSerialModal(false)
            setSelectedLineKeys([])
            setBulkSerial('')
            message.success(`Serial number applied to ${selectedLineKeys.length} line(s)`)
          }}
          okText="Apply"
        >
          <Input
            placeholder="Enter serial number"
            value={bulkSerial}
            onChange={e => setBulkSerial(e.target.value)}
            onPressEnter={() => {
              const s = (bulkSerial || '').trim()
              if (!s) { message.warning('Enter a serial number'); return }
              setLines(prev => prev.map(l =>
                selectedLineKeys.includes(l.key) ? { ...l, serial_no: s } : l
              ))
              setSerialModal(false)
              setSelectedLineKeys([])
              setBulkSerial('')
              message.success(`Serial number applied to ${selectedLineKeys.length} line(s)`)
            }}
          />
        </Modal>
      </Form>

      {/* Export Wizard Modal */}
      <Modal
        title={
          <Space>
            <span>📋</span>
            <span style={{ fontWeight: 700 }}>Export & Start Processing</span>
          </Space>
        }
        open={exportWizard}
        onCancel={() => { setExportWizard(false); setWaLink(null) }}
        footer={null}
        width={480}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Download the Workshop Order before starting. Choose your format:
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {/* PDF Button */}
            <div
              onClick={async () => {
                setExportLoading('pdf')
                try {
                  await generateWOPdf()
                  const phone = customerList.find(c => c.id === record?.customer_id)?.phone || ''
                  const msg = encodeURIComponent(
                    `Hi, please find attached the Workshop Order *${record?.wo_number}* for SO *${record?.so_number}*.\n` +
                    `Customer: ${customerList.find(c => c.id === record?.customer_id)?.name || ''}\n` +
                    `Items: ${lines.length} job card(s)\n` +
                    `Date: ${dayjs().format('DD/MM/YYYY')}`
                  )
                  if (phone) setWaLink(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`)
                } finally {
                  setExportLoading(null)
                }
              }}
              style={{
                flex: 1, border: '2px solid #e2e8f0', borderRadius: 10,
                padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.2s',
                background: exportLoading === 'pdf' ? '#eff6ff' : '#fff',
                borderColor: exportLoading === 'pdf' ? '#3b82f6' : '#e2e8f0',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>PDF</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                With artwork images inline
              </div>
            </div>

            {/* Excel Button */}
            <div
              onClick={async () => {
                setExportLoading('excel')
                try {
                  await generateWOExcel()
                  const phone = customerList.find(c => c.id === record?.customer_id)?.phone || ''
                  const msg = encodeURIComponent(
                    `Hi, please find attached the Workshop Order *${record?.wo_number}* for SO *${record?.so_number}*.\n` +
                    `Customer: ${customerList.find(c => c.id === record?.customer_id)?.name || ''}\n` +
                    `Items: ${lines.length} job card(s)\n` +
                    `Date: ${dayjs().format('DD/MM/YYYY')}`
                  )
                  if (phone) setWaLink(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`)
                } finally {
                  setExportLoading(null)
                }
              }}
              style={{
                flex: 1, border: '2px solid #e2e8f0', borderRadius: 10,
                padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.2s',
                background: exportLoading === 'excel' ? '#f0fdf4' : '#fff',
                borderColor: exportLoading === 'excel' ? '#10b981' : '#e2e8f0',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Excel</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Tabular format, artwork names only
              </div>
            </div>
          </div>

          {/* WhatsApp link — shows after download */}
          {waLink && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 8, padding: '12px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                  Send via WhatsApp
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Opens WhatsApp with pre-filled message. Attach the downloaded file manually.
                </div>
              </div>
              <Button
                size="small"
                style={{ background: '#25d366', borderColor: '#25d366', color: '#fff', fontWeight: 600 }}
                onClick={() => window.open(waLink, '_blank')}
              >
                Open WA
              </Button>
            </div>
          )}

          {/* Start Processing button */}
          <Button
            type="primary"
            block
            icon={<PlayCircleOutlined />}
            style={{ background: '#f59e0b', borderColor: '#f59e0b', height: 42, fontSize: 14, fontWeight: 600 }}
            onClick={() => {
              setExportWizard(false)
              setWaLink(null)
              changeStatus('in_progress')
            }}
          >
            Start Processing Now
          </Button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>
            You can download again any time after starting.
          </p>
        </div>
      </Modal>

      {/* ── Unsaved Changes Leave Guard ── */}
      <Modal
        open={leavePrompt !== null}
        title="Unsaved changes"
        onCancel={() => setLeavePrompt(null)}
        footer={[
          <Button key="stay" onClick={() => setLeavePrompt(null)}>Stay</Button>,
          <Button key="discard" danger onClick={() => {
            setIsDirty(false)
            const prompt = leavePrompt
            setLeavePrompt(null)
            if (prompt === '__back__') setTimeout(() => window.history.back(), 0)
            else if (typeof prompt === 'string') navigate(prompt)
            else if (prompt?.path) navigate(prompt.path, prompt.options)
          }}>Leave without saving</Button>,
          <Button key="save" type="primary" loading={saveMutation.isPending}
            onClick={async () => {
              try {
                await handleSave(false)
                const prompt = leavePrompt
                setLeavePrompt(null)
                if (prompt === '__back__') setTimeout(() => window.history.back(), 0)
                else if (typeof prompt === 'string') navigate(prompt)
                else if (prompt?.path) navigate(prompt.path, prompt.options)
              } catch {
                setLeavePrompt(null)
              }
            }}>Save &amp; Leave</Button>,
        ].filter(Boolean)}
      >
        <p>You have unsaved changes. If you leave now, all changes will be lost.</p>
      </Modal>

      {/* ── Inter-Company Link Wizard Modal ── */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#7c3aed' }} />
            <span>Link Workshop Order to Supplier Company</span>
          </Space>
        }
        open={linkWizard}
        onCancel={() => setLinkWizard(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setLinkWizard(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={linkLoading}
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={handleConfirmInterCompanyLink}
          >
            Create Linked PO + SO + WO
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            This cross-company workflow creates a Purchase Order in the source company and a linked Sales Order &amp; Workshop Order in the selected supplier company.
          </Text>
        </div>

        <Form layout="vertical">
          <Form.Item label={<Text strong>1. Select Supplier Company</Text>} required>
            <Select
              placeholder="Select supplier company..."
              value={selectedSupplierCompanyId}
              onChange={setSelectedSupplierCompanyId}
              options={supplierCompanies.map(c => ({
                value: c.id,
                label: (
                  <span>
                    <Tag color={c.color || 'purple'} style={{ marginRight: 8 }}>{c.short_name || c.name}</Tag>
                    {c.name}
                  </span>
                ),
              }))}
            />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong>2. Select Glass Lines ({selectedLinkLineKeys.length}/{lines.length} selected)</Text>
            <Checkbox
              checked={lines.length > 0 && selectedLinkLineKeys.length === lines.length}
              indeterminate={selectedLinkLineKeys.length > 0 && selectedLinkLineKeys.length < lines.length}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedLinkLineKeys(lines.map(l => l.key))
                } else {
                  setSelectedLinkLineKeys([])
                }
              }}
            >
              Select All
            </Checkbox>
          </div>

          <Table
            size="small"
            dataSource={lines}
            rowKey="key"
            pagination={false}
            columns={[
              {
                title: '',
                width: 40,
                render: (_, row) => (
                  <Checkbox
                    checked={selectedLinkLineKeys.includes(row.key)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedLinkLineKeys(prev => [...prev, row.key])
                      } else {
                        setSelectedLinkLineKeys(prev => prev.filter(k => k !== row.key))
                      }
                    }}
                  />
                ),
              },
              {
                title: 'Description',
                dataIndex: 'description',
                render: (v) => <Text strong>{v || 'Glass Line'}</Text>,
              },
              {
                title: 'Size (W x H)',
                render: (_, row) => {
                  const win = row.act_w_in ? `${toFraction(row.act_w_in)}"` : (row.act_w_mm ? `${row.act_w_mm}mm` : '—')
                  const hin = row.act_h_in ? `${toFraction(row.act_h_in)}"` : (row.act_h_mm ? `${row.act_h_mm}mm` : '—')
                  return `${win} × ${hin}`
                },
              },
              {
                title: 'Qty',
                dataIndex: 'qty',
                width: 60,
                align: 'center',
                render: (v) => v || 1,
              },
              {
                title: 'Artwork',
                width: 130,
                render: (_, row) => lineHasArtwork(row) ? (
                  <Tag color="purple">🎨 Artwork</Tag>
                ) : (
                  <Tag color="default">No Artwork</Tag>
                ),
              },
            ]}
          />
        </div>
      </Modal>

      {/* ── Inter-Company Link Result Modal ── */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#10b981', fontSize: 20 }} />
            <span>Inter-Company Documents Created</span>
          </Space>
        }
        open={Boolean(linkResultModal)}
        onCancel={() => setLinkResultModal(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setLinkResultModal(null)}>
            Done
          </Button>,
        ]}
      >
        {linkResultModal && (
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1e293b' }}>
              Created PO <strong>{linkResultModal.po_number}</strong> ({linkResultModal.source_company}) + SO <strong>{linkResultModal.so_number}</strong> &amp; WO <strong>{linkResultModal.wo_number}</strong> ({linkResultModal.supplier_company})
            </p>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, margin: '16px 0', border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                💡 Note: The newly created Sales Order and Workshop Order belong to <strong>{linkResultModal.supplier_company}</strong>. To view them in full detail, switch your <strong>Viewing</strong> company header dropdown to {linkResultModal.supplier_company}.
              </Text>

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="default"
                  block
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    setLinkResultModal(null)
                    navigate(`/sales-orders/${linkResultModal.so_id}/edit`)
                  }}
                >
                  Open Supplier SO ({linkResultModal.so_number})
                </Button>

                <Button
                  type="default"
                  block
                  icon={<ToolOutlined />}
                  onClick={() => {
                    setLinkResultModal(null)
                    navigate(`/workshop/orders/${linkResultModal.wo_id}/edit`)
                  }}
                >
                  Open Supplier WO ({linkResultModal.wo_number})
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

    </MasterForm>
  )
}

export default WorkshopOrderForm
