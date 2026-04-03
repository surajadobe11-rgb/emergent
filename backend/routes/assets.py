import uuid
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from auth_utils import get_current_user

router = APIRouter()


class AssetCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    purchase_date: str
    purchase_cost: float
    useful_life_years: int
    salvage_value: float = 0.0
    depreciation_method: str = "SLM"
    wdv_rate: float = 0.0
    account_code: str = "1100"


def calculate_depreciation(asset: dict, as_of_date: datetime = None) -> dict:
    if as_of_date is None:
        as_of_date = datetime.now(timezone.utc)

    purchase_date = asset.get("purchase_date")
    if isinstance(purchase_date, str):
        purchase_date = datetime.fromisoformat(purchase_date)
    if purchase_date and purchase_date.tzinfo is None:
        purchase_date = purchase_date.replace(tzinfo=timezone.utc)

    cost = asset.get("purchase_cost", 0)
    salvage = asset.get("salvage_value", 0)
    useful_life = asset.get("useful_life_years", 1)
    method = asset.get("depreciation_method", "SLM")
    wdv_rate = asset.get("wdv_rate", 0.25)

    years = max((as_of_date - purchase_date).days / 365.25, 0) if purchase_date else 0

    if method == "SLM":
        annual_dep = (cost - salvage) / useful_life if useful_life > 0 else 0
        accumulated = min(annual_dep * years, cost - salvage)
    else:  # WDV
        accumulated = cost * (1 - (1 - wdv_rate) ** years)
        accumulated = min(accumulated, cost - salvage)

    accumulated = round(accumulated, 2)
    net_book_value = round(cost - accumulated, 2)

    return {"accumulated_depreciation": accumulated, "net_book_value": net_book_value}


def serialize_asset(a: dict) -> dict:
    if isinstance(a.get("purchase_date"), datetime):
        a["purchase_date"] = a["purchase_date"].isoformat()
    if isinstance(a.get("created_at"), datetime):
        a["created_at"] = a["created_at"].isoformat()
    a.pop("_id", None)
    return a


@router.get("")
async def list_assets(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    cursor = db.fixed_assets.find({"company_id": company_id}, {"_id": 0}).sort("purchase_date", -1)
    assets = await cursor.to_list(200)
    return {"assets": [serialize_asset(a) for a in assets]}


@router.post("")
async def create_asset(body: AssetCreate, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    try:
        purchase_date = datetime.strptime(body.purchase_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    now = datetime.now(timezone.utc)
    dep = calculate_depreciation({
        "purchase_date": purchase_date, "purchase_cost": body.purchase_cost,
        "salvage_value": body.salvage_value, "useful_life_years": body.useful_life_years,
        "depreciation_method": body.depreciation_method, "wdv_rate": body.wdv_rate
    }, now)

    asset = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "name": body.name,
        "description": body.description,
        "purchase_date": purchase_date,
        "purchase_cost": body.purchase_cost,
        "useful_life_years": body.useful_life_years,
        "salvage_value": body.salvage_value,
        "depreciation_method": body.depreciation_method,
        "wdv_rate": body.wdv_rate,
        "accumulated_depreciation": dep["accumulated_depreciation"],
        "net_book_value": dep["net_book_value"],
        "account_code": body.account_code,
        "status": "active",
        "created_at": now,
    }
    await db.fixed_assets.insert_one(asset)
    return serialize_asset(asset)


@router.post("/{asset_id}/depreciate")
async def depreciate_asset(asset_id: str, request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    asset = await db.fixed_assets.find_one({"id": asset_id, "company_id": company_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    dep = calculate_depreciation(asset)
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {"accumulated_depreciation": dep["accumulated_depreciation"],
                  "net_book_value": dep["net_book_value"]}}
    )
    return {"message": "Depreciation calculated", **dep}


@router.get("/potential")
async def get_potential_assets(request: Request):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")
    cursor = db.transactions.find(
        {"company_id": company_id, "account_code": "1100", "type": "debit"},
        {"_id": 0}
    ).sort("amount", -1)
    items = await cursor.to_list(50)
    for item in items:
        if isinstance(item.get("date"), datetime):
            item["date"] = item["date"].isoformat()
    return {"items": items}
