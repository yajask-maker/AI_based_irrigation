import csv
import sys
import tkinter as tk
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from tkinter import messagebox, ttk

from sklearn.tree import DecisionTreeClassifier


DATA_FILE = Path(__file__).with_name("training_examples.csv")
FEATURES = ["Soil moisture", "Temperature", "Forecast rain"]
STAGES = ["Early", "Mid", "Late"]
DURATIONS = {
    "Now": {"Early": 20, "Mid": 40, "Late": 25},
    "Soon": {"Early": 15, "Mid": 25, "Late": 15},
}


@dataclass
class PlotConditions:
    plot: str
    moisture: float
    temperature: float
    rain: float
    stage: str

    def __post_init__(self):
        if not self.plot.strip():
            raise ValueError("Select a plot.")
        if not 0 <= self.moisture <= 100:
            raise ValueError("Soil moisture must be between 0 and 100%.")
        if not 0 <= self.temperature <= 55:
            raise ValueError("Temperature must be between 0 and 55 °C.")
        if not 0 <= self.rain <= 100:
            raise ValueError("Forecast rain must be between 0 and 100 mm.")
        if self.stage not in STAGES:
            raise ValueError("Select a crop growth stage.")


@dataclass
class Recommendation:
    urgency: str
    irrigation_date: date | None
    duration_minutes: int
    review_date: date | None
    reason: str


class IrrigationAdvisor:
    def __init__(self, data_file=DATA_FILE):
        inputs = []
        labels = []

        with open(data_file, newline="", encoding="utf-8") as file:
            for row in csv.DictReader(file):
                inputs.append([
                    float(row["moisture"]),
                    float(row["temperature"]),
                    float(row["rain"]),
                ])
                labels.append(row["urgency"])

        if set(labels) != {"Now", "Soon", "Wait"}:
            raise ValueError("Training examples must include Now, Soon and Wait.")

        self.model = DecisionTreeClassifier(max_depth=6, random_state=42)
        self.model.fit(inputs, labels)
        self.example_count = len(labels)

    def recommend(self, conditions, on_date=None):
        day = on_date if on_date is not None else date.today()
        values = [conditions.moisture, conditions.temperature, conditions.rain]
        urgency = self.model.predict([values])[0]
        reason = self.explain(values)

        if urgency == "Wait":
            return Recommendation(urgency, None, 0, day + timedelta(days=2), reason)

        irrigation_date = day if urgency == "Now" else day + timedelta(days=1)
        duration = DURATIONS[urgency][conditions.stage]
        return Recommendation(urgency, irrigation_date, duration, None, reason)

    def explain(self, values):
        tree = self.model.tree_
        steps = []
        path = self.model.decision_path([values]).indices

        for node in path:
            feature_number = tree.feature[node]
            if feature_number < 0:
                continue
            threshold = tree.threshold[node]
            sign = "≤" if values[feature_number] <= threshold else ">"
            unit = ["%", " °C", " mm"][feature_number]
            steps.append(f"{FEATURES[feature_number]} {sign} {threshold:g}{unit}")

        return "; ".join(steps)


class IrrigationApp:
    def __init__(self, root):
        self.root = root
        self.advisor = IrrigationAdvisor()
        root.title("Sugarcane Irrigation Advisor - CA Prototype")
        root.geometry("800x680")
        root.minsize(700, 610)

        style = ttk.Style()
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure("Heading.TLabel", font=("Segoe UI", 18, "bold"))
        style.configure("Sub.TLabel", font=("Segoe UI", 10), foreground="#4b5563")
        style.configure("Result.TLabel", font=("Segoe UI", 12, "bold"))
        style.configure("TButton", padding=7)

        panel = ttk.Frame(root, padding=22)
        panel.pack(fill="both", expand=True)
        ttk.Label(panel, text="Sugarcane Irrigation Advisor", style="Heading.TLabel").pack(anchor="w")
        ttk.Label(
            panel,
            text="Classroom prototype using simulated conditions and an illustrative decision tree.",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(4, 18))

        form = ttk.LabelFrame(panel, text="Plot conditions", padding=14)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)

        self.plot = tk.StringVar(value="Plot A")
        self.moisture = tk.StringVar(value="25")
        self.temperature = tk.StringVar(value="34")
        self.rain = tk.StringVar(value="0")
        self.stage = tk.StringVar(value="Mid")

        fields = [
            ("Plot", self.plot, ["Plot A", "Plot B", "Plot C"]),
            ("Soil moisture (%)", self.moisture, None),
            ("Temperature (°C)", self.temperature, None),
            ("Forecast rain, next 24 hours (mm)", self.rain, None),
            ("Crop growth stage", self.stage, STAGES),
        ]
        for index, (label, variable, choices) in enumerate(fields):
            ttk.Label(form, text=label).grid(row=index, column=0, sticky="w", padx=(0, 18), pady=7)
            if choices:
                control = ttk.Combobox(form, textvariable=variable, values=choices, state="readonly")
            else:
                control = ttk.Entry(form, textvariable=variable)
            control.grid(row=index, column=1, sticky="ew", pady=7)

        scenarios = ttk.Frame(panel)
        scenarios.pack(fill="x", pady=(14, 8))
        ttk.Label(scenarios, text="Try a sample:").pack(side="left", padx=(0, 10))
        for label, values in [
            ("Dry soil", ("Plot A", "25", "34", "0", "Mid")),
            ("Moderate soil", ("Plot B", "50", "28", "4", "Early")),
            ("Rain expected", ("Plot C", "30", "32", "12", "Mid")),
        ]:
            ttk.Button(scenarios, text=label, command=lambda v=values: self.load_sample(v)).pack(
                side="left", padx=3
            )

        ttk.Button(panel, text="Generate recommendation", command=self.generate).pack(
            anchor="w", pady=(4, 15)
        )

        result = ttk.LabelFrame(panel, text="Recommendation", padding=14)
        result.pack(fill="both", expand=True)
        self.result_text = tk.StringVar(value="Enter conditions and click Generate recommendation.")
        ttk.Label(
            result, textvariable=self.result_text, style="Result.TLabel", wraplength=700, justify="left"
        ).pack(anchor="w")

        ttk.Label(
            panel,
            text="Demo only: sample labels and durations are assumptions, not field-validated advice.",
            style="Sub.TLabel",
            wraplength=740,
        ).pack(anchor="w", pady=(12, 0))

    def load_sample(self, values):
        for variable, value in zip(
            [self.plot, self.moisture, self.temperature, self.rain, self.stage], values
        ):
            variable.set(value)
        self.result_text.set("Sample loaded. Click Generate recommendation.")

    def generate(self):
        try:
            conditions = PlotConditions(
                self.plot.get(),
                float(self.moisture.get()),
                float(self.temperature.get()),
                float(self.rain.get()),
                self.stage.get(),
            )
            recommendation = self.advisor.recommend(conditions)
        except ValueError as error:
            messagebox.showerror("Invalid input", str(error))
            return

        if recommendation.urgency == "Wait":
            timing = (
                f"No irrigation scheduled. Duration: 0 minutes.\n"
                f"Review conditions on {recommendation.review_date:%d %b %Y}."
            )
        else:
            timing = (
                f"Suggested date: {recommendation.irrigation_date:%d %b %Y}.\n"
                f"Illustrative duration: {recommendation.duration_minutes} minutes."
            )

        self.result_text.set(
            f"{conditions.plot}: {recommendation.urgency.upper()}\n"
            f"{timing}\n\nDecision tree path: {recommendation.reason}"
        )


def print_demo():
    advisor = IrrigationAdvisor()
    scenarios = [
        PlotConditions("Dry soil", 25, 34, 0, "Mid"),
        PlotConditions("Moderate soil", 50, 28, 4, "Early"),
        PlotConditions("Rain expected", 30, 32, 12, "Mid"),
    ]
    print(f"Model trained on {advisor.example_count} illustrative examples.")
    for conditions in scenarios:
        result = advisor.recommend(conditions)
        date_text = result.irrigation_date.isoformat() if result.irrigation_date else "None"
        review_text = result.review_date.isoformat() if result.review_date else "None"
        print(
            f"{conditions.plot}: {result.urgency}, irrigation date={date_text}, "
            f"duration={result.duration_minutes} min, review date={review_text}"
        )
        print(f"  Path: {result.reason}")


if __name__ == "__main__":
    if "--demo" in sys.argv:
        print_demo()
    else:
        window = tk.Tk()
        IrrigationApp(window)
        window.mainloop()
