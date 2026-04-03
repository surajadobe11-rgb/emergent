import uuid
import os
from datetime import datetime, timezone
from auth_utils import hash_password
from ai_engine import classify_transaction

COMPANY_ID = "acme-tech-001"

CHART_OF_ACCOUNTS = [
    {"code": "1010", "name": "Cash & Bank", "type": "asset"},
    {"code": "1020", "name": "Accounts Receivable", "type": "asset"},
    {"code": "1030", "name": "Inventory", "type": "asset"},
    {"code": "1100", "name": "Fixed Assets", "type": "asset"},
    {"code": "1110", "name": "Accumulated Depreciation", "type": "asset"},
    {"code": "2010", "name": "Accounts Payable", "type": "liability"},
    {"code": "2020", "name": "GST Payable", "type": "liability"},
    {"code": "2030", "name": "Short-term Loans", "type": "liability"},
    {"code": "3010", "name": "Owner's Equity", "type": "equity"},
    {"code": "3020", "name": "Retained Earnings", "type": "equity"},
    {"code": "4010", "name": "Sales Revenue", "type": "revenue"},
    {"code": "4020", "name": "Service Revenue", "type": "revenue"},
    {"code": "4030", "name": "Other Income", "type": "revenue"},
    {"code": "5010", "name": "Salary Expense", "type": "expense"},
    {"code": "5020", "name": "Rent Expense", "type": "expense"},
    {"code": "5030", "name": "Utilities", "type": "expense"},
    {"code": "5040", "name": "Bank Charges", "type": "expense"},
    {"code": "5050", "name": "Office Supplies", "type": "expense"},
    {"code": "5060", "name": "GST/Tax Expense", "type": "expense"},
    {"code": "5070", "name": "Miscellaneous Expense", "type": "expense"},
]

RAW_TRANSACTIONS = [
    {"date": "2024-01-01", "narration": "Opening Balance Deposit", "amount": 500000.0, "type": "credit"},
    {"date": "2024-01-05", "narration": "Client Payment - ABC Corp Invoice #1001", "amount": 150000.0, "type": "credit"},
    {"date": "2024-01-07", "narration": "Salary Payment - January 2024", "amount": 250000.0, "type": "debit"},
    {"date": "2024-01-10", "narration": "Office Rent - January 2024", "amount": 50000.0, "type": "debit"},
    {"date": "2024-01-12", "narration": "Electricity Bill - January", "amount": 8500.0, "type": "debit"},
    {"date": "2024-01-15", "narration": "GST Payment Q3 2023-24", "amount": 45000.0, "type": "debit"},
    {"date": "2024-01-18", "narration": "Bank Service Charge - January", "amount": 500.0, "type": "debit"},
    {"date": "2024-01-20", "narration": "Consulting Fee - XYZ Ltd Project", "amount": 75000.0, "type": "credit"},
    {"date": "2024-01-22", "narration": "Office Stationery Purchase", "amount": 3500.0, "type": "debit"},
    {"date": "2024-01-25", "narration": "Travel Expense - Tech Conference Mumbai", "amount": 15000.0, "type": "debit"},
    {"date": "2024-02-01", "narration": "Client Payment - DEF Corp Invoice #1002", "amount": 200000.0, "type": "credit"},
    {"date": "2024-02-05", "narration": "Salary Payment - February 2024", "amount": 250000.0, "type": "debit"},
    {"date": "2024-02-08", "narration": "Office Rent - February 2024", "amount": 50000.0, "type": "debit"},
    {"date": "2024-02-10", "narration": "Internet Bill - February", "amount": 3500.0, "type": "debit"},
    {"date": "2024-02-14", "narration": "Laptop Purchase - Dell XPS Developer", "amount": 85000.0, "type": "debit"},
    {"date": "2024-02-18", "narration": "Bank Service Charge - February", "amount": 500.0, "type": "debit"},
    {"date": "2024-02-20", "narration": "Service Revenue - Project Alpha Milestone", "amount": 350000.0, "type": "credit"},
    {"date": "2024-02-22", "narration": "Insurance Premium - Annual Policy", "amount": 25000.0, "type": "debit"},
    {"date": "2024-02-25", "narration": "Interest Income - Savings Account", "amount": 5000.0, "type": "credit"},
    {"date": "2024-02-28", "narration": "GST Payment Q4 2023-24", "amount": 52000.0, "type": "debit"},
    {"date": "2024-03-05", "narration": "Client Payment - GHI Corp Invoice #1003", "amount": 180000.0, "type": "credit"},
    {"date": "2024-03-07", "narration": "Salary Payment - March 2024", "amount": 250000.0, "type": "debit"},
    {"date": "2024-03-12", "narration": "Office Rent - March 2024", "amount": 50000.0, "type": "debit"},
    {"date": "2024-03-15", "narration": "Water Bill - March", "amount": 1200.0, "type": "debit"},
]

SAMPLE_JOURNALS = [
    {
        "description": "Opening Balance Entry",
        "reference": "JE-OB-001",
        "date": "2024-01-01",
        "lines": [
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 500000.0, "credit": 0.0},
            {"account_code": "3010", "account_name": "Owner's Equity", "debit": 0.0, "credit": 500000.0},
        ]
    },
    {
        "description": "Salary Payment - January 2024",
        "reference": "JE-002",
        "date": "2024-01-07",
        "lines": [
            {"account_code": "5010", "account_name": "Salary Expense", "debit": 250000.0, "credit": 0.0},
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 0.0, "credit": 250000.0},
        ]
    },
    {
        "description": "Sales Invoice - ABC Corp",
        "reference": "JE-003",
        "date": "2024-01-05",
        "lines": [
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 150000.0, "credit": 0.0},
            {"account_code": "4010", "account_name": "Sales Revenue", "debit": 0.0, "credit": 150000.0},
        ]
    },
    {
        "description": "Office Rent - January 2024",
        "reference": "JE-004",
        "date": "2024-01-10",
        "lines": [
            {"account_code": "5020", "account_name": "Rent Expense", "debit": 50000.0, "credit": 0.0},
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 0.0, "credit": 50000.0},
        ]
    },
    {
        "description": "Service Revenue - Project Alpha Milestone",
        "reference": "JE-005",
        "date": "2024-02-20",
        "lines": [
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 350000.0, "credit": 0.0},
            {"account_code": "4020", "account_name": "Service Revenue", "debit": 0.0, "credit": 350000.0},
        ]
    },
    {
        "description": "Salary Payment - February 2024",
        "reference": "JE-006",
        "date": "2024-02-05",
        "lines": [
            {"account_code": "5010", "account_name": "Salary Expense", "debit": 250000.0, "credit": 0.0},
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 0.0, "credit": 250000.0},
        ]
    },
    {
        "description": "GST Payments Q3 & Q4",
        "reference": "JE-007",
        "date": "2024-02-28",
        "lines": [
            {"account_code": "5060", "account_name": "GST/Tax Expense", "debit": 97000.0, "credit": 0.0},
            {"account_code": "1010", "account_name": "Cash & Bank", "debit": 0.0, "credit": 97000.0},
        ]
    },
]

SAMPLE_ASSETS = [
    {
        "name": "Dell XPS Laptop - Developer",
        "description": "High-performance laptop for development team",
        "purchase_date": "2024-02-14",
        "purchase_cost": 85000.0,
        "useful_life_years": 3,
        "salvage_value": 5000.0,
        "depreciation_method": "SLM",
        "wdv_rate": 0.0,
        "account_code": "1100",
        "accumulated_depreciation": 2222.0,
        "net_book_value": 82778.0,
        "status": "active",
    },
    {
        "name": "Office Conference Furniture",
        "description": "10-seater conference table and chairs set",
        "purchase_date": "2024-01-01",
        "purchase_cost": 120000.0,
        "useful_life_years": 10,
        "salvage_value": 10000.0,
        "depreciation_method": "SLM",
        "wdv_rate": 0.0,
        "account_code": "1100",
        "accumulated_depreciation": 11000.0,
        "net_book_value": 109000.0,
        "status": "active",
    },
    {
        "name": "Production Server Infrastructure",
        "description": "On-premise server setup for production workloads",
        "purchase_date": "2023-07-01",
        "purchase_cost": 350000.0,
        "useful_life_years": 5,
        "salvage_value": 25000.0,
        "depreciation_method": "WDV",
        "wdv_rate": 0.25,
        "account_code": "1100",
        "accumulated_depreciation": 120313.0,
        "net_book_value": 229687.0,
        "status": "active",
    },
]


async def seed_all(db):
    now = datetime.now(timezone.utc)

    # Seed company
    await db.companies.update_one(
        {"id": COMPANY_ID},
        {"$setOnInsert": {
            "id": COMPANY_ID,
            "name": "Acme Technologies Pvt Ltd",
            "gst_number": "27AABCU9603R1ZX",
            "address": "123, Tech Park, Bangalore - 560001",
            "email": "accounts@acme.com",
            "phone": "+91-80-12345678",
            "financial_year_start": "04",
            "currency": "INR",
            "created_at": now,
        }},
        upsert=True
    )

    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@acme.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin User",
            "role": "admin",
            "company_id": COMPANY_ID,
            "created_at": now,
        })
    else:
        if not existing_admin.get("company_id"):
            await db.users.update_one({"email": admin_email}, {"$set": {"company_id": COMPANY_ID}})

    # Seed accountant user
    existing_accountant = await db.users.find_one({"email": "accountant@acme.com"})
    if not existing_accountant:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "accountant@acme.com",
            "password_hash": hash_password("account123"),
            "name": "Jane Accountant",
            "role": "accountant",
            "company_id": COMPANY_ID,
            "created_at": now,
        })

    # Seed chart of accounts
    for acc in CHART_OF_ACCOUNTS:
        await db.chart_of_accounts.update_one(
            {"code": acc["code"], "company_id": COMPANY_ID},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "company_id": COMPANY_ID,
                "code": acc["code"],
                "name": acc["name"],
                "type": acc["type"],
                "is_active": True,
                "created_at": now,
            }},
            upsert=True
        )

    # Seed transactions if empty
    txn_count = await db.transactions.count_documents({"company_id": COMPANY_ID})
    if txn_count == 0:
        txn_docs = []
        for raw in RAW_TRANSACTIONS:
            category, account_code, account_name, confidence = classify_transaction(
                raw["narration"], raw["amount"]
            )
            txn_docs.append({
                "id": str(uuid.uuid4()),
                "company_id": COMPANY_ID,
                "date": datetime.strptime(raw["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
                "narration": raw["narration"],
                "amount": raw["amount"],
                "type": raw["type"],
                "category": category,
                "account_code": account_code,
                "account_name": account_name,
                "confidence": confidence,
                "is_ai_classified": True,
                "status": "classified" if category != "Unclassified" else "unclassified",
                "created_at": now,
            })
        await db.transactions.insert_many(txn_docs)

    # Seed journal entries if empty
    journal_count = await db.journal_entries.count_documents({"company_id": COMPANY_ID})
    if journal_count == 0:
        for j in SAMPLE_JOURNALS:
            total_debit = sum(l["debit"] for l in j["lines"])
            total_credit = sum(l["credit"] for l in j["lines"])
            await db.journal_entries.insert_one({
                "id": str(uuid.uuid4()),
                "company_id": COMPANY_ID,
                "date": datetime.strptime(j["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
                "description": j["description"],
                "reference": j["reference"],
                "status": "posted",
                "lines": j["lines"],
                "total_debit": total_debit,
                "total_credit": total_credit,
                "created_by": admin_email,
                "created_at": now,
            })

    # Seed fixed assets if empty
    asset_count = await db.fixed_assets.count_documents({"company_id": COMPANY_ID})
    if asset_count == 0:
        for a in SAMPLE_ASSETS:
            await db.fixed_assets.insert_one({
                "id": str(uuid.uuid4()),
                "company_id": COMPANY_ID,
                "name": a["name"],
                "description": a["description"],
                "purchase_date": datetime.strptime(a["purchase_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
                "purchase_cost": a["purchase_cost"],
                "useful_life_years": a["useful_life_years"],
                "salvage_value": a["salvage_value"],
                "depreciation_method": a["depreciation_method"],
                "wdv_rate": a["wdv_rate"],
                "accumulated_depreciation": a["accumulated_depreciation"],
                "net_book_value": a["net_book_value"],
                "account_code": a["account_code"],
                "status": a["status"],
                "created_at": now,
            })

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.transactions.create_index([("company_id", 1), ("date", -1)])
    await db.journal_entries.create_index([("company_id", 1), ("date", -1)])
    await db.fixed_assets.create_index([("company_id", 1)])
    await db.chart_of_accounts.create_index([("company_id", 1), ("code", 1)])

    # Write test credentials
    import pathlib
    creds_path = pathlib.Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(exist_ok=True)
    creds_path.write_text(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin
- Company: Acme Technologies Pvt Ltd

## Accountant Account
- Email: accountant@acme.com
- Password: account123
- Role: accountant

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout
""")
