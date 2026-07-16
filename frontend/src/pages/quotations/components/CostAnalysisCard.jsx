import React from 'react'
import { Collapse, Space, Tag, Row, Col, Divider, Typography } from 'antd'
import { LineChartOutlined } from '@ant-design/icons'

const { Text } = Typography

const CostAnalysisCard = ({
  groups = [],
  products = []
}) => {
  const fmtAmt = (val) => {
    return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  }

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 14, 
      border: '1px solid #E2E8F0', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
      marginBottom: 16,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFD',
        gap: 8
      }}>
        <LineChartOutlined style={{ color: '#10b981' }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
          Cost Analysis (per product)
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <Collapse size="small" style={{ border: 'none', background: 'transparent' }} ghost>
          {groups.map((group, gi) => {
            // Selling = glass subtotals + GROUP processes + SIZE processes.
            // Size-process selling missing tha jabki cost side (sz.cost_amount)
            // proc cost include karta hai — isi mismatch se margin galat
            // negative dikhta tha (e.g. -7.47% jabki asli +23.87%)
            const groupSubtotal = group.sizes.reduce((s, x) => s + (x.subtotal || 0), 0) +
              (group.processes || []).reduce((s, p) => s + (p.amount || 0), 0) +
              group.sizes.reduce((s, x) =>
                s + (x.size_processes || []).reduce((ss, sp) => ss + (sp.amount || 0), 0), 0)
            const prod = products.find(p => p.id === group.product_id)
            
            let costPerSqft = group.manual_cost_price || 0
            if (!costPerSqft) {
              if (prod?.cost_price) { 
                costPerSqft = prod.cost_price 
              } else if (group.glass_category && group.glass_thickness) { 
                try { 
                  const matrix = JSON.parse(localStorage.getItem('glass_rate_matrix') || '{}')
                  const costRate = matrix?.cost_rates?.[group.glass_category]
                  if (costRate) {
                    costPerSqft = parseFloat((parseFloat(group.glass_thickness) * costRate / 10.764).toFixed(2))
                  }
                } catch {} 
              }
              if (!costPerSqft && (group.base_glass_rate || group.rate) > 0) {
                costPerSqft = parseFloat(((group.base_glass_rate || group.rate) * 0.70).toFixed(2))
              }
            }
            if (group.is_toughened || group.glass_type === 'Toughened') {
              try {
                const pm = JSON.parse(localStorage.getItem('process_masters') || '[]')
                const toughProc = pm.find(p => p.process_type === 'toughening' && p.is_active !== false)
                if (toughProc && toughProc.rate > 0) {
                  const avgAddon = group.sizes.length > 0
                    ? group.sizes.reduce((s, sz) => s + (sz.tgh_rate_addon || 0), 0) / group.sizes.length
                    : 0
                  if (avgAddon > 0) {
                    costPerSqft = parseFloat((costPerSqft + avgAddon).toFixed(2))
                  }
                }
              } catch {}
            }

            const groupCost = group.sizes.reduce((s, x) => s + (x.cost_amount || 0), 0) +
              (group.processes || []).reduce((s, p) => {
                const procCostRate = p.cost_rate ?? (p.rate * 0.70)
                return s + ((p.qty_area || 0) * procCostRate)
              }, 0)
            const groupMarginAmt = groupSubtotal - groupCost
            // ÷ cost (markup) — wahi client-approved formula jo Cost Wizard,
            // Cost vs Selling modal aur sidebar EST. MARGIN use karte hain
            const groupMarginPct = groupCost > 0 ? ((groupMarginAmt / groupCost) * 100).toFixed(2) : '100'
            const isProfitable = parseFloat(groupMarginPct) >= 20
            const isMedium = parseFloat(groupMarginPct) >= 10 && parseFloat(groupMarginPct) < 20

            return (
              <Collapse.Panel 
                key={gi}
                header={
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500, color: '#334155' }}>
                      {gi + 1}. {group.description || `Group ${gi + 1}`}
                    </span>
                    <Tag 
                      color={isProfitable ? 'green' : isMedium ? 'orange' : 'red'}
                      style={{ borderRadius: 6, fontWeight: 600 }}
                    >
                      {groupMarginPct}% Margin
                    </Tag>
                  </Space>
                }
                style={{
                  border: '1px solid #F1F5F9',
                  borderRadius: 10,
                  marginBottom: 8,
                  background: '#FAFBFD',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Col><Text type="secondary" style={{ fontSize: 13 }}>Cost Price</Text></Col>
                    <Col><Text style={{ fontWeight: 500 }}>{fmtAmt(costPerSqft)} /sqft</Text></Col>
                  </Row>
                  
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Col><Text type="secondary" style={{ fontSize: 13 }}>Total Cost</Text></Col>
                    <Col><Text style={{ fontWeight: 500 }}>{fmtAmt(groupCost)}</Text></Col>
                  </Row>
                  
                  <Row justify="space-between" style={{ marginBottom: 6 }}>
                    <Col><Text type="secondary" style={{ fontSize: 13 }}>Selling Price</Text></Col>
                    <Col><Text style={{ fontWeight: 500, color: '#10b981' }}>{fmtAmt(groupSubtotal)}</Text></Col>
                  </Row>
                  
                  <Divider style={{ margin: '8px 0' }} />
                  
                  <Row justify="space-between">
                    <Col><Text style={{ fontWeight: 600 }}>Estimated Margin</Text></Col>
                    <Col>
                      <Text 
                        strong 
                        style={{ 
                          color: isProfitable ? '#16a34a' : isMedium ? '#d97706' : '#dc2626' 
                        }}
                      >
                        {fmtAmt(groupMarginAmt)} ({groupMarginPct}%)
                      </Text>
                    </Col>
                  </Row>
                </div>
              </Collapse.Panel>
            )
          })}
        </Collapse>
      </div>
    </div>
  )
}

export default CostAnalysisCard
