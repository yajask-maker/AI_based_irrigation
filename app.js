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

const FEATURE_NAMES = {
  moisture: "Soil moisture",
  temperature: "Temperature",
  rain: "Forecast rain"
};

const UNITS = { moisture: "%", temperature: " °C", rain: " mm" };

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
  const state = {
    plots: Object.fromEntries(Object.entries(SAMPLE_PLOTS).map(([key, value]) => [key, { ...value }])),
    current: null,
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

  function loadPlot(name) {
    const plot = state.plots[name];
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
      state.plots[result.conditions.plot] = result.conditions;
      state.current = result;
      renderResult(result);
      renderDashboard();
      renderTree();
      return result;
    } catch (error) {
      byId("input-error").textContent = error.message;
      byId("input-error").hidden = false;
      return null;
    }
  }

  form.addEventListener("submit", generate);
  byId("plot").addEventListener("change", event => {
    loadPlot(event.target.value);
    generate();
  });
  for (const button of document.querySelectorAll(".sample-btn")) {
    button.addEventListener("click", () => {
      loadPlot(button.dataset.plot);
      generate();
    });
  }
  for (const tab of document.querySelectorAll(".tab")) tab.addEventListener("click", () => showTab(tab.dataset.tab));
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
if (typeof module !== "undefined") module.exports = { SAMPLE_PLOTS, MODEL, validateConditions, predict, treeLayout, describeDecision };
