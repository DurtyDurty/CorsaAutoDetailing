"""Corsa Google Ads command-line tool.

  python -m corsa_ads <command> [options]        (run from the ads/ folder)

READ-ONLY (never change the account):
  auth-check          verify credentials and show the account's time zone, currency, auto-tagging
  list-accounts       accounts these credentials can reach
  keyword-estimates   Google Keyword Planner volumes and bid ranges (needs Basic API access)
  validate-config     check campaign.yaml locally (no credentials needed)
  preview-campaign    print the campaign as it would be created (add --live to compare with the account)
  campaign-status     status, budget, ad approval for the campaign
  report              spend, clicks and conversions for the last N days
  search-terms        search terms report plus suggested negatives (suggestions only, never applied)

WRITES (each asks for confirmation; --dry-run sends validate_only and changes nothing):
  create-campaign --dry-run   Google validates every create operation; nothing is created
  create-campaign --paused    creates whatever is missing, with the campaign PAUSED
  pause-campaign              sets the campaign to PAUSED

There is deliberately no command to enable a campaign or change a budget or bids.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from . import config as config_mod
from . import google_api as g
from . import plan as plan_mod
from . import state as state_mod
from .envfile import load_env
from .negatives import TermRow, suggest
from .redact import redact

REPORTS = config_mod.ADS_DIR / "reports"


def out(msg: str = "") -> None:
    print(msg)


def err(msg: str) -> None:
    print(redact(msg), file=sys.stderr)


def customer_id(args, env) -> str:
    cid = g.digits(args.customer_id or env.get("GOOGLE_ADS_CUSTOMER_ID"))
    if len(cid) != 10:
        raise g.ConfigError("Set GOOGLE_ADS_CUSTOMER_ID (10 digits) in ads/.env or pass --customer-id")
    return cid


def load_cfg(args) -> config_mod.Config:
    return config_mod.load(args.config)


def require_valid(cfg: config_mod.Config) -> None:
    if cfg.errors:
        raise g.ConfigError("campaign.yaml has errors; run validate-config:\n  " + "\n  ".join(cfg.errors))


def confirm(prompt: str, expected: str, assume_yes: bool) -> bool:
    if assume_yes:
        return True
    try:
        typed = input(f"{prompt}\nType '{expected}' to continue: ")
    except EOFError:
        return False
    return typed.strip() == expected


# ---------- commands ----------


def cmd_validate_config(args, env) -> int:
    cfg = load_cfg(args)
    for w in cfg.warnings:
        out(f"WARN  {w}")
    for e in cfg.errors:
        out(f"ERROR {e}")
    if cfg.errors:
        out(f"\n{len(cfg.errors)} error(s). Fix campaign.yaml before creating anything.")
        return 2
    steps = plan_mod.desired(cfg)
    out(f"OK: {len(steps)} resources, budget {cfg.budget_micros} micros/day, status PAUSED, {sum(len(x.keywords) for x in cfg.ad_groups)} keywords, {len(cfg.negatives)} negatives.")
    return 0


def cmd_preview(args, env) -> int:
    cfg = load_cfg(args)
    require_valid(cfg)
    ex = None
    if args.live:
        client = g.load_client(env)
        ex = g.discover(client, customer_id(args, env), cfg)
    out(plan_mod.preview(cfg, ex))
    return 0


def cmd_auth_check(args, env) -> int:
    client = g.load_client(env)
    svc = client.get_service("CustomerService")
    accessible = g.with_retry(lambda: svc.list_accessible_customers().resource_names)
    out(f"Credentials OK. {len(accessible)} accessible account(s).")
    cid = g.digits(args.customer_id or env.get("GOOGLE_ADS_CUSTOMER_ID"))
    if cid:
        info = g.account_info(client, cid)
        cfg = load_cfg(args)
        out(json.dumps(info, indent=2))
        tz_ok = info["time_zone"] == cfg.campaign.get("expected_time_zone")
        out(f"Time zone: {info['time_zone']} {'OK' if tz_ok else '!! differs from campaign.yaml expected_time_zone (ad schedule uses the account time zone)'}")
        out(f"Currency: {info['currency']} {'OK' if info['currency'] == 'USD' else '!! budget amounts assume USD'}")
        out(f"Auto-tagging: {'on' if info['auto_tagging'] else '!! OFF: turn it on (Admin > Account settings) so ad clicks carry a gclid for conversion tracking'}")
        if info["test_account"]:
            out("Note: this is a Google Ads TEST account (ads never serve).")
    return 0


def cmd_list_accounts(args, env) -> int:
    client = g.load_client(env)
    svc = client.get_service("CustomerService")
    names = g.with_retry(lambda: svc.list_accessible_customers().resource_names)
    for rn in names:
        cid = rn.split("/")[-1]
        try:
            info = g.account_info(client, cid)
            out(f"{cid}  {info['name'] or '(no name)'}  {info['currency']}  {info['time_zone']}" + ("  [manager]" if info["manager"] else "") + ("  [test]" if info["test_account"] else ""))
        except Exception as ex:  # noqa: BLE001
            out(f"{cid}  (details unavailable: {g.describe_error(ex).splitlines()[-1].strip()})")
    return 0


def cmd_keyword_estimates(args, env) -> int:
    cfg = load_cfg(args)
    require_valid(cfg)
    client = g.load_client(env)
    cid = customer_id(args, env)
    svc = client.get_service("KeywordPlanIdeaService")
    req = client.get_type("GenerateKeywordHistoricalMetricsRequest")
    req.customer_id = cid
    req.keywords.extend(sorted({k.text for grp in cfg.ad_groups for k in grp.keywords}))
    req.geo_target_constants.extend(f"geoTargetConstants/{l['id']}" for l in cfg.campaign["locations"])
    req.language = f"languageConstants/{cfg.campaign['languages'][0]['id']}"
    req.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    try:
        resp = g.with_retry(lambda: svc.generate_keyword_historical_metrics(request=req))
    except Exception as ex:  # noqa: BLE001
        text = g.describe_error(ex)
        err(text)
        if "PERMISSION" in text.upper() or "DEVELOPER_TOKEN" in text.upper() or "NOT_ALLOWED" in text.upper():
            err("Keyword Planner needs Basic or Standard API access; Explorer access can't use it. "
                "Use the Keyword Planner in the Google Ads UI meanwhile. No estimates were invented.")
        return 1
    rows = []
    for r in resp.results:
        m = r.keyword_metrics
        rows.append({
            "keyword": r.text,
            "avg_monthly_searches": m.avg_monthly_searches if m else None,
            "competition": m.competition.name if m else None,
            "top_of_page_bid_low_usd": round(m.low_top_of_page_bid_micros / 1e6, 2) if m and m.low_top_of_page_bid_micros else None,
            "top_of_page_bid_high_usd": round(m.high_top_of_page_bid_micros / 1e6, 2) if m and m.high_top_of_page_bid_micros else None,
        })
    out("ESTIMATES from Google Keyword Planner (not actual results). Small towns often have no data; blank = Google returned none.\n")
    out(f"{'keyword':<40} {'searches/mo':>11} {'competition':>11} {'top-of-page bid':>18}")
    for r in rows:
        bid = f"${r['top_of_page_bid_low_usd']}-{r['top_of_page_bid_high_usd']}" if r["top_of_page_bid_low_usd"] else ""
        out(f"{r['keyword']:<40} {r['avg_monthly_searches'] if r['avg_monthly_searches'] is not None else '':>11} {r['competition'] or '':>11} {bid:>18}")
    REPORTS.mkdir(exist_ok=True)
    f = REPORTS / f"keyword-estimates-{date.today().isoformat()}.json"
    f.write_text(json.dumps({"source": "Google Keyword Planner (estimates)", "date": date.today().isoformat(), "rows": rows}, indent=2), encoding="utf-8")
    out(f"\nSaved {f.relative_to(config_mod.ADS_DIR)}")
    return 0


def cmd_create(args, env) -> int:
    cfg = load_cfg(args)
    require_valid(cfg)
    for w in cfg.warnings:
        out(f"WARN  {w}")

    if args.dry_run and g.missing_env(env):
        # No credentials yet: build every request object locally so field and enum errors still surface.
        client = g.offline_client()
        ops = g.build_operations(client, "1234567890", cfg, plan_mod.desired(cfg), plan_mod.Existing())
        out(f"Local dry run: built {len(ops)} operations (campaign PAUSED, budget {cfg.budget_micros} micros).")
        out("Not sent to Google: credentials missing (" + ", ".join(g.missing_env(env)) + "). Nothing was created.")
        return 0

    client = g.load_client(env)
    cid = customer_id(args, env)
    info = g.account_info(client, cid)
    if info["currency"] != "USD":
        raise g.ConfigError(f"Account currency is {info['currency']}; campaign.yaml amounts are USD.")
    if info["time_zone"] != cfg.campaign.get("expected_time_zone") and not args.allow_time_zone:
        raise g.ConfigError(f"Account time zone is {info['time_zone']}, expected {cfg.campaign.get('expected_time_zone')}. "
                            "The ad schedule would run at the wrong hours. Pass --allow-time-zone to proceed anyway.")
    if not info["auto_tagging"]:
        out("WARN  Auto-tagging is off: turn it on so ad clicks carry a gclid (needed for booking conversions).")

    ex = g.discover(client, cid, cfg)
    for n in plan_mod.drift(cfg, ex):
        out(f"NOTE  {n}")
    steps = plan_mod.missing(cfg, ex)
    if not steps:
        out(f"Nothing to create: everything in {Path(args.config).name} already exists. Nothing was changed.")
        return 0
    out(f"{len(steps)} item(s) to create" + (" (campaign already exists; adding only what's missing)" if ex.campaign else "") + ":")
    for s in steps:
        out(f"  + {s.kind}: {s.detail}")
    ops = g.build_operations(client, cid, cfg, steps, ex)

    # Google validates everything first, in both modes.
    g.mutate(client, cid, ops, validate_only=True)
    if args.dry_run:
        out(f"\nGoogle validated {len(ops)} operations (validate_only). Nothing was created.")
        return 0

    if not confirm(f"\nCreate these in account {cid}? The campaign will be PAUSED and won't spend until you enable it in Google Ads.",
                   cfg.campaign["name"] if not ex.campaign else "add", args.yes):
        out("Cancelled. Nothing was created.")
        return 1
    resp = g.mutate(client, cid, ops, validate_only=False)
    names = g.created_names(resp)
    p = state_mod.record_create(cid, cfg.campaign["name"], names)
    out(f"Created {len(names)} resources. Recorded in {p.relative_to(config_mod.ADS_DIR)}.")

    after = g.discover(client, cid, cfg)
    out(f"Campaign status now: {after.campaign_status}" + ("" if after.campaign_status == "PAUSED" else "  !! not PAUSED; check Google Ads"))
    left = plan_mod.missing(cfg, after)
    out(f"Everything in {Path(args.config).name} exists." if not left else f"{len(left)} item(s) still missing; rerun create-campaign --paused.")
    return 0


def _campaign(client, cid, cfg):
    row = g.find_campaign(client, cid, cfg.campaign["name"])
    if not row:
        raise g.ConfigError(f"Campaign {cfg.campaign['name']!r} not found in account {cid}.")
    return row


def cmd_status(args, env) -> int:
    cfg = load_cfg(args)
    client = g.load_client(env)
    cid = customer_id(args, env)
    row = _campaign(client, cid, cfg)
    rn = row.campaign.resource_name
    c = g.search(client, cid, "SELECT campaign.status, campaign.serving_status, campaign.primary_status, campaign.bidding_strategy_type, "
                 f"campaign_budget.amount_micros FROM campaign WHERE campaign.resource_name = '{rn}'")[0]
    out(f"Campaign: {cfg.campaign['name']}")
    out(f"  Status: {c.campaign.status.name}   Serving: {c.campaign.serving_status.name}   Primary status: {c.campaign.primary_status.name}")
    out(f"  Budget: ${c.campaign_budget.amount_micros / 1e6:.2f}/day   Bidding: {c.campaign.bidding_strategy_type.name}")
    for r in g.search(client, cid, "SELECT ad_group.name, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status "
                      f"FROM ad_group_ad WHERE campaign.resource_name = '{rn}' AND ad_group_ad.status != 'REMOVED'"):
        ps = r.ad_group_ad.policy_summary
        out(f"  Ad in {r.ad_group.name}: {r.ad_group_ad.status.name}, review {ps.review_status.name}, approval {ps.approval_status.name}")
    ex = g.discover(client, cid, cfg)
    left = plan_mod.missing(cfg, ex)
    out(f"  Config items missing from the account: {len(left)}")
    for n in plan_mod.drift(cfg, ex):
        out(f"  NOTE {n}")
    return 0


def _range(days: int) -> tuple[str, str]:
    end = date.today()
    return (end - timedelta(days=days - 1)).isoformat(), end.isoformat()


def cmd_report(args, env) -> int:
    cfg = load_cfg(args)
    client = g.load_client(env)
    cid = customer_id(args, env)
    start, end = _range(args.days)
    rows = g.search(client, cid, "SELECT ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value "
                    f"FROM ad_group WHERE campaign.name = '{g.esc(cfg.campaign['name'])}' AND segments.date BETWEEN '{start}' AND '{end}'")
    out(f"ACTUAL results from Google Ads, {start} to {end} (account time zone). Conversions can take up to a few days to appear.\n")
    out(f"{'ad group':<32} {'impr':>7} {'clicks':>7} {'cost':>9} {'conv':>6} {'value':>9} {'cost/conv':>10}")
    tot = [0, 0, 0, 0.0, 0.0]
    for r in rows:
        m = r.metrics
        cost = m.cost_micros / 1e6
        tot[0] += m.impressions; tot[1] += m.clicks; tot[2] += m.cost_micros; tot[3] += m.conversions; tot[4] += m.conversions_value  # noqa: E702
        out(f"{r.ad_group.name:<32} {m.impressions:>7} {m.clicks:>7} {cost:>9.2f} {m.conversions:>6.1f} {m.conversions_value:>9.2f} {(cost / m.conversions if m.conversions else 0):>10.2f}")
    cost = tot[2] / 1e6
    out(f"{'TOTAL':<32} {tot[0]:>7} {tot[1]:>7} {cost:>9.2f} {tot[3]:>6.1f} {tot[4]:>9.2f} {(cost / tot[3] if tot[3] else 0):>10.2f}")
    out("\nCost per paying customer and collected revenue are on the website dashboard (Analytics > Google Ads), from booking records.")
    return 0


def cmd_search_terms(args, env) -> int:
    cfg = load_cfg(args)
    client = g.load_client(env)
    cid = customer_id(args, env)
    start, end = _range(args.days)
    res = g.search(client, cid, "SELECT search_term_view.search_term, search_term_view.status, ad_group.name, metrics.impressions, metrics.clicks, "
                   f"metrics.cost_micros, metrics.conversions FROM search_term_view WHERE campaign.name = '{g.esc(cfg.campaign['name'])}' "
                   f"AND segments.date BETWEEN '{start}' AND '{end}' ORDER BY metrics.clicks DESC")
    rows = [TermRow(r.search_term_view.search_term, r.ad_group.name, r.search_term_view.status.name, r.metrics.impressions, r.metrics.clicks,
                    r.metrics.cost_micros, r.metrics.conversions) for r in res]
    out(f"Search terms {start} to {end}: {len(rows)} rows (personal details redacted).\n")
    for r in rows[: args.limit]:
        out(redact(f"{r.clicks:>4} clicks ${r.cost_micros / 1e6:>7.2f}  {r.conversions:>4.1f} conv  {r.term}  [{r.ad_group}]"))
    sugg, review = suggest(rows, cfg)
    out("\nSUGGESTED negatives (not applied; add the ones you agree with to campaign.yaml, then create-campaign --paused adds them):")
    for s in sugg:
        out(redact(f'  - {{ text: {s.negative}, match: {s.match} }}   # {s.reason}; from "{s.term}" ({s.clicks} clicks, ${s.cost_usd:.2f})'))
    if not sugg:
        out("  (none)")
    if review:
        out("\nWorth a look (clicks, no conversions, no rule matched):")
        for r in review:
            out(redact(f"  {r.term} ({r.clicks} clicks, ${r.cost_micros / 1e6:.2f})"))
    return 0


def cmd_pause(args, env) -> int:
    cfg = load_cfg(args)
    client = g.load_client(env)
    cid = customer_id(args, env)
    row = _campaign(client, cid, cfg)
    if row.campaign.status.name == "PAUSED":
        out("Campaign is already PAUSED. Nothing changed.")
        return 0
    if args.dry_run:
        g.pause(client, cid, row.campaign.resource_name, validate_only=True)
        out("Google validated the pause (validate_only). Nothing changed.")
        return 0
    if not confirm(f"Pause {cfg.campaign['name']!r} (currently {row.campaign.status.name})?", "pause", args.yes):
        out("Cancelled.")
        return 1
    g.pause(client, cid, row.campaign.resource_name)
    out("Campaign PAUSED.")
    return 0


def cmd_auth_login(args, env) -> int:
    """One-time: get a refresh token for the Ads API and Data Manager API scopes."""
    if not env.get("GOOGLE_ADS_CLIENT_ID") or not env.get("GOOGLE_ADS_CLIENT_SECRET"):
        raise g.ConfigError("Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET (Desktop OAuth client) in ads/.env first.")
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_config(
        {"installed": {"client_id": env["GOOGLE_ADS_CLIENT_ID"], "client_secret": env["GOOGLE_ADS_CLIENT_SECRET"],
                       "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=list(g.SCOPES),
    )
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
    target = config_mod.ADS_DIR / ".env"
    lines = target.read_text(encoding="utf-8").splitlines() if target.exists() else []
    lines = [ln for ln in lines if not ln.startswith("GOOGLE_ADS_REFRESH_TOKEN=")] + [f"GOOGLE_ADS_REFRESH_TOKEN={creds.refresh_token}"]
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out("Refresh token saved to ads/.env (git-ignored). It was not printed. Add the same value to Vercel as GOOGLE_ADS_REFRESH_TOKEN.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="corsa_ads", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", default=str(config_mod.DEFAULT_CONFIG))
    p.add_argument("--customer-id", help="Google Ads account id (default GOOGLE_ADS_CUSTOMER_ID)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth-login", help="one-time OAuth sign-in; saves the refresh token to ads/.env")
    sub.add_parser("auth-check")
    sub.add_parser("list-accounts")
    sub.add_parser("keyword-estimates")
    sub.add_parser("validate-config")
    pv = sub.add_parser("preview-campaign")
    pv.add_argument("--live", action="store_true", help="compare with what exists in the account (read-only)")
    c = sub.add_parser("create-campaign")
    mode = c.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="validate only; nothing is created")
    mode.add_argument("--paused", action="store_true", help="create what's missing, campaign PAUSED")
    c.add_argument("--yes", action="store_true", help="skip the typed confirmation")
    c.add_argument("--allow-time-zone", action="store_true")
    sub.add_parser("campaign-status")
    r = sub.add_parser("report")
    r.add_argument("--days", type=int, default=30)
    st = sub.add_parser("search-terms")
    st.add_argument("--days", type=int, default=30)
    st.add_argument("--limit", type=int, default=50)
    pz = sub.add_parser("pause-campaign")
    pz.add_argument("--dry-run", action="store_true")
    pz.add_argument("--yes", action="store_true")
    return p


COMMANDS = {
    "auth-login": cmd_auth_login,
    "auth-check": cmd_auth_check,
    "list-accounts": cmd_list_accounts,
    "keyword-estimates": cmd_keyword_estimates,
    "validate-config": cmd_validate_config,
    "preview-campaign": cmd_preview,
    "create-campaign": cmd_create,
    "campaign-status": cmd_status,
    "report": cmd_report,
    "search-terms": cmd_search_terms,
    "pause-campaign": cmd_pause,
}


def main(argv: list[str] | None = None, env: dict[str, str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    env = load_env() if env is None else env
    try:
        return COMMANDS[args.cmd](args, env)
    except g.ConfigError as ex:
        err(f"ERROR {ex}")
        return 2
    except KeyboardInterrupt:
        err("Interrupted.")
        return 130
    except Exception as ex:  # noqa: BLE001
        err(g.describe_error(ex))
        err("Nothing further was attempted. Reruns are safe: create-campaign only adds what's missing.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
