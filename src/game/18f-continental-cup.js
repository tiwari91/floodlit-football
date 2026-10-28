	/* ---------- the Continental Champions Cup ----------
	   The top four of the league qualify for next season's continental cup (or you can start a career in it:
	   Settings, "Start in the Continental Champions Cup"), with twenty-eight clubs from the leagues abroad
	   (named and coloured the way 18c names a country's clubs). The classic format: thirty-two clubs in
	   eight groups of four, one from each of four pots seeded by each club's results over the last five
	   seasons, never two clubs of one country in a group. Each group is a double round-robin over six
	   nights; the top two go through. Then two-legged ties (group winners against runners-up of another
	   group, the winner at home in the second leg) in the round of 16, quarter-finals and semi-finals,
	   and a one-off final at a neutral ground. Level on aggregate after the second leg: extra time, then
	   penalties. The nights fall between league matchdays, like the League Cup's. Your games are real
	   fixtures (play them or simulate them); everyone else's are played out from the two sides' strength.
	   A club from abroad borrows a seat outside the division (the "guest", the last club below it)
	   for as long as your game with it is next, and gives it back afterwards. A cup drawn by the older
	   league-phase format (v1) is dropped on load: that season has no cup, and the next is drawn afresh. */
	const CC_NAME = "Continental Champions Cup", CC_SHORT = "Continental Cup";
	// Played after these league matchdays (none on a League Cup night).
	const CC_NIGHTS = [
		...[ 2, 4, 6, 8, 10, 13 ].map((r, i) => ({ r, stage: "lp", md: i + 1 })),
		{ r: 21, stage: "r16", leg: 1 }, { r: 23, stage: "r16", leg: 2 },
		{ r: 25, stage: "qf", leg: 1 }, { r: 26, stage: "qf", leg: 2 },
		{ r: 28, stage: "sf", leg: 1 }, { r: 29, stage: "sf", leg: 2 },
		{ r: 31, stage: "f" }
	];
	const CC_STAGE = { lp: "Group stage", r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", f: "Final" };
	const CC_PRIZE = { start: 1, win: 0.2, draw: 0.07, r16: 0.6, qf: 0.8, sf: 1.1, f: 1.5, winner: 2 };
	// The countries that send clubs, how many and how strong their best are.
	const CC_NATIONS = [ [ "ESP", 4, 4.9 ], [ "GER", 4, 4.8 ], [ "ITA", 4, 4.7 ], [ "FRA", 4, 4.5 ], [ "POR", 3, 4.2 ], [ "NED", 3, 4.1 ], [ "BEL", 2, 3.7 ], [ "CRO", 2, 3.4 ], [ "DEN", 2, 3.3 ], [ "SWE", 1, 3.1 ], [ "POL", 1, 3.1 ], [ "SRB", 2, 3.2 ], [ "SEN", 0, 0 ] ];
	const ccStr = (C, i) => { const c = C.clubs[i]; return c.id !== undefined ? getStr(c.id) : c.str; };
	const ccName = (C, i) => { const c = C.clubs[i]; return c.id !== undefined ? TEAMS[c.id].name : c.name; };
	const ccMe = C => C.clubs.findIndex(c => c.id === 0);
	// Coefficients: each club's points from the last five seasons; clubs new to the cup start from their standing.
	function ccCoef (lg, c) {
		const h = lg.club && lg.club.contCoef && lg.club.contCoef[c.name];
		const past = Array.isArray(h) ? h.reduce((t, v) => t + (Number(v) || 0), 0) : 0;
		return past + (Array.isArray(h) && h.length >= 5 ? 0 : (c.id !== undefined ? getStr(c.id) : c.str) * 6 * (5 - (Array.isArray(h) ? h.length : 0)));
	}
	// The thirty-two from abroad: each country's clubs, named as 18c names them, the best first.
	function ccForeign (lg, n) {
		const home = lg.ident && lg.ident.country, out = [];
		// Abroad, England takes your country's seats. A league file's clubs (18h) fill a country's seats first.
		const engTop = CLUBS.slice().sort((a, b) => b.str - a.str);
		// Never a guest with the name of a club already in your league (yours included, after a move with it).
		const taken = new Set(TEAMS.map(t => String(t.name).toLowerCase())), free = c => c && !taken.has(c.name.toLowerCase());
		for (const [ cn, k, top ] of CC_NATIONS) {
			const nat = cn === home && FOREIGN[home] ? HOME_NAT : cn;
			if (!k || nat === home || (!FOREIGN[nat] && nat !== HOME_NAT)) { continue; }
			const fc = (typeof fileCupClubs === "function" ? fileCupClubs(nat) : []).filter(free);
			const F = FOREIGN[nat], towns = F ? F[3].split(",") : [], h = hashStr(nat + "cc"), eng = engTop.filter(free);
			for (let j = 0; j < k; j++) {
				const str = round1(clamp(top - j * 0.45 + (Math.random() - 0.5) * 0.4, 1.5, 5)), f = fc[j];
				let c;
				if (F) { const town = towns[j], color = FOREIGN_SHIRTS[(j * 5 + h) % FOREIGN_SHIRTS.length]; c = { name: F[2][(j + h) % F[2].length].replace("{t}", town), short: town, color, color2: foreignSecond(color), ground: F[1].replace("{t}", town) }; }
				else { const e = eng[j]; if (!e && !f) { continue; } c = e ? { name: e.name, short: e.short, color: e.color, color2: e.color2, ground: e.ground } : {}; }
				if (f) { c = { name: f.name, short: f.short || (f.name.length <= 14 ? f.name : f.name.split(" ")[0].slice(0, 14)), color: f.color || c.color, color2: f.color2 || (f.color ? foreignSecond(f.color) : c.color2), ground: f.ground || c.ground, manager: f.manager, managerNat: f.managerNat }; }
				out.push({ ...c, nat, str });
			}
		}
		// A country left out (yours) makes room for the next in line.
		for (let j = 1; out.length < n && j < 4; j++) {
			for (const [ nat ] of CC_NATIONS) {
				if (out.length >= n || nat === home || !FOREIGN[nat]) { continue; }
				const [ , groundPat, pats, townList ] = FOREIGN[nat], towns = townList.split(","), k = out.filter(c => c.nat === nat).length, town = towns[k + 4];
				if (!town) { continue; }
				const color = FOREIGN_SHIRTS[(k * 3 + j) % FOREIGN_SHIRTS.length];
				out.push({ name: pats[(k + j) % pats.length].replace("{t}", town), short: town, color, color2: foreignSecond(color), ground: groundPat.replace("{t}", town), nat, str: round1(clamp(3.4 - k * 0.3, 1.5, 5)) });
			}
		}
		return out.slice(0, n);
	}
	// The group draw: eight groups of four, one club from each pot, nobody from the same country in a group.
	// Each group plays a double round-robin over six nights (the second three the return of the first three).
	function ccGroups (C) {
		const nat = i => C.clubs[i].nat, P = C.clubs.length / 4, pots = [ 0, 1, 2, 3 ].map(k => C.pots.slice(k * P, k * P + P));
		let groups = null;
		for (let tries = 0; tries < 500 && !groups; tries++) {
			const strict = tries < 400, g = Array.from({ length: P }, () => []);
			let bad = false;
			for (const pot of pots) {
				const order = shuffle(pot.slice()), free = g.map((_, k) => k);
				for (const c of order) {
					const k = shuffle(free.slice()).find(x => !strict || !g[x].some(m => nat(m) === nat(c)));
					if (k === undefined) { bad = true; break; }
					g[k].push(c); free.splice(free.indexOf(k), 1);
				}
				if (bad) { break; }
			}
			if (!bad) { groups = g; }
		}
		if (!groups) { return null; }
		const games = [], PAIRS = [ [ [ 0, 1 ], [ 2, 3 ] ], [ [ 2, 0 ], [ 3, 1 ] ], [ [ 0, 3 ], [ 1, 2 ] ] ];
		for (const half of [ 0, 1 ]) {
			PAIRS.forEach((md, m) => groups.forEach((g, gi) => md.forEach(([ x, y ]) => games.push(half ? { h: g[y], a: g[x], n: 3 + m, grp: gi } : { h: g[x], a: g[y], n: m, grp: gi }))));
		}
		C.groups = groups;
		return games.sort((a, b) => a.n - b.n);
	}
	function drawCont (lg, ids) {
		const own = ids.filter(id => TEAMS[id]).map(id => ({ id, name: TEAMS[id].name, nat: "_league" }));
		const clubs = [ ...own, ...ccForeign(lg, 32 - own.length) ];
		const C = { v: 2, season: lg.season, clubs, games: [], groups: [], ties: { r16: [], qf: [], sf: [], f: [] }, night: 0, winner: null, out: null, earned: 0, paid: {} };
		C.pots = clubs.map((c, i) => [ i, ccCoef(lg, c) ]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
		C.games = ccGroups(C) || [];
		if (!C.games.length) { return { v: 2, season: lg.season, none: true }; }
		const me = ccMe(C);
				lg.news = `${lg.news || ""} ${CC_NAME} draw: ${me >= 0 ? `your group: ${C.groups[C.groups.findIndex(g => g.includes(me))].filter(i => i !== me).map(i => ccName(C, i)).join(", ")}.` : `${own.map(c => c.name).join(", ")} go into the group stage.`}`.trim();
		return C;
	}
	// Ready for this season: drawn if the club qualified and the first night is still to come; none otherwise.
	function ensureCont (lg) {
		if (!lg || !Array.isArray(lg.members) || !lg.club) { return null; }
		const c = lg.cont;
		if (c && c.v === 2 && c.season === lg.season && (c.none || (Array.isArray(c.clubs) && Array.isArray(c.games) && Array.isArray(c.groups) && c.ties))) { return c; }
		const q = lg.club.contQual;
		lg.cont = q && q.season === lg.season && Array.isArray(q.ids) && q.ids.length && lg.round <= CC_NIGHTS[0].r ? drawCont(lg, q.ids) : { v: 2, season: lg.season, none: true };
		return lg.cont;
	}
	const ccAgg = (C, t) => {
		const [ g1, g2 ] = t.g.map(i => C.games[i]);
		let a = 0, b = 0;
		for (const g of [ g1, g2 ]) { if (g && g.hg !== undefined) { if (g.h === t.a) { a += g.hg; b += g.ag; } else { b += g.hg; a += g.ag; } } }
		return [ a, b ];
	};
	// Play a game out: ninety minutes from the two sides' strength (a little home advantage, none at the
	// final), and, when a tie is level at the end of it, extra time and penalties.
	function ccPlay (C, g, decide) {
		const neutral = g.neutral, d = ccStr(C, g.h) - ccStr(C, g.a) + (neutral ? 0 : 0.3);
		if (g.hg === undefined) { g.hg = poisson(clamp(1.3 + 0.32 * d, 0.3, 3.2)); g.ag = poisson(clamp(1.3 - 0.32 * d, 0.25, 3)); }
		if (decide) { ccDecide(C, g, decide); }
	}
	function ccDecide (C, g, t) {
		const [ a, b ] = ccAgg(C, t);
		if (a !== b) { return; }
		g.et = true;
		const d = ccStr(C, g.h) - ccStr(C, g.a);
		g.hg += poisson(clamp(0.38 + 0.08 * d, 0.1, 0.8)); g.ag += poisson(clamp(0.32 - 0.08 * d, 0.1, 0.8));
		const [ a2, b2 ] = ccAgg(C, t);
		if (a2 === b2) { g.pens = cupPens(ccStr(C, g.h), ccStr(C, g.a)); }
	}
	const ccWinner = (C, t) => {
		const last = C.games[t.g[t.g.length - 1]];
		if (!last || last.hg === undefined) { return null; }
		if (last.pens) { return last.pens[0] > last.pens[1] ? last.h : last.a; }
		const [ a, b ] = ccAgg(C, t);
		return a > b ? t.a : t.b;
	};
	// A group's table, best first: points, goal difference, goals for, then the draw's seeding.
	function ccTable (C, gi) {
		const rows = C.groups[gi].map(i => ({ i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })), at = new Map(rows.map(r => [ r.i, r ]));
		for (const g of C.games) {
			if (g.grp !== gi || g.hg === undefined) { continue; }
			const H = at.get(g.h), A = at.get(g.a);
			H.p++; A.p++; H.gf += g.hg; H.ga += g.ag; A.gf += g.ag; A.ga += g.hg;
			if (g.hg > g.ag) { H.w++; A.l++; H.pts += 3; } else if (g.hg < g.ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
		}
		return rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || C.pots.indexOf(x.i) - C.pots.indexOf(y.i));
	}
	// A two-legged tie (b, the higher placed, at home second) or the final.
	function ccTie (C, stage, a, b) {
		const k = CC_NIGHTS.findIndex(n => n.stage === stage), t = { a, b, g: [] };
		if (stage === "f") { C.games.push({ h: b, a, n: k, stage, neutral: true }); t.g.push(C.games.length - 1); }
		else { C.games.push({ h: a, a: b, n: k, stage }); C.games.push({ h: b, a, n: k + 1, stage }); t.g.push(C.games.length - 2, C.games.length - 1); }
		C.ties[stage].push(t);
		return t;
	}
	// After a round: who goes where.
	function ccAdvance (lg, C, k) {
		const night = CC_NIGHTS[k], me = ccMe(C), news = [];
		if (night.stage === "lp" && night.md === 6) {
			const tabs = C.groups.map((_, gi) => ccTable(C, gi)), win = tabs.map(t => t[0].i), run = tabs.map(t => t[1].i);
			C.rank = [ ...tabs.map(t => t[0]).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)).map(r => r.i), ...tabs.map(t => t[1]).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)).map(r => r.i) ];
			for (let g = 0; g < win.length; g++) { ccTie(C, "r16", run[g ^ 1], win[g]); }   // winners of one group against the runners-up of the next, at home second
			const gm = C.groups.findIndex(g => g.includes(me)), pos = gm < 0 ? 0 : tabs[gm].findIndex(r => r.i === me) + 1;
			if (me >= 0) {
				if (pos <= 2) { ccPay(lg, C, "r16"); news.push(`Group stage over: you finished ${ordinal(pos)} in your group and go through to the round of 16.`); }
				else { C.out = { stage: "lp", pos }; news.push(`Group stage over: you finished ${ordinal(pos)} in your group and are out.`); }
			} else { news.push(`${CC_SHORT} group stage over: ${ccName(C, C.rank[0])} had the best group record.`); }
		} else if (night.stage !== "lp" && night.leg !== 1) {
			const stage = night.stage, ties = C.ties[stage], wins = ties.map(t => ccWinner(C, t));
			const mine = ties.find(t => t.a === me || t.b === me);
			if (mine) {
				const w = ccWinner(C, mine), [ a, b ] = ccAgg(C, mine), my = mine.a === me ? [ a, b ] : [ b, a ], opp = mine.a === me ? mine.b : mine.a, last = C.games[mine.g[mine.g.length - 1]];
				const how = last.pens ? ` (${Math.max(...last.pens)}–${Math.min(...last.pens)} on penalties)` : last.et ? " (after extra time)" : "";
				const score = stage === "f" ? `${my[0]}–${my[1]}` : `${my[0]}–${my[1]} on aggregate`;
				if (w === me) { if (stage !== "f") { news.push(`${CC_STAGE[stage]}: through against ${ccName(C, opp)}, ${score}${how}.`); } }
				else { C.out = { stage, by: opp }; news.push(`${CC_STAGE[stage]}: out against ${ccName(C, opp)}, ${score}${how}.`); }
			}
			if (stage !== "f") {
				const next = { r16: "qf", qf: "sf", sf: "f" }[stage];
				for (let j = 0; j < wins.length; j += 2) {
					const [ x, y ] = [ wins[j], wins[j + 1] ], better = C.rank.indexOf(x) <= C.rank.indexOf(y);
					ccTie(C, next, better ? y : x, better ? x : y);
				}
				if (wins.includes(me)) { ccPay(lg, C, next); }
			} else {
				C.winner = wins[0];
				const fin = ties[0], [ a, b ] = ccAgg(C, fin), last = C.games[fin.g[0]];
				const line = `${ccName(C, fin.b)} ${b}–${a} ${ccName(C, fin.a)}${last.pens ? ` (after extra time, ${last.pens[0]}–${last.pens[1]} on penalties)` : last.et ? " (after extra time)" : ""}`;
				if (C.winner === me) { ccPay(lg, C, "winner"); news.push(`You've won the ${CC_NAME}! ${line}.`); if (typeof queueTrophy === "function") { queueTrophy(CC_NAME); } }
				else { news.push(`${CC_NAME} final: ${line}. ${ccName(C, C.winner)} are the winners.`); }
				ccCoefUpdate(lg, C);
			}
		}
		if (news.length) { lg.news = `${lg.news || ""} ${news.join(" ")}`.trim(); }
	}
	function ccPay (lg, C, what) {
		if (C.paid[what]) { return; }
		C.paid[what] = true;
		const m = CC_PRIZE[what] || 0;
		if (m) { lg.club.budget = round1(lg.club.budget + m); C.earned = round1((C.earned || 0) + m); }
	}
	// Each club's points for the season go into its coefficient: two a win, one a draw, one for each knockout round reached.
	function ccCoefUpdate (lg, C) {
		const pts = C.clubs.map(() => 0);
		for (const g of C.games) { if (g.hg === undefined) { continue; } if (g.hg > g.ag) { pts[g.h] += 2; } else if (g.hg < g.ag) { pts[g.a] += 2; } else { pts[g.h]++; pts[g.a]++; } }
		for (const st of [ "r16", "qf", "sf", "f" ]) { for (const t of C.ties[st]) { pts[t.a]++; pts[t.b]++; } }
		if (C.winner !== null) { pts[C.winner] += 2; }
		const coef = lg.club.contCoef && typeof lg.club.contCoef === "object" ? lg.club.contCoef : (lg.club.contCoef = {});
		C.clubs.forEach((c, i) => { const name = ccName(C, i); coef[name] = [ ...(Array.isArray(coef[name]) ? coef[name] : []), pts[i] ].slice(-5); });
		const names = Object.keys(coef);
		if (names.length > 120) { for (const n of names.slice(0, names.length - 120)) { delete coef[n]; } }
	}
	// Your game on the night, if you have one still to play.
	function ccMine (C) {
		const me = ccMe(C);
		if (me < 0 || !CC_NIGHTS[C.night] || CC_NIGHTS[C.night].r > league.round) { return null; }   // its night has not come yet
		const gi = C.games.findIndex(g => g.n === C.night && g.hg === undefined && (g.h === me || g.a === me));
		return gi < 0 ? null : gi;
	}
	// The nights: open each one that is due, play everyone else's games, and stop at yours until it is played.
	function contNight () {
		const lg = league, C = ensureCont(lg);
		if (!C || C.none) { return; }
		if (C.season === lg.season && C.night === 0 && !C.paid.start && ccMe(C) >= 0) { ccPay(lg, C, "start"); }
		while (C.night < CC_NIGHTS.length && CC_NIGHTS[C.night].r <= lg.round && C.winner === null) {
			const k = C.night, ties = Object.values(C.ties).flat();
			for (const g of C.games) {
				if (g.n !== k || g.hg !== undefined || (ccMe(C) >= 0 && (g.h === ccMe(C) || g.a === ccMe(C)))) { continue; }
				ccPlay(C, g, ties.find(t => t.g[t.g.length - 1] === C.games.indexOf(g)));
			}
			if (ccMine(C) !== null) { break; }   // wait for yours
			C.night++;
			ccAdvance(lg, C, k);
		}
	}
	// Qualification: at the end of the season, the top four go into next season's cup.
	function contQualify () {
		const lg = league;
		if (!lg || !lg.club || !seasonDone()) { return; }
		const q = standings().slice(0, 4).map(r => r.id);
		if (lg.club.contQual && lg.club.contQual.season === lg.season + 1) { return; }
		lg.club.contQual = { season: lg.season + 1, ids: q };
		const you = q.indexOf(0);
		lg.news = `${lg.news || ""} ${you >= 0 ? `You finished in the top four: you're in the ${CC_NAME} next season.` : `Into next season's ${CC_NAME}: ${q.map(id => TEAMS[id].name).join(", ")}.`}`.trim();
	}
	// The guest: the last club below the division lends its seat to a club from abroad while your game with it is next.
	function guestSlot (lg) {
		for (let i = TEAMS.length - 1; i > 0; i--) { if (!lg.members.includes(i)) { return i; } }
		return -1;
	}
	const GUEST_KEYS = [ "name", "short", "color", "color2", "text", "ink", "ground", "surface", "pattern", "manager", "managerNat" ];
	function applyGuest (lg, c) {
		if (lg.contGuest && lg.contGuest.key === c.name && TEAMS[lg.contGuest.slot] && TEAMS[lg.contGuest.slot].name === c.name) { return lg.contGuest.slot; }
		restoreGuest(lg);
		const slot = guestSlot(lg);
		if (slot < 0) { return -1; }
		const T = TEAMS[slot], orig = {};
		for (const k of GUEST_KEYS) { orig[k] = T[k]; }
		lg.contGuest = { slot, key: c.name, nat: c.nat, orig, str: lg.clubStr ? lg.clubStr[slot] : T.str };   // nat: it plays its country's game (05a)
		Object.assign(T, { name: c.name, short: c.short || c.name, color: c.color, color2: c.color2, text: textFor(c.color), ink: lum(c.color) > 0.55 ? "#1b2420" : "#ffffff", ground: c.ground, surface: "grass", pattern: undefined, manager: c.manager, managerNat: c.managerNat });
		if (lg.clubStr) { lg.clubStr[slot] = c.str; }
		return slot;
	}
	function restoreGuest (lg) {
		const g = lg && lg.contGuest;
		if (!g) { return; }
		const T = TEAMS[g.slot];
		if (T) { for (const k of GUEST_KEYS) { if (g.orig[k] === undefined) { delete T[k]; } else { T[k] = g.orig[k]; } } }
		if (lg.clubStr && g.str !== undefined) { lg.clubStr[g.slot] = g.str; }
		lg.contGuest = null;
	}
	// Your next game, as a fixture the match can be played from (see currentFixture), or null.
	function contFixture () {
		const lg = league, C = ensureCont(lg);
		const gi = C && !C.none ? ccMine(C) : null;
		if (gi === null) { if (lg && lg.contGuest) { restoreGuest(lg); } return null; }
		const g = C.games[gi], me = ccMe(C), o = g.h === me ? g.a : g.h, oc = C.clubs[o], night = CC_NIGHTS[g.n];
		const opp = oc.id !== undefined ? (restoreGuest(lg), oc.id) : applyGuest(lg, oc);
		if (opp < 0) { return null; }
		const label = `${CC_SHORT} · ${night.stage === "lp" ? `Group stage, matchday ${night.md}` : `${CC_STAGE[night.stage]}${night.leg ? `, ${night.leg === 1 ? "first" : "second"} leg` : ""}`}`;
		return { round: lg.round, home: g.h === me, opp, cont: { gi, season: C.season }, label, neutral: !!g.neutral };
	}
	// Your result, from a played or simulated match: the rest of the night follows.
	function recordContResult (lm, h, a) {
		const lg = league, C = ensureCont(lg);
		if (!C || C.none || !lm.cont || lm.cont.season !== C.season) { return ""; }
		const g = C.games[lm.cont.gi], me = ccMe(C);
		if (!g || g.hg !== undefined) { return ""; }
		[ g.hg, g.ag ] = g.h === me ? [ h, a ] : [ a, h ];
		const tie = Object.values(C.ties).flat().find(t => t.g[t.g.length - 1] === lm.cont.gi);
		if (tie) { ccDecide(C, g, tie); }
		if (!g.stage && h >= a) { ccPay(lg, C, (h > a ? "win" : "draw") + g.n); }
		const opp = g.h === me ? g.a : g.h, mine = g.h === me ? [ g.hg, g.ag ] : [ g.ag, g.hg ];
		const extra = g.pens ? ` After extra time it went to penalties: ${g.h === me ? g.pens[0] : g.pens[1]}–${g.h === me ? g.pens[1] : g.pens[0]}.` : g.et ? " It went to extra time." : "";
		const night = CC_NIGHTS[g.n];
		const note = `${CC_SHORT}, ${night.stage === "lp" ? `group stage matchday ${night.md}` : `${CC_STAGE[night.stage].toLowerCase()}${night.leg ? `, ${night.leg === 1 ? "first" : "second"} leg` : ""}`}: ${g.h === me ? `you ${mine[0]}–${mine[1]} ${ccName(C, opp)}` : `${ccName(C, opp)} ${mine[1]}–${mine[0]} you`}.${extra}`;
		lg.news = `${lg.news || ""} ${note}`.trim();
		restoreGuest(lg);
		contNight();
		return note;
	}
	// Prize money for league-phase results: a win or a draw, paid once per game.
	for (let n = 0; n < 6; n++) { CC_PRIZE["win" + n] = CC_PRIZE.win; CC_PRIZE["draw" + n] = CC_PRIZE.draw; }
	// The way in: where you stand against the top four, for the Cups tab and the Overview.
	function ccPath (lg) {
		if (!lg || !lg.club) { return ""; }
		const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1, me = rows[pos - 1];
		if (seasonDone()) { return pos <= 4 ? "" : `You finished ${ordinal(pos)}: the top four qualify for the ${CC_NAME}.`; }
		const gap = rows[3].pts - me.pts;
		return `Finish top 4 to qualify for next season's ${CC_NAME}. You are ${ordinal(pos)}${pos <= 4 ? ", inside the places" : `, ${gap} point${gap === 1 ? "" : "s"} behind 4th`}.`;
	}
	// "Start in the Continental Champions Cup": season one begins with your club already in the cup.
	const ccStartOn = () => { try { return store.get("ff-cc-start") === "1"; } catch (e) { return false; } };
	function contSeed (lg) {
		if (!ccStartOn() || !lg || !lg.club || lg.season !== 1 || lg.round > CC_NIGHTS[0].r) { return; }
		const ids = [ 0, ...lg.members.filter(i => i !== 0).sort((a, b) => getStr(b) - getStr(a)).slice(0, 3) ];
		lg.club.contQual = { season: lg.season, ids };
		delete lg.cont;
	}
	function setCcStart (on) {
		store.set("ff-cc-start", on ? "1" : "0");
		const lg = league;
		if (!lg || !lg.club || lg.season !== 1 || lg.round > CC_NIGHTS[0].r) { return; }
		if (on) { contSeed(lg); } else if (lg.club.contQual && lg.club.contQual.season === 1) { delete lg.club.contQual; delete lg.cont; }
		saveLeague(); renderLeague();
	}
	const ccBox = document.getElementById("ccStart");
	if (ccBox) { ccBox.checked = ccStartOn(); ccBox.addEventListener("change", () => setCcStart(ccBox.checked)); }
	// For the panel and the tests: what comes next.
	function contNext () {
		const lg = league, C = ensureCont(lg);
		if (!C || C.none) { return lg && lg.club && lg.club.contQual && lg.club.contQual.season === lg.season + 1 ? (lg.club.contQual.ids.includes(0) ? "You've qualified for next season." : "") : ccPath(lg); }
		const me = ccMe(C);
		if (C.winner !== null) { return C.winner === me ? "You won the cup!" : `${ccName(C, C.winner)} won the cup.${me >= 0 && C.out ? ` You went out in the ${CC_STAGE[C.out.stage].toLowerCase()}.` : ""}`; }
		if (me < 0) { return "Your league's clubs in the cup this season: " + C.clubs.filter(c => c.id !== undefined).map(c => TEAMS[c.id].name).join(", ") + "."; }
		if (C.out) { return C.out.stage === "lp" ? `Out in the group stage (${ordinal(C.out.pos)} in your group).` : `Out in the ${CC_STAGE[C.out.stage].toLowerCase()}, beaten by ${ccName(C, C.out.by)}.`; }
		const g = C.games.find(x => x.hg === undefined && (x.h === me || x.a === me));
		if (!g) { return "Waiting for the draw."; }
		const n = CC_NIGHTS[g.n];
		return `Next: ${n.stage === "lp" ? `group stage matchday ${n.md}` : CC_STAGE[n.stage].toLowerCase()}, ${g.h === me ? "at home to" : g.neutral ? "against" : "away at"} ${ccName(C, g.h === me ? g.a : g.h)}${g.neutral ? " at a neutral ground" : ""}, after league matchday ${n.r}.`;
	}
	/* The panel: the league-phase table, your fixtures and the knockout ties. */
	function renderCont (box) {
		const lg = league, C = ensureCont(lg);
		if (!C) { return; }
		const card = el("div", "lg-cup lg-cont");
		card.append(el("h4", "", CC_NAME), el("p", "detail", contNext()));
		if (!C.none) {
			const me = ccMe(C), cell = (tag, txt, st) => { const e = el(tag, "", txt); if (st) { e.style.cssText = st; } return e; };
			if (me >= 0) {
				const d = el("details"); d.open = C.night < 6;
				d.append(el("summary", "", "Your group fixtures"));
				const ul = el("ul", "cup-ties");
				for (const g of C.games.filter(x => !x.stage && (x.h === me || x.a === me))) {
					const opp = ccName(C, g.h === me ? g.a : g.h), sc = g.hg === undefined ? "v" : g.h === me ? `${g.hg}–${g.ag}` : `${g.ag}–${g.hg}`;
					ul.append(el("li", g.hg === undefined ? "" : "mine", `MD${CC_NIGHTS[g.n].md} · ${g.h === me ? "H" : "A"} · ${opp} ${sc}`));
				}
				d.append(ul); card.append(d);
			}
			const tb = el("details"); tb.open = C.night >= 1 && C.night <= 6;
			tb.append(el("summary", "", "The eight groups"));
			const grid = el("div", "cc-groups"); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px";
			C.groups.forEach((grp, gi) => {
				const box = el("div", `cc-group${grp.includes(me) ? " mine" : ""}`); box.style.cssText = grp.includes(me) ? "padding:4px;border-radius:6px;background:rgba(242,181,46,0.1)" : "padding:4px";
				const t = el("table", "cc-table"); t.style.cssText = "width:100%;border-collapse:collapse;font-size:12px";
				const hr = el("tr"); for (const h of [ `Group ${String.fromCharCode(65 + gi)}`, "P", "GD", "Pts" ]) { hr.append(cell("th", h, "text-align:left;opacity:0.7;font-weight:600")); } t.append(hr);
				ccTable(C, gi).forEach((r, i) => {
					const tr = el("tr"); tr.style.cssText = `${r.i === me ? "font-weight:700;color:#f2b52e;" : ""}${i === 2 ? "border-top:1px solid rgba(255,255,255,0.35);" : ""}`;
					tr.append(cell("td", ccName(C, r.i)), cell("td", String(r.p)), cell("td", (r.gf - r.ga > 0 ? "+" : "") + (r.gf - r.ga)), cell("td", String(r.pts)));
					t.append(tr);
				});
				box.append(t); grid.append(box);
			});
			tb.append(grid, el("p", "detail", "The top two in each group go through to the round of 16."));
			card.append(tb);
			if (C.ties.r16.length) {
				const kd = el("details"); kd.open = C.night >= 6;
				kd.append(el("summary", "", "Knockout rounds"));
				for (const st of [ "r16", "qf", "sf", "f" ]) {
					if (!C.ties[st].length) { continue; }
					kd.append(el("span", "eyebrow", CC_STAGE[st]));
					const ul = el("ul", "cup-ties");
					for (const tie of C.ties[st]) {
						const w = ccWinner(C, tie), [ a, b ] = ccAgg(C, tie), played = C.games[tie.g[0]].hg !== undefined;
						const txt = st === "f" ? `${ccName(C, tie.b)} ${played ? `${b}–${a}` : "v"} ${ccName(C, tie.a)}` : `${ccName(C, tie.a)} ${played ? `${a}–${b}` : "v"} ${ccName(C, tie.b)}${played && C.games[tie.g[1]].hg !== undefined ? " (agg)" : ""}`;
						ul.append(el("li", tie.a === me || tie.b === me ? "mine" : "", `${txt}${w !== null ? ` · ${ccName(C, w)} through` : ""}`));
					}
					kd.append(ul);
				}
				card.append(kd);
			}
			if (C.earned) { card.append(el("p", "detail", `Prize money so far: ${money(C.earned)}.`)); }
		}
		box.append(card);
	}
	// Tests: play every night to the end, yours included (from the two sides' strength).
	function contSimAll () {
		const lg = league, C = ensureCont(lg);
		if (!C || C.none) { return null; }
		const r0 = lg.round;
		for (let guard = 0; guard < 60 && C.winner === null; guard++) {
			lg.round = CC_NIGHTS[Math.min(C.night, CC_NIGHTS.length - 1)].r;
			contNight();
			const gi = ccMine(C);
			if (gi !== null) { const g = C.games[gi], me = ccMe(C), s = { ...g }; ccPlay(C, s); recordContResult({ cont: { gi, season: C.season } }, g.h === me ? s.hg : s.ag, g.h === me ? s.ag : s.hg); }
		}
		lg.round = r0;
		return C;
	}
