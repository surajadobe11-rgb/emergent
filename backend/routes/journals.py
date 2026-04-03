import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from auth_utils import get_current_user

router = APIRouter()


class JournalLine(BaseModel):
    account_code: str
    account_name: str
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = ""


class JournalCreate(BaseModel):
    date: str
    description: str
    reference: Optional[str] = ""
    lines: List[JournalLine]


def serialize_journal(j: dict) -> dict:
    if isinstance(j.get("date"), datetime):
        j["date"] = j["date"].isoformat()
    if isinstance(j.get("created_at"), datetime):
        j["created_at"] = j["created_at"].isoformat()
    j.pop("_id", None)
    return j


@router.get("")
async def list_journals(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    total = await db.journal_entries.count_documents({"company_id": company_id})
    skip = (page - 1) * limit
    cursor = db.journal_entries.find({"company_id": company_id}).sort("date", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": [serialize_journal(j) for j in items], "total": total, "page": page, "limit": limit}


@router.get("/{journal_id}")
async def get_journal(journal_id: str, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    j = await db.journal_entries.find_one({"id": journal_id, "company_id": company_id})
    if not j:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return serialize_journal(j)


@router.post("")
async def create_journal(body: JournalCreate, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    total_debit = sum(l.debit for l in body.lines)
    total_credit = sum(l.credit for l in body.lines)

    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Journal not balanced: Total Debit ₹{total_debit:,.2f} ≠ Total Credit ₹{total_credit:,.2f}"
        )

    if len(body.lines) < 2:
        raise HTTPException(status_code=400, detail="Journal must have at least 2 lines")

    try:
        date = datetime.strptime(body.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    now = datetime.now(timezone.utc)
    journal = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "date": date,
        "description": body.description,
        "reference": body.reference or "",
        "status": "posted",
        "lines": [l.model_dump() for l in body.lines],
        "total_debit": total_debit,
        "total_credit": total_credit,
        "created_by": user["email"],
        "created_at": now,
    }
    await db.journal_entries.insert_one(journal)
    return serialize_journal(journal)


@router.get("/ledger/accounts")
async def get_ledger_accounts(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    pipeline = [
        {"$match": {"company_id": company_id}},
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
    for r in results:
        code = r["_id"]
        balance = r["total_debit"] - r["total_credit"]
        accounts.append({
            "account_code": code,
            "account_name": r["account_name"],
            "total_debit": r["total_debit"],
            "total_credit": r["total_credit"],
            "balance": balance,
        })
    return {"accounts": accounts}


@router.get("/ledger/{account_code}")
async def get_account_ledger(account_code: str, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    pipeline = [
        {"$match": {"company_id": company_id}},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": account_code}},
        {"$project": {
            "date": 1, "description": 1, "reference": 1,
            "debit": "$lines.debit", "credit": "$lines.credit",
            "line_description": "$lines.description"
        }},
        {"$sort": {"date": 1}}
    ]
    entries = await db.journal_entries.aggregate(pipeline).to_list(500)

    running_balance = 0.0
    rows = []
    for e in entries:
        running_balance += e.get("debit", 0) - e.get("credit", 0)
        rows.append({
            "date": e["date"].isoformat() if isinstance(e["date"], datetime) else e["date"],
            "description": e.get("description", ""),
            "reference": e.get("reference", ""),
            "debit": e.get("debit", 0),
            "credit": e.get("credit", 0),
            "balance": running_balance,
        })

    return {"account_code": account_code, "entries": rows, "closing_balance": running_balance}
