export const useAuth = () => {
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
  const token = localStorage.getItem('auth_token')
  const isLoggedIn = !!(user && token)
  
  const logout = () => {
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
  }
  
  return { user, isLoggedIn, logout }
}
