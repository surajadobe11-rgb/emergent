import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import {
  LayoutDashboard, ArrowLeftRight, BookOpen, BookMarked,
  Package, GitCompare, BarChart3, Settings, LogOut, ChevronDown,
  ChevronRight, Building2, Menu, Users, ChevronUp, Check, Receipt
} from 'lucide-react';

function navItems(role) {
  const items = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { label: 'Journals', path: '/journals', icon: BookOpen },
    { label: 'Ledger', path: '/ledger', icon: BookMarked },
    { label: 'Fixed Assets', path: '/assets', icon: Package },
    { label: 'Reconciliation', path: '/reconciliation', icon: GitCompare },
    {
      label: 'Reports',
      icon: BarChart3,
      children: [
        { label: 'Trial Balance', path: '/reports/trial-balance' },
        { label: 'Profit & Loss', path: '/reports/profit-loss' },
        { label: 'Balance Sheet', path: '/reports/balance-sheet' },
        { label: 'GST Reports', path: '/reports/gst' },
      ]
    },
  ];
  if (role === 'admin') {
    items.push({ label: 'Clients', path: '/clients', icon: Users });
  }
  items.push({ label: 'Settings', path: '/settings', icon: Settings });
  return items;
}

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const isAnyChildActive = item.children?.some(c => location.pathname === c.path);
  const [open, setOpen] = useState(isAnyChildActive);
  const isActive = item.path ? location.pathname === item.path : isAnyChildActive;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <item.icon size={18} strokeWidth={1.5} />
          {!collapsed && <span className="flex-1 text-left font-medium">{item.label}</span>}
          {!collapsed && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </button>
        {open && !collapsed && (
          <div className="ml-6 mt-1 space-y-0.5">
            {item.children.map(child => (
              <Link
                key={child.path}
                to={child.path}
                className={`block px-3 py-2 rounded-lg text-sm transition-all ${location.pathname === child.path ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'}`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
    >
      <item.icon size={18} strokeWidth={1.5} />
      {!collapsed && <span className="font-medium">{item.label}</span>}
    </Link>
  );
}

function ClientSwitcher({ collapsed }) {
  const { user, activeCompanyId, activeCompanyName, setActiveCompanyId } = useAuth();
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/clients').then(res => {
        setClients(res.data.clients || []);
        const active = (res.data.clients || []).find(c => c.id === activeCompanyId);
        if (active) setDisplayName(active.name);
        else if (activeCompanyName) setDisplayName(activeCompanyName);
      }).catch(() => {});
    }
  }, [user?.role, activeCompanyId, activeCompanyName]);

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const name = displayName || activeCompanyName || 'Acme Technologies';

  if (user.role !== 'admin' || collapsed) {
    return (
      <div className="px-4 py-3 border-b border-white/5">
        {!collapsed && (
          <>
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Company</div>
            <div className="text-xs text-slate-300 truncate">{name}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-white/5 relative" ref={ref}>
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-1.5 px-1">Active Client</div>
      <button
        onClick={() => setOpen(!open)}
        data-testid="client-switcher-btn"
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800/60 transition-all border border-white/8"
      >
        <Building2 size={12} className="text-indigo-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate font-medium">{name}</span>
        {open ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-white/10 overflow-hidden shadow-2xl" style={{ background: '#131828' }}>
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { setActiveCompanyId(c.id, c.name); setDisplayName(c.name); setOpen(false); }}
              data-testid={`switch-client-${c.id}`}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-slate-800/60 transition-all"
            >
              {c.id === activeCompanyId && <Check size={11} className="text-indigo-400 flex-shrink-0" />}
              {c.id !== activeCompanyId && <div className="w-[11px]" />}
              <span className={`truncate ${c.id === activeCompanyId ? 'text-indigo-300 font-semibold' : 'text-slate-300'}`}>{c.name}</span>
            </button>
          ))}
          {clients.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-500 text-center">No clients found</div>
          )}
          <div className="border-t border-white/8 px-3 py-2">
            <Link to="/clients" onClick={() => setOpen(false)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Manage clients →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const items = navItems(user?.role);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0B0F19' }}>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`sidebar fixed lg:relative z-40 h-full flex-shrink-0 flex flex-col transition-all duration-300
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Receipt size={16} color="white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate" style={{ fontFamily: 'Work Sans, sans-serif' }}>FinAI</div>
              <div className="text-xs text-slate-500 truncate">Accounting</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:block text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Client Switcher */}
        <ClientSwitcher collapsed={collapsed} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {items.map(item => (
            <NavItem key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-indigo-800 rounded-full flex items-center justify-center text-xs text-indigo-200 font-semibold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{user?.name}</div>
                <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} data-testid="logout-btn" className="text-slate-500 hover:text-slate-300 transition-colors">
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5" style={{ background: 'rgba(11,15,25,0.95)' }}>
          <button onClick={() => setMobileOpen(true)} className="text-slate-400">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>FinAI Accounting</span>
        </div>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
