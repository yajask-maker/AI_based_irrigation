const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MODEL, SAMPLE_PLOTS, predict, treeLayout, parseWeatherForecast, fetchWeatherForCity, sampleHistory, loadHistory, makeHistoryEntry, HISTORY_KEY } = require("./app.js");

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

test("weather forecast uses the next 24 hours and leaves soil moisture for manual entry", () => {
  const data = {
    current: { temperature_2m: 29.6, time: "2026-10-05T13:00" },
    hourly: {
      precipitation: [99, ...Array(23).fill(0), 12],
      et0_fao_evapotranspiration: [99, ...Array(24).fill(0.2)]
    }
  };
  const weather = parseWeatherForecast({ name: "Kolhapur", admin1: "Maharashtra" }, data);
  assert.equal(weather.temperature, 29.6);
  assert.equal(weather.rain, 12);
  assert.equal(weather.et0, 4.8);
  assert.equal(weather.location, "Kolhapur, Maharashtra");
  assert.equal(weather.moisture, undefined);
  assert.equal(weather.hourlyRain.length, 24);
  assert.equal(weather.hourlyRain[23], 12);
  assert.throws(() => parseWeatherForecast({ name: "Kolhapur" }, { current: { temperature_2m: 28 } }), /incomplete/);
});

test("sample history is labelled separately and saved readings survive a reload", () => {
  const samples = sampleHistory("Plot A", day);
  assert.equal(samples.length, 4);
  assert.ok(samples.every(item => item.source === "Sample"));
  const recorded = makeHistoryEntry(predict(SAMPLE_PLOTS["Plot A"], day), day, "Entered values");
  const storage = { getItem: key => key === HISTORY_KEY ? JSON.stringify([recorded, { ...recorded, urgency: "Wait" }]) : null };
  assert.deepEqual(loadHistory(storage), [recorded]);
  assert.equal(loadHistory({ getItem: () => "broken" }).length, 0);
});

test("live weather lookup requests the chosen town and forecast without an API key", async () => {
  const requests = [];
  const fakeFetch = async url => {
    requests.push(new URL(url));
    return {
      ok: true,
      json: async () => requests.length === 1
        ? { results: [{ name: "Kolhapur", admin1: "Maharashtra", latitude: 16.7, longitude: 74.2 }] }
        : { current: { temperature_2m: 29, time: "2026-10-05T13:00" },
            hourly: { precipitation: Array(25).fill(0), et0_fao_evapotranspiration: Array(25).fill(0.1) } }
    };
  };
  const weather = await fetchWeatherForCity("Kolhapur", fakeFetch);
  assert.equal(weather.temperature, 29);
  assert.equal(requests[0].searchParams.get("name"), "Kolhapur");
  assert.equal(requests[0].searchParams.get("countryCode"), "IN");
  assert.equal(requests[1].searchParams.get("forecast_hours"), "25");
  assert.equal(requests[1].searchParams.get("current"), "temperature_2m");
  assert.equal(requests[1].searchParams.has("apikey"), false);
});
