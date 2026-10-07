	/* ---------- league ---------- */
	function roundRobin (ids) {
		const a = ids.slice(), n = a.length, rounds = [];
		for (let r = 0; r < n - 1; r++) {
			const pairs = [];
			for (let i = 0; i < n / 2; i++) {
				const x = a[i], y = a[n - 1 - i];
				pairs.push((r + i) % 2 ? [ y, x ] : [ x, y ]);   // alternate home and away
			}
			rounds.push(pairs);
			a.splice(1, 0, a.pop());
		}
		return rounds;
	}

	function shuffle (a) {
		for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ a[i], a[j] ] = [ a[j], a[i] ]; }
		return a;
	}

	function newSeason (fmt, carryClub) {
		const prev = league;
		// Three clubs go down and three come up. If you finish in the bottom three
		// the board keeps you up, but halves the budget.
		let members, promoted = [], relegated = [], youDown = false;
		if (prev && Array.isArray(prev.members) && prev.members.length === DIVISION) {
			const rows = standings();
			youDown = rows.slice(-3).some(r => r.id === 0);
			relegated = rows.filter(r => r.id !== 0).slice(-3).map(r => r.id);
			promoted = shuffle(TEAMS.map((t, i) => i).filter(i => i !== 0 && !prev.members.includes(i))).slice(0, 3);
			members = prev.members.filter(i => !relegated.includes(i)).concat(promoted);
		} else {
			members = [ 0, ...CLUBS.slice(0, DIVISION - 1).map((c, i) => i + 1) ];
		}
		const others = shuffle(members.filter(i => i !== 0));
		const first = roundRobin([ 0, ...others ]);
		const fixtures = first.concat(first.map(r => r.map(([ h, a ]) => [ a, h ])));   // then the return games
		const oldStr = prev && prev.clubStr ? prev.clubStr : TEAMS.map(t => t.str);
		// Between seasons some rivals strengthen and some fade.
		const clubStr = prev ? oldStr.map((v, i) => (i === 0 ? v : clamp(v + (Math.random() < 0.22 ? 1 : Math.random() < 0.28 ? -1 : 0), 1, 5))) : oldStr.slice();
		const up = [], down = [];
		clubStr.forEach((v, i) => {
			if (!members.includes(i)) { return; }
			if (v > oldStr[i]) { up.push(TEAMS[i].name); } else if (v < oldStr[i]) { down.push(TEAMS[i].name); }
		});
		const club = prev && prev.club ? prev.club : carryClub ? sanitizeClub(carryClub) : newClub();
		// Auto-rotate carries on from season to season (and from your last choice for a new club).
		if (club.autoRotate === undefined) { club.autoRotate = store.get("ff-autorot") === "1"; }
		if (youDown) { club.budget = round1(club.budget * 0.5); }
		if (prev) { for (const pl of [ ...club.squad, ...club.bench ]) { pl.fit = 100; pl.goals = 0; pl.apps = 0; pl.ycount = 0; } }   // a summer's rest, and a clean sheet of stats
		let gone = [];
		league = {
			v: 1,
			season: prev ? prev.season + 1 : 1,
			fmt: FORMATS[fmt] ? fmt : "11",
			level: prev && LEVELS[prev.level] ? prev.level : LEVELS[levelSel.value] ? levelSel.value : "normal",
			round: 0,
			members,
			fixtures,
			results: [],
			updated: 0,
			club,
			clubStr,
			ident: prev && prev.ident ? prev.ident : undefined,
			paid: false,
			weather: genForecast(fixtures.length),
			wind: genWind(fixtures.length),
			ko: genKickoff(fixtures.length),
			news: [
				youDown ? "You finished in the relegation zone. The board kept you up but halved the budget." : "",
				promoted.length ? `Promoted: ${promoted.map(i => TEAMS[i].name).join(", ")}.` : "",
				relegated.length ? `Relegated: ${relegated.map(i => TEAMS[i].name).join(", ")}.` : "",
				up.length ? `Stronger this season: ${up.join(", ")}.` : "",
				down.length ? `Weaker: ${down.join(", ")}.` : ""
			].filter(Boolean).join(" ")
		};
		league.cpuIn = {};
		windowEvents("Summer");
		if (prev) {
			sanitizeClub(club);
			if (typeof assistRun === "function") { assistRun("summer"); }   // new deals before contracts run out
			gone = rolloverClub(club);
			if (typeof seasonCoaching === "function") { seasonCoaching(club); }
			if (gone.length) { league.news = `${league.news} Out of contract and gone: ${gone.join(", ")}. Academy players fill the gaps.`.trim(); }
			if (club.resigned && club.resigned.length) { league.news = `${league.news} Signed new deals: ${club.resigned.join(", ")}.`.trim(); }
		}
		saveLeague();
	}

	function validLeague (o) {
		return !!o && o.v === 1 && FORMATS[o.fmt] && Array.isArray(o.fixtures) && o.fixtures.length === SEASON_ROUNDS &&
			Array.isArray(o.members) && o.members.length === DIVISION &&
			Array.isArray(o.results) && Number.isInteger(o.round) && o.round >= 0 && o.round <= o.fixtures.length;
	}

	const seasonDone = () => !!league && league.round >= league.fixtures.length;

	function currentFixture () {
		if (!league || seasonDone()) { return null; }
		const pair = league.fixtures[league.round].find(([ a, b ]) => a === 0 || b === 0);
		return { round: league.round, home: pair[0] === 0, opp: pair[0] === 0 ? pair[1] : pair[0] };
	}

	function poisson (l) {
		const L = Math.exp(-l);
		let k = 0, p = 1;
		do { k++; p *= Math.random(); } while (p > L);
		return k - 1;
	}

	// Computer-v-computer games, from the two ratings plus a little home advantage.
	function simMatch (h, a) {
		const d = getStr(h) - getStr(a);
		// Who controls the ball on the day: the better side usually does, and the side
		// that dominates possession makes a few more chances than the ratings alone give.
		const ctl = clamp(0.06 * d + (Math.random() * 2 - 1) * 0.15, -0.25, 0.25);
		return [ h, a, poisson(clamp((1.4 + 0.32 * d) * (1 + ctl), 0.3, 3.2)), poisson(clamp((1.1 - 0.32 * d) * (1 - ctl), 0.25, 3)) ];
	}

	function standings () {
		const byId = new Map(league.members.map(id => [ id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] } ]));
		const rows = [ ...byId.values() ];
		for (const round of league.results) {
			for (const [ h, a, hg, ag ] of round) {
				const H = byId.get(h), A = byId.get(a);
				if (!H || !A) { continue; }
				H.p++; A.p++;
				H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
				if (hg > ag) { H.w++; A.l++; H.pts += 3; H.form.push("W"); A.form.push("L"); }
				else if (hg < ag) { A.w++; H.l++; A.pts += 3; A.form.push("W"); H.form.push("L"); }
				else { H.d++; A.d++; H.pts++; A.pts++; H.form.push("D"); A.form.push("D"); }
			}
		}
		return rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf ||
			TEAMS[x.id].name.localeCompare(TEAMS[y.id].name));
	}

	// Record your result and play out the rest of the matchday.
	function recordLeagueResult (lm, h, a) {
		if (!league || league.round !== lm.round) { return; }
		const mine = lm.home ? [ 0, lm.opp, h, a ] : [ lm.opp, 0, a, h ];
		const others = tickPlan && tickPlan.round === lm.round ? tickPlan.res.map(r => r.slice()) : league.fixtures[lm.round].filter(([ x, y ]) => x !== 0 && y !== 0).map(([ x, y ]) => simMatch(x, y));
		league.results[lm.round] = [ mine, ...others ];
		league.round = lm.round + 1;
		updateFitness();
		weeklyClub(lm, h, a);
		if (!windowOpen()) { league.bidsIn = []; }
		if (league.round === JANUARY) { league.club.market = genMarket(); league.club.scoutLeft = 2 + staffLvl(league.club, "scout"); if (typeof windowEvents === "function") { windowEvents("January"); } if (typeof agentApproaches === "function") { agentApproaches("January"); } }
		if (typeof assistRun === "function") { assistRun(league.round === JANUARY ? "January window" : "this week"); }
		// Knocks from this match: out for one to three games, and off the team sheet.
		const byName = n => [ ...league.club.squad, ...league.club.bench ].find(pl => pl.name === n);
		for (const n of matchGoals) { const pl = byName(n); if (pl) { pl.goals = (pl.goals || 0) + 1; } }
		for (const n of new Set([ ...team(0).map(p => p.name), ...wentOff ])) { const pl = byName(n); if (pl) { pl.apps = (pl.apps || 0) + 1; } }
		for (const n of matchInjuries) {
			const pl = byName(n), info = matchInjInfo[n] || rollInjury(Math.random() < 0.3);
			if (pl) { pl.inj = Math.max(pl.inj || 0, info.games); pl.injType = info.type; pl.wasStarter = true; }
		}
		matchInjInfo = {};
		// Suspensions: a red is a ban (two games for a straight red), and five yellows in a season is one.
		league.banned = [];
		for (const c of matchCards) {
			const pl = byName(c.name);
			if (!pl) { continue; }
			if (c.kind === "y") { pl.ycount = (pl.ycount || 0) + 1; }
			const ban = c.kind === "r" ? 2 : c.kind === "r2" ? 1 : pl.ycount >= 5 ? 1 : 0;
			if (c.kind === "y" && pl.ycount >= 5) { pl.ycount = 0; }
			if (ban) { pl.ban = Math.max(pl.ban || 0, ban); pl.wasStarter = true; league.banned.push(`${pl.name} (${ban} game${ban === 1 ? "" : "s"}, ${c.kind === "y" ? "five yellows" : "red card"})`); }
		}
		matchCards = [];
		league.injured = matchInjuries.map(byName).filter(Boolean).map(pl => `${pl.name} (${pl.injType ? pl.injType + ", " : ""}${pl.inj} game${pl.inj === 1 ? "" : "s"})`);
		matchInjuries = [];
		// Hurt starters come off the team sheet; ones back from a knock go straight back on it.
		if (injuredStarters().length || league.recovered.length) { autoPick(!!league.club.autoRotate, true); }
		// Auto-rotate: rest tired starters straight away, ready for the next match.
		league.rotated = league.club.autoRotate ? rotateTired(true) : null;
		if (seasonDone() && !league.paid) {
			// Prize money by final position and points, and a fresh transfer list.
			const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1;
			league.prize = round1(1 + (DIVISION - pos) * 0.2 + rows[pos - 1].pts * 0.02);
			league.club.budget = round1(league.club.budget + league.prize);
			league.club.market = genMarket();
			league.club.scoutLeft = 2 + staffLvl(league.club, "scout");
			league.paid = true;
			if (typeof offerJobs === "function") { offerJobs(pos); }
		}
		saveLeague();
		renderLeague();
	}

