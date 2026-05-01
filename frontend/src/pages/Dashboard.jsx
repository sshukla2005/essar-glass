import React, { useState } from 'react';
import { Row, Col, Card, Typography, Space, Radio, Table, Tag } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  RiseOutlined, FallOutlined, FireFilled,
  SettingOutlined, ClockCircleOutlined, UserOutlined, CarOutlined
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const { Title, Text } = Typography;

// Mock data for the full year (as seen in the image)
const dataFullYear = [
  { name: 'Jan', quotations: 18000 },
  { name: 'Feb', quotations: 22000 },
  { name: 'Mar', quotations: 26000 },
  { name: 'Apr', quotations: 19000 },
  { name: 'May', quotations: 24000 },
  { name: 'Jun', quotations: 28000 },
  { name: 'Jul', quotations: 15000 },
  { name: 'Aug', quotations: 25000 },
  { name: 'Sep', quotations: 30000 },
  { name: 'Oct', quotations: 24000 },
  { name: 'Nov', quotations: 32000 },
  { name: 'Dec', quotations: 27000 },
];

// Placeholder for other ranges (can be derived or simplified for now)
const data30Days = dataFullYear.slice(-4); 
const data7Days = dataFullYear.slice(-7);

const StatCard = ({ title, value, percentage, isUp, textUp, textDown }) => (
  <Card 
    style={{ 
      borderRadius: 24, 
      boxShadow: '0 8px 24px rgba(0,0,0,0.04)', // Stronger shadow for contrast
      border: '1px solid #dbeafe', // Deeper blue border
      backgroundColor: '#f0f7ff', 
      transition: 'transform 0.2s, box-shadow 0.2s'
    }} 
    hoverable
    bodyStyle={{ padding: '28px' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, color: '#8c8c8c' }}>{title}</Text>
      <Tag 
        style={{ 
          borderRadius: 10, 
          padding: '2px 10px', 
          border: '1px solid #f0f0f0', 
          backgroundColor: '#fff', 
          color: '#595959',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12
        }}
      >
        {isUp ? <RiseOutlined style={{ fontSize: 12 }} /> : <FallOutlined style={{ fontSize: 12 }} />} {percentage}
      </Tag>
    </div>
    
    <div style={{ marginBottom: 20 }}>
      <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', fontSize: 32 }}>{value}</Title>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Text style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>{textUp}</Text>
      {isUp ? <RiseOutlined style={{ color: '#262626', fontSize: 14 }}/> : <FallOutlined style={{ color: '#262626', fontSize: 14 }} />}
    </div>
    
    <div>
      <Text type="secondary" style={{ fontSize: 13, color: '#8c8c8c' }}>{textDown}</Text>
    </div>
  </Card>
);

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('yearly');

  const getChartData = () => {
    switch(timeRange) {
      case '7days': return data7Days;
      case '30days': return data30Days;
      case 'yearly': default: return dataFullYear;
    }
  };

  const columns = [
    {
      title: 'Order',
      dataIndex: 'order',
      key: 'order',
      render: (text) => <Text strong style={{ color: '#1f1f1f' }}>{text}</Text>,
    },
    {
      title: 'Process',
      dataIndex: 'process',
      key: 'process',
      render: (process) => {
        let color = process === 'Cutting' ? 'processing' : process === 'Toughening' ? 'warning' : 'success';
        return <Tag color={color} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}><SettingOutlined style={{marginRight: 4}}/>{process}</Tag>;
      }
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      render: (text) => <Text>{text}</Text>,
    },
    {
      title: 'Dispatch',
      dataIndex: 'dispatch',
      key: 'dispatch',
      render: (text) => <Space><CarOutlined style={{color: '#8c8c8c'}}/><Text>{text}</Text></Space>,
    },
    {
      title: 'Assigned',
      dataIndex: 'assigned',
      key: 'assigned',
      render: (text) => <Space><UserOutlined style={{color: '#8c8c8c'}}/><Text>{text}</Text></Space>,
    },
  ];

  const tableData = [
    {
      key: '1',
      order: 'SO-1023 / Skyline Builders',
      process: 'Cutting',
      qty: '24 Sheets',
      dispatch: '12 May',
      assigned: 'Rajesh',
    },
    {
      key: '2',
      order: 'SO-1024 / Om Interiors',
      process: 'Toughening',
      qty: '10 Panels',
      dispatch: '13 May',
      assigned: 'Amit',
    },
    {
      key: '3',
      order: 'SO-1025 / GlassHub',
      process: 'Polishing',
      qty: '18 Sheets',
      dispatch: '14 May',
      assigned: 'Vikram',
    },
  ];

  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", width: '100%' }}>
      
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
          Admin Dashboard
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>Welcome back! Here's what's happening with Essar Glass today.</Text>
      </div>

      {/* 1) TOP KPI ROW */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Quotations Created" 
            value="156" 
            percentage="+12.5%" 
            isUp={true} 
            textUp="Trending up this month" 
            textDown="32 awaiting follow-up" 
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Active Workshop Jobs" 
            value="42" 
            percentage="-20%" 
            isUp={false} 
            textUp="Down 20% this period" 
            textDown="Cutting, polishing & fabrication" 
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Dispatch Ready Orders" 
            value="18" 
            percentage="+12.5%" 
            isUp={true} 
            textUp="Strong output retention" 
            textDown="5 Awaiting vehicle assignment" 
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Estimated Profit" 
            value="₹ 4.5L" 
            percentage="+4.5%" 
            isUp={true} 
            textUp="Steady performance" 
            textDown="As per  calculation on confirmed orders" 
          />
        </Col>
      </Row>

      {/* 2) Middle Section — Graph & Payments */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {/* Graph — Left Half */}
        <Col xs={24} lg={12}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Quotations Trend</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>Monthly performance</Text>
              </div>
              <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)} size="small">
                <Radio.Button value="yearly">Yearly</Radio.Button>
                <Radio.Button value="30days">Month</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="colorQuotations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="quotations" stroke="#10b981" strokeWidth={2} fill="url(#colorQuotations)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Payments — Right Half */}
        <Col xs={24} lg={12}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', height: '100%' }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ marginBottom: 20 }}>
              <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Payments</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Manage your payments</Text>
            </div>
            
            <Table 
              pagination={false}
              size="small"
              dataSource={
                (() => {
                  const read = (k) => JSON.parse(localStorage.getItem(k) || '[]');
                  const invs = read('invoices');
                  const custs = read('customers');
                  return invs.map(i => ({
                    key: i.id,
                    status: i.status || 'Success',
                    customer: custs.find(c => c.id === i.customer_id)?.name || 'Guest Customer',
                    amount: i.total_amount || 0
                  })).reverse().slice(0, 6);
                })()
              }
              columns={[
                { title: 'Status', dataIndex: 'status', render: s => <Tag color={s==='paid'||s==='Success'?'green':s==='pending'?'orange':'default'} style={{borderRadius: 6}}>{s?.toUpperCase()}</Tag> },
                { title: 'Customer', dataIndex: 'customer', render: c => <Text strong style={{fontSize: 13}}>{c}</Text> },
                { title: 'Amount', dataIndex: 'amount', align: 'right', render: a => <Text strong>₹{Number(a).toLocaleString('en-IN')}</Text> },
                { title: '', key: 'action', align: 'right', render: () => <Text type="secondary" style={{cursor: 'pointer'}}>•••</Text> }
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 3) Live Operational Tracking */}
      <Card 
        bordered={false} 
        style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#fff' }}>
          <div style={{ backgroundColor: '#fff2e8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FireFilled style={{ fontSize: 20, color: '#fa541c' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f' }}>Live Operational Tracking</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Real-time status of ongoing floor operations</Text>
          </div>
        </div>
        <div style={{ padding: '0' }}>
          <Table 
            columns={columns} 
            dataSource={tableData} 
            pagination={false}
            style={{ width: '100%' }}
            rowClassName={() => 'operational-tracking-row'}
          />
        </div>
      </Card>

      <style>{`
        .operational-tracking-row:hover > td {
          background-color: #fafafa !important;
        }
        .ant-table-thead > tr > th {
          background-color: #fafafa;
          color: #595959;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
          padding: 16px 24px !important;
        }
        .ant-table-tbody > tr > td {
          padding: 16px 24px !important;
          border-bottom: 1px solid #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
