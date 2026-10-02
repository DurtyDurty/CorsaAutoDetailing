"""Google Ads API (v25) access through the official google-ads Python client.

Read paths: GAQL searches. Write paths: one atomic GoogleAdsService.Mutate per
create (all-or-nothing, with temporary ids), with validate_only for dry runs,
and a status-only update for pause. Nothing here enables a campaign, raises a
budget or changes bids.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Iterable

from .config import Config
from .plan import Existing, Step
from .redact import redact

API_VERSION = "v25"
SCOPES = ("https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/datamanager")

REQUIRED_ENV = ("GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN")


class ConfigError(RuntimeError):
    pass


def digits(v: str | None) -> str:
    return "".join(ch for ch in (v or "") if ch.isdigit())


def missing_env(env: dict[str, str]) -> list[str]:
    return [k for k in REQUIRED_ENV if not env.get(k)]


def load_client(env: dict[str, str]):
    """Build a GoogleAdsClient from GOOGLE_ADS_* variables. Raises ConfigError naming what's missing (never the values)."""
    lacking = missing_env(env)
    if lacking:
        raise ConfigError("Missing settings: " + ", ".join(lacking) + " (put them in ads/.env; see ads/.env.example)")
    from google.ads.googleads.client import GoogleAdsClient

    cfg = {
        "developer_token": env["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": env["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": env["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": env["GOOGLE_ADS_REFRESH_TOKEN"],
        "use_proto_plus": True,
    }
    login = digits(env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID"))
    if login:
        cfg["login_customer_id"] = login
    return GoogleAdsClient.load_from_dict(cfg, version=API_VERSION)


def offline_client():
    """A client that can build request objects without credentials or network (for dry builds and tests)."""
    from google.ads.googleads.client import GoogleAdsClient
    from google.auth.credentials import AnonymousCredentials

    # load_from_dict refreshes OAuth immediately; constructing directly with anonymous credentials stays offline.
    return GoogleAdsClient(credentials=AnonymousCredentials(), developer_token="offline", version=API_VERSION, use_proto_plus=True)


# ---------- errors and retries ----------

TRANSIENT = {"RESOURCE_EXHAUSTED", "INTERNAL_ERROR", "TRANSIENT_ERROR", "DEADLINE_EXCEEDED", "UNAVAILABLE"}


def describe_error(ex: Exception) -> str:
    """Readable, redacted summary of a GoogleAdsException (request id, error codes, field paths)."""
    try:
        from google.ads.googleads.errors import GoogleAdsException
    except ImportError:  # pragma: no cover
        GoogleAdsException = ()  # type: ignore
    if isinstance(ex, GoogleAdsException):  # type: ignore[arg-type]
        lines = [f"Google Ads API error (request id {ex.request_id}):"]
        for e in ex.failure.errors:
            code = type(e.error_code).to_dict(e.error_code) if hasattr(type(e.error_code), "to_dict") else str(e.error_code)
            path = ".".join(el.field_name for el in e.location.field_path_elements) if e.location else ""
            lines.append(f"  - {code} {e.message}" + (f" (field: {path})" if path else ""))
        return redact("\n".join(lines))
    return redact(f"{type(ex).__name__}: {ex}")


def _is_transient(ex: Exception) -> bool:
    text = str(ex)
    return any(t in text for t in TRANSIENT) or "quota" in text.lower()


def with_retry(fn: Callable[[], Any], attempts: int = 3, sleep: Callable[[float], None] = time.sleep) -> Any:
    """Retry read calls on quota and transient errors with backoff. Writes are not retried (rerun is safe instead)."""
    for i in range(1, attempts + 1):
        try:
            return fn()
        except Exception as ex:  # noqa: BLE001
            if i >= attempts or not _is_transient(ex):
                raise
            sleep(2 ** i)


def with_filter_fields(query: str) -> str:
    """GAQL requires campaign.resource_name in SELECT when the query filters on it (except FROM campaign)."""
    head, sep, where = query.partition(" WHERE ")
    if sep and "campaign.resource_name" in where and "campaign.resource_name" not in head:
        head = head.replace("SELECT ", "SELECT campaign.resource_name, ", 1)
    return head + sep + where


def search(client, customer_id: str, query: str) -> list:
    query = with_filter_fields(query)
    svc = client.get_service("GoogleAdsService")
    return with_retry(lambda: list(svc.search(customer_id=customer_id, query=query)))


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


# ---------- discovery (what exists) ----------


def account_info(client, customer_id: str) -> dict[str, Any]:
    rows = search(
        client,
        customer_id,
        "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, "
        "customer.test_account, customer.manager, customer.auto_tagging_enabled FROM customer",
    )
    c = rows[0].customer
    return {
        "id": str(c.id),
        "name": c.descriptive_name,
        "currency": c.currency_code,
        "time_zone": c.time_zone,
        "test_account": c.test_account,
        "manager": c.manager,
        "auto_tagging": c.auto_tagging_enabled,
    }


def find_campaign(client, customer_id: str, name: str):
    rows = search(
        client,
        customer_id,
        "SELECT campaign.resource_name, campaign.id, campaign.status, campaign.campaign_budget, campaign_budget.amount_micros "
        f"FROM campaign WHERE campaign.name = '{esc(name)}' AND campaign.status != 'REMOVED'",
    )
    return rows[0] if rows else None


def discover(client, customer_id: str, cfg: Config) -> Existing:
    ex = Existing()
    row = find_campaign(client, customer_id, cfg.campaign["name"])
    if not row:
        return ex
    rn = row.campaign.resource_name
    ex.campaign = rn
    ex.campaign_status = row.campaign.status.name
    ex.budget = row.campaign.campaign_budget or None
    ex.budget_micros = row.campaign_budget.amount_micros if ex.budget else None

    for r in search(
        client,
        customer_id,
        "SELECT campaign_criterion.type, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, "
        "campaign_criterion.language.language_constant, campaign_criterion.ad_schedule.day_of_week, "
        "campaign_criterion.keyword.text, campaign_criterion.keyword.match_type "
        f"FROM campaign_criterion WHERE campaign.resource_name = '{rn}' AND campaign_criterion.status != 'REMOVED'",
    ):
        cc = r.campaign_criterion
        t = cc.type_.name
        if t == "LOCATION" and not cc.negative:
            ex.locations.add(int(cc.location.geo_target_constant.split("/")[-1]))
        elif t == "LANGUAGE":
            ex.languages.add(int(cc.language.language_constant.split("/")[-1]))
        elif t == "AD_SCHEDULE":
            ex.schedule_days.add(cc.ad_schedule.day_of_week.name)
        elif t == "KEYWORD" and cc.negative:
            ex.negatives.add((cc.keyword.text.lower(), cc.keyword.match_type.name))

    for r in search(client, customer_id, f"SELECT ad_group.resource_name, ad_group.name FROM ad_group WHERE campaign.resource_name = '{rn}' AND ad_group.status != 'REMOVED'"):
        ex.ad_groups[r.ad_group.name] = r.ad_group.resource_name
    names = {v: k for k, v in ex.ad_groups.items()}

    for r in search(
        client,
        customer_id,
        "SELECT ad_group.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion "
        f"WHERE campaign.resource_name = '{rn}' AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.negative = FALSE "
        "AND ad_group_criterion.status != 'REMOVED'",
    ):
        g = names.get(r.ad_group.resource_name)
        if g:
            ex.keywords.add((g, r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name))

    for r in search(
        client,
        customer_id,
        f"SELECT ad_group.resource_name FROM ad_group_ad WHERE campaign.resource_name = '{rn}' "
        "AND ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD AND ad_group_ad.status != 'REMOVED'",
    ):
        g = names.get(r.ad_group.resource_name)
        if g:
            ex.ads.add(g)

    for r in search(
        client,
        customer_id,
        "SELECT campaign_asset.field_type, asset.callout_asset.callout_text, asset.sitelink_asset.link_text FROM campaign_asset "
        f"WHERE campaign.resource_name = '{rn}' AND campaign_asset.status != 'REMOVED'",
    ):
        ft = r.campaign_asset.field_type.name
        if ft == "CALLOUT":
            ex.callouts.add(r.asset.callout_asset.callout_text)
        elif ft == "SITELINK":
            ex.sitelinks.add(r.asset.sitelink_asset.link_text)
        elif ft == "CALL":
            ex.has_call = True
    return ex


# ---------- building operations ----------


def build_operations(client, customer_id: str, cfg: Config, steps: Iterable[Step], ex: Existing) -> list:
    """MutateOperations for the missing steps, in dependency order, using temporary ids for new parents."""
    steps = list(steps)
    E = client.enums
    ops: list = []
    tmp = iter(range(-1, -100000, -1))
    budget_rn = ex.budget
    campaign_rn = ex.campaign
    group_rn = dict(ex.ad_groups)
    c = cfg.campaign

    def op(kind: str):
        o = client.get_type("MutateOperation")
        ops.append(o)
        return getattr(o, kind).create

    for s in steps:
        if s.kind == "budget":
            budget_rn = f"customers/{customer_id}/campaignBudgets/{next(tmp)}"
            b = op("campaign_budget_operation")
            b.resource_name = budget_rn
            b.name = c["budget_name"]
            b.amount_micros = cfg.budget_micros
            b.delivery_method = E.BudgetDeliveryMethodEnum.STANDARD
            b.explicitly_shared = False

    for s in steps:
        if s.kind == "campaign":
            if not budget_rn:
                raise ConfigError("Campaign needs a budget")
            campaign_rn = f"customers/{customer_id}/campaigns/{next(tmp)}"
            cp = op("campaign_operation")
            cp.resource_name = campaign_rn
            cp.name = c["name"]
            cp.status = E.CampaignStatusEnum.PAUSED
            cp.advertising_channel_type = E.AdvertisingChannelTypeEnum.SEARCH
            cp.campaign_budget = budget_rn
            ts = client.get_type("TargetSpend")
            if cfg.max_cpc_micros:
                ts.cpc_bid_ceiling_micros = cfg.max_cpc_micros
            client.copy_from(cp.target_spend, ts)
            cp.network_settings.target_google_search = True
            cp.network_settings.target_search_network = False
            cp.network_settings.target_content_network = False
            cp.network_settings.target_partner_search_network = False
            cp.geo_target_type_setting.positive_geo_target_type = E.PositiveGeoTargetTypeEnum.PRESENCE
            cp.contains_eu_political_advertising = E.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
            if c.get("start_date"):
                cp.start_date_time = f"{c['start_date']} 00:00:00"

    if any(s.kind in ("location", "language", "schedule", "negative", "ad_group", "callout", "sitelink", "call") for s in steps) and not campaign_rn:
        raise ConfigError("Campaign must exist (or be created in the same request) before its settings")

    minutes = {0: E.MinuteOfHourEnum.ZERO, 15: E.MinuteOfHourEnum.FIFTEEN, 30: E.MinuteOfHourEnum.THIRTY, 45: E.MinuteOfHourEnum.FORTY_FIVE}
    match = {"BROAD": E.KeywordMatchTypeEnum.BROAD, "PHRASE": E.KeywordMatchTypeEnum.PHRASE, "EXACT": E.KeywordMatchTypeEnum.EXACT}

    for s in steps:
        if s.kind == "location":
            cc = op("campaign_criterion_operation")
            cc.campaign = campaign_rn
            cc.location.geo_target_constant = f"geoTargetConstants/{s.key[0]}"
        elif s.kind == "language":
            cc = op("campaign_criterion_operation")
            cc.campaign = campaign_rn
            cc.language.language_constant = f"languageConstants/{s.key[0]}"
        elif s.kind == "schedule":
            sh, sm = (int(x) for x in c["schedule"]["start"].split(":"))
            eh, em = (int(x) for x in c["schedule"]["end"].split(":"))
            cc = op("campaign_criterion_operation")
            cc.campaign = campaign_rn
            cc.ad_schedule.day_of_week = getattr(E.DayOfWeekEnum, s.key[0])
            cc.ad_schedule.start_hour = sh
            cc.ad_schedule.start_minute = minutes[sm]
            cc.ad_schedule.end_hour = eh
            cc.ad_schedule.end_minute = minutes[em]
        elif s.kind == "negative":
            cc = op("campaign_criterion_operation")
            cc.campaign = campaign_rn
            cc.negative = True
            cc.keyword.text = s.key[0]
            cc.keyword.match_type = match[s.key[1]]

    groups = {g.name: g for g in cfg.ad_groups}
    for s in steps:
        if s.kind == "ad_group":
            rn = f"customers/{customer_id}/adGroups/{next(tmp)}"
            group_rn[s.key[0]] = rn
            ag = op("ad_group_operation")
            ag.resource_name = rn
            ag.name = s.key[0]
            ag.campaign = campaign_rn
            ag.status = E.AdGroupStatusEnum.ENABLED  # serves only when the campaign is enabled
            ag.type_ = E.AdGroupTypeEnum.SEARCH_STANDARD

    for s in steps:
        if s.kind == "keyword":
            g = groups[s.key[0]]
            kw = next(k for k in g.keywords if (k.text, k.match) == (s.key[1], s.key[2]))
            crit = op("ad_group_criterion_operation")
            crit.ad_group = group_rn[g.name]
            crit.status = E.AdGroupCriterionStatusEnum.ENABLED
            crit.keyword.text = kw.text
            crit.keyword.match_type = match[kw.match]
            if kw.final_url:
                crit.final_urls.append(cfg.url(kw.final_url))
        elif s.kind == "ad":
            g = groups[s.key[0]]
            aga = op("ad_group_ad_operation")
            aga.ad_group = group_rn[g.name]
            aga.status = E.AdGroupAdStatusEnum.ENABLED
            aga.ad.final_urls.append(cfg.url(g.final_url))
            for h in g.headlines:
                t = client.get_type("AdTextAsset")
                t.text = h
                aga.ad.responsive_search_ad.headlines.append(t)
            for d in g.descriptions:
                t = client.get_type("AdTextAsset")
                t.text = d
                aga.ad.responsive_search_ad.descriptions.append(t)
            if g.path1:
                aga.ad.responsive_search_ad.path1 = g.path1
            if g.path2:
                aga.ad.responsive_search_ad.path2 = g.path2

    links = {x["text"]: x for x in cfg.sitelinks}
    for s in steps:
        if s.kind not in ("callout", "sitelink", "call"):
            continue
        asset_rn = f"customers/{customer_id}/assets/{next(tmp)}"
        a = op("asset_operation")
        a.resource_name = asset_rn
        if s.kind == "callout":
            a.callout_asset.callout_text = s.key[0]
            field = E.AssetFieldTypeEnum.CALLOUT
        elif s.kind == "sitelink":
            x = links[s.key[0]]
            a.sitelink_asset.link_text = x["text"]
            a.sitelink_asset.description1 = x["line1"]
            a.sitelink_asset.description2 = x["line2"]
            a.final_urls.append(cfg.url(x["url"]))
            field = E.AssetFieldTypeEnum.SITELINK
        else:
            a.call_asset.country_code = cfg.call_country
            a.call_asset.phone_number = str(cfg.call_phone)
            field = E.AssetFieldTypeEnum.CALL
        ca = op("campaign_asset_operation")
        ca.campaign = campaign_rn
        ca.asset = asset_rn
        ca.field_type = field
    return ops


def mutate(client, customer_id: str, operations: list, validate_only: bool):
    """One atomic request. validate_only=True checks everything server-side and creates nothing."""
    svc = client.get_service("GoogleAdsService")
    req = client.get_type("MutateGoogleAdsRequest")
    req.customer_id = customer_id
    req.mutate_operations.extend(operations)
    req.validate_only = validate_only
    req.partial_failure = False
    return svc.mutate(request=req)


def created_names(response) -> list[str]:
    """Resource names from a mutate response, in operation order."""
    out = []
    for r in response.mutate_operation_responses:
        kind = r._pb.WhichOneof("response")
        if kind:
            out.append(getattr(r, kind).resource_name)
    return out


def pause(client, customer_id: str, campaign_rn: str, validate_only: bool = False):
    """Set status PAUSED. The only status change this tool can make."""
    svc = client.get_service("CampaignService")
    o = client.get_type("CampaignOperation")
    o.update.resource_name = campaign_rn
    o.update.status = client.enums.CampaignStatusEnum.PAUSED
    from google.protobuf.field_mask_pb2 import FieldMask

    client.copy_from(o.update_mask, FieldMask(paths=["status"]))
    return svc.mutate_campaigns(request={"customer_id": customer_id, "operations": [o], "validate_only": validate_only})
