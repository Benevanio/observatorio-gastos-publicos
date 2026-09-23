import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Database, FileText, FileCheck,
  Users, CreditCard, BarChart3, AlertTriangle, GitCompare,
  Upload, FileBarChart, ScrollText, Menu, X, Moon, Sun, Search,
} from 'lucide-react';
import { cn } from '../utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/municipalities', icon: Building2, label: 'Municípios' },
  { to: '/collections', icon: Database, label: 'Coletas' },
  { to: '/procurements', icon: FileText, label: 'Licitações' },
  { to: '/contracts', icon: FileCheck, label: 'Contratos' },
  { to: '/suppliers', icon: Users, label: 'Fornecedores' },
  { to: '/payments', icon: CreditCard, label: 'Pagamentos' },
  { to: '/analytics', icon: BarChart3, label: 'Análises' },
  { to: '/findings', icon: AlertTriangle, label: 'Achados' },
  { to: '/comparison', icon: GitCompare, label: 'Comparação' },
  { to: '/imports', icon: Upload, label: 'Importações' },
  { to: '/reports', icon: FileBarChart, label: 'Relatórios' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState('');

  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={cn('min-h-screen flex', dark && 'dark')}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-brand-800 dark:text-brand-300 leading-tight">Observatório</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Gastos Públicos</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
            v1.0.0 · Dados públicos
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-400" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    window.location.href = `/procurements?search=${encodeURIComponent(search.trim())}`;
                  }
                }}
                placeholder="Buscar fornecedor, processo, contrato..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
