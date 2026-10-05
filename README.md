# Sugarcane Irrigation Advisor

A browser-based OOSE lab CA prototype for the **AI Irrigation Advisory System for Sugarcane Crop**. The selected functional requirement is an irrigation recommendation from plot conditions. The dashboard, local alerts, and decision tree diagram help explain that result during a live demo.

## Run the web app

1. Download the repository as a ZIP and extract it.
2. Double-click **`index.html`** in the extracted folder. Chrome or Edge works well.
3. Keep `index.html`, `styles.css`, `app.js`, and `model.js` together.

There is **no server, installation, or API key** needed. Manual entry and all four views work offline. The optional **Use current weather** button needs internet access. For a presentation, open the page before class and use the browser's full-screen mode if helpful.

## Enter live conditions

1. Select a plot. Enter its **measured soil moisture** from a sensor or a reading provided by the teacher. The weather service cannot measure the particular plot's soil.
2. Enter temperature and the next 24 hours of forecast rain by hand, **or** enter an Indian town near the plot and click **Use current weather**. This uses Open-Meteo's modelled current temperature and 24 hourly precipitation forecasts. The fetched values remain editable.
3. Select crop growth stage and click **Generate recommendation**. The displayed result, that plot's dashboard row, and the highlighted tree route update. The weather status shows the resolved town and model time. If the weather request fails, manual entry still works.

The modelled weather is real, current external forecast data, but it is not an on-plot sensor reading. Open-Meteo's next 24 hourly forecast values are summed after the current hour. The additional water-use context multiplies Open-Meteo's reference evapotranspiration (ET₀) by an approximate FAO sugarcane stage factor (Early 0.40, Mid 1.25, Late 0.75). This is **potential crop water use**, not the amount to irrigate: effective rainfall, stored soil water, soil type, irrigation efficiency, and local calibration are still needed.

## Four views

- **Recommendation:** Enter plot values yourself or fill weather from a live forecast. The page validates values and displays urgency, a proposed date, illustrative minutes, a local alert, the decision path, and weather context when available.
- **Plot dashboard:** Shows the three plots side by side, counts for Now/Soon/Wait, and local alerts for dates today or tomorrow. Inspect a row to return to its inputs.
- **Decision tree:** Draws the exported model in the browser. Gold highlights the current plot's exact route. The plus, minus, and Fit controls change the diagram size.
- **Monitoring & trends:** Select a plot to inspect a soil-moisture graph, its latest input and recommendation, and any fetched hourly rain forecast. Sample history contains four clearly marked illustrative classroom points. My recorded history contains only values saved when you press Generate recommendation in the input form. Readings are stored in this browser (up to 60 across plots) and remain after a reload; clearing browser data removes them.

To demonstrate the chart, open **Monitoring & trends** and show **Sample history**. Click **Record new reading**, enter plot conditions, and click **Generate recommendation**. Return to Monitoring & trends: **My recorded history** now has a point with its urgency label. Repeat with another entered reading to form a line. For the forecast bar chart, use **Use current weather** before generating; 24 hourly forecast bars then appear for that plot. The app does not poll a soil sensor or invent live moisture readings.

The **Dry soil** and **Rain expected** examples have the same moisture (25%), temperature (34 °C), and growth stage (Mid). Only forecast rain changes from 0 to 12 mm, switching the result from Now to Wait. This is the clearest comparison to demonstrate.

## How the model works

`training_examples.csv` has 42 **illustrative, labelled classroom scenarios**, not real farm measurements. `train_model.py` trains a scikit-learn `DecisionTreeClassifier` and exports its nodes to `model.js`. The web app reads those nodes and follows the threshold questions locally in the browser. It does not train a new model when the page opens; it contacts Open-Meteo only if the weather button is clicked.

The model predicts **Now**, **Soon**, or **Wait** from moisture, temperature, and rain. Simple application rules map Now to today, Soon to tomorrow, and Wait to no irrigation with a review date in two days. A separate lookup table uses growth stage and urgency for illustrative durations. The model does **not** predict an exact number of minutes.

The labels and durations are assumptions made for a software demonstration. Agreement with the 42 examples is **not** evidence of real-world accuracy. Real use would require measured farm data, calibrated soil readings, expert labels, independent testing, and agronomic validation. A current weather forecast does not validate the classifier. Alerts appear on the page only; no SMS is sent. Edited plot values reset on reload, while separately recorded history remains in the same browser.

Sources: [Open-Meteo weather API](https://open-meteo.com/en/docs), [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api), [FAO sugarcane coefficients](https://www.fao.org/4/X0490E/x0490e0b.htm), and [FAO irrigation scheduling guidance](https://www.fao.org/4/T7202E/t7202e06.htm).

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
| `test_web.js` | Model, input validation, and weather parsing checks |
| `decision_tree.svg` | Printable full tree diagram |
| `CA_REPORT.md` | Aim, methodology, algorithm, and observed results |
| `PRESENTATION_GUIDE.md` | Three-minute demo and viva preparation |
