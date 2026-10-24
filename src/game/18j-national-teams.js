	/* ---------- national teams (see docs/national-teams.md) ----------
	   Every country's squad is picked from the players in the save: your club, every computer club's
	   eleven and your transfer shortlist. The best eleven by position (gk, four defenders, four midfielders,
	   two forwards, the way a club's squad is laid out), then a bench of five. A country short in a position
	   is filled with generated players at its own average less 4, so small nations stay playable without
	   being strong. Built once per half-season (the summer and the January window change who is where) and
	   kept in memory only: the computer clubs' elevens are rebuilt from their seeds, so nothing new is saved. */
	const INTL_BENCH = 5, INTL_FILL_DROP = 4, INTL_EMPTY_OVR = 60;
	// Generic shirts by region, not any real federation's.
	const INTL_SHIRTS = { home: [ "#e8e8e8", "#1d3f8f", "#c8102e", "#1f7a3a" ], europe: [ "#1d3f8f", "#c8102e", "#f2f2f2", "#f39200", "#0a7d4f", "#5b2a86", "#0b2a5b", "#d4af37" ], samerica: [ "#f6d10a", "#7fb5e6", "#c8102e", "#ffffff", "#0b2a5b" ], africa: [ "#0a7d4f", "#f39200", "#f6d10a", "#c8102e", "#ffffff", "#1f7a3a" ], asia: [ "#0b2a5b", "#c8102e", "#ffffff", "#f6d10a", "#1d3f8f" ] };
	// The 1..5 rating that cpuOvr (17) maps to this overall, the other way round.
	const strOfOvr = o => clamp(round1((o - 50) / 7), 1, 5);
	function nationIdent (nat) {
		const N = NATIONS[nat];
		if (!N) { return null; }
		const pal = INTL_SHIRTS[N[1]] || INTL_SHIRTS.europe, color = pal[hashStr(nat + "kit") % pal.length];
		return { nat, name: N[0], short: nat, color, color2: foreignSecond(color), ground: "National Stadium" };
	}
	let intlCache = null;
	const intlKey = lg => `${lg.season}|${lg.round >= JANUARY ? 2 : 1}|${lg.fmt}|${[ ...lg.club.squad, ...lg.club.bench ].map(p => p && p.name).join(",")}|${(lg.club.market || []).length}`;
	// Everyone in the save who could be picked, with where he plays.
	function intlPool (lg) {
		const out = [], add = (pl, club, own) => { if (pl && NATIONS[pl.nat]) { out.push({ pl, club, own }); } };
		for (const p of [ ...(lg.club.squad || []), ...(lg.club.bench || []) ]) { add(p, YOU.name, true); }
		const guest = lg.contGuest ? lg.contGuest.slot : -1;
		for (let i = 1; i < TEAMS.length; i++) {
			if (i === guest) { continue; }   // a cup guest's eleven is made up on the night; not one of the save's players
			for (const p of cpuSquad(i, getStr(i))) { add(p, TEAMS[i].name, false); }
		}
		for (const p of lg.club.market || []) { add(p, p.from ? `${p.from} (listed)` : "Transfer list", false); }
		return out;
	}
	// One country's squad: { nat, xi: [11 by POS_OF_SLOT], bench: [5], ovr, str, filled }.
	function pickNation (nat, pool, lg) {
		const mine = pool.filter(e => e.pl.nat === nat).sort((a, b) => ovrOf(b.pl) - ovrOf(a.pl));
		const avg = mine.length ? mine.reduce((t, e) => t + ovrOf(e.pl), 0) / mine.length : INTL_EMPTY_OVR + INTL_FILL_DROP;
		const used = new Set(), xi = [];
		let h = (hashStr(`${nat}|${lg.season}`) % 2147483646) + 1, filled = 0;
		const rnd = () => { h = (h * 48271) % 2147483647; return h / 2147483647; };
		const st = { lg: NAT_STYLE[nat] ? nat : leagueNat(), nat };
		for (const pos of POS_OF_SLOT) {
			const e = mine.find(x => !used.has(x) && x.pl.pos === pos);
			if (e) { used.add(e); xi.push(e); continue; }
			const pl = genPlayer(pos, Math.round(avg - INTL_FILL_DROP + (rnd() * 2 - 1) * 2), null, rnd, st);
			pl.nat = nat; filled++;
			xi.push({ pl, club: "Uncapped", own: false, gen: true });
		}
		const rest = mine.filter(e => !used.has(e));
		// A second keeper first if there is one, then the best of the rest.
		const gk2 = rest.find(e => e.pl.pos === "gk"), bench = gk2 ? [ gk2, ...rest.filter(e => e !== gk2) ] : rest;
		const on = slotsFor(lg.fmt).map(i => xi[i]).filter(Boolean);
		const ovr = on.reduce((t, e) => t + ovrOf(e.pl), 0) / on.length;
		return { nat, ident: nationIdent(nat), xi, bench: bench.slice(0, INTL_BENCH), ovr: round1(ovr), str: strOfOvr(ovr), filled, count: mine.length };
	}
	// Every country's squad, strongest first, cached for the half-season.
	function nationSquads (lg = league) {
		if (!lg || !lg.club) { return []; }
		const key = intlKey(lg);
		if (intlCache && intlCache.key === key && intlCache.lg === lg) { return intlCache.list; }
		const pool = intlPool(lg);
		const list = Object.keys(NATIONS).map(n => pickNation(n, pool, lg)).sort((a, b) => b.ovr - a.ovr || a.nat.localeCompare(b.nat));
		intlCache = { key, lg, list };
		return list;
	}
	const nationSquad = (nat, lg = league) => nationSquads(lg).find(s => s.nat === nat) || null;

	/* The Cups tab: a read-only card with each country's strength, and its eleven on a tap. */
	function renderNations (box) {
		if (!league || !league.club) { return; }
		const list = nationSquads(league);
		const card = el("div", "lg-cup lg-nations");
		card.append(el("h4", "", "Nations"), el("p", "detail", "National squads picked from the players in your save: the best eleven by position, then a bench of five. Gaps are filled with uncapped players."));
		const ul = el("ul", "nat-list");
		for (const s of list) {
			const li = el("li"), d = el("details"), sm = el("summary");
			const dot = el("span", "nat-dot"); dot.style.background = s.ident.color; dot.style.borderColor = s.ident.color2;
			sm.append(dot, el("b", "", s.ident.name), el("span", "stars", ` ${stars(Math.round(s.str))}`), el("span", "detail", ` · OVR ${Math.round(s.ovr)} · ${s.count} in the save${s.filled ? ` · ${s.filled} uncapped` : ""}`));
			d.append(sm);
			const xi = el("ol", "nat-xi");
			const row = (e, tag) => { const r = el("li", e.own ? "mine" : ""); r.append(el("span", "pos", tag || POS_LABEL[e.pl.pos]), el("span", "who", `${e.pl.name} · ${ovrOf(e.pl)} · ${e.club}`)); return r; };
			for (const i of slotsFor(league.fmt)) { if (s.xi[i]) { xi.append(row(s.xi[i])); } }
			d.append(xi);
			if (s.bench.length) { d.append(el("span", "eyebrow", "Bench")); const b = el("ol", "nat-xi"); for (const e of s.bench) { b.append(row(e)); } d.append(b); }
			li.append(d); ul.append(li);
		}
		card.append(ul);
		box.append(card);
	}
	queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { nationSquads, nationSquad, nationIdent, strOfOvr, intlPool, pickNation, renderNations, NATIONS }); } });
