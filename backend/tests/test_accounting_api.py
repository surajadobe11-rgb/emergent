"""
Backend API tests for AI-powered accounting software
Tests: auth, dashboard KPIs, transactions, journals, assets, reconciliation, reports, settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://execution-hub-41.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@acme.com"
ADMIN_PASSWORD = "admin123"
ACCOUNTANT_EMAIL = "accountant@acme.com"
ACCOUNTANT_PASSWORD = "account123"


@pytest.fixture(scope="session")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json().get("access_token") or resp.json().get("token")


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestHealth:
    """Health check"""
    def test_health(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok" or "ok" in str(data).lower()
        print("Health check passed")


class TestAuth:
    """Auth endpoints"""
    def test_login_admin(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data or "token" in data
        print("Admin login passed")

    def test_login_accountant(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ACCOUNTANT_EMAIL, "password": ACCOUNTANT_PASSWORD})
        assert resp.status_code == 200
        print("Accountant login passed")

    def test_login_invalid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@test.com", "password": "wrongpass"})
        assert resp.status_code in [401, 400, 403]
        print("Invalid login rejected correctly")

    def test_get_me(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("email") == ADMIN_EMAIL
        print("Get me passed")


class TestDashboard:
    """Dashboard KPI reports"""
    def test_dashboard_kpis(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/reports/dashboard-kpis", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "revenue" in data or "total_revenue" in data or len(data) > 0
        print(f"Dashboard KPIs: {list(data.keys())}")


class TestTransactions:
    """Transactions CRUD and AI classification"""
    def test_list_transactions(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("transactions", data.get("items", []))
        assert len(items) >= 24, f"Expected 24+ transactions, got {len(items)}"
        print(f"Transactions count: {len(items)}")

    def test_ai_classify(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/transactions/classify-all", headers=auth_headers)
        assert resp.status_code in [200, 201]
        print("AI classify all passed")

    def test_create_transaction(self, auth_headers):
        payload = {
            "date": "2024-01-15",
            "description": "TEST_ Office Supplies Purchase",
            "amount": 5000.0,
            "type": "expense"
        }
        resp = requests.post(f"{BASE_URL}/api/transactions", json=payload, headers=auth_headers)
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data.get("id") or data.get("_id") or data.get("transaction_id")
        print("Create transaction passed")


class TestJournals:
    """Journal entries"""
    def test_list_journals(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/journals", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("journals", data.get("items", []))
        assert len(items) >= 7, f"Expected 7+ journal entries, got {len(items)}"
        print(f"Journals count: {len(items)}")

    def test_create_journal_balanced(self, auth_headers):
        """Create a balanced journal entry (D=C)"""
        payload = {
            "date": "2024-01-20",
            "description": "TEST_ Balanced Journal Entry",
            "reference": "JE-TEST-001",
            "lines": [
                {"account_code": "1010", "account_name": "Cash", "debit": 10000.0, "credit": 0.0},
                {"account_code": "4010", "account_name": "Revenue", "debit": 0.0, "credit": 10000.0}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/journals", json=payload, headers=auth_headers)
        assert resp.status_code in [200, 201], f"Failed: {resp.text}"
        print("Create balanced journal passed")

    def test_create_journal_unbalanced(self, auth_headers):
        """Unbalanced journal should be rejected"""
        payload = {
            "date": "2024-01-20",
            "description": "TEST_ Unbalanced Journal",
            "lines": [
                {"account_code": "1010", "account_name": "Cash", "debit": 10000.0, "credit": 0.0},
                {"account_code": "4010", "account_name": "Revenue", "debit": 0.0, "credit": 5000.0}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/journals", json=payload, headers=auth_headers)
        assert resp.status_code in [400, 422], f"Expected error for unbalanced journal, got {resp.status_code}"
        print("Unbalanced journal rejected correctly")


class TestAssets:
    """Fixed assets"""
    def test_list_assets(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/assets", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("assets", data.get("items", []))
        assert len(items) >= 3, f"Expected 3+ assets, got {len(items)}"
        print(f"Assets count: {len(items)}")

    def test_create_asset(self, auth_headers):
        payload = {
            "name": "TEST_ Office Computer",
            "purchase_date": "2024-01-01",
            "purchase_cost": 80000.0,
            "useful_life_years": 5,
            "depreciation_method": "straight_line",
            "category": "Equipment"
        }
        resp = requests.post(f"{BASE_URL}/api/assets", json=payload, headers=auth_headers)
        assert resp.status_code in [200, 201], f"Failed: {resp.text}"
        print("Create asset passed")


class TestReconciliation:
    """Bank reconciliation"""
    def test_list_bank_transactions(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/reconciliation/bank-transactions", headers=auth_headers)
        assert resp.status_code == 200
        print("Bank transactions list passed")

    def test_auto_match(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/reconciliation/auto-match", headers=auth_headers)
        assert resp.status_code in [200, 201]
        print("Auto-match passed")


class TestReports:
    """Financial reports"""
    def test_trial_balance(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/reports/trial-balance", headers=auth_headers)
        assert resp.status_code == 200
        print("Trial balance passed")

    def test_profit_loss(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/reports/profit-loss", headers=auth_headers)
        assert resp.status_code == 200
        print("P&L report passed")

    def test_balance_sheet(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/reports/balance-sheet", headers=auth_headers)
        assert resp.status_code == 200
        print("Balance sheet passed")


class TestSettings:
    """Settings endpoints"""
    def test_get_company(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/settings/company", headers=auth_headers)
        assert resp.status_code == 200
        print("Company settings passed")

    def test_list_users(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/settings/users", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("users", [])
        assert len(items) >= 2
        print(f"Users list: {len(items)} users")

    def test_chart_of_accounts(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/settings/chart-of-accounts", headers=auth_headers)
        assert resp.status_code == 200
        print("Chart of accounts passed")

    def test_ledger(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/ledger", headers=auth_headers)
        assert resp.status_code == 200
        print("Ledger passed")
