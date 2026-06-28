import React from 'react'
import { Form, InputNumber, Radio, Typography, Row, Col } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

const StickySummary = ({
  totals = {},
  gstMode = 'cgst_sgst',
  setGstMode
}) => {
  const fmt = (val) => {
    return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  }

  // Margin status formatting
  const marginColor = totals.marginPct > 20 ? '#10b981' : totals.marginPct > 10 ? '#f59e0b' : '#ef4444'
  const marginBg = totals.marginPct > 20 ? '#ecfdf5' : totals.marginPct > 10 ? '#fffbeb' : '#fef2f2'
  const marginBorder = totals.marginPct > 20 ? '#a7f3d0' : totals.marginPct > 10 ? '#fde68a' : '#fca5a5'

  return (
    <div style={{ position: 'sticky', top: 24 }}>
      <div style={{ 
        background: '#fff', 
        borderRadius: 14, 
        border: '1px solid #E2E8F0', 
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.03), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid #F1F5F9',
          background: '#FAFBFD'
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', letterSpacing: -0.1 }}>
            Summary
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Subtotals list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <Text type="secondary">Glass Items</Text>
              <Text style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(totals.subI)}</Text>
            </div>
            
            {totals.procTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">Process Charges</Text>
                <Text style={{ fontWeight: 600, color: '#6366f1' }}>{fmt(totals.procTotal)}</Text>
              </div>
            )}

            {totals.hwTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">Hardware Items</Text>
                <Text style={{ fontWeight: 600, color: '#ea580c' }}>{fmt(totals.hwTotal)}</Text>
              </div>
            )}

            {totals.lbTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">Labor Charges</Text>
                <Text style={{ fontWeight: 600, color: '#7c3aed' }}>{fmt(totals.lbTotal)}</Text>
              </div>
            )}

            {totals.wstTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">Wastage Charges</Text>
                <Text style={{ fontWeight: 600, color: '#e11d48' }}>{fmt(totals.wstTotal)}</Text>
              </div>
            )}
          </div>

          {/* D/C + Discount Inputs */}
          <div style={{ 
            background: '#F8FAFC', 
            borderRadius: 10, 
            padding: '14px', 
            marginBottom: 16, 
            border: '1px solid #E2E8F0' 
          }}>
            <Row gutter={10} style={{ marginBottom: 10 }}>
              <Col span={12}>
                <Form.Item 
                  name="dc_charges" 
                  label={<span style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>D/C Selling</span>} 
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber style={{ width: '100%', borderRadius: 6 }} size="small" prefix="₹" min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="dc_cost" 
                  label={<span style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>D/C Cost</span>} 
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber style={{ width: '100%', borderRadius: 6 }} size="small" prefix="₹" min={0} />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item 
              name="discount_amount" 
              label={<span style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Discount (₹)</span>} 
              style={{ marginBottom: 0 }}
            >
              <InputNumber style={{ width: '100%', borderRadius: 6 }} size="small" prefix="₹" min={0} />
            </Form.Item>
          </div>

          {/* Assessable and Discount Line */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              <Text style={{ color: '#0f172a' }}>Assessable Value</Text>
              <Text style={{ color: '#0f172a' }}>{fmt(totals.subII)}</Text>
            </div>
            
            {totals.discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <Text style={{ color: '#ef4444' }}>Discount Applied</Text>
                <Text style={{ color: '#ef4444', fontWeight: 500 }}>- {fmt(totals.discountAmt)}</Text>
              </div>
            )}
          </div>

          {/* GST Toggle Selector */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 12, 
            padding: '10px 0', 
            borderTop: '1px solid #F1F5F9' 
          }}>
            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>GST Config</Text>
            <Radio.Group 
              value={gstMode} 
              onChange={e => setGstMode(e.target.value)} 
              buttonStyle="solid" 
              size="small"
              style={{ borderRadius: 6 }}
            >
              <Radio.Button value="cgst_sgst" style={{ borderRadius: '4px 0 0 4px' }}>CGST/SGST</Radio.Button>
              <Radio.Button value="igst">IGST</Radio.Button>
              <Radio.Button value="off" style={{ borderRadius: '0 4px 4px 0' }}>None</Radio.Button>
            </Radio.Group>
          </div>

          {/* GST Breakdowns */}
          {gstMode === 'cgst_sgst' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <Text type="secondary">CGST (9%)</Text>
                <Text style={{ fontWeight: 500, color: '#334155' }}>{fmt(totals.cgst)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <Text type="secondary">SGST (9%)</Text>
                <Text style={{ fontWeight: 500, color: '#334155' }}>{fmt(totals.sgst)}</Text>
              </div>
            </div>
          )}

          {gstMode === 'igst' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
              <Text type="secondary">IGST (18%)</Text>
              <Text style={{ fontWeight: 500, color: '#334155' }}>{fmt(totals.igst)}</Text>
            </div>
          )}

          {/* Grand Total Box */}
          <div style={{ 
            background: '#2563eb', // Modern rich blue
            borderRadius: 12, 
            padding: '14px 20px', 
            marginTop: 10, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
          }}>
            <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Grand Total</Text>
            <Text style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>{fmt(totals.grandTotal)}</Text>
          </div>

          {/* Advance and Balance Due */}
          <div style={{ marginTop: 16 }}>
            <Form.Item 
              name="advance_received" 
              label={<span style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Advance Received</span>} 
              style={{ marginBottom: 10 }}
            >
              <InputNumber style={{ width: '100%', borderRadius: 8 }} size="large" prefix="₹" min={0} />
            </Form.Item>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '12px 16px', 
              background: totals.balance > 0 ? '#fef2f2' : '#f0fdf4', 
              borderRadius: 10, 
              border: `1px solid ${totals.balance > 0 ? '#fca5a5' : '#bbf7d0'}` 
            }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: totals.balance > 0 ? '#ef4444' : '#16a34a' }}>
                Balance Due
              </span>
              <span style={{ fontWeight: 700, fontSize: 16, color: totals.balance > 0 ? '#ef4444' : '#16a34a' }}>
                {fmt(totals.balance)}
              </span>
            </div>
          </div>

          {/* Profit Margin Analyzer */}
          {totals.grandTotal > 0 && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px 16px', 
              borderRadius: 12, 
              background: marginBg, 
              border: `1px solid ${marginBorder}`, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <div>
                <Text type="secondary" style={{ fontSize: 10, display: 'block', fontWeight: 500 }}>EST. MARGIN</Text>
                <Text style={{ fontSize: 14, fontWeight: 700, color: marginColor }}>{fmt(totals.marginAmt)}</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 10, display: 'block', fontWeight: 500 }}>MARGIN %</Text>
                <Text style={{ fontSize: 24, fontWeight: 800, color: marginColor }}>
                  {Number(totals.marginPct || 0).toFixed(1)}%
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StickySummary
