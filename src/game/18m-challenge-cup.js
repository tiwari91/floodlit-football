	/* ---------- the Challenge Cup ----------
	   The second domestic cup, the oldest and the one with the giant-killings: the twenty clubs of the
	   division and up to twelve from below it. The third round cuts the field to sixteen (the rest have a
	   bye), then everyone left plays. A draw in the third or fourth
	   round is replayed at the other ground; from the quarter-finals a tie goes to extra time and
	   penalties on the night. The final is at a neutral ground. Ties are played out from the two sides'
	   strength, like the League Cup's (18d, whose tie, penalty and line helpers this uses). */
	const CH_NIGHTS = [ 8, 15, 22, 30, 36 ];   // after these league matchdays, clear of the League Cup's
	const CH_ROUNDS = [ "Third round", "Fourth round", "Quarter-finals", "Semi-finals", "Final" ];
	const CH_REPLAY_ROUNDS = 2;               // the first two rounds have replays
	const CH_PRIZE = { win: 0.12, final: 0.6, winner: 1.2 };
	const CH_NAME = "Challenge Cup";
	function newChallenge (lg) {
		const below = shuffle(TEAMS.map((t, i) => i).filter(i => i !== 0 && !lg.members.includes(i))).slice(0, 32 - lg.members.length);
		return { v: 1, season: lg.season, alive: [ ...lg.members, ...below ], below, rounds: [], out: null, winner: null };
	}
	// An old save, or one from before this cup: a cup if its first night is still to come, otherwise next season.
	function ensureChallenge (lg) {
		if (!lg || !Array.isArray(lg.members)) { return null; }
		const c = lg.chall;
		if (!(c && c.v === 1 && c.season === lg.season && Array.isArray(c.alive) && Array.isArray(c.rounds))) {
			lg.chall = lg.round <= CH_NIGHTS[0] ? newChallenge(lg) : { v: 1, season: lg.season, alive: [], below: [], rounds: [], out: null, winner: null, none: true };
		}
		return lg.chall;
	}
	// One tie. In the replay rounds a draw is played again at the other ground (and that one is settled on the night).
	function challengeTie (h, a, k) {
		if (k >= CH_REPLAY_ROUNDS) { return cupTie(h, a); }
		const [ , , hg, ag ] = simMatch(h, a);
		if (hg !== ag) { return { h, a, hg, ag, et: false, pens: null, win: hg > ag ? h : a }; }
		const r = cupTie(a, h);
		return { h, a, hg, ag, et: false, pens: null, replay: r, win: r.win };
	}
	const challengeLine = t => `${TEAMS[t.h].name} ${t.hg}–${t.ag} ${TEAMS[t.a].name}${t.replay ? `; replay ${tieLine(t.replay)}` : t.pens ? ` (after extra time, ${t.pens[0]}–${t.pens[1]} on penalties)` : t.et ? " (after extra time)" : ""}`;
	// A giant-killing: a club from below the division knocks out one from it.
	const giantKilling = (t, below) => below.includes(t.win) && !below.includes(t.win === t.h ? t.a : t.h);

	// A Challenge Cup night, called after every league matchday; plays a round when one is due.
	function challengeNight () {
		const lg = league, cup = ensureChallenge(lg);
		if (!cup || cup.none || cup.winner !== null) { return null; }
		const k = CH_NIGHTS.indexOf(lg.round);
		if (k < 0 || cup.rounds.some(r => r.k === k)) { return null; }
		// The third round plays only as many as it takes to leave sixteen; an odd one out has a bye.
		const pool = shuffle(cup.alive.slice()), n = k === 0 ? Math.max(0, (pool.length - 16) * 2) : pool.length - (pool.length % 2);
		const playing = pool.slice(0, n), byes = pool.slice(n), played = [];
		for (let i = 0; i + 1 < playing.length; i += 2) { played.push(challengeTie(playing[i], playing[i + 1], k)); }
		cup.alive = [ ...byes, ...played.map(t => t.win) ];
		cup.rounds.push({ k, name: CH_ROUNDS[k], ties: played, byes });
		const mine = played.find(youInTie), last = k === CH_ROUNDS.length - 1;
		let note = "";
		if (mine) {
			const won = mine.win === 0, opp = mine.h === 0 ? mine.a : mine.h;
			const prize = won ? (last ? CH_PRIZE.winner : CH_PRIZE.win) : last ? CH_PRIZE.final : 0;
			if (prize) { lg.club.budget = round1(lg.club.budget + prize); }
			if (!won) { cup.out = { k, by: opp }; }
			const shock = !won && cup.below.includes(opp) ? " A giant-killing: they're from below the division." : "";
			note = `${CH_NAME}, ${CH_ROUNDS[k].toLowerCase()}: ${challengeLine(mine)}. ${won ? (last ? "You've won the Challenge Cup!" : "You're through.") : last ? "Beaten in the final." : "Out of the cup."}${shock}`;
			toast(won ? `${CH_NAME}: through` : `${CH_NAME}: knocked out by ${TEAMS[opp].name}`, won ? "#7fd49b" : "#de4f5a");
		} else if (byes.includes(0)) {
			note = `${CH_NAME}: a bye in the ${CH_ROUNDS[k].toLowerCase()}.`;
		} else {
			const shocks = played.filter(t => giantKilling(t, cup.below));
			if (shocks.length) { note = `${CH_NAME}, ${CH_ROUNDS[k].toLowerCase()}: giant-killing${shocks.length > 1 ? "s" : ""}: ${shocks.map(challengeLine).join("; ")}.`; }
		}
		if (last) {
			cup.winner = cup.alive[0];
			if (cup.winner === 0 && typeof queueTrophy === "function") { queueTrophy(CH_NAME); }
			if (!mine && played[0]) { note = `${CH_NAME} final: ${challengeLine(played[0])}.`; }
		}
		if (note) { lg.news = `${lg.news || ""} ${note}`.trim(); lastDeal = note; }
		return played;
	}
	function challengeNext () {
		const cup = ensureChallenge(league);
		if (!cup || cup.none) { return "No Challenge Cup this season: it starts again next season."; }
		if (cup.winner !== null) { return cup.winner === 0 ? "You won the Challenge Cup!" : `${TEAMS[cup.winner].name} won the Challenge Cup${cup.out ? `; you went out in the ${CH_ROUNDS[cup.out.k].toLowerCase()}` : ""}.`; }
		if (cup.out) { return `Out in the ${CH_ROUNDS[cup.out.k].toLowerCase()}, beaten by ${TEAMS[cup.out.by].name}.`; }
		const k = CH_NIGHTS.findIndex((r, i) => !cup.rounds.some(x => x.k === i));
		return k < 0 ? "" : `Next: the ${CH_ROUNDS[k].toLowerCase()}, drawn after matchday ${CH_NIGHTS[k]}.${k === 0 ? ` ${cup.alive.length} clubs, ${cup.below.length} of them from below the division; draws in the first two rounds are replayed.` : ""}`;
	}
	// Its card on the Cups tab, after the League Cup's (18d).
	function renderChallenge (box) {
		const cup = ensureChallenge(league);
		const card = el("div", "lg-cup lg-chall");
		card.append(el("h4", "", CH_NAME), el("p", "detail", challengeNext()));
		const last = cup && cup.rounds[cup.rounds.length - 1];
		if (last) {
			const ul = el("ul", "cup-ties");
			const ties = last.ties.slice().sort((a, b) => youInTie(b) - youInTie(a) || giantKilling(b, cup.below) - giantKilling(a, cup.below));
			for (const t of ties) { ul.append(el("li", youInTie(t) ? "mine" : giantKilling(t, cup.below) ? "shock" : "", challengeLine(t))); }
			card.append(el("span", "eyebrow", last.name + (last.k === CH_ROUNDS.length - 1 ? " · neutral ground" : "")), ul);
		}
		box.append(card);
	}
