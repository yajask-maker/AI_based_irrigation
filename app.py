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


SAMPLE_PLOTS = [
    PlotConditions("Plot A", 25, 34, 0, "Mid"),
    PlotConditions("Plot B", 50, 28, 4, "Early"),
    PlotConditions("Plot C", 25, 34, 12, "Mid"),
]


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


def alert_status(recommendation, on_date=None):
    day = on_date if on_date is not None else date.today()
    if recommendation.irrigation_date is None:
        return "No alert"
    days_until = (recommendation.irrigation_date - day).days
    if days_until < 0:
        return "Overdue"
    if days_until == 0:
        return "Due today"
    if days_until == 1:
        return "Due tomorrow"
    return "No alert"


def dashboard_status(advisor, plots, on_date=None):
    day = on_date if on_date is not None else date.today()
    rows = []
    for plot in plots:
        recommendation = advisor.recommend(plot, day)
        rows.append((plot, recommendation, alert_status(recommendation, day)))
    return rows


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
            text="Blue = question | Pink = now | Yellow = soon | Green = wait | Gold = this plot's path. Scroll to see the full tree.",
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
        self.plot_data = {plot.plot: plot for plot in SAMPLE_PLOTS}
        root.title("Sugarcane Irrigation Advisor - CA Prototype")
        root.geometry("900x710")
        root.minsize(800, 650)

        style = ttk.Style()
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure("Heading.TLabel", font=("Segoe UI", 18, "bold"))
        style.configure("Sub.TLabel", font=("Segoe UI", 10), foreground="#4b5563")
        style.configure("Result.TLabel", font=("Segoe UI", 12, "bold"))
        style.configure("TButton", padding=7)

        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill="both", expand=True)
        panel = ttk.Frame(self.notebook, padding=22)
        self.notebook.add(panel, text="Recommendation")
        dashboard = ttk.Frame(self.notebook, padding=22)
        self.notebook.add(dashboard, text="Plot dashboard")
        ttk.Label(panel, text="Sugarcane Irrigation Advisor", style="Heading.TLabel").pack(anchor="w")
        ttk.Label(
            panel,
            text="Classroom prototype using simulated conditions and an illustrative decision tree.",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(4, 18))

        form = ttk.LabelFrame(panel, text="Plot conditions", padding=14)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)

        self.plot = tk.StringVar(value=SAMPLE_PLOTS[0].plot)
        self.moisture = tk.StringVar(value=str(SAMPLE_PLOTS[0].moisture))
        self.temperature = tk.StringVar(value=str(SAMPLE_PLOTS[0].temperature))
        self.rain = tk.StringVar(value=str(SAMPLE_PLOTS[0].rain))
        self.stage = tk.StringVar(value=SAMPLE_PLOTS[0].stage)

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
            if label == "Plot":
                control.bind("<<ComboboxSelected>>", self.select_plot)

        scenarios = ttk.Frame(panel)
        scenarios.pack(fill="x", pady=(14, 8))
        ttk.Label(scenarios, text="Try a sample:").pack(side="left", padx=(0, 10))
        for label, plot in zip(["Dry soil", "Moderate soil", "Rain expected"], SAMPLE_PLOTS):
            ttk.Button(scenarios, text=label, command=lambda p=plot: self.load_plot(p)).pack(
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
            result, textvariable=self.result_text, style="Result.TLabel", wraplength=790, justify="left"
        ).pack(anchor="w")
        self.current_alert = tk.StringVar(value="Local app alert will appear here when irrigation is due.")
        ttk.Label(result, textvariable=self.current_alert, wraplength=790).pack(anchor="w", pady=(14, 0))

        ttk.Label(
            panel,
            text="Demo only: sample labels and durations are assumptions, not field-validated advice.",
            style="Sub.TLabel",
            wraplength=830,
        ).pack(anchor="w", pady=(12, 0))

        ttk.Label(dashboard, text="Plot dashboard", style="Heading.TLabel").pack(anchor="w")
        ttk.Label(
            dashboard,
            text="Simulated plot readings and recommendations. Results update after Generate recommendation.",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(4, 18))
        ttk.Label(
            dashboard,
            text=f"Decision tree trained on {self.advisor.example_count} illustrative scenarios | 3 outcomes",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(0, 14))

        cards = ttk.Frame(dashboard)
        cards.pack(fill="x", pady=(0, 18))
        self.counts = {name: tk.StringVar(value="0") for name in ["Now", "Soon", "Wait"]}
        for name, color in [("Now", "#fde8e7"), ("Soon", "#fff1c7"), ("Wait", "#dcf4e5")]:
            card = tk.Frame(cards, bg=color, padx=18, pady=12)
            card.pack(side="left", fill="x", expand=True, padx=(0, 10))
            tk.Label(card, textvariable=self.counts[name], bg=color, font=("Segoe UI", 20, "bold")).pack()
            tk.Label(card, text=name.upper(), bg=color, font=("Segoe UI", 9, "bold")).pack()

        self.dashboard_alert = tk.StringVar()
        alert_box = ttk.LabelFrame(dashboard, text="Local irrigation alerts", padding=12)
        alert_box.pack(fill="x")
        ttk.Label(alert_box, textvariable=self.dashboard_alert, wraplength=790, justify="left").pack(anchor="w")

        columns = ("plot", "moisture", "rain", "urgency", "date", "minutes", "alert")
        self.table = ttk.Treeview(dashboard, columns=columns, show="headings", height=5)
        headings = {
            "plot": ("Plot", 100), "moisture": ("Moisture", 100), "rain": ("Rain", 90),
            "urgency": ("Urgency", 95), "date": ("Irrigation date", 140),
            "minutes": ("Duration", 90), "alert": ("Alert", 130),
        }
        for column, (title, width) in headings.items():
            self.table.heading(column, text=title)
            self.table.column(column, width=width, anchor="center")
        self.table.tag_configure("Now", background="#fff0ed")
        self.table.tag_configure("Soon", background="#fff7dd")
        self.table.tag_configure("Wait", background="#e9f7ef")
        self.table.pack(fill="x", pady=(18, 10))
        self.table.bind("<Double-1>", self.load_selected_plot)
        ttk.Button(dashboard, text="Load selected plot into recommendation", command=self.load_selected_plot).pack(
            anchor="w"
        )
        ttk.Label(
            dashboard,
            text="Alerts appear inside this demo only. No SMS or external notification is sent.",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(18, 0))
        self.update_dashboard()

    def load_plot(self, plot):
        self.plot.set(plot.plot)
        self.moisture.set(str(plot.moisture))
        self.temperature.set(str(plot.temperature))
        self.rain.set(str(plot.rain))
        self.stage.set(plot.stage)
        self.result_text.set(f"{plot.plot} loaded. Click Generate recommendation.")
        self.current_alert.set("Local app alert will appear here when irrigation is due.")

    def select_plot(self, _event=None):
        self.load_plot(self.plot_data[self.plot.get()])

    def load_selected_plot(self, _event=None):
        selection = self.table.selection()
        if not selection:
            messagebox.showinfo("Select a plot", "Choose a row in the dashboard first.")
            return
        name = self.table.item(selection[0], "values")[0]
        self.load_plot(self.plot_data[name])
        self.notebook.select(0)

    def update_dashboard(self):
        rows = dashboard_status(self.advisor, list(self.plot_data.values()))
        counts = {"Now": 0, "Soon": 0, "Wait": 0}
        alerts = []
        for item in self.table.get_children():
            self.table.delete(item)

        for plot, recommendation, alert in rows:
            counts[recommendation.urgency] += 1
            if alert != "No alert":
                alerts.append(f"{plot.plot}: {alert.lower()} ({recommendation.duration_minutes} min)")
            date_text = (
                recommendation.irrigation_date.strftime("%d %b %Y")
                if recommendation.irrigation_date else "Not scheduled"
            )
            self.table.insert(
                "", "end", values=(
                    plot.plot, f"{plot.moisture:g}%", f"{plot.rain:g} mm",
                    recommendation.urgency.upper(), date_text,
                    f"{recommendation.duration_minutes} min", alert,
                ), tags=(recommendation.urgency,),
            )

        for name in counts:
            self.counts[name].set(str(counts[name]))
        self.dashboard_alert.set("   |   ".join(alerts) if alerts else "No plots are due today or tomorrow.")

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

        self.plot_data[conditions.plot] = conditions
        self.update_dashboard()
        alert = alert_status(recommendation)
        self.current_alert.set(
            f"Local app alert: {conditions.plot} is {alert.lower()}."
            if alert != "No alert" else "No irrigation alert for this plot."
        )

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
        PlotConditions("Rain expected", 25, 34, 12, "Mid"),
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
