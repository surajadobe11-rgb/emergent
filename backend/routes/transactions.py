import uuid
import io
import csv
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from auth_utils import get_current_user
from ai_engine import classify_transaction

router = APIRouter()

# ── Smart Column Detection ────────────────────────────────────────────────────

DATE_KEYWORDS     = ['date', 'txn date', 'transaction date', 'posting date', 'value date',
                     'tran date', 'trans date', 'entry date', 'cheque date', 'book date',
                     'trade date', 'effective date', 'value dt', 'txn dt']

NARRATION_KEYWORDS = ['narration', 'description', 'particulars', 'remarks',
                      'transaction remarks', 'transaction description', 'details',
                      'narrative', 'trans description', 'transaction details',
                      'transaction particular', 'transaction narration', 'chq particulars',
                      'trans particulars', 'beneficiary', 'merchant name']

DEBIT_KEYWORDS    = ['withdrawal', 'debit', 'dr', 'debit amount', 'withdrawal amt',
                     'debit amt', 'withdrawals', 'debit (inr)', 'withdrawal(inr)',
                     'debit amount (inr)', 'dr amount', 'dr amt', 'amount dr',
                     'withdrawal amount', 'payment amount']

CREDIT_KEYWORDS   = ['deposit', 'credit', 'cr', 'credit amount', 'deposit amt',
                     'credit amt', 'deposits', 'credit (inr)', 'deposit(inr)',
                     'credit amount (inr)', 'cr amount', 'cr amt', 'amount cr',
                     'deposit amount', 'received amount']

AMOUNT_KEYWORDS   = ['amount', 'amt', 'transaction amount', 'trans amount',
                     'net amount', 'transaction amt']

TYPE_KEYWORDS     = ['type', 'dr/cr', 'cr/dr', 'transaction type', 'dr / cr',
                     'debit/credit', 'txn type', 'mode']


def _match(headers_lower: dict, keywords: list, exclude: str = None) -> Optional[str]:
    """Return the first matching original header for the given keyword list."""
    for kw in keywords:
        for h_low, h_orig in headers_lower.items():
            if exclude and exclude.lower() in h_low:
                continue
            if h_low == kw:
                return h_orig
    for kw in keywords:
        for h_low, h_orig in headers_lower.items():
            if exclude and exclude.lower() in h_low:
                continue
            if kw in h_low:
                return h_orig
    return None


def detect_columns(headers: list) -> dict:
    hl = {str(h).strip().lower(): str(h) for h in headers if str(h).strip()}
    res = {}

    d = _match(hl, DATE_KEYWORDS)
    if d: res['date'] = d

    n = _match(hl, NARRATION_KEYWORDS)
    if n: res['narration'] = n

    # Debit and credit — avoid picking same column for both
    db_col = _match(hl, DEBIT_KEYWORDS, exclude='credit')
    cr_col = _match(hl, CREDIT_KEYWORDS, exclude='debit')
    if db_col and cr_col and db_col == cr_col:
        cr_col = None
    if db_col: res['debit_col'] = db_col
    if cr_col: res['credit_col'] = cr_col

    # Single amount column only when no separate debit/credit
    if not db_col and not cr_col:
        a = _match(hl, AMOUNT_KEYWORDS)
        if a: res['amount_col'] = a
        t = _match(hl, TYPE_KEYWORDS)
        if t: res['type_col'] = t

    return res


# ── Amount / Date Parsers ─────────────────────────────────────────────────────

DATE_FORMATS = [
    "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y",
    "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d",
    "%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%d-%B-%Y",
    "%d %b %y", "%d-%b-%y",
    "%d.%m.%Y", "%d.%m.%y", "%b %d, %Y", "%m-%d-%Y",
]


def parse_date(value, fallback: datetime) -> datetime:
    if value is None:
        return fallback
    s = str(value).strip().split(' ')[0] if ' ' in str(value) else str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Try the full string too
    s_full = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s_full, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return fallback


def parse_amount(value) -> tuple:
    """
    Returns (amount: float, txn_type: str)
    txn_type is 'debit', 'credit', or '' (unknown)
    Handles: '1,234.56', '-5000', '5,000 CR', '50000DR', '₹12,500.00', etc.
    """
    if value is None:
        return 0.0, ''
    s = str(value).strip()
    if s in ('', 'nan', 'None', '-', 'N/A', 'NA', 'nil', 'NIL'):
        return 0.0, ''

    # Strip currency symbols and whitespace
    s = re.sub(r'[₹$€£\s]', '', s)
    # Remove commas used as thousands separators
    s = s.replace(',', '')

    suffix = ''
    if s.upper().endswith('CR'):
        suffix = 'credit'
        s = s[:-2]
    elif s.upper().endswith('DR'):
        suffix = 'debit'
        s = s[:-2]

    # Remove parentheses (some banks use (500) for negative)
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]

    try:
        amount = float(s)
    except ValueError:
        return 0.0, ''

    if amount < 0:
        return abs(amount), 'debit'
    if amount == 0:
        return 0.0, ''
    return amount, suffix  # suffix may be '' = unknown


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


def _read_pdf(content: bytes) -> list:
    """
    Extract transaction rows from a bank statement PDF using pdfplumber.
    Handles multi-page PDFs, auto-detects the transaction table, and
    preserves the header from page 1 across all subsequent pages.
    Falls back to text-line parsing when no tables are found.
    """
    import pdfplumber

    all_rows: list = []
    headers: list = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "snap_tolerance": 5,
                "join_tolerance": 3,
            })

            # Fallback: try text strategy when line strategy returns nothing
            if not tables:
                tables = page.extract_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                })

            for table in tables:
                if not table or len(table) < 2:
                    continue

                # Clean each cell
                clean = [[str(c or '').replace('\n', ' ').strip() for c in row]
                         for row in table]

                if not headers:
                    # Find the header row: first row whose text hints at transaction columns
                    for i, row in enumerate(clean):
                        row_text = ' '.join(row).lower()
                        if any(k in row_text for k in
                               ['date', 'narration', 'description', 'debit',
                                'credit', 'withdrawal', 'deposit', 'amount',
                                'particulars', 'remarks', 'balance']):
                            headers = row
                            data_rows = clean[i + 1:]
                            break
                    else:
                        continue          # no recognisable header in this table
                else:
                    # Subsequent pages: the same table layout, data starts at row 0
                    # unless the first row looks like a repeat of the header
                    first = clean[0]
                    if first and any(str(h).lower() == str(first[0]).lower()
                                     for h in headers[:2]):
                        data_rows = clean[1:]    # skip repeated header
                    else:
                        data_rows = clean

                for row in data_rows:
                    if not any(c for c in row):
                        continue
                    # Pad / trim to match header length
                    padded = (row + [''] * len(headers))[:len(headers)]
                    row_dict = {headers[j]: padded[j] for j in range(len(headers))}
                    all_rows.append(row_dict)

    if all_rows:
        return all_rows

    # ── Fallback: text-line heuristic (for PDFs with no extractable tables) ──
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)

    lines = [l.strip() for l in full_text.splitlines() if l.strip()]
    if not lines:
        return []

    # Try to find a header line
    header_idx = None
    for i, line in enumerate(lines):
        ll = line.lower()
        if sum(1 for k in ['date', 'description', 'narration', 'amount',
                            'debit', 'credit', 'balance'] if k in ll) >= 2:
            header_idx = i
            break

    if header_idx is None:
        return []

    # Use whitespace splitting — works for fixed-width PDFs
    raw_headers = lines[header_idx].split()
    date_re = re.compile(r'\d{1,2}[-/]\w{2,3}[-/]\d{2,4}|\d{2,4}[-/]\d{2}[-/]\d{2,4}')

    for line in lines[header_idx + 1:]:
        if not date_re.search(line):
            continue
        parts = line.split()
        row_dict = {raw_headers[j]: parts[j] if j < len(parts) else ''
                    for j in range(len(raw_headers))}
        all_rows.append(row_dict)

    return all_rows


def _read_file(content: bytes, filename: str) -> list:
    """Parse CSV, Excel, or PDF into a list of row dicts."""
    fname = filename.lower()

    if fname.endswith('.pdf'):
        return _read_pdf(content)

    if fname.endswith('.csv') or fname.endswith('.txt'):
        for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        sample = text[:2048]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',\t;|')
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        return list(reader)

    else:  # Excel
        import pandas as pd
        raw = pd.read_excel(io.BytesIO(content), header=None, dtype=str)
        raw = raw.fillna('')
        header_idx = 0
        for i, row in raw.iterrows():
            non_empty = sum(1 for v in row if str(v).strip())
            if non_empty >= 3:
                header_idx = i
                break
        df = pd.read_excel(io.BytesIO(content), header=header_idx, dtype=str)
        df = df.fillna('')
        return df.to_dict(orient='records')


@router.post("/preview")
async def preview_statement(request: Request, file: UploadFile = File(...)):
    """Return detected column mapping + first 5 rows without importing."""
    await get_current_user(request)
    content = await file.read()
    try:
        rows = _read_file(content, file.filename)
        if not rows:
            return {"headers": [], "detected_columns": {}, "preview_rows": [], "total_rows": 0}
        headers = [str(h) for h in rows[0].keys()]
        cols = detect_columns(headers)
        preview = [{str(h): str(r.get(h, '')) for h in headers} for r in rows[:5]]
        return {
            "headers": headers,
            "detected_columns": {
                "date":     cols.get('date', ''),
                "narration": cols.get('narration', ''),
                "debit":    cols.get('debit_col', ''),
                "credit":   cols.get('credit_col', ''),
                "amount":   cols.get('amount_col', ''),
                "type":     cols.get('type_col', ''),
            },
            "preview_rows": preview,
            "total_rows": len(rows),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload")
async def upload_bank_statement(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    db = request.app.state.db
    company_id = user.get("company_id", "acme-tech-001")

    content = await file.read()
    now = datetime.now(timezone.utc)
    transactions = []
    skipped = 0

    try:
        rows = _read_file(content, file.filename)
        if not rows:
            raise HTTPException(status_code=400, detail="File is empty or has no data rows")

        headers = list(rows[0].keys())
        cols = detect_columns(headers)

        # Friendly error if nothing detected
        if not cols.get('date') and not cols.get('narration') and not cols.get('debit_col') and not cols.get('amount_col'):
            raise HTTPException(
                status_code=400,
                detail=f"Could not auto-detect columns from headers: {headers}. "
                       f"Expected columns like: Date, Narration/Description, Debit/Credit or Amount/Type."
            )

        for row in rows:
            # ── Date ──────────────────────────────────────────────
            date_raw = row.get(cols.get('date', ''), '') if cols.get('date') else ''
            date = parse_date(date_raw, now)

            # ── Narration ─────────────────────────────────────────
            narration = ''
            if cols.get('narration'):
                narration = str(row.get(cols['narration'], '')).strip()
            if not narration or narration in ('nan', 'None'):
                # Fallback: pick first string column with 4+ chars
                for h in headers:
                    v = str(row.get(h, '')).strip()
                    if len(v) >= 4 and not re.match(r'^[\d,.\-/ ]+$', v):
                        narration = v
                        break
            if not narration or narration in ('nan', 'None'):
                skipped += 1
                continue

            # ── Amount & Type ──────────────────────────────────────
            amount, txn_type = 0.0, ''

            if cols.get('debit_col') or cols.get('credit_col'):
                # Separate debit / credit columns (HDFC, ICICI, SBI style)
                d_raw = row.get(cols.get('debit_col', ''), '') if cols.get('debit_col') else ''
                c_raw = row.get(cols.get('credit_col', ''), '') if cols.get('credit_col') else ''
                d_amt, _ = parse_amount(d_raw)
                c_amt, _ = parse_amount(c_raw)
                if d_amt > 0:
                    amount, txn_type = d_amt, 'debit'
                elif c_amt > 0:
                    amount, txn_type = c_amt, 'credit'
                else:
                    skipped += 1
                    continue

            elif cols.get('amount_col'):
                # Single amount column + optional type column
                a_raw = row.get(cols['amount_col'], '')
                amount, inferred = parse_amount(a_raw)
                if amount == 0:
                    skipped += 1
                    continue
                if inferred:
                    txn_type = inferred
                elif cols.get('type_col'):
                    t_raw = str(row.get(cols['type_col'], '')).strip().lower()
                    txn_type = 'credit' if any(x in t_raw for x in ['cr', 'credit', 'c', 'deposit', 'd']) else 'debit'
                else:
                    txn_type = 'debit'

            else:
                # Last resort — scan all numeric columns
                for h in headers:
                    if h in (cols.get('date', ''), cols.get('narration', '')):
                        continue
                    v = row.get(h, '')
                    amt, inferred = parse_amount(v)
                    if amt > 0:
                        amount, txn_type = amt, inferred or 'debit'
                        break
                if amount == 0:
                    skipped += 1
                    continue

            # ── AI Classify ───────────────────────────────────────
            category, account_code, account_name, confidence = classify_transaction(narration, amount)

            transactions.append({
                "id":             str(uuid.uuid4()),
                "company_id":     company_id,
                "date":           date,
                "narration":      narration,
                "amount":         round(amount, 2),
                "type":           txn_type,
                "category":       category,
                "account_code":   account_code,
                "account_name":   account_name,
                "confidence":     confidence,
                "is_ai_classified": True,
                "status":         "classified" if category != "Unclassified" else "unclassified",
                "created_at":     now,
            })

        if transactions:
            await db.transactions.insert_many(transactions)

        classified = sum(1 for t in transactions if t['status'] == 'classified')
        return {
            "message": f"Imported {len(transactions)} transactions ({classified} auto-classified)",
            "count": len(transactions),
            "classified": classified,
            "unclassified": len(transactions) - classified,
            "skipped": skipped,
            "detected_columns": {
                "date":     cols.get('date', 'not detected'),
                "narration": cols.get('narration', 'not detected'),
                "debit":    cols.get('debit_col', ''),
                "credit":   cols.get('credit_col', ''),
                "amount":   cols.get('amount_col', ''),
                "type":     cols.get('type_col', ''),
            },
        }

    except HTTPException:
        raise
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
