import React, { useState } from 'react'
import { Layout, Menu, Typography, Space, Avatar, App, Button } from 'antd'
import {
  DashboardOutlined, AimOutlined, FunnelPlotOutlined, UnorderedListOutlined, NodeIndexOutlined,
  FileTextOutlined, ShoppingCartOutlined, DollarOutlined, AppstoreOutlined, ShoppingOutlined,
  EnvironmentOutlined, TeamOutlined, UserOutlined, ControlOutlined, PercentageOutlined,
  BarcodeOutlined, GroupOutlined, SettingOutlined, BankOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BuildOutlined, CarOutlined, RetweetOutlined
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { type: 'divider' },
  { key: 'grp_crm', label: <span style={{ color: '#8b5cf6', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>🎯 CRM</span>, type: 'group', children: [
    { key: '/crm/pipeline', icon: <FunnelPlotOutlined />, label: 'Pipeline' },
    { key: '/crm/leads', icon: <UnorderedListOutlined />, label: 'All Leads' },
    { key: '/crm/stages', icon: <NodeIndexOutlined />, label: 'Stages' },
  ]},
  { key: 'grp_sales', label: <span style={{ color: '#3b82f6', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>📄 Sales</span>, type: 'group', children: [
    { key: '/quotations', icon: <FileTextOutlined />, label: 'Quotations' },
    { key: '/sales-orders', icon: <ShoppingCartOutlined />, label: 'Sales Orders' },
    { key: '/invoices', icon: <DollarOutlined />, label: 'Invoices' },
  ]},
  { key: 'grp_purchase', label: <span style={{ color: '#f59e0b', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>🛒 Purchase</span>, type: 'group', children: [
    { key: '/purchase-orders', icon: <ShoppingOutlined />, label: 'Purchase Orders' },
  ]},
  { key: 'grp_inventory', label: <span style={{ color: '#10b981', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>🏪 Inventory</span>, type: 'group', children: [
    { key: '/inventory/stock', icon: <AppstoreOutlined />, label: 'Stock Overview' },
    { key: '/delivery-challans', icon: <CarOutlined />, label: 'Delivery Challans' },
    { key: '/inventory/movements', icon: <RetweetOutlined />, label: 'Stock Movements' },
  ]},
  { key: 'grp_masters', label: <span style={{ color: '#6366f1', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>👥 Masters</span>, type: 'group', children: [
    { key: '/masters/customers', icon: <TeamOutlined />, label: 'Customers' },
    { key: '/masters/vendors', icon: <ShoppingOutlined />, label: 'Vendors' },
    { key: '/masters/products', icon: <BuildOutlined />, label: 'Products' },
    { key: '/masters/employees', icon: <UserOutlined />, label: 'Employees' },
  ]},
  { key: 'settings', icon: <SettingOutlined />, label: '⚙️ Settings', children: [
    { key: '/settings/company', icon: <BankOutlined />, label: 'Company' },
    { key: '/settings/branches', icon: <EnvironmentOutlined />, label: 'Branches' },
    { key: '/settings/currencies', icon: <DollarOutlined />, label: 'Currencies' },
    { key: '/settings/tax-groups', icon: <PercentageOutlined />, label: 'Tax Groups' },
    { key: '/settings/taxes', icon: <PercentageOutlined />, label: 'Taxes' },
    { key: '/settings/hsn-codes', icon: <BarcodeOutlined />, label: 'HSN/SAC' },
    { key: '/settings/uom-categories', icon: <GroupOutlined />, label: 'UoM Categories' },
    { key: '/settings/uoms', icon: <ControlOutlined />, label: 'Units of Measure' },
  ]},
]

const AppLayout = () => {
  const { message } = App.useApp()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const handleMenuClick = ({ key }) => {
    if (key.startsWith('/')) navigate(key)
  }

  const selectedKey = location.pathname === '/' ? '/' : location.pathname

  const siderStyle = {
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0,
    zIndex: 100,
    overflow: 'auto',
    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
    boxShadow: '4px 0 10px rgba(0,0,0,0.1)'
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Dynamic CSS styles injected directly into layout for rapid implementation */}
      <style>{`
        .ant-menu-dark.ant-menu-dark:not(.ant-menu-horizontal) .ant-menu-item-selected {
          background-color: #6366f1 !important;
          color: white !important;
          border-radius: 6px;
        }
        .ant-menu-dark .ant-menu-item:hover, .ant-menu-dark .ant-menu-submenu-title:hover {
          background-color: rgba(99, 102, 241, 0.2) !important;
          color: white !important;
          border-left: 3px solid #6366f1;
          border-radius: 6px;
        }
        .ant-menu { background: transparent !important; }
        .ant-layout-sider-children { display: flex; flex-direction: column; }
      `}</style>
      
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={250}
        style={siderStyle}
      >
        <div style={{
          padding: '20px 16px',
          textAlign: 'center',
          background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {collapsed ? (
            <Avatar style={{ background: '#fff', color: '#4f46e5', fontWeight: 'bold' }} size={36}>EG</Avatar>
          ) : (
            <Space>
              <Avatar style={{ background: '#fff', color: '#4f46e5', fontWeight: 'bold' }} size={36}>EG</Avatar>
              <Text style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '0.5px' }}>ESSAR Glass</Text>
            </Space>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['settings']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s cubic-bezier(0.2, 0, 0, 1) 0s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 64
        }}>
          <Space>
            {collapsed
              ? <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer', color: '#64748b' }} />
              : <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer', color: '#64748b' }} />
            }
          </Space>
          <Space size="large">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ background: '#6366f1' }}>
                {user?.name?.charAt(0) || 'A'}
              </Avatar>
              <Text strong style={{ color: '#334155' }}>{user?.name || 'Admin'}</Text>
              <Button type="text" size="small" onClick={logout} danger>Logout</Button>
            </Space>
          </Space>
        </Header>

        <Content style={{ background: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
