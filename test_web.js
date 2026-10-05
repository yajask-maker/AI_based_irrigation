const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MODEL, SAMPLE_PLOTS, predict, treeLayout } = require("./app.js");

const day = new Date(2026, 9, 5);

test("dry plot recommends irrigation today", () => {
  const result = predict(SAMPLE_PLOTS["Plot A"], day);
  assert.equal(result.urgency, "Now");
  assert.equal(result.duration, 40);
  assert.equal(result.irrigationDate.getDate(), 5);
  assert.equal(result.alert, "Due today");
});

test("moderate plot recommends tomorrow", () => {
  const result = predict(SAMPLE_PLOTS["Plot B"], day);
  assert.equal(result.urgency, "Soon");
  assert.equal(result.duration, 15);
  assert.equal(result.irrigationDate.getDate(), 6);
  assert.equal(result.alert, "Due tomorrow");
});

test("changing only forecast rain changes Now to Wait", () => {
  const dry = SAMPLE_PLOTS["Plot A"];
  const rainy = SAMPLE_PLOTS["Plot C"];
  assert.equal(dry.moisture, rainy.moisture);
  assert.equal(dry.temperature, rainy.temperature);
  assert.equal(dry.stage, rainy.stage);
  assert.equal(predict(dry, day).urgency, "Now");
  const result = predict(rainy, day);
  assert.equal(result.urgency, "Wait");
  assert.equal(result.irrigationDate, null);
  assert.equal(result.duration, 0);
  assert.equal(result.reviewDate.getDate(), 7);
});

test("invalid inputs are rejected", () => {
  assert.throws(() => predict({ ...SAMPLE_PLOTS["Plot A"], moisture: 120 }), /Soil moisture/);
  assert.throws(() => predict({ ...SAMPLE_PLOTS["Plot A"], rain: "" }), /forecast rain/i);
  assert.throws(() => predict({ ...SAMPLE_PLOTS["Plot A"], stage: "Unknown" }), /growth stage/);
});

test("the exported model agrees with all illustrative training labels", () => {
  const rows = fs.readFileSync(path.join(__dirname, "training_examples.csv"), "utf8").trim().split(/\r?\n/).slice(1);
  assert.equal(rows.length, MODEL.trainingExamples);
  for (const row of rows) {
    const [moisture, temperature, rain, urgency] = row.split(",");
    const input = { plot: "Plot A", moisture, temperature, rain, stage: "Mid" };
    assert.equal(predict(input, day).urgency, urgency, row);
  }
});

test("tree layout contains every model node", () => {
  const layout = treeLayout();
  assert.equal(Object.keys(layout.positions).length, MODEL.nodes.length);
  assert.ok(layout.width > 0 && layout.height > 0);
  assert.equal(predict(SAMPLE_PLOTS["Plot A"], day).path[0], 0);
});
