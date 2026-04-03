from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

from routes.auth_routes import router as auth_router
from routes.transactions import router as transactions_router
from routes.journals import router as journals_router
from routes.assets import router as assets_router
from routes.reconciliation import router as reconciliation_router
from routes.reports import router as reports_router
from routes.settings import router as settings_router
from routes.clients import router as clients_router
from routes.export_routes import router as export_router
from routes.gst import router as gst_router
from seed import seed_all

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="FinAI Accounting Platform")
app.state.db = db

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
api_router.include_router(journals_router, prefix="/journals", tags=["journals"])
api_router.include_router(assets_router, prefix="/assets", tags=["assets"])
api_router.include_router(reconciliation_router, prefix="/reconciliation", tags=["reconciliation"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(clients_router, prefix="/clients", tags=["clients"])
api_router.include_router(export_router, prefix="/export", tags=["export"])
api_router.include_router(gst_router, prefix="/gst", tags=["gst"])


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "FinAI Accounting Platform"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    try:
        await seed_all(db)
        logger.info("FinAI Accounting Platform started. Seed data loaded.")
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
