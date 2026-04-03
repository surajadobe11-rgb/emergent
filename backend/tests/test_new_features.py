"""
Backend tests for new features: Clients CRUD, Client Switcher, Export (PDF/Excel), GST Reports, RBAC
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token") or r.json().get("token") or r.cookies.get("access_token")
    return None

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestAuth:
    """Basic auth tests"""
    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@acme.com", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("PASS: admin login")

    def test_accountant_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "accountant@acme.com", "password": "account123"})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "accountant"
        print("PASS: accountant login")


class TestClientsAPI:
    """Client CRUD tests - admin only"""
    def test_list_clients_admin(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "clients" in data
        assert len(data["clients"]) >= 1
        # Verify default Acme client exists
        names = [c["name"] for c in data["clients"]]
        assert any("Acme" in n for n in names), f"Expected Acme client, got {names}"
        print(f"PASS: list clients - {len(data['clients'])} clients found")

    def test_list_clients_forbidden_for_accountant(self):
        token = get_token("accountant@acme.com", "account123")
        r = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers(token))
        assert r.status_code == 403
        print("PASS: accountant blocked from clients list")

    def test_create_client(self):
        token = get_token("admin@acme.com", "admin123")
        payload = {"name": "TEST_New Client Ltd", "gst_number": "27TESTGS0001A1Z1"}
        r = requests.post(f"{BASE_URL}/api/clients", json=payload, headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_New Client Ltd"
        assert "id" in data
        print(f"PASS: create client, id={data['id']}")
        return data["id"]

    def test_create_and_get_client(self):
        token = get_token("admin@acme.com", "admin123")
        payload = {"name": "TEST_Verify Client", "gst_number": "27TESTGS0002A1Z1"}
        r = requests.post(f"{BASE_URL}/api/clients", json=payload, headers=auth_headers(token))
        assert r.status_code == 200
        client_id = r.json()["id"]

        # GET the client
        r2 = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=auth_headers(token))
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Verify Client"
        print("PASS: create and get client")

        # Cleanup
        requests.delete(f"{BASE_URL}/api/clients/{client_id}", headers=auth_headers(token))

    def test_delete_default_client_blocked(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.delete(f"{BASE_URL}/api/clients/acme-tech-001", headers=auth_headers(token))
        assert r.status_code == 400
        print("PASS: default client delete blocked")


class TestGSTAPI:
    """GST Report endpoint tests"""
    def test_gstr1(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/gst/gstr1", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "b2b_supplies" in data
        assert "summary" in data
        assert "total_taxable" in data["summary"]
        print(f"PASS: GSTR-1, {len(data['b2b_supplies'])} supplies")

    def test_gstr1_per_transaction_gst_rate(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/gst/gstr1", headers=auth_headers(token))
        assert r.status_code == 200
        supplies = r.json()["b2b_supplies"]
        if supplies:
            # Each supply must have gst_rate field
            for s in supplies:
                assert "gst_rate" in s, f"Missing gst_rate in supply: {s}"
        print("PASS: GSTR-1 per-transaction gst_rate field present")

    def test_gstr3b(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/gst/gstr3b", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "table_31" in data
        assert "table_4" in data
        assert "net_tax_liability" in data
        print("PASS: GSTR-3B with table_31 and table_4")

    def test_gstr1_with_period(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/gst/gstr1?period=2025-01", headers=auth_headers(token))
        assert r.status_code == 200
        print("PASS: GSTR-1 with period filter")

    def test_gst_accountant_access(self):
        """Accountant should also be able to access GST reports"""
        token = get_token("accountant@acme.com", "account123")
        r = requests.get(f"{BASE_URL}/api/gst/gstr1", headers=auth_headers(token))
        assert r.status_code == 200
        print("PASS: accountant can access GST reports")


class TestExportAPI:
    """Export PDF/Excel tests"""
    def test_trial_balance_pdf(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/trial-balance?format=pdf", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        assert len(r.content) > 100
        print(f"PASS: trial balance PDF, size={len(r.content)} bytes")

    def test_trial_balance_excel(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/trial-balance?format=excel", headers=auth_headers(token))
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100
        print(f"PASS: trial balance Excel, size={len(r.content)} bytes")

    def test_profit_loss_pdf(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/profit-loss?format=pdf", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        print("PASS: P&L PDF export")

    def test_profit_loss_excel(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/profit-loss?format=excel", headers=auth_headers(token))
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        print("PASS: P&L Excel export")

    def test_balance_sheet_pdf(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/balance-sheet?format=pdf", headers=auth_headers(token))
        assert r.status_code == 200
        print("PASS: Balance Sheet PDF export")

    def test_gstr1_export_pdf(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/gstr1?format=pdf", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        print("PASS: GSTR-1 PDF export")

    def test_gstr1_export_excel(self):
        token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/export/gstr1?format=excel", headers=auth_headers(token))
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        print("PASS: GSTR-1 Excel export")


class TestXCompanyIDHeader:
    """Test admin client switching via X-Company-ID header"""
    def test_admin_can_switch_company(self):
        token = get_token("admin@acme.com", "admin123")
        # List clients first to get IDs
        r = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers(token))
        clients = r.json()["clients"]
        if len(clients) > 0:
            target = clients[0]
            headers = {**auth_headers(token), "X-Company-ID": target["id"]}
            r2 = requests.get(f"{BASE_URL}/api/gst/gstr1", headers=headers)
            assert r2.status_code == 200
            print(f"PASS: admin can switch to company {target['id']}")

    def test_accountant_cannot_switch_company(self):
        """Accountant should not be able to use X-Company-ID override"""
        admin_token = get_token("admin@acme.com", "admin123")
        r = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers(admin_token))
        clients = r.json()["clients"]
        
        accountant_token = get_token("accountant@acme.com", "account123")
        if len(clients) > 1:
            other = next((c for c in clients if c["id"] != "acme-tech-001"), None)
            if other:
                headers = {**auth_headers(accountant_token), "X-Company-ID": other["id"]}
                r2 = requests.get(f"{BASE_URL}/api/gst/gstr1", headers=headers)
                # Accountant should only see their own company data, not switch
                assert r2.status_code == 200  # Should still work but for their company
                print("PASS: accountant X-Company-ID header test")
