# OOSE Lab CA Presentation Guide

## What to say at the start

"My Experiment 1 project is an AI Irrigation Advisory System for sugarcane. For this CA I implemented its irrigation recommendation requirement. The user selects a plot, enters soil moisture, temperature, expected rain, and growth stage, and the application suggests when to irrigate and for how long. I added a dashboard and local alerts to make the output easy to inspect."

## Three minute live demo

| Time | Action | What to say |
| --- | --- | --- |
| 0:00–0:25 | Open **Plot dashboard**. | "These are three simulated plots. The dashboard shows distinct outcomes and which plots are due today or tomorrow." |
| 0:25–1:05 | Open **Recommendation**; choose **Dry soil**; click **Generate recommendation**. | "For 25% moisture and no expected rain, the model predicts Now. The app converts that into today's date and an illustrative 40-minute duration for the Mid stage. A local alert appears." |
| 1:05–1:45 | Click **View decision tree**. Follow the gold path from the root to **Now**. | "The tree asks simple threshold questions. For this input, moisture is at most 55%, rain is at most 8 and then 2 mm, and moisture is at most 35%. That path ends at Now." |
| 1:45–2:25 | Close the tree; choose **Rain expected**; generate and view the tree again. | "Moisture and temperature are unchanged. Only the rain forecast changed from 0 to 12 mm. That sends the tree down a different branch to Wait, so irrigation is not scheduled." |
| 2:25–2:50 | Return to **Plot dashboard**. | "The dashboard displays the current outcomes and only local alerts for plots due today or tomorrow. It is a presentation of the recommendation result, not a separate AI model." |
| 2:50–3:00 | Point to the demo note. | "The 42 training scenarios and durations are illustrative. Real deployment would require measured farm data and agronomic validation." |

If there is extra time, enter `120` for soil moisture and click Generate to show validation. Avoid making the invalid-input step the centre of the demo.

## Model explanation in plain language

The decision tree learns threshold questions from 42 labelled classroom examples. It predicts one of three urgency labels: **Now**, **Soon**, or **Wait**. The program then maps Now to today, Soon to tomorrow, and Wait to no scheduled irrigation. A separate lookup table uses crop stage to choose illustrative minutes; the model does **not** predict the exact duration.

The dashboard is updated from the same recommendation engine. It does not use another model. Its alerts are shown inside the program for dates today and tomorrow; no SMS is sent.

## Likely questions

**Is this actually AI?** Yes. `DecisionTreeClassifier` is a machine learning classifier trained on labelled examples. The diagram shows the learned splits.

**Where did the data come from?** It is a small, explicitly labelled classroom dataset made to demonstrate the software flow. It is not historical farm data.

**What is the model's accuracy?** We have not measured real-world accuracy. The scripted cases and automated checks verify program behaviour, not field performance. A real evaluation needs independent farm measurements and expert labels.

**Why does the app show a duration?** The model predicts urgency; a simple table combines urgency with growth stage to choose demo minutes. These times need agronomist validation before real use.

**What if readings change?** Enter the new values and generate again. The plot's dashboard row and local alert update. Automatic IoT ingestion is outside this prototype.

**Where is object orientation?** `PlotConditions` holds and validates inputs, `IrrigationAdvisor` trains and uses the model, `IrrigationApp` manages the interface, and `DecisionTreeView` draws the tree.

## Before presenting

Open the downloaded repository folder in a terminal and run:

```powershell
py -m pip install -r requirements.txt
py app.py
```

Keep `app.py` and `training_examples.csv` together. Open the application once on the presentation PC, confirm the **View decision tree** window opens, and keep the three sample buttons ready. The dates shown by the app follow the computer's current date.
