from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Query
from auth_utils import get_current_user

router = APIRouter()


def _serialize_txn(t: dict) -> dict:
    t.pop("_id", None)
    if isinstance(t.get("date"), datetime):
        t["date"] = t["date"].strftime("%d/%m/%Y")
    return t


@router.get("/gstr1")
async def gstr1_report(
    request: Request,
    period: Optional[str] = None,  # YYYY-MM
):
    """
    GSTR-1: Outward supplies (sales & service revenue).
    Calculates 18% GST (CGST 9% + SGST 9%) for each revenue transaction.
    """
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    match_q = {"company_id": company_id, "type": "credit",
               "account_code": {"$in": ["4010", "4020", "4030"]}}
    if period:
        try:
            year, month = map(int, period.split("-"))
            from calendar import monthrange
            last_day = monthrange(year, month)[1]
            match_q["date"] = {
                "$gte": datetime(year, month, 1, tzinfo=timezone.utc),
                "$lte": datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc),
            }
        except Exception:
            pass

    cursor = db.transactions.find(match_q, {"_id": 0}).sort("date", 1)
    raw_txns = await cursor.to_list(500)

    gst_rate = 18.0
    b2b_supplies = []
    total_taxable = total_cgst = total_sgst = total_igst = 0.0

    for t in raw_txns:
        # Back-calculate taxable value assuming amount is inclusive of 18% GST
        taxable = round(t["amount"] / 1.18, 2)
        cgst = round(taxable * 0.09, 2)
        sgst = round(taxable * 0.09, 2)
        igst = 0.0
        gross = round(taxable + cgst + sgst + igst, 2)

        date_val = t.get("date")
        if isinstance(date_val, datetime):
            date_str = date_val.strftime("%d/%m/%Y")
        else:
            try:
                date_str = datetime.fromisoformat(str(date_val)).strftime("%d/%m/%Y")
            except Exception:
                date_str = str(date_val)

        b2b_supplies.append({
            "date": date_str,
            "narration": t["narration"],
            "category": t.get("category", ""),
            "taxable_value": taxable,
            "gst_rate": gst_rate,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "gross_amount": gross,
        })
        total_taxable += taxable
        total_cgst += cgst
        total_sgst += sgst

    # Fetch company GST number
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1, "gst_number": 1})

    return {
        "report_type": "GSTR-1",
        "period": period or "All periods",
        "company_name": company.get("name") if company else "",
        "gstin": company.get("gst_number") if company else "",
        "b2b_supplies": b2b_supplies,
        "summary": {
            "total_taxable": round(total_taxable, 2),
            "total_cgst": round(total_cgst, 2),
            "total_sgst": round(total_sgst, 2),
            "total_igst": round(total_igst, 2),
            "total_tax": round(total_cgst + total_sgst + total_igst, 2),
            "total_gross": round(total_taxable + total_cgst + total_sgst + total_igst, 2),
        },
    }


@router.get("/gstr3b")
async def gstr3b_report(
    request: Request,
    period: Optional[str] = None,
):
    """
    GSTR-3B: Monthly summary return.
    Section 3.1 — Outward supplies.
    Section 4   — Input Tax Credit (ITC).
    """
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    date_filter = {}
    if period:
        try:
            year, month = map(int, period.split("-"))
            from calendar import monthrange
            last_day = monthrange(year, month)[1]
            date_filter = {
                "$gte": datetime(year, month, 1, tzinfo=timezone.utc),
                "$lte": datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc),
            }
        except Exception:
            pass

    base_q = {"company_id": company_id}
    if date_filter:
        base_q["date"] = date_filter

    # Outward supplies (sales)
    out_q = {**base_q, "type": "credit", "account_code": {"$in": ["4010", "4020", "4030"]}}
    out_cursor = db.transactions.find(out_q, {"_id": 0})
    out_txns = await out_cursor.to_list(500)

    total_outward_taxable = sum(round(t["amount"] / 1.18, 2) for t in out_txns)
    total_outward_tax = round(total_outward_taxable * 0.18, 2)
    cgst_out = round(total_outward_tax / 2, 2)
    sgst_out = round(total_outward_tax / 2, 2)

    # Inward supplies with GST (expense transactions — ITC eligible)
    in_q = {**base_q, "type": "debit", "account_code": {"$in": ["5010", "5020", "5030", "5050", "5070"]}}
    in_cursor = db.transactions.find(in_q, {"_id": 0})
    in_txns = await in_cursor.to_list(500)

    total_inward_taxable = sum(round(t["amount"] / 1.18, 2) for t in in_txns)
    total_itc = round(total_inward_taxable * 0.18, 2)
    cgst_itc = round(total_itc / 2, 2)
    sgst_itc = round(total_itc / 2, 2)

    net_tax_liability = round(total_outward_tax - total_itc, 2)

    return {
        "report_type": "GSTR-3B",
        "period": period or "All periods",
        "table_31": {
            "title": "3.1 — Outward Supplies and Inward Supplies Liable to Reverse Charge",
            "taxable_value": round(total_outward_taxable, 2),
            "igst": 0.0,
            "cgst": cgst_out,
            "sgst": sgst_out,
            "cess": 0.0,
            "total_tax": total_outward_tax,
        },
        "table_4": {
            "title": "4 — Eligible Input Tax Credit (ITC)",
            "taxable_base": round(total_inward_taxable, 2),
            "igst": 0.0,
            "cgst": cgst_itc,
            "sgst": sgst_itc,
            "total_itc": total_itc,
        },
        "net_tax_liability": net_tax_liability,
        "notes": [
            "GST calculated at flat 18% (CGST 9% + SGST 9%) for all line items.",
            "Amounts shown are back-calculated from inclusive transaction amounts.",
            "This report is indicative. Verify with your CA before filing."
        ],
    }
