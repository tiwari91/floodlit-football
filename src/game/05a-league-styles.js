	/* ---------- league and country styles ----------
	   How football is played in each country, as a tilt on a generated player's ratings: where a league's
	   squads are strong, never how strong. These are original, generalised design values written from
	   broad public knowledge of each country's game (pace here, passing there); they are not copied from
	   any game, ratings database or real player, and no real player is modelled.
	   Fields: tag (shown in the UI), r = offsets on pace/shooting/passing/defending, e = position
	   emphasis (offsets on overall by line, evened out over a full eleven), sp = rating spread (1 as
	   before; under 1 a deep league, over 1 a patchy one), age = shift on the typical age, t = trait
	   weights, lvl = the league's standing, 1 to 5 (shown only: strengths keep their existing tiers).
	   Every tilt is projected so a player's overall is exactly what it would have been. */
	const STYLE_BASE = {
		eng: { tag: "high-tempo, physical", r: [ 3, 0, -1, 1 ], e: {}, sp: 0.8, age: 0.5, t: { pace: 1.3, target: 1.3, winner: 1.2 }, lvl: 5 },
		brit: { tag: "direct, combative", r: [ 1, 0, -2, 2 ], e: { def: 0.5 }, sp: 1.1, age: 0.5, t: { target: 1.4, winner: 1.4, playmaker: 0.8 }, lvl: 3 },
		esp: { tag: "technical, possession", r: [ -1, 0, 4, -1 ], e: { mid: 1 }, sp: 0.9, age: 0.5, t: { playmaker: 1.8, sweeper: 1.3, target: 0.6 }, lvl: 5 },
		ita: { tag: "tactical, organised defending", r: [ -2, 0, 1, 4 ], e: { def: 1.5, fwd: -0.5 }, sp: 0.9, age: 2, t: { winner: 1.4, pace: 0.8 }, lvl: 5 },
		ger: { tag: "pressing, quick transitions", r: [ 2, 0, 1, 1 ], e: {}, sp: 0.9, age: -0.5, t: { winner: 1.3, pace: 1.3, sweeper: 1.5 }, lvl: 5 },
		fra: { tag: "athletic, pacey wide men", r: [ 4, 0, -1, 0 ], e: {}, sp: 1, age: -1, t: { pace: 1.6, winner: 1.1 }, lvl: 4 },
		ned: { tag: "technical, young wingers", r: [ 0, 1, 3, -2 ], e: { mid: 0.5, def: -0.5 }, sp: 1.15, age: -2, t: { playmaker: 1.4, pace: 1.3 }, lvl: 4 },
		por: { tag: "technical, quick wingers", r: [ 2, 0, 2, -2 ], e: { fwd: 0.5 }, sp: 1.1, age: -1.5, t: { pace: 1.4, playmaker: 1.3 }, lvl: 4 },
		bel: { tag: "technical, a talent factory", r: [ 1, 0, 1, -1 ], e: {}, sp: 1.1, age: -1.5, t: { playmaker: 1.2, pace: 1.2 }, lvl: 3 },
		cro: { tag: "technical midfield craft", r: [ -2, 0, 3, 1 ], e: { mid: 1.5 }, sp: 1.1, age: 0.5, t: { playmaker: 1.5 }, lvl: 3 },
		scan: { tag: "organised, aerial, team-first", r: [ -1, -1, 1, 2 ], e: { def: 0.5 }, sp: 1.1, age: 0, t: { target: 1.4, winner: 1.2 }, lvl: 3 },
		east: { tag: "robust, direct", r: [ 0, 1, -1, 1 ], e: {}, sp: 1.15, age: 0, t: { target: 1.3, winner: 1.2 }, lvl: 3 },
		bra: { tag: "dribbling, flair", r: [ 2, 2, 1, -4 ], e: { fwd: 1.5, def: -1 }, sp: 1.2, age: -0.5, t: { pace: 1.4, playmaker: 1.3, winner: 0.7 }, lvl: 4 },
		arg: { tag: "flair with grit", r: [ -1, 2, 2, 0 ], e: { fwd: 1 }, sp: 1.2, age: 0.5, t: { playmaker: 1.4, winner: 1.3 }, lvl: 4 },
		uru: { tag: "tenacious, streetwise", r: [ -1, 1, -2, 3 ], e: { def: 1 }, sp: 1.15, age: 0.5, t: { winner: 1.5, poacher: 1.3 }, lvl: 3 },
		and: { tag: "skilful, rhythmic", r: [ 1, 0, 2, -1 ], e: { mid: 0.5 }, sp: 1.15, age: 0, t: { playmaker: 1.3, pace: 1.2 }, lvl: 3 },
		mex: { tag: "quick passing, technical", r: [ 1, 0, 2, -1 ], e: {}, sp: 1.1, age: 0.5, t: { playmaker: 1.3 }, lvl: 3 },
		mls: { tag: "athletic, end-to-end", r: [ 3, -1, -1, 0 ], e: {}, sp: 1.25, age: 0, t: { pace: 1.4 }, lvl: 3 },
		aus: { tag: "physical, direct", r: [ 1, 0, -2, 2 ], e: {}, sp: 1.15, age: 0, t: { target: 1.3, winner: 1.3 }, lvl: 2 },
		jpn: { tag: "technical, disciplined", r: [ 1, -2, 3, 0 ], e: { mid: 1 }, sp: 1, age: 0, t: { playmaker: 1.4, poacher: 0.8 }, lvl: 3 },
		kor: { tag: "high work-rate, quick", r: [ 2, -1, 1, 0 ], e: {}, sp: 1, age: 0, t: { winner: 1.3, pace: 1.2 }, lvl: 3 },
		waf: { tag: "athletic, powerful", r: [ 4, -1, -2, 1 ], e: {}, sp: 1.25, age: -1.5, t: { pace: 1.5, winner: 1.3 }, lvl: 2 },
		maf: { tag: "technical, quick feet", r: [ 1, 0, 2, -1 ], e: {}, sp: 1.15, age: -0.5, t: { playmaker: 1.3, pace: 1.1 }, lvl: 3 }
	};
	// Each country's style (some share one), and how good its league is (lvl overrides the shared value).
	const NAT_STYLE = {
		ENG: [ "eng" ], SCO: [ "brit" ], WAL: [ "brit", 2 ], IRL: [ "brit", 2 ],
		ESP: [ "esp" ], FRA: [ "fra" ], GER: [ "ger" ], ITA: [ "ita" ], NED: [ "ned" ], POR: [ "por" ], BEL: [ "bel" ], CRO: [ "cro" ],
		DEN: [ "scan" ], SWE: [ "scan" ], POL: [ "east" ], SRB: [ "east" ],
		BRA: [ "bra" ], ARG: [ "arg" ], URU: [ "uru" ], COL: [ "and" ], CHI: [ "and", 2 ],
		NGA: [ "waf" ], GHA: [ "waf" ], SEN: [ "waf" ], CIV: [ "waf" ], CMR: [ "waf" ], MAR: [ "maf" ],
		JPN: [ "jpn" ], KOR: [ "kor" ], AUS: [ "aus" ], USA: [ "mls" ], MEX: [ "mex" ]
	};
	const HOME_NAT = "ENG";
	const styleOf = nat => { const s = NAT_STYLE[nat]; return s ? { ...STYLE_BASE[s[0]], key: s[0], lvl: s[1] || STYLE_BASE[s[0]].lvl } : null; };
	// The country whose game the current league plays: the one you manage in, or home.
	const curLeague = () => { try { return league; } catch (e) { return null; } };   // (null before the save is read)
	const leagueNat = () => { const lg = curLeague(); return lg && lg.ident && NAT_STYLE[lg.ident.country] ? lg.ident.country : HOME_NAT; };
	const styleAge = (a, lg) => { const s = styleOf(lg); return s ? clamp(Math.round(a + s.age), 17, 34) : a; };
	const styleLine = nat => { const s = styleOf(nat); return s ? `Style: ${s.tag}` : ""; };
	// The country a computer club plays like: a continental guest its own, everyone else the league's.
	function clubNat (clubId) {
		const lg = curLeague(), g = lg ? lg.contGuest : null;
		if (g && g.slot === clubId) {
			if (NAT_STYLE[g.nat]) { return g.nat; }
			const c = lg.cont && Array.isArray(lg.cont.clubs) ? lg.cont.clubs.find(x => x && x.name === g.key) : null;   // an older save: no nat on the guest
			if (c && NAT_STYLE[c.nat]) { return c.nat; }
		}
		return leagueNat();
	}
	// Position emphasis evened out over an eleven, so the squad's mean overall is unchanged.
	const styleEmph = (s, pos) => { const e = p => (s.e && s.e[p]) || 0; return e(pos) - POS_OF_SLOT.reduce((t, p) => t + e(p), 0) / POS_OF_SLOT.length; };
	// The tilt on a player's ratings: his league's in full, his own country's a little when it differs.
	function styleTilt (lg, nat) {
		const a = styleOf(lg), b = nat && nat !== lg ? styleOf(nat) : null;
		const r = [ 0, 1, 2, 3 ].map(k => (a ? a.r[k] : 0) + (b ? 0.35 * b.r[k] : 0));
		const t = {};
		for (const k of Object.keys(TRAITS)) { t[k] = ((a && a.t[k]) || 1) * Math.pow((b && b.t[k]) || 1, 0.35); }
		return { r, t };
	}
	// A trait from his name, with the style's weights; about as many players have one as before.
	function styleTrait (name, pos, tw) {
		const odds = TRAIT_ODDS[pos] || [], base = odds.reduce((s, [ , w ]) => s + w, 0);
		const wt = odds.map(([ k, w ]) => [ k, w * (tw[k] || 1) ]), sum = wt.reduce((s, [ , w ]) => s + w, 0) || 1;
		const h = hashStr(String(name) + "|style-trait|" + pos) % 1000 / 10;
		let acc = 0;
		for (const [ k, w ] of wt) { acc += w * base / sum; if (h < acc) { return k; } }
		return "";
	}
	// Apply a tilt to fresh ratings, keeping the overall exactly as it was. No random draws: the computer's seeded squads stay the same.
	// raw: the ratings before rounding, if there are any, so small tilts are not lost to it.
	function applyTilt (p, pos, r, raw = p) {
		const K = [ "pac", "sho", "pas", "def" ], w = OVR_W[pos], c = v => clamp(Math.round(v), 30, 96);
		const want = ovrOf({ ...p, pos });
		const d = pos === "gk" ? [ r[0], r[1], r[2], 0 ] : r.map(v => v - r.reduce((t, x, i) => t + x * w[i], 0));
		const q = { pos };
		K.forEach((k, i) => { q[k] = c(raw[k] + d[i]); });
		// Rounding and the 30-96 limits can leave it a point out: nudge the rating that counts most and still has room.
		const order = K.filter((k, i) => w[i] > 0).sort((a, b) => w[K.indexOf(b)] - w[K.indexOf(a)]);
		for (let n = 0; n < 12 && ovrOf(q) !== want; n++) {
			const up = ovrOf(q) < want, k = order.find(x => (up ? q[x] < 96 : q[x] > 30));
			if (!k) { break; }
			q[k] += up ? 1 : -1;
		}
		K.forEach(k => { p[k] = q[k]; });
		return p;
	}
	// A nationality for a player in a league abroad, from his name: mostly that country's own.
	function styleNatFor (name, pos, lg) {
		if (lg === HOME_NAT || !NAT_STYLE[lg]) { return null; }
		return hashStr(String(name) + "|nat|" + pos) % 100 < 65 ? lg : null;
	}
	// A youngster from the club's own academy: from the league's country (at home, one of the home nations).
	const localNat = () => { const n = leagueNat(); return n !== HOME_NAT ? n : natsOf("home")[Math.floor(Math.random() * natsOf("home").length)]; };
	if (/[?&]test\b/.test(location.search)) {
		queueMicrotask(() => { if (window.__ff) { Object.assign(window.__ff, { STYLE_BASE, NAT_STYLE, styleOf, leagueNat, clubNat, genPlayer, applyTilt, OVR_W, POS_OF_SLOT, slotsFor }); } });
	}
