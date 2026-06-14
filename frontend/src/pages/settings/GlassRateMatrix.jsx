import React, { useState, useEffect } from 'react'
import { settingsApi } from '../../api/settingsApi'
import {
  Card, Table, InputNumber, Button, Divider,
  Typography, Row, Col, App, Space, Tag, Select
} from 'antd'
import { SaveOutlined, CalculatorOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const CATEGORIES = ['Clear', 'Xtra Clear', 'Tinted', 'Reflective', 'Mirror']
const THICKNESSES = ['3.5', '4', '5', '6', '8', '10', '12']
const SQMT_TO_SQFT = 10.764

const GlassRateMatrix = () => {
  const { message } = App.useApp()

  const getMatrix = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
      if (parsed && !parsed.toughening_sell_rates) {
        parsed.toughening_sell_rates = {
          "3.5": 15,
          "4": 20,
          "5": 25,
          "6": 30,
          "8": 35,
          "10": 40,
          "12": 50
        }
      }
      return parsed
    } catch {
      return {
        toughening_sell_rates: {
          "3.5": 15,
          "4": 20,
          "5": 25,
          "6": 30,
          "8": 35,
          "10": 40,
          "12": 50
        }
      }
    }
  }

  const [matrix, setMatrix] = useState(getMatrix)

  // Load from backend on mount (overrides localStorage if backend has data)
  useEffect(() => {
    settingsApi.get(settingsApi.KEYS.GLASS_RATE_MATRIX).then(data => {
      if (data && Object.keys(data).length > 0) {
        if (!data.toughening_sell_rates) {
          data.toughening_sell_rates = {
            "3.5": 15,
            "4": 20,
            "5": 25,
            "6": 30,
            "8": 35,
            "10": 40,
            "12": 50
          }
        }
        setMatrix(data)
        localStorage.setItem('glass_rate_matrix', JSON.stringify(data))
      }
    }).catch(() => { })
  }, [])
  const [preview, setPreview] = useState(null)
  const [prevCat, setPrevCat] = useState('Clear')
  const [prevThick, setPrevThick] = useState('4')

  const updateBaseRate = (category, value) => {
    setMatrix(prev => ({
      ...prev,
      base_rates: { ...prev.base_rates, [category]: value }
    }))
  }

  const updateCostRate = (category, value) => {
    setMatrix(prev => ({
      ...prev,
      cost_rates: { ...(prev.cost_rates || {}), [category]: value }
    }))
  }

  const updateThicknessRate = (thickness, value) => {
    setMatrix(prev => ({
      ...prev,
      thickness_rft_rates: { ...(prev.thickness_rft_rates || {}), [thickness]: value }
    }))
  }

  const updateCepOptions = (field, value) => {
    setMatrix(prev => ({ ...prev, [field]: value }))
  }

  const updateTougheningCostRate = (thickness, value) => {
    setMatrix(prev => ({
      ...prev,
      toughening_cost_rates: { ...(prev.toughening_cost_rates || {}), [thickness]: value }
    }))
  }

  const updateTougheningSellRate = (thickness, value) => {
    setMatrix(prev => ({
      ...prev,
      toughening_sell_rates: {
        ...(prev.toughening_sell_rates || {}),
        [thickness]: value
      }
    }))
  }

  const handleSave = async () => {
    const toSave = { ...matrix, updated_at: new Date().toISOString() }
    localStorage.setItem('glass_rate_matrix', JSON.stringify(toSave))
    await settingsApi.save(settingsApi.KEYS.GLASS_RATE_MATRIX, toSave)
    message.success('✅ Glass Rate Matrix saved! New quotations will use updated rates.')
  }

  const calcRate = (category, thickness) => {
    const baseRate = matrix?.base_rates?.[category] || 0
    const costRate = matrix?.cost_rates?.[category] || 0
    const thick = parseFloat(thickness) || 0
    const perSqmt = thick * baseRate
    const perSqft = perSqmt / SQMT_TO_SQFT
    const costSqmt = thick * costRate
    const costSqft = costSqmt / SQMT_TO_SQFT

    const tghAddon = parseFloat(matrix?.toughening_sell_rates?.[thickness] || 0)
    const tghCostAddon = parseFloat((matrix?.toughening_cost_rates?.[thickness] || 0))
    const toughCostSqft = parseFloat((parseFloat(costSqft) + tghCostAddon).toFixed(2))
    const toughSellSqft = parseFloat((perSqft + tghAddon).toFixed(2))

    return {
      perSqmt: perSqmt.toFixed(2),
      perSqft: perSqft.toFixed(2),
      costSqmt: costSqmt.toFixed(2),
      costSqft: costSqft.toFixed(2),
      tghAddon: tghAddon.toFixed(2),
      tghCostAddon: tghCostAddon.toFixed(2),
      toughCostSqft: toughCostSqft.toFixed(2),
      toughSellSqft: toughSellSqft.toFixed(2),
    }
  }

  const handlePreview = () => {
    const r = calcRate(prevCat, prevThick)
    const rftAddon = matrix?.thickness_rft_rates?.[prevThick] || 0
    setPreview({
      category: prevCat, thickness: prevThick,
      baseRate: matrix?.base_rates?.[prevCat] || 0,
      perSqmt: r.perSqmt, perSqft: r.perSqft,
      costSqmt: r.costSqmt, costSqft: r.costSqft,
      rftAddon,
    })
  }

  // Build table data: each row = one thickness, columns = categories
  const tableData = THICKNESSES.map(t => {
    const row = { key: t, thickness: `${t}mm` }
    CATEGORIES.forEach(cat => {
      const r = calcRate(cat, t)
      row[cat] = r.perSqft
      row[`${cat}_tough`] = r.toughSellSqft
      row['tghAddon'] = r.tghAddon // same addon per row regardless of category
    })
    row['tghCostAddon'] = matrix?.toughening_cost_rates?.[t] || 0
    return row
  })

  const tableColumns = [
    {
      title: 'Thickness', dataIndex: 'thickness', width: 90,
      render: v => <Text strong>{v}</Text>
    },
    ...CATEGORIES.map(cat => ({
      title: cat,
      dataIndex: cat,
      align: 'center',
      render: (v, row) => (
        <div>
          <Text style={{ color: '#1d4ed8', display: 'block' }}>₹{v}/sqft</Text>
          {parseFloat(row.tghAddon) > 0 && (
            <Text style={{ color: '#f97316', fontSize: 10 }}>
              🔥 ₹{row[`${cat}_tough`]}/sqft
            </Text>
          )}
        </div>
      )
    })),
    {
      title: (
        <span style={{ color: '#f97316' }}>
          Tgh Addon<br />
          <span style={{ fontSize: 10, fontWeight: 400 }}>Sell | Cost ₹/sqft</span>
        </span>
      ),
      dataIndex: 'tghAddon',
      align: 'center',
      width: 130,
      render: (v, row) => (
        <div>
          {parseFloat(row.tghAddon) > 0
            ? <Tag color="orange">+₹{row.tghAddon}/sqft sell</Tag>
            : <Text type="secondary" style={{ fontSize: 11 }}>Not set</Text>
          }
          <InputNumber
            size="small"
            value={row.tghCostAddon || 0}
            min={0}
            prefix="₹"
            placeholder="Cost"
            style={{ width: '100%', marginTop: 4, borderColor: '#fed7aa' }}
            onChange={val => updateTougheningCostRate(row.key, val)}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>cost/sqft</Text>
        </div>
      )
    }
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ background: 'linear-gradient(135deg, #1a237e, #3949ab)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>Glass Rate Matrix</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
          Category-wise base rate per mm. Selling rate = thickness × base rate ÷ 10.764
        </Text>
      </div>

      {/* Base Rates per Category */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong>Rate Matrix (₹ per Sqmt per MM)</Text>
        </Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Formula: Thickness(mm) × Rate = Rate/sqmt → ÷ 10.764 = Rate/sqft
        </Text>

        {/* Category headers */}
        <Row gutter={16} style={{ marginBottom: 6 }}>
          <Col span={4}>
            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              CATEGORY
            </Text>
          </Col>
          {CATEGORIES.map(cat => (
            <Col key={cat} span={4}>
              <Text style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                {cat}
              </Text>
            </Col>
          ))}
        </Row>

        {/* Selling Rate row */}
        <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
          <Col span={4}>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 6,
              padding: '4px 8px',
            }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                SELL Rate
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 10 }}>
                Customer pays
              </Text>
            </div>
          </Col>
          {CATEGORIES.map(cat => (
            <Col key={cat} span={4}>
              <InputNumber
                value={matrix?.base_rates?.[cat] || 0}
                min={0}
                prefix="₹"
                style={{ width: '100%', borderColor: '#86efac' }}
                onChange={val => updateBaseRate(cat, val)}
              />
              <Text type="secondary" style={{ fontSize: 10 }}>
                = ₹{((matrix?.base_rates?.[cat] || 0) * 6 / 10.764).toFixed(2)}/sqft @ 6mm
              </Text>
            </Col>
          ))}
        </Row>

        {/* Cost Rate row */}
        <Row gutter={16} align="middle">
          <Col span={4}>
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 6,
              padding: '4px 8px',
            }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>
                COST Rate
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 10 }}>
                Essar pays vendor
              </Text>
            </div>
          </Col>
          {CATEGORIES.map(cat => (
            <Col key={cat} span={4}>
              <InputNumber
                value={matrix?.cost_rates?.[cat] || 0}
                min={0}
                prefix="₹"
                style={{ width: '100%', borderColor: '#fed7aa' }}
                onChange={val => updateCostRate(cat, val)}
              />
              <Text type="secondary" style={{ fontSize: 10 }}>
                = ₹{((matrix?.cost_rates?.[cat] || 0) * 6 / 10.764).toFixed(2)}/sqft @ 6mm
              </Text>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Calculated Rate Table */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left"><Text strong>Auto-Calculated Selling Rates (₹/sqft)</Text></Divider>
        <Table
          dataSource={tableData}
          columns={tableColumns}
          pagination={false}
          size="small"
          bordered
        />
      </Card>

      {/* Thickness Add-on Rates */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left"><Text strong>Thickness Add-on Rate (₹ per Running Ft)</Text></Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Extra charge added per running foot based on glass thickness (for polishing/edge work)
        </Text>
        <Row gutter={16}>
          {THICKNESSES.map(t => (
            <Col key={t} span={3}>
              <div style={{ marginBottom: 4 }}>
                <Text strong>{t}mm</Text>
              </div>
              <InputNumber
                value={matrix?.thickness_rft_rates?.[t] || 0}
                min={0}
                prefix="₹"
                style={{ width: '100%' }}
                onChange={val => updateThicknessRate(t, val)}
              />
            </Col>
          ))}
        </Row>
      </Card>

      {/* Toughening Cost Rates */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong style={{ color: '#f97316' }}>🔥 Toughening Cost Rate (₹/sqft per Thickness)</Text>
        </Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Your cost from toughening vendor per sqft — separate from selling price addon. Used in Cost vs Selling wizard.
        </Text>
        <Row gutter={16}>
          {THICKNESSES.map(t => (
            <Col key={t} span={3}>
              <div style={{ marginBottom: 4 }}>
                <Text strong>{t}mm</Text>
              </div>
              <InputNumber
                value={matrix?.toughening_cost_rates?.[t] || 0}
                min={0}
                prefix="₹"
                style={{ width: '100%', borderColor: '#fed7aa' }}
                onChange={val => updateTougheningCostRate(t, val)}
              />
              <Text type="secondary" style={{ fontSize: 10 }}>/sqft</Text>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Toughening Sell Rates */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left">
          <Text strong style={{ color: '#f97316' }}>🔥 Toughening Sell Rate (₹/sqft per Thickness)</Text>
        </Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Customer selling price addon for toughening per sqft — separate from cost rate. Used in Cost vs Selling wizard.
        </Text>
        <Row gutter={16}>
          {THICKNESSES.map(t => (
            <Col key={t} span={3}>
              <div style={{ marginBottom: 4 }}>
                <Text strong>{t}mm</Text>
              </div>
              <InputNumber
                value={matrix?.toughening_sell_rates?.[t] || 0}
                min={0}
                prefix="₹"
                style={{ width: '100%', borderColor: '#fed7aa' }}
                onChange={val => updateTougheningSellRate(t, val)}
              />
              <Text type="secondary" style={{ fontSize: 10 }}>sell/sqft</Text>

            </Col>
          ))}
        </Row>
      </Card>

      {/* CEP/Toughening Rft Multiplier */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Divider orientation="left"><Text strong>CEP / Toughening Running Ft Options</Text></Divider>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Options shown to user in quotation when CEP is enabled.
          User can select which multiplier to use per order.
        </Text>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Text strong>Available Multipliers</Text>
            <br />
            <Select
              mode="multiple"
              value={matrix?.cep_rft_options || [5, 7]}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ value: n, label: `×${n}` }))}
              style={{ width: '100%', marginTop: 4 }}
              onChange={val => updateCepOptions('cep_rft_options', val)}
            />
          </Col>
          <Col span={8}>
            <Text strong>Default Multiplier</Text>
            <br />
            <Select
              value={matrix?.cep_rft_default || 5}
              options={(matrix?.cep_rft_options || [5, 7]).map(n => ({ value: n, label: `×${n} (per rft)` }))}
              style={{ width: '100%', marginTop: 4 }}
              onChange={val => updateCepOptions('cep_rft_default', val)}
            />
          </Col>
        </Row>
      </Card>

      {/* Live Preview */}
      <Card style={{ borderRadius: 12, background: '#f8faff', marginBottom: 24 }}>
        <Divider orientation="left"><Text strong>🧪 Live Rate Preview</Text></Divider>
        <Row gutter={12} align="middle">
          <Col span={6}>
            <Select
              value={prevCat}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
              style={{ width: '100%' }}
              onChange={setPrevCat}
            />
          </Col>
          <Col span={6}>
            <Select
              value={prevThick}
              options={THICKNESSES.map(t => ({ value: t, label: `${t}mm` }))}
              style={{ width: '100%' }}
              onChange={setPrevThick}
            />
          </Col>
          <Col span={4}>
            <Button icon={<CalculatorOutlined />} onClick={handlePreview}>Calculate</Button>
          </Col>
        </Row>
        {preview && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Row gutter={[12, 8]}>
              <Col span={6}>
                <Text type="secondary">W(inch) → Selling/sqft</Text>
                <div>
                  <Text strong style={{ color: '#16a34a', fontSize: 16 }}>
                    ₹{preview.perSqft}
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Cost/sqft (vendor)</Text>
                <div>
                  <Text strong style={{ color: '#ea580c', fontSize: 16 }}>
                    ₹{preview.costSqft}
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Margin/sqft</Text>
                <div>
                  <Text strong style={{
                    color: '#6366f1',
                    fontSize: 16,
                  }}>
                    ₹{(parseFloat(preview.perSqft) - parseFloat(preview.costSqft)).toFixed(2)}
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <Text type="secondary">Margin %</Text>
                <div>
                  <Text strong style={{
                    fontSize: 18,
                    color: parseFloat(preview.costSqft) > 0
                      ? ((parseFloat(preview.perSqft) - parseFloat(preview.costSqft)) /
                        parseFloat(preview.costSqft) * 100) >= 20 ? '#16a34a' : '#f59e0b'
                      : '#94a3b8'
                  }}>
                    {parseFloat(preview.costSqft) > 0
                      ? (((parseFloat(preview.perSqft) - parseFloat(preview.costSqft)) /
                        parseFloat(preview.costSqft)) * 100).toFixed(1) + '%'
                      : '—'}
                  </Text>
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 8, color: '#6366f1', fontSize: 12 }}>
              Formula: {preview.thickness}mm × ₹{preview.baseRate} = ₹{preview.perSqmt}/sqmt ÷ 10.764 = ₹{preview.perSqft}/sqft
            </div>
          </div>
        )}
      </Card>

      <Button type="primary" icon={<SaveOutlined />} size="large"
        style={{ background: '#1a237e' }} onClick={handleSave}>
        Save Rate Matrix
      </Button>
    </div>
  )
}

export default GlassRateMatrix
