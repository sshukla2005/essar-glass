import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useAuth } from '../../hooks/useAuth'

/**
 * ProtectedRoute
 * Note: requiredRole and module props are UX guards, not security boundaries —
 * the backend enforces backend role and module authorization.
 */
const ProtectedRoute = ({ children, requiredRole, module }) => {
  const navigate = useNavigate()
  const { user, token, hasPermission } = useAuth()

  if (!token || !user) return <Navigate to="/login" replace />

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Result
          status="403"
          title="You don't have access to this page"
          subTitle="Sorry, you are not authorized to access this page."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          }
        />
      </div>
    )
  }

  if (module && !hasPermission(module)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Result
          status="403"
          title="You don't have access to this module"
          subTitle={`Sorry, you do not have permission to access the '${module}' module.`}
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          }
        />
      </div>
    )
  }

  return children
}

export default ProtectedRoute
