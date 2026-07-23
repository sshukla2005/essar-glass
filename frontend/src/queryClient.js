import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton QueryClient — exported from its own module so both App.jsx
 * (which wraps the tree in <QueryClientProvider>) and useAuth.js (which
 * calls queryClient.clear() after a company switch) can import it without
 * creating a circular dependency.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:              1,
      staleTime:          30_000,
      refetchOnWindowFocus: false,
    },
  },
})
