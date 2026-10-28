import importlib.util, json, os, tempfile, unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("mira_cloud_news",HERE/"run.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class NewsSafetyTests(unittest.TestCase):
    def test_canonical_url_strips_tracking_and_fragment(self):
        a="https://Example.com/a/?utm_source=x&b=2&a=1#frag"
        b="https://example.com/a?a=1&b=2"
        self.assertEqual(m.canonical_url(a),m.canonical_url(b))
    def test_safe_https_rejects_local_and_non_https(self):
        self.assertFalse(m.safe_https("http://example.com/a"))
        self.assertFalse(m.safe_https("https://localhost/a"))
        self.assertFalse(m.safe_https("https://127.0.0.1/a"))
        self.assertTrue(m.safe_https("https://example.com/a"))
    def test_model_cannot_invent_primary_url(self):
        bad={"topic_id":"x","title":"X","url":"https://invented.example/x"}
        self.assertIsNone(m.validate_story(bad,{"https://allowed.example/x"}))
    def test_same_canonical_url_reuses_existing_story_id(self):
        raw={"topic_id":"new-slug","title":"Same story","url":"https://news.example/a?utm_source=rss","importance":4}
        existing={m.canonical_url("https://news.example/a"):"old-stable-id"}
        got=m.validate_story(raw,{raw["url"]},existing)
        self.assertEqual(got["id"],"old-stable-id")
    def test_urgent_requires_two_different_candidate_publishers(self):
        raw={"topic_id":"x","title":"X","url":"https://a.example/x","status":"confirmed",
             "alert_priority":"urgent","secondary_url":"https://a.example/y"}
        got=m.validate_story(raw,{raw["url"],raw["secondary_url"]})
        self.assertEqual(got["alert_priority"],"none")
        raw["secondary_url"]="https://b.example/y"
        got=m.validate_story(raw,{raw["url"],raw["secondary_url"]})
        self.assertEqual(got["alert_priority"],"urgent")
    def test_morning_rejects_non_candidate_lead(self):
        data={"lead":{"topic_id":"x","title":"X","url":"https://invented.example/x"},"sections":[]}
        with self.assertRaises(RuntimeError):m.validate_morning(data,{"https://allowed.example/x"})
    def test_registry_is_https_and_domains_are_bounded(self):
        reg=json.loads((HERE/"source_registry.json").read_text())
        self.assertGreaterEqual(len(reg["sources"]),10)
        for src in reg["sources"]:
            self.assertTrue(src["url"].startswith("https://"))
            self.assertTrue(src["allowed_domains"])
            self.assertNotIn("*",src["allowed_domains"])
    def test_schedule_stats_are_future_ist_timestamps(self):
        h,morning=m.schedule_stats()
        self.assertIn("+05:30",h);self.assertIn("+05:30",morning)
        self.assertGreater(m.parse_dt(h),m.now())
        self.assertGreater(m.parse_dt(morning),m.now())

if __name__=="__main__":unittest.main()
