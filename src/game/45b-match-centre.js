	/* ---------- the match centre ----------
	   While you play, a small button under the menu toggle (or the O key) opens a compact card on the
	   right of the pitch: the other side (their shape and style, the eleven on the pitch with positions
	   and ratings, their form, manager and place in the table) and the live numbers for both sides.
	   It is closed by default, never opens by itself, scrolls inside itself and refreshes once a second
	   while it is open, so the pitch stays yours. */
	let mcTab = "opp", mcTimer = 0;
	const mcLive = () => (mode === "league" || mode === "friendly") && [ "play", "goal", "paused", "half" ].includes(state) && !bulkSim;
	// Their last five league results, oldest first.
	function formOf (id) {
		if (!league || !Array.isArray(league.results)) { return []; }
		const out = [];
		for (let r = league.round - 1; r >= 0 && out.length < 5; r--) {
			const g = (league.results[r] || []).find(([ h, a ]) => h === id || a === id);
			if (!g) { continue; }
			const d = g[0] === id ? g[2] - g[3] : g[3] - g[2];
			out.push(d > 0 ? "W" : d < 0 ? "L" : "D");
		}
		return out.reverse();
	}
	function mcOpp () {
		const id = leagueMatch ? leagueMatch.opp : null, box = el("div", "mc-opp");
		const head = el("div", "mc-team");
		head.append(dotFor(opp), el("b", "", opp.name));
		box.append(head);
		const facts = el("dl", "mc-facts"), fact = (k, v) => { if (v) { facts.append(el("dt", "", k), el("dd", "", v)); } };
		const shape = SHAPES[fmtKey] && SHAPES[fmtKey][teamShape[1]] ? SHAPES[fmtKey][teamShape[1]].label : FMT.label;
		fact("Shape", shape);
		fact("Style", `${STYLES[style[1]] || ""}${PRESSES[press[1]] ? `, ${PRESSES[press[1]].toLowerCase()}` : ""}`);
		if (id !== null && league) {
			const rows = standings(), pos = rows.findIndex(r => r.id === id) + 1;
			if (pos) { fact("League", `${ordinal(pos)} of ${rows.length}, ${rows[pos - 1].pts} pts`); }
			const f = formOf(id);
			if (f.length) {
				const dd = el("span", "mc-form");
				for (const x of f) { dd.append(el("i", `f-${x.toLowerCase()}`, x)); }
				const v = el("dd");
				v.setAttribute("aria-label", `Last ${f.length}: ${f.join(" ")}`);
				v.append(dd);
				facts.append(el("dt", "", "Form"), v);
			}
		}
		fact("Manager", opp.manager ? `${opp.manager}${NATIONS[opp.managerNat] ? ` (${NATIONS[opp.managerNat][0]})` : ""}` : "");
		box.append(facts);
		const ol = el("ol", "mc-xi");
		for (const p of team(1)) {
			const src = typeof oppSquad !== "undefined" && oppSquad ? oppSquad[p.sqi] : null;
			const role = FMT.roles[p.idx] || (src && src.pos) || "";
			const li = el("li", dismissed.some(d => Array.isArray(d) && d[0] === 1 && d[1] === p.idx) ? "off" : "");
			li.append(el("span", "num", String(p.num || "")), el("span", "pos", POS_LABEL[role] || ""), el("span", "nm", p.name || (p.role === "gk" ? "Keeper" : "Player")), el("b", "ovr", src ? String(ovrOf(src)) : ""));
			ol.append(li);
		}
		box.append(el("h5", "", "On the pitch"), ol);
		return box;
	}
	function mcStats () {
		const tot = possFrames[0] + possFrames[1], poss = tot ? Math.round(100 * possFrames[0] / tot) : 50, s = matchStats(poss);
		const tb = el("div", "mc-stats");
		const head = el("div", "mc-srow mc-shead");
		head.append(el("b", "you", s.you), el("span", "", fmtClock(timeLeft, matchLen)), el("b", "them", s.them));
		tb.append(head);
		for (const [ label, a, b, na, nb, kind ] of s.rows) {
			const row = el("div", "mc-srow"), va = Number.isFinite(na) ? na : Number(a), vb = Number.isFinite(nb) ? nb : Number(b);
			const A = el("b", "you", String(a)), B = el("b", "them", String(b));
			if (Number.isFinite(va) && Number.isFinite(vb) && va !== vb) { (va > vb ? A : B).classList.add("lead"); }
			row.append(A, el("span", "", label), B);
			if (kind === "poss") { const bar = el("i", "cmp-bar"), fill = el("em"); fill.style.width = `${clamp(poss, 0, 100)}%`; bar.append(fill); row.append(bar); }
			tb.append(row);
		}
		return tb;
	}
	function renderMatchCentre () {
		const box = $("matchCentre");
		if (!box || box.hidden) { return; }
		if (!mcLive() || !opp) { closeMatchCentre(); return; }
		for (const b of box.querySelectorAll("[data-mc]")) { b.setAttribute("aria-pressed", String(b.dataset.mc === mcTab)); }
		$("mcBody").replaceChildren(mcTab === "opp" ? mcOpp() : mcStats());
	}
	function openMatchCentre (tab) {
		if (!mcLive()) { return false; }
		if (tab) { mcTab = tab; }
		$("matchCentre").hidden = false;
		$("mcToggle").setAttribute("aria-expanded", "true");
		renderMatchCentre();
		clearInterval(mcTimer);
		mcTimer = setInterval(renderMatchCentre, 1000);
		return true;
	}
	function closeMatchCentre () {
		clearInterval(mcTimer);
		$("matchCentre").hidden = true;
		$("mcToggle").setAttribute("aria-expanded", "false");
	}
	const toggleMatchCentre = tab => ($("matchCentre").hidden ? openMatchCentre(tab) : closeMatchCentre());
	$("mcToggle").addEventListener("click", e => { toggleMatchCentre(); e.currentTarget.blur(); canvas.focus?.(); });
	$("mcClose").addEventListener("click", () => { closeMatchCentre(); canvas.focus?.(); });
	for (const b of document.querySelectorAll("#matchCentre [data-mc]")) { b.addEventListener("click", () => { mcTab = b.dataset.mc; renderMatchCentre(); }); }
	window.addEventListener("keydown", e => {
		if (e.code !== "KeyO" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) { return; }
		if (!mcLive()) { return; }
		toggleMatchCentre();
	});
	// The button shows only while a match is on (not the tutorial or the shootout).
	setInterval(() => { const on = mcLive(), t = $("mcToggle"); if (t.hidden === on) { t.hidden = !on; } if (!on && !$("matchCentre").hidden) { closeMatchCentre(); } }, 500);
