from typing import Tuple, List, Dict

CLASSIFICATION_RULES = [
    {"keywords": ["salary", "payroll", "wages", "remuneration", "staff payment", "hrm"],
     "category": "Salary Expense", "account_code": "5010", "confidence": 0.95},
    {"keywords": ["rent", "lease", "landlord", "office rent", "shop rent"],
     "category": "Rent Expense", "account_code": "5020", "confidence": 0.95},
    {"keywords": ["electricity", "water bill", "gas bill", "utility", "power bill", "internet", "broadband", "telecom"],
     "category": "Utilities", "account_code": "5030", "confidence": 0.92},
    {"keywords": ["bank charge", "service charge", "bank service", "bank fee", "maintenance charge", "transaction fee"],
     "category": "Bank Charges", "account_code": "5040", "confidence": 0.95},
    {"keywords": ["stationery", "office supply", "office supplies", "paper", "printer", "cartridge"],
     "category": "Office Supplies", "account_code": "5050", "confidence": 0.88},
    {"keywords": ["gst", "igst", "cgst", "sgst", "tax payment", "advance tax", "tds", "income tax"],
     "category": "GST/Tax Payment", "account_code": "5060", "confidence": 0.90},
    {"keywords": ["client payment", "customer payment", "receipt from", "invoice payment"],
     "category": "Sales Revenue", "account_code": "4010", "confidence": 0.88},
    {"keywords": ["consulting fee", "consulting", "service revenue", "professional fee", "advisory", "project payment", "milestone"],
     "category": "Service Revenue", "account_code": "4020", "confidence": 0.88},
    {"keywords": ["insurance", "premium", "policy premium"],
     "category": "Insurance Expense", "account_code": "5070", "confidence": 0.90},
    {"keywords": ["travel", "flight", "hotel", "accommodation", "cab", "transport", "fuel", "conference"],
     "category": "Travel Expense", "account_code": "5070", "confidence": 0.85},
    {"keywords": ["laptop", "computer", "server", "machinery", "equipment purchase", "furniture", "vehicle", "air conditioner"],
     "category": "Asset Purchase", "account_code": "1100", "confidence": 0.85},
    {"keywords": ["interest income", "dividend", "refund", "cashback", "savings interest"],
     "category": "Other Income", "account_code": "4030", "confidence": 0.85},
    {"keywords": ["opening balance", "initial deposit", "capital contribution"],
     "category": "Owner's Equity", "account_code": "3010", "confidence": 0.80},
]

ACCOUNT_NAMES = {
    "5010": "Salary Expense", "5020": "Rent Expense", "5030": "Utilities",
    "5040": "Bank Charges", "5050": "Office Supplies", "5060": "GST/Tax Expense",
    "5070": "Miscellaneous Expense", "4010": "Sales Revenue", "4020": "Service Revenue",
    "4030": "Other Income", "1100": "Fixed Assets", "3010": "Owner's Equity"
}


def classify_transaction(narration: str, amount: float) -> Tuple[str, str, str, float]:
    """Returns (category, account_code, account_name, confidence)"""
    narration_lower = narration.lower()
    best_match = None
    best_confidence = 0.0

    for rule in CLASSIFICATION_RULES:
        for keyword in rule["keywords"]:
            if keyword in narration_lower:
                if rule["confidence"] > best_confidence:
                    best_match = rule
                    best_confidence = rule["confidence"]
                    break

    if amount > 50000 and best_match is None:
        return "Potential Asset", "1100", "Fixed Assets", 0.60

    if best_match:
        account_name = ACCOUNT_NAMES.get(best_match["account_code"], best_match["category"])
        return best_match["category"], best_match["account_code"], account_name, best_confidence

    return "Unclassified", "5070", "Miscellaneous Expense", 0.0


def batch_classify(transactions: List[Dict]) -> List[Dict]:
    results = []
    for txn in transactions:
        category, account_code, account_name, confidence = classify_transaction(
            txn.get("narration", ""), txn.get("amount", 0)
        )
        results.append({
            **txn,
            "category": category,
            "account_code": account_code,
            "account_name": account_name,
            "confidence": confidence,
            "is_ai_classified": True,
            "status": "classified" if category != "Unclassified" else "unclassified"
        })
    return results
