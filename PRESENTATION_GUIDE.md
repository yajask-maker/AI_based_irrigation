# OOSE Lab CA Presentation Guide

## Opening in one sentence

"For my sugarcane irrigation use case, I implemented the irrigation recommendation requirement: the browser app takes plot and weather conditions, uses a decision tree to classify urgency, and shows a proposed date, duration, and explanation."

## Three-minute live demo

| Time | Action in the browser | What to say |
| --- | --- | --- |
| 0:00–0:25 | Open **Plot dashboard**. | "These are three simulated plots. The cards show how many need irrigation now, soon, or after a wait; the alerts are local to this page." |
| 0:25–1:05 | Open **Recommendation** and choose **Dry soil**. | "With 25% moisture and no expected rain, the exported decision tree predicts Now. The app maps that to today's date and an illustrative 40-minute duration for the Mid stage." |
| 1:05–1:45 | Select **See highlighted decision path**. | "Gold marks the comparisons followed for these inputs. The path ends at the Now leaf. The model predicts urgency; simple application rules add the date and minutes." |
| 1:45–2:25 | Return to **Recommendation**, choose **Rain expected**, then view the tree again. | "Moisture, temperature, and stage are unchanged. Only forecast rain rises from 0 to 12 mm, so the tree follows a different branch to Wait. No irrigation is scheduled." |
| 2:25–2:50 | Open **Plot dashboard** again. | "The dashboard presents the same model results and shows local alerts for plots due today or tomorrow. It is a supporting view of the selected requirement." |
| 2:50–3:00 | Point to the classroom note. | "The 42 training examples and durations are illustrative. Real farm use requires measured data and agronomic validation." |

If extra time remains, enter `120` for moisture and generate again to demonstrate validation. Keep the recommendation comparison as the centre of the presentation.

## Explain the architecture simply

`train_model.py` trained the decision tree from the CSV and exported its threshold questions to `model.js`. `app.js` follows those questions in the browser and draws the highlighted route. `index.html` and `styles.css` make the interface. The page needs no backend or internet connection. A browser reload restores the three sample plots.

## Likely viva questions

**Is this really machine learning?** Yes. The decision tree was fitted to labelled examples using scikit-learn. The browser runs the exported trained tree; it does not retrain it on every click.

**Where did the data come from?** The 42 examples are explicitly illustrative classroom scenarios, not historical farm records.

**What is its accuracy?** Real-world accuracy has not been established. Matching the classroom labels and passing software checks do not replace an independent field-data evaluation.

**Does the model predict exact duration?** No. It predicts urgency. A separate table combines urgency and crop stage to choose illustrative minutes.

**What if the sensor reading or forecast changes?** Enter the new value and generate again. The result, dashboard, alert, and highlighted tree path update. Automatic sensor ingestion is outside this prototype.

**Are notifications sent to phones?** No. This demo shows local app alerts only.

**Where is object orientation?** The broader OOSE project separates plot data, recommendation logic, and the interface. This web prototype keeps training/export separate from browser inference and presentation. It demonstrates one functional requirement, rather than claiming to be the full deployed system.

## Before class

1. Download the latest repository ZIP, extract it, and **double-click `index.html`**. No installation is needed for the demo.
2. Confirm all three sample buttons, the Plot dashboard, and the Decision tree view open in your presentation browser.
3. Use browser full-screen mode if it helps visibility. Keep the repository folder available so `decision_tree.svg` can be opened as a backup diagram.
4. The dates on the live page use the computer's current date, so say “today” and “tomorrow” rather than memorizing calendar dates.
