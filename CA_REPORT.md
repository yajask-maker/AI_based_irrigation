# OOSE Lab CA Report

## Title

Live demonstration of the AI Based Irrigation Recommendation functional requirement for the AI Irrigation Advisory System for Sugarcane Crop.

## Aim

To implement and demonstrate a prototype that accepts plot conditions and produces an irrigation recommendation with a suggested date and duration.

## Functional requirement selected

The system accepts the latest soil moisture, temperature, forecast rain, and crop growth stage for a selected plot, then presents a plot-specific irrigation recommendation. This prototype demonstrates that input-to-recommendation flow with simulated values. It does not implement live sensor ingestion, external weather APIs, or automatic re-generation when a remote data source changes.

## Methodology

1. Prepare 42 labelled illustrative examples in `training_examples.csv`. Inputs are soil moisture percentage, temperature in degrees Celsius, and rainfall forecast for the next 24 hours in millimetres. Labels are **Now**, **Soon**, and **Wait**.
2. Train a depth-limited decision tree classifier on those examples when the program starts. The examples are classroom scenarios based on stated assumptions, not observations from a farm.
3. Build the application using three small classes: `PlotConditions` validates input, `IrrigationAdvisor` generates a recommendation, and `IrrigationApp` displays the Tkinter interface.
4. Translate the predicted urgency into a date. Use a small, explicit table of illustrative durations for Early, Mid, and Late growth stages.
5. Display the plot status and local in-app alerts on a dashboard. Generate a new recommendation to update that plot's dashboard row.
6. Test the three demonstration scenarios and invalid inputs. Display the comparisons followed by the decision tree so the result can be explained during the live demo.
7. Open the visual decision tree from the GUI. The highlighted boxes and lines show the exact route for the current inputs.

## Algorithm

1. Read the labelled examples from the CSV file and train the decision tree.
2. Select a plot and enter moisture, temperature, expected rain, and growth stage.
3. Check that moisture is between 0 and 100%, temperature between 0 and 55 °C, rain between 0 and 100 mm, and growth stage is selected.
4. Pass moisture, temperature, and rain to the trained tree. It predicts **Now**, **Soon**, or **Wait**.
5. If the result is **Now**, suggest today. If it is **Soon**, suggest tomorrow. If it is **Wait**, schedule no irrigation and suggest reviewing conditions in two days.
6. For **Now** or **Soon**, look up an illustrative duration using the urgency and growth stage. Display the prediction, date, duration, and tree path.
7. Refresh the dashboard with the updated plot result and show a local alert when the date is today or tomorrow.

## Result

The terminal demonstration was run on **4 October 2026**. It produced the following results:

| Scenario | Moisture | Temperature | Forecast rain | Stage | Predicted urgency | Suggested date | Duration |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| Dry soil | 25% | 34 °C | 0 mm | Mid | Now | 4 Oct 2026 | 40 min |
| Moderate soil | 50% | 28 °C | 4 mm | Early | Soon | 5 Oct 2026 | 15 min |
| Rain expected | 25% | 34 °C | 12 mm | Mid | Wait | No irrigation; review 6 Oct 2026 | 0 min |

Eight automated checks passed: the three scenarios above, rejection of invalid soil moisture and growth stage, completeness of the tree diagram layout, the dashboard statuses and alerts, and a changed plot's updated prediction. The program also rejects out-of-range temperature or rain. The live GUI offers the same preset inputs and allows manual changes.

The dashboard displays **Due today** for Plot A, **Due tomorrow** for Plot B, and **No alert** for Plot C. These are local in-app alerts based on the recommendation date. The dashboard supports the selected recommendation requirement; it does not send SMS or retrieve live sensor readings.

### Visual result

The following diagram shows the full tree trained on the illustrative examples. The **View decision tree** button highlights the branch for whichever plot conditions are currently entered. With moisture fixed at 25% and temperature fixed at 34 °C, changing forecast rain from 0 mm to 12 mm changes the route from **Now** to **Wait**.

![Trained decision tree](decision_tree.svg)

## Conclusion and limitation

The prototype demonstrates the selected recommendation requirement from input to visible recommendation. The decision tree is easy to inspect, and the dashboard makes the changes and alerts visible. Since training labels and durations are illustrative, the result is suitable for demonstrating the software workflow only. It has not been validated for real irrigation decisions.
