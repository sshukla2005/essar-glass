import React, { useState } from 'react'
import { Layout, Menu, Typography, Space, Avatar } from 'antd'
import {
  DashboardOutlined, TeamOutlined, ShoppingOutlined,
  AppstoreOutlined, UserOutlined, ControlOutlined,
  PercentageOutlined, BarcodeOutlined, SettingOutlined,
  BankOutlined, EnvironmentOutlined, DollarOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BuildOutlined,
  GroupOutlined, AimOutlined, FileTextOutlined,
  FunnelPlotOutlined, UnorderedListOutlined, NodeIndexOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'crm',
    icon: <AimOutlined />,
    label: 'CRM',
    children: [
      { key: '/crm/pipeline', icon: <FunnelPlotOutlined />, label: 'Pipeline' },
      { key: '/crm/leads',    icon: <UnorderedListOutlined />, label: 'All Leads' },
      { key: '/crm/stages',   icon: <NodeIndexOutlined />, label: 'Stages Config' },
    ],
  },
  {
    key: '/quotations',
    icon: <FileTextOutlined />,
    label: 'Quotations',
  },
  {
    key: 'masters',
    icon: <AppstoreOutlined />,
    label: 'Masters',
    children: [
      { key: '/masters/customers',   icon: <TeamOutlined />,        label: 'Customers' },
      { key: '/masters/vendors',     icon: <ShoppingOutlined />,    label: 'Vendors' },
      { key: '/masters/products',    icon: <BuildOutlined />,       label: 'Products' },
      { key: '/masters/employees',   icon: <UserOutlined />,        label: 'Employees' },
      { key: '/masters/uoms',        icon: <ControlOutlined />,     label: 'UoM' },
      { key: '/masters/taxes',       icon: <PercentageOutlined />,  label: 'Taxes' },
      { key: '/masters/hsn-codes',   icon: <BarcodeOutlined />,     label: 'HSN / SAC Codes' },
    ],
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Settings',
    children: [
      { key: '/settings/company',         icon: <BankOutlined />,        label: 'Company' },
      { key: '/settings/branches',        icon: <EnvironmentOutlined />, label: 'Branches' },
      { key: '/settings/currencies',      icon: <DollarOutlined />,      label: 'Currencies' },
      { key: '/settings/tax-groups',      icon: <PercentageOutlined />,  label: 'Tax Groups' },
      { key: '/settings/uom-categories',  icon: <GroupOutlined />,       label: 'UoM Categories' },
    ],
  },
]

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleMenuClick = ({ key }) => {
    if (key.startsWith('/')) navigate(key)
  }

  // Determine selected key based on current path
  const selectedKey = location.pathname === '/' ? '/' : location.pathname

  // Determine which sub-menus should be open
  const getOpenKeys = () => {
    if (location.pathname.startsWith('/crm'))      return ['crm']
    if (location.pathname.startsWith('/masters'))   return ['masters']
    if (location.pathname.startsWith('/settings'))  return ['settings']
    return []
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
        style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100, overflow: 'auto' }}
      >
        {/* Logo */}
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {collapsed ? (
            <Avatar style={{ background: '#1677ff' }} size={36}>E</Avatar>
          ) : (
            <Space>
              <Avatar style={{ background: '#1677ff' }} size={32}>E</Avatar>
              <Text style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>ESSAR Glass Mfg</Text>
            </Space>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['crm', 'masters', 'settings']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* ── Main Area ──────────────────────────────────────────────────── */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          <Space>
            {collapsed
              ? <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
              : <MenuFoldOutlined   onClick={() => setCollapsed(true)}  style={{ fontSize: 18, cursor: 'pointer' }} />
            }
          </Space>
          <Space>
            <Avatar style={{ background: '#1677ff' }}>A</Avatar>
            <Text>Admin</Text>
          </Space>
        </Header>

        <Content style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
