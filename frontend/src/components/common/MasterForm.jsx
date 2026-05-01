import React from 'react'
import { Card, Button, Space, Row, Col, Typography, Breadcrumb, Divider, Spin } from 'antd'
import { SaveOutlined, PlusOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'

const { Title } = Typography

/**
 * MasterForm — reusable form page shell for all master create/edit pages.
 * Props:
 *   title        — e.g., "Company"
 *   isEdit       — boolean
 *   isLoading    — loading skeleton
 *   isSaving     — saving spinner on buttons
 *   breadcrumbs  — [{ label, path? }]
 *   onSave       — () => void  (Save & Close)
 *   onSaveNew    — () => void  (Save & New) — omit to hide button
 *   onDiscard    — () => void
 *   children     — Form content
 */
const MasterForm = ({
  title,
  isEdit      = false,
  isLoading   = false,
  isSaving    = false,
  breadcrumbs = [],
  onSave,
  onSaveNew,
  onDiscard,
  children,
}) => {
  const navigate = useNavigate()

  const handleDiscard = () => {
    if (onDiscard) onDiscard()
    else navigate(-1)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/">Home</Link> },
          ...breadcrumbs.map((b, i) =>
            b.path && i < breadcrumbs.length - 1
              ? { title: <Link to={b.path}>{b.label}</Link> }
              : { title: b.label }
          ),
        ]}
      />

      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleDiscard} />
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit ${title}` : `New ${title}`}
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button onClick={handleDiscard} icon={<CloseOutlined />} disabled={isSaving}>
              Discard
            </Button>
            {onSaveNew && (
              <Button onClick={onSaveNew} icon={<PlusOutlined />} loading={isSaving} disabled={isSaving}>
                Save &amp; New
              </Button>
            )}
            {onSave && (
              <Button type="primary" onClick={onSave} icon={<SaveOutlined />} loading={isSaving} style={{ background: '#10b981' }}>
                {isEdit ? 'Save Changes' : 'Save'}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Form Body */}
      <Spin spinning={isLoading}>
        <Card>{children}</Card>
      </Spin>
    </div>
  )
}

export default MasterForm
