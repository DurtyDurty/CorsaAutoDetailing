"""Make two live settings match campaign.yaml that create-campaign never edits:

  - the Maximize Clicks max CPC limit   (campaign.bidding.max_cpc_usd)
  - the call asset's hours, every day   (assets.call.hours)

Nothing else changes: not the budget, the bidding strategy, ad text or status.

  python sync_bid_limit_and_call_hours.py --dry-run   Google validates the changes; nothing changes
  python sync_bid_limit_and_call_hours.py             apply them
"""

from __future__ import annotations

import sys

from corsa_ads import config as c
from corsa_ads import google_api as g
from corsa_ads.envfile import load_env

MINUTES = {0: "ZERO", 15: "FIFTEEN", 30: "THIRTY", 45: "FORTY_FIVE"}


def hm(s: str) -> tuple[int, int]:
    h, m = (int(x) for x in s.split(":"))
    if m not in MINUTES:
        raise ValueError(f"{s}: Google schedules use :00, :15, :30 or :45")
    return h, m


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    env = load_env()
    client = g.load_client(env)
    cid = g.digits(env.get("GOOGLE_ADS_CUSTOMER_ID"))
    cfg = c.load()
    E = client.enums
    row = g.find_campaign(client, cid, cfg.campaign["name"])
    if not row:
        print(f"Campaign {cfg.campaign['name']!r} not found in {cid}")
        return 1
    rn = row.campaign.resource_name
    failed = False

    # 1. Max CPC limit on Maximize Clicks.
    want = cfg.max_cpc_micros
    live = g.search(client, cid, f"SELECT campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros FROM campaign WHERE campaign.resource_name = '{rn}'")[0].campaign
    if live.bidding_strategy_type.name != "TARGET_SPEND":
        print(f"Bidding is {live.bidding_strategy_type.name}, not Maximize Clicks: limit left alone.")
    elif want and live.target_spend.cpc_bid_ceiling_micros != want:
        print(f"max CPC limit: ${live.target_spend.cpc_bid_ceiling_micros / 1e6:.2f} -> ${want / 1e6:.2f}")
        op = client.get_type("CampaignOperation")
        op.update.resource_name = rn
        op.update.target_spend.cpc_bid_ceiling_micros = want
        op.update_mask.paths.append("target_spend.cpc_bid_ceiling_micros")
        try:
            client.get_service("CampaignService").mutate_campaigns(request={"customer_id": cid, "operations": [op], "validate_only": dry})
        except Exception as ex:  # noqa: BLE001
            print("  ERROR", g.describe_error(ex))
            failed = True
    else:
        print(f"max CPC limit already ${live.target_spend.cpc_bid_ceiling_micros / 1e6:.2f}")

    # 2. Call asset hours, every day.
    hours = (cfg.raw.get("assets", {}).get("call") or {}).get("hours")
    if hours:
        (sh, sm), (eh, em) = hm(hours["start"]), hm(hours["end"])
        calls = g.search(client, cid, f"SELECT campaign.status, asset.resource_name, asset.call_asset.phone_number, asset.call_asset.ad_schedule_targets FROM campaign_asset WHERE campaign.resource_name = '{rn}' AND campaign_asset.field_type = 'CALL' AND campaign_asset.status = 'ENABLED'")
        for r in calls:
            now = [(s.day_of_week.name, s.start_hour, s.start_minute.name, s.end_hour, s.end_minute.name) for s in r.asset.call_asset.ad_schedule_targets]
            target = [(d, sh, MINUTES[sm], eh, MINUTES[em]) for d in c.DAYS]
            if sorted(now) == sorted(target):
                print(f"call {r.asset.call_asset.phone_number}: hours already {hours['start']}-{hours['end']}")
                continue
            print(f"call {r.asset.call_asset.phone_number}: hours {'all ad hours' if not now else now} -> {hours['start']}-{hours['end']} every day")
            op = client.get_type("AssetOperation")
            op.update.resource_name = r.asset.resource_name
            for d in c.DAYS:
                s = client.get_type("AdScheduleInfo")
                s.day_of_week = getattr(E.DayOfWeekEnum, d)
                s.start_hour, s.end_hour = sh, eh
                s.start_minute = getattr(E.MinuteOfHourEnum, MINUTES[sm])
                s.end_minute = getattr(E.MinuteOfHourEnum, MINUTES[em])
                op.update.call_asset.ad_schedule_targets.append(s)
            op.update_mask.paths.append("call_asset.ad_schedule_targets")
            try:
                client.get_service("AssetService").mutate_assets(request={"customer_id": cid, "operations": [op], "validate_only": dry})
            except Exception as ex:  # noqa: BLE001
                print("  ERROR", g.describe_error(ex))
                failed = True

    if failed:
        return 1
    print("Validated (nothing changed)." if dry else "Applied.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
