	/* ---------- the manager hub ----------
	   Everything under the pitch sits in tabs, the way a career mode does it: Overview, Squad, League,
	   Cups, Transfers, Club, Settings and Help. The sections themselves are rendered as before; the hub
	   only shows one panel at a time, remembers which, keeps a short Overview and puts a count on a tab
	   when something there wants an answer. The match buttons stay above the tabs. */
	const HUB_KEY = "ff-hub-tab";
	const hubTabs = [ ...document.querySelectorAll("#hubTabs [role=tab]") ];
	const tabOf = k => hubTabs.find(t => t.dataset.tab === k);
	const leagueOn = () => !$("league").hidden;
	const tabUsable = t => t && !t.hidden;
	let hubTab = null;

	function showTab (k, o = {}) {
		let t = tabOf(k);
		if (!tabUsable(t)) { t = tabOf(leagueOn() ? "overview" : "settings"); }
		hubTab = t.dataset.tab;
		for (const x of hubTabs) {
			const on = x === t;
			x.setAttribute("aria-selected", String(on));
			x.tabIndex = on ? 0 : -1;
			const p = $(x.getAttribute("aria-controls"));
			if (p) { p.hidden = !on; }
		}
		if (o.remember !== false) { store.set(HUB_KEY, hubTab); }
		if (o.focus) { t.focus(); }
		// Coming back to the top of a long panel: keep the tab bar in view rather than leaving you mid-page.
		const hub = $("hub"), top = hub.getBoundingClientRect().top;
		if (o.scroll !== false && top < 0) { window.scrollBy(0, top); }
		return hubTab;
	}

	// Outside a league (a friendly, the tutorial, the shootout) only Settings and Help mean anything.
	function syncHubMode () {
		const on = leagueOn();
		for (const t of hubTabs) { if ("league" in t.dataset) { t.hidden = !on; } }
		$("lgActions").hidden = !on;
	$("assistLink").hidden = !on;
		const want = store.get(HUB_KEY) || "overview";
		if (!tabUsable(tabOf(hubTab)) || (hubTab !== want && tabUsable(tabOf(want)))) { showTab(want, { remember: false, scroll: false }); }
	}

	function setBadge (k, n, label) {
		const b = $(`badge-${k}`);
		b.hidden = !n;
		b.textContent = n ? String(n) : "";
		const t = tabOf(k);
		t.setAttribute("aria-label", n ? `${t.firstChild.textContent} (${n} ${label})` : t.firstChild.textContent);
	}

	// The Overview: a table snippet (top five and you), the last round and a line per cup, built from what
	// the League and Cups panels already show, so it can never disagree with them.
	function renderOverview () {
		const body = document.querySelector("#panel-overview .ov-table-body");
		body.replaceChildren();
		const rows = [ ...$("lgBody").rows ], mine = rows.findIndex(r => r.classList.contains("me"));
		rows.forEach((r, i) => {
			if (i >= 5 && i !== mine) { return; }
			if (i === mine && i > 5) { const gap = el("tr", "gap"); const td = el("td", "", "…"); td.colSpan = 5; gap.append(td); body.append(gap); }
			const tr = el("tr", r.className), c = r.cells;
			for (const j of [ 0, 1, 2, 8, 9 ]) { if (c[j]) { tr.append(c[j].cloneNode(true)); } }
			body.append(tr);
		});
		document.querySelector("#panel-overview .ov-round-title").textContent = $("lgRoundTitle").textContent || "Latest results";
		const round = document.querySelector("#panel-overview .ov-round");
		const games = [ ...$("lgRound").children ].filter(li => !li.querySelector(".none"));
		games.sort((x, y) => y.classList.contains("mine") - x.classList.contains("mine"));
		round.replaceChildren(...games.slice(0, 5).map(li => li.cloneNode(true)));
		if (!round.childElementCount) { round.append(el("li", "none", "No games played yet.")); }
		const cups = document.querySelector("#panel-overview .ov-cups");
		cups.replaceChildren();
		for (const c of document.querySelectorAll("#lgExtras .lg-cup")) {
			const h = c.querySelector("h4"), d = c.querySelector(".detail");
			if (!h) { continue; }
			const li = el("li");
			li.append(el("b", "", h.textContent), el("span", "", d ? ` ${d.textContent}` : ""));
			cups.append(li);
		}
		if (!cups.childElementCount) { cups.append(el("li", "none", "No cup ties yet.")); }
	}

	function syncHub () {
		syncHubMode();
		if (!leagueOn()) { return; }
		renderOverview();
		const issues = document.querySelectorAll("#lgDrama .drama-issues > li").length;
		setBadge("overview", issues, issues === 1 ? "dressing-room issue" : "dressing-room issues");
		const bids = $("bidsIn").children.length;
		setBadge("transfers", bids, bids === 1 ? "offer for a player" : "offers for your players");
		const c = league && league.club;
		const ending = c ? [ ...c.squad, ...c.bench ].filter(p => p && p.contract <= 1).length : 0;
		setBadge("squad", ending, ending === 1 ? "contract ending" : "contracts ending");
		const jobs = $("jobOffers").children.length + $("agentOffers").children.length;
		setBadge("club", jobs, jobs === 1 ? "job offer" : "job offers");
	}

	// Re-sync whenever the panels it reads from redraw (they rebuild their children) or the mode hides the league.
	let hubQueued = false;
	const queueHub = () => { if (hubQueued) { return; } hubQueued = true; requestAnimationFrame(() => { hubQueued = false; syncHub(); }); };
	const hubObs = new MutationObserver(queueHub);
	for (const id of [ "lgBody", "lgRound", "lgDrama", "lgExtras", "bidsIn", "jobOffers", "agentOffers", "sqBody" ]) { hubObs.observe($(id), { childList: true, subtree: true }); }
	hubObs.observe($("league"), { attributes: true, attributeFilter: [ "hidden" ] });

	for (const t of hubTabs) { t.addEventListener("click", () => showTab(t.dataset.tab)); }
	$("hubTabs").addEventListener("keydown", e => {
		const vis = hubTabs.filter(tabUsable), i = vis.indexOf(document.activeElement);
		if (i < 0) { return; }
		let j = null;
		if (e.key === "ArrowRight") { j = (i + 1) % vis.length; }
		else if (e.key === "ArrowLeft") { j = (i - 1 + vis.length) % vis.length; }
		else if (e.key === "Home") { j = 0; }
		else if (e.key === "End") { j = vis.length - 1; }
		if (j === null) { return; }
		e.preventDefault(); e.stopPropagation();   // the arrows move the tabs, not your player
		showTab(vis[j].dataset.tab, { focus: true });
		vis[j].scrollIntoView?.({ block: "nearest", inline: "nearest" });
	});
	// A shortcut can also name a control to land on (Settings > Your team > Assistant manager): open its tab,
	// bring the control into view, focus it and flash its card so the eye finds it.
	for (const b of document.querySelectorAll("#hub [data-goto]")) {
		b.addEventListener("click", () => {
			const target = b.dataset.focus && $(b.dataset.focus);
			showTab(b.dataset.goto, { focus: !target });
			if (!target) { return; }
			const card = target.closest(".win") || target;
			card.scrollIntoView?.({ block: "nearest" });
			target.focus({ preventScroll: true });
			card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
		});
	}

	syncHubMode();
	showTab(store.get(HUB_KEY) || "overview", { remember: false, scroll: false });
	queueHub();
	queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { showTab, syncHub }); } });
