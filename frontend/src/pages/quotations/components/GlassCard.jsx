import React from 'react'
import { 
  Collapse, 
  Tag, 
  Tooltip, 
  Button, 
  Row, 
  Col, 
  Typography, 
  Select, 
  Switch, 
  InputNumber, 
  Table, 
  Form, 
  Input, 
  Space,
  Divider
} from 'antd'
import { 
  DeleteOutlined, 
  LineChartOutlined, 
  PlusOutlined, 
  CloseCircleOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  PictureOutlined,
  CloseOutlined
} from '@ant-design/icons'
import FractionInput, { toFraction } from './FractionInput'
import { calcGroupSize, getAutoChargedDim } from '../../../utils/quotationCalc'

const { Text } = Typography

// ── Reusable Component: Size Processes (Inline Size Processes List) ──────
const SizeProcessList = ({
  size,
  groupKey,
  processMasters,
  updateSizeProcess,
  removeSizeProcess,
  addSizeProcess
}) => {
  const sizeProcesses = size.size_processes || []

  const columns = [
    {
      title: 'Process Name',
      dataIndex: 'process_id',
      width: 250,
      render: (val, proc) => (
        <Select
          size="small"
          placeholder="Select process"
          value={val || undefined}
          style={{ width: '100%' }}
          options={processMasters
            .filter(p => ['hole', 'cutout', 'farma', 'beveling'].includes(p.process_type))
            .map(p => ({ value: p.id, label: p.name }))}
          onChange={newVal => updateSizeProcess(groupKey, size.size_key, proc.sproc_key, 'process_id', newVal)}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'qty_area',
      width: 90,
      render: (val, proc) => (
        <InputNumber
          size="small"
          value={val}
          min={0}
          style={{ width: '100%', borderRadius: 4 }}
          placeholder="Qty"
          onChange={newVal => updateSizeProcess(groupKey, size.size_key, proc.sproc_key, 'qty_area', newVal)}
        />
      )
    },
    {
      title: 'Unit',
      dataIndex: 'charge_type',
      width: 80,
      render: (val, proc) => {
        const matched = processMasters.find(p => p.id === proc.process_id)
        const unitLabel = matched?.charge_type || proc.charge_type || 'pcs'
        return (
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
            {unitLabel === 'per_piece' ? 'pcs' : unitLabel === 'per_sqft' ? 'sqft' : unitLabel === 'per_rft' ? 'rft' : unitLabel === 'fixed' ? 'fixed' : unitLabel}
          </Text>
        )
      }
    },
    {
      title: 'Selling Rate',
      dataIndex: 'rate',
      width: 110,
      render: (val, proc) => (
        <InputNumber
          size="small"
          value={val}
          min={0}
          prefix="₹"
          style={{ width: '100%', borderRadius: 4 }}
          onChange={newVal => updateSizeProcess(groupKey, size.size_key, proc.sproc_key, 'rate', newVal)}
        />
      )
    },
    {
      title: 'Cost Rate',
      dataIndex: 'cost_rate',
      width: 110,
      render: (val, proc) => (
        <InputNumber
          size="small"
          value={val || 0}
          min={0}
          prefix="₹"
          placeholder="Cost"
          style={{ width: '100%', borderColor: '#f59e0b', borderRadius: 4 }}
          onChange={newVal => updateSizeProcess(groupKey, size.size_key, proc.sproc_key, 'cost_rate', newVal)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: val => (
        <Text strong style={{ color: '#4f46e5', fontSize: 12 }}>
          ₹{Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: '',
      width: 50,
      align: 'center',
      render: (_, proc) => (
        <Button 
          size="small" 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeSizeProcess(groupKey, size.size_key, proc.sproc_key)} 
        />
      )
    }
  ]

  return (
    <div style={{ 
      padding: '12px 16px', 
      background: '#F8FAFC', 
      borderRadius: 10, 
      border: '1px solid #E2E8F0', 
      margin: '6px 0 10px 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThunderboltOutlined style={{ color: '#7c3aed' }} /> Size-Specific Processes
        </Text>
        {sizeProcesses.length > 0 && (
          <Text style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
            Subtotal: ₹{sizeProcesses.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        )}
      </div>

      {sizeProcesses.length > 0 && (
        <Table
          dataSource={sizeProcesses}
          columns={columns}
          rowKey="sproc_key"
          size="small"
          pagination={false}
          style={{ background: 'transparent' }}
          bordered={false}
        />
      )}

      <Button 
        type="dashed" 
        size="small" 
        icon={<PlusOutlined />} 
        style={{ 
          marginTop: 6, 
          fontSize: 11, 
          borderColor: '#7c3aed', 
          color: '#7c3aed',
          borderRadius: 6
        }} 
        onClick={() => addSizeProcess(groupKey, size.size_key)}
      >
        + Add Process
      </Button>
    </div>
  )
}

// ── Size Table Component ─────────────────────────────────────────────────
const SizeTable = ({
  group,
  unit,
  processMasters,
  updateSize,
  updateSizeProcess,
  removeSizeProcess,
  addSizeProcess,
  addSize,
  removeSize,
  setGroups,
  products
}) => {
  const columns = [
    {
      title: '#',
      width: 40,
      align: 'center',
      render: (_, __, i) => (
        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
          {String.fromCharCode(97 + i)}
        </Text>
      )
    },
    {
      title: `Actual W (${unit === 'inch' ? 'in' : 'mm'})`,
      width: 110,
      dataIndex: 'width_inch',
      render: (v, row) => unit === 'inch' ? (
        <FractionInput value={v} onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val)} placeholder="84 1/4" />
      ) : (
        <InputNumber size="small" value={v ? parseFloat((v * 25.4).toFixed(2)) : null} min={0} style={{ width: '100%' }} onChange={val => updateSize(group.group_key, row.size_key, 'width_inch', val ? val / 25.4 : null)} />
      )
    },
    {
      title: `Actual H (${unit === 'inch' ? 'in' : 'mm'})`,
      width: 110,
      dataIndex: 'height_inch',
      render: (v, row) => unit === 'inch' ? (
        <FractionInput value={v} onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val)} placeholder="48 1/2" />
      ) : (
        <InputNumber size="small" value={v ? parseFloat((v * 25.4).toFixed(2)) : null} min={0} style={{ width: '100%' }} onChange={val => updateSize(group.group_key, row.size_key, 'height_inch', val ? val / 25.4 : null)} />
      )
    },
    {
      title: 'Qty',
      width: 70,
      dataIndex: 'quantity',
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v} 
          min={1} 
          style={{ width: '100%', borderRadius: 4 }} 
          onChange={val => updateSize(group.group_key, row.size_key, 'quantity', val)} 
        />
      )
    },
    {
      title: 'Charged W',
      width: 90,
      dataIndex: 'charged_w_inch',
      render: (v, row) => {
        const isManual = !!row._charged_w_manual;
        const input = (
          <InputNumber 
            size="small" 
            value={v ? parseFloat(v.toFixed(3)) : null} 
            min={0} 
            step={0.5} 
            style={{ width: '100%', borderColor: isManual ? '#f59e0b' : undefined, borderRadius: 4 }}
            onChange={val => setGroups(prev => prev.map(g => { 
              if (g.group_key !== group.group_key) return g; 
              return { 
                ...g, 
                sizes: g.sizes.map(s => { 
                  if (s.size_key !== row.size_key) return s; 
                  const isManualVal = val !== null && val !== undefined;
                  const updatedSize = {
                    ...s,
                    charged_w_inch: val,
                    _charged_w_manual: isManualVal
                  };
                  return calcGroupSize(g, updatedSize, products);
                }) 
              } 
            }))} 
          />
        );
        return isManual ? (
          <Tooltip title="Manual override — clear to restore auto">
            {input}
          </Tooltip>
        ) : input;
      }
    },
    {
      title: 'Charged H',
      width: 90,
      dataIndex: 'charged_h_inch',
      render: (v, row) => {
        const isManual = !!row._charged_h_manual;
        const input = (
          <InputNumber 
            size="small" 
            value={v ? parseFloat(v.toFixed(3)) : null} 
            min={0} 
            step={0.5} 
            style={{ width: '100%', borderColor: isManual ? '#f59e0b' : undefined, borderRadius: 4 }}
            onChange={val => setGroups(prev => prev.map(g => { 
              if (g.group_key !== group.group_key) return g; 
              return { 
                ...g, 
                sizes: g.sizes.map(s => { 
                  if (s.size_key !== row.size_key) return s; 
                  const isManualVal = val !== null && val !== undefined;
                  const updatedSize = {
                    ...s,
                    charged_h_inch: val,
                    _charged_h_manual: isManualVal
                  };
                  return calcGroupSize(g, updatedSize, products);
                }) 
              } 
            }))} 
          />
        );
        return isManual ? (
          <Tooltip title="Manual override — clear to restore auto">
            {input}
          </Tooltip>
        ) : input;
      }
    },
    {
      title: 'Sqft',
      width: 90,
      dataIndex: 'charged_sqft',
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v ? parseFloat(v.toFixed(3)) : null} 
          min={0} 
          step={0.001} 
          style={{ width: '100%', borderRadius: 4 }}
          onChange={val => setGroups(prev => prev.map(g => { 
            if (g.group_key !== group.group_key) return g; 
            return { 
              ...g, 
              sizes: g.sizes.map(s => { 
                if (s.size_key !== row.size_key) return s; 
                const cs = parseFloat((val || 0).toFixed(4)), eff = g.pricing_method === 'per_rft' ? s.running_ft : g.pricing_method === 'per_piece' ? (s.quantity || 1) : cs, sub = parseFloat((eff * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (s.cep_charges || 0)).toFixed(2)); 
                return { ...s, charged_sqft: cs, subtotal: sub } 
              }) 
            } 
          }))} 
        />
      )
    },
    ...(group.cep ? [{
      title: <span>CEP <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>Polish</Tag></span>,
      width: 100,
      dataIndex: 'cep_charges',
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v ? parseFloat(v.toFixed(2)) : 0} 
          min={0} 
          prefix="₹" 
          style={{ width: '100%', borderColor: '#3b82f6', borderRadius: 4 }}
          onChange={val => setGroups(prev => prev.map(g => { 
            if (g.group_key !== group.group_key) return g; 
            return { 
              ...g, 
              sizes: g.sizes.map(s => { 
                if (s.size_key !== row.size_key) return s; 
                const sub = parseFloat(((s.total_sqft || 0) * (g.rate || 0) * (1 - (g.discount_pct || 0) / 100) + (val || 0)).toFixed(2)); 
                return { ...s, cep_charges: val, subtotal: sub } 
              }) 
            } 
          }))} 
        />
      )
    }] : []),
    {
      title: 'Amount',
      dataIndex: 'subtotal',
      width: 120,
      align: 'right',
      render: (v, row) => (
        <InputNumber 
          size="small" 
          value={v ? parseFloat(v.toFixed(2)) : 0} 
          min={0} 
          prefix="₹" 
          style={{ width: '100%', borderRadius: 4 }}
          onChange={val => setGroups(prev => prev.map(g => { 
            if (g.group_key !== group.group_key) return g; 
            return { ...g, sizes: g.sizes.map(s => s.size_key !== row.size_key ? s : { ...s, subtotal: val }) } 
          }))} 
        />
      )
    },
    {
      title: '',
      width: 45,
      align: 'center',
      render: (_, row) => (
        <Button 
          size="small" 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeSize(group.group_key, row.size_key)} 
        />
      )
    }
  ]

  return (
    <Table
      dataSource={group.sizes}
      rowKey="size_key"
      size="small"
      pagination={false}
      scroll={{ x: 'max-content' }}
      expandable={{
        expandedRowRender: (size) => (
          <SizeProcessList
            size={size}
            groupKey={group.group_key}
            processMasters={processMasters}
            updateSizeProcess={updateSizeProcess}
            removeSizeProcess={removeSizeProcess}
            addSizeProcess={addSizeProcess}
          />
        ),
        rowExpandable: () => true,
        defaultExpandAllRows: true, // Auto-expand all sizes to show assigned processes immediately below them
        expandIcon: ({ expanded, onExpand, record }) => (
          <Button
            size="small"
            type={(record.size_processes || []).length > 0 ? 'primary' : 'default'}
            icon={expanded ? <CloseCircleOutlined /> : <PlusOutlined />}
            style={{
              fontSize: 10,
              padding: '0 4px',
              height: 20,
              background: (record.size_processes || []).length > 0 ? '#7c3aed' : undefined,
              borderColor: (record.size_processes || []).length > 0 ? '#7c3aed' : undefined
            }}
            onClick={e => onExpand(record, e)}
          />
        )
      }}
      columns={columns}
      footer={() => (
        <Button 
          type="dashed" 
          size="small" 
          icon={<PlusOutlined />} 
          style={{ borderRadius: 6 }} 
          onClick={() => addSize(group.group_key)}
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
  )
}

// ── Main GlassCard Component ─────────────────────────────────────────────
const GlassCard = ({
  group,
  gi,
  unit,
  dropdownConfig,
  customSearchVal,
  setCustomSearchVal,
  products = [],
  processMasters = [],
  updateGroup,
  removeGroup,
  openComparisonWizard,
  updateSize,
  updateSizeProcess,
  removeSizeProcess,
  addSizeProcess,
  addSize,
  removeSize,
  updateGroupProcess,
  removeGroupProcess,
  addGroupProcess,
  setGroups,
  queryClient,
  message,
  CEILING_OPTIONS,
  productApi
}) => {
  const groupTotal = group.sizes.reduce((s, x) => s + (x.subtotal || 0), 0)

  const handleCreateProductMaster = async () => {
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
        internal_ref: ''
      })
      message.success('Product added to Masters!')
      queryClient.invalidateQueries({ queryKey: ['products-dd'] })
    } catch {
      message.error('Failed to add product')
    }
  }

  return (
    <Collapse 
      style={{ 
        marginBottom: 16, 
        borderRadius: 14, 
        border: '1px solid #E2E8F0', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
        overflow: 'hidden', 
        background: '#fff' 
      }}
      defaultActiveKey={['1']}
    >
      <Collapse.Panel 
        key="1" 
        style={{ border: 'none' }}
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexWrap: 'wrap', paddingRight: 8 }}>
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
            
            {group.description ? (
              <Tag color="indigo" style={{ margin: 0, fontWeight: 600, fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
                {group.description}
              </Tag>
            ) : (
              <Tag style={{ margin: 0, color: '#94A3B8', borderColor: '#E2E8F0', borderRadius: 4 }}>
                Auto-generated
              </Tag>
            )}

            {group.glass_thickness && (
              <Tag color="orange" style={{ margin: 0, fontWeight: 500, borderRadius: 4 }}>
                {group.glass_thickness}mm
              </Tag>
            )}

            {group.glass_type && (
              <Tag color="green" style={{ margin: 0, fontWeight: 500, borderRadius: 4 }}>
                {group.glass_type}
              </Tag>
            )}

            {group.glass_category && (
              <Tag color="blue" style={{ margin: 0, fontWeight: 500, borderRadius: 4 }}>
                {group.glass_category}
              </Tag>
            )}

            {group.rate > 0 && (
              <span style={{ 
                fontSize: 11, 
                color: '#475569', 
                background: '#F1F5F9', 
                padding: '2px 8px', 
                borderRadius: 6, 
                fontWeight: 500,
                border: '1px solid #E2E8F0' 
              }}>
                ₹{group.rate}/sqft
              </span>
            )}

            {group.cep && <Tag color="cyan" style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>CEP</Tag>}
            {group.is_toughened && <Tag color="volcano" style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>Toughened</Tag>}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                ₹{groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              
              <Tooltip title="Cost vs Selling Wizard">
                <Button 
                  size="small" 
                  icon={<LineChartOutlined />} 
                  style={{ 
                    color: '#6366f1', 
                    borderColor: '#E2E8F0', 
                    borderRadius: 6,
                    height: 28,
                    width: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} 
                  onClick={e => { 
                    e.stopPropagation()
                    openComparisonWizard(group) 
                  }} 
                />
              </Tooltip>

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
                  removeGroup(group.group_key) 
                }} 
              />
            </div>
          </div>
        }
      >
        <div style={{ padding: '8px 4px' }}>
          {/* Attributes Grid */}
          <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6} md={3}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Thickness</Text>
              <Select 
                size="small" 
                placeholder="mm" 
                value={group.glass_thickness} 
                style={{ width: '100%', borderRadius: 6 }} 
                showSearch
                options={[
                  ...dropdownConfig.thicknesses.map(t => ({ value: t, label: `${t}mm` })), 
                  { value: '__custom__', label: '+ Add custom...' }
                ]}
                filterOption={(input, option) => { 
                  if (option.value === '__custom__') return true
                  return String(option.label).toLowerCase().includes(input.toLowerCase()) 
                }}
                onSearch={val => setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_thickness`]: val }))}
                onChange={val => {
                  if (val === '__custom__') {
                    const raw = customSearchVal[`${group.group_key}_thickness`]
                    const num = parseFloat(raw)
                    if (!raw || isNaN(num)) return
                    try {
                      const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                      const existing = cfg.thicknesses || [3.5, 4, 5, 6, 8, 10, 12]
                      if (!existing.includes(num)) {
                        localStorage.setItem('glass_dropdown_config', JSON.stringify({ 
                          ...cfg, 
                          thicknesses: [...existing, num].sort((a,b)=>a-b) 
                        }))
                        message.success(`${num}mm added!`)
                      }
                    } catch {}
                    updateGroup(group.group_key, 'glass_thickness', num)
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_thickness`]: '' }))
                    return
                  }
                  updateGroup(group.group_key, 'glass_thickness', val)
                }}
              />
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Type</Text>
              <Select 
                size="small" 
                placeholder="Type" 
                value={group.glass_type} 
                style={{ width: '100%', borderRadius: 6 }} 
                showSearch
                options={[
                  ...dropdownConfig.glass_types.map(t => ({ value: t, label: t })), 
                  { value: '__custom__', label: '+ Add custom...' }
                ]}
                filterOption={(input, option) => { 
                  if (option.value === '__custom__') return true
                  return String(option.label).toLowerCase().includes(input.toLowerCase()) 
                }}
                onSearch={val => setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_type`]: val }))}
                onChange={val => {
                  if (val === '__custom__') {
                    const raw = (customSearchVal[`${group.group_key}_type`] || '').trim()
                    if (!raw) return
                    try {
                      const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                      const existing = cfg.glass_types || ['Annealed', 'Toughened', 'Laminated', 'DGU']
                      if (!existing.includes(raw)) {
                        localStorage.setItem('glass_dropdown_config', JSON.stringify({ 
                          ...cfg, 
                          glass_types: [...existing, raw] 
                        }))
                        message.success(`"${raw}" added!`)
                      }
                    } catch {}
                    updateGroup(group.group_key, 'glass_type', raw)
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_type`]: '' }))
                    return
                  }
                  updateGroup(group.group_key, 'glass_type', val)
                }}
              />
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Category</Text>
              <Select 
                size="small" 
                placeholder="Category" 
                value={group.glass_category} 
                style={{ width: '100%', borderRadius: 6 }} 
                showSearch
                options={[
                  ...dropdownConfig.categories.map(c => ({ value: c, label: c })), 
                  { value: '__custom__', label: '+ Add custom...' }
                ]}
                filterOption={(input, option) => { 
                  if (option.value === '__custom__') return true
                  return String(option.label).toLowerCase().includes(input.toLowerCase()) 
                }}
                onSearch={val => setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_category`]: val }))}
                onChange={val => {
                  if (val === '__custom__') {
                    const raw = (customSearchVal[`${group.group_key}_category`] || '').trim()
                    if (!raw) return
                    try {
                      const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
                      const existing = cfg.categories || ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
                      if (!existing.includes(raw)) {
                        localStorage.setItem('glass_dropdown_config', JSON.stringify({ 
                          ...cfg, 
                          categories: [...existing, raw] 
                        }))
                        message.success(`"${raw}" added!`)
                      }
                    } catch {}
                    updateGroup(group.group_key, 'glass_category', raw)
                    setCustomSearchVal(prev => ({ ...prev, [`${group.group_key}_category`]: '' }))
                    return
                  }
                  updateGroup(group.group_key, 'glass_category', val)
                }}
              />
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Product Name</Text>
              <div style={{ 
                padding: '4px 12px', 
                background: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: 6, 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#16a34a', 
                minHeight: 28, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.description || <Text type="secondary" style={{ fontSize: 11 }}>Auto-generated</Text>}
                </div>
                {group.description && group.glass_thickness && group.glass_category && group.glass_type && (
                  <Tooltip title="Save to Product Masters">
                    <Button 
                      size="small" 
                      type="dashed" 
                      style={{ 
                        fontSize: 10, 
                        color: '#2563eb', 
                        borderColor: '#93c5fd', 
                        padding: '0 6px', 
                        height: 20, 
                        borderRadius: 4
                      }}
                      onClick={handleCreateProductMaster}
                    >
                      + Save
                    </Button>
                  </Tooltip>
                )}
              </div>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>W Ceiling</Text>
              <Select 
                size="small" 
                value={group.ceiling_w_inches ?? 6} 
                style={{ width: '100%', borderRadius: 6 }} 
                options={CEILING_OPTIONS} 
                onChange={val => updateGroup(group.group_key, 'ceiling_w_inches', val)} 
              />
              {group.ceiling_w_inches === 'custom' && (
                <InputNumber
                  size="small"
                  value={group.ceiling_w_custom_mm ?? 30}
                  min={1}
                  max={500}
                  addonAfter="mm"
                  style={{ width: '100%', marginTop: 6, borderRadius: 6 }}
                  onChange={val => updateGroup(group.group_key, 'ceiling_w_custom_mm', val || 30)}
                />
              )}
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>H Ceiling</Text>
              <Select 
                size="small" 
                value={group.ceiling_h_inches ?? 6} 
                style={{ width: '100%', borderRadius: 6 }} 
                options={CEILING_OPTIONS} 
                onChange={val => updateGroup(group.group_key, 'ceiling_h_inches', val)} 
              />
              {group.ceiling_h_inches === 'custom' && (
                <InputNumber
                  size="small"
                  value={group.ceiling_h_custom_mm ?? 30}
                  min={1}
                  max={500}
                  addonAfter="mm"
                  style={{ width: '100%', marginTop: 6, borderRadius: 6 }}
                  onChange={val => updateGroup(group.group_key, 'ceiling_h_custom_mm', val || 30)}
                />
              )}
            </Col>
          </Row>

          {/* Rate & CEP Row */}
          <Row gutter={[16, 12]} align="middle" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed #E2E8F0' }}>
            <Col xs={24} sm={8} md={4}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Rate/Sqft</Text>
                <Tooltip title={group.custom_costing ? 'Custom Rate' : 'Auto from Matrix'}>
                  <Switch 
                    size="small" 
                    checked={group.custom_costing} 
                    checkedChildren="Custom" 
                    unCheckedChildren="Auto ✓" 
                    onChange={val => updateGroup(group.group_key, 'custom_costing', val)} 
                    style={{ transform: 'scale(0.8)', originX: 'right' }} 
                  />
                </Tooltip>
              </div>
              <InputNumber 
                size="small" 
                value={group.rate} 
                min={0} 
                prefix="₹" 
                disabled={!group.custom_costing} 
                style={{ 
                  width: '100%', 
                  borderColor: group.custom_costing ? '#f59e0b' : undefined,
                  borderRadius: 6 
                }} 
                onChange={val => updateGroup(group.group_key, 'rate', val)} 
              />
              {(group.is_toughened || group.glass_type === 'Toughened') && group.base_glass_rate > 0 && (
                <Text style={{ fontSize: 9, color: '#f97316', display: 'block', marginTop: 2, fontWeight: 500 }}>
                  Base ₹{group.base_glass_rate.toFixed(2)} + Tgh addon
                </Text>
              )}
            </Col>

            <Col xs={24} sm={16} md={6}>
              <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>CEP (Polish)</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch 
                  size="small" 
                  checked={group.cep} 
                  onChange={val => updateGroup(group.group_key, 'cep', val)} 
                />
                {group.cep && (
                  <Select 
                    size="small" 
                    value={group.cep_polish_rate || 15} 
                    style={{ width: 132 }} 
                    options={[
                      { value: 7,  label: '₹7/rft' }, 
                      { value: 10, label: '₹10/rft' }, 
                      { value: 15, label: '₹15/rft' }, 
                      { value: 'custom', label: 'Custom ₹/rft' },
                      { value: 'custom_mm', label: 'Custom ₹/mm' },
                    ]} 
                    onChange={val => updateGroup(group.group_key, 'cep_polish_rate', val)} 
                  />
                )}
                {group.cep && (group.cep_polish_rate === 'custom' || group.cep_polish_rate === 'custom_mm') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <InputNumber 
                      size="small" 
                      value={group.cep_polish_rate_custom ?? null} 
                      placeholder="0"
                      min={0} 
                      prefix="₹" 
                      addonAfter={group.cep_polish_rate === 'custom_mm' ? '/mm' : '/rft'}
                      style={{ width: 120, borderRadius: 6 }} 
                      onChange={val => updateGroup(group.group_key, 'cep_polish_rate_custom', val)} 
                    />
                    <Text style={{ fontSize: 9, color: '#94a3b8', lineHeight: '11px' }}>
                      {group.cep_polish_rate === 'custom_mm' ? 'per mm perimeter' : 'per running foot'}
                    </Text>
                  </div>
                )}
              </div>
            </Col>
          </Row>

          {/* ── Artwork Section ── */}
          {(() => {
            const artworkMaster = (() => {
              try { return JSON.parse(localStorage.getItem('artwork_master') || '[]') } catch { return [] }
            })()
            return (
              <div style={{ marginBottom: 16, background: '#fafbff', border: '1px dashed #c7d2fe', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <PictureOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                  <Text style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Artwork / Design
                  </Text>

                  {/* Select from master */}
                  <Select
                    size="small"
                    placeholder="Select from Artwork Master"
                    allowClear
                    showSearch
                    style={{ width: 220 }}
                    value={group.artwork_master_id || undefined}
                    options={artworkMaster.map(a => ({ value: a.id, label: a.name }))}
                    filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                    onChange={val => {
                      const artwork = artworkMaster.find(a => a.id === val)
                      updateGroup(group.group_key, 'artwork_master_id', val || null)
                      updateGroup(group.group_key, 'artwork_name', artwork?.name || null)
                      updateGroup(group.group_key, 'artwork_file_data', artwork?.file_data || null)
                    }}
                  />

                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>or</Text>

                  {/* Upload directly */}
                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => {
                          updateGroup(group.group_key, 'artwork_master_id', null)
                          updateGroup(group.group_key, 'artwork_name', file.name)
                          updateGroup(group.group_key, 'artwork_file_data', ev.target.result)
                        }
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }}
                    />
                    <Button size="small" icon={<PlusOutlined />} style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                      Upload Image
                    </Button>
                  </label>

                  {/* Show attached artwork name + clear button */}
                  {group.artwork_file_data && (
                    <Tag
                      color="purple"
                      closable
                      onClose={() => {
                        updateGroup(group.group_key, 'artwork_master_id', null)
                        updateGroup(group.group_key, 'artwork_name', null)
                        updateGroup(group.group_key, 'artwork_file_data', null)
                      }}
                      style={{ fontSize: 11 }}
                    >
                      🖼 {group.artwork_name || 'Artwork attached'}
                    </Tag>
                  )}
                </div>

                {/* Thumbnail preview */}
                {group.artwork_file_data && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={group.artwork_file_data}
                      alt="artwork preview"
                      style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', borderRadius: 4, border: '1px solid #e2e8f0' }}
                    />
                  </div>
                )}
              </div>
            )
          })()}

          {/* Sizes Table */}
          <div style={{ marginBottom: 16 }}>
            <SizeTable
              group={group}
              unit={unit}
              processMasters={processMasters}
              updateSize={updateSize}
              updateSizeProcess={updateSizeProcess}
              removeSizeProcess={removeSizeProcess}
              addSizeProcess={addSizeProcess}
              addSize={addSize}
              removeSize={removeSize}
              setGroups={setGroups}
              products={products}
            />
          </div>

          {/* Group Processes Panel */}
          <div style={{ 
            marginTop: 12, 
            padding: '14px 18px', 
            background: '#FAF8FF', 
            borderRadius: 12, 
            border: '1px dashed #C084FC' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (group.processes || []).length > 0 ? 10 : 0 }}>
              <Text strong style={{ fontSize: 13, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <SettingOutlined /> Group Process Charges (Hole, Cutout, etc.)
              </Text>
              {(group.processes || []).length > 0 && (
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                  Total: <Text style={{ color: '#7c3aed' }}>₹{(group.processes || []).reduce((s, p) => s + (p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </Text>
              )}
            </div>
            {(group.processes || []).map((proc, pi) => (
              <Row key={proc.proc_key} gutter={8} align="middle" style={{ marginBottom: 6 }}>
                <Col span={6}>
                  <Select 
                    size="small" 
                    placeholder="Select process" 
                    value={proc.process_id} 
                    style={{ width: '100%', borderRadius: 6 }}
                    options={processMasters.filter(p => ['hole','cutout','farma','beveling'].includes(p.process_type)).map(p => ({ value: p.id, label: p.name }))}
                    onChange={val => updateGroupProcess(group.group_key, proc.proc_key, 'process_id', val)} 
                  />
                </Col>
                <Col span={3}>
                  <InputNumber 
                    size="small" 
                    value={proc.qty_area} 
                    min={0} 
                    style={{ width: '100%', borderRadius: 6 }} 
                    placeholder="Qty/Area" 
                    onChange={val => updateGroupProcess(group.group_key, proc.proc_key, 'qty_area', val)} 
                  />
                </Col>
                <Col span={2}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    {proc.charge_type === 'per_sqft' ? 'sqft' : proc.charge_type === 'per_rft' ? 'rft' : proc.charge_type === 'per_sqmt' ? 'sqmt' : proc.charge_type === 'per_piece' ? 'pcs' : 'fixed'}
                  </Text>
                </Col>
                <Col span={4}>
                  <InputNumber 
                    size="small" 
                    value={proc.rate} 
                    min={0} 
                    prefix="₹" 
                    style={{ width: '100%', borderRadius: 6 }} 
                    onChange={val => updateGroupProcess(group.group_key, proc.proc_key, 'rate', val)} 
                  />
                </Col>
                <Col span={4}>
                  <InputNumber 
                    size="small" 
                    value={proc.cost_rate ?? parseFloat(((proc.rate || 0) * 0.70).toFixed(2))} 
                    min={0} 
                    prefix="₹" 
                    placeholder="Cost" 
                    style={{ width: '100%', borderRadius: 6, borderColor: '#f59e0b' }} 
                    onChange={val => updateGroupProcess(group.group_key, proc.proc_key, 'cost_rate', val)} 
                  />
                </Col>
                <Col span={3}>
                  <Text strong style={{ color: '#7c3aed', fontSize: 13 }}>
                    ₹{(proc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Col>
                <Col span={2} style={{ textAlign: 'right' }}>
                  <Button 
                    size="small" 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => removeGroupProcess(group.group_key, proc.proc_key)} 
                  />
                </Col>
              </Row>
            ))}
            <Button 
              type="dashed" 
              size="small" 
              icon={<PlusOutlined />} 
              onClick={() => addGroupProcess(group.group_key)} 
              style={{ marginTop: 4, fontSize: 12, borderRadius: 6, borderColor: '#7c3aed', color: '#7c3aed' }}
            >
              Add Process
            </Button>
          </div>
        </div>
      </Collapse.Panel>
    </Collapse>
  )
}

export default GlassCard
