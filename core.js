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

  // Tiers are graded like ski trails: easy (green circle) usually falls
  // within a first week of real use, medium (blue square) takes weeks to a
  // couple of months of consistent effort, hard (black diamond) takes
  // months of genuinely sustained work. Every test() reads only from the
  // precomputed metrics object `m` (see computeBadgeMetrics) so this list
  // stays pure data-plus-a-one-liner, however large it grows.
  var BADGE_DEFS = [
    // ---- EASY ----
    { key: "first_contact", tier: "easy", category: "Milestone", label: "First Contact", desc: "Log your first DM.", test: function (m) { return m.counts.dm >= 1; } },
    { key: "foot_in_door", tier: "easy", category: "Milestone", label: "Foot in the Door", desc: "Log your first follow-up.", test: function (m) { return m.counts.followup >= 1; } },
    { key: "lights_camera", tier: "easy", category: "Milestone", label: "Lights, Camera", desc: "Send your first Loom.", test: function (m) { return m.counts.loom >= 1; } },
    { key: "dial_tone", tier: "easy", category: "Milestone", label: "Dial Tone", desc: "Log your first sales call.", test: function (m) { return m.counts.call >= 1; } },
    { key: "first_blood", tier: "easy", category: "Milestone", label: "First Blood", desc: "Close your first client.", test: function (m) { return m.counts.client >= 1; } },
    { key: "publisher", tier: "easy", category: "Milestone", label: "Publisher", desc: "Post your first piece of content.", test: function (m) { return m.counts.content >= 1; } },
    { key: "joined_chat", tier: "easy", category: "Milestone", label: "Joined the Chat", desc: "Log your first comment.", test: function (m) { return m.counts.comment >= 1; } },
    { key: "first_dollar", tier: "easy", category: "Milestone", label: "First Dollar", desc: "Log your first revenue entry.", test: function (m) { return m.counts.revenue >= 1; } },
    { key: "welcome_pipeline", tier: "easy", category: "Pipeline", label: "Welcome to the Pipeline", desc: "Add your first lead.", test: function (m) { return m.leadsAddedTotal >= 1; } },
    { key: "level_up", tier: "easy", category: "Pipeline", label: "Level Up", desc: "Move a lead forward a stage for the first time.", test: function (m) { return m.leadsAdvancedTotal >= 1; } },
    { key: "fresh_start", tier: "easy", category: "Pipeline", label: "Fresh Start", desc: "Archive your first lead.", test: function (m) { return m.leadsArchivedCount >= 1; } },
    { key: "they_noticed", tier: "easy", category: "Pipeline", label: "They Noticed", desc: "Get your first lead to respond.", test: function (m) { return m.leadsRespondedCount >= 1; } },
    { key: "quick_draw", tier: "easy", category: "Pipeline", label: "Quick Draw", desc: "Follow up within 24 hours of first contact.", test: function (m) { return m.hasQuickFollowUp24h; } },
    { key: "getting_started", tier: "easy", category: "Score", label: "Getting Started", desc: "Reach 100 lifetime points.", test: function (m) { return m.lifetimePoints >= 100; } },
    { key: "on_a_roll", tier: "easy", category: "Score", label: "On a Roll", desc: "Reach 500 lifetime points.", test: function (m) { return m.lifetimePoints >= 500; } },
    { key: "warming_up", tier: "easy", category: "Streak", label: "Warming Up", desc: "Hit your daily goal 3 days in a row.", test: function (m) { return m.bestStreakEver >= 3; } },
    { key: "bounce_back", tier: "easy", category: "Streak", label: "Bounce Back", desc: "Hit your goal the day after missing one.", test: function (m) { return m.hasBounceBack; } },
    { key: "weekend_warrior", tier: "easy", category: "Streak", label: "Weekend Warrior", desc: "Hit your goal both Saturday and Sunday.", test: function (m) { return m.hasWeekendBothDays; } },
    { key: "goal_getter", tier: "easy", category: "Streak", label: "Goal Getter", desc: "Hit your daily goal for the first time.", test: function (m) { return m.bestStreakEver >= 1; } },
    { key: "overachiever", tier: "easy", category: "Streak", label: "Overachiever", desc: "Double your daily goal in a single day.", test: function (m) { return m.doubleGoalDays >= 1; } },
    { key: "early_bird", tier: "easy", category: "Quirky", label: "Early Bird", desc: "Log an action before 8am.", test: function (m) { return m.early; } },
    { key: "night_owl", tier: "easy", category: "Quirky", label: "Night Owl", desc: "Log an action after 10pm.", test: function (m) { return m.night; } },
    { key: "midnight_oil", tier: "easy", category: "Quirky", label: "Midnight Oil", desc: "Log an action between midnight and 3am.", test: function (m) { return m.midnight; } },
    { key: "lucky_seven", tier: "easy", category: "Quirky", label: "Lucky Number Seven", desc: "Log exactly 7 actions in one day.", test: function (m) { return m.hasDayWithExactly7; } },
    { key: "coffee_break_closer", tier: "easy", category: "Quirky", label: "Coffee Break Closer", desc: "Log 3 actions within 15 minutes.", test: function (m) { return m.hasBurst3in15; } },
    { key: "friday_feeling", tier: "easy", category: "Quirky", label: "Friday Feeling", desc: "Log something on 5 different Fridays.", test: function (m) { return m.fridayCount >= 5; } },
    { key: "monday_motivation", tier: "easy", category: "Quirky", label: "Monday Motivation", desc: "Hit your goal on 3 different Mondays.", test: function (m) { return m.mondayGoalHitCount >= 3; } },
    { key: "solid_week", tier: "easy", category: "Volume", label: "Solid Week", desc: "Score 100 points in a single week.", test: function (m) { return m.bestWeek >= 100; } },
    { key: "jack_of_all_trades", tier: "easy", category: "Variety", label: "Jack of All Trades", desc: "Log every action type at least once.", test: function (m) { return m.typesLoggedCount >= 8; } },
    { key: "housekeeping", tier: "easy", category: "Hygiene", label: "Housekeeping", desc: "Edit a logged entry for the first time.", test: function (m) { return m.editedEntryCount >= 1; } },

    // ---- MEDIUM ----
    { key: "outreach_machine", tier: "medium", category: "Milestone", label: "Outreach Machine", desc: "Send 100 DMs.", test: function (m) { return m.counts.dm >= 100; } },
    { key: "persistent", tier: "medium", category: "Milestone", label: "Persistent", desc: "Send 100 follow-ups.", test: function (m) { return m.counts.followup >= 100; } },
    { key: "directors_cut", tier: "medium", category: "Milestone", label: "Director's Cut", desc: "Send 50 Looms.", test: function (m) { return m.counts.loom >= 50; } },
    { key: "on_the_line", tier: "medium", category: "Milestone", label: "On the Line", desc: "Log 50 sales calls.", test: function (m) { return m.counts.call >= 50; } },
    { key: "client_roster", tier: "medium", category: "Milestone", label: "Client Roster", desc: "Close 10 clients.", test: function (m) { return m.counts.client >= 10; } },
    { key: "content_machine", tier: "medium", category: "Milestone", label: "Content Machine", desc: "Post 50 pieces of content.", test: function (m) { return m.counts.content >= 50; } },
    { key: "community_voice", tier: "medium", category: "Milestone", label: "Community Voice", desc: "Log 100 comments.", test: function (m) { return m.counts.comment >= 100; } },
    { key: "first_grand", tier: "medium", category: "Revenue", label: "First Grand", desc: "Log $1,000 in revenue.", test: function (m) { return m.revenueTotal >= 1000; } },
    { key: "five_figures", tier: "medium", category: "Revenue", label: "Five Figures", desc: "Log $10,000 in revenue.", test: function (m) { return m.revenueTotal >= 10000; } },
    { key: "century_club", tier: "medium", category: "Score", label: "Century Club", desc: "Reach 1,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 1000; } },
    { key: "overachievers_club", tier: "medium", category: "Score", label: "Overachiever's Club", desc: "Reach 2,500 lifetime points.", test: function (m) { return m.lifetimePoints >= 2500; } },
    { key: "powerhouse", tier: "medium", category: "Score", label: "Powerhouse", desc: "Reach 5,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 5000; } },
    { key: "two_weeks_strong", tier: "medium", category: "Streak", label: "Two Weeks Strong", desc: "Hit a 14-day streak.", test: function (m) { return m.bestStreakEver >= 14; } },
    { key: "flawless_week", tier: "medium", category: "Streak", label: "Flawless Week", desc: "Hit your daily goal all 7 days of one week.", test: function (m) { return m.perfectWeek; } },
    { key: "double_trouble", tier: "medium", category: "Streak", label: "Double Trouble", desc: "Double your daily goal 5 times total.", test: function (m) { return m.doubleGoalDays >= 5; } },
    { key: "big_week", tier: "medium", category: "Volume", label: "Big Week", desc: "Score 300 points in a single week.", test: function (m) { return m.bestWeek >= 300; } },
    { key: "huge_month", tier: "medium", category: "Volume", label: "Huge Month", desc: "Score 1,000 points in a single month.", test: function (m) { return m.bestMonth >= 1000; } },
    { key: "triple_digit_day", tier: "medium", category: "Volume", label: "Triple Digit Day", desc: "Score 100+ points in a single day.", test: function (m) { return m.bestDay >= 100; } },
    { key: "half_the_battle", tier: "medium", category: "Funnel", label: "Half the Battle", desc: "Hit a 25% DM-to-Call rate (20+ DMs sent).", test: function (m) { return m.counts.dm >= 20 && m.dmToCallRate >= 0.25; } },
    { key: "the_closer", tier: "medium", category: "Pipeline", label: "The Closer", desc: "Move 3 leads to Client stage.", test: function (m) { return m.leadsClientEver >= 3; } },
    { key: "pipeline_builder", tier: "medium", category: "Pipeline", label: "Pipeline Builder", desc: "Manage 10 active leads at once.", test: function (m) { return m.maxActiveLeadCount >= 10; } },
    { key: "full_roster", tier: "medium", category: "Pipeline", label: "Full Roster", desc: "Manage 25 active leads at once.", test: function (m) { return m.maxActiveLeadCount >= 25; } },
    { key: "comeback_kid", tier: "medium", category: "Pipeline", label: "The Comeback Kid", desc: "A lead responds after 14+ days of silence.", test: function (m) { return m.hasComebackKid; } },
    { key: "master_follow_up", tier: "medium", category: "Pipeline", label: "Master of the Follow-Up", desc: "Log 50 follow-up touches across all leads.", test: function (m) { return m.leadFollowUpTouches >= 50; } },
    { key: "learned_moved_on", tier: "medium", category: "Pipeline", label: "Learned & Moved On", desc: "Archive 10 leads.", test: function (m) { return m.leadsArchivedCount >= 10; } },
    { key: "quick_turnaround", tier: "medium", category: "Pipeline", label: "Quick Turnaround", desc: "A lead responds within 1 day of first contact.", test: function (m) { return m.hasQuickTurnaround; } },
    { key: "ten_conversations", tier: "medium", category: "Pipeline", label: "Ten Conversations", desc: "10 leads have responded, total.", test: function (m) { return m.leadsRespondedCount >= 10; } },
    { key: "fast_track", tier: "medium", category: "Pipeline", label: "Fast Track", desc: "Move a lead from New to Client in under 14 days.", test: function (m) { return m.hasFastTrack14; } },
    { key: "renaissance_rep", tier: "medium", category: "Variety", label: "Renaissance Rep", desc: "Log 10 of every action type.", test: function (m) { return m.minCountAcrossTypes >= 10; } },
    { key: "grind_never_stops", tier: "medium", category: "Streak", label: "The Grind Never Stops", desc: "Log something every day for a full calendar month.", test: function (m) { return m.perfectMonthAnyActivity; } },
    { key: "new_year_new_pipeline", tier: "medium", category: "Quirky", label: "New Year, New Pipeline", desc: "Log an action on January 1st.", test: function (m) { return m.jan1; } },
    { key: "no_days_off_almost", tier: "medium", category: "Streak", label: "No Days Off (Almost)", desc: "Hit your goal 25 of 30 days.", test: function (m) { return m.goalHit25of30; } },
    { key: "badge_hunter", tier: "medium", category: "Meta", label: "Badge Hunter", desc: "Unlock 25 honors.", test: function (m) { return m.unlockedSoFar >= 25; } },
    { key: "clean_sweep", tier: "medium", category: "Pipeline", label: "Clean Sweep", desc: "Zero overdue leads while managing 5+ active leads.", test: function (m) { return m.zeroOverdueAt5; } },
    { key: "conversation_starter", tier: "medium", category: "Pipeline", label: "Conversation Starter", desc: "Add 20 leads to the pipeline, total.", test: function (m) { return m.leadsAddedTotal >= 20; } },
    { key: "steady_hand", tier: "medium", category: "Hygiene", label: "Steady Hand", desc: "Correct 10 logged entries over time.", test: function (m) { return m.editedEntryCount >= 10; } },

    // ---- HARD ----
    { key: "the_relentless", tier: "hard", category: "Milestone", label: "The Relentless", desc: "Send 1,000 DMs.", test: function (m) { return m.counts.dm >= 1000; } },
    { key: "never_give_up", tier: "hard", category: "Milestone", label: "Never Give Up", desc: "Send 500 follow-ups.", test: function (m) { return m.counts.followup >= 500; } },
    { key: "studio_legend", tier: "hard", category: "Milestone", label: "Studio Legend", desc: "Send 250 Looms.", test: function (m) { return m.counts.loom >= 250; } },
    { key: "cold_call_royalty", tier: "hard", category: "Milestone", label: "Cold Call Royalty", desc: "Log 250 sales calls.", test: function (m) { return m.counts.call >= 250; } },
    { key: "empire_builder", tier: "hard", category: "Milestone", label: "Empire Builder", desc: "Close 50 clients.", test: function (m) { return m.counts.client >= 50; } },
    { key: "thought_leader", tier: "hard", category: "Milestone", label: "Thought Leader", desc: "Post 200 pieces of content.", test: function (m) { return m.counts.content >= 200; } },
    { key: "comment_legend", tier: "hard", category: "Milestone", label: "Comment Legend", desc: "Log 500 comments.", test: function (m) { return m.counts.comment >= 500; } },
    { key: "six_figures", tier: "hard", category: "Revenue", label: "Six Figures", desc: "Log $100,000 in revenue.", test: function (m) { return m.revenueTotal >= 100000; } },
    { key: "made_it_rain", tier: "hard", category: "Revenue", label: "Made It Rain", desc: "Log $25,000 in revenue.", test: function (m) { return m.revenueTotal >= 25000; } },
    { key: "big_fish", tier: "hard", category: "Revenue", label: "Big Fish", desc: "Close a single client worth $10,000+.", test: function (m) { return m.maxSingleRevenue >= 10000; } },
    { key: "legend", tier: "hard", category: "Score", label: "Legend", desc: "Reach 10,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 10000; } },
    { key: "icon", tier: "hard", category: "Score", label: "Icon", desc: "Reach 25,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 25000; } },
    { key: "hall_of_fame", tier: "hard", category: "Score", label: "Hall of Fame", desc: "Reach 50,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 50000; } },
    { key: "outreach_deity", tier: "hard", category: "Score", label: "Outreach Deity", desc: "Reach 100,000 lifetime points.", test: function (m) { return m.lifetimePoints >= 100000; } },
    { key: "iron_will", tier: "hard", category: "Streak", label: "Iron Will", desc: "Hit a 30-day streak.", test: function (m) { return m.bestStreakEver >= 30; } },
    { key: "unstoppable", tier: "hard", category: "Streak", label: "Unstoppable", desc: "Hit a 60-day streak.", test: function (m) { return m.bestStreakEver >= 60; } },
    { key: "centurion_of_habit", tier: "hard", category: "Streak", label: "Centurion of Habit", desc: "Hit a 100-day streak.", test: function (m) { return m.bestStreakEver >= 100; } },
    { key: "flawless_month", tier: "hard", category: "Streak", label: "Flawless Month", desc: "Hit your daily goal every day of a calendar month.", test: function (m) { return m.perfectMonth; } },
    { key: "the_machine", tier: "hard", category: "Streak", label: "The Machine", desc: "Hit your goal 6 days a week for 8 straight weeks.", test: function (m) { return m.eightWeeksOk; } },
    { key: "monster_week", tier: "hard", category: "Volume", label: "Monster Week", desc: "Score 750 points in a single week.", test: function (m) { return m.bestWeek >= 750; } },
    { key: "record_month", tier: "hard", category: "Volume", label: "Record Month", desc: "Score 3,000 points in a single month.", test: function (m) { return m.bestMonth >= 3000; } },
    { key: "best_quarter_ever", tier: "hard", category: "Volume", label: "Best Quarter Ever", desc: "Score 7,500 points in a single quarter.", test: function (m) { return m.bestQuarter >= 7500; } },
    { key: "conversion_master", tier: "hard", category: "Funnel", label: "Conversion Master", desc: "Hit a 10% DM-to-Client rate (100+ DMs sent).", test: function (m) { return m.counts.dm >= 100 && m.dmToClientRate >= 0.10; } },
    { key: "serial_closer", tier: "hard", category: "Pipeline", label: "Serial Closer", desc: "Move 20 leads to Client stage.", test: function (m) { return m.leadsClientEver >= 20; } },
    { key: "nothing_falls_through", tier: "hard", category: "Pipeline", label: "Nothing Falls Through the Cracks", desc: "Zero overdue leads while managing 15+ active leads.", test: function (m) { return m.zeroOverdueAt15; } },
    { key: "magnetic", tier: "hard", category: "Pipeline", label: "Magnetic", desc: "50 leads have responded, total.", test: function (m) { return m.leadsRespondedCount >= 50; } },
    { key: "the_whisperer", tier: "hard", category: "Pipeline", label: "The Whisperer", desc: "Average under 3 days response time across 20+ responded leads.", test: function (m) { return m.respondedSampleCount >= 20 && m.avgResponseTime < 3; } },
    { key: "speed_closer", tier: "hard", category: "Pipeline", label: "Speed Closer", desc: "Move a lead from New to Client in under 5 days.", test: function (m) { return m.hasSpeedClose5; } },
    { key: "iron_pipeline", tier: "hard", category: "Pipeline", label: "Iron Pipeline", desc: "Manage 30+ active leads at once.", test: function (m) { return m.maxActiveLeadCount >= 30; } },
    { key: "the_long_game", tier: "hard", category: "Pipeline", label: "The Long Game", desc: "Keep a lead active, with touches, for 180+ days.", test: function (m) { return m.hasLongGame180; } },
    { key: "grandmaster", tier: "hard", category: "Variety", label: "Grandmaster", desc: "Log 50 of every action type.", test: function (m) { return m.minCountAcrossTypes >= 50; } },
    { key: "one_year_strong", tier: "hard", category: "Score", label: "One Year Strong", desc: "Stay active from your first entry to 365 days later.", test: function (m) { return m.daysSinceFirstEntry >= 365; } },
    { key: "completionist", tier: "hard", category: "Meta", label: "Completionist", desc: "Unlock 75 honors.", test: function (m) { return m.unlockedSoFar >= 75; } },
    { key: "outreach_games_legend", tier: "hard", category: "Meta", label: "The Outreach Games Legend", desc: "Unlock every other honor in this guide.", test: function (m) { return m.unlockedSoFar >= BADGE_DEFS.length - 1; } }
  ];

  var FUNNEL_STAGES = ["dm", "loom", "call", "client"];

  var LEAD_STAGES = [
    { key: "new", label: "New" },
    { key: "dmd", label: "DM'd" },
    { key: "loom", label: "Loom Sent" },
    { key: "call", label: "Call Booked" },
    { key: "client", label: "Client" }
  ];

  // Which pipeline stage a given touch implies, for auto-advancing a lead
  // when you log a matching action against them (you can always override
  // manually — this just saves the click when the obvious thing happens).
  var STAGE_FOR_ACTION = { dm: "dmd", loom: "loom", call: "call", client: "client", revenue: "client" };

  // Days to wait after the Nth touch before the next follow-up is "due",
  // indexed by (touch count - 1) and clamped to the last value beyond that.
  var CADENCE_GAPS = [2, 5, 7, 14];

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

  function uid() {
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function actionByKey(key) {
    for (var i = 0; i < ACTION_TYPES.length; i++) if (ACTION_TYPES[i].key === key) return ACTION_TYPES[i];
    return null;
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

    function todayKey() { return toISODate(startOfDay(new Date())); }

    function emptyState() {
      return {
        pin: opts.defaultPin || "1234",
        settings: defaultSettings(),
        dailyGoal: opts.defaultDailyGoal != null ? opts.defaultDailyGoal : 0,
        dailyGoalDate: todayKey(),
        entries: [],
        badges: {},
        goals: [],
        leads: [],
        maxActiveLeadCount: 0
      };
    }

    // A daily goal only applies to the day it was set on — each new day it
    // rolls back to 0 so the user consciously sets a fresh target instead of
    // yesterday's number silently carrying over.
    function rolloverDailyGoalIfNeeded() {
      var today = todayKey();
      if (state.dailyGoalDate !== today) {
        state.dailyGoal = 0;
        state.dailyGoalDate = today;
        persist();
      }
    }

    function load() {
      var raw;
      try { raw = global.localStorage.getItem(storageKey); } catch (e) { raw = null; }
      if (raw) {
        try { state = JSON.parse(raw); } catch (e) { state = null; }
      }
      if (!state) {
        state = emptyState();
        recomputeBadges(state);
        persist();
      } else {
        // backfill defaults for older saved states
        if (!state.settings) state.settings = defaultSettings();
        if (!state.badges) state.badges = {};
        if (!state.goals) state.goals = [];
        if (!state.leads) state.leads = [];
        if (state.maxActiveLeadCount == null) state.maxActiveLeadCount = 0;
        if (!state.pin) state.pin = opts.defaultPin || "1234";
        if (state.dailyGoal == null) state.dailyGoal = opts.defaultDailyGoal != null ? opts.defaultDailyGoal : 0;
        if (!state.dailyGoalDate) state.dailyGoalDate = todayKey();
        rolloverDailyGoalIfNeeded();
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

    function getDailyGoal() { rolloverDailyGoalIfNeeded(); return state.dailyGoal || 0; }
    function setDailyGoal(v) { state.dailyGoal = Math.max(0, Number(v) || 0); state.dailyGoalDate = todayKey(); persist(); }

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
      rolloverDailyGoalIfNeeded();
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

    // Builds the one metrics snapshot every badge test() reads from, so each
    // rule stays a one-line comparison instead of re-deriving its own data.
    function computeBadgeMetrics() {
      var entries = activeEntries();
      var leads = state.leads;

      var counts = {};
      ACTION_TYPES.forEach(function (a) { counts[a.key] = 0; });
      var revenueTotal = 0, maxSingleRevenue = 0, editedEntryCount = 0;
      var dayTotals = {}, dayCounts = {}, weekTotals = {}, monthTotals = {}, quarterTotals = {};
      var early = false, night = false, midnight = false, jan1 = false;
      var fridaysSet = {};
      var sortedTimes = [];

      entries.forEach(function (e) {
        counts[e.action_type] = (counts[e.action_type] || 0) + 1;
        if (e.action_type === "revenue" && e.real_revenue_amount) {
          revenueTotal += e.real_revenue_amount;
          if (e.real_revenue_amount > maxSingleRevenue) maxSingleRevenue = e.real_revenue_amount;
        }
        if (e.edited_at) editedEntryCount++;
        var d = new Date(e.created_at);
        var dKey = toISODate(d);
        dayTotals[dKey] = (dayTotals[dKey] || 0) + e.virtual_value;
        dayCounts[dKey] = (dayCounts[dKey] || 0) + 1;
        var wKey = toISODate(startOfWeek(d));
        weekTotals[wKey] = (weekTotals[wKey] || 0) + e.virtual_value;
        var mKey = toISODate(startOfMonth(d));
        monthTotals[mKey] = (monthTotals[mKey] || 0) + e.virtual_value;
        var qKey = toISODate(startOfQuarter(d));
        quarterTotals[qKey] = (quarterTotals[qKey] || 0) + e.virtual_value;
        var hr = d.getHours();
        if (hr < 8) early = true;
        if (hr >= 22) night = true;
        if (hr < 3) midnight = true;
        if (d.getDay() === 5) fridaysSet[dKey] = true;
        if (d.getMonth() === 0 && d.getDate() === 1) jan1 = true;
        sortedTimes.push(d.getTime());
      });
      sortedTimes.sort(function (a, b) { return a - b; });
      var hasBurst3in15 = false;
      for (var i = 0; i + 2 < sortedTimes.length; i++) {
        if (sortedTimes[i + 2] - sortedTimes[i] <= 15 * 60 * 1000) { hasBurst3in15 = true; break; }
      }

      var bestDay = 0, bestWeek = 0, bestMonth = 0, bestQuarter = 0;
      Object.keys(dayTotals).forEach(function (k) { if (dayTotals[k] > bestDay) bestDay = dayTotals[k]; });
      Object.keys(weekTotals).forEach(function (k) { if (weekTotals[k] > bestWeek) bestWeek = weekTotals[k]; });
      Object.keys(monthTotals).forEach(function (k) { if (monthTotals[k] > bestMonth) bestMonth = monthTotals[k]; });
      Object.keys(quarterTotals).forEach(function (k) { if (quarterTotals[k] > bestQuarter) bestQuarter = quarterTotals[k]; });
      var hasDayWithExactly7 = Object.keys(dayCounts).some(function (k) { return dayCounts[k] === 7; });

      var goal = state.dailyGoal || 0;
      var hitDaySet = {};
      Object.keys(dayTotals).forEach(function (k) { if (goal > 0 ? dayTotals[k] >= goal : dayTotals[k] > 0) hitDaySet[k] = true; });
      var doubleGoalDays = goal > 0 ? Object.keys(dayTotals).filter(function (k) { return dayTotals[k] >= goal * 2; }).length : 0;

      var hitDaysSorted = Object.keys(hitDaySet).sort();
      var bestStreakEver = 0, run = 0, prev = null;
      hitDaysSorted.forEach(function (d) {
        if (prev !== null && (new Date(d) - new Date(prev)) === DAY) run++; else run = 1;
        bestStreakEver = Math.max(bestStreakEver, run);
        prev = d;
      });
      // Bounce-back: a hit day immediately preceded by a logged, missed day.
      var hasBounceBack = hitDaysSorted.some(function (d) {
        var prevDay = toISODate(addDays(new Date(d), -1));
        return dayTotals.hasOwnProperty(prevDay) && !hitDaySet[prevDay];
      });

      var fridayCount = Object.keys(fridaysSet).length;
      var mondayGoalHitCount = Object.keys(hitDaySet).filter(function (k) { return new Date(k).getDay() === 1; }).length;

      var weekendPairs = {};
      Object.keys(hitDaySet).forEach(function (k) {
        var d = new Date(k), dow = d.getDay();
        if (dow === 6 || dow === 0) {
          var wk = toISODate(startOfWeek(d));
          weekendPairs[wk] = weekendPairs[wk] || {};
          weekendPairs[wk][dow === 6 ? "sat" : "sun"] = true;
        }
      });
      var hasWeekendBothDays = Object.keys(weekendPairs).some(function (wk) { return weekendPairs[wk].sat && weekendPairs[wk].sun; });

      var perfectWeek = Object.keys(weekTotals).some(function (wk) {
        var start = new Date(wk);
        for (var d2 = 0; d2 < 7; d2++) if (!hitDaySet[toISODate(addDays(start, d2))]) return false;
        return true;
      });

      function monthAllDaysMatch(predicate) {
        return Object.keys(monthTotals).some(function (mk) {
          var start = new Date(mk), end = addMonths(start, 1);
          var today = startOfDay(new Date());
          var lastDay = end < today ? addDays(end, -1) : addDays(today, -1);
          if (lastDay < start) return false;
          var cursor = new Date(start);
          while (cursor <= lastDay) {
            if (!predicate(toISODate(cursor))) return false;
            cursor = addDays(cursor, 1);
          }
          return true;
        });
      }
      var perfectMonth = monthAllDaysMatch(function (k) { return hitDaySet[k]; });
      var perfectMonthAnyActivity = monthAllDaysMatch(function (k) { return dayTotals.hasOwnProperty(k); });

      var todayD = startOfDay(new Date());
      var hitCountLast30 = 0;
      for (var i30 = 0; i30 < 30; i30++) if (hitDaySet[toISODate(addDays(todayD, -i30))]) hitCountLast30++;
      var goalHit25of30 = hitCountLast30 >= 25;

      var eightWeeksOk = true;
      var curWeekStart = startOfWeek(new Date());
      for (var w = 0; w < 8; w++) {
        var ws2 = addDays(curWeekStart, -7 * w);
        var hitInWeek = 0;
        for (var d3 = 0; d3 < 7; d3++) if (hitDaySet[toISODate(addDays(ws2, d3))]) hitInWeek++;
        if (hitInWeek < 6) { eightWeeksOk = false; break; }
      }

      var firstEntryDate = null;
      entries.forEach(function (e) { var t = new Date(e.created_at); if (!firstEntryDate || t < firstEntryDate) firstEntryDate = t; });
      var daysSinceFirstEntry = firstEntryDate ? Math.floor((Date.now() - firstEntryDate.getTime()) / DAY) : 0;

      var funnelCounts = funnel().counts;
      var dmToCallRate = funnelCounts.dm > 0 ? funnelCounts.call / funnelCounts.dm : 0;
      var dmToClientRate = funnelCounts.dm > 0 ? funnelCounts.client / funnelCounts.dm : 0;

      var minCountAcrossTypes = Math.min.apply(null, ACTION_TYPES.map(function (a) { return counts[a.key] || 0; }));
      var typesLoggedCount = ACTION_TYPES.filter(function (a) { return (counts[a.key] || 0) > 0; }).length;

      // ---- leads ----
      leads.forEach(function (l) {
        if (!l.stagesReachedAt) { l.stagesReachedAt = {}; l.stagesReachedAt[l.stage] = l.created_at; }
      });
      var activeLeadsNow = leads.filter(function (l) { return !l.archived; });
      if (activeLeadsNow.length > (state.maxActiveLeadCount || 0)) state.maxActiveLeadCount = activeLeadsNow.length;

      var leadsAddedTotal = leads.length;
      var leadsArchivedCount = leads.filter(function (l) { return l.archived; }).length;
      var leadsRespondedCount = leads.filter(function (l) { return l.responded_at; }).length;
      var leadsClientEver = leads.filter(function (l) { return l.stagesReachedAt && l.stagesReachedAt.client; }).length;
      var leadsAdvancedTotal = leads.filter(function (l) { return l.stagesReachedAt && Object.keys(l.stagesReachedAt).length > 1; }).length;
      var leadFollowUpTouches = entries.filter(function (e) { return e.lead_id && e.action_type === "followup"; }).length;

      var hasQuickTurnaround = false, hasComebackKid = false, hasFastTrack14 = false, hasSpeedClose5 = false, hasLongGame180 = false, hasQuickFollowUp24h = false;
      var responseTimes = [];
      leads.forEach(function (l) {
        var lEntries = entries.filter(function (e) { return e.lead_id === l.id; })
          .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        if (!lEntries.length) return;
        var first = new Date(lEntries[0].created_at);
        var last = new Date(lEntries[lEntries.length - 1].created_at);
        if (lEntries.some(function (e, idx) { return idx > 0 && e.action_type === "followup" && (new Date(e.created_at) - first) <= DAY; })) {
          hasQuickFollowUp24h = true;
        }
        if (l.responded_at) {
          var respondedAt = new Date(l.responded_at);
          responseTimes.push(Math.max(0, Math.round((respondedAt - first) / DAY)));
          if (Math.round((respondedAt - first) / DAY) <= 1) hasQuickTurnaround = true;
          if (Math.round((respondedAt - last) / DAY) >= 14) hasComebackKid = true;
        }
        if (l.stagesReachedAt && l.stagesReachedAt.client) {
          var closeDays = Math.round((new Date(l.stagesReachedAt.client) - new Date(l.created_at)) / DAY);
          if (closeDays <= 14) hasFastTrack14 = true;
          if (closeDays <= 5) hasSpeedClose5 = true;
        }
        if (!l.archived && Math.round((last - first) / DAY) >= 180) hasLongGame180 = true;
      });
      var avgResponseTime = responseTimes.length ? (responseTimes.reduce(function (a, b) { return a + b; }, 0) / responseTimes.length) : null;

      function overdueFreeAtMinimum(min) {
        if (activeLeadsNow.length < min) return false;
        return activeLeadsNow.every(function (l) { return leadFollowUp(l.id).status !== "overdue"; });
      }

      return {
        counts: counts, revenueTotal: revenueTotal, maxSingleRevenue: maxSingleRevenue, editedEntryCount: editedEntryCount,
        lifetimePoints: entries.reduce(function (sum, e) { return sum + e.virtual_value; }, 0),
        bestDay: bestDay, bestWeek: bestWeek, bestMonth: bestMonth, bestQuarter: bestQuarter,
        bestStreakEver: bestStreakEver, hasBounceBack: hasBounceBack, hasWeekendBothDays: hasWeekendBothDays,
        doubleGoalDays: doubleGoalDays, early: early, night: night, midnight: midnight,
        hasDayWithExactly7: hasDayWithExactly7, hasBurst3in15: hasBurst3in15,
        fridayCount: fridayCount, mondayGoalHitCount: mondayGoalHitCount, jan1: jan1,
        perfectWeek: perfectWeek, perfectMonth: perfectMonth, perfectMonthAnyActivity: perfectMonthAnyActivity,
        goalHit25of30: goalHit25of30, eightWeeksOk: eightWeeksOk, daysSinceFirstEntry: daysSinceFirstEntry,
        dmToCallRate: dmToCallRate, dmToClientRate: dmToClientRate,
        minCountAcrossTypes: minCountAcrossTypes, typesLoggedCount: typesLoggedCount,
        leadsAddedTotal: leadsAddedTotal, leadsArchivedCount: leadsArchivedCount, leadsRespondedCount: leadsRespondedCount,
        leadsClientEver: leadsClientEver, leadsAdvancedTotal: leadsAdvancedTotal, leadFollowUpTouches: leadFollowUpTouches,
        maxActiveLeadCount: state.maxActiveLeadCount || 0, hasQuickFollowUp24h: hasQuickFollowUp24h,
        hasQuickTurnaround: hasQuickTurnaround, hasComebackKid: hasComebackKid, hasFastTrack14: hasFastTrack14,
        hasSpeedClose5: hasSpeedClose5, hasLongGame180: hasLongGame180,
        avgResponseTime: avgResponseTime, respondedSampleCount: responseTimes.length,
        zeroOverdueAt5: overdueFreeAtMinimum(5), zeroOverdueAt15: overdueFreeAtMinimum(15),
        unlockedSoFar: 0
      };
    }

    function recomputeBadges(s) {
      var m = computeBadgeMetrics();
      var nowIso = new Date().toISOString();
      var newlyUnlocked = [];

      var alreadyUnlocked = 0;
      Object.keys(s.badges).forEach(function () { alreadyUnlocked++; });

      // Pass 1: every non-meta badge.
      BADGE_DEFS.forEach(function (b) {
        if (b.category === "Meta") return;
        if (!s.badges[b.key] && b.test(m)) { s.badges[b.key] = nowIso; newlyUnlocked.push(b.key); }
      });

      // Pass 2: meta badges see how many (non-meta + already-unlocked meta)
      // badges are unlocked as of pass 1, so "unlock 25 honors" etc. can fire
      // in the same pass that crosses the threshold.
      m.unlockedSoFar = Object.keys(s.badges).length;
      BADGE_DEFS.forEach(function (b) {
        if (b.category !== "Meta") return;
        if (!s.badges[b.key] && b.test(m)) { s.badges[b.key] = nowIso; newlyUnlocked.push(b.key); }
      });

      return newlyUnlocked;
    }

    function listBadges() {
      return BADGE_DEFS.map(function (b) {
        return {
          key: b.key,
          tier: b.tier,
          category: b.category,
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
        lead_id: input.lead_id || null,
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

    // ---------- Leads / pipeline ----------

    function getLead(id) { return state.leads.find(function (l) { return l.id === id; }) || null; }

    function listLeads(opts) {
      opts = opts || {};
      var list = state.leads.filter(function (l) { return opts.includeArchived ? true : !l.archived; });
      list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return list;
    }

    function addLead(input) {
      var nowIso = new Date().toISOString();
      var lead = {
        id: uid(),
        name: (input.name || "").trim() || "Unnamed lead",
        notes: input.notes || "",
        stage: "new",
        archived: false,
        created_at: nowIso,
        responded_at: null,
        stagesReachedAt: { new: nowIso }
      };
      state.leads.push(lead);
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: lead, newBadges: newBadges };
    }

    function updateLead(id, patch) {
      var l = getLead(id);
      if (!l) return null;
      ["name", "notes"].forEach(function (k) { if (patch.hasOwnProperty(k)) l[k] = patch[k]; });
      persist();
      return l;
    }

    function setLeadStage(id, stage) {
      var l = getLead(id);
      if (!l) return null;
      if (!LEAD_STAGES.some(function (s) { return s.key === stage; })) return null;
      l.stage = stage;
      if (!l.stagesReachedAt) l.stagesReachedAt = {};
      if (!l.stagesReachedAt[stage]) l.stagesReachedAt[stage] = new Date().toISOString();
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: l, newBadges: newBadges };
    }

    function archiveLead(id) {
      var l = getLead(id);
      if (!l) return null;
      l.archived = true;
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: l, newBadges: newBadges };
    }

    function unarchiveLead(id) {
      var l = getLead(id);
      if (!l) return null;
      l.archived = false;
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: l, newBadges: newBadges };
    }

    function deleteLead(id) {
      state.leads = state.leads.filter(function (l) { return l.id !== id; });
      var newBadges = recomputeBadges(state);
      persist();
      return { newBadges: newBadges };
    }

    function markLeadResponded(id) {
      var l = getLead(id);
      if (!l) return null;
      l.responded_at = new Date().toISOString();
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: l, newBadges: newBadges };
    }

    function clearLeadResponded(id) {
      var l = getLead(id);
      if (!l) return null;
      l.responded_at = null;
      var newBadges = recomputeBadges(state);
      persist();
      return { lead: l, newBadges: newBadges };
    }

    function leadEntries(id) {
      return activeEntries()
        .filter(function (e) { return e.lead_id === id; })
        .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    }

    function leadTouchCounts(id) {
      var out = {};
      ACTION_TYPES.forEach(function (a) { out[a.key] = 0; });
      leadEntries(id).forEach(function (e) { out[e.action_type] = (out[e.action_type] || 0) + 1; });
      return out;
    }

    function leadTouchCount(id) { return leadEntries(id).length; }

    function leadLastTouchDate(id) {
      var entries = leadEntries(id);
      return entries.length ? new Date(entries[entries.length - 1].created_at) : null;
    }

    function leadFirstTouchDate(id) {
      var entries = leadEntries(id);
      return entries.length ? new Date(entries[0].created_at) : null;
    }

    // Status is one of: 'responded', 'no-touches', 'overdue', 'due', 'upcoming'.
    function leadFollowUp(id) {
      var l = getLead(id);
      if (!l) return null;
      if (l.responded_at) return { status: "responded" };
      var count = leadTouchCount(id);
      if (count === 0) return { status: "no-touches" };
      var last = leadLastTouchDate(id);
      var gapDays = CADENCE_GAPS[Math.min(count - 1, CADENCE_GAPS.length - 1)];
      var due = addDays(startOfDay(last), gapDays);
      var today = startOfDay(new Date());
      var daysUntil = Math.round((due - today) / DAY);
      var status = daysUntil < 0 ? "overdue" : (daysUntil === 0 ? "due" : "upcoming");
      return { status: status, dueDate: due, daysUntil: daysUntil };
    }

    function leadResponseTimeDays(id) {
      var l = getLead(id);
      if (!l || !l.responded_at) return null;
      var first = leadFirstTouchDate(id);
      if (!first) return null;
      return Math.max(0, Math.round((new Date(l.responded_at) - first) / DAY));
    }

    // Logs a touch against a lead (reuses addEntry so it still counts toward
    // lifetime points/streak/badges), snapshots the lead's name onto the
    // entry's contact field, and auto-advances the lead's stage if this
    // touch implies further progress than where it currently sits.
    function addLeadTouch(leadId, input) {
      var l = getLead(leadId);
      if (!l) throw new Error("Unknown lead: " + leadId);
      var res = addEntry({
        action_type: input.action_type,
        contact: l.name,
        note: input.note || "",
        real_revenue_amount: input.real_revenue_amount,
        lead_id: leadId
      });
      var impliedStage = STAGE_FOR_ACTION[input.action_type];
      var extraBadges = [];
      if (impliedStage) {
        var order = LEAD_STAGES.map(function (s) { return s.key; });
        if (order.indexOf(impliedStage) > order.indexOf(l.stage)) {
          l.stage = impliedStage;
          if (!l.stagesReachedAt) l.stagesReachedAt = {};
          if (!l.stagesReachedAt[impliedStage]) l.stagesReachedAt[impliedStage] = new Date().toISOString();
          // The stage move itself (e.g. reaching Client) can unlock badges
          // the entry-level check in addEntry() couldn't have seen yet.
          extraBadges = recomputeBadges(state);
          persist();
        }
      }
      if (extraBadges.length) {
        var seen = {};
        res.newBadges.concat(extraBadges).forEach(function (k) { seen[k] = true; });
        res.newBadges = Object.keys(seen);
      }
      return res;
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

    function resetAllData() {
      var pin = state.pin;
      state = emptyState();
      state.pin = pin;
      recomputeBadges(state);
      persist();
    }

    function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; }

    load();

    return {
      ACTION_TYPES: ACTION_TYPES,
      BADGES: BADGE_DEFS,
      LEAD_STAGES: LEAD_STAGES,
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
      getLead: getLead,
      listLeads: listLeads,
      addLead: addLead,
      updateLead: updateLead,
      setLeadStage: setLeadStage,
      archiveLead: archiveLead,
      unarchiveLead: unarchiveLead,
      deleteLead: deleteLead,
      markLeadResponded: markLeadResponded,
      clearLeadResponded: clearLeadResponded,
      leadTouchCounts: leadTouchCounts,
      leadTouchCount: leadTouchCount,
      leadFollowUp: leadFollowUp,
      leadResponseTimeDays: leadResponseTimeDays,
      addLeadTouch: addLeadTouch,
      hasPin: hasPin,
      verifyPin: verifyPin,
      setPin: setPin,
      isUnlockedThisSession: isUnlockedThisSession,
      markUnlocked: markUnlocked,
      lockSession: lockSession,
      resetAllData: resetAllData,
      subscribe: subscribe
    };
  }

  global.OutreachCore = OutreachCore;
})(window);
