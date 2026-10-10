	/* ---------- broadcast overlays ----------
	   Line-ups and shapes for both sides at kick-off (a few seconds, or tap it away), the fourth
	   official's board for substitutions (number off in red, number on in green) and for added time
	   at 45 and 90 (the clock holds while it is played), and a ticker along the bottom with the other
	   league games, their goals going in as they happen and the finals after your match. */
	let bcLineT = 0, bcBoardT = 0, subNo = [ 0, 0 ], stall = 0, addedDone = [ false, false ], tickPlan = null, tickKey = "", tickNew = new Map();
	const tickerUp = () => ($("bcTicker").hidden ? 0 : 24);   // canvas hints sit above the ticker
	function hideLineups () { clearTimeout(bcLineT); $("bcLineups").hidden = true; }
	function showLineups () {
		if (bulkSim || mode === "tutorial" || mode === "corners") { return; }
		const box = $("bcLineups");
		box.replaceChildren();
		for (const t of [ 0, 1 ]) {
			const col = el("div", "bc-col");
			col.style.setProperty("--kit", (KITS[t] || KITS[0]).outfield);
			const sh = SHAPES[fmtKey] && teamShape[t] && SHAPES[fmtKey][teamShape[t]] ? SHAPES[fmtKey][teamShape[t]].label.split(" ")[0] : "";
			col.append(el("div", "bc-team", t === 0 ? YOU.name : opp.name), el("div", "bc-shape", sh || FMT.label));
			const ol = el("ol");
			for (const p of team(t)) { const li = el("li"); li.append(el("b", "", String(p.num || "")), el("span", "", p.name || (p.role === "gk" ? "Keeper" : "Player"))); ol.append(li); }
			col.append(ol);
			box.append(col);
		}
		box.hidden = false;
		box.style.animation = "none"; void box.offsetWidth; box.style.animation = "";
		clearTimeout(bcLineT);
		bcLineT = setTimeout(hideLineups, 4500);
	}
	function board (rows, ms) {
		if (bulkSim || mode === "tutorial") { return; }
		const b = $("bcBoard");
		b.replaceChildren(...rows.map(([ lbl, cls, txt ]) => { const r = el("div", "row"); r.append(el("span", "led " + cls, txt), el("span", "lbl", lbl)); return r; }));
		// Under the canvas's weather and tactic tags (they end 88 view units down), in CSS pixels.
		const ch = canvas.getBoundingClientRect().height;
		b.style.top = ch && SH ? `${Math.round(96 * ch / SH)}px` : "";
		b.hidden = false;
		b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
		clearTimeout(bcBoardT);
		bcBoardT = setTimeout(() => { b.hidden = true; }, ms);
	}
	// A substitution: the slot's number goes off; the new man gets the next bench number (12, 13 ...).
	function subBoard (t, p) {
		const on = 11 + (++subNo[t]);
		board([ [ t === 0 ? "You" : opp.short, "off", String(p && p.num ? p.num : "–") ], [ "", "on", String(on) ] ], 5000);
	}
	// Added time: a minute, and half as many again as the stoppages (goals, cards, subs, knocks) in the half.
	function startAdded (h) {
		addedDone[h] = true;
		const n = clamp(1 + Math.round(matchLog.filter(e => (h === 0 ? e.min <= 45 : e.min > 45)).length * 0.5), 1, 6);
		stall = n * matchLen / 90;
		board([ [ "Added time", "add", `+${n}` ] ], Math.max(4000, stall * 1000));
		if (!bulkSim) { $("announce").textContent = `${n} minute${n === 1 ? "" : "s"} added on.`; }
	}
	// The rest of the matchday, settled at kick-off so the ticker can show the goals as they go in.
	function planOthers (lm) {
		if (!lm || !league) { tickPlan = null; return; }
		const res = league.fixtures[lm.round].filter(([ x, y ]) => x !== 0 && y !== 0).map(([ x, y ]) => simMatch(x, y));
		const mins = res.map(r => [ Array.from({ length: r[2] }, () => 1 + Math.floor(Math.random() * 90)), Array.from({ length: r[3] }, () => 1 + Math.floor(Math.random() * 90)) ]);
		tickPlan = { round: lm.round, res, mins };
		tickKey = ""; tickNew = new Map();
	}
	function renderTicker () {
		const tk = $("bcTicker");
		const live = tickPlan && mode === "league" && (state === "play" || state === "goal" || state === "paused" || state === "half" || state === "full");
		if (!live) { if (!tk.hidden) { tk.hidden = true; } return; }
		const done = state === "full", m = done ? 99 : minuteNow();
		const sc = tickPlan.res.map((r, i) => [ tickPlan.mins[i][0].filter(x => x <= m).length, tickPlan.mins[i][1].filter(x => x <= m).length ]);
		const nFresh = [ ...tickNew.values() ].filter(t0 => performance.now() - t0 < 30000).length;
		const key = sc.map(x => x.join("-")).join(",") + (done ? "F" : state === "half" ? "H" : "") + "|" + nFresh;
		if (key === tickKey && !tk.hidden) { return; }
		if (tickKey) { const old = tickKey.split("|")[0].replace(/[FH]$/, "").split(","); sc.forEach((x, i) => { if (old[i] && old[i] !== x.join("-")) { tickNew.set(i, performance.now()); } }); }
		tickKey = key;
		const txt = $("bcTickerText");
		txt.replaceChildren(...tickPlan.res.map(([ h, a ], i) => {
			const fresh = tickNew.has(i) && performance.now() - tickNew.get(i) < 30000;
			const it = el("i", fresh ? "new" : "", `${TEAMS[h].short} ${sc[i][0]}–${sc[i][1]} ${TEAMS[a].short}`);
			it.append(el("em", "", done ? "FT" : state === "half" ? "HT" : fresh ? "GOAL" : ""));
			return it;
		}));
		txt.style.setProperty("--tk-dur", `${Math.max(20, tickPlan.res.length * 4)}s`);
		tk.hidden = false;
	}

