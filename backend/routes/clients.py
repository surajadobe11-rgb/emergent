import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from auth_utils import get_current_user
from seed import CHART_OF_ACCOUNTS

router = APIRouter()


class ClientCreate(BaseModel):
    name: str
    gst_number: Optional[str] = ""
    address: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.get("")
async def list_clients(request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Only admins can manage clients")
    db = request.app.state.db

    cursor = db.companies.find({}, {"_id": 0})
    companies = await cursor.to_list(100)

    for company in companies:
        cid = company["id"]
        company["transaction_count"] = await db.transactions.count_documents({"company_id": cid})
        company["journal_count"]     = await db.journal_entries.count_documents({"company_id": cid})
        company["asset_count"]       = await db.fixed_assets.count_documents({"company_id": cid})
        if isinstance(company.get("created_at"), datetime):
            company["created_at"] = company["created_at"].isoformat()

    return {"clients": companies}


@router.post("")
async def create_client(body: ClientCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Only admins can create clients")
    db = request.app.state.db

    company_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db.companies.insert_one({
        "id": company_id,
        "name": body.name,
        "gst_number": body.gst_number or "",
        "address": body.address or "",
        "email": body.email or "",
        "phone": body.phone or "",
        "currency": "INR",
        "created_at": now,
    })

    # Seed default COA
    for acc in CHART_OF_ACCOUNTS:
        await db.chart_of_accounts.update_one(
            {"code": acc["code"], "company_id": company_id},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "code": acc["code"],
                "name": acc["name"],
                "type": acc["type"],
                "is_active": True,
                "created_at": now,
            }},
            upsert=True
        )

    return {"message": "Client created", "id": company_id, "name": body.name}


@router.get("/{client_id}")
async def get_client(client_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    db = request.app.state.db
    company = await db.companies.find_one({"id": client_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Client not found")
    if isinstance(company.get("created_at"), datetime):
        company["created_at"] = company["created_at"].isoformat()
    return company


@router.put("/{client_id}")
async def update_client(client_id: str, body: ClientUpdate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    db = request.app.state.db
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.companies.update_one({"id": client_id}, {"$set": update})
    return {"message": "Client updated"}


@router.delete("/{client_id}")
async def delete_client(client_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    if client_id == "acme-tech-001":
        raise HTTPException(400, "Cannot delete the default demo client")
    db = request.app.state.db
    await db.companies.delete_one({"id": client_id})
    for col in ["transactions", "journal_entries", "fixed_assets",
                "chart_of_accounts", "reconciliation_matches"]:
        await getattr(db, col).delete_many({"company_id": client_id})
    return {"message": "Client and all associated data deleted"}
