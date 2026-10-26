"""Make the live campaign's landing pages match campaign.yaml (one-off, 2026-10-25: everything to /book).

create-campaign only adds what's missing, so URLs on existing ads, keywords and
sitelinks need this. It changes URLs only: ad text, bids, budget and status are untouched.

  - each ad group's responsive search ad  -> the ad group's final_url
  - keywords with their own landing page  -> the keyword's final_url (none = use the ad's)
  - sitelinks, matched by link text       -> the sitelink's url

  python point_ads_to_book.py --dry-run   Google validates the changes; nothing changes
  python point_ads_to_book.py             apply them
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
    groups = {ag.name: ag for ag in cfg.ad_groups}

    ad_ops, kw_ops, asset_ops, changes = [], [], [], []

    for r in g.search(client, cid, f"SELECT ad_group.name, ad_group_ad.ad.resource_name, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE campaign.resource_name = '{rn}' AND ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD AND ad_group_ad.status != 'REMOVED'"):
        want = [cfg.url(groups[r.ad_group.name].final_url)] if r.ad_group.name in groups else None
        if want and list(r.ad_group_ad.ad.final_urls) != want:
            op = client.get_type("AdOperation")
            op.update.resource_name = r.ad_group_ad.ad.resource_name
            op.update.final_urls.extend(want)
            op.update_mask.paths.append("final_urls")
            ad_ops.append(op)
            changes.append(f"ad {r.ad_group.name}: {list(r.ad_group_ad.ad.final_urls)} -> {want}")

    for r in g.search(client, cid, f"SELECT ad_group.name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.final_urls FROM ad_group_criterion WHERE campaign.resource_name = '{rn}' AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'"):
        crit = r.ad_group_criterion
        kw = next((k for k in getattr(groups.get(r.ad_group.name), "keywords", []) if k.text == crit.keyword.text and k.match == crit.keyword.match_type.name), None)
        want = [cfg.url(kw.final_url)] if kw and kw.final_url else []
        if kw and list(crit.final_urls) != want:
            op = client.get_type("AdGroupCriterionOperation")
            op.update.resource_name = crit.resource_name
            op.update.final_urls.extend(want)
            op.update_mask.paths.append("final_urls")
            kw_ops.append(op)
            changes.append(f"keyword {crit.keyword.text!r}: {list(crit.final_urls)} -> {want or '(the ad URL)'}")

    links = {s["text"]: cfg.url(s["url"]) for s in cfg.sitelinks}
    for r in g.search(client, cid, f"SELECT asset.resource_name, asset.sitelink_asset.link_text, asset.final_urls FROM campaign_asset WHERE campaign.resource_name = '{rn}' AND campaign_asset.field_type = 'SITELINK' AND campaign_asset.status != 'REMOVED'"):
        want = links.get(r.asset.sitelink_asset.link_text)
        if want and list(r.asset.final_urls) != [want]:
            op = client.get_type("AssetOperation")
            op.update.resource_name = r.asset.resource_name
            op.update.final_urls.append(want)
            op.update_mask.paths.append("final_urls")
            asset_ops.append(op)
            changes.append(f"sitelink {r.asset.sitelink_asset.link_text!r}: {list(r.asset.final_urls)} -> [{want!r}]")

    if not changes:
        print("Live URLs already match campaign.yaml.")
        return 0
    print("\n".join(changes))
    try:
        if ad_ops:
            client.get_service("AdService").mutate_ads(request={"customer_id": cid, "operations": ad_ops, "validate_only": dry})
        if kw_ops:
            client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(request={"customer_id": cid, "operations": kw_ops, "validate_only": dry})
        if asset_ops:
            client.get_service("AssetService").mutate_assets(request={"customer_id": cid, "operations": asset_ops, "validate_only": dry})
    except Exception as ex:  # noqa: BLE001
        print("ERROR", g.describe_error(ex))
        return 1
    print(f"{'Validated (nothing changed)' if dry else 'Applied'}: {len(changes)} change(s) in {cid}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
