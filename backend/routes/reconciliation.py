import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from auth_utils import get_current_user

router = APIRouter()


class ConfirmMatch(BaseModel):
    transaction_id: str
    journal_id: str


@router.get("/unmatched")
async def get_unmatched(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    # Get already reconciled transaction IDs
    reconciled = await db.reconciliation_matches.distinct("transaction_id", {"company_id": company_id, "status": "confirmed"})

    # Unmatched bank transactions
    cursor = db.transactions.find(
        {"company_id": company_id, "id": {"$nin": reconciled}},
        {"_id": 0}
    ).sort("date", -1).limit(30)
    bank_txns = await cursor.to_list(30)
    for t in bank_txns:
        if isinstance(t.get("date"), datetime):
            t["date"] = t["date"].isoformat()

    # Recent journal entries for matching
    cursor2 = db.journal_entries.find({"company_id": company_id}, {"_id": 0}).sort("date", -1).limit(20)
    journals = await cursor2.to_list(20)
    for j in journals:
        if isinstance(j.get("date"), datetime):
            j["date"] = j["date"].isoformat()

    return {"bank_transactions": bank_txns, "journal_entries": journals}


@router.post("/auto-match")
async def auto_match(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    now = datetime.now(timezone.utc)
    reconciled = await db.reconciliation_matches.distinct("transaction_id", {"company_id": company_id})

    cursor = db.transactions.find(
        {"company_id": company_id, "id": {"$nin": reconciled}},
        {"_id": 0}
    )
    txns = await cursor.to_list(200)

    cursor2 = db.journal_entries.find({"company_id": company_id}, {"_id": 0})
    journals = await cursor2.to_list(200)

    matches = []
    for txn in txns:
        for journal in journals:
            txn_amount = txn.get("amount", 0)
            journal_total = journal.get("total_debit", 0)
            if abs(txn_amount - journal_total) < 1.0:
                matches.append({
                    "id": str(uuid.uuid4()),
                    "company_id": company_id,
                    "transaction_id": txn["id"],
                    "journal_id": journal["id"],
                    "match_type": "auto",
                    "status": "pending",
                    "matched_amount": txn_amount,
                    "created_at": now,
                })
                break

    inserted = 0
    for match in matches:
        existing = await db.reconciliation_matches.find_one({
            "transaction_id": match["transaction_id"],
            "company_id": company_id
        })
        if not existing:
            await db.reconciliation_matches.insert_one(match)
            inserted += 1

    return {"message": f"Found {inserted} new matches", "count": inserted}


@router.post("/confirm")
async def confirm_match(body: ConfirmMatch, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    now = datetime.now(timezone.utc)
    existing = await db.reconciliation_matches.find_one({
        "transaction_id": body.transaction_id,
        "company_id": company_id
    })
    if existing:
        await db.reconciliation_matches.update_one(
            {"transaction_id": body.transaction_id, "company_id": company_id},
            {"$set": {"status": "confirmed", "confirmed_at": now}}
        )
    else:
        await db.reconciliation_matches.insert_one({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "transaction_id": body.transaction_id,
            "journal_id": body.journal_id,
            "match_type": "manual",
            "status": "confirmed",
            "created_at": now,
            "confirmed_at": now,
        })
    return {"message": "Match confirmed"}


@router.get("/summary")
async def reconciliation_summary(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    total_txns = await db.transactions.count_documents({"company_id": company_id})
    reconciled = await db.reconciliation_matches.count_documents({"company_id": company_id, "status": "confirmed"})
    return {
        "total_transactions": total_txns,
        "reconciled": reconciled,
        "unreconciled": total_txns - reconciled,
        "reconciliation_rate": round((reconciled / total_txns * 100) if total_txns > 0 else 0, 1)
    }
