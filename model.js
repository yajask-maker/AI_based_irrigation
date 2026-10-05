// Generated from training_examples.csv by train_model.py.
const IRRIGATION_MODEL = {
  "trainingExamples": 42,
  "features": [
    "moisture",
    "temperature",
    "rain"
  ],
  "nodes": [
    {
      "id": 0,
      "feature": "moisture",
      "threshold": 55.0,
      "left": 1,
      "right": 12,
      "prediction": "Wait",
      "samples": 42
    },
    {
      "id": 1,
      "feature": "rain",
      "threshold": 8.0,
      "left": 2,
      "right": 11,
      "prediction": "Soon",
      "samples": 24
    },
    {
      "id": 2,
      "feature": "rain",
      "threshold": 2.0,
      "left": 3,
      "right": 10,
      "prediction": "Soon",
      "samples": 16
    },
    {
      "id": 3,
      "feature": "moisture",
      "threshold": 35.0,
      "left": 4,
      "right": 5,
      "prediction": "Now",
      "samples": 8
    },
    {
      "id": 4,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Now",
      "samples": 4
    },
    {
      "id": 5,
      "feature": "moisture",
      "threshold": 45.0,
      "left": 6,
      "right": 9,
      "prediction": "Soon",
      "samples": 4
    },
    {
      "id": 6,
      "feature": "temperature",
      "threshold": 32.0,
      "left": 7,
      "right": 8,
      "prediction": "Now",
      "samples": 2
    },
    {
      "id": 7,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Soon",
      "samples": 1
    },
    {
      "id": 8,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Now",
      "samples": 1
    },
    {
      "id": 9,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Soon",
      "samples": 2
    },
    {
      "id": 10,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Soon",
      "samples": 8
    },
    {
      "id": 11,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Wait",
      "samples": 8
    },
    {
      "id": 12,
      "feature": null,
      "threshold": null,
      "left": null,
      "right": null,
      "prediction": "Wait",
      "samples": 18
    }
  ]
};
if (typeof window !== 'undefined') window.IRRIGATION_MODEL = IRRIGATION_MODEL;
if (typeof module !== 'undefined') module.exports = IRRIGATION_MODEL;
