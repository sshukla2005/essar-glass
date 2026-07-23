import React, { useState, useMemo, useEffect } from 'react'
import AIAssistant from '../AIAssistant'
import { Layout, Menu, Typography, Space, Avatar, App, Button, Select, Tag } from 'antd'
import {
  DashboardOutlined, AimOutlined, FunnelPlotOutlined, UnorderedListOutlined, NodeIndexOutlined,
  FileTextOutlined, ShoppingCartOutlined, DollarOutlined, AppstoreOutlined, ShoppingOutlined,
  EnvironmentOutlined, TeamOutlined, UserOutlined, ControlOutlined, PercentageOutlined,
  BarcodeOutlined, GroupOutlined, SettingOutlined, BankOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BuildOutlined, CarOutlined, RetweetOutlined,
  SwapOutlined, DownOutlined, LogoutOutlined, LayoutOutlined, DatabaseOutlined,
  UsergroupAddOutlined, ReconciliationOutlined, HistoryOutlined, CalculatorOutlined,
  ToolOutlined, FireOutlined
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <AppstoreOutlined />, label: 'Dashboard' },
  { key: 'grp_crm', icon: <TeamOutlined />, label: 'CRM', children: [
    { key: '/crm/pipeline', label: 'Pipeline' },
    { key: '/crm/leads', label: 'All Leads' },
    { key: '/crm/stages', label: 'Stages' },
  ]},
  { key: 'grp_sales', icon: <FileTextOutlined />, label: 'Sales', children: [
    { key: '/quotations', label: 'Quotations' },
    { key: '/sales-orders', label: 'Sales Orders' },
    { key: '/invoices', label: 'Invoices' },
  ]},
  { key: 'grp_purchase', icon: <ShoppingCartOutlined />, label: 'Purchase', children: [
    { key: '/purchase-orders', label: 'Purchase Orders' },
  ]},
  { key: 'grp_inventory', icon: <DatabaseOutlined />, label: 'Inventory', children: [
    { key: '/inventory/stock', label: 'Stock Overview' },
    { key: '/delivery-challans', label: 'Delivery Challans' },
    { key: '/inventory/movements', label: 'Stock Movements' },
  ]},
  { key: 'grp_workshop', icon: <ToolOutlined />, label: 'Workshop', children: [
    { key: '/workshop/orders', label: 'Workshop Orders' },
    { key: '/workshop/toughening', label: 'Toughening', icon: <FireOutlined /> },
  ]},
  { key: 'grp_masters', icon: <ReconciliationOutlined />, label: 'Masters', children: [
    { key: '/masters/customers', label: 'Customers' },
    { key: '/masters/vendors', label: 'Vendors' },
    { key: '/masters/products', label: 'Products' },
    { key: '/masters/employees', label: 'Employees' },
  ]},
  { key: 'grp_settings', icon: <SettingOutlined />, label: 'Settings', children: [
    { key: '/settings/company', label: 'Company' },
    { key: '/settings/payment-accounts', label: 'Payment Accounts', icon: '💳' },
    { key: '/settings/glass-calc', label: 'Glass Calc Settings', icon: <CalculatorOutlined /> },
    { key: '/settings/glass-rate-matrix', label: 'Glass Rate Matrix', icon: <CalculatorOutlined /> },
    { key: '/settings/glass-dropdowns', label: 'Glass Dropdowns', icon: <ControlOutlined /> },
    { key: '/settings/branches', label: 'Branches' },
    { key: '/settings/currencies', label: 'Currencies' },
    { key: '/settings/tax-groups', label: 'Tax Groups' },
    { key: '/settings/taxes', label: 'Taxes' },
    { key: '/settings/hsn-codes', label: 'HSN/SAC' },
    { key: '/settings/uom-categories', label: 'UoM Categories' },
    { key: '/settings/uoms', label: 'Units of Measure' },
    { key: '/settings/process-masters', label: 'Process Masters', icon: <ToolOutlined /> },
    { key: '/settings/uom-rates', label: 'UOM Rates', icon: '📐' },
  ]},
]

const AppLayout = () => {
  const { message } = App.useApp()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isSuperAdmin, activeCompanyId, setActiveCompany, logout } = useAuth()

  const companies = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('companies_master') || '[]')
    } catch { return [] }
  }, [])

  // ── Dynamic company logo ────────────────────────────────────────────────
  const [companyLogo, setCompanyLogo] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
      return u?.company?.logo || null
    } catch { return null }
  })

  useEffect(() => {
    const handler = (e) => setCompanyLogo(e.detail.logo)
    window.addEventListener('company-logo-updated', handler)
    return () => window.removeEventListener('company-logo-updated', handler)
  }, [])

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
    background: '#1a337e', // Vibrant royal blue from image
    boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column'
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Dynamic CSS styles injected directly into layout for rapid implementation */}
      <style>{`
        /* Sidebar Item Styling */
        .ant-menu-dark.ant-menu-dark:not(.ant-menu-horizontal) .ant-menu-item-selected {
          background-color: #111827 !important;
          color: white !important;
          border-radius: 12px;
          margin-bottom: 8px !important;
          position: relative;
        }
        
        .ant-menu-dark.ant-menu-dark:not(.ant-menu-horizontal) .ant-menu-item-selected::after {
          content: '';
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
        }

        .ant-menu-dark .ant-menu-item {
          height: 40px !important;
          line-height: 40px !important;
          margin: 2px 0 !important;
          font-weight: 500;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7) !important;
          transition: all 0.3s;
        }

        .ant-menu-dark .ant-menu-item:hover, 
        .ant-menu-dark .ant-menu-submenu-title:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          border-radius: 8px;
        }

        .ant-menu-dark .ant-menu-submenu-title {
          height: 40px !important;
          line-height: 40px !important;
          margin: 2px 0 !important;
          font-weight: 500;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .ant-menu { background: transparent !important; border: none !important; }
        .ant-layout-sider-children { display: flex; flex-direction: column; overflow: hidden; }
        .ant-menu-sub { background: rgba(0,0,0,0.1) !important; border-radius: 8px !important; margin: 4px 0 !important; }
        
        .ant-menu-submenu-arrow { color: rgba(255,255,255,0.4) !important; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
      
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={250}
        style={siderStyle}
      >
        <div style={{
          padding: '20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          {companyLogo ? (
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              overflow: 'hidden', flexShrink: 0,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img
                src={companyLogo}
                alt="Logo"
                style={{ width: '85%', height: '85%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div style={{
              width: 40, height: 40, background: '#fff', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0
            }}>
              <img src="/src/public/Essar-logo.webp" alt="Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
            </div>
          )}
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.1, letterSpacing: '0.5px' }}>ESSAR GLASS</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }}>CENTER EG</Text>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none' }}
          />
        </div>

        {/* Sidebar Footer - Compact Profile */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          marginTop: 'auto',
          background: 'rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar 
                style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12
                }}
                size={collapsed ? 28 : 32}
              >
                {user?.name?.charAt(0) || 'A'}
              </Avatar>
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 110 }}>
                  <Text style={{ color: '#fff', fontWeight: 600, fontSize: 12 }} ellipsis>{user?.name || 'Admin User'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>{user?.role?.toUpperCase() || 'ADMIN'}</Text>
                </div>
              )}
            </div>
            {!collapsed && (
              <Button 
                type="text" 
                icon={<LogoutOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }} />} 
                onClick={logout}
                style={{ padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            )}
          </div>
        </div>
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
            {isSuperAdmin && (
              <Space style={{ marginRight: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Viewing:</Text>
                <Select
                  size="small"
                  value={activeCompanyId || 'all'}
                  style={{ width: 160 }}
                  onChange={async (val) => {
                    const targetId = val === 'all' ? null : val
                    const ok = await setActiveCompany(targetId)
                    if (!ok) {
                      message.error('Failed to switch company — please try again.')
                    }
                    // queryClient.clear() inside setActiveCompany already causes
                    // React Query to re-fetch all lists; no page reload needed.
                  }}
                  options={[
                    { value: 'all', label: '🌐 All Companies' },
                    ...companies.map(c => ({
                      value: c.id,
                      label: `${c.short_name} — ${c.name}`
                    }))
                  ]}
                />
                <Button size="small" type="link" onClick={() => window.location.href = '/super-dashboard'}>Group Dashboard</Button>
              </Space>
            )}
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
      <AIAssistant />
    </Layout>
  )
}

export default AppLayout
