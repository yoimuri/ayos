"""
Tests for import_shops.py. Standard library only, nothing to install.

RUN:  python -m unittest scripts/test_import_shops.py -v

Each test is one of the import rules, written as an example a person can read.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from import_shops import (  # noqa: E402
    build,
    collapse,
    compare_with_app,
    city_from_address,
    clean_text,
    format_phone,
    parse_closed,
    parse_links,
    parse_phones,
    parse_tags,
    parse_time,
    plan_survey,
    same_value,
    similar_names,
)


def row(n, **cells):
    base = {"_row": n, "name": "Shop %d" % n, "lat": 14.6, "lng": 121.0}
    base.update(cells)
    return base


class CleanText(unittest.TestCase):
    def test_line_breaks_and_spaces_collapse(self):
        self.assertEqual(clean_text("  MRCE Motorshop\n"), "MRCE Motorshop")
        self.assertEqual(clean_text("0917 1646472, \n0916 492 8909 "), "0917 1646472, 0916 492 8909")

    def test_the_word_none_is_not_a_value(self):
        for empty in ("None", "none", " N/A ", "-", "", None):
            self.assertIsNone(clean_text(empty), repr(empty))

    def test_excel_float_becomes_digits(self):
        self.assertEqual(clean_text(639281489926.0), "639281489926")


class Tags(unittest.TestCase):
    def test_blank_tags_are_dropped(self):
        self.assertEqual(parse_tags("Parts,,Repair,"), (["parts", "repair"], []))

    def test_only_the_four_are_allowed(self):
        self.assertEqual(parse_tags("Dealer, Paint"), (["dealer"], ["Paint"]))

    def test_empty_cell_gives_no_tags(self):
        self.assertEqual(parse_tags(None), ([], []))


class Phones(unittest.TestCase):
    def test_mobile_formats(self):
        for typed in ("0915 9777778", "09159777778", "+63 915 977 7778", "9159777778"):
            self.assertEqual(format_phone(typed), "0915-977-7778", typed)

    def test_landline_with_extension_keeps_main_line(self):
        self.assertEqual(format_phone("85376900 loc. 1420"), "(02) 8537-6900")
        self.assertEqual(format_phone("02 70075396"), "(02) 7007-5396")

    def test_landline_missing_its_leading_zero(self):
        self.assertEqual(format_phone("270018150"), "(02) 7001-8150")

    def test_old_seven_digit_landline_is_not_guessed(self):
        # Since 6 Oct 2019 a carrier digit goes in front, and we cannot know which.
        self.assertIsNone(format_phone("(02) 420-7195"))

    def test_several_numbers_keep_their_order(self):
        good, bad = parse_phones("0945 3868182, 0920 754 8552")
        self.assertEqual(good, ["0945-386-8182", "0920-754-8552"])
        self.assertEqual(bad, [])

    def test_the_excel_float_is_recovered(self):
        self.assertEqual(parse_phones(639281489926.0), (["0928-148-9926"], []))

    def test_too_short_is_reported_not_guessed(self):
        self.assertEqual(parse_phones("0919 740 283"), ([], ["0919 740 283"]))

    def test_none_text_is_no_phone(self):
        self.assertEqual(parse_phones("None"), ([], []))


class Links(unittest.TestCase):
    def test_trailing_commas_and_non_links(self):
        self.assertEqual(
            parse_links("https://www.facebook.com/chicascongre/, see page"),
            ["https://www.facebook.com/chicascongre/"],
        )
        self.assertEqual(parse_links("None"), [])


class Hours(unittest.TestCase):
    def test_time_range(self):
        self.assertEqual(parse_time("9:00 - 20:00"), ("09:00", "20:00"))
        self.assertEqual(parse_time("0:00 - 24:00"), ("00:00", "24:00"))
        self.assertIsNone(parse_time("None"))

    def test_day_closed_words(self):
        self.assertEqual(parse_closed("Everyday Open"), [])
        self.assertEqual(parse_closed("Sunday"), [0])
        self.assertEqual(parse_closed("Saturday and Sunday"), [0, 6])
        self.assertEqual(parse_closed("Weekdays"), [1, 2, 3, 4, 5])
        self.assertEqual(parse_closed("Only open on Sunday"), [1, 2, 3, 4, 5, 6])

    def test_unreadable_day_is_unknown_not_open(self):
        self.assertIsNone(parse_closed("sometimes"))
        self.assertIsNone(parse_closed("None"))


class Duplicates(unittest.TestCase):
    def test_generic_words_do_not_make_a_duplicate(self):
        self.assertFalse(similar_names(
            "Pega Motorcycle Parts and Accessories",
            "Marklhyne Motorcycle Parts and Accessories Shop",
        ))

    def test_same_distinctive_name_is_similar(self):
        self.assertTrue(similar_names(
            "Berting Cycle Parts",
            "Kawasaki Authorized Service Center - Berting Cycle Parts",
        ))

    def test_duplicates_are_flagged_and_both_kept(self):
        rows = [
            row(2, name="Lexie motorshop and accessories", lat=14.60000, lng=121.00000),
            row(3, name="Lexie motorshop and accessories", lat=14.60001, lng=121.00001),
        ]
        shops, facts = build(rows)
        self.assertEqual(len(shops), 2, "nothing is merged")
        self.assertEqual(len(facts["duplicates"]), 1)
        self.assertNotEqual(shops[0]["id"], shops[1]["id"], "same name and spot still get two ids")

    def test_far_apart_same_name_is_a_branch(self):
        rows = [row(2, name="Motozae", lat=14.60), row(3, name="Motozae", lat=14.61)]
        _, facts = build(rows)
        self.assertEqual(facts["duplicates"], [])


class City(unittest.TestCase):
    def test_city_from_the_address(self):
        self.assertEqual(city_from_address("M3C8+PM Quezon City, Metro Manila"), ("quezon-city", "one"))
        self.assertEqual(city_from_address("Purok 4, Las Pinas City"), ("las-pinas", "one"))

    def test_metro_manila_is_not_the_city_of_manila(self):
        self.assertEqual(city_from_address("Pasig, Metro Manila"), ("pasig", "one"))
        self.assertEqual(city_from_address("Sampaloc, Manila, Metro Manila"), ("manila", "one"))

    def test_several_cities_take_the_last(self):
        # The city comes last in a Philippine address.
        self.assertEqual(city_from_address("Paranaque - Sucat Rd, Muntinlupa"), ("muntinlupa", "several"))

    def test_manila_and_san_juan_as_street_names(self):
        self.assertEqual(city_from_address("157 Manila S Rd, Muntinlupa, Metro Manila"), ("muntinlupa", "one"))
        self.assertEqual(city_from_address("28 San Juan Evangelista St, Quezon City"), ("quezon-city", "one"))
        self.assertEqual(
            city_from_address("Cubao, Quezon City, 1109 Metropolitan Manila Second District"),
            ("quezon-city", "one"),
        )

    def test_no_city_is_filed_by_nearest_and_listed(self):
        shops, facts = build([
            row(2, address="Pasig City", lat=14.57, lng=121.08),
            row(3, address="Somewhere St", lat=14.571, lng=121.081),
        ])
        self.assertEqual(shops[1]["city"], "pasig")
        self.assertEqual(len(facts["city_unclear"]), 1)


class CompareWithApp(unittest.TestCase):
    def test_removing_one_copy_of_a_duplicate_reports_one_shop_gone(self):
        import json, os, tempfile
        shop = {"name": "KRD", "lat": 14.7615, "lng": 121.0641}
        other = {"name": "Raki", "lat": 14.6996, "lng": 121.0479}
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "shops.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"shops": [shop, dict(shop), other]}, fh)
            diff = compare_with_app([dict(shop)], path)
        self.assertEqual(len(diff["gone"]), 2, "one KRD copy and Raki, not both KRD copies")
        self.assertEqual(sorted(n for n, _, _ in diff["gone"]), ["KRD", "Raki"])


class Rows(unittest.TestCase):
    def test_no_coordinates_is_skipped_and_listed(self):
        shops, facts = build([row(2), row(7, lat=None, lng=None)])
        self.assertEqual(len(shops), 1)
        self.assertEqual(facts["skipped"][0][:2], (7, "no coordinates"))

    def test_missing_values_are_absent_not_the_word_none(self):
        shops, _ = build([row(2, phone="None", time="None", closed="None", social="None", address="None")])
        for field in ("phones", "hours", "links", "address"):
            self.assertNotIn(field, shops[0])

    def test_email_and_image_are_never_imported(self):
        shops, facts = build([row(2, email="owner@gmail.com", image="x.jpg")])
        self.assertNotIn("email", shops[0])
        self.assertNotIn("image", shops[0])
        self.assertEqual(facts["counts"]["email present, not imported"], 1)

    def test_hours_are_shaped(self):
        shops, _ = build([row(2, time="9:00 - 20:00", closed="Sunday")])
        self.assertEqual(shops[0]["hours"], {"open": "09:00", "close": "20:00", "closed": [0]})

    def test_id_survives_rows_being_reordered(self):
        a, _ = build([row(2, name="A"), row(3, name="B", lat=14.7)])
        b, _ = build([row(2, name="B", lat=14.7), row(3, name="A")])
        self.assertEqual({s["name"]: s["id"] for s in a}, {s["name"]: s["id"] for s in b})


def change(shop_id, column, field, before, after, date="2026-10-12 09:00", shop="Shop 2"):
    return {"date": date, "shop_id": shop_id, "shop": shop, "column": column, "field": field,
            "before": before, "after": after}


class SurveyMerge(unittest.TestCase):
    """--survey: the surveyor's edits go in only while the sheet still says what they saw."""

    def setUp(self):
        self.rows = [row(2, phone="None", time="9:00 - 20:00", email="None"), row(3, name="Other", lat=14.61)]
        self.sid = build(self.rows)[0][0]["id"]

    def plan(self, changes=(), added=()):
        return plan_survey(self.rows, [("survey.xlsx", list(changes), list(added))])

    def test_applies_when_the_sheet_still_says_what_the_surveyor_saw(self):
        writes, _, facts, merged = self.plan([change(self.sid, "Contact No.", "phone", "", "0917 123 4567")])
        self.assertEqual(writes[0][:3], (2, "phone", "0917 123 4567"))
        self.assertEqual(len(facts["applied"]), 1)
        self.assertEqual(merged[0]["phone"], "0917 123 4567")

    def test_the_same_number_written_differently_is_not_a_change(self):
        self.assertTrue(same_value("phone", "0915 9777778", "0915-977-7778"))
        self.assertTrue(same_value("services", "Repair, Parts", "parts,repair"))
        self.assertFalse(same_value("time", "9:00 - 20:00", "8:00 - 17:00"))

    def test_a_cell_changed_since_is_a_conflict_and_left_alone(self):
        writes, _, facts, _ = self.plan([change(self.sid, "Time", "time", "10:00 - 19:00", "8:00 - 17:00")])
        self.assertEqual(writes, [])
        self.assertEqual(facts["conflicts"][0][3:6], ("9:00 - 20:00", "10:00 - 19:00", "8:00 - 17:00"))

    def test_email_fills_an_empty_cell_but_never_overwrites_one(self):
        writes, _, _, _ = self.plan([change(self.sid, "Email", "email", "", "shop@example.com")])
        self.assertEqual(writes[0][2], "shop@example.com")
        self.rows[0]["email"] = "owner@example.com"
        writes, _, facts, _ = self.plan([change(self.sid, "Email", "email", "", "shop@example.com")])
        self.assertEqual((writes, len(facts["conflicts"])), ([], 1))

    def test_a_moved_pin_writes_both_coordinates(self):
        writes, _, _, _ = self.plan([change(self.sid, "Latitude, Longitude", "location",
                                            "14.6000000, 121.0000000", "14.6001000, 121.0002000")])
        self.assertEqual([(w[1], w[2]) for w in writes], [("lat", 14.6001), ("lng", 121.0002)])

    def test_unknown_shop_is_listed_and_a_unique_name_is_the_fallback(self):
        _, _, facts, _ = self.plan([change("sdeadbeef", "Time", "time", "", "8:00 - 17:00", shop="Nowhere")])
        self.assertEqual(len(facts["missing"]), 1)
        writes, _, facts, _ = self.plan([change("sdeadbeef", "Time", "time", "9:00 - 20:00", "8:00 - 17:00")])
        self.assertEqual((writes[0][0], len(facts["by_name"])), (2, 1))

    def test_new_shops_go_at_the_bottom_once(self):
        new = {"name": "New Moto", "lat": 14.65, "lng": 121.03, "phone": "0918 765 4321"}
        _, appends, facts, _ = self.plan(added=[new])
        self.assertEqual(appends[0][0], 4, "straight after the last row")
        self.rows.append(row(4, name="New Moto", lat=14.65, lng=121.03))
        _, appends, facts, _ = self.plan(added=[new])
        self.assertEqual((appends, len(facts["already_added"])), ([], 1), "merging the same file twice is harmless")

    def test_several_edits_to_one_cell_are_one_change(self):
        merged = collapse([change("s1", "Time", "time", "a", "b", "2026-10-12 09:00"),
                           change("s1", "Time", "time", "b", "c", "2026-10-12 10:00")])
        self.assertEqual([(c["before"], c["after"]) for c in merged], [("a", "c")])


if __name__ == "__main__":
    unittest.main()
