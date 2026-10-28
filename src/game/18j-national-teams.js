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
		const id = { nat, name: N[0], short: nat, color, color2: foreignSecond(color), ground: "National Stadium" };
		// An option file's nations section (18g): its own shirt, second colour and ground, already checked.
		const e = typeof league !== "undefined" && league && league.edits && league.edits.nations && league.edits.nations[nat];
		if (e) {
			if (e.color) { id.color = e.color; id.color2 = e.color2 || foreignSecond(e.color); }
			if (e.color2) { id.color2 = e.color2; }
			if (e.ground) { id.ground = e.ground; }
		}
		return id;
	}
	let intlCache = null;
	const intlKey = lg => `${lg.season}|${lg.round >= JANUARY ? 2 : 1}|${lg.fmt}|${[ ...lg.club.squad, ...lg.club.bench ].map(p => p && p.name).join(",")}|${(lg.club.market || []).length}|${JSON.stringify((lg.edits && lg.edits.nations) || {})}`;
	// Everyone in the save who could be picked, with where he plays.
	function intlPool (lg) {
		const out = [], add = (pl, club, own) => { if (pl && NATIONS[pl.nat]) { out.push({ pl, club, own }); } };
		const mine = !(lg.intl && lg.intl.only);   // country only: your old club's players are anyone else's (the club has a CPU manager)
		for (const p of [ ...(lg.club.squad || []), ...(lg.club.bench || []) ]) { add(p, YOU.name, mine); }
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

	/* ---------- international breaks ----------
	   Three a season, after league matchdays 9, 20 and 30 (none on a League Cup or continental night).
	   Odd seasons are the qualifiers: every country in groups of five or six, one round-robin over five
	   nights (two at each of the first two breaks, one at the last); the group winners, runners-up and
	   best thirds (on points a game, since the groups differ in size) fill next season's finals.
	   Even seasons are the World Championship: the countries through (16 with 32 in the save, else 8 or 4)
	   in groups of four, matchdays 1 and 2 at the first break, 3 and the quarter-finals at the second, the
	   semi-finals and the final at the last, all at neutral grounds; the top two of each group go on. Everyone else's games are played out from the two
	   squads' strength; yours, if you manage a country, are real fixtures, played through the
	   continental cup's guest seat (18f). */
	const INTL_BREAKS = [ 9, 20, 30 ];
	const INTL_KO = { r16: "Round of 16", qf: "Quarter-final", sf: "Semi-final", f: "Final" };
	// Two tournaments take turns in the even seasons: the World Championship (every country) in seasons 2, 6, 10 ... and the
	// European Nations Cup (the "home" and "europe" regions only) in seasons 4, 8, 12 ... Each is qualified for the season before.
	const INTL_TOURS = { wc: "World Championship", eu: "European Nations Cup" };
	const intlTourOf = season => { const yr = season % 2 ? season + 1 : season; return Math.floor(yr / 2) % 2 ? "wc" : "eu"; };
	const tn = C => INTL_TOURS[(C && C.tour) || "wc"];
	const inEurope = nat => NATIONS[nat] && (NATIONS[nat][1] === "europe" || NATIONS[nat][1] === "home");
	const intlPoolNats = (key, lg) => nationSquads(lg).map(s => s.nat).filter(n => key === "wc" || inEurope(n));
	// The finals: the biggest of 16, 8 or 4 that at most half the countries fill; groups of four, the top two go through.
	const intlFinalsSize = n => (n >= 32 ? 16 : n >= 16 ? 8 : 4);
	// The finals' nights: group matchdays 1 and 2 at the first break, 3 and the quarter-finals at the second, the rest at the last.
	const intlFinalsNights = T => [ { r: 9, stage: "g", md: 1 }, { r: 9, stage: "g", md: 2 }, { r: 20, stage: "g", md: 3 }, ...(T >= 16 ? [ { r: 20, stage: "qf" } ] : []), { r: 30, stage: "sf" }, { r: 30, stage: "f" } ];
	const intlWhat = (C, g) => (C.kind === "q" ? "Qualifier" : g.stage ? INTL_KO[g.stage] : `Group ${groupLetter(g.grp)}`);
	const INTL_GROUP_NIGHTS = [ 9, 9, 20, 20, 30 ];
	const groupLetter = g => String.fromCharCode(65 + g);
	const natName = nat => (NATIONS[nat] ? NATIONS[nat][0] : nat);
	const intlStr = (nat, lg = league) => { const s = nationSquad(nat, lg); return s ? s.str : 2; };
	// A national manager's name: invented, from the same tables as club staff (17) and players (04).
	const intlManager = nat => { const h = hashStr(`${nat}|manager`); return `${FIRST[h % FIRST.length]} ${SURNAMES[(h >>> 7) % SURNAMES.length]}`; };
	const intlNone = season => ({ v: 1, season, none: true });
	// The qualifying draw: pots by strength, one from each pot into each group.
	function drawQualifiers (lg) {
		const tour = intlTourOf(lg.season), list = intlPoolNats(tour, lg), N = list.length, G = Math.max(1, Math.floor(N / (N >= 20 ? 5 : 4)));
		const groups = Array.from({ length: G }, () => []);
		for (let k = 0; k < N; k += G) {
			const pot = shuffle(list.slice(k, k + G)), order = shuffle(groups.map((g, i) => i)).sort((a, b) => groups[a].length - groups[b].length);
			pot.forEach((nat, j) => groups[order[j]].push(nat));
		}
		const games = [];
		groups.forEach((grp, gi) => {
			const rr = roundRobin(grp.length % 2 ? [ ...grp, null ] : grp.slice());
			rr.slice(0, INTL_GROUP_NIGHTS.length).forEach((pairs, n) => { for (const [ h, a ] of pairs) { if (h && a) { games.push({ h, a, n, grp: gi }); } } });
		});
		return { v: 1, season: lg.season, kind: "q", groups, games, nights: INTL_GROUP_NIGHTS.map((r, k) => ({ r, md: k + 1 })), night: 0, done: false, qualified: [], qn: intlFinalsSize(N), tour };
	}
	// The finals: last season's qualifiers if there were any (an old save: the strongest), seeded by strength into
	// pots of one per group, groups of four; the top two of each go on, winners against another group's runners-up.
	function drawTournament (lg, I) {
		const str = nat => intlStr(nat, lg), tour = intlTourOf(lg.season), pool = intlPoolNats(tour, lg), T = intlFinalsSize(pool.length);
		let teams = I && I.next && I.next.season === lg.season && [ 4, 8, 16 ].includes(I.next.nats.length) ? I.next.nats.slice() : pool.slice(0, T);
		teams = teams.sort((a, b) => str(b) - str(a));
		const G = teams.length / 4, groups = Array.from({ length: G }, () => []);
		for (let k = 0; k < 4; k++) { shuffle(teams.slice(k * G, k * G + G)).forEach((nat, j) => groups[j].push(nat)); }
		const games = [];
		groups.forEach((grp, gi) => roundRobin(grp.slice()).forEach((pairs, n) => { for (const [ h, a ] of pairs) { games.push({ h, a, n, grp: gi, neutral: true }); } }));
		return { v: 1, season: lg.season, kind: "t", tour, teams, groups, games, nights: intlFinalsNights(teams.length), night: 0, done: false, winner: null };
	}
	const drawIntl = (lg, I) => (lg.season % 2 ? drawQualifiers(lg) : drawTournament(lg, I));
	// lg.intl: versioned and optional. An older save gets no national job and no breaks until next season.
	const natOk = n => typeof n === "string" && Object.prototype.hasOwnProperty.call(NATIONS, n);
	function intlCompOk (C, lg) {
		if (!plainObj(C) || C.v !== 1 || C.season !== lg.season) { return false; }
		if (C.none) { return true; }
		if (!Array.isArray(C.games) || !Array.isArray(C.nights) || !C.nights.length || !Number.isInteger(C.night) || C.night < 0 || C.night > C.nights.length) { return false; }
		if (!C.nights.every(n => plainObj(n) && Number.isInteger(n.r))) { return false; }
		if (!C.games.every(g => plainObj(g) && natOk(g.h) && natOk(g.a) && Number.isInteger(g.n) && g.n >= 0 && g.n < C.nights.length && (g.hg === undefined || (Number.isInteger(g.hg) && Number.isInteger(g.ag))))) { return false; }
		if (C.kind === "q") { return Array.isArray(C.groups) && C.groups.every(g => Array.isArray(g) && g.every(natOk)) && Array.isArray(C.qualified) && C.qualified.every(natOk); }
		return C.kind === "t" && Array.isArray(C.teams) && C.teams.every(natOk) && (C.groups === undefined || (Array.isArray(C.groups) && C.groups.every(g => Array.isArray(g) && g.every(natOk))));
	}
	function ensureIntl (lg) {
		if (!lg || !lg.club) { return null; }
		let I = lg.intl;
		if (!plainObj(I) || I.v !== 1) { I = lg.intl = { v: 1, nat: null, offers: [], record: [], season: lg.season, missed: 0, rest: [], next: null, comp: intlNone(lg.season) }; }
		if (!natOk(I.nat)) { I.nat = null; }
		I.only = I.only === true;   // true: no club, the country is the whole job (or neither, after resigning)
		I.offers = Array.isArray(I.offers) ? I.offers.filter(o => plainObj(o) && natOk(o.nat) && o.season === lg.season).slice(0, 1) : [];
		I.record = Array.isArray(I.record) ? I.record.filter(r => plainObj(r) && natOk(r.nat) && natOk(r.opp) && Number.isInteger(r.gf) && Number.isInteger(r.ga)).slice(-30) : [];
		I.missed = Number.isInteger(I.missed) ? clamp(I.missed, 0, 2) : 0;
		I.rest = Array.isArray(I.rest) ? I.rest.filter(n => typeof n === "string").slice(0, 30) : [];
		if (!(plainObj(I.next) && Number.isInteger(I.next.season) && Array.isArray(I.next.nats) && I.next.nats.every(natOk))) { I.next = null; }
		if (I.ask !== undefined && typeof I.ask !== "string") { delete I.ask; }
		I.season = lg.season;
		if (!intlCompOk(I.comp, lg)) { I.comp = intlNone(lg.season); }
		return I;
	}
	const intlComp = (lg = league) => { const I = ensureIntl(lg); return I ? I.comp : null; };
	// A new season: the job, the record and the qualifiers carry over; the offers lapse; a new draw.
	function intlNewSeason (prev) {
		const lg = league, P = prev && plainObj(prev.intl) && prev.intl.v === 1 ? prev.intl : null;
		lg.intl = { v: 1, nat: P && natOk(P.nat) ? P.nat : null, offers: [], record: P && Array.isArray(P.record) ? P.record.slice(-30) : [], season: lg.season, only: !!(P && P.only === true), missed: P && Number.isInteger(P.missed) ? P.missed : 0, rest: [], next: P && P.next ? P.next : null, comp: intlNone(lg.season) };
		ensureIntl(lg);
		lg.intl.comp = drawIntl(lg, lg.intl);
		const C = lg.intl.comp, me = lg.intl.nat;
		if (C.kind === "q") { lg.news = `${lg.news || ""} Qualifiers for the ${INTL_TOURS[C.tour]} this season: breaks after matchdays 9, 20 and 30.${me ? ` ${natName(me)} are in Group ${groupLetter(C.groups.findIndex(g => g.includes(me)))}.` : ""}`.trim(); }
		else { lg.news = `${lg.news || ""} The ${tn(C)} is played over the breaks after matchdays 9, 20 and 30: ${C.teams.length} countries in groups of four, then knockouts. ${C.teams.map(natName).join(", ")}.${me ? (C.teams.includes(me) ? ` ${natName(me)} are in it.` : ` ${natName(me)} didn't qualify.`) : ""}`.trim(); }
	}
	// A game played out from the two squads' strength; a knockout tie level after ninety minutes goes to extra time, then penalties.
	function intlPlay (g, lg = league) {
		const sa = intlStr(g.h, lg), sb = intlStr(g.a, lg), d = sa - sb + (g.neutral ? 0 : 0.3);
		g.hg = poisson(clamp(1.3 + 0.32 * d, 0.3, 3.2)); g.ag = poisson(clamp(1.3 - 0.32 * d, 0.25, 3));
		if (g.stage) { intlDecide(g, lg); }
	}
	function intlDecide (g, lg = league) {
		if (g.hg !== g.ag) { return; }
		const sa = intlStr(g.h, lg), sb = intlStr(g.a, lg), d = sa - sb;
		g.et = true;
		g.hg += poisson(clamp(0.38 + 0.08 * d, 0.1, 0.8)); g.ag += poisson(clamp(0.32 - 0.08 * d, 0.1, 0.8));
		if (g.hg === g.ag) { g.pens = cupPens(sa, sb); }
	}
	const intlWinner = g => (g.hg === undefined ? null : g.pens ? (g.pens[0] > g.pens[1] ? g.h : g.a) : g.hg > g.ag ? g.h : g.hg < g.ag ? g.a : null);
	const intlScore = g => `${natName(g.h)} ${g.hg}–${g.ag} ${natName(g.a)}${g.pens ? ` (after extra time, ${g.pens[0]}–${g.pens[1]} on penalties)` : g.et ? " (after extra time)" : ""}`;
	function intlGroupTable (C, gi) {
		const rows = new Map(C.groups[gi].map(nat => [ nat, { nat, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 } ]));
		for (const g of C.games) {
			if (g.grp !== gi || g.hg === undefined) { continue; }
			const H = rows.get(g.h), A = rows.get(g.a);
			H.p++; A.p++; H.gf += g.hg; H.ga += g.ag; A.gf += g.ag; A.ga += g.hg;
			if (g.hg > g.ag) { H.w++; A.l++; H.pts += 3; } else if (g.hg < g.ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
		}
		return [ ...rows.values() ].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.nat.localeCompare(y.nat));
	}
	// Who goes through to the finals: every group winner, then the runners-up, then the best of the thirds (and so
	// on), each batch on points a game (the groups differ in size), until the finals are full.
	function intlQualified (C) {
		const tables = C.groups.map((g, gi) => intlGroupTable(C, gi)), per = (r, k) => (r.p ? r[k] / r.p : 0), n = C.qn || 8, out = [];
		const rank = rows => rows.sort((x, y) => per(y, "pts") - per(x, "pts") || per(y, "gf") - per(y, "ga") - (per(x, "gf") - per(x, "ga")) || per(y, "gf") - per(x, "gf") || x.nat.localeCompare(y.nat));
		for (let pos = 0; pos < 6 && out.length < n; pos++) {
			const batch = rank(tables.map(t => t[pos]).filter(Boolean)).map(r => r.nat);
			out.push(...(pos === 0 ? batch : batch.slice(0, n - out.length)));
		}
		return out.slice(0, n);
	}
	// Your game on the night that is due, if you manage a country and it plays.
	function intlMine (lg, C) {
		const nat = lg && lg.intl && lg.intl.nat;
		if (!nat || !C || C.none || C.done) { return -1; }
		const night = C.nights[C.night];
		if (!night || night.r > lg.round) { return -1; }
		return C.games.findIndex(g => g.n === C.night && g.hg === undefined && (g.h === nat || g.a === nat));
	}
	// After a night: the group stage's end, or the next knockout round.
	function intlAdvance (lg, C, k) {
		const I = lg.intl, me = I.nat, news = [];
		if (C.kind === "q") {
			if (k !== C.nights.length - 1) { return; }
			C.qualified = intlQualified(C); C.done = true;
			I.next = { season: C.season + 1, nats: C.qualified.slice() };
			news.push(`International qualifying is over: ${C.qualified.map(natName).join(", ")} go to next season's ${tn(C)}.`);
			if (me && C.tour === "eu" && !inEurope(me)) { news.push(`${natName(me)} are not a European side: there is no ${tn(C)} for them.`); }
			else if (me) {
				if (C.qualified.includes(me)) { I.missed = 0; news.push(`${natName(me)} are through.`); }
				else {
					I.missed = (I.missed || 0) + 1;
					if (I.missed >= 2) { news.push(`${natName(me)} missed the tournament for the second time running, and the FA have let you go.`); intlEndJob(lg, "sacked"); }
					else { news.push(`${natName(me)} missed out. Miss the next one too and the FA will look for someone else.`); }
				}
			}
		} else {
			const stage = C.nights[k].stage, games = C.games.filter(g => g.n === k), wins = games.map(intlWinner), nextStage = C.nights[k + 1] && C.nights[k + 1].stage;
			if (stage === "g") {
				if (nextStage === "g") { return; }
				const tabs = C.groups.map((g, gi) => intlGroupTable(C, gi)), G = tabs.length, W = tabs.map(t => t[0].nat), R = tabs.map(t => t[1].nat), ties = [];
				for (let p = 0; p < G; p += 2) { ties.push([ W[p], R[p + 1] ]); }
				for (let p = 0; p < G; p += 2) { ties.push([ W[p + 1], R[p] ]); }
				for (const [ h, a ] of ties) { C.games.push({ h, a, n: k + 1, stage: nextStage, neutral: true }); }
				if (me) {
					const mg = C.groups.findIndex(g => g.includes(me)), pos = mg < 0 ? 0 : tabs[mg].findIndex(r => r.nat === me) + 1;
					if (pos) { news.push(pos <= 2 ? `${natName(me)} finished ${ordinal(pos)} in Group ${groupLetter(mg)} and go through to the ${INTL_KO[nextStage].toLowerCase()}s.` : `${natName(me)} finished ${ordinal(pos)} in Group ${groupLetter(mg)} and are out of the ${tn(C)}.`); }
				}
				news.push(`${tn(C)} groups are over: ${[ ...W, ...R ].map(natName).join(", ")} go through.`);
			} else if (stage === "f") {
				C.winner = wins[0]; C.done = true;
				news.push(`${tn(C)} final: ${intlScore(games[0])}. ${natName(C.winner)} are the winners.`);
				if (me && C.winner === me) { news.push(`You've won the ${tn(C)} with ${natName(me)}!`); if (typeof queueTrophy === "function") { queueTrophy(tn(C)); } }
			} else {
				for (let j = 0; j + 1 < wins.length; j += 2) { C.games.push({ h: wins[j], a: wins[j + 1], n: k + 1, stage: nextStage, neutral: true }); }
				if (me && games.some(g => g.h === me || g.a === me)) { news.push(wins.includes(me) ? `${natName(me)} are into the ${INTL_KO[nextStage].toLowerCase()}${nextStage === "sf" ? "s" : ""}.` : `${natName(me)} are out of the ${tn(C)}.`); }
			}
		}
		if (news.length) { lg.news = `${lg.news || ""} ${news.join(" ")}`.trim(); }
	}
	// The nights: open each one that is due, play everyone else's games, and stop at yours until it is played.
	function intlNight () {
		const lg = league, C = intlComp(lg);
		if (!C || C.none) { return; }
		const me = lg.intl.nat;
		while (!C.done && C.night < C.nights.length && C.nights[C.night].r <= lg.round) {
			const k = C.night;
			for (const g of C.games) { if (g.n === k && g.hg === undefined && !(me && (g.h === me || g.a === me))) { intlPlay(g, lg); } }
			if (intlMine(lg, C) >= 0) { break; }   // wait for yours
			C.night++;
			intlAdvance(lg, C, k);
		}
	}
	const intlLabel = (C, g) => (C.kind === "q" ? `International · Qualifier, Group ${groupLetter(g.grp)}` : g.stage ? `International · ${INTL_KO[g.stage]}` : `International · ${tn(C)}, Group ${groupLetter(g.grp)}`);
	// Your next game as a fixture (see currentFixture, 14): the other country borrows the guest seat.
	function intlFixture () {
		const lg = league, C = intlComp(lg), gi = intlMine(lg, C);
		if (gi < 0) { if (lg && lg.contGuest && lg.contGuest.intl) { restoreGuest(lg); } return null; }
		const g = C.games[gi], me = lg.intl.nat, other = g.h === me ? g.a : g.h, s = nationSquad(other, lg);
		const slot = applyGuest(lg, { ...s.ident, str: s.str, manager: intlManager(other), managerNat: other });
		if (slot < 0) { return null; }
		lg.contGuest.intl = true;
		return { round: lg.round, home: g.neutral ? true : g.h === me, opp: slot, intl: { gi, season: C.season, nat: other }, label: intlLabel(C, g), neutral: !!g.neutral };
	}

	/* Your national side on the night: the squad called up (less your own injured or rested players), your
	   club's identity swapped for the country's while the match is on, and back again afterwards. */
	let intlSide = null, intlYou = null;
	const INTL_YOU_KEYS = [ "name", "color", "color2", "text", "ground", "surface", "pattern", "gk" ];
	function intlRestoreYou () {
		if (!intlYou) { return; }
		for (const k of INTL_YOU_KEYS) { if (intlYou[k] === undefined) { delete YOU[k]; } else { YOU[k] = intlYou[k]; } }
		intlYou = null;
	}
	// The squad you take: the best available, with your own club's injured, banned and rested players left out.
	function intlCallUp (lg = league) {
		const I = ensureIntl(lg);
		if (!I || !I.nat) { return null; }
		const rest = new Set(I.rest), pool = intlPool(lg).filter(e => !((e.own || I.only) && (e.pl.inj > 0 || e.pl.ban > 0 || rest.has(e.pl.name))));
		return pickNation(I.nat, pool, lg);
	}
	const matchSquad = () => (intlSide ? intlSide.club : league && league.club);
	function intlBegin (lm) {
		intlRestoreYou();
		intlSide = null;
		if (!lm || !lm.intl || !league || !league.intl || !league.intl.nat) { return; }
		const side = intlCallUp(league), id = nationIdent(league.intl.nat), opp = nationSquad(lm.intl.nat, league);
		if (!side || !id) { return; }
		intlYou = {};
		for (const k of INTL_YOU_KEYS) { intlYou[k] = YOU[k]; }
		Object.assign(YOU, { name: id.name, color: id.color, color2: id.color2, text: textFor(id.color), ground: id.ground, surface: "grass", pattern: undefined, gk: undefined });
		const u = { training: 0, coaching: 0, defence: 0 };
		intlSide = {
			nat: side.nat, str: side.str,
			club: { squad: side.xi.map(e => e.pl), bench: side.bench.map(e => e.pl), upgrades: u, staff: {}, drill: 30 },
			own: new Set([ ...side.xi, ...side.bench ].filter(e => e.own).map(e => e.pl)),
			opp: opp ? opp.xi.map(e => ({ ...e.pl })) : null
		};
	}
	// Your result: the game, your own players' legs for the next league match, then the rest of the night.
	function recordIntlResult (lm, h, a) {
		const lg = league, C = intlComp(lg), I = lg.intl;
		const g = C && !C.none && C.season === lm.intl.season ? C.games[lm.intl.gi] : null;
		if (!g || g.hg !== undefined || !I.nat) { intlBegin(null); return ""; }
		const me = I.nat;
		[ g.hg, g.ag ] = g.h === me ? [ h, a ] : [ a, h ];
		if (g.stage) { intlDecide(g, lg); }
		// Your club's players who played lose fitness for the next league match, as if they had started one.
		if (intlSide) {
			const played = new Set([ ...team(0).map(p => p.name), ...wentOff ]), sl = slotsFor(lg.fmt);
			const on = [ ...sl.map(i => intlSide.club.squad[i]), ...intlSide.club.bench.filter(pl => cameOn.includes(pl.name)) ].filter(pl => pl && intlSide.own.has(pl) && (played.has(pl.name) || !team(0).length));
			for (const pl of on) { const st = matchSta[pl.name]; pl.fit = clamp(fitOf(pl) - (Number.isFinite(st) ? 4 + (1 - st) * 20 : 10), 40, 100); }
			I.tired = on.map(pl => pl.name);
		}
		matchSta = {};
		const opp = g.h === me ? g.a : g.h, my = g.h === me ? [ g.hg, g.ag ] : [ g.ag, g.hg ];
		I.record = [ ...I.record, { season: C.season, nat: me, opp, gf: my[0], ga: my[1], what: intlWhat(C, g) } ].slice(-30);
		const won = intlWinner(g) === me || (!g.stage && my[0] > my[1]);
		const note = `${intlLabel(C, g).replace(/^International · /, "")}: ${natName(me)} ${my[0]}–${my[1]} ${natName(opp)}${g.pens ? ` (after extra time, ${g.h === me ? g.pens[0] : g.pens[1]}–${g.h === me ? g.pens[1] : g.pens[0]} on penalties)` : g.et ? " (after extra time)" : ""}.`;
		I.lastNote = `${note}${I.tired && I.tired.length ? ` Your club's ${I.tired.join(", ")} played and will be a little tired for the next league match.` : ""}`;
		lg.news = `${lg.news || ""} ${note}`.trim();
		toast(won ? `${natName(me)} win` : my[0] === my[1] && !g.stage ? `${natName(me)} draw` : `${natName(me)} lose`, won ? "#7fd49b" : "#f2b52e");
		restoreGuest(lg);
		intlBegin(null);
		intlNight();
		return note;
	}

	/* The job: an offer at most after a season, from a country near your standing. */
	// Your standing on the 1..5 scale: your squad, where you finished and what you won.
	function intlRep (lg, pos) {
		const n = lg.members.length, cupWon = lg.cup && lg.cup.winner === 0 ? 1 : 0, ccWon = lg.cont && Array.isArray(lg.cont.clubs) && lg.cont.winner !== null && lg.cont.winner !== undefined && lg.cont.clubs[lg.cont.winner] && lg.cont.clubs[lg.cont.winner].id === 0 ? 1 : 0;
		const seasons = lg.career && Array.isArray(lg.career.history) ? lg.career.history.length : 0;
		return clamp(yourStr() + (pos <= 4 ? 0.6 : pos <= n / 2 ? 0.2 : pos > n - 3 ? -0.6 : 0) + 0.4 * (cupWon + ccWon) + Math.min(0.4, seasons * 0.1), 1, 5);
	}
	function intlOffers (pos, rnd = Math.random, force = false) {
		const lg = league, I = ensureIntl(lg);
		if (!I) { return []; }
		I.offers = [];
		if (I.nat) { return []; }   // one national job at a time
		if (!Number.isInteger(pos)) { pos = standings().findIndex(r => r.id === 0) + 1; }
		if (!force && rnd() > (pos <= lg.members.length / 2 ? 0.6 : 0.3)) { return []; }
		const rep = intlRep(lg, pos), mine = HOME_NAT;   // your nationality: the home country your career started in
		const cands = nationSquads(lg).filter(s => Math.abs(s.str - rep) <= 1);
		if (!cands.length) { return []; }
		const w = s => (s.nat === mine ? 2 : 1), total = cands.reduce((t, s) => t + w(s), 0);
		let x = rnd() * total, pick = cands[cands.length - 1];
		for (const s of cands) { x -= w(s); if (x < 0) { pick = s; break; } }
		I.offers = [ { nat: pick.nat, str: pick.str, season: lg.season } ];
		return I.offers;
	}
	function intlEndJob (lg, why) {
		const I = lg && lg.intl;
		if (!I || !I.nat) { return; }
		const was = I.nat;
		I.nat = null; I.missed = 0; I.rest = []; delete I.ask;
		if (why === "club") { I.only = false; }   // a club job is next: the country job is over and so is any time without a club
		if (lg.contGuest && lg.contGuest.intl) { restoreGuest(lg); }
		if (why === "resigned") { lg.news = `${lg.news || ""} You resigned as ${natName(was)} manager.`.trim(); }
		else if (why === "club") { lg.news = `${lg.news || ""} You left the ${natName(was)} job for a club abroad.`.trim(); }
		if (lg === league) { intlNight(); }   // anything of theirs that was waiting is played out
		if (lg === league && why === "sacked") { intlFreeOffers(lg); }
	}
	function acceptIntl (nat) {
		const lg = league, I = ensureIntl(lg), o = I && I.offers.find(x => x.nat === nat);
		if (!o || I.nat) { return false; }
		const club = clubName();
		I.nat = nat; I.only = true; I.offers = []; I.missed = 0; I.rest = [];
		lg.career = { ...(lg.career || { history: [] }), clubs: [ ...((lg.career && lg.career.clubs) || [ club ]), `${natName(nat)} (national team)` ] };
		lg.news = `${lg.news || ""} You left ${club} to manage ${natName(nat)} full-time. ${club} have a new manager.`.trim();
		lastDeal = `You left ${club} and are the new ${natName(nat)} manager. The league carries on without you; you play the internationals.`;
		afterClubChange();
		newMatch();   // the club's matchdays are played for you, up to the next international
		renderLeague();
		return true;
	}
	function declineIntl (nat) {
		const I = ensureIntl(league);
		if (!I) { return; }
		I.offers = I.offers.filter(o => o.nat !== nat);
		lastDeal = `You turned ${natName(nat)} down.`;
		afterClubChange();
	}
	// No club and no country: the club offers come straight away (the career history isn't doubled).
	function intlFreeOffers (lg) {
		if (!lg.intl || !lg.intl.only || lg.intl.nat || (lg.jobOffers || []).length) { return false; }
		const hist = lg.career && Array.isArray(lg.career.history) ? lg.career.history.slice() : null;
		offerJobs();
		if (hist) { lg.career.history = hist; }
		lg.intl.offers = [];
		return true;
	}
	function resignIntl () {
		const lg = league;
		if (!lg || !lg.intl || !lg.intl.nat) { return false; }
		const noClub = lg.intl.only;
		intlEndJob(lg, "resigned");
		lastDeal = "You resigned from the national job.";
		if (noClub && intlFreeOffers(lg)) { lastDeal = "You resigned from the national job. Pick a club from the offers in Club, Career."; }
		afterClubChange();
		return true;
	}
	// An old save that holds a club and a country: the one-time choice (renderIntlOffers shows the card).
	const intlLegacy = (lg = league) => !!(lg && lg.intl && lg.intl.nat && !lg.intl.only);
	function intlLegacyChoose (keepCountry) {
		const lg = league, I = lg && lg.intl;
		if (!intlLegacy(lg)) { return; }
		if (keepCountry) {
			I.only = true; const club = clubName();
			lg.career = { ...(lg.career || { history: [] }), clubs: [ ...((lg.career && lg.career.clubs) || [ club ]), `${natName(I.nat)} (national team)` ] };
			lg.news = `${lg.news || ""} You left ${club} to manage ${natName(I.nat)} full-time. ${club} have a new manager.`.trim();
			lastDeal = `You keep ${natName(I.nat)} and left ${club}.`;
		} else {
			const was = natName(I.nat);
			intlEndJob(lg, "choice");
			lastDeal = `You keep ${clubName()}; the ${was} job is over.`;
		}
		afterClubChange();
		newMatch();
		renderLeague();
	}
	// A club job in another country: the FA asks you to choose (see takeOffer, 18b).
	function intlAsk (key) { const I = ensureIntl(league); if (!I || !I.nat) { return false; } I.ask = key; afterClubChange(); return true; }
	function intlChoose (keepCountry) {
		const I = ensureIntl(league), key = I && I.ask;
		if (!key) { return; }
		delete I.ask;
		if (keepCountry) { league.jobOffers = (league.jobOffers || []).filter(o => offerKey(o) !== key); lastDeal = `You stay with ${natName(I.nat)} and turned the club down.`; afterClubChange(); return; }
		intlEndJob(league, "club");
		takeOffer(key);
	}
	// Cards in Club > Career, in the same list (and markup) as the club offers.
	function renderIntlOffers (ul) {
		const I = league && ensureIntl(league);
		if (!I) { return 0; }
		let n = 0;
		for (const o of I.offers) {
			const li = el("li");
			li.append(el("span", "pos", "NATIONAL"), el("span", "who", `${natName(o.nat)} want you as manager: strength ${"★".repeat(Math.round(o.str))}. You'll leave ${clubName()} to manage ${natName(o.nat)} full-time`));
			const btns = el("span", "bids");
			const a = el("button", "", "Accept"); a.type = "button"; a.addEventListener("click", () => acceptIntl(o.nat));
			const r = el("button", "", "Decline"); r.type = "button"; r.addEventListener("click", () => declineIntl(o.nat));
			btns.append(a, r); li.append(btns);
			li.append(el("span", "ratings", `International offer. Accept and you are no longer ${clubName()}'s manager: it gets a new one. You pick ${natName(o.nat)}'s squad and play their games at the breaks while the league goes on without you. Club offers can still come, and taking one ends the national job. Two missed tournaments in a row and the FA will let you go.`));
			ul.append(li); n++;
		}
		const ask = I.ask && (league.jobOffers || []).find(o => offerKey(o) === I.ask);
		if (I.ask && !ask) { delete I.ask; }
		if (ask && I.nat) {
			const li = el("li", "intl-ask");
			li.append(el("span", "pos", "FA"), el("span", "who", `${ask.name || TEAMS[ask.id].name} want you as manager, but you can't manage a club and a country. Choose.`));
			const btns = el("span", "bids");
			const a = el("button", "", "Take the club job"); a.type = "button"; a.addEventListener("click", () => intlChoose(false));
			const r = el("button", "", `Stay with ${natName(I.nat)}`); r.type = "button"; r.addEventListener("click", () => intlChoose(true));
			btns.append(a, r); li.append(btns);
			li.append(el("span", "ratings", `Take the club job and you leave ${natName(I.nat)}: you won't manage the country any more. Stay, and the club offer is turned down.`));
			ul.append(li); n++;
		}
		if (intlLegacy(league)) {
			const li = el("li", "intl-ask");
			li.append(el("span", "pos", "CHOOSE"), el("span", "who", "Club or country? You can't manage both any more"));
			const btns = el("span", "bids");
			const k = el("button", "", `Keep ${clubName()}`); k.type = "button"; k.id = "intlKeepClub"; k.addEventListener("click", () => intlLegacyChoose(false));
			const c = el("button", "", `Keep ${natName(I.nat)}`); c.type = "button"; c.id = "intlKeepCountry"; c.addEventListener("click", () => intlLegacyChoose(true));
			btns.append(k, c); li.append(btns);
			li.append(el("span", "ratings", `This save has you managing ${clubName()} and ${natName(I.nat)}. Keep the club and the national job ends. Keep the country and you leave ${clubName()}, which gets a new manager.`));
			ul.append(li); n++;
		}
		const box = $("intlJob");
		if (box) {
			box.replaceChildren();
			box.hidden = !(I.nat || I.only);
			if (I.nat && I.only) {
				const rec = I.record.filter(r => r.nat === I.nat), w = rec.filter(r => r.gf > r.ga).length, d = rec.filter(r => r.gf === r.ga).length;
				box.append(el("span", "", `National team: you manage ${natName(I.nat)} full-time and no club. Record: ${rec.length} game${rec.length === 1 ? "" : "s"}, ${w} won, ${d} drawn, ${rec.length - w - d} lost.${I.missed ? " One missed tournament: miss the next and the FA will let you go." : ""} `));
				const b = el("button", "", `Resign from ${natName(I.nat)}`); b.type = "button"; b.id = "intlResign"; b.addEventListener("click", resignIntl);
				box.append(b);
			} else if (I.only) {
				box.append(el("span", "", "You are between jobs: no club and no country. Take one of the offers above to get back to work."));
			} else if (I.nat) {
				const rec = I.record.filter(r => r.nat === I.nat);
				box.append(el("span", "", `National team: ${natName(I.nat)}. Record: ${rec.length} game${rec.length === 1 ? "" : "s"}. `));
				const b = el("button", "", `Resign from ${natName(I.nat)}`); b.type = "button"; b.id = "intlResign"; b.addEventListener("click", resignIntl);
				box.append(b);
			}
		}
		return n;
	}

	/* The Cups tab: the International card (its first line is the Overview's line for the breaks). */
	function intlNext (lg = league) {
		const C = intlComp(lg), I = lg.intl, me = I.nat;
		if (!C || C.none) { return "No internationals this season: the breaks start again next season."; }
		if (C.done) {
			if (C.kind === "q") { return `Qualifying over: ${C.qualified.map(natName).join(", ")} go to next season's ${tn(C)}.${me ? (C.qualified.includes(me) ? ` ${natName(me)} are through.` : ` ${natName(me)} missed out.`) : ""}`; }
			return `${natName(C.winner)} won the ${tn(C)}.${me && C.winner === me ? " That's your side!" : ""}`;
		}
		if (me && C.kind === "q" && C.tour === "eu" && !inEurope(me)) { return `No ${tn(C)} for ${natName(me)} this season: it is for European countries. The breaks pass without a game for you.`; }
		const night = C.nights[C.night], gi = me ? C.games.findIndex(g => g.n === C.night && g.hg === undefined && (g.h === me || g.a === me)) : -1;
		const now = night.r <= lg.round, when = now ? "International break now" : `International break after matchday ${night.r}`;
		if (gi >= 0) {
			const g = C.games[gi], opp = g.h === me ? g.a : g.h;
			return `${when}: ${C.kind === "q" ? `qualifier v ${natName(opp)} (Group ${groupLetter(g.grp)}), ${g.neutral ? "neutral ground" : g.h === me ? "at home" : "away"}` : `${g.stage ? INTL_KO[g.stage].toLowerCase() : `${tn(C)} group ${groupLetter(g.grp)}`} v ${natName(opp)}, neutral ground`}.`;
		}
		const out = me && C.kind === "t" && !C.games.some(g => g.n >= C.night && (g.h === me || g.a === me)) ? ` ${natName(me)} ${C.teams.includes(me) ? "are out" : "aren't in it"}.` : "";
		return `${when}: ${C.kind === "q" ? `qualifiers, group matchday ${night.md}` : `the ${tn(C)}, ${night.stage === "g" ? `group matchday ${night.md}` : `${INTL_KO[night.stage].toLowerCase()}${night.stage === "f" ? "" : "s"}`}`}.${out}`;
	}
	function renderIntl (box) {
		const lg = league, C = intlComp(lg);
		if (!C) { return; }
		const me = lg.intl.nat, card = el("div", "lg-cup lg-intl");
		card.append(el("h4", "", me ? `International · ${natName(me)}` : "International"), el("p", "detail", intlNext(lg)));
		const cell = (tag, txt, cls) => el(tag, cls || "", txt);
		if (!C.none && C.kind === "q") {
			const mineG = me ? C.groups.findIndex(g => g.includes(me)) : -1;
			const order = C.groups.map((g, i) => i).sort((a, b) => (b === mineG) - (a === mineG));
			const d = el("details"); d.open = true;
			d.append(el("summary", "", "Qualifying groups"));
			const grid = el("div", "intl-groups");
			for (const gi of order) {
				const t = el("table", "intl-table"), hr = el("tr");
				for (const h of [ `Group ${groupLetter(gi)}`, "P", "GD", "Pts" ]) { hr.append(cell("th", h)); }
				t.append(hr);
				intlGroupTable(C, gi).forEach((r, i) => {
					const tr = el("tr", `${r.nat === me ? "mine" : ""}${C.done && C.qualified.includes(r.nat) ? " q" : ""}`.trim());
					tr.append(cell("td", `${i + 1} ${natName(r.nat)}`), cell("td", String(r.p)), cell("td", (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga)), cell("td", String(r.pts)));
					t.append(tr);
				});
				grid.append(t);
			}
			d.append(grid, el("p", "detail", `Group winners, then the best runners-up and thirds (on points a game), fill the ${C.qn || 8} places in next season's ${tn(C)}.`));
			card.append(d);
			const lastN = C.night - 1, played = C.games.filter(g => g.hg !== undefined && (g.n === lastN || (me && (g.h === me || g.a === me))));
			if (played.length) {
				const r = el("details");
				r.append(el("summary", "", me ? "Results: your games and the last night" : "Results: the last night"));
				const ul = el("ul", "cup-ties");
				for (const g of played.sort((x, y) => ((y.h === me || y.a === me) - (x.h === me || x.a === me)) || y.n - x.n)) { ul.append(el("li", g.h === me || g.a === me ? "mine" : "", `MD${g.n + 1} · ${intlScore(g)}`)); }
				r.append(ul); card.append(r);
			}
		} else if (!C.none) {
			const d = el("details"); d.open = true;
			d.append(el("summary", "", tn(C)));
			if (C.groups) {
				const mg = me ? C.groups.findIndex(g => g.includes(me)) : -1, grid = el("div", "intl-groups");
				for (const gi of C.groups.map((g, i) => i).sort((a, b) => (b === mg) - (a === mg))) {
					const t = el("table", "intl-table"), hr = el("tr");
					for (const h of [ `Group ${groupLetter(gi)}`, "P", "GD", "Pts" ]) { hr.append(cell("th", h)); }
					t.append(hr);
					intlGroupTable(C, gi).forEach((r, i) => {
						const tr = el("tr", `${r.nat === me ? "mine" : ""}${i < 2 ? " q" : ""}`.trim());
						tr.append(cell("td", `${i + 1} ${natName(r.nat)}`), cell("td", String(r.p)), cell("td", (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga)), cell("td", String(r.pts)));
						t.append(tr);
					});
					grid.append(t);
				}
				d.append(grid, el("p", "detail", "The top two in each group go through."));
			}
			for (const st of [ "r16", "qf", "sf", "f" ]) {
				const games = C.games.filter(g => g.stage === st);
				if (!games.length) { continue; }
				d.append(el("span", "eyebrow", st === "f" ? "Final" : `${INTL_KO[st]}s`));
				const ul = el("ul", "cup-ties");
				for (const g of games) { const w = intlWinner(g); ul.append(el("li", g.h === me || g.a === me ? "mine" : "", g.hg === undefined ? `${natName(g.h)} v ${natName(g.a)}` : `${intlScore(g)} · ${natName(w)} through`)); }
				d.append(ul);
			}
			card.append(d);
		}
		box.append(card);
	}

	/* The Squad tab: your national squad, the best available by default, with your own club's players left out on request. */
	function intlRestToggle (name) {
		const I = ensureIntl(league);
		if (!I || !I.nat) { return; }
		I.rest = I.rest.includes(name) ? I.rest.filter(n => n !== name) : [ ...I.rest, name ];
		saveLeague(); renderIntlSquad();
	}
	function intlAutoPick () { const I = ensureIntl(league); if (!I) { return; } I.rest = []; saveLeague(); renderIntlSquad(); }
	function renderIntlSquad () {
		const box = $("intlSquad");
		if (!box) { return; }
		box.replaceChildren();
		const I = league && league.club ? ensureIntl(league) : null;
		box.hidden = !(I && I.nat);
		if (box.hidden) { return; }
		const side = intlCallUp(league), auto = !I.rest.length;
		const head = el("div", "sq-head");
		head.append(el("h4", "", `International · ${natName(I.nat)}`), el("span", "lg-meta", `${stars(Math.round(side.str))} · OVR ${Math.round(side.ovr)}`));
		const ap = el("button", "", "Auto-pick best XI"); ap.type = "button"; ap.id = "intlAuto"; ap.setAttribute("aria-pressed", String(auto)); ap.addEventListener("click", intlAutoPick);
		head.append(ap);
		box.append(head, el("p", "win-note", `${intlNext(league)} ${auto ? "Auto-pick: the best eleven in the save by position." : "Your picks: the players you left out are below."} ${I.only ? "" : "Your club's players who play lose fitness for the next league match, as a start would cost them."}`));
		const ol = el("ol", "nat-xi"), row = (e, on) => {
			const r = el("li", e.own ? "mine" : "");
			r.append(el("span", "pos", POS_LABEL[e.pl.pos]), el("span", "who", `${e.pl.name} · ${ovrOf(e.pl)} · ${e.club}${e.own ? ` · fit ${Math.round(fitOf(e.pl))}%` : ""}`));
			if (e.own || I.only) { const b = el("button", "", on ? "Leave out" : "Recall"); b.type = "button"; b.addEventListener("click", () => intlRestToggle(e.pl.name)); r.append(b); }
			return r;
		};
		for (const i of slotsFor(league.fmt)) { if (side.xi[i]) { ol.append(row(side.xi[i], true)); } }
		box.append(ol);
		if (side.bench.length) { box.append(el("span", "eyebrow", "Bench")); const b = el("ol", "nat-xi"); for (const e of side.bench) { b.append(row(e, true)); } box.append(b); }
		const out = I.only ? intlPool(league).filter(e => e.pl.nat === I.nat && I.rest.includes(e.pl.name)) : [ ...league.club.squad, ...league.club.bench ].filter(pl => I.rest.includes(pl.name)).map(pl => ({ pl, own: true, club: clubName() }));
		if (out.length) { box.append(el("span", "eyebrow", "Left out")); const b = el("ol", "nat-xi"); for (const e of out) { b.append(row(e, false)); } box.append(b); }
	}
	/* Country only (lg.intl.only): no club. The league season still runs; your old club is played by the computer
	   (its matches are simulated for you), and this runs them up to your next international. */
	const clubName = () => (intlYou && intlYou.name !== undefined ? intlYou.name : YOU.name);   // your club's name, even with the country's kit swapped in
	const intlNoClub = (lg = league) => !!(lg && lg.intl && lg.intl.only);
	function intlOnlyAdvance () {
		const lg = league;
		if (!lg || !intlNoClub(lg) || bulkSim || mode !== "league" || seasonDone()) { return; }
		let f = currentFixture();
		if (!f || f.intl) { return; }
		bulkSim = true;
		try {
			for (let guard = 0; guard < 90 && !seasonDone(); guard++) {
				f = currentFixture();
				if (!f || f.intl) { break; }
				clearLive(); state = "intro"; newMatch();
				if (!leagueMatch || leagueMatch.intl) { break; }
				simulateMine();
			}
		} finally { bulkSim = false; }
		saveLeague(); clearLive(); state = "intro"; banner.hidden = true;
	}
	// The tabs that are about a club: a short note instead, with the layout left alone.
	function renderIntlOnly () {
		const on = intlNoClub(), I = league && league.intl, note = I && I.nat ? `You manage ${natName(I.nat)}. No club duties.` : "You have no club. Take one of the job offers in Club, Career.";
		for (const id of [ "sqBox", "transfersBox", "assistCard", "coachPanel", "clubUpgrades", "lgAcademy" ]) { const b = $(id); if (b) { b.hidden = on; } }
		for (const id of [ "sqNoClub", "transfersNoClub", "clubNoClub" ]) { const b = $(id); if (b) { b.hidden = !on; b.textContent = note; } }
	}
	queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { intlOnlyAdvance, intlFreeOffers, intlNoClub, intlLegacy, intlLegacyChoose, renderIntlOnly, nationSquads, nationSquad, nationIdent, strOfOvr, intlPool, pickNation, renderNations, NATIONS, INTL_BREAKS, ensureIntl, intlComp, intlNight, intlFixture, intlOffers, acceptIntl, declineIntl, resignIntl, intlChoose, intlCallUp, intlGroupTable, intlQualified, intlManager, intlNext, intlNewSeason, renderIntlSquad, intlRestToggle, intlAutoPick, nameTables: { FIRST, SURNAMES }, intlRep, renderOffers, newMatchTest () { clearLive(); state = "intro"; newMatch(); renderLeague(); }, readyTest () { clearLive(); state = "intro"; banner.hidden = true; newMatch(); showIntro(); renderLeague(); } }); Object.defineProperties(window.__ff, { intlSide: { get: () => intlSide, configurable: true }, leagueMatch: { get: () => leagueMatch, configurable: true } }); } });
