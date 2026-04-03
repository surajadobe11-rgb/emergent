import { useState, useEffect } from 'react';
import api from '@/services/api';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

export default function Ledger() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    api.get('/journals/ledger/accounts').then(res => {
      setAccounts(res.data.accounts || []);
      if (res.data.accounts?.length > 0) setSelectedAccount(res.data.accounts[0].account_code);
    }).finally(() => setAccountsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoading(true);
    api.get(`/journals/ledger/${selectedAccount}`).then(res => {
      setLedgerData(res.data);
    }).finally(() => setLoading(false));
  }, [selectedAccount]);

  const selected = accounts.find(a => a.account_code === selectedAccount);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="ledger-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">Account-wise transaction statement</p>
        </div>
        <select
          className="fin-input w-72 text-sm"
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          data-testid="account-selector"
        >
          {accounts.map(a => (
            <option key={a.account_code} value={a.account_code}>
              {a.account_code} — {a.account_name}
            </option>
          ))}
        </select>
      </div>

      {/* Account Summary */}
      {selected && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Debits', value: fmt(selected.total_debit), color: '#F43F5E' },
            { label: 'Total Credits', value: fmt(selected.total_credit), color: '#10B981' },
            { label: 'Net Balance', value: fmt(ledgerData?.closing_balance), color: '#6366F1' },
          ].map(s => (
            <div key={s.label} className="kpi-card">
              <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">{s.label}</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ledger Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>
            {selected ? `${selectedAccount} — ${selected.account_name}` : 'Select an account'}
          </h3>
          {ledgerData && (
            <span className="text-xs text-slate-500">{ledgerData.entries?.length || 0} entries</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerData?.entries || []).map((e, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td style={{ fontFamily: 'IBM Plex Sans', maxWidth: 260 }} className="truncate">{e.description}</td>
                    <td className="font-mono text-indigo-300 text-xs">{e.reference || '—'}</td>
                    <td className="text-right">{e.debit > 0 ? <span className="amount-debit">{fmt(e.debit)}</span> : <span className="text-slate-700">—</span>}</td>
                    <td className="text-right">{e.credit > 0 ? <span className="amount-credit">{fmt(e.credit)}</span> : <span className="text-slate-700">—</span>}</td>
                    <td className={`text-right font-mono font-medium ${e.balance >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>{fmt(Math.abs(e.balance))}{e.balance < 0 ? ' Cr' : ' Dr'}</td>
                  </tr>
                ))}
                {(!ledgerData?.entries?.length) && (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-10" style={{ fontFamily: 'IBM Plex Sans' }}>No entries for this account</td></tr>
                )}
                {ledgerData?.entries?.length > 0 && (
                  <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                    <td colSpan={3} className="font-semibold text-slate-300" style={{ fontFamily: 'IBM Plex Sans' }}>Closing Balance</td>
                    <td colSpan={2}></td>
                    <td className="text-right font-bold font-mono" style={{ color: '#6366F1' }}>{fmt(Math.abs(ledgerData.closing_balance))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
