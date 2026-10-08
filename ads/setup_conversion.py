"""Create the "Booking confirmed" conversion action in the account from ads/.env.

The website uploads a conversion when a job from an ad click is confirmed (see
src/lib/ads); it needs this action's id in GOOGLE_ADS_CONVERSION_BOOKING.

  python setup_conversion.py --dry-run   Google validates the request; nothing is created
  python setup_conversion.py             create it (or report the one that already exists)
"""

from __future__ import annotations

import sys

from corsa_ads import google_api as g
from corsa_ads.envfile import load_env

NAME = "Booking confirmed"
DEFAULT_VALUE_USD = 150.0  # Essential Full Detail, sedan


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    env = load_env()
    client = g.load_client(env)
    cid = g.digits(env.get("GOOGLE_ADS_CUSTOMER_ID"))

    existing = g.search(client, cid, f"SELECT conversion_action.id, conversion_action.status FROM conversion_action WHERE conversion_action.name = '{g.esc(NAME)}'")
    live = [r for r in existing if r.conversion_action.status.name != "REMOVED"]
    if live:
        print(f"Already exists in {cid}: id {live[0].conversion_action.id}")
        return 0

    E = client.enums
    op = client.get_type("ConversionActionOperation")
    a = op.create
    a.name = NAME
    a.type_ = E.ConversionActionTypeEnum.UPLOAD_CLICKS
    a.category = E.ConversionActionCategoryEnum.BOOK_APPOINTMENT
    a.status = E.ConversionActionStatusEnum.ENABLED
    a.primary_for_goal = True
    a.counting_type = E.ConversionActionCountingTypeEnum.ONE_PER_CLICK
    a.value_settings.default_value = DEFAULT_VALUE_USD
    a.value_settings.default_currency_code = "USD"
    a.value_settings.always_use_default_value = False

    req = client.get_type("MutateConversionActionsRequest")
    req.customer_id = cid
    req.operations.append(op)
    req.validate_only = dry
    try:
        resp = client.get_service("ConversionActionService").mutate_conversion_actions(request=req)
    except Exception as ex:  # noqa: BLE001
        print("ERROR", g.describe_error(ex))
        return 1
    if dry:
        print(f"Google validated the request for account {cid} (validate_only). Nothing was created.")
        return 0
    rn = resp.results[0].resource_name
    print(f"Created in {cid}: id {rn.rsplit('/', 1)[-1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
