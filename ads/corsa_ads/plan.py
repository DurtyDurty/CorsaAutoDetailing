"""What the campaign should contain, what already exists, and what's missing. Pure Python.

Reruns are safe because creation is driven by `missing(cfg, existing)`: items that
already exist in the account are never created again, and existing items are never
modified (status, budget and bids are left exactly as they are).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .config import Config, display_width


@dataclass(frozen=True)
class Step:
    """One resource to create. `key` identifies it for idempotency checks."""

    kind: str  # budget | campaign | location | language | schedule | negative | ad_group | keyword | ad | callout | sitelink | call
    key: tuple
    detail: str


@dataclass
class Existing:
    """What the account already has for this campaign (filled from GAQL, or empty for a new campaign)."""

    campaign: str | None = None  # resource name
    campaign_status: str | None = None
    budget: str | None = None
    budget_micros: int | None = None
    locations: set[int] = field(default_factory=set)
    languages: set[int] = field(default_factory=set)
    schedule_days: set[str] = field(default_factory=set)
    negatives: set[tuple[str, str]] = field(default_factory=set)
    ad_groups: dict[str, str] = field(default_factory=dict)  # name -> resource name
    keywords: set[tuple[str, str, str]] = field(default_factory=set)  # (ad group name, text, match)
    ads: set[str] = field(default_factory=set)  # ad group names with a responsive search ad
    callouts: set[str] = field(default_factory=set)
    sitelinks: set[str] = field(default_factory=set)
    has_call: bool = False


def desired(cfg: Config) -> list[Step]:
    c = cfg.campaign
    s: list[Step] = [
        Step("budget", (c["budget_name"],), f"{c['budget_name']}: ${c['daily_budget_usd']:.2f}/day ({cfg.budget_micros} micros), not shared"),
        Step("campaign", (c["name"],), f"{c['name']}: Search, PAUSED, Maximize Clicks"),
    ]
    s += [Step("location", (l["id"],), f"{l['name']} (geoTargetConstants/{l['id']})") for l in c["locations"]]
    s += [Step("language", (l["id"],), f"{l['name']} (languageConstants/{l['id']})") for l in c["languages"]]
    sch = c["schedule"]
    s += [Step("schedule", (d,), f"{d} {sch['start']}-{sch['end']}") for d in sch["days"]]
    s += [Step("negative", (n.text, n.match), f"-{_fmt(n.text, n.match)}") for n in cfg.negatives]
    for g in cfg.ad_groups:
        s.append(Step("ad_group", (g.name,), g.name))
        s += [Step("keyword", (g.name, k.text, k.match), f"{g.name}: {_fmt(k.text, k.match)}" + (f" -> {k.final_url}" if k.final_url else "")) for k in g.keywords]
        s.append(Step("ad", (g.name,), f"{g.name}: responsive search ad, {len(g.headlines)} headlines, {len(g.descriptions)} descriptions"))
    s += [Step("callout", (t,), t) for t in cfg.callouts]
    s += [Step("sitelink", (x["text"],), f"{x['text']} -> {x['url']}") for x in cfg.sitelinks]
    if cfg.call_phone:
        s.append(Step("call", (cfg.call_phone,), f"Call {cfg.call_phone}"))
    return s


def present(step: Step, ex: Existing) -> bool:
    k = step.kind
    if k == "budget":
        return ex.budget is not None
    if k == "campaign":
        return ex.campaign is not None
    if k == "location":
        return step.key[0] in ex.locations
    if k == "language":
        return step.key[0] in ex.languages
    if k == "schedule":
        return step.key[0] in ex.schedule_days
    if k == "negative":
        return step.key in ex.negatives
    if k == "ad_group":
        return step.key[0] in ex.ad_groups
    if k == "keyword":
        return step.key in ex.keywords
    if k == "ad":
        return step.key[0] in ex.ads
    if k == "callout":
        return step.key[0] in ex.callouts
    if k == "sitelink":
        return step.key[0] in ex.sitelinks
    if k == "call":
        return ex.has_call
    raise ValueError(k)


def missing(cfg: Config, ex: Existing) -> list[Step]:
    return [s for s in desired(cfg) if not present(s, ex)]


def drift(cfg: Config, ex: Existing) -> list[str]:
    """Differences the tool reports but never changes on its own."""
    notes = []
    if ex.campaign and ex.campaign_status and ex.campaign_status != "PAUSED":
        notes.append(f"Campaign is {ex.campaign_status} in Google Ads. This tool won't change it; use pause-campaign to pause.")
    if ex.budget_micros is not None and ex.budget_micros != cfg.budget_micros:
        notes.append(
            f"Budget in Google Ads is ${ex.budget_micros / 1e6:.2f}/day, config says ${cfg.budget_micros / 1e6:.2f}. "
            "Budgets are never changed by this tool; edit it in Google Ads if intended."
        )
    want_locs = {l["id"] for l in cfg.campaign["locations"]}
    extra = ex.locations - want_locs
    if extra:
        notes.append(f"Account targets extra locations not in config: {sorted(extra)}")
    return notes


def _fmt(text: str, match: str) -> str:
    return {"EXACT": f"[{text}]", "PHRASE": f'"{text}"'}.get(match, text)


def preview(cfg: Config, ex: Existing | None = None) -> str:
    """Human-readable campaign preview with character counts."""
    c = cfg.campaign
    ex = ex or Existing()
    todo = {(s.kind, s.key) for s in missing(cfg, ex)}
    mark = lambda s: "  + " if (s.kind, s.key) in todo else "  = "  # noqa: E731
    out = [
        f"Campaign: {c['name']}",
        f"  Status on create: PAUSED (never enabled by this tool)",
        f"  Budget: ${c['daily_budget_usd']:.2f}/day = {cfg.budget_micros} micros (avg/day; Google may spend up to 2x on a day, max 30.4x per month)",
        f"  Bidding: Maximize Clicks" + (f", max CPC ${c['bidding']['max_cpc_usd']:.2f}" if cfg.max_cpc_micros else ", no max CPC"),
        f"  Networks: Google Search only (Search Partners off, Display off)",
        f"  Locations ({c['location_matching']}: people in or regularly in): " + "; ".join(f"{l['name']} [{l['id']}]" for l in c["locations"]),
        f"  Language: " + ", ".join(f"{l['name']} [{l['id']}]" for l in c["languages"]),
        f"  Schedule ({c.get('expected_time_zone', 'account time zone')}): {', '.join(d[:3].title() for d in c['schedule']['days'])} {c['schedule']['start']}-{c['schedule']['end']}",
        f"  Start date: {c.get('start_date') or 'none (runs once enabled)'}",
        "",
        "Negative keywords (campaign):",
        *[f"{mark(s)}{s.detail}" for s in desired(cfg) if s.kind == "negative"],
    ]
    for g in cfg.ad_groups:
        out += ["", f"Ad group: {g.name}   final URL {cfg.url(g.final_url)}"]
        out += [f"{mark(s)}{s.detail}" for s in desired(cfg) if s.kind == "keyword" and s.key[0] == g.name]
        out.append(f"  Display path: {cfg.site.replace('https://', '')}/{g.path1 or ''}{'/' + g.path2 if g.path2 else ''}")
        out += [f"    H{i:<2} {display_width(h):>2}/30  {h}" for i, h in enumerate(g.headlines, 1)]
        out += [f"    D{i:<2} {display_width(d):>2}/90  {d}" for i, d in enumerate(g.descriptions, 1)]
    out += ["", "Assets (campaign):"]
    out += [f"{mark(s)}Callout: {s.detail}" for s in desired(cfg) if s.kind == "callout"]
    out += [f"{mark(s)}Sitelink: {x['text']} ({display_width(x['text'])}/25) -> {cfg.url(x['url'])} | {x['line1']} | {x['line2']}" for s, x in zip([s for s in desired(cfg) if s.kind == "sitelink"], cfg.sitelinks)]
    out.append(f"{'  + ' if cfg.call_phone else '  - '}Call: {cfg.call_phone or 'not added (no business phone number yet)'}")
    notes = drift(cfg, ex)
    if notes:
        out += ["", "Differences (not changed by this tool):", *[f"  ! {n}" for n in notes]]
    out += ["", "Legend: + to create, = already exists"]
    return "\n".join(out)
