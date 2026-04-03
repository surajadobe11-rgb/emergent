# PRD — FinAI AI-Powered Accounting Platform

## Problem Statement
Build a full-stack AI-powered accounting software platform with React frontend and FastAPI/MongoDB backend. Includes AI-driven transaction classification, double-entry bookkeeping, asset management, bank reconciliation, and financial reporting.

## Architecture
- **Backend**: Python FastAPI + MongoDB (Motor async)
- **Frontend**: React 19 + shadcn/ui + Recharts + Framer Motion
- **Auth**: JWT Bearer tokens (localStorage), bcrypt hashing, RBAC (admin/accountant/viewer)
- **AI Engine**: Rule-based keyword classification for transactions
- **Currency**: INR (₹) throughout
- **Design**: Dark slate/indigo glassmorphism theme

## User Personas
- **Admin**: Full access (company owner, creates users)
- **Accountant**: Can create transactions, journals, assets
- **Viewer**: Read-only access

## Core Requirements (Static)
1. Secure JWT auth with RBAC
2. Transaction management with CSV upload and AI classification
3. Double-entry journal entries with D=C validation
4. Ledger account statements
5. Fixed asset register with SLM/WDV depreciation
6. Bank reconciliation (auto + manual matching)
7. Financial reports: Trial Balance, P&L, Balance Sheet
8. Settings: Company, Users, Chart of Accounts

## What's Been Implemented (2025-04-03)
- **Auth**: Login, register, JWT, logout, RBAC middleware
- **Seed Data**: 24 transactions, 7 journal entries, 3 fixed assets, 20 COA accounts, 2 users
- **Transactions**: Paginated list, search/filter, CSV upload, AI classify all, manual classify
- **Journals**: List with expandable lines, create with D=C validation
- **Ledger**: Account selector, running balance table
- **Fixed Assets**: Register with SLM/WDV, add modal, depreciate button
- **Reconciliation**: Bank vs book panels, auto-match, manual confirm
- **Reports**: Trial Balance, Profit & Loss (by period), Balance Sheet
- **Dashboard**: KPI cards, monthly bar chart, recent transactions, health alerts
- **Settings**: Company info, user management, chart of accounts

## Backend Files
- server.py, auth_utils.py, ai_engine.py, seed.py
- routes/: auth_routes.py, transactions.py, journals.py, assets.py, reconciliation.py, reports.py, settings.py

## Frontend Files
- src/App.js (routing), contexts/AuthContext.js, services/api.js
- components/Layout.js (sidebar)
- pages/: Login, Dashboard, Transactions, Journals, Ledger, Assets, Reconciliation, Settings
- pages/reports/: TrialBalance, ProfitLoss, BalanceSheet

## Prioritized Backlog
### P0 (Critical — now done)
- [x] Auth system
- [x] Transactions + AI classification
- [x] Journal entries
- [x] Financial reports

### P1 (High value — next sprint)
- [ ] PDF export for reports
- [ ] Multi-currency support
- [ ] GST filing reports (GSTR-1, GSTR-3B format)
- [ ] Audit log viewer page
- [ ] Password reset flow

### P2 (Nice to have)
- [ ] Email notifications for important events
- [ ] Dark/light theme toggle
- [ ] Chart of accounts import via CSV
- [ ] Bulk journal entry approval workflow
- [ ] API for external integrations

## Test Credentials
See /app/memory/test_credentials.md

## Next Tasks
1. Add PDF export to reports
2. Build audit log viewer
3. Add multi-currency (if needed)
4. Performance optimization for large datasets
