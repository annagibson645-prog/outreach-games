/**
 * Outreach Games — data & scoring engine.
 * Owns all state (entries, settings, daily goal, badges, goals) and the
 * scoring/streak/badge/KPI math. index.html owns DOM/CSS only.
 */
(function (global) {
  "use strict";

  var ACTION_TYPES = [
    { key: "dm", label: "DM Sent", short: "DM", value: 5, icon: "✉" },
    { key: "followup", label: "Follow-Up", short: "Follow-up", value: 10, icon: "↻" },
    { key: "loom", label: "Loom Sent", short: "Loom", value: 20, icon: "▶" },
    { key: "call", label: "Sales Call", short: "Call", value: 50, icon: "☎" },
    { key: "client", label: "New Client", short: "Client", value: 500, icon: "★" },
    { key: "content", label: "Content Post", short: "Content", value: 15, icon: "✎" },
    { key: "comment", label: "Comment", short: "Comment", value: 3, icon: "✳" },
    { key: "revenue", label: "Real Revenue", short: "Revenue", value: 100, icon: "◆" }
  ];

  var BADGES = [
    { key: "first_blood", label: "First Blood", desc: "Log your very first action." },
    { key: "foot_in_door", label: "Foot in the Door", desc: "Log your first follow-up." },
    { key: "on_the_board", label: "On the Board", desc: "Log your first sales call." },
    { key: "closer", label: "Closer", desc: "Log your first new client." },
    { key: "consistency_streak", label: "Consistency Streak", desc: "Log something 7 days in a row." },
    { key: "century_club", label: "Century Club", desc: "Reach 1,000 lifetime points." },
    { key: "creator", label: "Creator", desc: "Log 10 content posts." },
    { key: "big_week", label: "Big Week", desc: "Score 300+ points in a single week." }
  ];

  var FUNNEL_STAGES = ["dm", "loom", "call", "client"];

  var DAY = 24 * 60 * 60 * 1000;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function toISODate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function startOfWeek(d) {
    var x = startOfDay(d);
    var dow = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - dow);
    return x;
  }

  function startOfMonth(d) {
    var x = startOfDay(d);
    x.setDate(1);
    return x;
  }

  function startOfQuarter(d) {
    var x = startOfMonth(d);
    var q = Math.floor(x.getMonth() / 3) * 3;
    x.setMonth(q);
    return x;
  }

  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

  // Deterministic PRNG so demo history looks identical across every variant.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function uid() {
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function actionByKey(key) {
    for (var i = 0; i < ACTION_TYPES.length; i++) if (ACTION_TYPES[i].key === key) return ACTION_TYPES[i];
    return null;
  }

  function seedDemoData(namespace) {
    var rand = mulberry32(1337 + hashString(namespace));
    var entries = [];
    var today = startOfDay(new Date());
    var start = addDays(today, -74); // ~10.5 weeks of history
    var contacts = ["Jordan P.", "Marisol T.", "Devon K.", "Priya S.", "Callum R.", "Naomi W.", "Theo B.", "Sasha L.", "Imani C.", "Rafael G."];
    var weights = { dm: 10, followup: 6, comment: 5, content: 2, loom: 3, call: 2, client: 0.15, revenue: 0.2 };
    var keys = Object.keys(weights);

    var day = start;
    var contentCount = 0;
    while (day.getTime() <= today.getTime()) {
      var isWeekend = day.getDay() === 0 || day.getDay() === 6;
      // Skip a handful of days to leave realistic gaps, but keep the last 4 days
      // logged so every variant opens on an active streak.
      var daysAgo = Math.round((today - day) / DAY);
      var skip = daysAgo > 3 && rand() < (isWeekend ? 0.55 : 0.18);
      if (!skip) {
        var count = isWeekend ? Math.floor(rand() * 3) : 1 + Math.floor(rand() * 5);
        for (var i = 0; i < count; i++) {
          var roll = rand() * keys.reduce(function (s, k) { return s + weights[k]; }, 0);
          var acc = 0, chosen = keys[0];
          for (var k = 0; k < keys.length; k++) {
            acc += weights[keys[k]];
            if (roll <= acc) { chosen = keys[k]; break; }
          }
          if (chosen === "content") contentCount++;
          // Cap content early so the "Creator" badge (10 posts) stays a near-miss.
          if (chosen === "content" && contentCount > 8 && daysAgo > 2) continue;
          var action = actionByKey(chosen);
          var ts = new Date(day.getTime() + (9 + rand() * 9) * 60 * 60 * 1000);
          entries.push({
            id: uid(),
            created_at: ts.toISOString(),
            edited_at: null,
            action_type: chosen,
            contact: chosen === "content" || chosen === "comment" ? "" : contacts[Math.floor(rand() * contacts.length)],
            note: "",
            virtual_value: action.value,
            real_revenue_amount: chosen === "revenue" ? Math.round((150 + rand() * 850)) : null,
            deleted_at: null
          });
        }
      }
      day = addDays(day, 1);
    }
    entries.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    return entries;
  }

  function hashString(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
    return h;
  }

  function defaultSettings() {
    var s = {};
    ACTION_TYPES.forEach(function (a) { s[a.key] = a.value; });
    return s;
  }

  function OutreachCore(namespace, opts) {
    opts = opts || {};
    var storageKey = "outreach:" + namespace;
    var sessionKey = "outreach:unlocked:" + namespace;
    var listeners = [];
    var state = null;

    function load() {
      var raw;
      try { raw = global.localStorage.getItem(storageKey); } catch (e) { raw = null; }
      if (raw) {
        try { state = JSON.parse(raw); } catch (e) { state = null; }
      }
      if (!state) {
        state = {
          pin: opts.defaultPin || "1234",
          settings: defaultSettings(),
          dailyGoal: opts.defaultDailyGoal != null ? opts.defaultDailyGoal : 10,
          entries: seedDemoData(namespace),
          badges: {},
          goals: [
            { id: uid(), period: "monthly", target_metric: "dm", target_value: 80, created_at: new Date().toISOString() },
            { id: uid(), period: "monthly", target_metric: "call", target_value: 10, created_at: new Date().toISOString() }
          ]
        };
        recomputeBadges(state);
        persist();
      } else {
        // backfill defaults for older saved states
        if (!state.settings) state.settings = defaultSettings();
        if (!state.badges) state.badges = {};
        if (!state.goals) state.goals = [];
        if (!state.pin) state.pin = opts.defaultPin || "1234";
        if (state.dailyGoal == null) state.dailyGoal = opts.defaultDailyGoal != null ? opts.defaultDailyGoal : 10;
      }
    }

    function persist() {
      try { global.localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* ignore quota errors in prototype */ }
      listeners.forEach(function (fn) { fn(state); });
    }

    function activeEntries() {
      return state.entries.filter(function (e) { return !e.deleted_at; });
    }

    function dayTotal(date) {
      var s = startOfDay(date);
      return pointsInRange(s, addDays(s, 1));
    }

    function isHitDay(date) {
      var goal = state.dailyGoal || 0;
      var total = dayTotal(date);
      return goal > 0 ? total >= goal : total > 0;
    }

    function getDailyGoal() { return state.dailyGoal || 0; }
    function setDailyGoal(v) { state.dailyGoal = Math.max(0, Number(v) || 0); persist(); }

    function dailyHistory(days) {
      var out = [];
      var today = startOfDay(new Date());
      for (var i = days - 1; i >= 0; i--) {
        var d = addDays(today, -i);
        out.push({ date: d, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), total: dayTotal(d), hit: isHitDay(d) });
      }
      return out;
    }

    function lifetimePoints() {
      return activeEntries().reduce(function (sum, e) { return sum + e.virtual_value; }, 0);
    }

    function pointsInRange(fromDate, toDate) {
      var from = fromDate.getTime(), to = toDate.getTime();
      return activeEntries()
        .filter(function (e) { var t = new Date(e.created_at).getTime(); return t >= from && t < to; })
        .reduce(function (sum, e) { return sum + e.virtual_value; }, 0);
    }

    function countByTypeInRange(fromDate, toDate) {
      var from = fromDate.getTime(), to = toDate.getTime();
      var out = {};
      ACTION_TYPES.forEach(function (a) { out[a.key] = 0; });
      activeEntries().forEach(function (e) {
        var t = new Date(e.created_at).getTime();
        if (t >= from && t < to) out[e.action_type] = (out[e.action_type] || 0) + 1;
      });
      return out;
    }

    function computeStreak() {
      var streak = 0;
      var cursor = startOfDay(new Date());
      // if today hasn't hit the goal yet, streak still counts through yesterday
      if (!isHitDay(cursor)) cursor = addDays(cursor, -1);
      while (isHitDay(cursor)) {
        streak++;
        cursor = addDays(cursor, -1);
      }
      return streak;
    }

    function weeklyTrend(weeks) {
      var out = [];
      var cursor = startOfWeek(new Date());
      for (var i = weeks - 1; i >= 0; i--) {
        var ws = addDays(cursor, -7 * i);
        var we = addDays(ws, 7);
        out.push({ label: toISODate(ws), start: ws, total: pointsInRange(ws, we) });
      }
      return out;
    }

    function monthlyTrend(months) {
      var out = [];
      var cursor = startOfMonth(new Date());
      for (var i = months - 1; i >= 0; i--) {
        var ms = addMonths(cursor, -i);
        var me = addMonths(ms, 1);
        out.push({ label: ms.toLocaleString(undefined, { month: "short" }), start: ms, total: pointsInRange(ms, me) });
      }
      return out;
    }

    function quarterlyTrend(quarters) {
      var out = [];
      var cursor = startOfQuarter(new Date());
      for (var i = quarters - 1; i >= 0; i--) {
        var qs = addMonths(cursor, -3 * i);
        var qe = addMonths(qs, 3);
        out.push({ label: "Q" + (Math.floor(qs.getMonth() / 3) + 1) + " " + qs.getFullYear(), start: qs, total: pointsInRange(qs, qe) });
      }
      return out;
    }

    function funnel() {
      var counts = {};
      FUNNEL_STAGES.forEach(function (k) { counts[k] = 0; });
      activeEntries().forEach(function (e) { if (counts.hasOwnProperty(e.action_type)) counts[e.action_type]++; });
      function rate(a, b) { return counts[a] > 0 ? Math.round((counts[b] / counts[a]) * 100) : 0; }
      return {
        counts: counts,
        dmToLoom: rate("dm", "loom"),
        loomToCall: rate("loom", "call"),
        callToClose: rate("call", "client")
      };
    }

    function computeKPIs() {
      var now = new Date();
      var ws = startOfWeek(now), we = addDays(ws, 7);
      return {
        thisWeekTotal: pointsInRange(ws, we),
        thisWeekByType: countByTypeInRange(ws, we),
        weeklyTrend: weeklyTrend(8),
        monthlyTrend: monthlyTrend(6),
        quarterlyTrend: quarterlyTrend(4),
        dailyTrend: dailyHistory(14),
        funnel: funnel(),
        lifetimePoints: lifetimePoints(),
        streak: computeStreak(),
        dailyGoal: getDailyGoal(),
        todayTotal: dayTotal(now),
        todayHit: isHitDay(now)
      };
    }

    function recomputeBadges(s) {
      var entries = s.entries.filter(function (e) { return !e.deleted_at; });
      var byType = {};
      entries.forEach(function (e) { byType[e.action_type] = (byType[e.action_type] || 0) + 1; });
      var totalPoints = entries.reduce(function (sum, e) { return sum + e.virtual_value; }, 0);

      var checks = {
        first_blood: entries.length >= 1,
        foot_in_door: (byType.followup || 0) >= 1,
        on_the_board: (byType.call || 0) >= 1,
        closer: (byType.client || 0) >= 1,
        creator: (byType.content || 0) >= 10,
        century_club: totalPoints >= 1000
      };

      // Consistency streak: does the history contain any 7-day run of hit days?
      var dayTotals = {};
      entries.forEach(function (e) {
        var k = toISODate(new Date(e.created_at));
        dayTotals[k] = (dayTotals[k] || 0) + e.virtual_value;
      });
      var goal = s.dailyGoal || 0;
      var hitDays = Object.keys(dayTotals).filter(function (k) {
        return goal > 0 ? dayTotals[k] >= goal : dayTotals[k] > 0;
      }).sort();
      var best = 0, run = 0, prev = null;
      hitDays.forEach(function (d) {
        if (prev !== null && (new Date(d) - new Date(prev)) === DAY) run++; else run = 1;
        best = Math.max(best, run);
        prev = d;
      });
      checks.consistency_streak = best >= 7;

      // Big week: any calendar week with >=300 points
      var weekTotals = {};
      entries.forEach(function (e) {
        var wk = toISODate(startOfWeek(new Date(e.created_at)));
        weekTotals[wk] = (weekTotals[wk] || 0) + e.virtual_value;
      });
      checks.big_week = Object.keys(weekTotals).some(function (w) { return weekTotals[w] >= 300; });

      var nowIso = new Date().toISOString();
      var newlyUnlocked = [];
      BADGES.forEach(function (b) {
        if (checks[b.key] && !s.badges[b.key]) {
          s.badges[b.key] = nowIso;
          newlyUnlocked.push(b.key);
        }
      });
      return newlyUnlocked;
    }

    function listBadges() {
      return BADGES.map(function (b) {
        return {
          key: b.key,
          label: b.label,
          desc: b.desc,
          unlocked: !!state.badges[b.key],
          unlockedAt: state.badges[b.key] || null
        };
      });
    }

    function addEntry(input) {
      var action = actionByKey(input.action_type);
      if (!action) throw new Error("Unknown action_type: " + input.action_type);
      var entry = {
        id: uid(),
        created_at: new Date().toISOString(),
        edited_at: null,
        action_type: input.action_type,
        contact: input.contact || "",
        note: input.note || "",
        virtual_value: state.settings[input.action_type] != null ? state.settings[input.action_type] : action.value,
        real_revenue_amount: input.real_revenue_amount != null ? Number(input.real_revenue_amount) : null,
        deleted_at: null
      };
      state.entries.push(entry);
      var newBadges = recomputeBadges(state);
      persist();
      return { entry: entry, newBadges: newBadges };
    }

    function editEntry(id, patch) {
      var e = state.entries.find(function (x) { return x.id === id; });
      if (!e) return null;
      ["contact", "note", "action_type", "real_revenue_amount"].forEach(function (k) {
        if (patch.hasOwnProperty(k)) e[k] = patch[k];
      });
      if (patch.action_type) {
        var a = actionByKey(patch.action_type);
        e.virtual_value = state.settings[patch.action_type] != null ? state.settings[patch.action_type] : (a ? a.value : e.virtual_value);
      }
      if (patch.hasOwnProperty("virtual_value")) e.virtual_value = Number(patch.virtual_value);
      e.edited_at = new Date().toISOString();
      recomputeBadges(state);
      persist();
      return e;
    }

    function deleteEntry(id) {
      var e = state.entries.find(function (x) { return x.id === id; });
      if (!e) return null;
      e.deleted_at = new Date().toISOString();
      recomputeBadges(state);
      persist();
      return e;
    }

    function restoreEntry(id) {
      var e = state.entries.find(function (x) { return x.id === id; });
      if (!e) return null;
      e.deleted_at = null;
      recomputeBadges(state);
      persist();
      return e;
    }

    function listEntries(opts) {
      opts = opts || {};
      var list = opts.includeDeleted ? state.entries.slice() : activeEntries();
      list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return list;
    }

    function addGoal(g) {
      var goal = {
        id: uid(),
        period: g.period || "monthly",
        target_metric: g.target_metric,
        target_value: Number(g.target_value),
        created_at: new Date().toISOString()
      };
      state.goals.push(goal);
      persist();
      return goal;
    }

    function deleteGoal(id) {
      state.goals = state.goals.filter(function (g) { return g.id !== id; });
      persist();
    }

    function goalRange(goal) {
      var now = new Date();
      if (goal.period === "weekly") { var ws = startOfWeek(now); return [ws, addDays(ws, 7)]; }
      if (goal.period === "quarterly") { var qs = startOfQuarter(now); return [qs, addMonths(qs, 3)]; }
      var ms = startOfMonth(now); return [ms, addMonths(ms, 1)];
    }

    function goalProgress(goal) {
      var range = goalRange(goal);
      var current;
      if (goal.target_metric === "points") {
        current = pointsInRange(range[0], range[1]);
      } else {
        current = countByTypeInRange(range[0], range[1])[goal.target_metric] || 0;
      }
      var pct = goal.target_value > 0 ? Math.min(100, Math.round((current / goal.target_value) * 100)) : 0;
      return { current: current, target: goal.target_value, pct: pct, rangeStart: range[0], rangeEnd: range[1] };
    }

    function hasPin() { return !!state.pin; }
    function verifyPin(pin) { return String(pin) === String(state.pin); }
    function setPin(pin) { state.pin = String(pin); persist(); }
    function isUnlockedThisSession() {
      try { return global.sessionStorage.getItem(sessionKey) === "1"; } catch (e) { return false; }
    }
    function markUnlocked() {
      try { global.sessionStorage.setItem(sessionKey, "1"); } catch (e) { /* ignore */ }
    }
    function lockSession() {
      try { global.sessionStorage.removeItem(sessionKey); } catch (e) { /* ignore */ }
    }

    function resetDemoData() {
      state.entries = seedDemoData(namespace);
      state.badges = {};
      recomputeBadges(state);
      persist();
    }

    function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; }

    load();

    return {
      ACTION_TYPES: ACTION_TYPES,
      BADGES: BADGES,
      actionByKey: actionByKey,
      getState: function () { return state; },
      addEntry: addEntry,
      editEntry: editEntry,
      deleteEntry: deleteEntry,
      restoreEntry: restoreEntry,
      listEntries: listEntries,
      computeKPIs: computeKPIs,
      listBadges: listBadges,
      addGoal: addGoal,
      deleteGoal: deleteGoal,
      goalProgress: goalProgress,
      lifetimePoints: lifetimePoints,
      computeStreak: computeStreak,
      getDailyGoal: getDailyGoal,
      setDailyGoal: setDailyGoal,
      dayTotal: dayTotal,
      isHitDay: isHitDay,
      dailyHistory: dailyHistory,
      hasPin: hasPin,
      verifyPin: verifyPin,
      setPin: setPin,
      isUnlockedThisSession: isUnlockedThisSession,
      markUnlocked: markUnlocked,
      lockSession: lockSession,
      resetDemoData: resetDemoData,
      subscribe: subscribe
    };
  }

  global.OutreachCore = OutreachCore;
})(window);
