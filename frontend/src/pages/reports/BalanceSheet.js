import { useState, useEffect } from 'react';
import api from '@/services/api';
import { Check, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

function Section({ title, items, total, color }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5" style={{ background: `${color}12` }}>
        <h3 className="text-sm font-semibold" style={{ color, fontFamily: 'Work Sans, sans-serif' }}>{title}</h3>
      </div>
      <table className="fin-table">
        <tbody>
          {items.map(item => (
            <tr key={item.account_code}>
              <td className="font-mono text-indigo-300 text-xs w-16">{item.account_code}</td>
              <td style={{ fontFamily: 'IBM Plex Sans' }}>{item.account_name}</td>
              <td className="text-right font-mono" style={{ color: item.balance >= 0 ? '#CBD5E1' : '#F43F5E' }}>{fmt(Math.abs(item.balance))}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">No entries</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: `${color}12`, borderTop: `1px solid ${color}30` }}>
            <td colSpan={2} className="font-bold" style={{ color, fontFamily: 'IBM Plex Sans' }}>Total {title}</td>
            <td className="text-right font-bold font-mono" style={{ color }}>{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function BalanceSheet() {
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/balance-sheet', { params: { as_of: asOf } });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="balance-sheet-page">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="page-header">Balance Sheet</h1>
          <p className="text-sm text-slate-500 mt-0.5">As of {asOf}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="fin-input text-sm w-44" value={asOf} onChange={e => setAsOf(e.target.value)} />
          <button onClick={fetchData} className="btn-primary" data-testid="generate-bs-btn">Generate</button>
        </div>
      </div>

      {/* Balance check */}
      {data && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border text-sm ${data.is_balanced ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
          {data.is_balanced ? <Check size={16} /> : <X size={16} />}
          {data.is_balanced ? 'Balance Sheet is balanced — Assets = Liabilities + Equity' : 'Balance Sheet may not be fully balanced — ensure all entries are journalized'}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && (
        <div className="space-y-4">
          {/* Assets vs Liabilities+Equity in two columns */}
          <div className="grid grid-cols-2 gap-4">
            <Section title="Assets" items={data.assets} total={data.total_assets} color="#6366F1" />
            <div className="space-y-4">
              <Section title="Liabilities" items={data.liabilities} total={data.total_liabilities} color="#F43F5E" />
              <Section
                title="Equity"
                items={[...data.equity, { account_code: 'NET', account_name: 'Net Profit / (Loss)', balance: data.net_profit }]}
                total={data.total_equity}
                color="#10B981"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Assets', value: fmt(data.total_assets), color: '#6366F1' },
              { label: 'Total Liabilities + Equity', value: fmt(data.total_liabilities + data.total_equity), color: '#10B981' },
              { label: 'Net Profit', value: fmt(data.net_profit), color: data.net_profit >= 0 ? '#10B981' : '#F43F5E' },
            ].map(s => (
              <div key={s.label} className="kpi-card">
                <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">{s.label}</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
