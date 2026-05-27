import React, { useState } from 'react'
import { 
  Card, Form, InputNumber, Input, Button, Divider, 
  Row, Col, Typography, App, Alert, Tag, Tooltip
} from 'antd'
import { 
  SaveOutlined, CalculatorOutlined, InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

const DEFAULT_SETTINGS = {
  mm_to_inch_factor: 0.03937,
  sqft_ceiling_inches: 6,
  sqft_divisor: 144,
  charged_ceiling_inches: 3,
  toughening_extra_mm: 30,
  rft_divisor: 12,
  cep_rft_multiplier: 7,
  default_gst_rate: 18,
  default_cgst_rate: 9,
  default_sgst_rate: 9,
  default_igst_rate: 18,
  default_validity_days: 8,
  default_dc_charge: 1000,
  default_handling_charge: 500,
  margin_good_pct: 20,
  margin_ok_pct: 10,
  sqmt_divisor: 1000000,
}

const GlassCalcSettings = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [preview, setPreview] = useState(null)

  // Load current settings
  const currentSettings = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('glass_calc_settings') || '{}')
    } catch { return {} }
  }, [])

  React.useEffect(() => {
    form.setFieldsValue({ ...DEFAULT_SETTINGS, ...currentSettings })
  }, [])

  const handleSave = async (values) => {
    const toSave = {
      ...values,
      updated_at: new Date().toISOString(),
      updated_by: 'Admin',
    }
    localStorage.setItem('glass_calc_settings', JSON.stringify(toSave))
    message.success('✅ Glass calculation settings saved! All new quotations will use updated values.')
  }

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_SETTINGS)
    message.info('Reset to default values. Click Save to apply.')
  }

  // Live preview calculator
  const handlePreview = () => {
    const vals = form.getFieldsValue()
    const w_mm = 1200, h_mm = 2400, qty = 1
    const factor = vals.mm_to_inch_factor || 0.03937
    const w_inch = w_mm * factor
    const h_inch = h_mm * factor
    const ceil6 = (x) => Math.ceil(x / (vals.sqft_ceiling_inches || 6)) * (vals.sqft_ceiling_inches || 6)
    const area = (ceil6(w_inch) * ceil6(h_inch)) / (vals.sqft_divisor || 144)
    const rft = (w_inch + h_inch) * 2 / (vals.rft_divisor || 12)
    const ceil3 = (x) => Math.ceil(x / (vals.charged_ceiling_inches || 3)) * (vals.charged_ceiling_inches || 3)
    const charged_sqft = (ceil3(w_inch) * ceil3(h_inch)) / (vals.sqft_divisor || 144)
    const tgh_sqmt = ((w_mm + vals.toughening_extra_mm) * (h_mm + vals.toughening_extra_mm)) / (vals.sqmt_divisor || 1000000)
    setPreview({ w_inch: w_inch.toFixed(3), h_inch: h_inch.toFixed(3), area: area.toFixed(3), rft: rft.toFixed(3), charged_sqft: charged_sqft.toFixed(3), tgh_sqmt: tgh_sqmt.toFixed(4) })
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalculatorOutlined style={{ fontSize: 24 }} />
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>Glass Calculation Settings</Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
              Configure formula values used in Quotation, Workshop and Toughening calculations
            </Text>
          </div>
        </div>
      </div>

      <Alert
        message="These settings affect ALL quotation calculations. Change carefully and test with a sample quotation after saving."
        type="warning" showIcon style={{ marginBottom: 24, borderRadius: 8 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSave}>

        {/* ── Unit Conversion ──────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>📏 Unit Conversion</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item 
                name="mm_to_inch_factor" 
                label={
                  <span>MM to Inch Factor 
                    <Tooltip title="1mm = 0.03937 inches. Standard value — do not change unless required.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber precision={6} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 0.03937</Text>
            </Col>
            <Col span={8}>
              <Form.Item
                name="sqmt_divisor"
                label={
                  <span>Sqmt Divisor
                    <Tooltip title="W_mm × H_mm / this = sqmt. Always 1,000,000 for mm to sqmt.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 1000000</Text>
            </Col>
            <Col span={8}>
              <Form.Item
                name="rft_divisor"
                label={
                  <span>Running Feet Divisor
                    <Tooltip title="running_inches / this = running_feet. Always 12 (12 inches = 1 foot).">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 12</Text>
            </Col>
          </Row>
        </Card>

        {/* ── Area Calculation ─────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>📐 Area (Sqft) Calculation</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sqft_ceiling_inches"
                label={
                  <span>Ceiling Rounding (inches)
                    <Tooltip title="Excel formula: CEILING(W_inch, THIS). Currently 6 = rounds up to nearest 6 inches. Change to 3 for tighter rounding.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={1} max={12} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Standard: 6 &nbsp;|&nbsp; Formula: CEILING(W_inch, 6) × CEILING(H_inch, 6) / 144
              </Text>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sqft_divisor"
                label={
                  <span>Sqft Divisor
                    <Tooltip title="W_inch × H_inch / this = sqft. Always 144 (12×12 = 144 sq inches = 1 sqft).">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 144</Text>
            </Col>
          </Row>
        </Card>

        {/* ── Charged Size (PO) ────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>📋 Charged Size (for Purchase Order)</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="charged_ceiling_inches"
                label={
                  <span>Charged Size Ceiling (inches)
                    <Tooltip title="Excel: CEILING(W_inch, THIS) for PO charged size. Currently 3 = ceiling to nearest 3 inches.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={1} max={6} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Standard: 3 &nbsp;|&nbsp; Formula: CEILING(W_inch, 3)
              </Text>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cep_rft_multiplier"
                label={
                  <span>CEP Running Feet Multiplier
                    <Tooltip title="Excel: (W+H+W+H)/12 × qty × THIS. Currently 7. This is the frame rate factor for CEP items.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 7</Text>
            </Col>
          </Row>
        </Card>

        {/* ── Toughening ───────────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>🔥 Toughening Settings</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="toughening_extra_mm"
                label={
                  <span>Toughening Extra Size (mm)
                    <Tooltip title="Added to W and H when calculating toughening PO size. Currently +30mm on each side.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="mm" />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Standard: 30mm &nbsp;|&nbsp; Formula: W_mm + 30, H_mm + 30
              </Text>
            </Col>
          </Row>
        </Card>

        {/* ── GST & Tax ────────────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>💰 Default GST Rates</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="default_gst_rate" label="Total GST %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="default_cgst_rate" label="CGST %">
                <InputNumber min={0} max={50} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="default_sgst_rate" label="SGST %">
                <InputNumber min={0} max={50} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="default_igst_rate" label="IGST %">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Quotation Defaults ───────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Divider orientation="left">
            <Text strong>📄 Quotation Defaults</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="default_validity_days" label="Validity (days)">
                <InputNumber min={1} style={{ width: '100%' }} addonAfter="days" />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 11 }}>Standard: 8 days</Text>
            </Col>
            <Col span={8}>
              <Form.Item name="default_dc_charge" label="Default D/C Charge (₹)">
                <InputNumber min={0} style={{ width: '100%' }} addonBefore="₹" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="default_handling_charge" label="Default Handling Charge (₹)">
                <InputNumber min={0} style={{ width: '100%' }} addonBefore="₹" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Margin Thresholds ────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 24 }}>
          <Divider orientation="left">
            <Text strong>📊 Margin Analysis Thresholds</Text>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="margin_good_pct" label={<Tag color="green">Good Margin ≥</Tag>}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="margin_ok_pct" label={<Tag color="orange">OK Margin ≥</Tag>}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <div style={{ paddingTop: 30 }}>
                <Tag color="red">Below OK margin = Red warning</Tag>
              </div>
            </Col>
          </Row>
        </Card>

        {/* ── Live Preview ─────────────────────────────────── */}
        <Card style={{ borderRadius: 12, marginBottom: 24, background: '#f8faff' }}>
          <Divider orientation="left">
            <Text strong>🧪 Test with Sample (1200mm × 2400mm, Qty 1)</Text>
          </Divider>
          <Button icon={<CalculatorOutlined />} onClick={handlePreview} style={{ marginBottom: 16 }}>
            Preview Calculation
          </Button>
          {preview && (
            <Row gutter={[12, 8]}>
              <Col span={8}><Text type="secondary">W in inches:</Text> <Text strong>{preview.w_inch}"</Text></Col>
              <Col span={8}><Text type="secondary">H in inches:</Text> <Text strong>{preview.h_inch}"</Text></Col>
              <Col span={8}><Text type="secondary">Area (sqft):</Text> <Text strong style={{ color: '#1d4ed8' }}>{preview.area} sqft</Text></Col>
              <Col span={8}><Text type="secondary">Running ft:</Text> <Text strong>{preview.rft} rft</Text></Col>
              <Col span={8}><Text type="secondary">Charged sqft:</Text> <Text strong>{preview.charged_sqft} sqft</Text></Col>
              <Col span={8}><Text type="secondary">Tgh sqmt:</Text> <Text strong>{preview.tgh_sqmt} sqmt</Text></Col>
            </Row>
          )}
        </Card>

        {/* ── Action Buttons ───────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<SaveOutlined />}
            size="large"
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          >
            Save Settings
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            size="large"
            onClick={handleReset}
          >
            Reset to Defaults
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default GlassCalcSettings
