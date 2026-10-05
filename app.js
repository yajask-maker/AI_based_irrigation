const MODEL = typeof window === "undefined" ? require("./model.js") : window.IRRIGATION_MODEL;

const SAMPLE_PLOTS = {
  "Plot A": { plot: "Plot A", moisture: 25, temperature: 34, rain: 0, stage: "Mid" },
  "Plot B": { plot: "Plot B", moisture: 50, temperature: 28, rain: 4, stage: "Early" },
  "Plot C": { plot: "Plot C", moisture: 25, temperature: 34, rain: 12, stage: "Mid" }
};

const DURATIONS = {
  Now: { Early: 20, Mid: 40, Late: 25 },
  Soon: { Early: 15, Mid: 25, Late: 15 }
};

// Approximate sugarcane stage coefficients from FAO-56, Table 12.
const SUGARCANE_KC = { Early: 0.40, Mid: 1.25, Late: 0.75 };

const FEATURE_NAMES = {
  moisture: "Soil moisture",
  temperature: "Temperature",
  rain: "Forecast rain"
};

const UNITS = { moisture: "%", temperature: " °C", rain: " mm" };
const HISTORY_KEY = "irrigation-advisor-readings-v1";
const SAMPLE_MOISTURE = {
  "Plot A": [58, 46, 34, 25],
  "Plot B": [69, 62, 54, 50],
  "Plot C": [55, 42, 34, 25]
};

function validateConditions(input) {
  if (!Object.hasOwn(SAMPLE_PLOTS, input.plot)) throw new Error("Select a plot.");
  const conditions = { plot: input.plot, stage: input.stage };
  for (const [name, min, max, label] of [
    ["moisture", 0, 100, "Soil moisture"],
    ["temperature", 0, 55, "Temperature"],
    ["rain", 0, 100, "Forecast rain"]
  ]) {
    if (input[name] === "" || input[name] === null || input[name] === undefined) {
      throw new Error(`Enter a value for ${label.toLowerCase()}.`);
    }
    const value = Number(input[name]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label} must be between ${min} and ${max}${UNITS[name].trim()}.`);
    }
    conditions[name] = value;
  }
  if (!["Early", "Mid", "Late"].includes(conditions.stage)) {
    throw new Error("Select a crop growth stage.");
  }
  return conditions;
}

function dayOffset(today, days) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
}

function predict(input, today = new Date()) {
  const conditions = validateConditions(input);
  const path = [0];
  const decisions = [];
  let node = MODEL.nodes[0];

  while (node.feature !== null) {
    const value = conditions[node.feature];
    const left = value <= node.threshold;
    decisions.push({
      nodeId: node.id,
      feature: node.feature,
      value,
      threshold: node.threshold,
      left
    });
    node = MODEL.nodes[left ? node.left : node.right];
    path.push(node.id);
  }

  const urgency = node.prediction;
  const irrigationDate = urgency === "Now" ? dayOffset(today, 0)
    : urgency === "Soon" ? dayOffset(today, 1) : null;
  return {
    conditions,
    urgency,
    irrigationDate,
    reviewDate: urgency === "Wait" ? dayOffset(today, 2) : null,
    duration: urgency === "Wait" ? 0 : DURATIONS[urgency][conditions.stage],
    alert: urgency === "Now" ? "Due today" : urgency === "Soon" ? "Due tomorrow" : "No alert",
    path,
    decisions
  };
}

function formatDate(value) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function parseWeatherForecast(location, data) {
  const temperature = Number(data?.current?.temperature_2m);
  const rainHours = data?.hourly?.precipitation?.slice(1, 25);
  const et0Hours = data?.hourly?.et0_fao_evapotranspiration?.slice(1, 25);
  if (data?.current?.temperature_2m === null || data?.current?.temperature_2m === undefined ||
      !Number.isFinite(temperature) || !rainHours || !et0Hours ||
      rainHours.length !== 24 || et0Hours.length !== 24 ||
      [...rainHours, ...et0Hours].some(value => value === null || !Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new Error("The weather service returned incomplete forecast data. Enter the values manually.");
  }
  const rain = Math.round(rainHours.reduce((sum, value) => sum + Number(value), 0) * 10) / 10;
  const et0 = Math.round(et0Hours.reduce((sum, value) => sum + Number(value), 0) * 10) / 10;
  if (temperature < 0 || temperature > 55 || rain > 100) {
    throw new Error("This forecast falls outside the demo model's input range. Enter suitable values manually.");
  }
  return {
    location: `${location.name}, ${location.admin1 || location.country}`,
    temperature: Math.round(temperature * 10) / 10,
    rain,
    et0,
    modelTime: data.current.time || "latest available",
    hourlyRain: rainHours.map(Number),
    hourlyTimes: data.hourly.time?.slice(1, 25) || []
  };
}

function sampleHistory(plot, today = new Date()) {
  return SAMPLE_MOISTURE[plot].map((moisture, index) => {
    const date = dayOffset(today, index - 3);
    const conditions = { ...SAMPLE_PLOTS[plot], moisture };
    return { time: date.toISOString(), conditions, urgency: predict(conditions, date).urgency, source: "Sample" };
  });
}

function loadHistory(storage) {
  try {
    const saved = JSON.parse(storage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(entry => {
      if (!entry || !Number.isFinite(Date.parse(entry.time)) || !["Now", "Soon", "Wait"].includes(entry.urgency)) return false;
      try { return predict(entry.conditions, new Date(entry.time)).urgency === entry.urgency; }
      catch { return false; }
    }).slice(-60);
  } catch { return []; }
}

function makeHistoryEntry(result, time = new Date(), source = "Manual weather") {
  return { time: time.toISOString(), conditions: { ...result.conditions }, urgency: result.urgency, source };
}

async function fetchWeatherForCity(city, fetcher = fetch) {
  if (city.trim().length < 2) throw new Error("Enter a town or city in India.");
  const search = new URL("https://geocoding-api.open-meteo.com/v1/search");
  search.searchParams.set("name", city.trim());
  search.searchParams.set("count", "1");
  search.searchParams.set("countryCode", "IN");
  const placeResponse = await fetcher(search);
  if (!placeResponse.ok) throw new Error("Location lookup failed. Enter the weather values manually.");
  const places = await placeResponse.json();
  const location = places.results?.[0];
  if (!location) throw new Error("Location not found. Try a nearby town in India.");

  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(location.latitude));
  forecast.searchParams.set("longitude", String(location.longitude));
  forecast.searchParams.set("current", "temperature_2m");
  forecast.searchParams.set("hourly", "precipitation,et0_fao_evapotranspiration");
  forecast.searchParams.set("forecast_hours", "25");
  forecast.searchParams.set("timezone", "auto");
  const weatherResponse = await fetcher(forecast);
  if (!weatherResponse.ok) throw new Error("Weather is unavailable. Enter the values manually.");
  return parseWeatherForecast(location, await weatherResponse.json());
}

function describeDecision(step) {
  const sign = step.left ? "≤" : ">";
  return `${FEATURE_NAMES[step.feature]} ${step.value}${UNITS[step.feature]} ${sign} ${step.threshold}${UNITS[step.feature]}`;
}

function treeLayout() {
  const positions = {};
  let leaf = 0;
  let depthLimit = 0;

  function place(id, depth) {
    depthLimit = Math.max(depthLimit, depth);
    const node = MODEL.nodes[id];
    let first, last;
    if (node.feature === null) {
      first = last = 135 + leaf * 225;
      leaf += 1;
    } else {
      [first] = place(node.left, depth + 1);
      [, last] = place(node.right, depth + 1);
    }
    positions[id] = { x: (first + last) / 2, y: 85 + depth * 140 };
    return [first, last];
  }

  place(0, 0);
  return { positions, width: 270 + (leaf - 1) * 225, height: 190 + depthLimit * 140 };
}

function makeSvg(tag, attributes = {}, content = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (content) element.textContent = content;
  return element;
}

function initApp() {
  let browserStorage = null;
  try { browserStorage = window.localStorage; } catch { /* The app still works without storage. */ }
  const state = {
    plots: Object.fromEntries(Object.entries(SAMPLE_PLOTS).map(([key, value]) => [key, { ...value }])),
    weatherByPlot: Object.fromEntries(Object.keys(SAMPLE_PLOTS).map(key => [key, null])),
    pendingWeather: null,
    current: null,
    history: browserStorage ? loadHistory(browserStorage) : [],
    historyMode: "sample",
    zoom: 0.85,
    treeWidth: 0,
    treeHeight: 0
  };
  const byId = id => document.getElementById(id);
  const form = byId("conditions-form");

  function showTab(name) {
    for (const tab of document.querySelectorAll(".tab")) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    for (const view of document.querySelectorAll(".view")) {
      const active = view.id === `${name}-panel`;
      view.hidden = !active;
      view.classList.toggle("active", active);
    }
    if (name === "tree" && state.current) {
      requestAnimationFrame(() => {
        const viewport = byId("tree-viewport");
        viewport.scrollLeft = Math.max(0, 790 * state.zoom - viewport.clientWidth / 2);
      });
    }
  }

  function loadPlot(name, resetToSample = false) {
    if (resetToSample) {
      state.plots[name] = { ...SAMPLE_PLOTS[name] };
      state.weatherByPlot[name] = null;
    }
    const plot = state.plots[name];
    state.pendingWeather = state.weatherByPlot[name];
    const status = byId("weather-status");
    status.classList.remove("weather-error");
    status.textContent = state.pendingWeather
      ? `This plot uses forecast values from ${state.pendingWeather.location}. You can replace them by hand or fetch again.`
      : "Fills air temperature and the next 24 hours of forecast rain. Soil moisture remains your own reading.";
    for (const key of ["plot", "moisture", "temperature", "rain", "stage"]) byId(key).value = plot[key];
    for (const button of document.querySelectorAll(".sample-btn")) {
      button.classList.toggle("active", button.dataset.plot === name);
    }
  }

  function readForm() {
    return Object.fromEntries(["plot", "moisture", "temperature", "rain", "stage"].map(key => [key, byId(key).value]));
  }

  function renderResult(result) {
    const status = byId("result-status");
    status.className = `status-pill ${result.urgency.toLowerCase()}`;
    status.textContent = result.urgency === "Now" ? "Irrigate now" : result.urgency === "Soon" ? "Plan soon" : "Wait";
    byId("result-plot").textContent = result.conditions.plot;
    byId("result-headline").textContent = result.urgency === "Now" ? "Irrigate this plot today."
      : result.urgency === "Soon" ? "Plan irrigation for tomorrow." : "No irrigation scheduled right now.";
    byId("result-date").textContent = result.irrigationDate ? formatDate(result.irrigationDate) : "Not scheduled";
    byId("result-duration").textContent = `${result.duration} min`;
    const alert = byId("result-alert");
    alert.classList.toggle("quiet", result.alert === "No alert");
    alert.textContent = result.alert === "No alert"
      ? `No local irrigation alert. Review this plot on ${formatDate(result.reviewDate)}.`
      : `Local app alert: ${result.conditions.plot} is ${result.alert.toLowerCase()}.`;
    byId("result-reason").textContent = result.decisions.map(describeDecision).join("  ·  ");
    const weather = state.weatherByPlot[result.conditions.plot];
    byId("weather-context").textContent = weather
      ? `Weather model: ${weather.location} at ${weather.modelTime} local time. Next 24 h reference water loss (ET₀): ${weather.et0} mm. FAO sugarcane stage factor ${SUGARCANE_KC[result.conditions.stage]} gives about ${(weather.et0 * SUGARCANE_KC[result.conditions.stage]).toFixed(1)} mm potential crop water use. This is context, not an irrigation dose; some forecast rain may run off.`
      : "These are manually entered or sample conditions. For field use, enter a measured soil reading and confirm the weather near the plot.";
  }

  function renderDashboard() {
    const results = Object.values(state.plots).map(plot => predict(plot));
    const counts = { Now: 0, Soon: 0, Wait: 0 };
    for (const result of results) counts[result.urgency] += 1;
    for (const label of Object.keys(counts)) byId(`count-${label.toLowerCase()}`).textContent = counts[label];
    byId("dashboard-date").textContent = formatDate(new Date());

    const alerts = byId("dashboard-alerts");
    alerts.replaceChildren();
    const due = results.filter(result => result.alert !== "No alert");
    if (!due.length) {
      const item = document.createElement("span");
      item.className = "alert-item";
      item.textContent = "No plots due today or tomorrow.";
      alerts.append(item);
    }
    for (const result of due) {
      const item = document.createElement("span");
      item.className = "alert-item";
      const label = document.createElement("b");
      label.textContent = result.conditions.plot;
      item.append(label, document.createTextNode(`${result.alert} · ${result.duration} min`));
      alerts.append(item);
    }

    const body = byId("dashboard-rows");
    body.replaceChildren();
    for (const result of results) {
      const row = document.createElement("tr");
      const values = [
        result.conditions.plot,
        `${result.conditions.moisture}%`,
        `${result.conditions.rain} mm`,
        result.urgency,
        result.irrigationDate ? formatDate(result.irrigationDate) : "Not scheduled",
        `${result.duration} min`
      ];
      for (const [index, value] of values.entries()) {
        const cell = document.createElement("td");
        if (index === 3) {
          const badge = document.createElement("span");
          badge.className = `row-status ${result.urgency.toLowerCase()}`;
          badge.textContent = value;
          cell.append(badge);
        } else cell.textContent = value;
        row.append(cell);
      }
      const actionCell = document.createElement("td");
      const action = document.createElement("button");
      action.type = "button";
      action.className = "table-action";
      action.textContent = "Inspect →";
      action.addEventListener("click", () => {
        loadPlot(result.conditions.plot);
        generate();
        showTab("advisor");
      });
      actionCell.append(action);
      row.append(actionCell);
      body.append(row);
    }
  }

  function renderMoistureChart(records, isSample) {
    const svg = byId("moisture-chart");
    svg.replaceChildren();
    svg.setAttribute("aria-label", `${isSample ? "Illustrative" : "Recorded"} soil moisture history for ${byId("monitor-plot").value}`);
    if (!records.length) {
      svg.append(makeSvg("text", { x: 350, y: 130, "text-anchor": "middle", class: "chart-empty" }, "No recorded readings yet"));
      return;
    }
    const left = 51, right = 671, top = 20, bottom = 219;
    for (const level of [0, 25, 50, 75, 100]) {
      const y = bottom - level / 100 * (bottom - top);
      svg.append(makeSvg("line", { x1: left, y1: y, x2: right, y2: y, class: "chart-grid" }));
      svg.append(makeSvg("text", { x: left - 11, y: y + 4, "text-anchor": "end", class: "chart-axis" }, `${level}`));
    }
    const points = records.map((entry, index) => ({
      x: records.length === 1 ? (left + right) / 2 : left + index / (records.length - 1) * (right - left),
      y: bottom - entry.conditions.moisture / 100 * (bottom - top),
      entry
    }));
    if (points.length > 1) svg.append(makeSvg("polyline", {
      points: points.map(point => `${point.x},${point.y}`).join(" "),
      class: isSample ? "chart-series sample" : "chart-series"
    }));
    const labelEvery = Math.max(1, Math.ceil(records.length / 6));
    points.forEach(({ x, y, entry }, index) => {
      const circle = makeSvg("circle", { cx: x, cy: y, r: 6, class: `chart-point ${entry.urgency.toLowerCase()}${isSample ? " sample" : ""}` });
      circle.append(makeSvg("title", {}, `${formatDate(new Date(entry.time))}: ${entry.conditions.moisture}% soil moisture, ${entry.urgency} (${entry.source})`));
      svg.append(circle);
      if (index % labelEvery === 0 || index === records.length - 1) {
        svg.append(makeSvg("text", { x, y: 245, "text-anchor": "middle", class: "chart-axis" },
          isSample ? new Date(entry.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : new Date(entry.time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })));
      }
    });
  }

  function renderRainChart(weather) {
    const svg = byId("rain-chart");
    svg.replaceChildren();
    const values = weather?.hourlyRain;
    byId("rain-chart-container").hidden = !values;
    byId("rain-caption").textContent = values
      ? `${weather.location} · ${weather.rain} mm total forecast rain · weather model time ${weather.modelTime} local.`
      : "Fetch current weather on the Recommendation tab to show the hourly forecast here.";
    if (!values) return;
    const left = 40, bottom = 164, width = 505;
    const scale = Math.max(1, Math.ceil(Math.max(...values) * 2) / 2);
    for (const value of [0, scale / 2, scale]) {
      const y = bottom - value / scale * 130;
      svg.append(makeSvg("line", { x1: left, y1: y, x2: left + width, y2: y, class: "chart-grid" }));
      svg.append(makeSvg("text", { x: 33, y: y + 4, "text-anchor": "end", class: "chart-axis" }, `${+value.toFixed(1)}`));
    }
    values.forEach((value, index) => {
      const x = left + index * width / 24 + 3;
      const bar = makeSvg("rect", { x, y: bottom - value / scale * 130, width: width / 24 - 6, height: Math.max(1, value / scale * 130), class: "rain-bar" });
      bar.append(makeSvg("title", {}, `Hour ${index + 1}: ${value} mm forecast rain`));
      svg.append(bar);
    });
    for (const hour of [0, 6, 12, 18, 24]) {
      svg.append(makeSvg("text", { x: left + hour * width / 24, y: 188, "text-anchor": "middle", class: "chart-axis" }, `+${hour} h`));
    }
  }

  function renderMonitor() {
    const plot = byId("monitor-plot").value;
    const conditions = state.plots[plot];
    const weather = state.weatherByPlot[plot];
    const current = predict(conditions);
    const isSample = state.historyMode === "sample";
    const records = isSample ? sampleHistory(plot) : state.history.filter(entry => entry.conditions.plot === plot);
    byId("monitor-moisture").textContent = `${conditions.moisture}%`;
    byId("monitor-weather").textContent = weather ? "Forecast fetched" : "Manual / sample";
    byId("monitor-weather-time").textContent = weather ? `${weather.location} · ${weather.modelTime} local` : "Fetch current weather to update";
    byId("monitor-urgency").textContent = current.urgency;
    byId("monitor-recommendation-time").textContent = "From current plot inputs";
    byId("history-title").textContent = isSample ? "Illustrative history" : "Recorded history";
    byId("history-key").textContent = isSample ? "Classroom examples" : "Entered readings";
    byId("history-caption").textContent = isSample
      ? "These four past points are invented classroom examples, shown only to demonstrate the chart. They are not sensor measurements."
      : "Each point was saved when Generate recommendation was pressed with entered values on this browser.";
    for (const button of document.querySelectorAll(".mode-btn")) {
      const active = button.dataset.mode === state.historyMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    renderMoistureChart(records, isSample);
    renderRainChart(weather);
    const events = byId("history-events");
    events.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Enter a plot reading and click Generate recommendation to add the first recorded point.";
      events.append(empty);
    }
    for (const entry of records.slice(-5).reverse()) {
      const item = document.createElement("div");
      item.className = "history-event";
      const label = document.createElement("span");
      label.textContent = `${new Date(entry.time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${entry.conditions.moisture}% · ${entry.source}`;
      const badge = document.createElement("b");
      badge.className = `row-status ${entry.urgency.toLowerCase()}`;
      badge.textContent = entry.urgency;
      item.append(label, badge);
      events.append(item);
    }
  }

  function renderTree() {
    const result = state.current;
    const svg = byId("decision-tree");
    const { positions, width, height } = treeLayout();
    state.treeWidth = width;
    state.treeHeight = height;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();
    byId("tree-count").textContent = MODEL.trainingExamples;
    byId("tree-plot").textContent = result.conditions.plot;
    const badge = byId("tree-outcome");
    badge.className = `status-pill ${result.urgency.toLowerCase()}`;
    badge.textContent = result.urgency;

    const steps = byId("tree-steps");
    steps.replaceChildren();
    for (const decision of result.decisions) {
      const item = document.createElement("li");
      item.textContent = describeDecision(decision);
      steps.append(item);
    }
    const outcome = document.createElement("li");
    outcome.innerHTML = `<strong>Outcome: ${result.urgency}</strong>`;
    steps.append(outcome);

    const activeNodes = new Set(result.path);
    for (const node of MODEL.nodes) {
      if (node.feature === null) continue;
      const origin = positions[node.id];
      for (const [childId, answer] of [[node.left, "Yes"], [node.right, "No"]]) {
        const target = positions[childId];
        const active = activeNodes.has(node.id) && activeNodes.has(childId);
        svg.append(makeSvg("line", {
          x1: origin.x, y1: origin.y + 37, x2: target.x, y2: target.y - 37,
          class: `tree-line${active ? " active" : ""}`
        }));
        svg.append(makeSvg("text", {
          x: origin.x + (target.x - origin.x) * 0.28,
          y: origin.y + (target.y - origin.y) * 0.28,
          class: `tree-edge-label${active ? " active" : ""}`,
          "text-anchor": "middle"
        }, answer));
      }
    }

    for (const node of MODEL.nodes) {
      const point = positions[node.id];
      const leaf = node.feature === null;
      const group = makeSvg("g", {
        class: `tree-node${leaf ? ` ${node.prediction.toLowerCase()}` : ""}${activeNodes.has(node.id) ? " active" : ""}`
      });
      group.append(makeSvg("rect", { x: point.x - 90, y: point.y - 36, width: 180, height: 72 }));
      group.append(makeSvg("text", { x: point.x, y: point.y - 7, class: "tree-title" },
        leaf ? node.prediction.toUpperCase() : FEATURE_NAMES[node.feature]));
      group.append(makeSvg("text", { x: point.x, y: point.y + 17, class: "tree-detail" },
        leaf ? `${node.samples} examples` : `≤ ${node.threshold}${UNITS[node.feature]} ?`));
      svg.append(group);
    }
    applyZoom();
  }

  function applyZoom() {
    const svg = byId("decision-tree");
    svg.style.width = `${state.treeWidth * state.zoom}px`;
    svg.style.height = `${state.treeHeight * state.zoom}px`;
  }

  function generate(event) {
    if (event) event.preventDefault();
    try {
      const result = predict(readForm());
      byId("input-error").hidden = true;
      byId("edit-status").hidden = true;
      state.plots[result.conditions.plot] = result.conditions;
      state.weatherByPlot[result.conditions.plot] = state.pendingWeather;
      state.current = result;
      renderResult(result);
      renderDashboard();
      renderTree();
      if (event) {
        state.history.push(makeHistoryEntry(result, new Date(), state.pendingWeather ? "Fetched weather + entered soil" : "Entered values"));
        state.history = state.history.slice(-60);
        state.historyMode = "recorded";
        try {
          if (!browserStorage) throw new Error("Storage unavailable");
          browserStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
          byId("history-storage").textContent = "Recorded history is saved in this browser.";
        } catch {
          byId("history-storage").textContent = "This browser cannot save history; points will last until the page closes.";
        }
      }
      renderMonitor();
      return result;
    } catch (error) {
      byId("input-error").textContent = error.message;
      byId("input-error").hidden = false;
      return null;
    }
  }

  form.addEventListener("submit", generate);
  function markValuesChanged(event) {
    if (["temperature", "rain"].includes(event?.target?.id)) state.pendingWeather = null;
    for (const button of document.querySelectorAll(".sample-btn")) button.classList.remove("active");
    byId("edit-status").hidden = false;
  }
  for (const key of ["moisture", "temperature", "rain"]) {
    byId(key).addEventListener("input", markValuesChanged);
  }
  byId("stage").addEventListener("change", markValuesChanged);
  byId("fetch-weather").addEventListener("click", async () => {
    const button = byId("fetch-weather");
    const status = byId("weather-status");
    button.disabled = true;
    status.classList.remove("weather-error");
    status.textContent = "Looking up current model weather and the next 24 hours of rain…";
    try {
      const weather = await fetchWeatherForCity(byId("weather-city").value);
      byId("temperature").value = weather.temperature;
      byId("rain").value = weather.rain;
      markValuesChanged();
      state.pendingWeather = weather;
      status.textContent = `${weather.location}: ${weather.temperature} °C, ${weather.rain} mm forecast rain in the next 24 h. Weather model time ${weather.modelTime} local. Enter the plot's measured soil moisture, then Generate.`;
    } catch (error) {
      status.classList.add("weather-error");
      status.textContent = error.message || "Weather unavailable. Enter the values manually.";
    } finally {
      button.disabled = false;
    }
  });
  byId("plot").addEventListener("change", event => {
    loadPlot(event.target.value);
    generate();
  });
  for (const button of document.querySelectorAll(".sample-btn")) {
    button.addEventListener("click", () => {
      loadPlot(button.dataset.plot, true);
      generate();
    });
  }
  for (const tab of document.querySelectorAll(".tab")) tab.addEventListener("click", () => showTab(tab.dataset.tab));
  byId("monitor-plot").addEventListener("change", renderMonitor);
  for (const button of document.querySelectorAll(".mode-btn")) button.addEventListener("click", () => {
    state.historyMode = button.dataset.mode;
    renderMonitor();
  });
  byId("record-reading").addEventListener("click", () => {
    loadPlot(byId("monitor-plot").value);
    generate();
    showTab("advisor");
    byId("moisture").focus();
  });
  byId("open-tree").addEventListener("click", () => showTab("tree"));
  byId("zoom-in").addEventListener("click", () => { state.zoom = Math.min(1.5, state.zoom + 0.15); applyZoom(); });
  byId("zoom-out").addEventListener("click", () => { state.zoom = Math.max(0.45, state.zoom - 0.15); applyZoom(); });
  byId("zoom-reset").addEventListener("click", () => {
    state.zoom = Math.max(0.45, Math.min(1, byId("tree-viewport").clientWidth / state.treeWidth));
    applyZoom();
  });

  loadPlot("Plot A");
  generate();
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", initApp);
if (typeof module !== "undefined") module.exports = { SAMPLE_PLOTS, MODEL, validateConditions, predict, treeLayout, describeDecision, parseWeatherForecast, fetchWeatherForCity, sampleHistory, loadHistory, makeHistoryEntry, HISTORY_KEY };
