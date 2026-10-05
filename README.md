# Sugarcane Irrigation Advisor

A browser-based OOSE lab CA prototype for the **AI Irrigation Advisory System for Sugarcane Crop**. The selected functional requirement is an irrigation recommendation from plot conditions. The dashboard, local alerts, and decision tree diagram help explain that result during a live demo.

## Run the web app

1. Download the repository as a ZIP and extract it.
2. Double-click **`index.html`** in the extracted folder. Chrome or Edge works well.
3. Keep `index.html`, `styles.css`, `app.js`, and `model.js` together.

There is **no server, installation, internet connection, or API key** needed to run the demo. For a presentation, open the page before class and use the browser's full-screen mode if helpful.

## Three views

- **Recommendation:** Choose one of three sample plots or enter moisture, temperature, forecast rain, and growth stage. The page validates the values and displays urgency, a proposed date, illustrative minutes, an app alert, and the decision path.
- **Plot dashboard:** Shows the three plots side by side, counts for Now/Soon/Wait, and local alerts for dates today or tomorrow. Inspect a row to return to its inputs.
- **Decision tree:** Draws the exported model in the browser. Gold highlights the current plot's exact route. The plus, minus, and Fit controls change the diagram size.

The **Dry soil** and **Rain expected** examples have the same moisture (25%), temperature (34 °C), and growth stage (Mid). Only forecast rain changes from 0 to 12 mm, switching the result from Now to Wait. This is the clearest comparison to demonstrate.

## How the model works

`training_examples.csv` has 42 **illustrative, labelled classroom scenarios**, not real farm measurements. `train_model.py` trains a scikit-learn `DecisionTreeClassifier` and exports its nodes to `model.js`. The web app reads those nodes and follows the threshold questions locally in the browser. It does not train a new model or contact a server when the page opens.

The model predicts **Now**, **Soon**, or **Wait** from moisture, temperature, and rain. Simple application rules map Now to today, Soon to tomorrow, and Wait to no irrigation with a review date in two days. A separate lookup table uses growth stage and urgency for illustrative durations. The model does **not** predict an exact number of minutes.

The labels and durations are assumptions made for a software demonstration. Agreement with the 42 examples is **not** evidence of real-world accuracy. Real use would require measured farm data, expert labels, independent testing, and agronomic validation. Alerts appear on the page only; no SMS is sent. Edited plot values reset on reload.

## Optional verification or retraining

The app runs without Python. If Node.js is available, run the model checks with:

```bash
node test_web.js
```

If you edit `training_examples.csv`, regenerate `model.js` with Python and scikit-learn:

```bash
py -m pip install -r requirements.txt
py train_model.py
```

Then reload `index.html`. These Python commands are **not needed** for the live demo.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Offline web interface and browser prediction logic |
| `model.js` | Exported decision tree used by the web page |
| `training_examples.csv`, `train_model.py` | Illustrative examples and optional training/export step |
| `test_web.js` | Model and input validation checks |
| `decision_tree.svg` | Printable full tree diagram |
| `CA_REPORT.md` | Aim, methodology, algorithm, and observed results |
| `PRESENTATION_GUIDE.md` | Three-minute demo and viva preparation |
