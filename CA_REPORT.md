# OOSE Lab CA Report

**Project:** AI Irrigation Advisory System for Sugarcane Crop  
**Selected functional requirement:** AI-Based Irrigation Recommendation  

## Aim

To implement and demonstrate a browser-based prototype that accepts a plot's soil reading and current weather values, then displays a plot-specific irrigation recommendation with urgency, a proposed date, and an illustrative duration.

## Methodology

1. Prepare 42 labelled illustrative scenarios in `training_examples.csv` using soil moisture, temperature, and forecast rain as inputs and Now, Soon, or Wait as the label.
2. Train a depth-limited decision tree with scikit-learn in `train_model.py`, then export its nodes to `model.js`.
3. Build a static web page using HTML, CSS, and JavaScript. The browser traverses the exported tree for each new manual or fetched input. No backend is required.
4. Validate moisture (0–100%), temperature (0–55 °C), rain (0–100 mm), and crop growth stage (Early, Mid, Late).
5. Convert the predicted urgency to a date and use a stated lookup table for illustrative minutes. Display a local alert for a recommendation due today or tomorrow.
6. Optionally find an Indian town through Open-Meteo geocoding and fetch modelled current temperature, the next 24 hours of forecast precipitation, and reference evapotranspiration (ET₀). The user supplies actual plot soil moisture and may override any weather field. If online weather is unavailable, manual input still works.
7. Show the same results in a plot dashboard and highlight the exact branch through the visual decision tree. With fetched weather, display a separate potential crop water-use context using ET₀ × approximate FAO sugarcane stage coefficient. It is not an irrigation dose.

## Algorithm

1. Load the exported tree and the selected plot conditions in the browser. If requested, fetch weather for the entered town, sum the next 24 forecast hours, and fill temperature and rain; do not replace the manually entered soil reading.
2. Start at the root node. Compare the relevant input with the node threshold. Follow the left branch for a value at or below the threshold, or the right branch otherwise. Repeat until a leaf is reached.
3. Read the leaf label: **Now**, **Soon**, or **Wait**.
4. Map Now to today, Soon to tomorrow, and Wait to no scheduled irrigation and a review in two days.
5. For Now or Soon, look up the illustrative duration from the urgency and growth stage. Display the result, local alert, and decision path. Update the dashboard row for that plot. If live weather was used, show ET₀ × stage coefficient separately as potential crop water use.

## Result

The model checks used **5 October 2026** as a fixed date. The three cases produced:

| Scenario | Moisture | Temperature | Rain forecast | Stage | Outcome | Date | Duration | Local alert |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: | --- |
| Dry soil | 25% | 34 °C | 0 mm | Mid | Now | 5 Oct 2026 | 40 min | Due today |
| Moderate soil | 50% | 28 °C | 4 mm | Early | Soon | 6 Oct 2026 | 15 min | Due tomorrow |
| Rain expected | 25% | 34 °C | 12 mm | Mid | Wait | No irrigation; review 7 Oct 2026 | 0 min | No alert |

The Dry soil and Rain expected cases differ only in forecast rain. Their highlighted routes end at different leaves. Eight JavaScript checks passed, including these outcomes, input validation, agreement with the illustrative labels, tree layout, and mocked weather-response parsing and request construction. The date displayed in the live page follows the presentation device's current date. The online weather button fills values for a chosen town; the user must still enter soil moisture for the plot.

![Full exported decision tree](decision_tree.svg)

## Conclusion and limitations

The prototype demonstrates the selected recommendation requirement from input through a visible, explainable result. Live weather can provide current modelled temperature and forecast rain, while plot-specific soil moisture is entered manually. Its training labels, fixed thresholds, and duration values have **not** been validated for real irrigation decisions. It does not connect to a field sensor, send SMS, or persist changes after reload. Effective rainfall and stored soil water must be assessed before treating potential crop water use as an irrigation requirement.

References: [Open-Meteo forecast API](https://open-meteo.com/en/docs), [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api), [FAO sugarcane crop coefficients](https://www.fao.org/4/X0490E/x0490e0b.htm), [FAO irrigation scheduling](https://www.fao.org/4/T7202E/t7202e06.htm).
