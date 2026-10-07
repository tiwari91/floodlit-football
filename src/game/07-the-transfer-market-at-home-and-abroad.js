	/* ---------- the transfer market, at home and abroad ----------
	   Each window brings a list from five markets. Abroad is cheaper for the quality but needs a
	   work permit outside Europe (68+ overall) and a spell settling in. Unless your scout has looked
	   at a player, you only see a range for how good he is. */
	const MARKETS = {
		home: { label: "Home", lo: 58, hi: 80, mult: 1, adapt: 0, permit: false, n: 4, clubs: [ "Ashby Town", "Caldermoor", "Wexley United", "Fordham Rovers" ] },
		europe: { label: "Europe", lo: 62, hi: 86, mult: 1.15, adapt: 3, permit: false, n: 4, clubs: [ "Ribera CF", "AS Vence", "SV Kahlberg", "FC Arade", "Sporting Lusa", "Veendam AFC" ] },
		samerica: { label: "South America", lo: 60, hi: 85, mult: 0.85, adapt: 6, permit: true, n: 3, clubs: [ "Atlético Paraná", "CA Rosales", "Deportivo Salto", "Club Cuyo" ] },
		africa: { label: "Africa", lo: 58, hi: 82, mult: 0.7, adapt: 5, permit: true, n: 3, clubs: [ "Lagos Harbour", "Accra Stars", "Dakar Lions", "Casablanca Athletic" ] },
		asia: { label: "Asia and the Americas", lo: 58, hi: 78, mult: 0.75, adapt: 4, permit: true, n: 2, clubs: [ "Osaka Bay", "Busan Mariners", "Sydney Harbour", "Austin Union", "Monterrey Norte" ] }
	};
	const PERMIT_OVR = 68;
	function genMarket () {
		const pool = [ "gk", "def", "def", "mid", "mid", "fwd", "fwd" ], out = [];
		for (const [ region, m ] of Object.entries(MARKETS)) {
			for (let k = 0; k < m.n; k++) {
				const pl = genPlayer(pool[Math.floor(Math.random() * pool.length)], m.lo + Math.floor(Math.random() * (m.hi - m.lo + 1)));
				const nats = natsOf(region);
				pl.nat = nats[Math.floor(Math.random() * nats.length)];
				pl.age = 18 + Math.floor(Math.random() * 15);
				pl.pot = clamp(ovrOf(pl) + Math.max(0, 27 - pl.age) * 1.5 + Math.floor(Math.random() * 6), ovrOf(pl), 94);
				pl.region = region; pl.from = m.clubs[Math.floor(Math.random() * m.clubs.length)];
				pl.ask = Math.max(0.2, round1(valueOf(pl) * m.mult * (0.9 + Math.random() * 0.25)));
				pl.contract = 3; pl.morale = 75; pl.bids = 0;
				out.push(pl);
			}
		}
		return out;
	}
	const askOf = pl => (Number.isFinite(pl.ask) ? pl.ask : priceOf(pl));
	const permitOk = pl => !(MARKETS[pl.region] && MARKETS[pl.region].permit) || ovrOf(pl) >= PERMIT_OVR;

	const BENCH = 7, BENCH_POS = [ "gk", "def", "def", "mid", "mid", "fwd", "fwd" ];
	function newClub () {
		const names = SURNAMES.slice().sort(() => Math.random() - 0.5);
		const nm = i => `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}. ${names[i % names.length]}`;
		return {
			budget: 2.5,
			squad: POS_OF_SLOT.map((pos, i) => genPlayer(pos, 57 + Math.floor(Math.random() * 9), nm(i))),
			bench: BENCH_POS.map((pos, i) => genPlayer(pos, 53 + Math.floor(Math.random() * 9), nm(i + POS_OF_SLOT.length))),
			upgrades: { training: 0, coaching: 0, defence: 0 },
			market: genMarket(),
			scoutLeft: 2
		};
	}

	// A club from a save: rebuild whatever is missing or malformed.
	function sanitizeClub (c) {
		const fresh = newClub();
		if (!c || typeof c !== "object") { return fresh; }
		// Any real position will do: a player picked out of position (by Auto-pick or a swap) is still your player.
		const okPlayer = pl => pl && typeof pl.name === "string" && POS_LABEL[pl.pos] && [ "pac", "sho", "pas", "def" ].every(k => Number.isFinite(pl[k]));
		if (!Array.isArray(c.squad) || c.squad.length !== POS_OF_SLOT.length) { c.squad = fresh.squad; }
		c.squad = c.squad.map((pl, i) => (okPlayer(pl, i) ? pl : fresh.squad[i]));
		const okBench = pl => pl && typeof pl.name === "string" && POS_LABEL[pl.pos] && [ "pac", "sho", "pas", "def" ].every(k => Number.isFinite(pl[k]));
		c.bench = Array.isArray(c.bench) ? c.bench.filter(okBench).slice(0, BENCH) : fresh.bench;
		if (!Number.isFinite(c.budget)) { c.budget = fresh.budget; }
		c.upgrades = Object.assign({ training: 0, coaching: 0, defence: 0 }, c.upgrades || {});
		if (!Array.isArray(c.market)) { c.market = fresh.market; }
		c.market = c.market.filter(pl => pl && POS_LABEL[pl.pos] && typeof pl.name === "string");
		for (const pl of [ ...c.squad, ...c.bench, ...c.market ]) { ensurePlayer(pl); }
		ensureCoaching(c, null);
		if (!Number.isFinite(c.scoutLeft)) { c.scoutLeft = 2 + staffLvl(c, "scout"); }
		if (!Array.isArray(c.log)) { c.log = []; }
		return c;
	}

	// Older saves predate the club; give them one.
	// Players the computer signed (or the market listed) under the old formula could be rated up to 99:
	// bring anyone over 92 back down, keeping the shape of his ratings.
	function capRating (pl, max = 92) {
		if (!pl || !POS_LABEL[pl.pos]) { return pl; }
		for (let k = 0; k < 20 && ovrOf(pl) > max; k++) { for (const a of [ "pac", "sho", "pas", "def" ]) { if (Number.isFinite(pl[a]) && pl[a] > 60) { pl[a]--; } } }
		for (const a of [ "pac", "sho", "pas", "def" ]) { if (pl[a] > 96) { pl[a] = 96; } }
		return pl;
	}
	function ensureClub (lg) {
		if (typeof applyIdentity === "function") { applyIdentity(lg); }   // the club you manage, by name and colours
		if (typeof repairForeignLeague === "function") { repairForeignLeague(lg); }   // older saves abroad: the home clubs become that country's
		lg.club = sanitizeClub(lg.club);
		// Older saves never retired anyone: whoever is past the last playing age goes now.
		const late = retireVeterans(lg.club, false, false);
		if (late.length) { lg.news = `${lg.news || ""} Retired: ${late.join(", ")}. Academy players fill the gaps.`.trim(); }
		for (const pl of lg.club.market) { capRating(pl); }
		if (lg.cpuIn && typeof lg.cpuIn === "object") { for (const ins of Object.values(lg.cpuIn)) { if (Array.isArray(ins)) { for (const d of ins) { if (d && d.pl) { capRating(d.pl); } } } } }
		ensureCoaching(lg.club, lg);
		if (!Array.isArray(lg.clubStr) || lg.clubStr.length !== TEAMS.length) { lg.clubStr = TEAMS.map(t => t.str); }
		if (!Array.isArray(lg.weather) || lg.weather.length !== lg.fixtures.length) { lg.weather = genForecast(lg.fixtures.length); }
		if (!Array.isArray(lg.wind) || lg.wind.length !== lg.fixtures.length || !lg.wind.every(w => w && Number.isFinite(w.s) && Number.isFinite(w.a))) { lg.wind = genWind(lg.fixtures.length); }
		if (!Array.isArray(lg.ko) || lg.ko.length !== lg.fixtures.length) { lg.ko = genKickoff(lg.fixtures.length); }
		return lg;
	}

	const getStr = id => (id === 0 && league && league.club ? yourStr()
		: league && league.clubStr ? league.clubStr[id] : TEAMS[id].str);
	function yourStr () {
		const slots = slotsFor(league.fmt);
		const avg = slots.reduce((t, i) => t + matchOvr(league.club.squad[i], roleOfSlot(league.fmt, i)), 0) / slots.length;
		return clamp((avg - 42) / 8, 1, 5);
	}

	// A squad member's ratings with the club's upgrades applied.
	// Ratings with upgrades. For a match (slotPos given) tired legs slow a player,
	// and playing out of position costs him; a keeper out of goal, or an outfielder
	// in it, costs a lot.
	function effective (p, slotPos) {
		const u = league && league.club ? league.club.upgrades : { training: 0, coaching: 0, defence: 0 };
		const base = {
			pac: Math.min(99, p.pac + 3 * u.training),
			sho: Math.min(99, p.sho + 3 * u.coaching),
			pas: Math.min(99, p.pas + 3 * u.coaching),
			def: Math.min(99, p.def + 3 * u.defence)
		};
		if (!slotPos) { return base; }
		const LINE = { def: 0, mid: 1, fwd: 2 };
		const fit = fitOf(p) / 100, oop = slotPos === p.pos ? 0 : slotPos === "gk" || p.pos === "gk" ? 25 : Math.abs(LINE[slotPos] - LINE[p.pos]) === 1 ? 4 : 8;
		// A happy player gives a little more, an unhappy one a little less; a new signing from abroad
		// is not at his best until he has settled.
		const mor = Number.isFinite(p.morale) ? 0.96 + 0.08 * p.morale / 100 : 1, settle = p.adapt > 0 ? 1 - 0.015 * Math.min(p.adapt, 5) : 1;
		// Drilled sides pass and defend a touch better (up to +2 at full tactical familiarity).
		const drill = league && league.club && Number.isFinite(league.club.drill) && [ ...league.club.squad, ...league.club.bench ].includes(p) ? Math.floor(league.club.drill / 40) : 0;
		base.pas = Math.min(99, base.pas + drill); base.def = Math.min(99, base.def + drill);
		const fb = formBonus(p);
		if (fb) { for (const k of [ "pac", "sho", "pas", "def" ]) { base[k] = clamp(base[k] + fb, 20, 99); } }
		const f = (v, w) => Math.max(20, Math.round(v * w * (p.inj > 0 ? 0.85 : 1) * mor * settle) - oop);
		return { pac: f(base.pac, 0.75 + 0.25 * fit), sho: f(base.sho, 0.9 + 0.1 * fit), pas: f(base.pas, 0.9 + 0.1 * fit), def: f(base.def, 0.9 + 0.1 * fit) };
	}
	const fitOf = p => (Number.isFinite(p.fit) ? p.fit : 100);
	// Form: his last five match ratings (out of 10). Well above a 6.5 average adds up to two to
	// each of his ratings; well below takes up to two off.
	const formAvg = p => (Array.isArray(p.form) && p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : null);
	const formBonus = p => { const a = formAvg(p); return a === null || p.form.length < 2 ? 0 : clamp(Math.round((a - 6.6) * 1.3), -2, 2); };
	// How good a player is in a given slot today.
	const matchOvr = (pl, slotPos) => ovrOf({ ...effective(pl, slotPos), pos: slotPos });

	const ovrNow = pl => ovrOf({ ...effective(pl), pos: pl.pos });   // overall with upgrades

	const windowOpen = () => !!league && !!league.club && (league.round === 0 || league.round === JANUARY || league.round >= league.fixtures.length);

	// The squad slot a new signing takes: the weakest at that position, preferring
	// slots the league's format actually puts on the pitch.
	// Where a new signing goes: onto the bench if there is room, otherwise in place
	// of the weakest player at that position (bench first, then the starters).
	function signingTarget (pos) {
		const c = league.club;
		if (c.bench.length < BENCH) { return { list: "bench", i: c.bench.length, out: null }; }
		// The weakest man in that position anywhere in the squad makes way, bench or eleven, so a second
		// signing never pushes out the first one just because he was the only one of his kind on the bench.
		const cands = [];
		c.bench.forEach((pl, i) => { if (pl.pos === pos) { cands.push({ list: "bench", i, pl }); } });
		c.squad.forEach((pl, i) => { if (pl.pos === pos) { cands.push({ list: "squad", i, pl }); } });
		if (!cands.length) { c.bench.forEach((pl, i) => cands.push({ list: "bench", i, pl })); }
		const w = cands.reduce((a, b) => (ovrNow(b.pl) < ovrNow(a.pl) ? b : a));
		return { list: w.list, i: w.i, out: w.pl };
	}

