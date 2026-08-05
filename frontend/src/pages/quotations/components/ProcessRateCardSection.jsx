import React from 'react'
import {
  Button,
  Select,
  InputNumber,
  Typography,
  Space,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const { Text } = Typography

/**
 * ProcessRateCardSection
 *
 * A per-quotation/SO table that stores ONE selling rate and ONE cost rate
 * for each process. When a size-specific process is selected in any glass
 * line, its rates auto-fill from (and stay in sync with) this card.
 *
 * Props:
 *   processRateCard   – array of { prc_key, process_id, process_name, selling_rate, cost_rate }
 *   updateRateCard    – fn(prc_key, field, value)  → updates one field + propagates to all lines
 *   addRateCardRow    – fn()                        → adds a blank row
 *   removeRateCardRow – fn(prc_key)                → removes row + optionally clears line rates
 *   processMasters    – full process master list (for the manual-add select)
 */
const ProcessRateCardSection = ({
  processRateCard = [],
  updateRateCard,
  addRateCardRow,
  removeRateCardRow,
  processMasters = [],
}) => {
  // Only hole/cutout/farma/beveling are used in size-specific processes
  const eligibleMasters = processMasters.filter(p =>
    ['hole', 'cutout', 'farma', 'beveling'].includes(p.process_type)
  )

  // IDs already in the card so we can exclude them from the "add" select
  const usedIds = new Set(processRateCard.map(r => r.process_id).filter(Boolean))

  return (
    <div style={{
      marginBottom: 20,
      background: '#faf5ff',
      border: '1px solid #e9d5ff',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid #e9d5ff',
        background: '#f5f3ff',
      }}>
        <Space size={8}>
          <ThunderboltOutlined style={{ color: '#7c3aed', fontSize: 15 }} />
          <Text strong style={{ fontSize: 14, color: '#4c1d95' }}>
            Process Rate Card
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (this quotation only)
          </Text>
          <Tooltip title="Set selling and cost rates here once. Every size-specific process row with that process will auto-fill from this card. Editing a rate here updates ALL matching rows across this quotation instantly.">
            <InfoCircleOutlined style={{ color: '#9333ea', cursor: 'help' }} />
          </Tooltip>
        </Space>
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={addRateCardRow}
          style={{
            borderColor: '#7c3aed',
            color: '#7c3aed',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          Add Process
        </Button>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '12px 20px 16px' }}>
        {processRateCard.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: '12px 0' }}>
            No processes yet. Add a process below or select one in a glass line — it will auto-appear here.
          </Text>
        ) : (
          <>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 140px 40px',
              gap: 8,
              marginBottom: 6,
              padding: '0 4px',
            }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Process</Text>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Selling Rate ₹</Text>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cost Rate ₹</Text>
              <span />
            </div>

            {/* Rows */}
            {processRateCard.map(row => (
              <div
                key={row.prc_key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 140px 40px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '8px 10px',
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #ede9fe',
                }}
              >
                {/* Process selector (or static label if auto-seeded) */}
                {row.process_id ? (
                  <Text style={{ fontSize: 13, fontWeight: 500, color: '#4c1d95' }}>
                    {row.process_name || eligibleMasters.find(p => p.id === row.process_id)?.name || `Process ${row.process_id}`}
                  </Text>
                ) : (
                  <Select
                    size="small"
                    placeholder="Select process"
                    style={{ width: '100%' }}
                    options={eligibleMasters
                      .filter(p => !usedIds.has(p.id))
                      .map(p => ({ value: p.id, label: p.name }))
                    }
                    onChange={val => {
                      const pm = eligibleMasters.find(p => p.id === val)
                      updateRateCard(row.prc_key, '__process_select__', { process_id: val, process_name: pm?.name || '' })
                    }}
                  />
                )}

                {/* Selling Rate */}
                <InputNumber
                  size="small"
                  value={row.selling_rate}
                  min={0}
                  prefix="₹"
                  style={{ width: '100%', borderRadius: 6 }}
                  onChange={val => updateRateCard(row.prc_key, 'selling_rate', val ?? 0)}
                />

                {/* Cost Rate */}
                <InputNumber
                  size="small"
                  value={row.cost_rate}
                  min={0}
                  prefix="₹"
                  placeholder="Cost"
                  style={{ width: '100%', borderRadius: 6, borderColor: '#f59e0b' }}
                  onChange={val => updateRateCard(row.prc_key, 'cost_rate', val ?? 0)}
                />

                {/* Delete */}
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRateCardRow(row.prc_key)}
                />
              </div>
            ))}
          </>
        )}

        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, color: '#a78bfa' }}>
          ✦ Rates here apply to every matching process in <strong>this quotation only</strong>.
          Changing a rate updates all existing rows live.
        </Text>
      </div>
    </div>
  )
}

export default ProcessRateCardSection
