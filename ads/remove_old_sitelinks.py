"""Unlink live sitelinks that are no longer in campaign.yaml (one-off, 2026-10-28: Monthly Maintenance -> Corsa Club).

create-campaign only adds what's missing, so a sitelink taken out of the YAML stays live until
this removes its campaign link. Only sitelinks are touched; the asset itself is left in the library.

  python remove_old_sitelinks.py --dry-run   Google validates the removals; nothing changes
  python remove_old_sitelinks.py             apply them
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
    keep = {s["text"] for s in cfg.sitelinks}

    ops, changes = [], []
    for r in g.search(client, cid, f"SELECT campaign_asset.resource_name, asset.sitelink_asset.link_text FROM campaign_asset WHERE campaign.resource_name = '{rn}' AND campaign_asset.field_type = 'SITELINK' AND campaign_asset.status != 'REMOVED'"):
        text = r.asset.sitelink_asset.link_text
        if text not in keep:
            op = client.get_type("CampaignAssetOperation")
            op.remove = r.campaign_asset.resource_name
            ops.append(op)
            changes.append(f"remove sitelink {text!r}")

    if not changes:
        print("Live sitelinks already match campaign.yaml.")
        return 0
    print("\n".join(changes))
    try:
        client.get_service("CampaignAssetService").mutate_campaign_assets(request={"customer_id": cid, "operations": ops, "validate_only": dry})
    except Exception as ex:  # noqa: BLE001
        print("ERROR", g.describe_error(ex))
        return 1
    print(f"{'Validated (nothing changed)' if dry else 'Applied'}: {len(changes)} change(s) in {cid}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
