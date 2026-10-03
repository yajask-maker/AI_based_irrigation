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


def tree_layout(model):
    tree = model.tree_
    positions = {}
    leaf_number = 0

    def place(node, depth):
        nonlocal leaf_number
        left = tree.children_left[node]
        right = tree.children_right[node]
        if left == right:
            x = 130 + leaf_number * 220
            leaf_number += 1
            first_x = x
            last_x = x
        else:
            first_x, _ = place(left, depth + 1)
            _, last_x = place(right, depth + 1)
            x = (first_x + last_x) / 2
        positions[node] = (x, 90 + depth * 145)
        return first_x, last_x

    place(0, 0)
    return positions, 260 + (leaf_number - 1) * 220, 190 + model.get_depth() * 145


class DecisionTreeView:
    def __init__(self, root, advisor, conditions, recommendation):
        self.window = tk.Toplevel(root)
        self.window.title("How the decision tree made its recommendation")
        width = min(1100, root.winfo_screenwidth() - 80)
        height = min(700, root.winfo_screenheight() - 100)
        self.window.geometry(f"{width}x{height}")

        top = ttk.Frame(self.window, padding=14)
        top.pack(fill="x")
        ttk.Label(
            top,
            text=f"{conditions.plot}: {recommendation.urgency.upper()}",
            style="Result.TLabel",
        ).pack(anchor="w")
        ttk.Label(
            top,
            text="Gold boxes and lines show the route taken by these inputs. Scroll to see the full tree.",
        ).pack(anchor="w", pady=(4, 0))

        holder = ttk.Frame(self.window)
        holder.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        canvas = tk.Canvas(holder, bg="#f7fafc", highlightthickness=0)
        x_scroll = ttk.Scrollbar(holder, orient="horizontal", command=canvas.xview)
        y_scroll = ttk.Scrollbar(holder, orient="vertical", command=canvas.yview)
        canvas.configure(xscrollcommand=x_scroll.set, yscrollcommand=y_scroll.set)
        holder.grid_columnconfigure(0, weight=1)
        holder.grid_rowconfigure(0, weight=1)
        canvas.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        x_scroll.grid(row=1, column=0, sticky="ew")

        model = advisor.model
        tree = model.tree_
        positions, diagram_width, diagram_height = tree_layout(model)
        canvas.configure(scrollregion=(0, 0, diagram_width, diagram_height))
        values = [conditions.moisture, conditions.temperature, conditions.rain]
        path = set(model.decision_path([values]).indices)

        for node, (x, y) in positions.items():
            for child, answer in [
                (tree.children_left[node], "Yes"),
                (tree.children_right[node], "No"),
            ]:
                if child < 0:
                    continue
                child_x, child_y = positions[child]
                active = node in path and child in path
                color = "#d89000" if active else "#94a3b8"
                canvas.create_line(
                    x, y + 34, child_x, child_y - 34,
                    fill=color, width=3 if active else 2, arrow=tk.LAST,
                )
                label_x = x + (child_x - x) * 0.28
                label_y = y + (child_y - y) * 0.28
                canvas.create_text(
                    label_x, label_y, text=answer, fill="#805300" if active else "#475569",
                    font=("Segoe UI", 9, "bold"),
                )

        for node, (x, y) in positions.items():
            is_leaf = tree.children_left[node] < 0
            selected = node in path
            border = "#d89000" if selected else "#64748b"
            if is_leaf:
                class_index = tree.value[node][0].argmax()
                label = model.classes_[class_index]
                fill = {"Now": "#fde8e7", "Soon": "#fff1c7", "Wait": "#dcf4e5"}[label]
                title = label.upper()
                detail = f"{tree.n_node_samples[node]} examples"
            else:
                feature = tree.feature[node]
                unit = ["%", " °C", " mm"][feature]
                fill = "#e6f0ff"
                title = FEATURES[feature]
                detail = f"≤ {tree.threshold[node]:g}{unit} ?"

            canvas.create_rectangle(
                x - 82, y - 34, x + 82, y + 34,
                fill=fill, outline=border, width=4 if selected else 2,
            )
            canvas.create_text(x, y - 10, text=title, font=("Segoe UI", 10, "bold"), fill="#183153")
            canvas.create_text(x, y + 14, text=detail, font=("Segoe UI", 9), fill="#334155")

        canvas.xview_moveto(0)
        canvas.yview_moveto(0)


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

        actions = ttk.Frame(panel)
        actions.pack(anchor="w", pady=(4, 15))
        ttk.Button(actions, text="Generate recommendation", command=self.generate).pack(side="left")
        ttk.Button(actions, text="View decision tree", command=self.show_tree).pack(
            side="left", padx=(10, 0)
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

    def read_conditions(self):
        return PlotConditions(
            self.plot.get(),
            float(self.moisture.get()),
            float(self.temperature.get()),
            float(self.rain.get()),
            self.stage.get(),
        )

    def generate(self):
        try:
            conditions = self.read_conditions()
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

    def show_tree(self):
        try:
            conditions = self.read_conditions()
            recommendation = self.advisor.recommend(conditions)
        except ValueError as error:
            messagebox.showerror("Invalid input", str(error))
            return
        DecisionTreeView(self.root, self.advisor, conditions, recommendation)


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
