import uuid
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_name: str = "My Company"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(body: RegisterRequest, request: Request):
    db = request.app.state.db
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    company_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Create company
    await db.companies.insert_one({
        "id": company_id,
        "name": body.company_name,
        "gst_number": "",
        "address": "",
        "email": email,
        "currency": "INR",
        "created_at": now,
    })

    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "admin",
        "company_id": company_id,
        "created_at": now,
    })

    access_token = create_access_token(user_id, email, "admin")
    refresh_token = create_refresh_token(user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user_id, "email": email, "name": body.name, "role": "admin", "company_id": company_id}
    }


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    db = request.app.state.db
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email, user["role"])
    refresh_token = create_refresh_token(user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "email": email,
            "name": user.get("name", ""),
            "role": user["role"],
            "company_id": user.get("company_id", "")
        }
    }


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    return user


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}
