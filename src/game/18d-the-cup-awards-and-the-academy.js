	/* ---------- the cup, the season's awards and the academy ----------
	   The cup: a knockout among the twenty clubs of the division, drawn at random each round, its ties
	   played on cup nights between league matchdays. Level after ninety minutes it goes to extra time,
	   then penalties, five each and sudden death. The final is the last cup night. Your ties are played
	   out from the two sides' strength, like the other games of a matchday.
	   The awards: at the end of the season, your club's player of the season, top scorer and young
	   player, and the division's manager of the season.
	   The academy: each summer two or three youngsters come through, with room to grow. Promote one to
	   the bench or let him go; the rest grow a little each season until you decide. */
	const CUP_NIGHTS = [ 5, 11, 19, 27, 34 ];   // played after these league matchdays
	const CUP_ROUNDS = [ "First round", "Round of 16", "Quarter-finals", "Semi-finals", "Final" ];
	const CUP_PRIZE = { win: 0.1, final: 0.5, winner: 1 };
	const cupName = () => "League Cup";
	function newCup (lg) {
		return { v: 1, season: lg.season, alive: lg.members.slice(), rounds: [], out: null, winner: null, skip: 0 };
	}
	// An old save, or one from before the cup: a cup for this season if its first night is still to
	// come, otherwise none until next season.
	function ensureCup (lg) {
		if (!lg || !Array.isArray(lg.members)) { return null; }
		const c = lg.cup;
		const ok = c && c.v === 1 && c.season === lg.season && Array.isArray(c.alive) && Array.isArray(c.rounds);
		if (!ok) { lg.cup = lg.round <= CUP_NIGHTS[0] ? newCup(lg) : { v: 1, season: lg.season, alive: [], rounds: [], out: null, winner: null, none: true }; }
		return lg.cup;
	}
	// Penalties: five each, then sudden death; the better side scores a touch more often.
	function cupPens (sh, sa, rnd = Math.random) {
		const p = s => clamp(0.74 + 0.02 * s, 0.6, 0.9);
		let h = 0, a = 0;
		for (let k = 0; k < 5; k++) {
			if (rnd() < p(sh - sa)) { h++; }
			if (h > a + (5 - k)) { break; }
			if (rnd() < p(sa - sh)) { a++; }
			if (a > h + (4 - k) || h > a + (4 - k)) { break; }
		}
		for (let k = 0; h === a && k < 30; k++) { const x = rnd() < p(sh - sa), y = rnd() < p(sa - sh); h += x; a += y; }
		if (h === a) { h++; }
		return [ h, a ];
	}
	// One tie: ninety minutes, then thirty more, then penalties.
	function cupTie (h, a, rnd = Math.random) {
		const [ , , hg, ag ] = simMatch(h, a);
		const t = { h, a, hg, ag, et: false, pens: null };
		if (hg === ag) {
			t.et = true;
			const d = getStr(h) - getStr(a);
			t.hg += poisson(clamp(0.38 + 0.08 * d, 0.1, 0.8)); t.ag += poisson(clamp(0.32 - 0.08 * d, 0.1, 0.8));
			if (t.hg === t.ag) { t.pens = cupPens(getStr(h), getStr(a), rnd); }
		}
		t.win = t.pens ? (t.pens[0] > t.pens[1] ? h : a) : t.hg > t.ag ? h : a;
		return t;
	}
	const tieLine = t => `${TEAMS[t.h].name} ${t.hg}–${t.ag} ${TEAMS[t.a].name}${t.pens ? ` (after extra time, ${t.pens[0]}–${t.pens[1]} on penalties)` : t.et ? " (after extra time)" : ""}`;
	const youInTie = t => t.h === 0 || t.a === 0;
	// The draw for a round: the first round thins twenty to sixteen; after that everyone left plays.
	function cupDraw (alive, k) {
		const pool = shuffle(alive.slice()), playing = k === 0 ? pool.slice(0, Math.max(0, (pool.length - 16) * 2)) : pool, ties = [];
		for (let i = 0; i + 1 < playing.length; i += 2) { ties.push([ playing[i], playing[i + 1] ]); }
		return { ties, byes: pool.filter(id => !playing.includes(id)) };
	}
	// A cup night: called after every league matchday; plays a round when one is due.
	function cupNight () {
		const lg = league, cup = ensureCup(lg);
		if (!cup || cup.none || cup.winner !== null) { return null; }
		const k = CUP_NIGHTS.indexOf(lg.round);
		if (k < 0 || k < cup.skip || cup.rounds.some(r => r.k === k)) { return null; }
		const { ties, byes } = cupDraw(cup.alive, k);
		const played = ties.map(([ h, a ]) => cupTie(h, a));
		cup.alive = [ ...byes, ...played.map(t => t.win) ];
		cup.rounds.push({ k, name: CUP_ROUNDS[k], ties: played, byes });
		const mine = played.find(youInTie);
		let note = "";
		if (mine) {
			const won = mine.win === 0, opp = mine.h === 0 ? mine.a : mine.h;
			const prize = won ? (k === CUP_ROUNDS.length - 1 ? CUP_PRIZE.winner : CUP_PRIZE.win) : k === CUP_ROUNDS.length - 1 ? CUP_PRIZE.final : 0;
			if (prize) { lg.club.budget = round1(lg.club.budget + prize); }
			if (!won) { cup.out = { k, by: opp }; }
			note = `${cupName()}, ${CUP_ROUNDS[k].toLowerCase()}: ${tieLine(mine)}. ${won ? (k === CUP_ROUNDS.length - 1 ? "You've won the cup!" : "You're through.") : k === CUP_ROUNDS.length - 1 ? "Beaten in the final." : "You're out."}${prize ? ` ${money(prize)} in prize money.` : ""}`;
			toast(won ? `Cup: through to the next round` : `Cup: knocked out by ${TEAMS[opp].name}`, won ? "#7fd49b" : "#de4f5a");
		} else if (byes.includes(0)) { note = `${cupName()}: a bye in the ${CUP_ROUNDS[k].toLowerCase()}.`; }
		if (k === CUP_ROUNDS.length - 1) { cup.winner = cup.alive[0]; if (!mine) { note = `${cupName()} final: ${tieLine(played[0])}.`; } }
		if (note) { lg.news = `${lg.news || ""} ${note}`.trim(); lastDeal = note; }
		return played;
	}
	// Your next cup night, for the panel.
	function cupNext () {
		const lg = league, cup = ensureCup(lg);
		if (!cup || cup.none) { return "No cup this season: it starts again next season."; }
		if (cup.winner !== null) { return cup.winner === 0 ? "You won the cup!" : `${TEAMS[cup.winner].name} won the cup${cup.out ? `; you went out in the ${CUP_ROUNDS[cup.out.k].toLowerCase()}` : ""}.`; }
		if (cup.out) { return `Out in the ${CUP_ROUNDS[cup.out.k].toLowerCase()}, beaten by ${TEAMS[cup.out.by].name}.`; }
		const k = CUP_NIGHTS.findIndex((r, i) => i >= cup.skip && !cup.rounds.some(x => x.k === i));
		return k < 0 ? "" : `Next: the ${CUP_ROUNDS[k].toLowerCase()}, drawn after matchday ${CUP_NIGHTS[k]}.`;
	}

	/* The awards. */
	const seasonAvgOf = pl => (pl.rn > 0 ? pl.rsum / pl.rn : null);
	function seasonAwards () {
		const lg = league, c = lg.club, all = [ ...c.squad, ...c.bench ], minApps = Math.max(3, Math.round(lg.round * 0.3));
		const rated = all.filter(pl => (pl.apps || 0) >= minApps && seasonAvgOf(pl) !== null).sort((a, b) => seasonAvgOf(b) - seasonAvgOf(a));
		const scorers = all.filter(pl => (pl.goals || 0) > 0).sort((a, b) => b.goals - a.goals || (b.apps || 0) - (a.apps || 0));
		const young = rated.filter(pl => pl.age <= 21).sort((a, b) => (a === rated[0]) - (b === rated[0]));   // someone else if there is one
		const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1;
		// Manager of the season: the one whose side finished furthest above its standing at the start.
		const byStr = lg.members.slice().sort((a, b) => getStr(b) - getStr(a)), over = rows.map((r, i) => ({ id: r.id, gain: byStr.indexOf(r.id) - i, i })).sort((a, b) => b.gain - a.gain || a.i - b.i);
		const mgr = rows[0].id === 0 || (over[0].id === 0) ? 0 : over[0].gain >= 3 ? over[0].id : rows[0].id;
		const line = (pl, what) => (pl ? { name: pl.name, pos: POS_LABEL[pl.pos], what } : null);
		lg.awards = {
			season: lg.season,
			player: line(rated[0], rated[0] ? `average rating ${seasonAvgOf(rated[0]).toFixed(2)} in ${rated[0].apps} games` : ""),
			scorer: line(scorers[0], scorers[0] ? `${scorers[0].goals} goal${scorers[0].goals === 1 ? "" : "s"}` : ""),
			young: line(young[0], young[0] ? `${young[0].age}, average rating ${seasonAvgOf(young[0]).toFixed(2)}` : ""),
			manager: { id: mgr, name: mgr === 0 ? "You" : `the ${TEAMS[mgr].name} manager`, what: mgr === rows[0].id ? `champions with ${rows[0].pts} points` : `${ordinal(rows.findIndex(r => r.id === mgr) + 1)}, well above where they were expected to finish` },
			finish: pos,
			cup: lg.cup && lg.cup.winner !== null && lg.cup.winner !== undefined ? lg.cup.winner : null
		};
		const a = lg.awards, bits = [ a.player && `player of the season ${a.player.name}`, a.scorer && `top scorer ${a.scorer.name} (${a.scorer.what})`, a.young && `young player ${a.young.name}`, `manager of the season: ${a.manager.name}` ].filter(Boolean);
		lg.news = `${lg.news || ""} Season awards: ${bits.join(", ")}.`.trim();
		return a;
	}

	/* The academy. */
	function academyProspect () {
		const pos = [ "gk", "def", "def", "mid", "mid", "fwd" ][Math.floor(Math.random() * 6)];
		const coach = typeof staffLvl === "function" && league ? staffLvl(league.club, "youth") || 0 : 0;
		const pl = genPlayer(pos, 46 + Math.floor(Math.random() * 10));
		pl.age = 16 + Math.floor(Math.random() * 2); pl.pot = Math.min(92, 64 + Math.floor(Math.random() * 20) + coach * 2); pl.contract = 3; pl.role = "prospect";
		pl.nat = natsOf("home")[Math.floor(Math.random() * Math.min(4, natsOf("home").length))];
		pl.morale = 75;
		return ensurePlayer(pl);
	}
	const ACADEMY_MAX = 6;
	function ensureAcademy (c) {
		if (!Array.isArray(c.academy)) { c.academy = []; }
		c.academy = c.academy.filter(pl => pl && typeof pl === "object" && pl.name).map(ensurePlayer).slice(0, ACADEMY_MAX);
		return c.academy;
	}
	// Each summer: the youngsters already there grow toward their potential, two or three new ones come
	// through, and anyone past 19 still in the academy moves on.
	function youthIntake (c) {
		const acad = ensureAcademy(c), left = [];
		for (const pl of acad) {
			pl.age++;
			const g = Math.max(0, Math.round(((pl.pot || 60) - ovrOf(pl)) * (0.18 + Math.random() * 0.12)));
			for (const k of [ "pac", "sho", "pas", "def" ]) { pl[k] = clamp(pl[k] + g + Math.floor(Math.random() * 2), 1, 99); }
		}
		c.academy = acad.filter(pl => { if (pl.age > 19) { left.push(pl.name); return false; } return true; });
		const n = 2 + (Math.random() < 0.4 ? 1 : 0), fresh = [];
		for (let k = 0; k < n && c.academy.length < ACADEMY_MAX; k++) { const pl = academyProspect(); c.academy.push(pl); fresh.push(`${pl.name} (${POS_LABEL[pl.pos]}, ${pl.age})`); }
		if (league) { league.news = `${league.news || ""}${fresh.length ? ` Through from the academy: ${fresh.join(", ")}.` : ""}${left.length ? ` Left the academy: ${left.join(", ")}.` : ""}`.trim(); }
		return fresh;
	}
	function promoteYouth (name) {
		const c = league.club, acad = ensureAcademy(c), i = acad.findIndex(pl => pl.name === name);
		if (i < 0) { return false; }
		if (c.bench.length >= BENCH) { lastDeal = `The bench is full: release or sell someone before you promote ${name}.`; afterClubChange(); return false; }
		const [ pl ] = acad.splice(i, 1);
		c.bench.push(pl);
		lastDeal = `${pl.name} promoted from the academy to the first-team squad.`;
		c.log = [ ...(c.log || []), lastDeal ].slice(-10);
		afterClubChange();
		return true;
	}
	function releaseYouth (name) {
		const c = league.club, acad = ensureAcademy(c), i = acad.findIndex(pl => pl.name === name);
		if (i < 0) { return false; }
		acad.splice(i, 1);
		lastDeal = `${name} released from the academy.`;
		afterClubChange();
		return true;
	}

	/* The panel: a card for the cup, the awards when the season is over, and the academy. */
	function renderExtras () {
		const side = document.querySelector("#league .lg-side");
		if (!side || !league) { return; }
		let box = $("lgExtras");
		if (!box) { box = el("div", "lg-extras"); box.id = "lgExtras"; side.append(box); }
		box.replaceChildren();
		const cup = ensureCup(league);
		const cupBox = el("div", "lg-cup");
		cupBox.append(el("h4", "", cupName()), el("p", "detail", cupNext()));
		const last = cup && cup.rounds[cup.rounds.length - 1];
		if (last) {
			const ul = el("ul", "cup-ties");
			const ties = last.ties.slice().sort((a, b) => youInTie(b) - youInTie(a));
			for (const t of ties) { ul.append(el("li", youInTie(t) ? "mine" : "", tieLine(t))); }
			cupBox.append(el("span", "eyebrow", last.name), ul);
		}
		box.append(cupBox);
		const aw = league.awards;
		if (aw && aw.season === league.season) {
			const a = el("div", "lg-awards");
			a.append(el("h4", "", `Season ${aw.season} awards`));
			const ul = el("ul", "awards");
			const row = (title, x) => { if (!x) { return; } const li = el("li"); li.append(el("b", "", title), el("span", "", ` ${x.name}${x.pos ? ` (${x.pos})` : ""}, ${x.what}`)); ul.append(li); };
			row("Player of the season", aw.player); row("Top scorer", aw.scorer); row("Young player", aw.young); row("Manager of the season", aw.manager);
			if (aw.cup !== null && aw.cup !== undefined) { const li = el("li"); li.append(el("b", "", "Cup winners"), el("span", "", ` ${aw.cup === 0 ? "You" : TEAMS[aw.cup].name}`)); ul.append(li); }
			a.append(ul);
			box.append(a);
		}
		const acad = ensureAcademy(league.club);
		const ac = el("div", "lg-academy");
		ac.append(el("h4", "", "Academy"));
		if (!acad.length) { ac.append(el("p", "detail", "No youngsters in the academy right now. New ones come through every summer.")); }
		const ul = el("ul", "academy");
		for (const pl of acad) {
			const li = el("li");
			li.append(el("span", "pos", POS_LABEL[pl.pos]), el("span", "who", `${pl.name}, ${pl.age} · OVR ${ovrOf(pl)} · potential ${Math.round(pl.pot)}`));
			const pr = el("button", "", "Promote"); pr.type = "button"; pr.disabled = league.club.bench.length >= BENCH; pr.title = pr.disabled ? "The bench is full" : "Move him to the first-team bench"; pr.addEventListener("click", () => promoteYouth(pl.name));
			const rl = el("button", "", "Release"); rl.type = "button"; rl.addEventListener("click", () => releaseYouth(pl.name));
			li.append(pr, rl);
			ul.append(li);
		}
		ac.append(ul);
		box.append(ac);
	}
