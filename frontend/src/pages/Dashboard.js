import { useState, useEffect } from 'react';
import api from '@/services/api';
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Link } from 'react-router-dom';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(11,15,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, margin: '2px 0', fontFamily: 'IBM Plex Mono' }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

function KpiCard({ label, value, icon: Icon, color, trend, trendLabel }) {
  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} strokeWidth={1.5} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-50 tabular-nums" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {trendLabel && <div className="text-xs text-slate-600 mt-0.5">{trendLabel}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/dashboard-kpis'),
      api.get('/transactions/insights'),
    ]).then(([kpiRes, insightRes]) => {
      setData(kpiRes.data);
      setInsights(insightRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const kpis = [
    { label: 'Total Revenue', value: fmt(data?.total_revenue), icon: TrendingUp, color: '#10B981' },
    { label: 'Total Expenses', value: fmt(data?.total_expenses), icon: TrendingDown, color: '#F43F5E' },
    { label: 'Net Profit', value: fmt(data?.net_profit), icon: DollarSign, color: '#6366F1', trend: data?.total_revenue ? Math.round((data.net_profit / data.total_revenue) * 100) : 0, trendLabel: 'of revenue' },
    { label: 'Cash Balance', value: fmt(data?.cash_balance), icon: Wallet, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Financial overview — Acme Technologies Pvt Ltd</p>
        </div>
        <Link to="/transactions" className="btn-secondary text-xs">
          View All Transactions <ArrowRight size={13} />
        </Link>
      </div>

      {/* Alerts */}
      {insights?.alerts?.length > 0 && (
        <div className="space-y-2">
          {insights.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border ${alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'}`}>
              {alert.type === 'warning' ? <AlertTriangle size={15} /> : <Info size={15} />}
              {alert.message}
              {alert.type === 'warning' && (
                <Link to="/transactions" className="ml-auto text-xs underline opacity-70 hover:opacity-100">Fix</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Expense */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>Revenue vs Expenses</h3>
            <span className="text-xs text-slate-500">Monthly</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.monthly_chart || []} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Stats */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-5" style={{ fontFamily: 'Work Sans, sans-serif' }}>Quick Stats</h3>
          <div className="space-y-4">
            {[
              { label: 'Total Transactions', value: data?.total_transactions, color: '#6366F1' },
              { label: 'Classified', value: data?.total_transactions - (insights?.unclassified_count || 0), color: '#10B981' },
              { label: 'Unclassified', value: insights?.unclassified_count || 0, color: '#F59E0B' },
              { label: 'Net Margin', value: data?.total_revenue ? `${Math.round((data.net_profit / data.total_revenue) * 100)}%` : '0%', color: '#6366F1' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-400">{s.label}</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono, monospace' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Narration</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_transactions || []).map((t, i) => (
                <tr key={i}>
                  <td>{t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                  <td style={{ fontFamily: 'IBM Plex Sans, sans-serif', maxWidth: 240 }} className="truncate">{t.narration}</td>
                  <td><span className="badge badge-indigo">{t.category || 'Unclassified'}</span></td>
                  <td className={`text-right ${t.type === 'credit' ? 'amount-credit' : 'amount-debit'}`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td><span className={`badge ${t.type === 'credit' ? 'badge-success' : 'badge-danger'}`}>{t.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
