from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Query
from auth_utils import get_current_user

router = APIRouter()


def serialize_date(d):
    return d.isoformat() if isinstance(d, datetime) else d


@router.get("/trial-balance")
async def trial_balance(request: Request, as_of: Optional[str] = None):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    match_q = {"company_id": company_id}
    if as_of:
        try:
            date_filter = datetime.strptime(as_of, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            match_q["date"] = {"$lte": date_filter}
        except ValueError:
            pass

    pipeline = [
        {"$match": match_q},
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.account_code",
            "account_name": {"$first": "$lines.account_name"},
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}}
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)

    accounts = []
    grand_debit = 0.0
    grand_credit = 0.0
    for r in results:
        accounts.append({
            "account_code": r["_id"],
            "account_name": r["account_name"],
            "debit": round(r["total_debit"], 2),
            "credit": round(r["total_credit"], 2),
        })
        grand_debit += r["total_debit"]
        grand_credit += r["total_credit"]

    return {
        "accounts": accounts,
        "total_debit": round(grand_debit, 2),
        "total_credit": round(grand_credit, 2),
        "is_balanced": abs(grand_debit - grand_credit) < 0.01,
        "as_of": as_of or "all time"
    }


@router.get("/profit-loss")
async def profit_loss(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    match_q = {"company_id": company_id}
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q["$gte"] = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if to_date:
            date_q["$lte"] = datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        match_q["date"] = date_q

    pipeline = [
        {"$match": match_q},
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.account_code",
            "account_name": {"$first": "$lines.account_name"},
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}}
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)

    revenue_items = []
    expense_items = []
    total_revenue = 0.0
    total_expenses = 0.0

    for r in results:
        code = r["_id"]
        if code.startswith("4"):
            amount = round(r["total_credit"] - r["total_debit"], 2)
            revenue_items.append({"account_code": code, "account_name": r["account_name"], "amount": amount})
            total_revenue += amount
        elif code.startswith("5"):
            amount = round(r["total_debit"] - r["total_credit"], 2)
            expense_items.append({"account_code": code, "account_name": r["account_name"], "amount": amount})
            total_expenses += amount

    return {
        "from_date": from_date or "beginning",
        "to_date": to_date or "today",
        "revenue": revenue_items,
        "expenses": expense_items,
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(total_revenue - total_expenses, 2),
        "gross_profit": round(total_revenue - total_expenses, 2),
    }


@router.get("/balance-sheet")
async def balance_sheet(request: Request, as_of: Optional[str] = None):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    match_q = {"company_id": company_id}
    if as_of:
        try:
            match_q["date"] = {"$lte": datetime.strptime(as_of, "%Y-%m-%d").replace(tzinfo=timezone.utc)}
        except ValueError:
            pass

    pipeline = [
        {"$match": match_q},
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.account_code",
            "account_name": {"$first": "$lines.account_name"},
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}}
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)

    assets = []
    liabilities = []
    equity = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0
    net_profit = 0.0

    for r in results:
        code = r["_id"]
        if code.startswith("1"):
            balance = round(r["total_debit"] - r["total_credit"], 2)
            assets.append({"account_code": code, "account_name": r["account_name"], "balance": balance})
            total_assets += balance
        elif code.startswith("2"):
            balance = round(r["total_credit"] - r["total_debit"], 2)
            liabilities.append({"account_code": code, "account_name": r["account_name"], "balance": balance})
            total_liabilities += balance
        elif code.startswith("3"):
            balance = round(r["total_credit"] - r["total_debit"], 2)
            equity.append({"account_code": code, "account_name": r["account_name"], "balance": balance})
            total_equity += balance
        elif code.startswith("4"):
            net_profit += round(r["total_credit"] - r["total_debit"], 2)
        elif code.startswith("5"):
            net_profit -= round(r["total_debit"] - r["total_credit"], 2)

    return {
        "as_of": as_of or "today",
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "net_profit": round(net_profit, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "total_equity": round(total_equity + net_profit, 2),
        "is_balanced": abs(total_assets - (total_liabilities + total_equity + net_profit)) < 0.01,
    }


@router.get("/dashboard-kpis")
async def dashboard_kpis(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    # Compute from transactions for quick KPIs
    cursor = db.transactions.find({"company_id": company_id}, {"_id": 0})
    txns = await cursor.to_list(1000)

    total_revenue = sum(t["amount"] for t in txns if t.get("type") == "credit" and t.get("account_code", "").startswith("4"))
    total_expenses = sum(t["amount"] for t in txns if t.get("type") == "debit" and t.get("account_code", "").startswith("5"))
    cash_in = sum(t["amount"] for t in txns if t.get("type") == "credit")
    cash_out = sum(t["amount"] for t in txns if t.get("type") == "debit")
    cash_balance = cash_in - cash_out

    # Monthly revenue for chart
    from collections import defaultdict
    monthly = defaultdict(lambda: {"revenue": 0.0, "expenses": 0.0})
    for t in txns:
        d = t.get("date")
        if isinstance(d, datetime):
            month_key = d.strftime("%b %Y")
        elif isinstance(d, str):
            try:
                month_key = datetime.fromisoformat(d).strftime("%b %Y")
            except Exception:
                continue
        else:
            continue

        if t.get("type") == "credit" and t.get("account_code", "").startswith("4"):
            monthly[month_key]["revenue"] += t["amount"]
        elif t.get("type") == "debit" and t.get("account_code", "").startswith("5"):
            monthly[month_key]["expenses"] += t["amount"]

    # Sort months chronologically
    from datetime import datetime as dt
    month_data = []
    for k, v in monthly.items():
        try:
            parsed = dt.strptime(k, "%b %Y")
            month_data.append({"month": k, "revenue": round(v["revenue"], 2), "expenses": round(v["expenses"], 2), "_sort": parsed})
        except Exception:
            pass
    month_data.sort(key=lambda x: x["_sort"])
    for m in month_data:
        m.pop("_sort", None)

    # Recent transactions
    recent_cursor = db.transactions.find({"company_id": company_id}, {"_id": 0}).sort("date", -1).limit(5)
    recent = await recent_cursor.to_list(5)
    for t in recent:
        if isinstance(t.get("date"), datetime):
            t["date"] = t["date"].isoformat()

    return {
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(total_revenue - total_expenses, 2),
        "cash_balance": round(cash_balance, 2),
        "total_transactions": len(txns),
        "monthly_chart": month_data[-6:],
        "recent_transactions": recent,
    }
