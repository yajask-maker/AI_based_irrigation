# OOSE Lab CA Report

**Project:** AI Irrigation Advisory System for Sugarcane Crop  
**Selected functional requirement:** AI-Based Irrigation Recommendation  
**Student:** Yajas Kothari · Roll No. 16014224051 · Batch A2

## Aim

To implement and demonstrate a browser-based prototype that accepts plot conditions and displays a plot-specific irrigation recommendation, including urgency, a proposed date, and an illustrative duration.

## Methodology

1. Prepare 42 labelled illustrative scenarios in `training_examples.csv` using soil moisture, temperature, and forecast rain as inputs and Now, Soon, or Wait as the label.
2. Train a depth-limited decision tree with scikit-learn in `train_model.py`, then export its nodes to `model.js`.
3. Build a static web page using HTML, CSS, and JavaScript. The browser traverses the exported tree for each new input. No server or external API is required for the demonstration.
4. Validate moisture (0–100%), temperature (0–55 °C), rain (0–100 mm), and crop growth stage (Early, Mid, Late).
5. Convert the predicted urgency to a date and use a stated lookup table for illustrative minutes. Display a local alert for a recommendation due today or tomorrow.
6. Show the same results in a plot dashboard and highlight the exact branch through the visual decision tree.

## Algorithm

1. Load the exported tree and the selected plot conditions in the browser.
2. Start at the root node. Compare the relevant input with the node threshold. Follow the left branch for a value at or below the threshold, or the right branch otherwise. Repeat until a leaf is reached.
3. Read the leaf label: **Now**, **Soon**, or **Wait**.
4. Map Now to today, Soon to tomorrow, and Wait to no scheduled irrigation and a review in two days.
5. For Now or Soon, look up the illustrative duration from the urgency and growth stage. Display the result, local alert, and decision path. Update the dashboard row for that plot.

## Result

The model checks used **5 October 2026** as a fixed date. The three cases produced:

| Scenario | Moisture | Temperature | Rain forecast | Stage | Outcome | Date | Duration | Local alert |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: | --- |
| Dry soil | 25% | 34 °C | 0 mm | Mid | Now | 5 Oct 2026 | 40 min | Due today |
| Moderate soil | 50% | 28 °C | 4 mm | Early | Soon | 6 Oct 2026 | 15 min | Due tomorrow |
| Rain expected | 25% | 34 °C | 12 mm | Mid | Wait | No irrigation; review 7 Oct 2026 | 0 min | No alert |

The Dry soil and Rain expected cases differ only in forecast rain. Their highlighted routes end at different leaves. Six JavaScript checks passed, including these outcomes, input validation, agreement with the illustrative labels, and completeness of the tree layout. The date displayed in the live page follows the presentation computer's current date.

![Full exported decision tree](decision_tree.svg)

## Conclusion and limitations

The prototype demonstrates the selected recommendation requirement from input through a visible, explainable result. The dashboard and local alerts make the outcome easy to inspect. It uses simulated inputs and classroom labels; the model and duration values have **not** been validated for real irrigation decisions. This version does not connect to sensors, fetch live weather, send SMS, or persist changes after reload.
