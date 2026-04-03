import uuid
import io
import csv
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from auth_utils import get_current_user
from ai_engine import classify_transaction, batch_classify

router = APIRouter()


class ClassifyRequest(BaseModel):
    category: str
    account_code: str
    account_name: str


@router.get("")
async def list_transactions(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    query = {"company_id": company_id}
    if category:
        query["category"] = category
    if type:
        query["type"] = type
    if status:
        query["status"] = status
    if search:
        query["narration"] = {"$regex": search, "$options": "i"}

    total = await db.transactions.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)

    for item in items:
        if isinstance(item.get("date"), datetime):
            item["date"] = item["date"].isoformat()
        if isinstance(item.get("created_at"), datetime):
            item["created_at"] = item["created_at"].isoformat()

    return {"items": items, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}


@router.post("/upload")
async def upload_bank_statement(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    content = await file.read()
    now = datetime.now(timezone.utc)
    transactions = []

    try:
        if file.filename.endswith(".csv"):
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
        else:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(content))
            rows = df.to_dict(orient="records")

        for row in rows:
            # Support multiple column name formats
            keys = {k.strip().lower(): v for k, v in row.items()}
            date_str = str(keys.get("date", keys.get("txn_date", keys.get("transaction_date", "")))).strip()
            narration = str(keys.get("narration", keys.get("description", keys.get("particulars", "")))).strip()
            amount_str = str(keys.get("amount", keys.get("credit", keys.get("debit", "0")))).replace(",", "").strip()
            txn_type = str(keys.get("type", keys.get("dr/cr", "debit"))).strip().lower()

            if not date_str or not narration:
                continue

            try:
                amount = float(amount_str) if amount_str else 0.0
            except ValueError:
                amount = 0.0

            try:
                date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                try:
                    date = datetime.strptime(date_str, "%d/%m/%Y").replace(tzinfo=timezone.utc)
                except ValueError:
                    date = now

            category, account_code, account_name, confidence = classify_transaction(narration, amount)

            transactions.append({
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "date": date,
                "narration": narration,
                "amount": abs(amount),
                "type": txn_type if txn_type in ["credit", "debit"] else "debit",
                "category": category,
                "account_code": account_code,
                "account_name": account_name,
                "confidence": confidence,
                "is_ai_classified": True,
                "status": "classified" if category != "Unclassified" else "unclassified",
                "created_at": now,
            })

        if transactions:
            await db.transactions.insert_many(transactions)

        return {"message": f"Imported {len(transactions)} transactions", "count": len(transactions)}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


@router.patch("/{txn_id}/classify")
async def classify_transaction_manual(txn_id: str, body: ClassifyRequest, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    result = await db.transactions.update_one(
        {"id": txn_id, "company_id": company_id},
        {"$set": {
            "category": body.category,
            "account_code": body.account_code,
            "account_name": body.account_name,
            "status": "classified",
            "is_ai_classified": False,
            "confidence": 1.0,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction classified"}


@router.post("/ai-classify-all")
async def ai_classify_all(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    cursor = db.transactions.find({"company_id": company_id, "status": "unclassified"}, {"_id": 0})
    unclassified = await cursor.to_list(500)

    updated = 0
    for txn in unclassified:
        category, account_code, account_name, confidence = classify_transaction(
            txn.get("narration", ""), txn.get("amount", 0)
        )
        if category != "Unclassified":
            await db.transactions.update_one(
                {"id": txn["id"]},
                {"$set": {"category": category, "account_code": account_code,
                           "account_name": account_name, "confidence": confidence,
                           "status": "classified", "is_ai_classified": True}}
            )
            updated += 1

    return {"message": f"Classified {updated} transactions", "count": updated}


@router.get("/insights")
async def get_insights(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    unclassified = await db.transactions.count_documents({"company_id": company_id, "status": "unclassified"})
    total = await db.transactions.count_documents({"company_id": company_id})

    alerts = []
    if unclassified > 0:
        alerts.append({"type": "warning", "message": f"{unclassified} transaction(s) need classification"})

    # Check for large unusual transactions
    cursor = db.transactions.find({"company_id": company_id}, {"_id": 0, "amount": 1, "narration": 1, "date": 1})
    all_txns = await cursor.to_list(1000)
    if all_txns:
        avg = sum(t["amount"] for t in all_txns) / len(all_txns)
        large = [t for t in all_txns if t["amount"] > avg * 3]
        if large:
            alerts.append({"type": "info", "message": f"{len(large)} unusually large transaction(s) detected"})

    return {"alerts": alerts, "total_transactions": total, "unclassified_count": unclassified}


@router.get("/categories")
async def get_categories(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    categories = await db.transactions.distinct("category", {"company_id": company_id})
    return {"categories": sorted(categories)}
