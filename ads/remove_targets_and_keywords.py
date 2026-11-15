"""Remove live keywords and locations that are no longer in campaign.yaml (one-off, 2026-11-14 audit).

create-campaign only adds what's missing, so a keyword or location taken out of the YAML stays live until
this removes it. Used for: the "near me" keywords moved from Mobile Detailing to Near Me Detailing,
"auto cleaning near me" dropped, and the St. Johns targets (Saint Johns, ZIP 32092) dropped.

Run create-campaign first, so the moved keywords already exist in their new ad group.
Only positive keywords in ad groups the YAML names, and location targets, are touched; negatives,
ads, assets, budget and bids are left alone.

  python remove_targets_and_keywords.py --dry-run   Google validates the removals; nothing changes
  python remove_targets_and_keywords.py             apply them
"""

from __future__ import annotations

import sys

from corsa_ads import config as c
from corsa_ads import google_api as g
from corsa_ads.envfile import load_env


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    env = load_env()
    client = g.load_client(env)
    cid = g.digits(env.get("GOOGLE_ADS_CUSTOMER_ID"))
    cfg = c.load()
    row = g.find_campaign(client, cid, cfg.campaign["name"])
    if not row:
        print(f"Campaign {cfg.campaign['name']!r} not found in {cid}")
        return 1
    rn = row.campaign.resource_name
    want_kw = {(grp.name, k.text.lower(), k.match) for grp in cfg.ad_groups for k in grp.keywords}
    groups = {grp.name for grp in cfg.ad_groups}
    want_locs = {l["id"] for l in cfg.campaign["locations"]}

    kw_ops, loc_ops, changes = [], [], []
    live_kw = set()
    for r in g.search(
        client,
        cid,
        "SELECT ad_group.name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type "
        f"FROM ad_group_criterion WHERE campaign.resource_name = '{rn}' AND ad_group_criterion.type = 'KEYWORD' "
        "AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED'",
    ):
        key = (r.ad_group.name, r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
        live_kw.add(key)
        if key[0] in groups and key not in want_kw:
            op = client.get_type("AdGroupCriterionOperation")
            op.remove = r.ad_group_criterion.resource_name
            kw_ops.append(op)
            changes.append(f"remove keyword {key[0]}: {key[1]} [{key[2]}]")

    # A moved keyword must already be live in its new ad group, or the search would go unserved.
    moved_missing = sorted(k for k in want_kw if k not in live_kw)
    if moved_missing:
        print("Run create-campaign first; these YAML keywords aren't live yet:", moved_missing)
        return 1

    for r in g.search(
        client,
        cid,
        "SELECT campaign_criterion.resource_name, campaign_criterion.location.geo_target_constant "
        f"FROM campaign_criterion WHERE campaign.resource_name = '{rn}' AND campaign_criterion.type = 'LOCATION' "
        "AND campaign_criterion.negative = FALSE AND campaign_criterion.status != 'REMOVED'",
    ):
        geo = int(r.campaign_criterion.location.geo_target_constant.rsplit("/", 1)[-1])
        if geo not in want_locs:
            op = client.get_type("CampaignCriterionOperation")
            op.remove = r.campaign_criterion.resource_name
            loc_ops.append(op)
            changes.append(f"remove location {c.VERIFIED_GEO.get(geo, geo)} [{geo}]")

    if not changes:
        print("Live keywords and locations already match campaign.yaml.")
        return 0
    print("\n".join(changes))
    try:
        if kw_ops:
            client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(request={"customer_id": cid, "operations": kw_ops, "validate_only": dry})
        if loc_ops:
            client.get_service("CampaignCriterionService").mutate_campaign_criteria(request={"customer_id": cid, "operations": loc_ops, "validate_only": dry})
    except Exception as ex:  # noqa: BLE001
        print("ERROR", g.describe_error(ex))
        return 1
    print(f"{'Validated (nothing changed)' if dry else 'Applied'}: {len(changes)} change(s) in {cid}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
