import React from 'react'
import { Row, Col, Card, Statistic, Typography, Space } from 'antd'
import {
  BankOutlined, EnvironmentOutlined, DollarOutlined,
  BarcodeOutlined, PercentageOutlined, ControlOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { branchApi, currencyApi, hsnApi, taxApi, uomApi } from '../api'

const { Title, Text } = Typography

const StatCard = ({ title, icon, queryKey, api, color }) => {
  const { data } = useQuery({
    queryKey: [queryKey, 'count'],
    queryFn:  () => api.list({ page: 1, page_size: 1, is_active: true }).then(r => r.data.total),
  })
  return (
    <Card hoverable>
      <Statistic
        title={<Space>{icon}<span>{title}</span></Space>}
        value={data ?? '—'}
        valueStyle={{ color }}
      />
    </Card>
  )
}

const Dashboard = () => (
  <div style={{ padding: 24 }}>
    <Title level={4} style={{ marginBottom: 4 }}>ESSAR Glass Manufacturing</Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
      Dashboard Overview
    </Text>

    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={8}>
        <StatCard title="Branches"     icon={<EnvironmentOutlined />} queryKey="branches"   api={branchApi}   color="#52c41a" />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <StatCard title="Currencies"   icon={<DollarOutlined />}     queryKey="currencies" api={currencyApi} color="#faad14" />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <StatCard title="UoMs"         icon={<ControlOutlined />}    queryKey="uoms"       api={uomApi}      color="#722ed1" />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <StatCard title="Taxes"        icon={<PercentageOutlined />} queryKey="taxes"      api={taxApi}      color="#eb2f96" />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <StatCard title="HSN Codes"    icon={<BarcodeOutlined />}    queryKey="hsn-codes"  api={hsnApi}      color="#13c2c2" />
      </Col>
    </Row>
  </div>
)

export default Dashboard
