import unittest
from datetime import date

from app import IrrigationAdvisor, PlotConditions


class IrrigationAdvisorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.advisor = IrrigationAdvisor()
        cls.day = date(2026, 10, 3)

    def test_dry_soil_recommends_irrigation_today(self):
        conditions = PlotConditions("Plot A", 25, 34, 0, "Mid")
        result = self.advisor.recommend(conditions, self.day)
        self.assertEqual(result.urgency, "Now")
        self.assertEqual(result.irrigation_date, self.day)
        self.assertEqual(result.duration_minutes, 40)
        self.assertTrue(result.reason)

    def test_moderate_soil_recommends_tomorrow(self):
        conditions = PlotConditions("Plot B", 50, 28, 4, "Early")
        result = self.advisor.recommend(conditions, self.day)
        self.assertEqual(result.urgency, "Soon")
        self.assertEqual(result.irrigation_date, date(2026, 10, 4))
        self.assertEqual(result.duration_minutes, 15)

    def test_forecast_rain_prevents_irrigation(self):
        conditions = PlotConditions("Plot C", 30, 32, 12, "Mid")
        result = self.advisor.recommend(conditions, self.day)
        self.assertEqual(result.urgency, "Wait")
        self.assertIsNone(result.irrigation_date)
        self.assertEqual(result.duration_minutes, 0)
        self.assertEqual(result.review_date, date(2026, 10, 5))

    def test_invalid_moisture_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Soil moisture"):
            PlotConditions("Plot A", 120, 30, 0, "Mid")

    def test_invalid_stage_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "growth stage"):
            PlotConditions("Plot A", 40, 30, 0, "Unknown")


if __name__ == "__main__":
    unittest.main()
