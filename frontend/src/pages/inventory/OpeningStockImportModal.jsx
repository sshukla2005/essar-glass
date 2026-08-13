import React, { useState, useMemo } from 'react'
import { 
  Modal, Upload, Table, Tag, Button, Select, Space, 
  Typography, Alert, DatePicker, App, Badge, Tooltip, Input, Card
} from 'antd'
import { 
  UploadOutlined, FileExcelOutlined, CheckCircleOutlined, 
  WarningOutlined, CloseCircleOutlined, DownloadOutlined,
  QuestionCircleOutlined, ExclamationCircleOutlined, BankOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import api from '../../api/axios'
import { parseTallySheet, parseProductName, normalizeWhitespace } from '../../utils/tallyParser'

const { Text, Title } = Typography

// Helper to normalize strings for comparison
const normStr = (str) => (str || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')

const OpeningStockImportModal = ({ open, onCancel, products = [], movements = [], warehouses = [], onSuccess }) => {
  const { message } = App.useApp()

  const [fileList, setFileList] = useState([])
  const [filename, setFilename] = useState('')
  const [godownName, setGodownName] = useState('YZA Location')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [importDate, setImportDate] = useState(() => dayjs())
  const [loading, setLoading] = useState(false)
  const [importResults, setImportResults] = useState(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [tallyHeaderSummary, setTallyHeaderSummary] = useState(null)

  // Map of products with existing opening movements (OPENING-IMPORT or OPENING-BAL)
  const productsWithOpening = useMemo(() => {
    const set = new Set()
    movements.forEach(m => {
      const ref = (m.reference || '').toUpperCase()
      if (ref.startsWith('OPENING-IMPORT') || ref.startsWith('OPENING-BAL') || ref.startsWith('OPENING-TALLY')) {
        if (m.product_id) set.add(m.product_id)
      }
    })
    return set
  }, [movements])

  // Reset state when modal opens/closes
  const handleModalClose = () => {
    setFileList([])
    setFilename('')
    setGodownName('YZA Location')
    setSelectedWarehouseId(null)
    setParsedRows([])
    setImportResults(null)
    setTallyHeaderSummary(null)
    onCancel()
  }

  // Handle File Upload and Parsing
  const handleFileUpload = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        // Get first sheet
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        setFilename(file.name)

        // Read raw 2D array of rows
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (!rawRows || rawRows.length === 0) {
          message.error('Uploaded spreadsheet appears to be empty.')
          return
        }

        // Check if file matches Tally Godown Summary export format
        let isTallyFormat = false
        for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
          const rowStr = (rawRows[r] || []).join(' ').toLowerCase()
          if (rowStr.includes('godown summary') || rowStr.includes('godown :') || rowStr.includes('(alt. units)')) {
            isTallyFormat = true
            break
          }
        }

        if (isTallyFormat) {
          const tallyParsed = parseTallySheet(rawRows)
          setGodownName(tallyParsed.godown_name)
          setTallyHeaderSummary(tallyParsed.summary)

          // Classify Tally items
          const classified = tallyParsed.items.map(item => {
            const spec = item.spec
            const pName = item.clean_name

            // Matching Rules
            let matches = []
            // 1. Exact name match
            matches = products.filter(p => normStr(p.name) === normStr(pName))

            // 2. Spec match (brand + glass_type + thickness)
            if (matches.length === 0 && spec.parsed) {
              matches = products.filter(p => {
                const bMatch = !spec.brand || normStr(p.brand) === normStr(spec.brand)
                const tMatch = p.thickness_mm === spec.thickness_mm
                const nMatch = normStr(p.name).includes(normStr(spec.glass_type))
                return bMatch && tMatch && nMatch
              })
            }

            if (matches.length > 1) {
              return {
                ...item,
                product_name: pName,
                status: 'ambiguous',
                reason: `Matches ${matches.length} products. Select target product below.`,
                action: 'select',
                matches,
                selected_product_id: matches[0].id
              }
            }

            if (matches.length === 1) {
              const matchedProd = matches[0]
              const hasOpening = productsWithOpening.has(matchedProd.id)

              if (hasOpening) {
                return {
                  ...item,
                  product_name: pName,
                  status: 'already_set',
                  reason: 'Opening stock movement already exists for product',
                  action: 'skip',
                  matched_product: matchedProd,
                  selected_product_id: matchedProd.id
                }
              }

              return {
                ...item,
                product_name: pName,
                status: 'matched',
                reason: `Matched: ${matchedProd.name} (${matchedProd.internal_ref})`,
                action: 'import',
                matched_product: matchedProd,
                selected_product_id: matchedProd.id
              }
            }

            // Unmatched row
            return {
              ...item,
              product_name: pName,
              status: 'unmatched',
              reason: 'No matching product found in active company',
              action: 'create_new',
              selected_product_id: null
            }
          })

          setParsedRows(classified)
          message.success(`Parsed ${classified.length} products from Tally Godown Summary export!`)

        } else {
          // Fallback to standard generic JSON parser
          const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          const classified = rawJson.map((row, idx) => {
            const rowNum = idx + 2
            const pCode = String(row['Product Code'] || row['Code'] || row['internal_ref'] || '').trim()
            const pName = String(row['Product Name'] || row['Name'] || row['name'] || '').trim()
            const spec = parseProductName(pName)
            const rawQty = row['Quantity'] !== undefined && row['Quantity'] !== '' ? row['Quantity'] : row['Qty']
            const qty = parseFloat(rawQty) || 0
            const rate = parseFloat(row['Rate'] || row['Cost'] || 0) || null

            let matches = []
            if (pCode) matches = products.filter(p => normStr(p.internal_ref) === normStr(pCode))
            if (matches.length === 0 && pName) matches = products.filter(p => normStr(p.name) === normStr(pName))

            const matchedProd = matches.length === 1 ? matches[0] : null
            const isAlreadySet = matchedProd ? productsWithOpening.has(matchedProd.id) : false

            let status = 'unmatched'
            let action = 'create_new'
            if (matches.length > 1) { status = 'ambiguous'; action = 'select' }
            else if (matchedProd) {
              if (isAlreadySet) { status = 'already_set'; action = 'skip' }
              else { status = 'matched'; action = 'import' }
            }

            return {
              row_number: rowNum,
              raw_name: pName,
              clean_name: spec.cleanName || pName,
              spec,
              quantity_sqm: qty,
              quantity_sheets: null,
              unit_rate: rate,
              total_value: rate ? qty * rate : null,
              is_missing_value: rate === null,
              is_fractional: false,
              product_name: pName,
              product_code: pCode,
              status,
              reason: matchedProd ? `Matched ${matchedProd.name}` : 'Unmatched',
              action,
              matched_product: matchedProd,
              selected_product_id: matchedProd?.id || null,
              matches
            }
          })

          setParsedRows(classified)
          message.success(`Parsed ${classified.length} rows from template`)
        }

      } catch (err) {
        console.error('Parsing error:', err)
        message.error('Failed to parse file. Please verify file format.')
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  // Summary classification counts
  const summary = useMemo(() => {
    let matched = 0, ambiguous = 0, unmatched = 0, alreadySet = 0, invalid = 0
    let missingValueCount = 0, fractionalCount = 0
    let totalSqm = 0, totalVal = 0

    parsedRows.forEach(r => {
      if (r.status === 'matched') matched++
      else if (r.status === 'ambiguous') ambiguous++
      else if (r.status === 'unmatched') unmatched++
      else if (r.status === 'already_set') alreadySet++
      else if (r.status === 'invalid') invalid++

      if (r.is_missing_value) missingValueCount++
      if (r.is_fractional) fractionalCount++

      if (r.quantity_sqm) totalSqm += r.quantity_sqm
      if (r.total_value) totalVal += r.total_value
    })

    return {
      total: parsedRows.length,
      matched, ambiguous, unmatched, alreadySet, invalid,
      missingValueCount, fractionalCount,
      totalSqm: Math.round(totalSqm * 10000) / 10000,
      totalVal: Math.round(totalVal * 100) / 100
    }
  }, [parsedRows])

  // Change action handler per row
  const updateRowAction = (rowNum, field, value) => {
    setParsedRows(prev => prev.map(r => {
      if (r.row_number !== rowNum) return r
      return { ...r, [field]: value }
    }))
  }

  // Execute Import Call
  const handleExecuteImport = async () => {
    const importableItems = parsedRows.filter(r => r.action !== 'skip' && r.status !== 'invalid').map(r => ({
      row_number: r.row_number,
      product_id: (r.action === 'import' || r.action === 'select') ? r.selected_product_id : null,
      create_new: r.action === 'create_new',
      skip: false,
      product_code: r.product_code || (r.spec?.parsed ? `PROD-${r.spec.thickness_mm}MM-${r.spec.brand || 'GEN'}` : null),
      product_name: r.clean_name || r.product_name,
      brand: r.spec?.brand || null,
      glass_type: r.spec?.glass_type || null,
      thickness_mm: r.spec?.thickness_mm || null,
      sheet_width_mm: r.spec?.sheet_width_mm || null,
      sheet_height_mm: r.spec?.sheet_height_mm || null,
      stock_uom: 'sheet',
      quantity: r.quantity_sqm || 0,
      quantity_sqm: r.quantity_sqm || 0,
      quantity_sheets: r.quantity_sheets,
      unit_rate: r.unit_rate,
      total_value: r.total_value,
      rate: r.unit_rate || 0
    }))

    if (importableItems.length === 0) {
      message.warning('No items selected for import.')
      return
    }

    try {
      setLoading(true)
      const payload = {
        import_date: importDate.format('YYYY-MM-DD'),
        filename: filename || 'StkGrpSum.xlsx',
        warehouse_id: selectedWarehouseId,
        warehouse_name: godownName,
        expected_total_sqm: tallyHeaderSummary?.expected_total_sqm || summary.totalSqm,
        expected_total_value: tallyHeaderSummary?.expected_total_value || summary.totalVal,
        items: importableItems
      }

      const res = await api.post('/api/v1/inventory/import-opening-stock', payload)
      const data = res.data

      message.success(`Successfully imported Tally stock for ${data.summary.imported} product(s)!`)
      setImportResults(data)
      setResultModalOpen(true)
      onSuccess?.()
      handleModalClose()
    } catch (err) {
      console.error('Import error:', err)
      message.error(err?.response?.data?.detail || 'Import failed. All changes rolled back.')
    } finally {
      setLoading(false)
    }
  }

  // Download Reconciliation Excel Report
  const handleDownloadResultReport = () => {
    if (!importResults) return
    const wb = XLSX.utils.book_new()

    // 1. Reconciliation Summary Sheet
    const summaryData = [
      { Metric: 'File Name', Value: importResults.filename },
      { Metric: 'Import Reference', Value: importResults.reference },
      { Metric: 'Godown / Warehouse', Value: importResults.warehouse?.name || godownName },
      { Metric: 'Total Products Processed', Value: importResults.summary.total_rows },
      { Metric: 'Products Imported', Value: importResults.summary.imported },
      { Metric: 'New Products Created', Value: importResults.summary.created },
      { Metric: 'Tally Total SQM', Value: importResults.summary.expected_sqm },
      { Metric: 'Essar Glass Total SQM', Value: importResults.summary.imported_sqm },
      { Metric: 'SQM Variance', Value: importResults.summary.variance_sqm },
      { Metric: 'Tally Total Valuation (₹)', Value: importResults.summary.expected_value },
      { Metric: 'Essar Glass Valuation (₹)', Value: importResults.summary.imported_value },
      { Metric: 'Valuation Variance (₹)', Value: importResults.summary.variance_value }
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Reconciliation Summary')

    // 2. Line Items Sheet
    const reportRows = parsedRows.map(r => {
      const resItem = (importResults.results || []).find(it => it.row_number === r.row_number)
      let outcome = r.action === 'skip' ? 'Skipped' : (resItem?.status || 'Imported')
      if (r.status === 'invalid') outcome = 'Failed / Invalid'

      return {
        'Row #': r.row_number,
        'File Product Name': r.raw_name,
        'Brand': r.spec?.brand || '—',
        'Type Description': r.spec?.glass_type || '—',
        'Thickness (mm)': r.spec?.thickness_mm || '—',
        'Width (mm)': r.spec?.sheet_width_mm || '—',
        'Height (mm)': r.spec?.sheet_height_mm || '—',
        'Quantity (sqm)': r.quantity_sqm || 0,
        'Quantity (sheets)': r.quantity_sheets !== null ? r.quantity_sheets : '—',
        'Rate (₹/sqm)': r.unit_rate !== null ? r.unit_rate : 'Missing (null)',
        'Value (₹)': r.total_value !== null ? r.total_value : 'Missing (null)',
        'Classification': r.status.toUpperCase(),
        'Action Taken': r.action,
        'Outcome': outcome.toUpperCase(),
        'Details': resItem?.reason || r.reason
      }
    })

    const wsDetails = XLSX.utils.json_to_sheet(reportRows)
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Line Item Details')

    XLSX.writeFile(wb, `Tally_Godown_Import_Reconciliation_${dayjs().format('YYYY-MM-DD_HHmm')}.xlsx`)
  }

  const columns = [
    { title: 'Row #', dataIndex: 'row_number', width: 60, align: 'center' },
    {
      title: 'Tally Product Particulars & Parsed Specs', key: 'details', width: 310,
      render: (_, r) => {
        const spec = r.spec || {}
        return (
          <div>
            <Text strong style={{ fontSize: 13 }}>{r.clean_name || r.raw_name}</Text>
            <div style={{ marginTop: 4 }}>
              <Space size={4} wrap>
                {spec.brand && <Tag color="purple" style={{ fontWeight: 600 }}>{spec.brand}</Tag>}
                {spec.thickness_mm && <Tag color="blue">{spec.thickness_mm}mm</Tag>}
                {spec.sheet_width_mm && spec.sheet_height_mm && (
                  <Tag color="cyan">{spec.sheet_width_mm}×{spec.sheet_height_mm}mm</Tag>
                )}
                {!spec.parsed && <Tag color="warning">Generic Name</Tag>}
              </Space>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Classification', key: 'classification', width: 130,
      render: (_, r) => {
        if (r.status === 'matched') return <Tag color="green" icon={<CheckCircleOutlined />}>Matched</Tag>
        if (r.status === 'ambiguous') return <Tag color="orange" icon={<QuestionCircleOutlined />}>Ambiguous</Tag>
        if (r.status === 'unmatched') return <Tag color="blue" icon={<ExclamationCircleOutlined />}>Unmatched</Tag>
        if (r.status === 'already_set') return <Tag color="volcano" icon={<WarningOutlined />}>Already Set</Tag>
        return <Tag color="red" icon={<CloseCircleOutlined />}>Invalid</Tag>
      }
    },
    {
      title: 'Action / Target Product', key: 'action', width: 250,
      render: (_, r) => {
        if (r.status === 'invalid') {
          return <Text type="danger" style={{ fontSize: 11 }}>{r.reason}</Text>
        }

        if (r.status === 'ambiguous') {
          return (
            <Select
              style={{ width: '100%' }}
              size="small"
              value={r.action === 'skip' ? 'skip' : r.selected_product_id}
              onChange={val => {
                if (val === 'skip') {
                  updateRowAction(r.row_number, 'action', 'skip')
                } else {
                  updateRowAction(r.row_number, 'action', 'select')
                  updateRowAction(r.row_number, 'selected_product_id', val)
                }
              }}
              options={[
                ...(r.matches || []).map(m => ({
                  value: m.id,
                  label: `Import into: ${m.name}`
                })),
                { value: 'skip', label: '❌ Skip row' }
              ]}
            />
          )
        }

        if (r.status === 'unmatched') {
          return (
            <Select
              style={{ width: '100%' }}
              size="small"
              value={r.action}
              onChange={val => updateRowAction(r.row_number, 'action', val)}
              options={[
                { value: 'create_new', label: '✨ Create new product & import' },
                { value: 'skip', label: '❌ Skip row' }
              ]}
            />
          )
        }

        if (r.status === 'already_set') {
          return (
            <Select
              style={{ width: '100%' }}
              size="small"
              value={r.action}
              onChange={val => updateRowAction(r.row_number, 'action', val)}
              options={[
                { value: 'skip', label: '❌ Skip (Opening Set)' },
                { value: 'import', label: '⚠️ Import anyway (Adjust stock)' }
              ]}
            />
          )
        }

        return (
          <Select
            style={{ width: '100%' }}
            size="small"
            value={r.action}
            onChange={val => updateRowAction(r.row_number, 'action', val)}
            options={[
              { value: 'import', label: `Import: ${r.matched_product?.name || 'Matched'}` },
              { value: 'skip', label: '❌ Skip row' }
            ]}
          />
        )
      }
    },
    {
      title: 'Dual-Unit Qty', key: 'qty', width: 140, align: 'right',
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#16a34a' }}>
            {r.quantity_sqm !== null ? r.quantity_sqm.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'} sqm
          </Text>
          <br/>
          {r.quantity_sheets !== null ? (
            <Text type={r.is_fractional ? 'warning' : 'secondary'} style={{ fontSize: 11 }}>
              ({r.quantity_sheets} sheets {r.is_fractional ? '⚡' : ''})
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          )}
        </div>
      )
    },
    {
      title: 'Rate & Value', key: 'valuation', width: 130, align: 'right',
      render: (_, r) => {
        if (r.is_missing_value) {
          return (
            <Tooltip title="Rate and Value are missing in Tally file. Will be imported with null valuation.">
              <Tag color="gold" style={{ cursor: 'pointer', margin: 0 }}>⚠️ Missing Rate</Tag>
            </Tooltip>
          )
        }
        return (
          <div>
            <Text strong style={{ fontSize: 12 }}>
              ₹{r.total_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <br/>
            <Text type="secondary" style={{ fontSize: 11 }}>
              ₹{r.unit_rate}/sqm
            </Text>
          </div>
        )
      }
    }
  ]

  return (
    <>
      <Modal
        title="📊 Import Tally Godown Summary Export"
        open={open}
        onCancel={handleModalClose}
        width={1050}
        footer={
          parsedRows.length > 0 ? [
            <Button key="cancel" onClick={handleModalClose}>Cancel</Button>,
            <Button 
              key="import" 
              type="primary" 
              loading={loading}
              onClick={handleExecuteImport}
              disabled={summary.matched === 0 && summary.unmatched === 0 && summary.ambiguous === 0}
            >
              Execute Stock Import ({summary.matched + summary.unmatched + summary.ambiguous} products)
            </Button>
          ] : null
        }
      >
        {/* Step 1: File Upload */}
        {parsedRows.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Upload.Dragger
              accept=".xlsx, .xls, .csv"
              fileList={fileList}
              beforeUpload={handleFileUpload}
              showUploadList={false}
              style={{ padding: 32, borderRadius: 12, background: '#f8fafc', border: '2px dashed #cbd5e1' }}
            >
              <p className="ant-upload-drag-icon">
                <FileExcelOutlined style={{ fontSize: 54, color: '#16a34a' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 17, fontWeight: 600, color: '#1e293b' }}>
                Upload Tally Godown Summary (`StkGrpSum.xlsx`)
              </p>
              <p className="ant-upload-hint" style={{ color: '#64748b', maxWidth: 520, margin: '0 auto' }}>
                Supports native Tally exports directly. Automatically parses brand specifications, dual units (sqm & sheets), missing values, and godown metadata.
              </p>
            </Upload.Dragger>
          </div>
        )}

        {/* Step 2: Interactive Preview & Classification */}
        {parsedRows.length > 0 && (
          <div>
            {/* Header info & Godown / Warehouse selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#f1f5f9', padding: '12px 16px', borderRadius: 8 }}>
              <div>
                <Space>
                  <FileExcelOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                  <Text strong style={{ fontSize: 14 }}>File: {filename}</Text>
                </Space>
                <br/>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Verify specifications, godown location, and rates before executing import.
                </Text>
              </div>

              <Space size="middle">
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 600, display: 'block', color: '#64748b' }}>Target Godown / Warehouse:</Text>
                  <Space compact>
                    <Input 
                      prefix={<BankOutlined style={{ color: '#64748b' }} />}
                      value={godownName} 
                      onChange={e => setGodownName(e.target.value)} 
                      style={{ width: 180 }}
                      placeholder="Godown Name"
                    />
                    {warehouses.length > 0 && (
                      <Select
                        placeholder="Link Existing"
                        style={{ width: 140 }}
                        allowClear
                        value={selectedWarehouseId}
                        onChange={val => setSelectedWarehouseId(val)}
                        options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                      />
                    )}
                  </Space>
                </div>

                <div>
                  <Text style={{ fontSize: 11, fontWeight: 600, display: 'block', color: '#64748b' }}>Import Date:</Text>
                  <DatePicker 
                    value={importDate} 
                    onChange={d => d && setImportDate(d)} 
                    format="DD/MM/YYYY" 
                    allowClear={false}
                  />
                </div>
              </Space>
            </div>

            {/* Summary Banner */}
            <Alert
              style={{ marginBottom: 16, borderRadius: 8 }}
              type={summary.missingValueCount > 0 ? 'warning' : 'info'}
              showIcon
              message={
                <div>
                  <Text strong style={{ fontSize: 14 }}>
                    {summary.total} products parsed from Tally export
                  </Text>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    <Space split="•" wrap>
                      <span><Text type="success" strong>{summary.matched}</Text> matched</span>
                      <span><Text type="primary" strong>{summary.unmatched}</Text> new to create</span>
                      {summary.ambiguous > 0 && <span><Text type="warning" strong>{summary.ambiguous}</Text> ambiguous</span>}
                      {summary.alreadySet > 0 && <span><Text type="danger" strong>{summary.alreadySet}</Text> already set</span>}
                      <span>Total SQM: <Text strong>{summary.totalSqm.toLocaleString()} sqm</Text></span>
                      <span>Valuation: <Text strong>₹{summary.totalVal.toLocaleString()}</Text></span>
                      {summary.missingValueCount > 0 && (
                        <Tag color="gold">⚠️ {summary.missingValueCount} products missing rates</Tag>
                      )}
                      {summary.fractionalCount > 0 && (
                        <Tag color="blue">⚡ {summary.fractionalCount} fractional sheet counts</Tag>
                      )}
                    </Space>
                  </div>
                </div>
              }
            />

            {/* Interactive Preview Table */}
            <Table
              rowKey="row_number"
              dataSource={parsedRows}
              columns={columns}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              size="small"
              scroll={{ y: 340 }}
            />
          </div>
        )}
      </Modal>

      {/* Post-Import Reconciliation Result Modal */}
      <Modal
        title="🎉 Tally Stock Import Complete & Reconciled"
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        width={750}
        footer={[
          <Button key="close" type="primary" onClick={() => setResultModalOpen(false)}>Close</Button>,
          <Button 
            key="download" 
            icon={<DownloadOutlined />} 
            style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }}
            onClick={handleDownloadResultReport}
          >
            Download Reconciliation Report (.xlsx)
          </Button>
        ]}
      >
        {importResults && (
          <div style={{ padding: 8 }}>
            <Alert 
              type="success" 
              showIcon 
              message={`Import Reference: ${importResults.reference}`}
              description={`Stock movements successfully posted to Godown: "${importResults.warehouse?.name}". All operations executed atomically.`}
              style={{ marginBottom: 16 }}
            />

            {/* Side-by-side Total Reconciliation Table */}
            <Card size="small" title="📊 Tally vs Essar Glass Total Reconciliation" style={{ marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Metric</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Tally File Total</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Essar Glass Imported</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>Total Quantity (sqm)</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>{importResults.summary.expected_sqm?.toLocaleString()} sqm</td>
                    <td style={{ textAlign: 'right', padding: 8, color: '#16a34a', fontWeight: 600 }}>{importResults.summary.imported_sqm?.toLocaleString()} sqm</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>
                      <Tag color={importResults.summary.variance_sqm === 0 ? 'green' : 'volcano'}>
                        {importResults.summary.variance_sqm === 0 ? '0.0000 (Exact ✅)' : importResults.summary.variance_sqm}
                      </Tag>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8, fontWeight: 600 }}>Total Valuation (₹)</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>₹{importResults.summary.expected_value?.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: 8, color: '#2563eb', fontWeight: 600 }}>₹{importResults.summary.imported_value?.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>
                      <Tag color={importResults.summary.variance_value === 0 ? 'green' : 'volcano'}>
                        {importResults.summary.variance_value === 0 ? '₹0.00 (Exact ✅)' : `₹${importResults.summary.variance_value}`}
                      </Tag>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Products Imported</Text>
                <Title level={3} style={{ margin: 0, color: '#16a34a' }}>{importResults.summary.imported}</Title>
              </div>
              <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>New Products Created</Text>
                <Title level={3} style={{ margin: 0, color: '#2563eb' }}>{importResults.summary.created}</Title>
              </div>
              <div style={{ background: '#fefce8', padding: 12, borderRadius: 8, border: '1px solid #fef08a', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Skipped Products</Text>
                <Title level={3} style={{ margin: 0, color: '#ca8a04' }}>{importResults.summary.skipped}</Title>
              </div>
            </div>

            <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
              Click below to download the row-by-row Excel report to store for compliance and reconciliation.
            </Text>
          </div>
        )}
      </Modal>
    </>
  )
}

export default OpeningStockImportModal
