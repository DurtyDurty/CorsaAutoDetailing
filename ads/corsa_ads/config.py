"""Load and validate campaign.yaml. Pure Python: no Google Ads library, no network."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ADS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ADS_DIR / "campaign.yaml"

# Google Ads limits (Help Center 7684791; API SitelinkAsset / CalloutAsset reference).
HEADLINE_MAX = 30
DESCRIPTION_MAX = 90
PATH_MAX = 15
HEADLINES_MIN, HEADLINES_MAX_COUNT = 3, 15
DESCRIPTIONS_MIN, DESCRIPTIONS_MAX_COUNT = 2, 4
SITELINK_TEXT_MAX = 25
SITELINK_LINE_MAX = 35
CALLOUT_MAX = 25
KEYWORD_MAX_CHARS = 80
KEYWORD_MAX_WORDS = 10

# Guard against a typo becoming real spend. Raising it is a deliberate code change.
DAILY_BUDGET_CAP_USD = 50.0

# Official geo target constants verified in geotargets-2026-08-12.csv. Only these may be targeted:
# the brief allows the three towns and no broader substitute.
VERIFIED_GEO = {
    1015119: "Middleburg, Florida, United States",
    1015041: "Green Cove Springs, Florida, United States",
    9196545: "Fleming Island, Florida, United States",
}
ENGLISH = 1000

# Pages that exist on the site (src/app/(site)); tests check each against the repo.
KNOWN_PATHS = {
    "/",
    "/services",
    "/request",
    "/contact",
    "/about",
    "/service-areas",
    "/service-areas/middleburg",
    "/service-areas/fleming-island",
    "/service-areas/green-cove-springs",
}

DAYS = ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")

# Claims the business can't make (no ceramic service, no guarantees, no fake urgency, deposits are off).
BANNED = [
    (r"\bceramic\b|\bcoating", "ceramic/coating claim (the sealant is a sealant)"),
    (r"guarantee", "guarantee claim"),
    (r"#\s*1\b|\bnumber one\b|\bbest\b|\bcheapest\b|\blowest\b", "superlative claim"),
    (r"limited time|hurry|act now|spots? left|only \d+|last chance|today only|ends soon", "false urgency or scarcity"),
    (r"\bdeposit", "deposits are off"),
    (r"\bfree\b", "'free' offer that doesn't exist"),
    (r"\bcertified\b|\blicensed\b|\binsured\b", "credential not verified in the repo"),
]

# Characters Google rejects in keywords.
KEYWORD_BAD_CHARS = re.compile(r"[!@%^*=;~`<>?\\|,]")


def display_width(text: str) -> int:
    """Google counts double-width characters (e.g. CJK) as two."""
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in text)


def usd_to_micros(usd: float) -> int:
    """Whole cents only; Google requires budgets in multiples of the currency's minimum unit."""
    cents = round(float(usd) * 100)
    return cents * 10_000


@dataclass
class Keyword:
    text: str
    match: str
    final_url: str | None = None


@dataclass
class AdGroup:
    name: str
    final_url: str
    keywords: list[Keyword]
    headlines: list[str]
    descriptions: list[str]
    path1: str | None
    path2: str | None


@dataclass
class Config:
    raw: dict[str, Any]
    site: str
    campaign: dict[str, Any]
    negatives: list[Keyword]
    ad_groups: list[AdGroup]
    callouts: list[str]
    sitelinks: list[dict[str, str]]
    call_phone: str | None
    call_country: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def budget_micros(self) -> int:
        return usd_to_micros(self.campaign["daily_budget_usd"])

    @property
    def max_cpc_micros(self) -> int | None:
        v = self.campaign.get("bidding", {}).get("max_cpc_usd")
        return None if v is None else usd_to_micros(v)

    def url(self, path: str) -> str:
        return self.site.rstrip("/") + path


def load(path: Path | str = DEFAULT_CONFIG) -> Config:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    c = raw.get("campaign") or {}
    groups = []
    for g in raw.get("ad_groups") or []:
        ad = g.get("ad") or {}
        groups.append(
            AdGroup(
                name=str(g.get("name", "")),
                final_url=str(g.get("final_url", "")),
                keywords=[Keyword(str(k["text"]), str(k["match"]).upper(), k.get("final_url")) for k in g.get("keywords") or []],
                headlines=[str(h) for h in ad.get("headlines") or []],
                descriptions=[str(d) for d in ad.get("descriptions") or []],
                path1=ad.get("path1"),
                path2=ad.get("path2"),
            )
        )
    assets = raw.get("assets") or {}
    call = assets.get("call") or {}
    cfg = Config(
        raw=raw,
        site=str(raw.get("site", "")),
        campaign=c,
        negatives=[Keyword(str(k["text"]), str(k["match"]).upper()) for k in raw.get("negative_keywords") or []],
        ad_groups=groups,
        callouts=[str(x) for x in assets.get("callouts") or []],
        sitelinks=[{k: str(v) for k, v in s.items()} for s in assets.get("sitelinks") or []],
        call_phone=call.get("phone"),
        call_country=str(call.get("country_code") or "US"),
    )
    validate(cfg)
    return cfg


def _hm(s: str) -> tuple[int, int] | None:
    m = re.fullmatch(r"(\d{2}):(\d{2})", str(s))
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    return (h, mi) if 0 <= h <= 24 and mi in (0, 15, 30, 45) and not (h == 24 and mi) else None


def _words(s: str) -> list[str]:
    return s.lower().split()


def negative_blocks(neg: Keyword, query: str) -> bool:
    """Whether a negative keyword would block this query (exact words only; Google adds no close variants for negatives)."""
    q = _words(query)
    n = _words(neg.text)
    if neg.match == "EXACT":
        return q == n
    if neg.match == "PHRASE":
        return any(q[i : i + len(n)] == n for i in range(len(q) - len(n) + 1))
    return all(w in q for w in n)


def allowed_prices(business_ts: str) -> set[int]:
    """Package prices from src/config/business.ts (`price: 179,`)."""
    return {int(p) for p in re.findall(r"^\s*price:\s*(\d+),", business_ts, re.M)}


def check_text(label: str, text: str, limit: int, errors: list[str], prices: set[int] | None = None) -> None:
    w = display_width(text)
    if not text.strip():
        errors.append(f"{label}: empty")
    if w > limit:
        errors.append(f"{label}: {w}/{limit} characters: {text!r}")
    for pattern, why in BANNED:
        if re.search(pattern, text, re.I):
            errors.append(f"{label}: {why}: {text!r}")
    if re.search(r"[!?]{2,}|\.{2,}", text):
        errors.append(f"{label}: repeated punctuation: {text!r}")
    if re.search(r"\b[A-Z]{4,}\b", text) and not re.search(r"\bUV\b", text):
        errors.append(f"{label}: all-caps word: {text!r}")
    if prices is not None:
        for p in re.findall(r"\$(\d+)", text):
            if int(p) not in prices:
                errors.append(f"{label}: ${p} is not a current package price {sorted(prices)}")


def validate(cfg: Config, prices: set[int] | None = None) -> Config:
    """Collect every problem rather than stopping at the first. Errors block create-campaign."""
    e, w = cfg.errors, cfg.warnings
    e.clear()
    w.clear()
    c = cfg.campaign

    if prices is None:
        biz = ADS_DIR.parent / "src" / "config" / "business.ts"
        prices = allowed_prices(biz.read_text(encoding="utf-8")) if biz.exists() else None

    if not re.fullmatch(r"https://[a-z0-9.-]+", cfg.site):
        e.append(f"site must be an https origin without a path, got {cfg.site!r}")
    if not c.get("name"):
        e.append("campaign.name is required")
    if c.get("status") != "PAUSED":
        e.append("campaign.status must be PAUSED: campaigns are only ever created paused")

    budget = c.get("daily_budget_usd")
    if not isinstance(budget, (int, float)) or budget <= 0:
        e.append("campaign.daily_budget_usd must be a positive number")
    elif budget > DAILY_BUDGET_CAP_USD:
        e.append(f"campaign.daily_budget_usd {budget} is above the {DAILY_BUDGET_CAP_USD} safety cap")
    elif round(budget * 100) != budget * 100:
        e.append("campaign.daily_budget_usd must be whole cents")
    if not c.get("budget_name"):
        e.append("campaign.budget_name is required")

    bidding = c.get("bidding") or {}
    if bidding.get("strategy") != "MAXIMIZE_CLICKS":
        e.append("campaign.bidding.strategy must be MAXIMIZE_CLICKS")
    cpc = bidding.get("max_cpc_usd")
    if cpc is not None and (not isinstance(cpc, (int, float)) or cpc <= 0 or (isinstance(budget, (int, float)) and cpc > budget)):
        e.append("campaign.bidding.max_cpc_usd must be null or a positive amount no larger than the daily budget")

    nets = c.get("networks") or {}
    if nets.get("google_search") is not True:
        e.append("networks.google_search must be true")
    if nets.get("search_partners") is not False:
        e.append("networks.search_partners must be false")
    if nets.get("display") is not False:
        e.append("networks.display must be false (no Display expansion)")
    if c.get("eu_political_advertising") is not False:
        e.append("campaign.eu_political_advertising must be false (declared on create)")
    sd = c.get("start_date")
    if sd is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(sd)):
        e.append("campaign.start_date must be null or YYYY-MM-DD")

    locs = c.get("locations") or []
    ids = [l.get("id") for l in locs]
    if not locs:
        e.append("campaign.locations: at least one location is required")
    for l in locs:
        if l.get("id") not in VERIFIED_GEO:
            e.append(f"location {l.get('id')} ({l.get('name')}) is not one of the verified town geo targets")
        elif l.get("name") != VERIFIED_GEO[l["id"]]:
            e.append(f"location {l['id']} name {l.get('name')!r} doesn't match Google's {VERIFIED_GEO[l['id']]!r}")
    if len(set(ids)) != len(ids):
        e.append("campaign.locations has duplicates")
    if c.get("location_matching") != "PRESENCE":
        e.append("campaign.location_matching must be PRESENCE (people in the towns, not interested in them)")
    if [l.get("id") for l in c.get("languages") or []] != [ENGLISH]:
        e.append("campaign.languages must be English only (1000); Spanish gets its own campaign")

    sch = c.get("schedule") or {}
    days = sch.get("days") or []
    start, end = _hm(sch.get("start", "")), _hm(sch.get("end", ""))
    if not days or any(d not in DAYS for d in days) or len(set(days)) != len(days):
        e.append(f"schedule.days must be distinct values from {DAYS}")
    if not start or not end or start >= end:
        e.append("schedule start/end must be HH:MM on a quarter hour with start before end")

    # Keywords
    seen: dict[tuple[str, str], str] = {}
    if not cfg.ad_groups:
        e.append("at least one ad group is required")
    for g in cfg.ad_groups:
        where = f"ad group {g.name!r}"
        if not g.name:
            e.append("ad group name is required")
        if g.final_url not in KNOWN_PATHS:
            e.append(f"{where}: final_url {g.final_url!r} is not a known page")
        if not g.keywords:
            e.append(f"{where}: no keywords")
        for k in g.keywords:
            key = (k.text.lower(), k.match)
            if k.match not in ("PHRASE", "EXACT"):
                e.append(f"{where}: keyword {k.text!r} match must be PHRASE or EXACT")
            if k.text != k.text.lower().strip() or "  " in k.text:
                e.append(f"{where}: keyword {k.text!r} must be lowercase, single-spaced")
            if KEYWORD_BAD_CHARS.search(k.text) or '"' in k.text or "[" in k.text:
                e.append(f"{where}: keyword {k.text!r} has characters Google rejects (write match type in `match`, not quotes/brackets)")
            if len(k.text) > KEYWORD_MAX_CHARS or len(_words(k.text)) > KEYWORD_MAX_WORDS:
                e.append(f"{where}: keyword {k.text!r} is too long")
            if key in seen:
                e.append(f"{where}: keyword {k.text!r} [{k.match}] duplicates one in {seen[key]!r}")
            seen[key] = g.name
            if k.final_url is not None and k.final_url not in KNOWN_PATHS:
                e.append(f"{where}: keyword {k.text!r} final_url {k.final_url!r} is not a known page")
            for n in cfg.negatives:
                if negative_blocks(n, k.text):
                    e.append(f"{where}: keyword {k.text!r} is blocked by negative {n.text!r} [{n.match}]")

        # Responsive search ad
        if not HEADLINES_MIN <= len(g.headlines) <= HEADLINES_MAX_COUNT:
            e.append(f"{where}: {len(g.headlines)} headlines (need {HEADLINES_MIN}-{HEADLINES_MAX_COUNT})")
        if not DESCRIPTIONS_MIN <= len(g.descriptions) <= DESCRIPTIONS_MAX_COUNT:
            e.append(f"{where}: {len(g.descriptions)} descriptions (need {DESCRIPTIONS_MIN}-{DESCRIPTIONS_MAX_COUNT})")
        for i, h in enumerate(g.headlines, 1):
            check_text(f"{where} headline {i}", h, HEADLINE_MAX, e, prices)
            if "!" in h:
                e.append(f"{where} headline {i}: Google doesn't allow '!' in headlines")
        for i, d in enumerate(g.descriptions, 1):
            check_text(f"{where} description {i}", d, DESCRIPTION_MAX, e, prices)
        if len({h.lower() for h in g.headlines}) != len(g.headlines):
            e.append(f"{where}: duplicate headlines")
        if len({d.lower() for d in g.descriptions}) != len(g.descriptions):
            e.append(f"{where}: duplicate descriptions")
        for label, p in (("path1", g.path1), ("path2", g.path2)):
            if p is not None and (display_width(p) > PATH_MAX or not re.fullmatch(r"[A-Za-z0-9-]+", p)):
                e.append(f"{where}: {label} {p!r} must be up to {PATH_MAX} letters, digits or hyphens")
        if g.path2 and not g.path1:
            e.append(f"{where}: path2 needs path1")

    for n in cfg.negatives:
        if n.match not in ("BROAD", "PHRASE", "EXACT"):
            e.append(f"negative {n.text!r}: match must be BROAD, PHRASE or EXACT")
        if n.text != n.text.lower().strip():
            e.append(f"negative {n.text!r} must be lowercase")
    if len({(n.text, n.match) for n in cfg.negatives}) != len(cfg.negatives):
        e.append("negative_keywords has duplicates")

    # Assets
    for i, t in enumerate(cfg.callouts, 1):
        check_text(f"callout {i}", t, CALLOUT_MAX, e, prices)
    if len(set(cfg.callouts)) != len(cfg.callouts):
        e.append("duplicate callouts")
    for i, s in enumerate(cfg.sitelinks, 1):
        check_text(f"sitelink {i} text", s.get("text", ""), SITELINK_TEXT_MAX, e, prices)
        check_text(f"sitelink {i} line1", s.get("line1", ""), SITELINK_LINE_MAX, e, prices)
        check_text(f"sitelink {i} line2", s.get("line2", ""), SITELINK_LINE_MAX, e, prices)
        if s.get("url") not in KNOWN_PATHS:
            e.append(f"sitelink {i}: url {s.get('url')!r} is not a known page")
    if len(cfg.sitelinks) < 2:
        w.append("fewer than 2 sitelinks: Google needs at least 2 to show them")
    if cfg.call_phone is not None:
        digits = re.sub(r"\D", "", str(cfg.call_phone))
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if len(digits) != 10:
            e.append("assets.call.phone must be a 10-digit U.S. number or null")
    else:
        w.append("no call asset: add assets.call.phone once the business phone number exists")
    if prices is None:
        w.append("couldn't read package prices from src/config/business.ts; $ amounts not checked")
    if sch and days and len(days) == 7 and sch.get("start") == "08:00" and sch.get("end") == "19:00":
        w.append("ad schedule is the proposed 8am-7pm every day; confirm the owner's real availability")
    return cfg
