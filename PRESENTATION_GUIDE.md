# OOSE Lab CA Presentation Guide

## Opening in one sentence

"For my sugarcane irrigation use case, I implemented the irrigation recommendation requirement. I can enter a plot's soil reading and fetch current modelled weather for a nearby town. A trained decision tree classifies urgency and shows a date, illustrative duration, and explanation."

## Three-minute live demo with values entered in class

| Time | Action in the browser | What to say |
| --- | --- | --- |
| 0:00–0:20 | Open **Recommendation**. Select Plot A and type moisture `25`, temperature `34`, rain `0`, stage **Mid**. | "I can enter readings chosen during this demonstration. The model uses moisture, temperature, and forecast rain; stage sets the illustrative duration." |
| 0:20–0:55 | Click **Generate recommendation**. | "For these values, the tree predicts Now. The page suggests today, shows 40 minutes, and displays a local alert." |
| 0:55–1:30 | Select **See highlighted decision path**. | "Gold marks the threshold comparisons for the values I entered and ends at Now. The model predicts urgency; application rules add date and minutes." |
| 1:30–2:10 | Return to **Recommendation**. Keep all values the same but change rain to `12`; click **Generate recommendation**. | "Only the rain forecast changed. The result switches to Wait, so no irrigation is scheduled. The tree path also changes." |
| 2:10–2:45 | Open **Plot dashboard**. | "Plot A now shows Wait because I updated its values. The other sample plots keep their own conditions. Alerts are local to this page." |
| 2:45–3:00 | Point to the classroom note. | "The 42 training examples and durations are illustrative. Real farm use requires measured data and agronomic validation." |

If extra time remains, enter `120` for moisture and generate again to demonstrate validation. You may choose other valid values on the spot; the same browser model calculates a fresh result. Changing a value shows a reminder until you click Generate. Keep the rain comparison as the centre of the presentation.

## Optional live weather demonstration

1. Keep the plot selected. Enter a soil moisture reading from a sensor or a value given by the teacher. If using a classroom number, call it a demonstration reading rather than a measured one.
2. Type a nearby Indian town, such as **Kolhapur**, and click **Use current weather**. The page fills current modelled air temperature and forecast precipitation for the next 24 hours. It displays the resolved town and model time; the actual numbers will vary.
3. Click **Generate recommendation**. Explain the result shown on screen rather than promising a specific outcome. The water-use context uses Open-Meteo ET₀ and approximate FAO sugarcane stage factors, but it is not an irrigation dose.
4. If the connection fails, type temperature and rain manually and continue. The decision tree and dashboard work offline.

## Explain the architecture simply

`train_model.py` trained the decision tree from the CSV and exported its threshold questions to `model.js`. `app.js` follows those questions in the browser and draws the highlighted route. `index.html` and `styles.css` make the interface. The weather button uses Open-Meteo; manual entry needs no internet. A browser reload restores the three sample plots.

## Likely viva questions

**Is this really machine learning?** Yes. The decision tree was fitted to labelled examples using scikit-learn. The browser runs the exported trained tree; it does not retrain it on every click.

**Where did the data come from?** The 42 examples are explicitly illustrative classroom scenarios, not historical farm records.

**What is live and what is not?** The optional weather button fetches current modelled temperature and forecast rain for a nearby town. Soil moisture must be entered from the plot. The decision tree was trained on classroom labels and is not field validated.

**What is its accuracy?** Real-world accuracy has not been established. Matching the classroom labels and passing software checks do not replace an independent field-data evaluation.

**Does the model predict exact duration?** No. It predicts urgency. A separate table combines urgency and crop stage to choose illustrative minutes.

**What is the water-use estimate?** Open-Meteo supplies reference evapotranspiration for the next 24 hours. Multiplying it by an approximate FAO stage factor estimates potential sugarcane water use, not a precise irrigation amount. Effective rainfall and stored soil water are not calculated.

**What if the soil reading or forecast changes?** Enter the new value and generate again. The result, dashboard, alert, and highlighted tree path update. Automatic sensor ingestion is outside this prototype.

**Are notifications sent to phones?** No. This demo shows local app alerts only.

**Where is object orientation?** The broader OOSE project separates plot data, recommendation logic, and the interface. This web prototype keeps training/export separate from browser inference and presentation. It demonstrates one functional requirement, rather than claiming to be the full deployed system.

## Before class

1. Download the latest repository ZIP, extract it, and **double-click `index.html`**. No installation is needed for the demo.
2. Confirm all three sample buttons, the Plot dashboard, and the Decision tree view open. Try the live weather button while connected; keep manual values ready as a fallback.
3. Use browser full-screen mode if it helps visibility. Keep the repository folder available so `decision_tree.svg` can be opened as a backup diagram.
4. The dates on the live page use the computer's current date, so say “today” and “tomorrow” rather than memorizing calendar dates.
