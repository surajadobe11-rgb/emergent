import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr
from auth_utils import get_current_user, hash_password

router = APIRouter()


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "accountant"


class COACreate(BaseModel):
    code: str
    name: str
    type: str


@router.get("/company")
async def get_company(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return {"name": "My Company", "gst_number": "", "address": "", "email": "", "currency": "INR"}
    if isinstance(company.get("created_at"), datetime):
        company["created_at"] = company["created_at"].isoformat()
    return company


@router.put("/company")
async def update_company(body: CompanyUpdate, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.companies.update_one({"id": company_id}, {"$set": update})
    return {"message": "Company updated"}


@router.get("/users")
async def list_users(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    cursor = db.users.find({"company_id": company_id}, {"_id": 0, "password_hash": 0})
    users = await cursor.to_list(100)
    for u in users:
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
    return {"users": users}


@router.post("/users")
async def create_user(body: UserCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if body.role not in ["admin", "accountant", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    now = datetime.now(timezone.utc)
    new_user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "company_id": company_id,
        "created_at": now,
    }
    await db.users.insert_one(new_user)
    return {"message": "User created", "id": new_user["id"]}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    if user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id, "company_id": company_id})
    return {"message": "User deleted"}


@router.get("/coa")
async def get_coa(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    cursor = db.chart_of_accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1)
    accounts = await cursor.to_list(200)
    for a in accounts:
        if isinstance(a.get("created_at"), datetime):
            a["created_at"] = a["created_at"].isoformat()
    return {"accounts": accounts}


@router.post("/coa")
async def create_coa(body: COACreate, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    if body.type not in ["asset", "liability", "equity", "revenue", "expense"]:
        raise HTTPException(status_code=400, detail="Invalid account type")

    existing = await db.chart_of_accounts.find_one({"code": body.code, "company_id": company_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code {body.code} already exists")

    now = datetime.now(timezone.utc)
    account = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "code": body.code,
        "name": body.name,
        "type": body.type,
        "is_active": True,
        "created_at": now,
    }
    await db.chart_of_accounts.insert_one(account)
    return {"message": "Account created", "account": {k: v for k, v in account.items() if k not in ["_id"]}}
