"""Tests for the Corsa Google Ads tool. Run from ads/:  .venv/Scripts/python -m unittest -v"""

from __future__ import annotations

import copy
import io
import re
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from corsa_ads import cli, config, google_api as g, negatives, plan, redact, state

REPO = config.ADS_DIR.parent


def cfg_with(**edits):
    """The real campaign.yaml with edits applied to the raw dict, revalidated."""
    base = config.load()
    raw = copy.deepcopy(base.raw)
    for path, value in edits.items():
        node = raw
        keys = path.split(".")
        for k in keys[:-1]:
            node = node[int(k)] if k.isdigit() else node[k]
        last = keys[-1]
        node[int(last) if last.isdigit() else last] = value
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8") as f:
        import yaml

        yaml.safe_dump(raw, f, sort_keys=False, allow_unicode=True)
    return config.load(f.name)


def full_existing(cfg) -> plan.Existing:
    ex = plan.Existing(campaign="customers/1/campaigns/9", campaign_status="PAUSED", budget="customers/1/campaignBudgets/8", budget_micros=cfg.budget_micros)
    for s in plan.desired(cfg):
        k = s.kind
        if k == "location":
            ex.locations.add(s.key[0])
        elif k == "language":
            ex.languages.add(s.key[0])
        elif k == "schedule":
            ex.schedule_days.add(s.key[0])
        elif k == "negative":
            ex.negatives.add(s.key)
        elif k == "ad_group":
            ex.ad_groups[s.key[0]] = f"customers/1/adGroups/{len(ex.ad_groups) + 1}"
        elif k == "keyword":
            ex.keywords.add(s.key)
        elif k == "ad":
            ex.ads.add(s.key[0])
        elif k == "callout":
            ex.callouts.add(s.key[0])
        elif k == "sitelink":
            ex.sitelinks.add(s.key[0])
        elif k == "call":
            ex.has_call = True
    return ex


class ConfigTests(unittest.TestCase):
    def test_campaign_yaml_is_valid(self):
        c = config.load()
        self.assertEqual(c.errors, [])
        self.assertEqual(c.campaign["status"], "PAUSED")
        self.assertEqual(c.campaign["name"], "Corsa | Search | Clay County | Launch Oct 2026")

    def test_budget_micros(self):
        self.assertEqual(config.usd_to_micros(10), 10_000_000)
        self.assertEqual(config.usd_to_micros(12.34), 12_340_000)
        self.assertEqual(config.load().budget_micros, 5_000_000)
        self.assertIn("whole cents", " ".join(cfg_with(**{"campaign.daily_budget_usd": 10.005}).errors))
        self.assertIn("safety cap", " ".join(cfg_with(**{"campaign.daily_budget_usd": 500}).errors))
        self.assertTrue(cfg_with(**{"campaign.daily_budget_usd": 0}).errors)

    def test_only_paused(self):
        self.assertIn("PAUSED", " ".join(cfg_with(**{"campaign.status": "ENABLED"}).errors))

    def test_networks_and_language(self):
        self.assertTrue(cfg_with(**{"campaign.networks.search_partners": True}).errors)
        self.assertTrue(cfg_with(**{"campaign.networks.display": True}).errors)
        self.assertTrue(cfg_with(**{"campaign.languages": [{"id": 1001, "name": "German"}]}).errors)
        both = [{"id": 1000, "name": "English"}, {"id": 1003, "name": "Spanish"}]
        self.assertIn("exactly one", " ".join(cfg_with(**{"campaign.languages": both}).errors))

    def test_spanish_campaign(self):
        es = config.load(config.ADS_DIR / "campaign-es.yaml")
        self.assertEqual(es.errors, [])
        self.assertEqual(es.campaign["status"], "PAUSED")
        self.assertEqual(es.budget_micros, 5_000_000)
        self.assertEqual([l["id"] for l in es.campaign["languages"]], [1003])
        self.assertNotEqual(es.campaign["name"], config.load().campaign["name"])
        self.assertNotEqual(es.campaign["budget_name"], config.load().campaign["budget_name"])
        for bad in ("Recubrimiento Cerámico", "El Mejor Detallado", "Últimos Cupos Hoy", "Lavado Gratis", "Pague un Depósito"):
            errors = []
            config.check_text("h", bad, 30, errors)
            self.assertTrue(errors, bad)
        self.assertIn("Se Habla Español", config.load().callouts)

    def test_locations_are_the_three_verified_towns_only(self):
        c = config.load()
        self.assertEqual({l["id"] for l in c.campaign["locations"]}, {1015119, 1015041, 9196545})
        clay_county = [{"id": 9057255, "name": "Clay County, Florida, United States", "type": "County"}]
        self.assertIn("not one of the verified", " ".join(cfg_with(**{"campaign.locations": clay_county}).errors))
        self.assertIn("PRESENCE", " ".join(cfg_with(**{"campaign.location_matching": "PRESENCE_OR_INTEREST"}).errors))

    def test_character_limits(self):
        long_h = "A headline that is far too long for Google"
        self.assertIn("/30 characters", " ".join(cfg_with(**{"ad_groups.0.ad.headlines.0": long_h}).errors))
        self.assertIn("/90 characters", " ".join(cfg_with(**{"ad_groups.0.ad.descriptions.0": "x " * 50}).errors))
        self.assertIn("path1", " ".join(cfg_with(**{"ad_groups.0.ad.path1": "mobile-detailing-now"}).errors))
        self.assertIn("/25 characters", " ".join(cfg_with(**{"assets.callouts.0": "A callout that runs much too long"}).errors))
        self.assertEqual(config.display_width("洗車"), 4)

    def test_all_shipped_text_fits(self):
        c = config.load()
        for grp in c.ad_groups:
            self.assertTrue(3 <= len(grp.headlines) <= 15 and 2 <= len(grp.descriptions) <= 4)
            for h in grp.headlines:
                self.assertLessEqual(config.display_width(h), 30, h)
            for d in grp.descriptions:
                self.assertLessEqual(config.display_width(d), 90, d)

    def test_claims(self):
        for bad in ("Ceramic Coating Included", "Best Detailing in Town", "Only 3 Spots Left", "Pay a Deposit Online", "Free Air Freshener"):
            self.assertTrue(cfg_with(**{"ad_groups.0.ad.headlines.0": bad}).errors, bad)
        self.assertIn("not a current package price", " ".join(cfg_with(**{"ad_groups.0.ad.headlines.2": "Detailing From $120"}).errors))

    def test_prices_come_from_the_site(self):
        prices = config.allowed_prices((REPO / "src/config/business.ts").read_text(encoding="utf-8"))
        self.assertIn(125, prices)
        self.assertNotIn(120, prices)
        self.assertEqual(min(prices), 125, "ads say 'From $125'; update the ad copy if the lowest price changed")

    def test_keywords(self):
        c = config.load()
        kws = {(k.text, k.match) for grp in c.ad_groups for k in grp.keywords}
        self.assertIn(("mobile auto detailing near me", "EXACT"), kws)
        self.assertIn(("mobile detailing near me", "PHRASE"), kws)
        self.assertEqual(len(kws), 12)
        self.assertTrue(cfg_with(**{"ad_groups.0.keywords.0.match": "BROAD"}).errors)
        self.assertTrue(cfg_with(**{"ad_groups.0.keywords.0.text": '"mobile detailing"'}).errors)
        dup = cfg_with(**{"ad_groups.1.keywords.0.text": "mobile car detailing", "ad_groups.1.keywords.0.match": "PHRASE"})
        self.assertIn("duplicates", " ".join(dup.errors))

    def test_negatives_never_block_our_keywords(self):
        blocked = cfg_with(**{"ad_groups.0.keywords.0.text": "mobile detailing jobs"})
        self.assertIn("blocked by negative", " ".join(blocked.errors))
        n = config.Keyword("how to", "PHRASE")
        self.assertTrue(config.negative_blocks(n, "how to detail a car"))
        self.assertFalse(config.negative_blocks(n, "to how detail"))
        b = config.Keyword("jobs", "BROAD")
        self.assertTrue(config.negative_blocks(b, "car detailing jobs near me"))
        self.assertFalse(config.negative_blocks(b, "car detailing job"), "broad negatives don't cover plurals; 'job' is listed separately")
        self.assertIn(("job", "BROAD"), {(x.text, x.match) for x in config.load().negatives})

    def test_urls_are_real_pages(self):
        site = REPO / "src" / "app" / "(site)"
        biz = (REPO / "src/config/business.ts").read_text(encoding="utf-8")
        for p in config.KNOWN_PATHS:
            if p == "/":
                self.assertTrue((site / "page.tsx").exists())
            elif p.startswith("/service-areas/"):
                self.assertTrue((site / "service-areas" / "[slug]" / "page.tsx").exists())
                self.assertIn(f'"{p.rsplit("/", 1)[1]}"', biz, f"town slug for {p}")
            else:
                self.assertTrue((site / p.strip("/") / "page.tsx").exists(), p)
        self.assertTrue(cfg_with(**{"ad_groups.0.final_url": "/nope"}).errors)


class PlanTests(unittest.TestCase):
    def test_new_campaign_creates_everything(self):
        c = config.load()
        steps = plan.missing(c, plan.Existing())
        self.assertEqual(steps, plan.desired(c))
        kinds = [s.kind for s in steps]
        self.assertEqual(kinds[:2], ["budget", "campaign"])
        self.assertEqual(kinds.count("location"), 3)
        self.assertEqual(kinds.count("keyword"), 12)
        self.assertEqual(kinds.count("call"), 1)
        no_phone = cfg_with(**{"assets.call.phone": None})
        self.assertEqual([s.kind for s in plan.desired(no_phone)].count("call"), 0, "no call asset without a phone number")

    def test_rerun_creates_nothing(self):
        c = config.load()
        self.assertEqual(plan.missing(c, full_existing(c)), [])

    def test_partial_rerun_adds_only_missing(self):
        c = config.load()
        ex = full_existing(c)
        ex.keywords.discard(("Mobile Detailing", "mobile car detailing", "PHRASE"))
        ex.callouts.discard("Veteran-Owned")
        self.assertEqual([(s.kind, s.key) for s in plan.missing(c, ex)], [("keyword", ("Mobile Detailing", "mobile car detailing", "PHRASE")), ("callout", ("Veteran-Owned",))])

    def test_drift_is_reported_not_changed(self):
        c = config.load()
        ex = full_existing(c)
        ex.campaign_status = "ENABLED"
        ex.budget_micros = 25_000_000
        notes = " ".join(plan.drift(c, ex))
        self.assertIn("ENABLED", notes)
        self.assertIn("never changed", notes)
        self.assertEqual(plan.missing(c, ex), [])

    def test_preview(self):
        text = plan.preview(config.load())
        self.assertIn("PAUSED", text)
        self.assertIn("5000000 micros", text)
        self.assertIn("Middleburg, Florida, United States [1015119]", text)
        self.assertRegex(text, r"H1\s+28/30  Clay County Mobile Detailing")


class BuildTests(unittest.TestCase):
    """Builds real google-ads v25 request objects offline (catches wrong field and enum names)."""

    @classmethod
    def setUpClass(cls):
        cls.client = g.offline_client()
        cls.cfg = config.load()
        cls.ops = g.build_operations(cls.client, "1234567890", cls.cfg, plan.desired(cls.cfg), plan.Existing())

    def kind(self, name):
        return [getattr(o, name).create for o in self.ops if o._pb.WhichOneof("operation") == name]

    def test_campaign_settings(self):
        (camp,) = self.kind("campaign_operation")
        E = self.client.enums
        self.assertEqual(camp.status, E.CampaignStatusEnum.PAUSED)
        self.assertEqual(camp.advertising_channel_type, E.AdvertisingChannelTypeEnum.SEARCH)
        self.assertTrue(camp.network_settings.target_google_search)
        self.assertFalse(camp.network_settings.target_search_network)
        self.assertFalse(camp.network_settings.target_content_network)
        self.assertEqual(camp.geo_target_type_setting.positive_geo_target_type, E.PositiveGeoTargetTypeEnum.PRESENCE)
        self.assertEqual(camp.contains_eu_political_advertising, E.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
        self.assertEqual(camp._pb.WhichOneof("campaign_bidding_strategy"), "target_spend")
        self.assertEqual(camp.target_spend.cpc_bid_ceiling_micros, 0)

    def test_budget(self):
        (b,) = self.kind("campaign_budget_operation")
        self.assertEqual(b.amount_micros, 5_000_000)
        self.assertFalse(b.explicitly_shared)

    def test_criteria(self):
        crit = self.kind("campaign_criterion_operation")
        geos = sorted(c.location.geo_target_constant for c in crit if c.location.geo_target_constant)
        self.assertEqual(geos, ["geoTargetConstants/1015041", "geoTargetConstants/1015119", "geoTargetConstants/9196545"])
        self.assertEqual([c.language.language_constant for c in crit if c.language.language_constant], ["languageConstants/1000"])
        sched = [c.ad_schedule for c in crit if c.ad_schedule.start_hour or c.ad_schedule.end_hour]
        self.assertEqual(len(sched), 7)
        self.assertTrue(all(s.start_hour == 8 and s.end_hour == 19 for s in sched))
        self.assertEqual(sum(1 for c in crit if c.negative), 17)

    def test_keywords_and_ads(self):
        kws = self.kind("ad_group_criterion_operation")
        self.assertEqual(len(kws), 12)
        town = next(k for k in kws if k.keyword.text == "mobile detailing middleburg")
        self.assertEqual(list(town.final_urls), ["https://corsaautodetailing.com/service-areas/middleburg"])
        ads = self.kind("ad_group_ad_operation")
        self.assertEqual(len(ads), 2)
        self.assertEqual(len(ads[0].ad.responsive_search_ad.headlines), 15)
        self.assertEqual(list(ads[1].ad.final_urls), ["https://corsaautodetailing.com/services"])

    def test_assets(self):
        assets = self.kind("asset_operation")
        links = self.kind("campaign_asset_operation")
        self.assertEqual(len(assets), len(links), "every asset is linked to the campaign")
        self.assertEqual(len(assets), len(self.cfg.callouts) + len(self.cfg.sitelinks) + 1, "callouts, sitelinks and the call asset")
        self.assertEqual(len(self.cfg.sitelinks), 4)

    def test_rerun_with_existing_campaign_uses_its_resource_names(self):
        ex = full_existing(self.cfg)
        ex.keywords.discard(("Mobile Detailing", "mobile car detailing", "PHRASE"))
        ops = g.build_operations(self.client, "1234567890", self.cfg, plan.missing(self.cfg, ex), ex)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0].ad_group_criterion_operation.create.ad_group, ex.ad_groups["Mobile Detailing"])

    def test_max_cpc_ceiling(self):
        c = cfg_with(**{"campaign.bidding.max_cpc_usd": 3.5})
        ops = g.build_operations(self.client, "1234567890", c, plan.desired(c), plan.Existing())
        camp = next(o.campaign_operation.create for o in ops if o._pb.WhichOneof("operation") == "campaign_operation")
        self.assertEqual(camp.target_spend.cpc_bid_ceiling_micros, 3_500_000)


class QueryTests(unittest.TestCase):
    def test_filter_field_added_to_select(self):
        q = g.with_filter_fields("SELECT ad_group.name FROM ad_group WHERE campaign.resource_name = 'x'")
        self.assertTrue(q.startswith("SELECT campaign.resource_name, ad_group.name"))
        same = "SELECT campaign.resource_name, campaign.id FROM campaign WHERE campaign.resource_name = 'x'"
        self.assertEqual(g.with_filter_fields(same), same)
        self.assertEqual(g.with_filter_fields("SELECT a FROM b"), "SELECT a FROM b")


class PauseTests(unittest.TestCase):
    def test_pause_only_sets_status(self):
        client = g.offline_client()
        sent = {}

        class FakeService:
            def mutate_campaigns(self, request):
                sent.update(request)

        with mock.patch.object(client, "get_service", lambda name: FakeService()):
            g.pause(client, "1234567890", "customers/1234567890/campaigns/5", validate_only=True)
        (op,) = sent["operations"]
        self.assertTrue(sent["validate_only"])
        self.assertEqual(list(op.update_mask.paths), ["status"])
        self.assertEqual(op.update.status, client.enums.CampaignStatusEnum.PAUSED)


class NegativeSuggestionTests(unittest.TestCase):
    def row(self, term, clicks=1, status="NONE", conv=0.0):
        return negatives.TermRow(term, "Mobile Detailing", status, 10, clicks, clicks * 1_500_000, conv)

    def test_suggestions(self):
        c = config.load()
        rows = [
            self.row("mobile detailing salary florida"),
            self.row("how to detail a car interior"),
            self.row("jacksonville mobile detailing"),
            self.row("ceramic coating near me"),
            self.row("detailing job openings", status="EXCLUDED"),
            self.row("mobile detailing near me", clicks=9, conv=2),
            self.row("car detailers green cove", clicks=6),
        ]
        sugg, review = negatives.suggest(rows, c)
        got = {(s.negative, s.match) for s in sugg}
        self.assertNotIn(("salary", "BROAD"), got, "already covered by the campaign's negatives")
        self.assertNotIn(("how to", "PHRASE"), got, "already covered")
        self.assertIn(("jacksonville", "PHRASE"), got)
        self.assertIn(("ceramic", "PHRASE"), got)
        self.assertEqual([r.term for r in review], ["car detailers green cove"])


class RedactTests(unittest.TestCase):
    def test_redacts_secrets_and_personal_data(self):
        env = {"GOOGLE_ADS_DEVELOPER_TOKEN": "devtok_ABC123xyz"}
        text = "token devtok_ABC123xyz refresh_token=1//0abcdefghijklmnopqrstuvwxyz ya29.a0Abc sam@example.com (904) 555-0100 904-555-0100 GOCSPX-secret"
        out = redact.redact(text, env)
        for leak in ("devtok_ABC123xyz", "1//0abc", "ya29.", "sam@example.com", "555-0100", "GOCSPX-secret"):
            self.assertNotIn(leak, out)

    def test_keeps_customer_ids(self):
        self.assertIn("1234567890", redact.redact("account 1234567890", {}))


class StateTests(unittest.TestCase):
    def test_record_and_load(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            state.record_create("1234567890", "Camp", ["customers/1234567890/campaignBudgets/5", "customers/1234567890/campaigns/7"], base)
            data = state.load("1234567890", base)
            self.assertEqual(data["campaigns"]["Camp"]["campaign"], "customers/1234567890/campaigns/7")
            with self.assertRaises(ValueError):
                state.path_for("../etc", base)

    def test_state_and_secrets_are_git_ignored(self):
        ignore = (config.ADS_DIR / ".gitignore").read_text(encoding="utf-8")
        for entry in (".env", ".state/", ".venv/"):
            self.assertIn(entry, ignore)


class FakeGoogle:
    """Stands in for the API: records mutate calls, tracks what 'exists'."""

    def __init__(self, cfg, existing=None):
        self.cfg = cfg
        self.existing = existing or plan.Existing()
        self.mutates: list[bool] = []

    def patches(self):
        return [
            mock.patch.object(g, "load_client", lambda env: g.offline_client()),
            mock.patch.object(g, "account_info", lambda c, cid: {"id": cid, "name": "Corsa", "currency": "USD", "time_zone": "America/New_York",
                                                                  "test_account": False, "manager": False, "auto_tagging": True}),
            mock.patch.object(g, "discover", lambda c, cid, cfg: self.existing),
            mock.patch.object(g, "mutate", self.mutate),
            mock.patch.object(g, "created_names", lambda resp: ["customers/1234567890/campaigns/77"]),
            mock.patch.object(state, "STATE_DIR", Path(tempfile.mkdtemp())),
        ]

    def mutate(self, client, cid, ops, validate_only):
        self.mutates.append(validate_only)
        if not validate_only:
            self.existing = full_existing(self.cfg)
        return object()


ENV = {"GOOGLE_ADS_DEVELOPER_TOKEN": "t", "GOOGLE_ADS_CLIENT_ID": "i", "GOOGLE_ADS_CLIENT_SECRET": "s", "GOOGLE_ADS_REFRESH_TOKEN": "r", "GOOGLE_ADS_CUSTOMER_ID": "123-456-7890"}


def run(argv, env, stdin=""):
    o, e = io.StringIO(), io.StringIO()
    with redirect_stdout(o), redirect_stderr(e), mock.patch("builtins.input", lambda prompt="": stdin):
        code = cli.main(argv, env)
    return code, o.getvalue() + e.getvalue()


class CliTests(unittest.TestCase):
    def test_validate_config(self):
        code, text = run(["validate-config"], {})
        self.assertEqual(code, 0, text)

    def test_dry_run_without_credentials_builds_locally(self):
        code, text = run(["create-campaign", "--dry-run"], {})
        self.assertEqual(code, 0, text)
        self.assertIn("Nothing was created", text)

    def test_create_requires_an_explicit_mode_and_there_is_no_enable(self):
        for argv in (["create-campaign"], ["enable-campaign"], ["create-campaign", "--dry-run", "--paused"]):
            with self.assertRaises(SystemExit), redirect_stderr(io.StringIO()):
                cli.main(argv, {})

    def test_dry_run_with_credentials_validates_only(self):
        fake = FakeGoogle(config.load())
        with contextlib_all(fake.patches()):
            code, text = run(["create-campaign", "--dry-run"], ENV)
        self.assertEqual(code, 0, text)
        self.assertEqual(fake.mutates, [True])
        self.assertIn("validate_only", text)

    def test_paused_create_then_safe_rerun(self):
        cfg = config.load()
        fake = FakeGoogle(cfg)
        with contextlib_all(fake.patches()):
            code, text = run(["create-campaign", "--paused"], ENV, stdin=cfg.campaign["name"])
            self.assertEqual(code, 0, text)
            self.assertEqual(fake.mutates, [True, False], "validated first, then created once")
            self.assertIn("Campaign status now: PAUSED", text)
            code, text = run(["create-campaign", "--paused"], ENV, stdin=cfg.campaign["name"])
        self.assertEqual(code, 0, text)
        self.assertIn("Nothing to create", text)
        self.assertEqual(fake.mutates, [True, False], "rerun sent nothing")

    def test_additions_to_a_live_campaign_need_their_own_confirmation(self):
        cfg = config.load()
        live = full_existing(cfg)
        live.campaign_status = "ENABLED"
        live.keywords.discard(("Mobile Detailing", "mobile car detailing", "PHRASE"))
        fake = FakeGoogle(cfg, live)
        with contextlib_all(fake.patches()):
            # The usual word for a paused campaign isn't enough once it is serving.
            code, text = run(["create-campaign", "--paused"], ENV, stdin="add")
            self.assertEqual(code, 1, text)
            self.assertIn("campaign is live", text)
            self.assertEqual(fake.mutates, [True], "validated only; nothing created")
            code, text = run(["create-campaign", "--paused"], ENV, stdin="add live")
        self.assertEqual(code, 0, text)
        self.assertEqual(fake.mutates, [True, True, False])

    def test_writes_only_go_to_the_account_in_env(self):
        fake = FakeGoogle(config.load())
        with contextlib_all(fake.patches()):
            code, text = run(["--customer-id", "999-999-9999", "create-campaign", "--paused", "--yes"], ENV)
            self.assertEqual(code, 2, text)
            self.assertIn("only runs against GOOGLE_ADS_CUSTOMER_ID", text)
            self.assertNotIn(False, fake.mutates, "nothing was created in the other account")
            # Read-only and validate-only commands may still look at another account.
            code, text = run(["--customer-id", "999-999-9999", "create-campaign", "--dry-run"], ENV)
        self.assertEqual(code, 0, text)

    def test_error_text_hides_values_loaded_from_env(self):
        secret = "tok-unlabelled-value-123"
        with mock.patch.object(g, "load_client", side_effect=RuntimeError(f"request failed for {secret}")):
            code, text = run(["auth-check"], {**ENV, "GOOGLE_ADS_DEVELOPER_TOKEN": secret})
        self.assertEqual(code, 1, text)
        self.assertNotIn(secret, text)

    def test_declined_confirmation_creates_nothing(self):
        fake = FakeGoogle(config.load())
        with contextlib_all(fake.patches()):
            code, text = run(["create-campaign", "--paused"], ENV, stdin="no")
        self.assertEqual(code, 1)
        self.assertEqual(fake.mutates, [True])
        self.assertIn("Nothing was created", text)

    def test_wrong_time_zone_blocks_create(self):
        fake = FakeGoogle(config.load())
        patches = fake.patches()
        patches[1] = mock.patch.object(g, "account_info", lambda c, cid: {"id": cid, "name": "", "currency": "USD", "time_zone": "America/Los_Angeles",
                                                                          "test_account": False, "manager": False, "auto_tagging": True})
        with contextlib_all(patches):
            code, text = run(["create-campaign", "--paused"], ENV)
        self.assertEqual(code, 2)
        self.assertEqual(fake.mutates, [])

    def test_missing_credentials_named_not_shown(self):
        code, text = run(["auth-check"], {"GOOGLE_ADS_CLIENT_ID": "visible-value-123"})
        self.assertEqual(code, 2)
        self.assertIn("GOOGLE_ADS_DEVELOPER_TOKEN", text)
        self.assertNotIn("visible-value-123", text)


class contextlib_all:
    def __init__(self, cms):
        self.cms = cms

    def __enter__(self):
        for c in self.cms:
            c.__enter__()

    def __exit__(self, *exc):
        for c in reversed(self.cms):
            c.__exit__(*exc)


if __name__ == "__main__":
    unittest.main()
