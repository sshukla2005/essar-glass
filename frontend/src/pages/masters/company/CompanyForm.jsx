import React, { useEffect, useState } from 'react'
import { Form, Input, Select, Row, Col, Divider, InputNumber, App, Button, Space, Upload } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadOutlined, CloseOutlined } from '@ant-design/icons'
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
  const [logoPreview, setLogoPreview] = useState(null)
  const [secondaryLogoPreview, setSecondaryLogoPreview] = useState(null)

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
      form.setFieldsValue({
        ...record,
        address_line1: record.address_line1 || record.address,
      })
      if (record.logo) setLogoPreview(record.logo)
      if (record.secondary_logo) setSecondaryLogoPreview(record.secondary_logo)
    }
  }, [record, form])

  const handleLogoFile = (file, isSecondary = false) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg';
    if (!isJpgOrPng) {
      message.error('You can only upload JPG/PNG/JPEG files!');
      return Upload.LIST_IGNORE;
    }
    const isLt500K = file.size / 1024 < 500;
    if (!isLt500K) {
      message.error('Image must be smaller than 500KB!');
      return Upload.LIST_IGNORE;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Str = reader.result;
      if (isSecondary) {
        setSecondaryLogoPreview(base64Str);
        form.setFieldsValue({ secondary_logo: base64Str });
      } else {
        setLogoPreview(base64Str);
        form.setFieldsValue({ logo: base64Str });
      }
    };
    return false; // prevent auto-upload
  }

  const handleRemoveLogo = (isSecondary = false) => {
    if (isSecondary) {
      setSecondaryLogoPreview(null);
      form.setFieldsValue({ secondary_logo: null });
    } else {
      setLogoPreview(null);
      form.setFieldsValue({ logo: null });
    }
  }

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEdit ? companyApi.update(id, data) : companyApi.create(data),
    onSuccess: (res) => {
      message.success(`Company ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['companies'] })

      // Update companies_master in localStorage
      try {
        const savedCompany = res.data
        if (savedCompany && savedCompany.id) {
          const all = JSON.parse(localStorage.getItem('companies_master') || '[]')
          const idx = all.findIndex(x => x.id === savedCompany.id)
          if (idx !== -1) {
            all[idx] = { ...all[idx], ...savedCompany }
          } else {
            all.push(savedCompany)
          }
          localStorage.setItem('companies_master', JSON.stringify(all))
        }
      } catch (err) {
        console.error('Failed to update companies_master in localStorage:', err)
      }

      return res
    },
    onError: () => {},
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      // Map address_line1 to address for backend compatibility
      values.address = values.address_line1
      
      // TODO: move to server-side company API when multi-company isolation project lands.
      // Normalize
      if (values.code)  values.code  = values.code.toUpperCase()
      if (values.gstin) values.gstin = values.gstin.toUpperCase()
      if (values.pan)   values.pan   = values.pan.toUpperCase()
      if (values.bank_ifsc) values.bank_ifsc = values.bank_ifsc.toUpperCase()
      const res = await saveMutation.mutateAsync(values)
      if (values.logo !== undefined) {
        window.dispatchEvent(new CustomEvent('company-logo-updated', {
          detail: { logo: values.logo }
        }))
      }
      if (andNew) {
        form.resetFields()
        setLogoPreview(null)
        setSecondaryLogoPreview(null)
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
          <Col span={12}>
            <Form.Item
              name="gstin"
              label="GSTIN"
              rules={[{ pattern: GSTIN_REGEX, message: 'Invalid GSTIN format' }]}
            >
              <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tan" label="TAN">
              <Input placeholder="PUNE12345A" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Address ───────────────────────────────────────────────────── */}
        <Divider orientation="left">Registered Address</Divider>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="address_line1" label="Address Line 1">
              <Input placeholder="Building, Street" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
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

        {/* ── Letterhead Details ─────────────────────────────────────── */}
        <Divider orientation="left">Letterhead Details</Divider>
        {/* TODO: move to server-side company API when multi-company isolation project lands. */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Company Logo">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  accept=".png,.jpg,.jpeg"
                  beforeUpload={(file) => handleLogoFile(file, false)}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>Select Logo</Button>
                </Upload>
                {logoPreview && (
                  <div style={{ position: 'relative', width: 100, height: 100, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                    <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    <Button
                      type="primary"
                      danger
                      shape="circle"
                      icon={<CloseOutlined style={{ fontSize: 10 }} />}
                      size="small"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, minWidth: 20 }}
                      onClick={() => handleRemoveLogo(false)}
                    />
                  </div>
                )}
              </Space>
            </Form.Item>
            <Form.Item name="logo" hidden><Input /></Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Secondary Logo (Certification/Membership Badge)">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  accept=".png,.jpg,.jpeg"
                  beforeUpload={(file) => handleLogoFile(file, true)}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>Select Secondary Logo</Button>
                </Upload>
                {secondaryLogoPreview && (
                  <div style={{ position: 'relative', width: 100, height: 100, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                    <img src={secondaryLogoPreview} alt="Secondary Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    <Button
                      type="primary"
                      danger
                      shape="circle"
                      icon={<CloseOutlined style={{ fontSize: 10 }} />}
                      size="small"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, minWidth: 20 }}
                      onClick={() => handleRemoveLogo(true)}
                    />
                  </div>
                )}
              </Space>
            </Form.Item>
            <Form.Item name="secondary_logo" hidden><Input /></Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="whatsapp" label="WhatsApp Number">
              <Input placeholder="e.g. +91 98765 43210" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="phone2" label="Secondary Phone (Optional)">
              <Input placeholder="e.g. 022 1234567" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="pan" label="PAN No.">
              <Input placeholder="e.g. AAAPL1234C" maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="cin" label="CIN No.">
              <Input placeholder="e.g. L17110MH2000PLC128859" maxLength={21} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="state_code" label="State Code">
              <Input placeholder="e.g. 27" maxLength={2} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="state_name" label="State Name">
              <Input placeholder="e.g. MAHARASHTRA" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="address_line2" label="Address Line 2 (Optional)">
              <Input placeholder="Area, Landmark, District" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Bank Details ──────────────────────────────────────────────── */}
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
