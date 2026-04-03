import { useState, useEffect } from 'react';
import api from '@/services/api';
import { Check, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

export default function TrialBalance() {
  const [data, setData] = useState(null);
  const [asOf, setAsOf] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = asOf ? { as_of: asOf } : {};
      const res = await api.get('/reports/trial-balance', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const groupByType = (accounts) => {
    const groups = { Assets: [], Liabilities: [], Equity: [], Revenue: [], Expenses: [] };
    for (const acc of accounts) {
      const code = acc.account_code;
      if (code.startsWith('1')) groups.Assets.push(acc);
      else if (code.startsWith('2')) groups.Liabilities.push(acc);
      else if (code.startsWith('3')) groups.Equity.push(acc);
      else if (code.startsWith('4')) groups.Revenue.push(acc);
      else if (code.startsWith('5')) groups.Expenses.push(acc);
    }
    return groups;
  };

  const groups = data ? groupByType(data.accounts) : {};

  return (
    <div className="space-y-6 animate-fade-in" data-testid="trial-balance-page">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="page-header">Trial Balance</h1>
          <p className="text-sm text-slate-500 mt-0.5">As of {asOf || 'all time'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="fin-input text-sm w-44" value={asOf} onChange={e => setAsOf(e.target.value)} placeholder="As of date" />
          <button onClick={fetchData} className="btn-primary" data-testid="run-report-btn">Run Report</button>
        </div>
      </div>

      {/* Balance indicator */}
      {data && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border text-sm ${data.is_balanced ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {data.is_balanced ? <Check size={16} /> : <X size={16} />}
          {data.is_balanced ? 'Accounts are balanced — Total DR = Total CR' : 'Accounts are NOT balanced. Please check journal entries.'}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account Name</th>
                <th className="text-right">Debit (₹)</th>
                <th className="text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([groupName, accounts]) => accounts.length > 0 && (
                <>
                  <tr key={groupName} style={{ background: 'rgba(30,41,59,0.6)' }}>
                    <td colSpan={4} style={{ fontFamily: 'IBM Plex Sans' }}>
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">{groupName}</span>
                    </td>
                  </tr>
                  {accounts.map(acc => (
                    <tr key={acc.account_code}>
                      <td className="font-mono text-indigo-300">{acc.account_code}</td>
                      <td style={{ fontFamily: 'IBM Plex Sans' }}>{acc.account_name}</td>
                      <td className="text-right amount-debit">{acc.debit > 0 ? fmt(acc.debit) : '—'}</td>
                      <td className="text-right amount-credit">{acc.credit > 0 ? fmt(acc.credit) : '—'}</td>
                    </tr>
                  ))}
                </>
              ))}
              {/* Totals */}
              <tr style={{ background: 'rgba(30,41,59,0.7)', borderTop: '1px solid rgba(99,102,241,0.3)' }}>
                <td colSpan={2} className="font-bold text-slate-100" style={{ fontFamily: 'IBM Plex Sans' }}>Grand Total</td>
                <td className="text-right font-bold font-mono" style={{ color: '#F43F5E' }}>{fmt(data?.total_debit)}</td>
                <td className="text-right font-bold font-mono" style={{ color: '#10B981' }}>{fmt(data?.total_credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
