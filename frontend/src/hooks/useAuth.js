import { authApi } from '../api'
import { queryClient } from '../queryClient'

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

  /**
   * Switch the active company for a superadmin.
   *
   * 1. Calls POST /auth/switch-company on the backend.
   * 2. Replaces the stored JWT with the new token (so every subsequent
   *    request carries the updated active_company_id in its claims).
   * 3. Mirrors active_company_id / active_company / is_read_only from the
   *    server response into localStorage — the server value is the source
   *    of truth, localStorage is just a cache.
   * 4. Calls queryClient.clear() so React Query discards all cached lists
   *    and re-fetches them under the new company scope.
   *
   * Returns true on success, false on failure (caller can show an error).
   */
  const setActiveCompany = async (companyId) => {
    if (!isSuperAdmin) return false

    try {
      const res = await authApi.switchCompany(companyId)
      const data = res.data

      // Replace the JWT — this is the key step.  The new token encodes
      // the updated active_company_id; all subsequent axios requests (via
      // the interceptor in axios.js) will automatically send it.
      localStorage.setItem('auth_token', data.access_token)

      // Mirror company-context fields from the server response.
      if (companyId != null) {
        localStorage.setItem('active_company_id', String(companyId))
      } else {
        localStorage.removeItem('active_company_id')
      }

      // Keep auth_user in sync with any extra fields the server echoes back
      if (data.active_company !== undefined) {
        try {
          const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
          localStorage.setItem('auth_user', JSON.stringify({
            ...u,
            active_company_id: data.active_company_id ?? companyId,
            active_company:    data.active_company,
            is_read_only:      data.is_read_only,
          }))
        } catch {}
      }

      // Bust the React Query cache so every list re-fetches for the new company.
      queryClient.clear()

      return true
    } catch (err) {
      console.error('Company switch failed:', err)
      // Do NOT mutate localStorage on failure — leave the current company intact.
      return false
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
