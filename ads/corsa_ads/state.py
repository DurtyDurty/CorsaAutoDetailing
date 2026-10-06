"""Local record of created resources (ads/.state/<customer id>.json, git-ignored).

The account itself is the source of truth: create-campaign rediscovers what
exists before each run, so a lost or stale state file can't cause duplicates.
The file speeds up lookups and keeps a history of what this tool created.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .config import ADS_DIR

STATE_DIR = ADS_DIR / ".state"


def path_for(customer_id: str, base: Path | None = None) -> Path:
    if not customer_id.isdigit():
        raise ValueError("customer id must be digits only")
    # Resolved per call, so tests that point STATE_DIR elsewhere never write into the real history.
    return (base or STATE_DIR) / f"{customer_id}.json"


def load(customer_id: str, base: Path | None = None) -> dict:
    p = path_for(customer_id, base)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save(customer_id: str, data: dict, base: Path | None = None) -> Path:
    p = path_for(customer_id, base)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(tmp, p)
    return p


def record_create(customer_id: str, campaign_name: str, resource_names: list[str], base: Path | None = None) -> Path:
    data = load(customer_id, base)
    camp = data.setdefault("campaigns", {}).setdefault(campaign_name, {"created": []})
    for rn in resource_names:
        if "/campaigns/" in rn and "campaign" not in camp:
            camp["campaign"] = rn
        if "/campaignBudgets/" in rn:
            camp["budget"] = rn
    camp["created"].append({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "resources": resource_names})
    return save(customer_id, data, base)


def record_ad_text(customer_id: str, campaign_name: str, ad_groups: list[str], base: Path | None = None) -> Path:
    """History of ad text changes made with this tool."""
    data = load(customer_id, base)
    camp = data.setdefault("campaigns", {}).setdefault(campaign_name, {"created": []})
    camp.setdefault("ad_text_updated", []).append({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "ad_groups": ad_groups})
    return save(customer_id, data, base)


def record_pause(customer_id: str, campaign_name: str, base: Path | None = None) -> Path:
    """Keep a history of pauses made with this tool, next to what it created."""
    data = load(customer_id, base)
    camp = data.setdefault("campaigns", {}).setdefault(campaign_name, {"created": []})
    camp.setdefault("paused", []).append(datetime.now(timezone.utc).isoformat(timespec="seconds"))
    return save(customer_id, data, base)
