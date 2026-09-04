import React, { useState, useEffect } from 'react'
import { Modal, Upload, Spin, Radio, Card, Input, InputNumber, Select, Table, Button, Alert, Tooltip, Space, Typography, Flex, Row, Col } from 'antd'
import { InboxOutlined, WarningOutlined, PlusOutlined, DeleteOutlined, FileImageOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { aiApi, customerApi, quotationApi } from '../api'
import { settingsApi } from '../api/settingsApi'

const { Text } = Typography
const { Dragger } = Upload

const MM_TO_INCH = 25.4
const toInch = (v, unit) => unit === 'mm' ? (Number(v) || 0) / MM_TO_INCH : (Number(v) || 0)

const DEFAULT_DROPDOWN_CONFIG = {
  thicknesses: [3.5, 4, 5, 6, 8, 10, 12],
  glass_types: ['Annealed', 'Toughened', 'Laminated', 'DGU'],
  categories: ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror'],
}

const getDropdownConfig = () => {
  try {
    const cfg = JSON.parse(localStorage.getItem('glass_dropdown_config') || '{}')
    return {
      thicknesses: cfg.thicknesses?.length ? cfg.thicknesses : DEFAULT_DROPDOWN_CONFIG.thicknesses,
      glass_types: cfg.glass_types?.length ? cfg.glass_types : DEFAULT_DROPDOWN_CONFIG.glass_types,
      categories: cfg.categories?.length ? cfg.categories : DEFAULT_DROPDOWN_CONFIG.categories,
    }
  } catch {
    return DEFAULT_DROPDOWN_CONFIG
  }
}

const buildDescription = (g) => {
  const parts = []
  if (g.glass_category) parts.push(g.glass_category)
  if (g.glass_type) parts.push(g.glass_type)
  if (g.glass_thickness) parts.push(`${g.glass_thickness}mm`)
  return parts.join(' ') || ''
}

const CuttingListImportModal = ({ open, onClose }) => {
  const navigate = useNavigate()

  // Top-level hooks
  const [stage, setStage] = useState('upload') // 'upload' | 'review' | 'creating'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [sheetDate, setSheetDate] = useState(null)
  const [unit, setUnit] = useState('mm')
  const [groups, setGroups] = useState([])
  const [warnings, setWarnings] = useState([])
  const [customerId, setCustomerId] = useState(null)

  const [customers, setCustomers] = useState([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(false)
  const [dropdownConfig, setDropdownConfig] = useState(getDropdownConfig)

  useEffect(() => {
    settingsApi.get(settingsApi.KEYS.GLASS_DROPDOWN_CONFIG)
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          localStorage.setItem('glass_dropdown_config', JSON.stringify(data))
          setDropdownConfig({
            thicknesses: data.thicknesses?.length ? data.thicknesses : DEFAULT_DROPDOWN_CONFIG.thicknesses,
            glass_types: data.glass_types?.length ? data.glass_types : DEFAULT_DROPDOWN_CONFIG.glass_types,
            categories: data.categories?.length ? data.categories : DEFAULT_DROPDOWN_CONFIG.categories,
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      setStage('upload')
      setLoading(false)
      setErrorMsg(null)
      setSheetDate(null)
      setUnit('mm')
      setGroups([])
      setWarnings([])
      setCustomerId(null)

      setLoadingDropdowns(true)
      customerApi.dropdown()
        .then(custRes => {
          const custItems = Array.isArray(custRes.data) ? custRes.data : (custRes.data?.items || [])
          setCustomers(custItems)
        })
        .catch(err => {
          console.error("Failed to load customer dropdown:", err)
        })
        .finally(() => {
          setLoadingDropdowns(false)
        })
    }
  }, [open])

  const handleFileUpload = async (file) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await aiApi.extractCuttingList(file)
      const data = res.data || res
      setSheetDate(data.sheet_date || null)
      const detectedUnit = (data.unit || 'mm').toLowerCase() === 'inch' ? 'inch' : 'mm'
      setUnit(detectedUnit)
      setWarnings(data.warnings || [])

      const parsedGroups = (data.groups || []).map((g, gi) => {
        const groupObj = {
          id: Date.now() + gi,
          label: g.label || `Group ${gi + 1}`,
          stated_total: g.stated_total !== undefined && g.stated_total !== null ? g.stated_total : null,
          glass_thickness: null,
          glass_type: null,
          glass_category: null,
          description: '',
          rows: (g.rows || []).map((r, ri) => ({
            row_key: Date.now() + gi * 1000 + ri,
            width: r.width ?? null,
            height: r.height ?? null,
            qty: r.qty ?? 1,
            confidence: r.confidence || 'high',
            note: r.note || null,
          })),
        }
        return groupObj
      })

      setGroups(parsedGroups)
      setStage('review')
    } catch (err) {
      console.error("AI extraction error:", err)
      const msg = err.response?.data?.detail || err.message || "Failed to read cutting list. Please try again."
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGroupLabelChange = (gIndex, val) => {
    setGroups(prev => prev.map((g, idx) => idx === gIndex ? { ...g, label: val } : g))
  }

  const handleGroupAttributeChange = (gIndex, field, val) => {
    setGroups(prev => prev.map((g, idx) => {
      if (idx !== gIndex) return g
      const updated = { ...g, [field]: val }
      updated.description = buildDescription(updated)
      return updated
    }))
  }

  const handleRowChange = (gIndex, rIndex, field, val) => {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== gIndex) return g
      const updatedRows = g.rows.map((r, ri) => ri === rIndex ? { ...r, [field]: val } : r)
      return { ...g, rows: updatedRows }
    }))
  }

  const handleAddRow = (gIndex) => {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== gIndex) return g
      const newRow = {
        row_key: Date.now() + Math.random(),
        width: null,
        height: null,
        qty: 1,
        confidence: 'high',
        note: null,
      }
      return { ...g, rows: [...g.rows, newRow] }
    }))
  }

  const handleDeleteRow = (gIndex, rIndex) => {
    setGroups(prev => prev.map((g, gi) => {
      if (gi !== gIndex) return g
      return { ...g, rows: g.rows.filter((_, ri) => ri !== rIndex) }
    }))
  }

  const handleCreateDraft = async () => {
    setStage('creating')
    setErrorMsg(null)
    try {
      const payloadGroups = groups.map((g, gi) => ({
        group_key: Date.now() + gi,
        description: g.description,
        glass_thickness: Number(g.glass_thickness),
        glass_type: g.glass_type,
        glass_category: g.glass_category,
        sizes: g.rows.map((r, ri) => ({
          size_key: Date.now() + gi * 1000 + ri,
          width_inch: parseFloat(toInch(r.width, unit).toFixed(4)),
          height_inch: parseFloat(toInch(r.height, unit).toFixed(4)),
          quantity: parseInt(r.qty) || 0,
        })),
      }))

      const payload = {
        customer_id: customerId,
        quote_date: dayjs().format('YYYY-MM-DD'),
        status: 'draft',
        unit_mode: unit === 'mm' ? 'mm' : 'inch',
        groups: payloadGroups,
        lines: [],
        is_active: true,
      }

      const res = await quotationApi.create(payload)
      onClose()
      navigate(`/quotations/${res.data.id}/edit`)
    } catch (err) {
      console.error("Failed to create quotation:", err)
      const msg = err.response?.data?.detail || err.message || "Failed to create draft quotation."
      setErrorMsg(msg)
      setStage('review')
    }
  }

  const canCreate = customerId && groups.length > 0 && groups.every(g => g.glass_thickness && g.glass_type && g.glass_category)

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: `${c.name} ${c.customer_code ? `(${c.customer_code})` : ''}`,
  }))

  return (
    <Modal
      title={
        <Space>
          <FileImageOutlined style={{ color: '#1677ff' }} />
          <span>Import Cutting List from Photo</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={stage === 'upload' ? 600 : 900}
      footer={
        stage === 'review' ? [
          <Button key="cancel" onClick={onClose}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!canCreate || stage === 'creating'}
            loading={stage === 'creating'}
            onClick={handleCreateDraft}
          >
            Create Draft Quotation
          </Button>,
        ] : null
      }
      destroyOnClose
    >
      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setErrorMsg(null)}
        />
      )}

      {stage === 'upload' && (
        <div style={{ padding: '20px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
                Reading the sheet… this takes 20–40 seconds.
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Extracting measurements, group totals, and handwriting confidence levels.
              </Text>
            </div>
          ) : (
            <Dragger
              name="file"
              multiple={false}
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                handleFileUpload(file)
                return false
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#1677ff', fontSize: 48 }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
                Click or drag photo of cutting list to this area
              </p>
              <p className="ant-upload-hint">
                Supports handwritten cutting list photos (JPEG, PNG, WebP). Ensure the image is clear and well-lit.
              </p>
            </Dragger>
          )}
        </div>
      )}

      {stage === 'review' && (
        <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
            <Card size="small" style={{ background: '#f8fafc' }}>
              <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                <div>
                  <Text strong>Detected Unit: </Text>
                  <Radio.Group
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="mm">Millimetres (mm)</Radio.Button>
                    <Radio.Button value="inch">Inches (in)</Radio.Button>
                  </Radio.Group>
                </div>
                {sheetDate && (
                  <div>
                    <Text type="secondary">Sheet Date: </Text>
                    <Text strong>{sheetDate}</Text>
                  </div>
                )}
              </Flex>
            </Card>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Customer <Text type="danger">*</Text>
              </Text>
              <Select
                placeholder="Select Customer for Quotation"
                showSearch
                style={{ width: '100%' }}
                loading={loadingDropdowns}
                value={customerId}
                onChange={setCustomerId}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={customerOptions}
              />
              {!customerId && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>
                  If the customer does not exist, please create them in Customer Masters first.
                </Text>
              )}
            </div>

            {warnings && warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="Transcription Alerts"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                }
              />
            )}

            {groups.map((group, gIdx) => {
              const liveSum = group.rows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0)
              const statedInt = group.stated_total !== null && group.stated_total !== undefined
                ? parseInt(group.stated_total)
                : null
              const isChecksumOk = statedInt === null || isNaN(statedInt) || statedInt === liveSum

              const columns = [
                {
                  title: `Width (${unit})`,
                  dataIndex: 'width',
                  key: 'width',
                  render: (val, record, rIdx) => (
                    <InputNumber
                      value={val}
                      onChange={(v) => handleRowChange(gIdx, rIdx, 'width', v)}
                      style={{ width: '100%' }}
                      min={0}
                      precision={unit === 'mm' ? 0 : 2}
                    />
                  ),
                },
                {
                  title: `Height (${unit})`,
                  dataIndex: 'height',
                  key: 'height',
                  render: (val, record, rIdx) => (
                    <InputNumber
                      value={val}
                      onChange={(v) => handleRowChange(gIdx, rIdx, 'height', v)}
                      style={{ width: '100%' }}
                      min={0}
                      precision={unit === 'mm' ? 0 : 2}
                    />
                  ),
                },
                {
                  title: 'Qty',
                  dataIndex: 'qty',
                  key: 'qty',
                  width: 100,
                  render: (val, record, rIdx) => (
                    <InputNumber
                      value={val}
                      onChange={(v) => handleRowChange(gIdx, rIdx, 'qty', v)}
                      style={{ width: '100%' }}
                      min={1}
                      precision={0}
                    />
                  ),
                },
                {
                  title: 'Status',
                  key: 'status',
                  width: 70,
                  align: 'center',
                  render: (_, record) => (
                    record.confidence === 'low' ? (
                      <Tooltip title={record.note || 'Low confidence handwriting transcription'}>
                        <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
                      </Tooltip>
                    ) : null
                  ),
                },
                {
                  title: '',
                  key: 'action',
                  width: 50,
                  align: 'center',
                  render: (_, record, rIdx) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteRow(gIdx, rIdx)}
                    />
                  ),
                },
              ]

              const isAttributesComplete = Boolean(group.glass_thickness && group.glass_type && group.glass_category)

              return (
                <Card
                  key={group.id || gIdx}
                  size="small"
                  title={
                    <Input
                      value={group.label}
                      onChange={(e) => handleGroupLabelChange(gIdx, e.target.value)}
                      placeholder="Group Label"
                      variant="filled"
                      style={{ fontWeight: 600, fontSize: 14 }}
                    />
                  }
                  style={{ borderColor: !isAttributesComplete ? '#ff4d4f' : undefined }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <div>
                      <Row gutter={[8, 8]} align="middle">
                        <Col span={8}>
                          <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                            Thickness <Text type="danger">*</Text>
                          </Text>
                          <Select
                            placeholder="Select mm"
                            style={{ width: '100%' }}
                            size="small"
                            value={group.glass_thickness}
                            onChange={(v) => handleGroupAttributeChange(gIdx, 'glass_thickness', v)}
                            options={dropdownConfig.thicknesses.map(t => ({ value: t, label: `${t}mm` }))}
                            status={!group.glass_thickness ? 'error' : undefined}
                          />
                        </Col>
                        <Col span={8}>
                          <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                            Type <Text type="danger">*</Text>
                          </Text>
                          <Select
                            placeholder="Select Type"
                            style={{ width: '100%' }}
                            size="small"
                            value={group.glass_type}
                            onChange={(v) => handleGroupAttributeChange(gIdx, 'glass_type', v)}
                            options={dropdownConfig.glass_types.map(t => ({ value: t, label: t }))}
                            status={!group.glass_type ? 'error' : undefined}
                          />
                        </Col>
                        <Col span={8}>
                          <Text style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                            Category <Text type="danger">*</Text>
                          </Text>
                          <Select
                            placeholder="Select Category"
                            style={{ width: '100%' }}
                            size="small"
                            value={group.glass_category}
                            onChange={(v) => handleGroupAttributeChange(gIdx, 'glass_category', v)}
                            options={dropdownConfig.categories.map(c => ({ value: c, label: c }))}
                            status={!group.glass_category ? 'error' : undefined}
                          />
                        </Col>
                      </Row>

                      <div style={{ marginTop: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4, border: '1px dashed #e2e8f0' }}>
                        <Text type="secondary" style={{ fontSize: 11, marginRight: 6 }}>Auto Description:</Text>
                        <Text strong style={{ fontSize: 12, color: group.description ? '#1e293b' : '#94a3b8' }}>
                          {group.description || '(Select Thickness, Type, and Category)'}
                        </Text>
                      </div>
                    </div>

                    <Table
                      dataSource={group.rows}
                      columns={columns}
                      rowKey="row_key"
                      pagination={false}
                      size="small"
                      rowClassName={(record) => record.confidence === 'low' ? 'low-confidence-row' : ''}
                      onRow={(record) => ({
                        style: record.confidence === 'low' ? { backgroundColor: '#fffbeb' } : {},
                      })}
                    />

                    <Flex justify="space-between" align="center" style={{ marginTop: 4 }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddRow(gIdx)}
                      >
                        Add row
                      </Button>

                      <div>
                        {!isChecksumOk ? (
                          <Alert
                            type="error"
                            showIcon
                            size="small"
                            message={`Sheet total: ${group.stated_total} · Rows total: ${liveSum}`}
                            style={{ padding: '2px 8px' }}
                          />
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Rows total: <Text strong>{liveSum}</Text>
                            {statedInt !== null ? ` (matches sheet total ${group.stated_total})` : ''}
                          </Text>
                        )}
                      </div>
                    </Flex>
                  </Space>
                </Card>
              )
            })}
          </Space>
        </div>
      )}

      {stage === 'creating' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 16, fontWeight: 500 }}>
            Creating Draft Quotation…
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CuttingListImportModal
