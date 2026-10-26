"""Create the website (Google tag) conversion actions and print their send_to values.

The site fires these from the browser through the account's Google tag:

  "Booking request sent"  a booking request was saved (fires after the server confirms the save)
  "Call or text tap"      a visitor tapped a tel: or sms: link

Both count as Primary. "Booking confirmed" (the server upload, see setup_conversion.py)
is set to Secondary so one customer who requests and then books isn't counted twice
in the Conversions column; it still shows in All conversions with its value.

  python setup_web_conversions.py --dry-run   Google validates the requests; nothing changes
  python setup_web_conversions.py             create what's missing, then print the labels
"""

from __future__ import annotations

import re
import sys

from corsa_ads import google_api as g
from corsa_ads.envfile import load_env

ACTIONS = [
    ("Booking request sent", "SUBMIT_LEAD_FORM"),
    ("Call or text tap", "PHONE_CALL_LEAD"),
]
UPLOAD_ACTION = "Booking confirmed"


def find(client, cid: str, name: str):
    rows = g.search(
        client,
        cid,
        "SELECT conversion_action.resource_name, conversion_action.id, conversion_action.status, conversion_action.primary_for_goal, "
        f"conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.name = '{g.esc(name)}'",
    )
    live = [r.conversion_action for r in rows if r.conversion_action.status.name != "REMOVED"]
    return live[0] if live else None


def send_to(action) -> str | None:
    for s in action.tag_snippets:
        m = re.search(r"'send_to':\s*'([^']+)'", s.event_snippet)
        if m:
            return m.group(1)
    return None


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    env = load_env()
    client = g.load_client(env)
    cid = g.digits(env.get("GOOGLE_ADS_CUSTOMER_ID"))
    E = client.enums
    svc = client.get_service("ConversionActionService")

    ops = []
    for name, category in ACTIONS:
        if find(client, cid, name):
            print(f"Already exists: {name}")
            continue
        op = client.get_type("ConversionActionOperation")
        a = op.create
        a.name = name
        a.type_ = E.ConversionActionTypeEnum.WEBPAGE
        a.category = getattr(E.ConversionActionCategoryEnum, category)
        a.status = E.ConversionActionStatusEnum.ENABLED
        a.primary_for_goal = True
        a.counting_type = E.ConversionActionCountingTypeEnum.ONE_PER_CLICK
        a.value_settings.default_value = 0
        a.value_settings.default_currency_code = "USD"
        a.value_settings.always_use_default_value = True
        ops.append(op)

    upload = find(client, cid, UPLOAD_ACTION)
    if upload and upload.primary_for_goal:
        op = client.get_type("ConversionActionOperation")
        op.update.resource_name = upload.resource_name
        op.update.primary_for_goal = False
        op.update_mask.paths.append("primary_for_goal")
        ops.append(op)

    if ops:
        req = client.get_type("MutateConversionActionsRequest")
        req.customer_id = cid
        req.operations.extend(ops)
        req.validate_only = dry
        try:
            svc.mutate_conversion_actions(request=req)
        except Exception as ex:  # noqa: BLE001
            print("ERROR", g.describe_error(ex))
            return 1
        if dry:
            print(f"Google validated {len(ops)} change(s) for account {cid} (validate_only). Nothing changed.")
            return 0
        print(f"Applied {len(ops)} change(s) in {cid}.")
    else:
        print("Nothing to change.")

    for name, _ in ACTIONS + [(UPLOAD_ACTION, "")]:
        a = find(client, cid, name)
        if a:
            print(f"{name}: id {a.id}, primary {a.primary_for_goal}, send_to {send_to(a) or '(upload, no tag)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
