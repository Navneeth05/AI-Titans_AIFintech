"""
app/services/pdf_parser.py
──────────────────────────
Extracts structured transaction rows from a bank-statement PDF.

Strategy (tried in order)
─────────────────────────
1. pdfplumber  – table extraction (best for PDFs with embedded tables)
2. PyMuPDF     – raw text extraction + regex heuristics (fallback)

Each extracted row is normalised to:
    {date, description, amount, balance, transaction_type}
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

# ── Optional heavy imports (graceful degradation) ─────────────────────────────
try:
    import pdfplumber
    _HAS_PDFPLUMBER = True
except ImportError:
    _HAS_PDFPLUMBER = False

try:
    import fitz  # PyMuPDF
    _HAS_PYMUPDF = True
except ImportError:
    _HAS_PYMUPDF = False


# ── Data class ────────────────────────────────────────────────────────────────

@dataclass
class ParsedTransaction:
    date: Optional[datetime]
    description: str
    amount: Decimal
    balance: Optional[Decimal]
    transaction_type: str = "debit"   # credit | debit
    raw_row: list[str] = field(default_factory=list)


# ── Date patterns ─────────────────────────────────────────────────────────────

_DATE_PATTERNS = [
    "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
    "%d %b %Y", "%d %B %Y",
    "%d/%m/%y", "%d-%m-%y",
    "%b %d, %Y", "%B %d, %Y",
]


def _parse_date(raw: str) -> Optional[datetime]:
    raw = raw.strip()
    for fmt in _DATE_PATTERNS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Optional[Decimal]:
    """Remove currency symbols / commas and return Decimal."""
    cleaned = re.sub(r"[₹$€£,\s]", "", raw.strip())
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _infer_type(amount: Decimal, description: str, cr_dr_hint: str = "") -> str:
    hint = cr_dr_hint.strip().upper()
    if hint in ("CR", "CREDIT", "C"):
        return "credit"
    if hint in ("DR", "DEBIT", "D"):
        return "debit"
    credit_kw = re.compile(
        r"\b(credit|salary|refund|interest|reversal|cashback|deposit|transfer in)\b",
        re.IGNORECASE,
    )
    return "credit" if credit_kw.search(description) else "debit"


# ── pdfplumber extraction ─────────────────────────────────────────────────────

def _extract_with_pdfplumber(pdf_path: Path) -> list[ParsedTransaction]:
    rows: list[ParsedTransaction] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                header = [str(c).lower().strip() if c else "" for c in table[0]]

                # Try to locate column indices
                date_idx   = _find_col(header, ["date"])
                desc_idx   = _find_col(header, ["description", "narration", "particulars", "details"])
                amt_idx    = _find_col(header, ["amount", "debit", "withdrawal", "credit"])
                bal_idx    = _find_col(header, ["balance", "closing"])
                crdr_idx   = _find_col(header, ["cr/dr", "type", "dr/cr"])

                for raw_row in table[1:]:
                    if not raw_row or all(c is None or str(c).strip() == "" for c in raw_row):
                        continue
                    cells = [str(c).strip() if c else "" for c in raw_row]

                    date_str = cells[date_idx] if date_idx is not None and date_idx < len(cells) else ""
                    desc     = cells[desc_idx] if desc_idx is not None and desc_idx < len(cells) else " ".join(cells)
                    amt_str  = cells[amt_idx]  if amt_idx  is not None and amt_idx  < len(cells) else ""
                    bal_str  = cells[bal_idx]  if bal_idx  is not None and bal_idx  < len(cells) else ""
                    crdr     = cells[crdr_idx] if crdr_idx is not None and crdr_idx < len(cells) else ""

                    amount = _parse_amount(amt_str)
                    if amount is None:
                        continue  # skip non-transaction rows

                    rows.append(
                        ParsedTransaction(
                            date=_parse_date(date_str),
                            description=desc,
                            amount=abs(amount),
                            balance=_parse_amount(bal_str),
                            transaction_type=_infer_type(amount, desc, crdr),
                            raw_row=cells,
                        )
                    )
    return rows


def _find_col(header: list[str], keywords: list[str]) -> Optional[int]:
    for kw in keywords:
        for i, h in enumerate(header):
            if kw in h:
                return i
    return None


# ── PyMuPDF fallback ──────────────────────────────────────────────────────────

# Regex: (date) (description) (amount) (optional balance)
_ROW_RE = re.compile(
    r"(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w{3}\s+\d{4})"  # date
    r"\s+"
    r"(.+?)"                                                             # description
    r"\s+"
    r"([\d,]+\.\d{2})"                                                  # amount
    r"(?:\s+([\d,]+\.\d{2}))?",                                         # optional balance
    re.IGNORECASE,
)


def _extract_with_pymupdf(pdf_path: Path) -> list[ParsedTransaction]:
    rows: list[ParsedTransaction] = []
    doc = fitz.open(str(pdf_path))
    for page in doc:
        text = page.get_text("text")
        for match in _ROW_RE.finditer(text):
            date_str, desc, amt_str, bal_str = match.groups()
            amount = _parse_amount(amt_str)
            if amount is None:
                continue
            rows.append(
                ParsedTransaction(
                    date=_parse_date(date_str),
                    description=desc.strip(),
                    amount=abs(amount),
                    balance=_parse_amount(bal_str) if bal_str else None,
                    transaction_type=_infer_type(amount, desc),
                )
            )
    doc.close()
    return rows


# ── Public API ────────────────────────────────────────────────────────────────

def extract_transactions(pdf_path: str | Path) -> list[ParsedTransaction]:
    """
    Main entry point.
    Tries pdfplumber first, falls back to PyMuPDF, then raises if neither works.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    if _HAS_PDFPLUMBER:
        results = _extract_with_pdfplumber(path)
        if results:
            return results

    if _HAS_PYMUPDF:
        results = _extract_with_pymupdf(path)
        if results:
            return results

    raise RuntimeError(
        "Could not extract transactions. "
        "Ensure pdfplumber or PyMuPDF is installed and the PDF contains parseable text."
    )
