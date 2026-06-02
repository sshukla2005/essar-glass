import React, { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, Row, Col, Divider, InputNumber, App, Button, Space } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadOutlined } from '@ant-design/icons'
import MasterForm from '../../../components/common/MasterForm'
import { companyApi, currencyApi, companyLogoApi } from '../../../api'
import { INDIAN_STATES, FISCAL_MONTHS } from '../../../utils/constants'

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

const CompanyForm = () => {
  const { message } = App.useApp()
  const { id }       = useParams()
  const isEdit       = Boolean(id)
  const [form]       = Form.useForm()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  // ── Logo state ────────────────────────────────────────────────────────────
  const logoInputRef = useRef(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // ── Fetch existing record ─────────────────────────────────────────────────
  const { data: record, isLoading } = useQuery({
    queryKey: ['companies', id],
    queryFn:  () => companyApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  // ── Currencies dropdown ───────────────────────────────────────────────────
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies-dropdown'],
    queryFn:  () => currencyApi.dropdown().then(r => r.data),
  })

  useEffect(() => {
    if (record) {
      form.setFieldsValue(record)
      if (record.logo) setLogoPreview(record.logo)
    }
  }, [record])

  // ── Logo handlers ─────────────────────────────────────────────────────────
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
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      // Update sidebar logo immediately
      window.dispatchEvent(new CustomEvent('company-logo-updated', {
        detail: { logo: res.data.logo }
      }))
    } catch (err) {
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
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logo: null } }))
    } catch (err) {
      message.error('Failed to remove logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEdit ? companyApi.update(id, data) : companyApi.create(data),
    onSuccess: (res) => {
      message.success(`Company ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      return res
    },
    onError: () => {},
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      // Normalize
      if (values.code)  values.code  = values.code.toUpperCase()
      if (values.gstin) values.gstin = values.gstin.toUpperCase()
      if (values.pan)   values.pan   = values.pan.toUpperCase()
      const res = await saveMutation.mutateAsync(values)
      if (andNew) {
        form.resetFields()
        navigate('/masters/companies/new')
      } else {
        navigate('/masters/companies')
      }
    } catch (_) {}
  }

  return (
    <MasterForm
      title="Company"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Companies', path: '/masters/companies' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/companies')}
    >
      <Form form={form} layout="vertical" initialValues={{ country: 'India', fiscal_year_start: 4, fiscal_year_end: 3 }}>

        {/* ── Logo Upload Section ─────────────────────────────────────── */}
        {isEdit && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '16px 0',
            marginBottom: 24,
            borderBottom: '1px solid #f0f0f0'
          }}>
            {/* Logo Preview */}
            <div style={{
              width: 100, height: 100,
              border: '2px dashed #d1d5db',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: '#f9fafb',
              flexShrink: 0,
            }}>
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 32 }}>🏢</span>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#0f172a' }}>
                Company Logo
              </div>
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
                    danger
                    size="small"
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
        )}

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <Divider orientation="left">Company Identity</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
              <Input placeholder="e.g., GLSS01" style={{ textTransform: 'uppercase' }} maxLength={20} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
              <Input placeholder="Trading name" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="legal_name" label="Legal / Registered Name">
              <Input placeholder="As per MCA registration" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Indian Statutory ──────────────────────────────────────────── */}
        <Divider orientation="left">Statutory Details</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="gstin"
              label="GSTIN"
              rules={[{ pattern: GSTIN_REGEX, message: 'Invalid GSTIN format' }]}
            >
              <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item
              name="pan"
              label="PAN"
              rules={[{ pattern: PAN_REGEX, message: 'Invalid PAN format' }]}
            >
              <Input placeholder="AAAPL1234C" maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item name="cin" label="CIN">
              <Input placeholder="L17110MH2000PLC128859" maxLength={21} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="tan" label="TAN">
              <Input placeholder="PUNE12345A" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Address ───────────────────────────────────────────────────── */}
        <Divider orientation="left">Registered Address</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="address_line1" label="Address Line 1">
              <Input placeholder="Building, Street" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="address_line2" label="Address Line 2">
              <Input placeholder="Area, Landmark" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="city" label="City">
              <Input placeholder="Mumbai" />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item name="state" label="State">
              <Select
                showSearch
                placeholder="Select state"
                options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="pincode" label="Pincode">
              <Input placeholder="400001" maxLength={6} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="country" label="Country">
              <Input defaultValue="India" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Contact ───────────────────────────────────────────────────── */}
        <Divider orientation="left">Contact</Divider>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="phone"   label="Phone">  <Input placeholder="+91 22 XXXX XXXX" /></Form.Item></Col>
          <Col span={6}><Form.Item name="mobile"  label="Mobile"> <Input placeholder="+91 9XXXXXXXXX" /></Form.Item></Col>
          <Col span={7}><Form.Item name="email"   label="Email">  <Input placeholder="info@company.com" type="email" /></Form.Item></Col>
          <Col span={5}><Form.Item name="website" label="Website"><Input placeholder="https://..." /></Form.Item></Col>
        </Row>

        {/* ── Financial Config ──────────────────────────────────────────── */}
        <Divider orientation="left">Financial Configuration</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="currency_id" label="Base Currency">
              <Select
                showSearch
                placeholder="Select currency"
                options={currencies.map(c => ({ value: c.id, label: `${c.code} — ${c.name} (${c.symbol})` }))}
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fiscal_year_start" label="Fiscal Year Start">
              <Select options={FISCAL_MONTHS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fiscal_year_end" label="Fiscal Year End">
              <Select options={FISCAL_MONTHS} />
            </Form.Item>
          </Col>
        </Row>

      </Form>
    </MasterForm>
  )
}

export default CompanyForm
