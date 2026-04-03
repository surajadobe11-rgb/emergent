import { useState, useEffect } from 'react';
import api from '@/services/api';
import { TrendingUp, TrendingDown, FileText, Download } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

async function triggerDownload(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function ExportButtons({ fromDate, toDate }) {
  const [loading, setLoading] = useState('');
  const handleExport = async (format) => {
    setLoading(format);
    try {
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      await triggerDownload('/export/profit-loss', { from_date: fromDate, to_date: toDate, format }, `profit_loss.${ext}`);
    } catch { alert('Export failed'); } finally { setLoading(''); }
  };
  return (
    <div className="flex gap-2">
      <button onClick={() => handleExport('pdf')} disabled={!!loading} className="btn-secondary text-xs py-1.5 px-3" data-testid="export-pl-pdf">
        {loading === 'pdf' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FileText size={12} /> PDF</>}
      </button>
      <button onClick={() => handleExport('excel')} disabled={!!loading} className="btn-secondary text-xs py-1.5 px-3" data-testid="export-pl-excel">
        {loading === 'excel' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download size={12} /> Excel</>}
      </button>
    </div>
  );
}

export default function ProfitLoss() {
  const [data, setData] = useState(null);
  const [fromDate, setFromDate] = useState('2024-01-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/profit-loss', { params: { from_date: fromDate, to_date: toDate } });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="profit-loss-page">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="page-header">Profit & Loss Statement</h1>
          <p className="text-sm text-slate-500 mt-0.5">{fromDate} to {toDate}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtons fromDate={fromDate} toDate={toDate} />
          <input type="date" className="fin-input text-sm w-40" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span className="text-slate-500">to</span>
          <input type="date" className="fin-input text-sm w-40" value={toDate} onChange={e => setToDate(e.target.value)} />
          <button onClick={fetchData} className="btn-primary" data-testid="generate-pl-btn">Generate</button>
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue', value: fmt(data.total_revenue), icon: TrendingUp, color: '#10B981' },
            { label: 'Total Expenses', value: fmt(data.total_expenses), icon: TrendingDown, color: '#F43F5E' },
            {
              label: 'Net Profit / (Loss)', value: fmt(data.net_profit),
              icon: data.net_profit >= 0 ? TrendingUp : TrendingDown,
              color: data.net_profit >= 0 ? '#6366F1' : '#F43F5E'
            },
          ].map(s => (
            <div key={s.label} className="kpi-card">
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={16} style={{ color: s.color }} strokeWidth={1.5} />
                <span className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</span>
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && (
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5" style={{ background: 'rgba(16,185,129,0.08)' }}>
              <h3 className="text-sm font-semibold text-emerald-400" style={{ fontFamily: 'Work Sans, sans-serif' }}>Revenue</h3>
            </div>
            <table className="fin-table">
              <tbody>
                {data.revenue.map(r => (
                  <tr key={r.account_code}>
                    <td className="font-mono text-indigo-300 text-xs w-16">{r.account_code}</td>
                    <td style={{ fontFamily: 'IBM Plex Sans' }}>{r.account_name}</td>
                    <td className="text-right amount-credit font-mono">{fmt(r.amount)}</td>
                  </tr>
                ))}
                {data.revenue.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">No revenue recorded</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                  <td colSpan={2} className="font-bold text-emerald-400" style={{ fontFamily: 'IBM Plex Sans' }}>Total Revenue</td>
                  <td className="text-right font-bold font-mono text-emerald-400">{fmt(data.total_revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expenses */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5" style={{ background: 'rgba(244,63,94,0.08)' }}>
              <h3 className="text-sm font-semibold text-rose-400" style={{ fontFamily: 'Work Sans, sans-serif' }}>Expenses</h3>
            </div>
            <table className="fin-table">
              <tbody>
                {data.expenses.map(e => (
                  <tr key={e.account_code}>
                    <td className="font-mono text-indigo-300 text-xs w-16">{e.account_code}</td>
                    <td style={{ fontFamily: 'IBM Plex Sans' }}>{e.account_name}</td>
                    <td className="text-right amount-debit font-mono">{fmt(e.amount)}</td>
                  </tr>
                ))}
                {data.expenses.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">No expenses recorded</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(244,63,94,0.08)', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
                  <td colSpan={2} className="font-bold text-rose-400" style={{ fontFamily: 'IBM Plex Sans' }}>Total Expenses</td>
                  <td className="text-right font-bold font-mono text-rose-400">{fmt(data.total_expenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Net Profit line */}
      {data && (
        <div className={`px-6 py-5 rounded-2xl border ${data.net_profit >= 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Net {data.net_profit >= 0 ? 'Profit' : 'Loss'}</p>
              <p className="text-xs text-slate-500">{fromDate} to {toDate}</p>
            </div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: data.net_profit >= 0 ? '#6366F1' : '#F43F5E', fontFamily: 'IBM Plex Mono' }}>
              {data.net_profit < 0 ? '(' : ''}{fmt(Math.abs(data.net_profit))}{data.net_profit < 0 ? ')' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
