import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { Categories } from './pages/Categories'
import { Settings } from './pages/Settings'
import { CashCount } from './pages/CashCount'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Cargando…</div>
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { status } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={status === 'authenticated' ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/cash-count" element={<CashCount />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
