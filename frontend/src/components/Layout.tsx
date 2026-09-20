import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/expenses', label: 'Gastos' },
  { to: '/categories', label: 'Categorías' },
  { to: '/cash-count', label: 'Contar efectivo' },
  { to: '/settings', label: 'Configuración' },
]

export function Layout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-slate-900">💰 Mis Gastos</span>
          <button
            onClick={() => logout()}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
