// ─── ProductForm.jsx ─────────────────────────────────────────────────────────
import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Select, Row, Col, Divider, Radio, Tabs, Switch } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import MasterForm from '../../../components/common/MasterForm'
import { productApi, uomApi, hsnApi, taxApi } from '../../../api'

const { TextArea } = Input

const GLASS_TYPES = [
  { value: 'float',      label: 'Float Glass' },
  { value: 'tempered',   label: 'Tempered Glass' },
  { value: 'laminated',  label: 'Laminated Glass' },
  { value: 'reflective', label: 'Reflective Glass' },
  { value: 'mirror',     label: 'Mirror' },
  { value: 'frosted',    label: 'Frosted Glass' },
  { value: 'toughened',  label: 'Toughened Glass' },
  { value: 'insulated',  label: 'Insulated Glass Unit' },
]

const GLASS_COLORS = [
  { value: 'clear',  label: 'Clear' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'grey',   label: 'Grey' },
  { value: 'blue',   label: 'Blue' },
  { value: 'green',  label: 'Green' },
]

const ProductForm = () => {
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const [form]      = Form.useForm()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: record, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn:  () => productApi.get(id).then(r => r.data),
    enabled:  isEdit,
  })

  // ── Fetch dropdowns ────────────────────────────────────────────────────────
  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms-dropdown'],
    queryFn:  () => uomApi.dropdown().then(r => r.data),
  })
  const { data: hsnCodes = [] } = useQuery({
    queryKey: ['hsn-codes-dropdown'],
    queryFn:  () => hsnApi.dropdown().then(r => r.data),
  })
  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes-dropdown'],
    queryFn:  () => taxApi.dropdown().then(r => r.data),
  })

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        ...record,
        uom_id: record.uom?.id || record.uom_id,
        hsn_id: record.hsn?.id || record.hsn_id,
        tax_id: record.tax?.id || record.tax_id,
      })
    }
  }, [record])

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? productApi.update(id, data) : productApi.create(data),
    onSuccess: () => {
      message.success(`Product ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const handleSave = async (andNew = false) => {
    try {
      const values = await form.validateFields()
      await saveMutation.mutateAsync(values)
      if (andNew) { form.resetFields(); navigate('/masters/products/new') }
      else navigate('/masters/products')
    } catch (_) {}
  }

  const tabItems = [
    {
      key: 'general',
      label: 'General Information',
      children: (
        <>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Product name is required' }]}>
                <Input placeholder="Enter product name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="product_type" label="Product Type">
                <Radio.Group>
                  <Radio.Button value="storable">Storable</Radio.Button>
                  <Radio.Button value="consumable">Consumable</Radio.Button>
                  <Radio.Button value="service">Service</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category" label="Product Category"><Input placeholder="e.g., Glass, Accessories" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="internal_ref" label="Internal Reference (SKU)"><Input placeholder="e.g., GL-FL-001" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="barcode" label="Barcode"><Input placeholder="Scan or enter barcode" /></Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="sale_price" label="Sales Price (₹)">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cost_price" label="Cost Price (₹)">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/₹\s?|(,*)/g, '')}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="uom_id" label="UoM">
                <Select showSearch placeholder="Select"
                  options={uoms.map(u => ({ value: u.id, label: u.name }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="hsn_id" label="HSN Code">
                <Select showSearch placeholder="Select"
                  options={hsnCodes.map(h => ({ value: h.id, label: `${h.code} — ${h.description || ''}` }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="tax_id" label="Tax">
                <Select showSearch placeholder="Select"
                  options={taxes.map(t => ({ value: t.id, label: t.name }))}
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Glass Specifications</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="glass_type" label="Glass Type">
                <Select placeholder="Select type" options={GLASS_TYPES} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="thickness_mm" label="Thickness (mm)">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="e.g., 4, 5, 6, 8, 10, 12" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="color_tint" label="Color / Tint">
                <Select placeholder="Select color" options={GLASS_COLORS} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="coating" label="Coating"><Input placeholder="e.g., Low-E, Reflective" /></Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'sales',
      label: 'Sales',
      children: (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="can_be_sold" label="Can be Sold" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="sales_description" label="Sales Description">
            <TextArea rows={4} placeholder="Description for quotations and sales orders..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'purchase',
      label: 'Purchase',
      children: (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="can_be_purchased" label="Can be Purchased" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_lead_time" label="Vendor Lead Time (days)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purchase_description" label="Purchase Description">
            <TextArea rows={4} placeholder="Description for purchase orders..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'inventory',
      label: 'Inventory',
      children: (
        <>
          <Divider orientation="left">Stock Levels</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="on_hand_qty" label="On Hand Qty">
                <InputNumber disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="min_qty" label="Minimum Qty (Reorder Point)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_qty" label="Maximum Qty">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Notes</Divider>
          <Form.Item name="internal_notes" label="Internal Notes">
            <TextArea rows={4} placeholder="Add any internal notes about this product..." />
          </Form.Item>
        </>
      ),
    },
  ]

  return (
    <MasterForm
      title="Product"
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      breadcrumbs={[{ label: 'Masters' }, { label: 'Products', path: '/masters/products' }, { label: isEdit ? 'Edit' : 'New' }]}
      onSave={() => handleSave(false)}
      onSaveNew={() => handleSave(true)}
      onDiscard={() => navigate('/masters/products')}
    >
      <Form form={form} layout="vertical" initialValues={{
        product_type: 'storable', can_be_sold: true, can_be_purchased: true, on_hand_qty: 0,
      }}>
        <Tabs items={tabItems} size="large" />
      </Form>
    </MasterForm>
  )
}

export default ProductForm
