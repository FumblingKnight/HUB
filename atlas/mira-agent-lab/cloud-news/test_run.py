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
    def test_discussion_url_must_come_from_community_allowlist(self):
        raw={"topic_id":"x","title":"X","url":"https://news.example/x","discussion_url":"https://www.reddit.com/r/anime/comments/abc/x/"}
        got=m.validate_story(raw,{raw["url"]},known_discussion_urls=set())
        self.assertEqual(got["discussion_url"],"")
        got=m.validate_story(raw,{raw["url"]},known_discussion_urls={raw["discussion_url"]})
        self.assertEqual(got["discussion_url"],raw["discussion_url"])
    def test_community_sources_are_separate_and_bounded(self):
        reg=json.loads((HERE/"source_registry.json").read_text())
        self.assertGreaterEqual(len(reg.get("community_sources",[])),3)
        self.assertEqual(len(m.select_community_sources(reg,"hourly")),1)
        self.assertLessEqual(len(m.select_community_sources(reg,"morning")),2)
        for src in reg["community_sources"]:
            self.assertTrue(src.get("community"))
            self.assertEqual(src["allowed_domains"],["reddit.com"])
    def test_research_pack_compaction_preserves_all_sections_as_valid_json(self):
        huge="x"*4000
        state={"stories":{str(i):{"id":str(i),"title":huge,"last_seen":"2026-10-29T00:00:00+00:00","last_summary":huge} for i in range(60)}}
        buf=[{"url":f"https://news.example/{i}","title":huge,"excerpt":huge,"category":"X","publisher":"P"} for i in range(50)]
        evidence=[{"url":f"https://news.example/{i}","title":huge,"description":huge,"body_intro":huge} for i in range(20)]
        community=[{"url":"https://www.reddit.com/r/anime/comments/x/y/","title":huge,"publisher":"Reddit"}]
        raw=m.research_pack_json("morning",{},state,buf,evidence,[],{"watch":[{"topic":"T","reason":"R"}]},community)
        pack=json.loads(raw)
        self.assertIn("community_leads",pack);self.assertIn("source_health",pack);self.assertIn("previous_watch",pack)
        self.assertLess(len(raw),90000)
    def test_candidate_memory_preserves_first_seen_and_counts_sightings(self):
        stamp=m.iso(m.now())
        old=[{"url":"https://news.example/a","title":"Old","first_observed_at":"2026-10-29T00:00:00+00:00","last_observed_at":stamp,"sightings":2}]
        fresh=[{"url":"https://news.example/a","title":"Fresh metadata"}]
        got=m.merge_candidate_buffer(old,fresh,stamp)
        self.assertEqual(got[0]["first_observed_at"],"2026-10-29T00:00:00+00:00")
        self.assertEqual(got[0]["sightings"],3)
        self.assertEqual(got[0]["title"],"Fresh metadata")
    def test_known_hourly_story_requires_material_change(self):
        story={"id":"known","new_information":"","title":"Old"}
        self.assertFalse(m.accept_hourly_story(story,{"known"}))
        story["new_information"]="A genuinely new fact"
        self.assertTrue(m.accept_hourly_story(story,{"known"}))
        self.assertTrue(m.accept_hourly_story({"id":"new","new_information":""},{"known"}))
    def test_morning_rejects_non_candidate_lead(self):
        data={"lead":{"topic_id":"x","title":"X","url":"https://invented.example/x"},"sections":[]}
        with self.assertRaises(RuntimeError):m.validate_morning(data,{"https://allowed.example/x"})
    def test_registry_is_https_and_domains_are_bounded(self):
        reg=json.loads((HERE/"source_registry.json").read_text())
        self.assertIs(m.validate_registry(reg),reg)
        self.assertGreaterEqual(len(reg["sources"]),10)
        for src in reg["sources"]:
            self.assertTrue(src["url"].startswith("https://"))
            self.assertTrue(src["allowed_domains"])
            self.assertNotIn("*",src["allowed_domains"])
        with self.assertRaises(ValueError):
            m.validate_registry({"sources":[{"name":"Bad","url":"http://example.com/feed","category":"X","lane":"core","allowed_domains":["example.com"]}]})
        with self.assertRaises(ValueError):
            m.validate_registry({"sources":[{"name":"Bad","url":"https://example.com/feed","category":"X","lane":"oops","allowed_domains":["*"]}]})
    def test_recent_exposure_tracks_lane_category_and_source(self):
        dt=__import__("datetime")
        recent=m.iso(m.now()-dt.timedelta(hours=2));old=m.iso(m.now()-dt.timedelta(hours=80))
        state={"runs":[{"at":recent,"selected_meta":[{"lane":"core","category":"F1","source_host":"a.example"},{"lane":"wildcard","category":"Science","source_host":"b.example"}]},{"at":old,"selected_meta":[{"lane":"core","category":"F1","source_host":"a.example"}]}]}
        x=m.recent_exposure(state)
        self.assertEqual(x["total_selected"],2);self.assertEqual(x["lane_counts"]["core"],1);self.assertEqual(x["lane_counts"]["wildcard"],1)
        self.assertEqual(x["category_counts"]["F1"],1);self.assertEqual(x["source_counts"]["a.example"],1)
    def test_novelty_gate_skips_stale_hourly_work(self):
        dt=__import__("datetime")
        self.assertEqual(m.should_wake_model("hourly",0,0,False,m.iso(m.now()-dt.timedelta(minutes=20))),(False,"no_new_inputs"))
        self.assertEqual(m.should_wake_model("hourly",1,0,False,m.iso(m.now())),(True,"new_publisher_items"))
        self.assertEqual(m.should_wake_model("hourly",0,0,True,m.iso(m.now())),(True,"feedback_changed"))
        self.assertEqual(m.should_wake_model("hourly",0,2,False,m.iso(m.now()-dt.timedelta(hours=4))),(True,"community_due"))
        self.assertEqual(m.should_wake_model("hourly",0,2,False,m.iso(m.now()-dt.timedelta(hours=1))),(False,"no_new_inputs"))
        self.assertEqual(m.should_wake_model("morning",0,0,False,m.iso(m.now())),(True,"morning"))
    def test_schedule_stats_are_future_ist_timestamps(self):
        h,morning=m.schedule_stats()
        self.assertIn("+05:30",h);self.assertIn("+05:30",morning)
        self.assertGreater(m.parse_dt(h),m.now())
        self.assertGreater(m.parse_dt(morning),m.now())
        self.assertEqual(__import__("datetime").datetime.fromisoformat(h).minute,17)
        md=__import__("datetime").datetime.fromisoformat(morning)
        self.assertEqual((md.hour,md.minute),(8,30))

if __name__=="__main__":unittest.main()
