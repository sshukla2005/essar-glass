import { useNavigate } from 'react-router-dom'

const useAuth = () => {
  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || 'null')
    } catch { return null }
  }

  const user       = getUser()
  const token      = localStorage.getItem('auth_token')
  const isLoggedIn = !!(user && token)
  const isSuperAdmin = user?.role === 'superadmin'

  const getActiveCompany = () => {
    if (isSuperAdmin) {
      const stored = localStorage.getItem('active_company_id')
      return stored ? parseInt(stored) : null
    }
    return user?.company_id || null
  }

  const setActiveCompany = (companyId) => {
    if (isSuperAdmin) {
      localStorage.setItem('active_company_id', companyId || '')
    }
  }

  const hasPermission = (module) => {
    if (!user) return false
    if (user.role === 'superadmin' || user.role === 'admin') return true
    return user.permissions?.includes(module) || false
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_company_id')
    window.location.href = '/login'
  }

  return {
    user,
    token,
    isLoggedIn,
    isSuperAdmin,
    activeCompanyId: getActiveCompany(),
    setActiveCompany,
    hasPermission,
    logout,
  }
}

export { useAuth }
export default useAuth
