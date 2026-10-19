"""One-off (2026-10-19): add a "Services" structured snippet to the English campaign and turn on
dynamic image extensions (Google's open recommendation). Run from ads/:

    .venv\\Scripts\\python.exe add_snippet_and_images.py           # validate only, changes nothing
    .venv\\Scripts\\python.exe add_snippet_and_images.py --apply   # makes the changes

Snippet values must match the packages in src/config/business.ts.
"""
import sys

from corsa_ads import config, envfile, google_api as g

HEADER = "Services"
VALUES = [
    "Basic Package",
    "Essential Full Detail",
    "Signature Full Detail",
    "Monthly Maintenance",
    "Interior Deep Clean",
    "Exterior Hand Wash",
]


def main() -> int:
    apply = "--apply" in sys.argv
    env = envfile.load_env()
    client = g.load_client(env)
    cid = g.digits(env["GOOGLE_ADS_CUSTOMER_ID"])
    cfg = config.load()
    row = g.find_campaign(client, cid, cfg.campaign["name"])
    if not row:
        print("Campaign not found")
        return 1
    campaign_rn = row.campaign.resource_name

    existing = g.search(client, cid, (
        "SELECT campaign_asset.resource_name FROM campaign_asset "
        f"WHERE campaign_asset.field_type = 'STRUCTURED_SNIPPET' AND campaign.resource_name = '{campaign_rn}' "
        "AND campaign_asset.status = 'ENABLED'"))
    if existing:
        print("Structured snippet: already on the campaign, skipped")
    else:
        E = client.enums
        asset_rn = f"customers/{cid}/assets/-1"
        ops = []
        o = client.get_type("MutateOperation")
        a = o.asset_operation.create
        a.resource_name = asset_rn
        a.structured_snippet_asset.header = HEADER
        a.structured_snippet_asset.values.extend(VALUES)
        ops.append(o)
        o = client.get_type("MutateOperation")
        ca = o.campaign_asset_operation.create
        ca.campaign = campaign_rn
        ca.asset = asset_rn
        ca.field_type = E.AssetFieldTypeEnum.STRUCTURED_SNIPPET
        ops.append(o)
        g.mutate(client, cid, ops, validate_only=not apply)
        print(f"Structured snippet {HEADER}: {', '.join(VALUES)} -> {'ADDED' if apply else 'validated, nothing changed'}")

    recs = g.search(client, cid, (
        "SELECT recommendation.resource_name FROM recommendation "
        "WHERE recommendation.type = 'DYNAMIC_IMAGE_EXTENSION_OPT_IN'"))
    if not recs:
        print("Dynamic images: no open recommendation (already on, or Google withdrew it)")
    elif not apply:
        print("Dynamic images: recommendation found, would be applied with --apply")
    else:
        svc = client.get_service("RecommendationService")
        op = client.get_type("ApplyRecommendationOperation")
        op.resource_name = recs[0].recommendation.resource_name
        svc.apply_recommendation(customer_id=cid, operations=[op])
        print("Dynamic images: TURNED ON")
    return 0


if __name__ == "__main__":
    sys.exit(main())
