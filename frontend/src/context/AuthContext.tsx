import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous'
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  useEffect(() => {
    api
      .get('/auth/me')
      .then(() => setStatus('authenticated'))
      .catch(() => setStatus('anonymous'))
  }, [])

  const login = useCallback(async (password: string) => {
    try {
      await api.post('/auth/login', { password })
      setStatus('authenticated')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw new Error('Contraseña incorrecta')
      }
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setStatus('anonymous')
  }, [])

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
