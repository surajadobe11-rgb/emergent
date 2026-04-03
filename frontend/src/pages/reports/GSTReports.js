import { useState, useEffect } from 'react';
import api from '@/services/api';
import { FileText, Download, RefreshCw, Receipt, TrendingUp } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const GST_RATES = [0, 5, 12, 18, 28];

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

function ExportButtons({ endpoint, params, baseName }) {
  const [loading, setLoading] = useState('');
  const handleExport = async (fmt) => {
    setLoading(fmt);
    try {
      await triggerDownload(endpoint, { ...params, format: fmt }, `${baseName}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
    } catch (e) {
      alert('Export failed. Please try again.');
    } finally {
      setLoading('');
    }
  };
  return (
    <div className="flex gap-2">
      <button onClick={() => handleExport('pdf')} disabled={!!loading} className="btn-secondary text-xs py-1.5 px-3" data-testid={`export-pdf-${baseName}`}>
        {loading === 'pdf' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FileText size={12} /> PDF</>}
      </button>
      <button onClick={() => handleExport('excel')} disabled={!!loading} className="btn-secondary text-xs py-1.5 px-3" data-testid={`export-excel-${baseName}`}>
        {loading === 'excel' ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download size={12} /> Excel</>}
      </button>
    </div>
  );
}

function GSTR1Tab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = period ? { period } : {};
      const res = await api.get('/gst/gstr1', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Company & GSTIN banner */}
      {data.gstin && (
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl border border-indigo-500/20 bg-indigo-500/8 text-sm">
          <Receipt size={16} className="text-indigo-400" />
          <span className="text-slate-400">{data.company_name}</span>
          <span className="font-mono text-indigo-300">GSTIN: {data.gstin}</span>
          <span className="ml-auto text-slate-500">Period: {data.period}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Taxable Value', value: fmt(data.summary.total_taxable), color: '#6366F1' },
          { label: 'CGST', value: fmt(data.summary.total_cgst), color: '#F59E0B' },
          { label: 'SGST', value: fmt(data.summary.total_sgst), color: '#F59E0B' },
          { label: 'Total Tax', value: fmt(data.summary.total_tax), color: '#10B981' },
        ].map(s => (
          <div key={s.label} className="kpi-card">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* B2B Supplies table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>B2B Outward Supplies</h3>
            <p className="text-xs text-slate-500 mt-0.5">{data.b2b_supplies.length} transactions</p>
          </div>
          <ExportButtons endpoint="/export/gstr1" params={period ? { period } : {}} baseName={`GSTR1_${period || 'all'}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="text-right">Taxable Value</th>
                <th className="text-center">GST %</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">Gross</th>
              </tr>
            </thead>
            <tbody>
              {data.b2b_supplies.map((t, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-xs">{t.date}</td>
                  <td className="truncate max-w-xs text-xs" style={{ fontFamily: 'IBM Plex Sans' }}>{t.narration}</td>
                  <td><span className="badge badge-indigo text-xs">{t.category || '—'}</span></td>
                  <td className="text-right font-mono text-xs">{fmtNum(t.taxable_value)}</td>
                  <td className="text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">{t.gst_rate}%</span>
                  </td>
                  <td className="text-right font-mono text-xs text-amber-300">{fmtNum(t.cgst)}</td>
                  <td className="text-right font-mono text-xs text-amber-300">{fmtNum(t.sgst)}</td>
                  <td className="text-right font-mono text-xs amount-credit">{fmtNum(t.gross_amount)}</td>
                </tr>
              ))}
              {data.b2b_supplies.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-8 text-sm">No revenue transactions found for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GSTR3BTab({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = period ? { period } : {};
      const res = await api.get('/gst/gstr3b', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const netColor = data.net_tax_liability >= 0 ? '#F43F5E' : '#10B981';

  return (
    <div className="space-y-4">
      {/* Net Tax Liability banner */}
      <div className={`px-5 py-4 rounded-xl border ${data.net_tax_liability >= 0 ? 'border-red-500/30 bg-red-500/8' : 'border-emerald-500/30 bg-emerald-500/8'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Net Tax Liability</p>
            <p className="text-xs text-slate-500">Period: {data.period}</p>
          </div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: netColor, fontFamily: 'IBM Plex Mono' }}>
            {fmt(Math.abs(data.net_tax_liability))}
            {data.net_tax_liability < 0 && <span className="text-sm ml-2 text-emerald-400">(Refundable)</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Table 3.1 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 bg-rose-500/5">
            <h3 className="text-sm font-semibold text-rose-400" style={{ fontFamily: 'Work Sans, sans-serif' }}>{data.table_31.title}</h3>
          </div>
          <table className="fin-table">
            <tbody>
              {[
                { label: 'Taxable Value', value: fmt(data.table_31.taxable_value) },
                { label: 'IGST', value: fmt(data.table_31.igst) },
                { label: 'CGST', value: fmt(data.table_31.cgst) },
                { label: 'SGST', value: fmt(data.table_31.sgst) },
              ].map(row => (
                <tr key={row.label}>
                  <td className="text-slate-400 text-sm">{row.label}</td>
                  <td className="text-right font-mono text-sm text-slate-200">{row.value}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(244,63,94,0.08)', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
                <td className="font-bold text-rose-400 text-sm">Total Tax</td>
                <td className="text-right font-bold font-mono text-rose-400 text-sm">{fmt(data.table_31.total_tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 4 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 bg-emerald-500/5">
            <h3 className="text-sm font-semibold text-emerald-400" style={{ fontFamily: 'Work Sans, sans-serif' }}>{data.table_4.title}</h3>
          </div>
          <table className="fin-table">
            <tbody>
              {[
                { label: 'Taxable Base', value: fmt(data.table_4.taxable_base) },
                { label: 'IGST', value: fmt(data.table_4.igst) },
                { label: 'CGST', value: fmt(data.table_4.cgst) },
                { label: 'SGST', value: fmt(data.table_4.sgst) },
              ].map(row => (
                <tr key={row.label}>
                  <td className="text-slate-400 text-sm">{row.label}</td>
                  <td className="text-right font-mono text-sm text-slate-200">{row.value}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                <td className="font-bold text-emerald-400 text-sm">Total ITC</td>
                <td className="text-right font-bold font-mono text-emerald-400 text-sm">{fmt(data.table_4.total_itc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="px-5 py-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <p className="text-xs font-semibold text-amber-400 mb-2">Disclaimer</p>
        {data.notes.map((n, i) => <p key={i} className="text-xs text-slate-500">{n}</p>)}
      </div>
    </div>
  );
}

export default function GSTReports() {
  const [activeTab, setActiveTab] = useState('gstr1');
  const [period, setPeriod] = useState('');
  const [inputPeriod, setInputPeriod] = useState('');

  const handleApplyPeriod = () => setPeriod(inputPeriod);

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="gst-reports-page">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="page-header">GST Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">GSTR-1 Outward Supplies · GSTR-3B Monthly Return</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            className="fin-input text-sm w-44"
            value={inputPeriod}
            onChange={e => setInputPeriod(e.target.value)}
            max={currentMonth}
            data-testid="gst-period-input"
          />
          <button onClick={handleApplyPeriod} className="btn-primary" data-testid="apply-period-btn">
            <RefreshCw size={13} /> Apply
          </button>
          {period && (
            <button onClick={() => { setPeriod(''); setInputPeriod(''); }} className="btn-secondary text-xs py-2">
              All Time
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-white/8 w-fit" style={{ background: 'rgba(15,20,35,0.6)' }}>
        {[
          { key: 'gstr1', label: 'GSTR-1', icon: TrendingUp },
          { key: 'gstr3b', label: 'GSTR-3B', icon: Receipt },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'gstr1' && <GSTR1Tab period={period} />}
      {activeTab === 'gstr3b' && <GSTR3BTab period={period} />}
    </div>
  );
}
