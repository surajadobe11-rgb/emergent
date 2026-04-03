from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Query
from fastapi.responses import Response
from auth_utils import get_current_user
from export_utils import (
    trial_balance_pdf, trial_balance_excel,
    profit_loss_pdf, profit_loss_excel,
    balance_sheet_pdf, balance_sheet_excel,
    gstr1_pdf, gstr1_excel,
)

router = APIRouter()

MIME = {
    "pdf":   ("application/pdf", "pdf"),
    "excel": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
}


async def _get_company_name(db, company_id: str) -> str:
    co = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1})
    return co["name"] if co else "Company"


# ── Trial Balance ─────────────────────────────────────────────────────────────

@router.get("/trial-balance")
async def export_trial_balance(
    request: Request,
    fmt: str = Query("pdf", alias="format"),
    as_of: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    company_name = await _get_company_name(db, company_id)

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
        {"$sort": {"_id": 1}},
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)
    accounts = [{"account_code": r["_id"], "account_name": r["account_name"],
                 "debit": round(r["total_debit"], 2), "credit": round(r["total_credit"], 2)}
                for r in results]
    data = {
        "accounts": accounts,
        "total_debit": round(sum(a["debit"] for a in accounts), 2),
        "total_credit": round(sum(a["credit"] for a in accounts), 2),
        "as_of": as_of or "All time",
    }

    if fmt == "excel":
        content = trial_balance_excel(data, company_name)
        filename = "trial_balance.xlsx"
    else:
        content = trial_balance_pdf(data, company_name)
        filename = "trial_balance.pdf"

    mime, _ = MIME.get(fmt, MIME["pdf"])
    return Response(content=content, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ── P&L ───────────────────────────────────────────────────────────────────────

@router.get("/profit-loss")
async def export_profit_loss(
    request: Request,
    fmt: str = Query("pdf", alias="format"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    company_name = await _get_company_name(db, company_id)

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
        {"$sort": {"_id": 1}},
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)

    revenue, expenses, total_rev, total_exp = [], [], 0.0, 0.0
    for r in results:
        code = r["_id"]
        if code.startswith("4"):
            amt = round(r["total_credit"] - r["total_debit"], 2)
            revenue.append({"account_code": code, "account_name": r["account_name"], "amount": amt})
            total_rev += amt
        elif code.startswith("5"):
            amt = round(r["total_debit"] - r["total_credit"], 2)
            expenses.append({"account_code": code, "account_name": r["account_name"], "amount": amt})
            total_exp += amt

    data = {
        "revenue": revenue, "expenses": expenses,
        "total_revenue": round(total_rev, 2),
        "total_expenses": round(total_exp, 2),
        "net_profit": round(total_rev - total_exp, 2),
        "from_date": from_date or "beginning",
        "to_date": to_date or "today",
    }

    content = profit_loss_pdf(data, company_name) if fmt == "pdf" else profit_loss_excel(data, company_name)
    filename = f"profit_loss.{'pdf' if fmt == 'pdf' else 'xlsx'}"
    mime, _ = MIME.get(fmt, MIME["pdf"])
    return Response(content=content, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ── Balance Sheet ─────────────────────────────────────────────────────────────

@router.get("/balance-sheet")
async def export_balance_sheet(
    request: Request,
    fmt: str = Query("pdf", alias="format"),
    as_of: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    company_name = await _get_company_name(db, company_id)

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
        {"$sort": {"_id": 1}},
    ]
    results = await db.journal_entries.aggregate(pipeline).to_list(100)

    assets, liabilities, equity = [], [], []
    total_a, total_l, total_e, net_profit = 0.0, 0.0, 0.0, 0.0
    for r in results:
        code = r["_id"]
        if code.startswith("1"):
            b = round(r["total_debit"] - r["total_credit"], 2)
            assets.append({"account_code": code, "account_name": r["account_name"], "balance": b})
            total_a += b
        elif code.startswith("2"):
            b = round(r["total_credit"] - r["total_debit"], 2)
            liabilities.append({"account_code": code, "account_name": r["account_name"], "balance": b})
            total_l += b
        elif code.startswith("3"):
            b = round(r["total_credit"] - r["total_debit"], 2)
            equity.append({"account_code": code, "account_name": r["account_name"], "balance": b})
            total_e += b
        elif code.startswith("4"):
            net_profit += round(r["total_credit"] - r["total_debit"], 2)
        elif code.startswith("5"):
            net_profit -= round(r["total_debit"] - r["total_credit"], 2)

    data = {
        "assets": assets, "liabilities": liabilities, "equity": equity,
        "net_profit": round(net_profit, 2),
        "total_assets": round(total_a, 2),
        "total_liabilities": round(total_l, 2),
        "total_equity": round(total_e + net_profit, 2),
        "as_of": as_of or "today",
    }

    content = balance_sheet_pdf(data, company_name) if fmt == "pdf" else balance_sheet_excel(data, company_name)
    filename = f"balance_sheet.{'pdf' if fmt == 'pdf' else 'xlsx'}"
    mime, _ = MIME.get(fmt, MIME["pdf"])
    return Response(content=content, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ── GSTR-1 ────────────────────────────────────────────────────────────────────

@router.get("/gstr1")
async def export_gstr1(
    request: Request,
    fmt: str = Query("pdf", alias="format"),
    period: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    company_name = await _get_company_name(db, company_id)

    match_q = {"company_id": company_id, "type": "credit",
               "account_code": {"$in": ["4010", "4020", "4030"]}}
    cursor = db.transactions.find(match_q, {"_id": 0}).sort("date", 1)
    txns = await cursor.to_list(500)

    gst_rate = 18.0
    transactions = []
    total_taxable = total_cgst = total_sgst = total_igst = 0.0

    for t in txns:
        taxable = round(t["amount"] / 1.18, 2)
        cgst = round(taxable * 0.09, 2)
        sgst = round(taxable * 0.09, 2)
        igst = 0.0
        transactions.append({
            "date": datetime.fromisoformat(t["date"]).strftime("%d/%m/%Y") if isinstance(t["date"], str) else t["date"].strftime("%d/%m/%Y"),
            "narration": t["narration"][:50],
            "taxable_value": taxable,
            "gst_rate": gst_rate,
            "cgst": cgst, "sgst": sgst, "igst": igst,
        })
        total_taxable += taxable
        total_cgst += cgst
        total_sgst += sgst

    data = {
        "period": period or "All periods",
        "transactions": transactions,
        "summary": {
            "total_taxable": round(total_taxable, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_igst": round(total_igst, 2),
            "total_tax": round(total_cgst + total_sgst + total_igst, 2),
        },
    }

    content = gstr1_pdf(data, company_name) if fmt == "pdf" else gstr1_excel(data, company_name)
    filename = f"GSTR1_{period or 'all'}.{'pdf' if fmt == 'pdf' else 'xlsx'}"
    mime, _ = MIME.get(fmt, MIME["pdf"])
    return Response(content=content, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
