"""Suggest negative keywords from a search terms report. Suggestions only: nothing is applied.

Each suggestion names the word or phrase to exclude, a match type and the reason,
so the owner can decide. Negatives match only the words given (no plurals,
misspellings or synonyms), so similar terms may need their own entries.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .config import Config, negative_blocks

# (pattern in the search term, negative to propose, match type, reason)
RULES: list[tuple[str, str, str, str]] = [
    (r"\bjobs?\b|\bhiring\b|\bemployment\b|\bcareers?\b", "{m}", "BROAD", "job seekers"),
    (r"\bsalary\b|\bpay rate\b|\bhow much do\b.*\bmake\b", "{m}", "BROAD", "job/salary research"),
    (r"\btraining\b|\bcourses?\b|\bclass(es)?\b|\bcertification\b|\bschool\b", "{m}", "BROAD", "learning to detail, not hiring"),
    (r"\bhow to\b|\bdiy\b|\bdo it yourself\b|\btutorial\b", "{m}", "PHRASE", "do-it-yourself research"),
    (r"\bsupplies\b|\bequipment\b|\bwholesale\b|\bkit\b|\bproducts?\b|\bbuy\b|\bfor sale\b", "{m}", "BROAD", "shopping for products"),
    (r"\bautomatic\b|\bself[ -]?serv(e|ice)\b|\btunnel\b|\bcoin\b|\btouchless\b|\bexpress wash\b", "{m}", "PHRASE", "car wash, not detailing"),
    (r"\bceramic\b|\bcoating\b|\btint(ing)?\b|\bppf\b|\bwrap\b|\bpaint protection film\b", "{m}", "PHRASE", "service Corsa doesn't offer"),
    (r"\bboat\b|\brv\b|\bmotorcycle\b|\baircraft\b|\bplane\b", "{m}", "PHRASE", "vehicle type not offered (owner to confirm)"),
    (r"\bjacksonville\b|\borange park\b|\bst\.? augustine\b|\bgainesville\b|\bpalatka\b|\bkeystone heights\b|\bfernandina\b", "{m}", "PHRASE", "outside Middleburg, Green Cove Springs and Fleming Island"),
    (r"\bfree\b|\bcheapest\b|\bcoupon\b|\bgroupon\b", "{m}", "PHRASE", "bargain hunting; review before excluding"),
]

REVIEW_CLICKS = 5


@dataclass
class TermRow:
    term: str
    ad_group: str
    status: str  # ADDED | EXCLUDED | ADDED_EXCLUDED | NONE
    impressions: int
    clicks: int
    cost_micros: int
    conversions: float


@dataclass
class Suggestion:
    term: str
    negative: str
    match: str
    reason: str
    clicks: int
    cost_usd: float


def suggest(rows: list[TermRow], cfg: Config) -> tuple[list[Suggestion], list[TermRow]]:
    """Returns (negative suggestions, terms worth a manual look: clicks with no conversions and no rule hit)."""
    out: list[Suggestion] = []
    review: list[TermRow] = []
    seen: set[tuple[str, str]] = set()
    for r in rows:
        term = r.term.lower().strip()
        if r.status in ("EXCLUDED", "ADDED_EXCLUDED") or any(negative_blocks(n, term) for n in cfg.negatives):
            continue
        hit = False
        for pattern, neg, match, reason in RULES:
            m = re.search(pattern, term)
            if not m:
                continue
            hit = True
            text = neg.format(m=m.group(0).strip())
            if (text, match) not in seen:
                seen.add((text, match))
                out.append(Suggestion(term, text, match, reason, r.clicks, r.cost_micros / 1e6))
            break
        if not hit and r.clicks >= REVIEW_CLICKS and r.conversions == 0:
            review.append(r)
    return out, review
