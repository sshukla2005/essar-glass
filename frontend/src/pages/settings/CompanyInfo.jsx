import React, { useState, useRef, useEffect } from 'react'
import { Card, Typography, Form, Input, Row, Col, Space, Button, App, Divider } from 'antd'
import { SaveOutlined, CloseOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyApi, companyLogoApi } from '../../api'

const { Title, Text } = Typography

const CompanyInfo = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const logoInputRef = useRef(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Get company_id from auth user
  const getCompanyId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      return user?.company_id || 1
    } catch { return 1 }
  }

  const companyId = getCompanyId()

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company-info', companyId],
    queryFn: () => companyApi.get(companyId).then(r => r.data),
    enabled: !!companyId,
  })

  useEffect(() => {
    if (companyData) {
      form.setFieldsValue({
        name: companyData.name || '',
        gstin: companyData.gstin || '',
        pan: companyData.pan || '',
        address: companyData.address || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        bank_ac_name: companyData.bank_ac_name || '',
        bank_name: companyData.bank_name || '',
        bank_branch: companyData.bank_branch || '',
        bank_ac_no: companyData.bank_ac_no || '',
        bank_ifsc: companyData.bank_ifsc || '',
      })
      if (companyData.logo) setLogoPreview(companyData.logo)
    }
  }, [companyData, form])

  const saveMutation = useMutation({
    mutationFn: (data) => companyApi.update(companyId, data),
    onSuccess: (res) => {
      message.success('Company details saved!')
      queryClient.invalidateQueries({ queryKey: ['company-info'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      // Mirror into companies_master (localStorage) — the PDF generator's
      // getCompany() reads the letterhead from there. Without this, PDFs
      // keep showing stale/thin company details after saving here.
      try {
        const saved = res?.data
        if (saved && saved.id) {
          const all = JSON.parse(localStorage.getItem('companies_master') || '[]')
          const idx = all.findIndex(x => x.id === saved.id)
          if (idx !== -1) all[idx] = { ...all[idx], ...saved }
          else all.push(saved)
          localStorage.setItem('companies_master', JSON.stringify(all))
        }
      } catch (err) {
        console.error('companies_master mirror failed:', err)
      }
    },
    onError: () => message.error('Failed to save. Try again.'),
  })

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (values.bank_ifsc) values.bank_ifsc = values.bank_ifsc.toUpperCase()
      await saveMutation.mutateAsync(values)
    } catch {}
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      message.error('File too large. Max 2MB.')
      return
    }
    setLogoUploading(true)
    try {
      const res = await companyLogoApi.upload(file)
      setLogoPreview(res.data.logo)
      message.success('Logo uploaded!')
      queryClient.invalidateQueries({ queryKey: ['company-info'] })
      window.dispatchEvent(new CustomEvent('company-logo-updated', {
        detail: { logo: res.data.logo }
      }))
    } catch {
      message.error('Upload failed. Try again.')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setLogoUploading(true)
    try {
      await companyLogoApi.remove()
      setLogoPreview(null)
      message.success('Logo removed.')
      queryClient.invalidateQueries({ queryKey: ['company-info'] })
      window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logo: null } }))
    } catch {
      message.error('Failed to remove logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
        <Link to="/">Home</Link> / <Link to="/settings">Settings</Link> / Company
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Company Information</Title>
          <Text type="secondary">Manage your company details</Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveMutation.isPending}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>

      <Card loading={isLoading}>
        {/* Logo Section */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '16px 0', marginBottom: 24,
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{
            width: 100, height: 100,
            border: '2px dashed #d1d5db',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', background: '#f9fafb', flexShrink: 0,
          }}>
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Company Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 40 }}>🏢</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Company Logo</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              PNG, JPG, WEBP — max 2MB. Recommended: 200×200px
            </div>
            <Space>
              <Button
                icon={<UploadOutlined />}
                onClick={() => logoInputRef.current?.click()}
                loading={logoUploading}
                style={{ borderColor: '#6366f1', color: '#6366f1' }}
              >
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
              </Button>
              {logoPreview && (
                <Button
                  danger size="small"
                  icon={<DeleteOutlined />}
                  onClick={handleLogoRemove}
                  loading={logoUploading}
                >
                  Remove
                </Button>
              )}
            </Space>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        {/* Company Details Form */}
        <Form form={form} layout="vertical">
          <Divider orientation="left">Company Details</Divider>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input placeholder="Company name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gstin" label="GSTIN">
                <Input placeholder="27AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pan" label="PAN">
                <Input placeholder="AAAAA0000A" maxLength={10} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Full address" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+91 XX XXXX XXXX" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="info@company.com" type="email" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Bank Details</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bank_ac_name" label="A/C Name">
                <Input placeholder="A/C Holder Name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_name" label="Bank Name">
                <Input placeholder="e.g., HDFC Bank Ltd" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bank_branch" label="Branch">
                <Input placeholder="e.g., Virar West" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bank_ac_no" label="A/C Number">
                <Input placeholder="A/C Number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bank_ifsc" label="IFSC Code">
                <Input placeholder="IFSC Code" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  )
}

export default CompanyInfo
