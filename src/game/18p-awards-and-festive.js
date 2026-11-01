	/* ---------- the awards race and the festive fixtures ----------
	   Team of the Week: after every matchday, the best-rated eleven in the division (a keeper, four at the
	   back, four in midfield and two up front), from your players' ratings and the other clubs' (14-league).
	   Player of the Month: every four matchdays, the best average over that month (three games at least).
	   The Golden Boot and the Golden Glove: the division's top scorer and the keeper with the most clean
	   sheets. The other clubs' goals are shared out among their eleven (forwards most, then midfielders, by
	   shooting) when their matchday is played out; a clean sheet goes to the keeper who played.
	   Being picked lifts a player's morale. The festive period: four matchdays over Christmas and New Year
	   (Boxing Day among them) come two or three days apart, so legs recover less in between: rotate. */
	const MONTH_ROUNDS = 4;
	const FESTIVE = { 17: "Festive fixtures", 18: "Boxing Day", 19: "Festive fixtures", 20: "New Year's Day" };   // 0-based rounds: matchdays 18-21
	const isFestive = r => Object.prototype.hasOwnProperty.call(FESTIVE, r);
	const TOTW_SHAPE = { gk: 1, def: 4, mid: 4, fwd: 2 };

	function raceOf (lg) {
		if (!lg.race || lg.race.season !== lg.season) { lg.race = { season: lg.season, boot: {}, glove: {}, totw: null, potm: [], picks: {} }; }
		return lg.race;
	}
	// The other clubs' goals: who scored them. Weighted by position and shooting; returns name -> goals.
	function cpuScorers (xi, gf) {
		const w = xi.map(pl => ({ pl, w: ({ fwd: 5, mid: 2.4, def: 0.6, gk: 0 }[pl.pos] || 1) * Math.max(10, pl.sho || 50) }));
		const tot = w.reduce((t, x) => t + x.w, 0), out = {};
		for (let g = 0; g < gf && tot > 0; g++) {
			let r = Math.random() * tot;
			const hit = w.find(x => (r -= x.w) <= 0) || w[0];
			out[hit.pl.name] = (out[hit.pl.name] || 0) + 1;
		}
		return out;
	}
	// A club's matchday, for the race: its scorers and, with nothing conceded, its keeper's clean sheet.
	function raceClub (id, xi, scorers, ga) {
		const R = raceOf(league), club = id === 0 ? "You" : TEAMS[id].name;
		// Keyed by club and name: two clubs can each have an "S. Haines".
		for (const [ name, n ] of Object.entries(scorers)) { const k = `${club}|${name}`, b = R.boot[k] || (R.boot[k] = { name, club, goals: 0 }); b.goals += n; }
		const gk = xi.find(pl => pl && pl.pos === "gk");
		if (gk && ga === 0) { const k = `${club}|${gk.name}`, g = R.glove[k] || (R.glove[k] = { name: gk.name, club, cs: 0 }); g.cs++; }
	}
	// After a league matchday (recordLeagueResult): your side's part of the race, Team of the Week, and at a month's end the Player of the Month.
	function raceAfterRound (lm, gf, ga) {
		const lg = league, R = raceOf(lg), c = lg.club;
		const mine = {}; for (const n of matchGoals) { mine[n] = (mine[n] || 0) + 1; }
		raceClub(0, slotsFor(lg.fmt).map(i => c.squad[i]), mine, ga);
		// Every rating from this matchday: yours and the other clubs' latest.
		const pool = [];
		for (const pl of slotsFor(lg.fmt).map(i => c.squad[i]).filter(Boolean)) { if (Number.isFinite(lastRatings[pl.name])) { pool.push({ name: pl.name, club: "You", pos: pl.pos, r: lastRatings[pl.name], mine: true }); } }
		const cf = lg.cpuForm && lg.cpuForm.season === lg.season ? lg.cpuForm.clubs : {};
		const played = new Set((lg.results[lm.round] || []).flatMap(([ h, a ]) => [ h, a ]));
		for (const id of lg.members) {
			if (id === 0 || !played.has(id) || !cf[id]) { continue; }
			const sq = cpuSquad(id, getStr(id));
			for (const i of slotsFor(lg.fmt)) { const pl = sq[i], rs = pl && cf[id][pl.name]; if (rs && rs.length) { pool.push({ name: pl.name, club: TEAMS[id].name, pos: pl.pos, r: rs[rs.length - 1] }); } }
		}
		const xi = [];
		for (const [ pos, n ] of Object.entries(TOTW_SHAPE)) { xi.push(...pool.filter(p => p.pos === pos).sort((a, b) => b.r - a.r).slice(0, n)); }
		R.totw = { round: lm.round, xi };
		const yours = xi.filter(p => p.mine);
		for (const p of yours) { const pl = [ ...c.squad, ...c.bench ].find(x => x.name === p.name); if (pl) { pl.morale = clamp((pl.morale || 60) + 2, 5, 100); } R.picks[p.name] = (R.picks[p.name] || 0) + 1; }
		const notes = [];
		if (yours.length) { notes.push(`Team of the Week: ${yours.map(p => p.name).join(", ")} ${yours.length === 1 ? "is" : "are"} in it.`); }
		// The month: every four matchdays.
		if ((lm.round + 1) % MONTH_ROUNDS === 0) {
			const avg = rs => rs.reduce((t, v) => t + v, 0) / rs.length, cands = [];
			for (const pl of [ ...c.squad, ...c.bench ]) { const f = (Array.isArray(pl.form) ? pl.form : []).slice(-MONTH_ROUNDS); if (f.length >= 3) { cands.push({ name: pl.name, club: "You", r: avg(f), mine: true }); } }
			for (const id of lg.members) {
				if (id === 0 || !cf[id]) { continue; }
				for (const [ name, rs ] of Object.entries(cf[id])) { const f = rs.slice(-MONTH_ROUNDS); if (f.length >= 3) { cands.push({ name, club: TEAMS[id].name, r: avg(f) }); } }
			}
			const best = cands.sort((a, b) => b.r - a.r)[0];
			if (best) {
				const month = Math.floor(lm.round / MONTH_ROUNDS) + 1;
				R.potm.push({ month, name: best.name, club: best.club, r: Math.round(best.r * 100) / 100 });
				if (best.mine) { const pl = [ ...c.squad, ...c.bench ].find(x => x.name === best.name); if (pl) { pl.morale = clamp((pl.morale || 60) + 6, 5, 100); } }
				notes.push(`Player of the Month: ${best.name} (${best.club === "You" ? "yours" : best.club}), average rating ${best.r.toFixed(2)}.`);
			}
		}
		if (notes.length) { lg.news = `${lg.news || ""} ${notes.join(" ")}`.trim(); }
	}
	const bootTable = (lg, n = 3) => Object.entries(raceOf(lg).boot).sort((a, b) => b[1].goals - a[1].goals).slice(0, n);
	const gloveTable = (lg, n = 3) => Object.entries(raceOf(lg).glove).sort((a, b) => b[1].cs - a[1].cs).slice(0, n);
	// At the end of the season (seasonAwards, 18d): the Golden Boot and the Golden Glove.
	function raceWinners (lg) {
		const b = bootTable(lg, 1)[0], g = gloveTable(lg, 1)[0];
		return { boot: b ? { name: b[1].name, club: b[1].club, goals: b[1].goals } : null, glove: g ? { name: g[1].name, club: g[1].club, cs: g[1].cs } : null };
	}
	// The card on the Cups tab, with the season's awards (18d).
	function renderRace (box) {
		const lg = league, R = raceOf(lg), card = el("div", "lg-cup lg-race");
		card.append(el("h4", "", "Awards race"));
		const line = (title, txt) => { const p = el("p", "detail"); p.append(el("b", "", title + " "), document.createTextNode(txt)); card.append(p); };
		const who = (name, club) => `${name} (${club === "You" ? "yours" : club})`;
		const bt = bootTable(lg), gt = gloveTable(lg), pm = R.potm[R.potm.length - 1];
		line("Golden Boot:", bt.length ? bt.map(([ , x ]) => `${who(x.name, x.club)} ${x.goals}`).join(" · ") : "no goals yet.");
		line("Golden Glove:", gt.length ? gt.map(([ , x ]) => `${who(x.name, x.club)} ${x.cs} clean sheet${x.cs === 1 ? "" : "s"}`).join(" · ") : "no clean sheets yet.");
		line("Player of the Month:", pm ? `${who(pm.name, pm.club)}, month ${pm.month}, average ${pm.r.toFixed(2)}.` : `the first is named after matchday ${MONTH_ROUNDS}.`);
		if (R.totw && R.totw.xi.length) {
			card.append(el("span", "eyebrow", `Team of the Week · matchday ${R.totw.round + 1}`));
			const ul = el("ul", "cup-ties");
			for (const p of R.totw.xi) { ul.append(el("li", p.mine ? "mine" : "", `${POS_LABEL[p.pos]} · ${who(p.name, p.club)} · ${p.r.toFixed(1)}`)); }
			card.append(ul);
		}
		box.append(card);
	}
	// The kick-off card's line for a festive matchday.
	const festiveLine = r => (isFestive(r) ? `${FESTIVE[r]}: games come two or three days apart over Christmas and New Year, so legs recover less in between. Rotate.` : "");
