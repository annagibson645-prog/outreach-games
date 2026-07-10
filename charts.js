/**
 * Outreach Games — shared interactive chart engine.
 * Renders structure + behavior only (SVG geometry, hover/tooltip logic,
 * animation). Every visual property (color, font, radius, shadow) is left
 * to each variant's own CSS via the oc-* class names below, so every
 * aesthetic keeps full control of how its charts actually look.
 *
 *   .oc-chart-container   wrapper (position:relative, set a height)
 *   .oc-linechart          the <svg> element
 *   .oc-grid-line          horizontal guide lines
 *   .oc-area               area fill under the line
 *   .oc-line-path          the line itself
 *   .oc-dot                small always-visible point markers
 *   .oc-dot-hit / .oc-dot-miss   added to .oc-dot when a point carries hit:true/false
 *   .oc-dot-active         the larger marker that follows the cursor
 *   .oc-crosshair          vertical guide line that follows the cursor
 *   .oc-axis-label         x-axis text labels
 *   .oc-reference-line / .oc-reference-label   optional horizontal goal line (pass opts.referenceValue)
 *   .oc-tooltip            floating tooltip box (position:absolute)
 *   .oc-tooltip-label / .oc-tooltip-value   text rows inside the tooltip
 *
 *   .oc-funnel             funnel wrapper
 *   .oc-funnel-row         one stage row
 *   .oc-funnel-label       stage name
 *   .oc-funnel-track       track background
 *   .oc-funnel-bar         filled bar (width animates in)
 *   .oc-funnel-count       raw count on the right
 *   .oc-funnel-rate        conversion % chip between rows
 */
(function (global) {
  "use strict";

  var reduceMotion = false;
  try { reduceMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function el(ns, tag, attrs) {
    var e = document.createElementNS(ns, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  var SVG_NS = "http://www.w3.org/2000/svg";

  function defaultFormat(v) { return Math.round(v).toLocaleString(); }

  function lineChart(container, points, opts) {
    opts = opts || {};
    var format = opts.format || defaultFormat;
    var W = 640, H = opts.height || 220;
    var pad = { top: 18, right: 14, bottom: 26, left: 14 };
    var innerW = W - pad.left - pad.right;
    var innerH = H - pad.top - pad.bottom;

    container.innerHTML = "";
    container.classList.add("oc-chart-container");

    if (!points || !points.length) {
      var empty = document.createElement("div");
      empty.className = "oc-empty";
      empty.textContent = opts.emptyText || "No data yet.";
      container.appendChild(empty);
      return;
    }

    var values = points.map(function (p) { return p.value; });
    var max = Math.max.apply(null, values.concat([opts.minMax || 0])) || 1;
    var min = 0;
    var n = points.length;
    var stepX = n > 1 ? innerW / (n - 1) : 0;

    function x(i) { return pad.left + i * stepX; }
    function y(v) { return pad.top + innerH - ((v - min) / (max - min || 1)) * innerH; }

    var svg = el(SVG_NS, "svg", {
      class: "oc-linechart",
      viewBox: "0 0 " + W + " " + H,
      preserveAspectRatio: "none",
      width: "100%",
      height: "100%",
      role: "img",
      "aria-label": opts.ariaLabel || "Trend chart"
    });

    // grid guide lines (25/50/75%)
    [0.25, 0.5, 0.75].forEach(function (f) {
      var gy = pad.top + innerH * f;
      svg.appendChild(el(SVG_NS, "line", { class: "oc-grid-line", x1: pad.left, x2: W - pad.right, y1: gy, y2: gy }));
    });

    // optional horizontal reference line (e.g. a daily goal threshold)
    if (opts.referenceValue != null && opts.referenceValue > 0) {
      var ry = y(opts.referenceValue);
      svg.appendChild(el(SVG_NS, "line", { class: "oc-reference-line", x1: pad.left, x2: W - pad.right, y1: ry, y2: ry }));
      var rt = el(SVG_NS, "text", { class: "oc-reference-label", x: W - pad.right, y: ry - 4, "text-anchor": "end" });
      rt.textContent = opts.referenceLabel || format(opts.referenceValue);
      svg.appendChild(rt);
    }

    // smooth path via midpoint cubic bezier
    var coords = points.map(function (p, i) { return [x(i), y(p.value)]; });
    var d = "M" + coords[0][0] + "," + coords[0][1];
    for (var i = 1; i < coords.length; i++) {
      var cx = (coords[i - 1][0] + coords[i][0]) / 2;
      d += " C " + cx + "," + coords[i - 1][1] + " " + cx + "," + coords[i][1] + " " + coords[i][0] + "," + coords[i][1];
    }
    var baseline = pad.top + innerH;
    var areaD = d + " L " + coords[n - 1][0] + "," + baseline + " L " + coords[0][0] + "," + baseline + " Z";

    var gradId = "oc-grad-" + Math.random().toString(36).slice(2, 9);
    var defs = el(SVG_NS, "defs");
    var grad = el(SVG_NS, "linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el(SVG_NS, "stop", { class: "oc-area-stop-top", offset: "0%" }));
    grad.appendChild(el(SVG_NS, "stop", { class: "oc-area-stop-bottom", offset: "100%" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var area = el(SVG_NS, "path", { class: "oc-area", d: areaD, fill: "url(#" + gradId + ")" });
    svg.appendChild(area);

    var linePath = el(SVG_NS, "path", { class: "oc-line-path", d: d, fill: "none" });
    svg.appendChild(linePath);

    points.forEach(function (p, i) {
      var cls = "oc-dot";
      if (p.hit === true) cls += " oc-dot-hit";
      else if (p.hit === false) cls += " oc-dot-miss";
      svg.appendChild(el(SVG_NS, "circle", { class: cls, cx: x(i), cy: y(p.value), r: 3.2 }));
    });

    // x-axis labels — thin out if too many points for the width
    var labelEvery = n > 10 ? 2 : 1;
    points.forEach(function (p, i) {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      var t = el(SVG_NS, "text", { class: "oc-axis-label", x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : (i === n - 1 ? "end" : "middle") });
      t.textContent = p.label;
      svg.appendChild(t);
    });

    var crosshair = el(SVG_NS, "line", { class: "oc-crosshair", x1: 0, x2: 0, y1: pad.top, y2: baseline, opacity: 0 });
    svg.appendChild(crosshair);
    var activeDot = el(SVG_NS, "circle", { class: "oc-dot-active", r: 5.5, opacity: 0 });
    svg.appendChild(activeDot);
    var hitLayer = el(SVG_NS, "rect", { class: "oc-hit-layer", x: pad.left, y: 0, width: innerW, height: H, fill: "transparent" });
    svg.appendChild(hitLayer);

    container.appendChild(svg);

    var tooltip = document.createElement("div");
    tooltip.className = "oc-tooltip";
    tooltip.innerHTML = '<div class="oc-tooltip-label"></div><div class="oc-tooltip-value"></div>';
    container.appendChild(tooltip);
    var ttLabel = tooltip.querySelector(".oc-tooltip-label");
    var ttValue = tooltip.querySelector(".oc-tooltip-value");

    function showAt(i) {
      var p = points[i];
      crosshair.setAttribute("x1", x(i)); crosshair.setAttribute("x2", x(i)); crosshair.setAttribute("opacity", 1);
      activeDot.setAttribute("cx", x(i)); activeDot.setAttribute("cy", y(p.value)); activeDot.setAttribute("opacity", 1);
      ttLabel.textContent = p.label;
      ttValue.textContent = format(p.value);
      var rect = container.getBoundingClientRect();
      var px = (x(i) / W) * rect.width;
      var py = (y(p.value) / H) * rect.height;
      tooltip.style.left = Math.max(6, Math.min(rect.width - 6, px)) + "px";
      tooltip.style.top = Math.max(0, py) + "px";
      tooltip.classList.add("visible");
      if (px > rect.width - 70) tooltip.classList.add("oc-tooltip-left"); else tooltip.classList.remove("oc-tooltip-left");
    }
    function hide() {
      crosshair.setAttribute("opacity", 0);
      activeDot.setAttribute("opacity", 0);
      tooltip.classList.remove("visible");
    }
    function nearestIndex(clientX) {
      var rect = svg.getBoundingClientRect();
      var scaleX = W / rect.width;
      var xs = (clientX - rect.left) * scaleX;
      var idx = Math.round((xs - pad.left) / (stepX || 1));
      return Math.max(0, Math.min(n - 1, idx));
    }
    hitLayer.addEventListener("pointermove", function (e) { showAt(nearestIndex(e.clientX)); });
    hitLayer.addEventListener("pointerdown", function (e) { showAt(nearestIndex(e.clientX)); });
    hitLayer.addEventListener("pointerleave", hide);
    // default to the last (most recent) point so the chart isn't inert on touch devices
    showAt(n - 1);

    if (!reduceMotion) {
      var len = linePath.getTotalLength();
      linePath.style.strokeDasharray = len;
      linePath.style.strokeDashoffset = len;
      area.style.opacity = 0;
      requestAnimationFrame(function () {
        linePath.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)";
        area.style.transition = "opacity .8s ease .3s";
        linePath.style.strokeDashoffset = 0;
        area.style.opacity = 1;
      });
    }

    return { svg: svg };
  }

  function funnel(container, stages, opts) {
    opts = opts || {};
    var format = opts.format || defaultFormat;
    container.innerHTML = "";
    container.classList.add("oc-funnel");
    var max = Math.max.apply(null, stages.map(function (s) { return s.count; })) || 1;

    stages.forEach(function (s, i) {
      if (i > 0) {
        var prev = stages[i - 1];
        var rate = prev.count > 0 ? Math.round((s.count / prev.count) * 100) : 0;
        var rateEl = document.createElement("div");
        rateEl.className = "oc-funnel-rate";
        rateEl.textContent = rate + "%";
        container.appendChild(rateEl);
      }
      var row = document.createElement("div");
      row.className = "oc-funnel-row";
      row.innerHTML =
        '<div class="oc-funnel-label">' + s.label + '</div>' +
        '<div class="oc-funnel-track"><div class="oc-funnel-bar" style="width:0%"></div></div>' +
        '<div class="oc-funnel-count">' + format(s.count) + '</div>';
      container.appendChild(row);
      var bar = row.querySelector(".oc-funnel-bar");
      var pct = Math.max(2, Math.round((s.count / max) * 100));
      row.addEventListener("pointerenter", function () { row.classList.add("active"); });
      row.addEventListener("pointerleave", function () { row.classList.remove("active"); });
      if (reduceMotion) { bar.style.width = pct + "%"; }
      else requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = pct + "%"; }); });
    });
  }

  function countUp(node, to, opts) {
    opts = opts || {};
    var format = opts.format || function (v) { return Math.round(v).toLocaleString(); };
    var from = opts.from != null ? opts.from : (parseFloat((node.textContent || "0").replace(/[^0-9.-]/g, "")) || 0);
    if (reduceMotion) { node.textContent = format(to); return; }
    var duration = opts.duration || 700;
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      node.textContent = format(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  global.OutreachCharts = { lineChart: lineChart, funnel: funnel, countUp: countUp };
})(window);
