# PRD — FinAI AI-Powered Accounting Platform

## Problem Statement
Build a full-stack AI-powered accounting software platform with React frontend and FastAPI/MongoDB backend. Includes AI-driven transaction classification, double-entry bookkeeping, asset management, bank reconciliation, financial reporting, multi-client profiles, and Indian GST compliance.

## Architecture
- **Backend**: Python FastAPI + MongoDB (Motor async)
- **Frontend**: React 19 + shadcn/ui + Recharts + Framer Motion
- **Auth**: JWT Bearer tokens (localStorage), bcrypt hashing, RBAC (admin/accountant/viewer)
- **AI Engine**: Rule-based keyword classification for transactions
- **Currency**: INR (₹) throughout
- **Design**: Dark slate/indigo glassmorphism theme
- **Multi-tenancy**: `company_id` scoped across all collections, admin client switching via `X-Company-ID` header

## User Personas
- **Admin**: Full access — manages clients, users, all data for any company
- **Accountant**: Can create transactions, journals, assets for assigned company
- **Viewer**: Read-only access — no upload, classify, or create buttons visible

## Core Requirements (Implemented)
1. Secure JWT auth with RBAC (admin/accountant/viewer)
2. Transaction management with CSV/Excel/PDF upload and AI classification
3. Double-entry journal entries with D=C validation
4. Ledger account statements
5. Fixed asset register with SLM/WDV depreciation
6. Bank reconciliation (auto + manual matching)
7. Financial reports: Trial Balance, P&L, Balance Sheet
8. Export reports to PDF (fpdf2) and Excel (openpyxl)
9. GST Reports: GSTR-1 (outward supplies) and GSTR-3B (monthly return)
10. Per-transaction GST rate tagging (0%, 5%, 12%, 18%, 28%)
11. Multi-client profiles with admin client switcher dropdown in sidebar
12. Settings: Company, Users, Chart of Accounts

## What's Been Implemented

### Phase 1 (2025-04-03)
- Auth: Login, register, JWT, logout, RBAC middleware
- Seed Data: 24 transactions, 7 journal entries, 3 fixed assets, 20 COA accounts, 2 users
- Transactions: Paginated list, search/filter, CSV/Excel/PDF upload, AI classify all, manual classify
- Journals: List with expandable lines, create with D=C validation
- Ledger: Account selector, running balance table
- Fixed Assets: Register with SLM/WDV, add modal, depreciate button
- Reconciliation: Bank vs book panels, auto-match, manual confirm
- Reports: Trial Balance, Profit & Loss (by period), Balance Sheet
- Dashboard: KPI cards, monthly bar chart, recent transactions, health alerts
- Settings: Company info, user management, chart of accounts

### Phase 2 (2026-04-03)
- **Multi-Client Profiles**: Client CRUD (admin-only), company_id scoping across all collections
- **Client Switcher**: Dropdown in sidebar navbar for admins to switch between companies
- **Export Reports**: PDF and Excel download for Trial Balance, P&L, Balance Sheet, GSTR-1
- **GST Reports**: GSTR-1 (outward supplies with per-tx rates), GSTR-3B (3.1 + Table 4)
- **Per-transaction GST rates**: Classify modal now has GST rate dropdown (0/5/12/18/28%)
- **RBAC on Frontend**: Viewers cannot see upload/classify (Transactions), create (Journals, Assets)
- **Admin-only routes**: Clients page only accessible to admins (protected route in App.js)

## Backend Files
- server.py, auth_utils.py, ai_engine.py, seed.py, export_utils.py
- routes/: auth_routes.py, transactions.py, journals.py, assets.py, reconciliation.py, reports.py, settings.py, clients.py, export_routes.py, gst.py

## Frontend Files
- src/App.js (routing with adminOnly protection), contexts/AuthContext.js (activeCompanyId), services/api.js (X-Company-ID header)
- components/Layout.js (sidebar with ClientSwitcher component)
- pages/: Login, Dashboard, Transactions (RBAC), Journals (RBAC), Ledger, Assets (RBAC), Reconciliation, Settings, Clients (admin-only)
- pages/reports/: TrialBalance (export), ProfitLoss (export), BalanceSheet (export), GSTReports

## DB Schema
- users: `{email, password_hash, role, name, company_id, created_at}`
- companies: `{id, name, gst_number, address, email, phone, currency, created_at}`
- transactions: `{date, narration, amount, type, category, account_code, account_name, confidence, status, company_id, gst_rate (optional)}`
- journal_entries: `{date, description, reference, lines[], company_id, created_by}`
- fixed_assets: `{name, purchase_date, purchase_cost, depreciation_method, company_id}`
- chart_of_accounts: `{code, name, type, company_id}`
- reconciliation_matches: `{transaction_id, journal_id, status, company_id}`

## Prioritized Backlog
### P0 (Done)
- [x] Auth system with RBAC
- [x] Transactions + AI classification + smart CSV/Excel/PDF upload
- [x] Journal entries (double-entry)
- [x] Financial reports (Trial Balance, P&L, Balance Sheet)
- [x] Multi-client profiles + client switcher
- [x] PDF/Excel export for reports
- [x] GST Reports (GSTR-1, GSTR-3B) with per-transaction rates
- [x] Role-based access control on frontend

### P1 (High value — next sprint)
- [ ] Email alerts for large transactions detected
- [ ] Password reset flow
- [ ] Audit log viewer page
- [ ] Multi-currency support (USD, EUR)

### P2 (Nice to have)
- [ ] Dark/light theme toggle
- [ ] Chart of accounts import via CSV
- [ ] Bulk journal entry approval workflow
- [ ] Custom bank-specific parsers for edge-case PDFs
- [ ] API for external integrations

## Test Credentials
See /app/memory/test_credentials.md
