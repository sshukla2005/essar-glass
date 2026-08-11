import React, { useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { LinkOutlined, ExportOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuth from '../../hooks/useAuth'
import { companyApi } from '../../api'

const { Text } = Typography

/**
 * InterCompanyBanner Component
 * Renders a persistent warning banner when activeCompanyId != homeCompanyId,
 * or a subtle single-line banner when a PO, SO, or WO has a valid linked_ref object.
 *
 * @param {string} docType - 'po' | 'so' | 'wo'
 * @param {object} linkedRef - object stored in record.linked_ref
 */
const InterCompanyBanner = ({ docType, linkedRef }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, activeCompanyId, setActiveCompany, isSuperAdmin } = useAuth()
  const [navigating, setNavigating] = useState(false)

  const homeCompanyId = user?.home_company_id || user?.company_id
  const isCrossCompany = activeCompanyId && homeCompanyId && activeCompanyId !== homeCompanyId

  // Fetch the company info for brand color and name
  const { data: activeCompany } = useQuery({
    queryKey: ['company-info', activeCompanyId],
    queryFn: () => activeCompanyId ? companyApi.get(activeCompanyId).then(r => r.data) : null,
    enabled: !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  })

  const isFormPage = () => {
    const path = location.pathname
    const isDoc = path.includes('/quotations') ||
                  path.includes('/sales-orders') ||
                  path.includes('/purchase-orders') ||
                  path.includes('/invoices') ||
                  path.includes('/workshop/orders') ||
                  path.includes('/workshop/toughening')
    const isForm = path.endsWith('/new') || path.endsWith('/edit')
    return isDoc && isForm
  }

  // 1. Cross-company warning banner (when rendered in AppLayout globally on form pages)
  if (!linkedRef && isCrossCompany && activeCompany && isFormPage()) {
    const brandColor = activeCompany.color || '#3b82f6'
    const textColor = activeCompany.accent || '#ffffff'
    return (
      <div
        id="cross-company-warning-banner"
        style={{
          position: 'sticky',
          top: 64, // below the sticky AppLayout Header which is 64px high
          zIndex: 98,
          background: brandColor,
          color: textColor,
          padding: '4px 12px',
          fontWeight: 500,
          fontSize: '12px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        }}
      >
        <span>You are editing {activeCompany.name} — not your home company.</span>
      </div>
    )
  }

  if (!linkedRef || typeof linkedRef !== 'object') return null

  const {
    source_company_id,
    source_company_name,
    supplier_company_id,
    supplier_company_name,
    po_id,
    po_number,
    so_id,
    so_number,
    wo_id,
    wo_number,
  } = linkedRef

  // If no links present at all, render nothing
  if (!po_id && !so_id && !wo_id) return null

  const handleOpenDoc = async (targetCompanyId, routePath) => {
    try {
      setNavigating(true)
      if (isSuperAdmin && targetCompanyId && targetCompanyId !== activeCompanyId) {
        const success = await setActiveCompany(targetCompanyId)
        if (!success) {
          message.warning('Switching active company context failed, navigating anyway...')
        }
      }
      navigate(routePath)
    } catch (e) {
      console.error('Navigation error:', e)
    } finally {
      setNavigating(false)
    }
  }

  const suppName = supplier_company_name || 'Supplier Company'
  const srcName = source_company_name || 'Source Company'

  if (docType === 'po') {
    // SOURCE PO
    return (
      <div
        style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space align="center" size="small">
          <LinkOutlined style={{ color: '#16A34A', fontSize: 15 }} />
          <Text style={{ fontSize: 13, color: '#15803D' }}>
            <strong>🔗 Linked to {suppName}</strong> — {so_number ? `SO ${so_number}` : ''}
            {so_number && wo_number ? ', ' : ''}
            {wo_number ? `WO ${wo_number}` : ''}
          </Text>
        </Space>
        <Space size="small">
          {so_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(supplier_company_id, `/sales-orders/${so_id}/edit`)}
              style={{ borderColor: '#16A34A', color: '#15803D' }}
            >
              Open SO ({so_number || `#${so_id}`})
            </Button>
          )}
          {wo_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(supplier_company_id, `/workshop/${wo_id}/edit`)}
              style={{ borderColor: '#16A34A', color: '#15803D' }}
            >
              Open WO ({wo_number || `#${wo_id}`})
            </Button>
          )}
        </Space>
      </div>
    )
  }

  if (docType === 'so') {
    // SUPPLIER SO
    return (
      <div
        style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space align="center" size="small">
          <LinkOutlined style={{ color: '#2563EB', fontSize: 15 }} />
          <Text style={{ fontSize: 13, color: '#1D4ED8' }}>
            <strong>🔗 Created from {srcName}</strong> — {po_number ? `PO ${po_number}` : ''}
          </Text>
        </Space>
        <Space size="small">
          {po_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(source_company_id, `/purchase-orders/${po_id}/edit`)}
              style={{ borderColor: '#2563EB', color: '#1D4ED8' }}
            >
              Open PO ({po_number || `#${po_id}`})
            </Button>
          )}
          {wo_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(null, `/workshop/${wo_id}/edit`)}
              style={{ borderColor: '#2563EB', color: '#1D4ED8' }}
            >
              Open WO ({wo_number || `#${wo_id}`})
            </Button>
          )}
        </Space>
      </div>
    )
  }

  if (docType === 'wo') {
    // SUPPLIER WO
    return (
      <div
        style={{
          background: '#FDF4FF',
          border: '1px solid #F5D0FE',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space align="center" size="small">
          <LinkOutlined style={{ color: '#C026D3', fontSize: 15 }} />
          <Text style={{ fontSize: 13, color: '#A21CAF' }}>
            <strong>🔗 Created from {srcName}</strong> — {po_number ? `PO ${po_number}` : ''}
            {po_number && so_number ? ' / ' : ''}
            {so_number ? `SO ${so_number}` : ''}
          </Text>
        </Space>
        <Space size="small">
          {po_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(source_company_id, `/purchase-orders/${po_id}/edit`)}
              style={{ borderColor: '#C026D3', color: '#A21CAF' }}
            >
              Open PO ({po_number || `#${po_id}`})
            </Button>
          )}
          {so_id && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ExportOutlined />}
              loading={navigating}
              onClick={() => handleOpenDoc(null, `/sales-orders/${so_id}/edit`)}
              style={{ borderColor: '#C026D3', color: '#A21CAF' }}
            >
              Open SO ({so_number || `#${so_id}`})
            </Button>
          )}
        </Space>
      </div>
    )
  }

  return null
}

export default InterCompanyBanner