	/* ---------- pressure: the fans, the press, the board and the bust-ups ----------
	   Results build up or wear away two more moods kept in league.drama beside the dressing room (room,
	   18e): the fans (fans) and the board (board). When they sour, problems arrive in the League panel
	   with the dressing room's, each with choices that move those moods, morale and form:
	   - fans: the crowd turns on you (boos at full time, chants, a "manager out" banner);
	   - press: the press conference after a bad result asks the awkward question;
	   - confront: a star you keep leaving out storms into your office and refuses to warm up;
	   - training: two hot-heads come to blows on the training ground;
	   - faith: the dressing room has been lost for weeks and the senior players go to the board;
	   - life: something away from football (a night out in the papers, an ill relative, a new baby, a rant
	     on social media) that puts him off his game unless you handle it.
	   In matches, a hostile crowd boos at full time and when a favourite is taken off. */
	const PRESSURE_KINDS = { fans: 1, press: 1, confront: 1, training: 1, faith: 1, life: 1 };
	const PRESSURE_NOBODY = { fans: 1, press: 1, faith: 1 };   // not about one player: they stay when anyone leaves
	Object.assign(DRAMA_KINDS, PRESSURE_KINDS);
	const fansWord = f => (f >= 75 ? "Adoring" : f >= 55 ? "Behind you" : f >= 35 ? "Restless" : "Hostile");
	const boardWord = b => (b >= 70 ? "Fully behind you" : b >= 50 ? "Supportive" : b >= 30 ? "Concerned" : "Losing patience");
	function ensurePressure (d) {
		d.fans = clamp(Math.round(Number.isFinite(d.fans) ? d.fans : 65), 0, 100);
		d.board = clamp(Math.round(Number.isFinite(d.board) ? d.board : 65), 0, 100);
		d.form = Array.isArray(d.form) ? d.form.filter(x => x === "W" || x === "D" || x === "L").slice(-6) : [];
		if (!Number.isFinite(d.lowRoom)) { d.lowRoom = 0; }
		return d;
	}
	// The press conference: the question fits the week.
	function pressQuestion (d, gf, ga) {
		const losses = d.form.filter(x => x === "L").length;
		if (d.room < 40) { return "Have you lost the dressing room?"; }
		if (losses >= 3) { return `That's ${losses} defeats in your last ${d.form.length}. Is your job safe?`; }
		if (ga - gf >= 3) { return `Your side let in ${ga}. Who is to blame for that?`; }
		if (d.fans < 40) { return "The fans were booing you today. What do you say to them?"; }
		return "Was that good enough?";
	}
	// After each league match (from dramaAfterMatch): the moods move and new problems may arrive.
	function pressureAfterMatch (played, gf, ga, rnd = Math.random) {
		const d = ensureDrama(league), c = league.club, made = [], lm = leagueMatch || {};
		const res = gf > ga ? "W" : gf < ga ? "L" : "D", home = lm.home !== false, heavy = ga - gf >= 3;
		d.form = [ ...d.form, res ].slice(-6);
		d.fans += res === "W" ? 4 : res === "D" ? -1 : -5 - (heavy ? 4 : 0) - (home ? 2 : 0);
		d.fans += (60 - d.fans) * 0.05;
		d.board += (res === "W" ? 3 : res === "D" ? 0 : -4) + (d.fans - 50) * 0.04 + (60 - d.board) * 0.03;
		ensurePressure(d);
		const add = (kind, who, text, o) => { const x = addIssue(kind, who, text, o); if (x) { made.push(x); } return x; };
		// The fans turn on you.
		if (res === "L" && d.fans < 40) {
			add("fans", { name: "The fans" }, home
				? `The home fans booed at full time after the ${gf}-${ga}. They sang for the players, but your name got jeers, and a "Manager out" banner went up in the home end.`
				: `The travelling fans turned on you after the ${gf}-${ga}: boos at the final whistle and chants against your team selection.`);
		}
		// The press conference.
		const losses = d.form.filter(x => x === "L").length;
		if ((res === "L" && rnd() < 0.55) || heavy || (res === "L" && losses >= 3)) {
			add("press", { name: "The press" }, `Press conference after the ${gf}-${ga}. A reporter asks: "${pressQuestion(d, gf, ga)}"`);
		}
		// A star left out again confronts you.
		for (const pl of [ ...c.squad, ...c.bench ]) {
			if (!pl || played.has(pl.name) || pl.injured || roleOf(pl, c) !== "key") { continue; }
			const t = temperOf(pl);
			if (pl.benched >= 2 && t >= 60 && pl.morale < 55 && rnd() < 0.3 + (t - 60) / 100) {
				if (add("confront", pl, `${pl.name} stormed into your office after being left out again. He says he's the best player at the club, he won't sit on your bench, and he refused to warm up.`)) {
					pl.morale = clamp(pl.morale - 4, 5, 100); d.room = clamp(d.room - 3, 0, 100);
				}
				break;
			}
		}
		// A fight on the training ground: the two hottest heads, more likely in a tense week.
		const hot = [ ...c.squad, ...c.bench ].filter(p => p && temperOf(p) >= 60 && !p.injured).sort((a, b) => temperOf(b) - temperOf(a));
		if (hot.length >= 2 && rnd() < clamp(0.04 + (70 - d.room) / 300 + (res === "L" ? 0.06 : 0), 0.02, 0.35)) {
			const [ a, b ] = hot;
			if (add("training", a, `${a.name} and ${b.name} came to blows at training. Their teammates had to pull them apart, and the whole squad saw it.`, { other: b.name })) {
				d.room = clamp(d.room - 4, 0, 100); a.morale = clamp(a.morale - 3, 5, 100); b.morale = clamp(b.morale - 3, 5, 100);
			}
		}
		// A dressing room lost for weeks: the players go to the board.
		d.lowRoom = d.room < 30 ? d.lowRoom + 1 : 0;
		if (d.lowRoom >= 2) {
			if (add("faith", { name: "The squad" }, "The players have stopped listening to you. Senior players have been to see the board, and the board want to know what you'll do about it.")) { d.board = clamp(d.board - 6, 0, 100); d.lowRoom = 0; }
		}
		// Life away from football: now and then one of the squad has something going on.
		const squad = [ ...c.squad, ...c.bench ].filter(p => p && !p.injured);
		if (squad.length && rnd() < 0.14) {
			const r = rnd(), pl = squad[Math.floor(rnd() * squad.length) % squad.length], hot = temperOf(pl) >= 60;
			const ev = r < 0.3 ? "night" : r < 0.55 ? "family" : r < 0.75 ? "baby" : "social";
			if (ev === "social" && !hot && rnd() < 0.5) { /* the calm ones rarely post */ }
			else {
				const text = {
					night: `${pl.name} was photographed leaving a nightclub at 3am, two days before the match. The papers have the pictures.`,
					family: `${pl.name}'s mother has been taken into hospital. He's struggling to concentrate in training.`,
					baby: `${pl.name} has become a father. He's over the moon, but hasn't slept in days.`,
					social: `${pl.name} posted a long rant on social media about his playing time and the club. The fans are taking sides.`
				}[ev];
				if (add("life", pl, text, { ev })) { pl.morale = clamp(pl.morale + (ev === "baby" ? 4 : -4), 5, 100); nudgeForm(pl, ev === "baby" ? -0.1 : -0.2); }
			}
		}
		if (d.board < 25 && !d.warned) { d.warned = true; dramaLog("The board have warned you: results must improve, and soon."); }
		if (d.board >= 40) { d.warned = false; }
		return made;
	}
	// The buttons for each kind (18e's choicesFor asks here first).
	const PRESSURE_CHOICES = {
		fans: () => [ [ "apologise", "Apologise to the fans" ], [ "players", "Back the players" ], [ "ignore", "Ignore it" ] ],
		press: () => [ [ "defend", "Defend the players" ], [ "blame", "Blame the players" ], [ "self", "Take the blame" ], [ "deflect", "Say nothing new" ] ],
		confront: () => [ [ "peace", "Make peace" ], [ "fine", "Fine him" ], [ "drop", "Drop him" ], [ "sell", "Put him up for sale" ] ],
		training: i => [ [ "a", `Punish ${i.name}` ], [ "b", `Punish ${i.other}` ], [ "both", "Punish both" ], [ "talk", "Talk to both" ] ],
		life: i => ({
			night: [ [ "fine", "Fine him" ], [ "talk", "Have a word" ], [ "ignore", "Let it go" ] ],
			family: [ [ "leave", "Give him time off" ], [ "play", "Ask him to keep playing" ] ],
			baby: [ [ "leave", "Give him a few days off" ], [ "congrats", "Congratulate him" ] ],
			social: [ [ "fine", "Fine him" ], [ "talk", "Talk to him" ], [ "backhim", "Say he has a point" ] ]
		}[i.ev] || [ [ "talk", "Talk to him" ] ]),
		faith: () => [ [ "meeting", "Clear-the-air meeting" ], [ "leaders", "Come down on the ringleaders" ], [ "board", "Ask the board for time" ] ]
	};
	// What each choice does (from 18e's resolveIssue). Returns the line for the log.
	function resolvePressure (issue, choice) {
		const d = ensureDrama(league), c = league.club, pl = clubPlayer(issue.name), mood = (k, v) => { d[k] = clamp(Math.round(d[k] + v), 0, 100); };
		const starters = slotsFor(league.fmt).map(i => c.squad[i]).filter(Boolean);
		if (issue.kind === "fans") {
			if (choice === "apologise") { mood("fans", 8); mood("room", -2); mood("board", 1); return "You apologised to the fans and promised better. They'll give you a little time."; }
			if (choice === "players") { mood("fans", -3); mood("room", 5); return "You stood up for your players in public. The squad noticed; the fans didn't like it."; }
			mood("fans", -2); return "You said nothing to the fans. The mood in the stands hasn't changed.";
		}
		if (issue.kind === "press") {
			if (choice === "defend") { mood("room", 4); mood("fans", -1); return "You defended your players in front of the cameras. The dressing room appreciated it."; }
			if (choice === "blame") { mood("room", -8); mood("fans", 3); mood("board", 2); for (const p of starters) { p.morale = clamp(p.morale - 4, 5, 100); } return "You blamed the players in public. The fans and the board liked your honesty; the players did not."; }
			if (choice === "self") { mood("room", 3); mood("fans", 2); mood("board", -3); return "You took the blame yourself. The players and fans respected it; the board took note."; }
			mood("fans", -1); return "You gave the press nothing new. The story moves on.";
		}
		if (issue.kind === "faith") {
			if (choice === "meeting") { mood("room", 12); mood("board", -4); return "A long clear-the-air meeting. Some home truths on both sides, and the squad are listening again."; }
			if (choice === "leaders") {
				const lead = [ ...c.squad, ...c.bench ].filter(Boolean).sort((a, b) => temperOf(b) - temperOf(a)).slice(0, 2);
				for (const p of lead) { p.morale = clamp(p.morale - 12, 5, 100); }
				mood("room", 6); mood("board", 2);
				return `You came down hard on ${lead.map(p => p.name).join(" and ")}. The rest of the squad have fallen into line.`;
			}
			mood("board", -8); mood("room", 5); return "The board have given you time, but their patience is running out.";
		}
		if (!pl) { return `${issue.name} has gone, so that's the end of it.`; }
		if (issue.kind === "life") {
			const m = v => { pl.morale = clamp(pl.morale + v, 5, 100); };
			const k = `${issue.ev}:${choice}`;
			if (k === "night:fine") { m(-6); mood("room", 2); mood("fans", 1); const f = Math.max(0.001, wageOf(pl) / 52); c.budget = Math.round((c.budget + f) * 1000) / 1000; return `${pl.name} has been fined for the night out. He's sulking (morale ${pl.morale}), but he'll be in bed early this week.`; }
			if (k === "night:talk") { m(1); nudgeForm(pl, -0.1); return `You had a word with ${pl.name} about the night out. He says it won't happen again.`; }
			if (k === "night:ignore") { mood("room", -2); mood("fans", -2); nudgeForm(pl, -0.3); return `You let ${pl.name}'s night out go. Some of the squad wonder why the rules don't apply to him, and his form is slipping.`; }
			if (k === "family:leave" || k === "baby:leave") { m(10); mood("room", 2); dropToBench(pl); nudgeForm(pl, 0.2); return `${pl.name} has a few days at home and is grateful (morale ${pl.morale}). He'll miss the next game, but come back with a clear head.`; }
			if (k === "family:play") { m(-10); nudgeForm(pl, -0.5); mood("room", -2); return `${pl.name} keeps playing, but his mind is elsewhere (morale ${pl.morale}). The squad think you were hard on him.`; }
			if (k === "baby:congrats") { m(4); nudgeForm(pl, -0.2); return `You congratulated ${pl.name}. He's happy, if a little tired for the next few games.`; }
			if (k === "social:fine") { m(-8); mood("room", 2); mood("board", 1); return `${pl.name} has been fined and the post is deleted. He's not happy (morale ${pl.morale}).`; }
			if (k === "social:backhim") { m(6); mood("board", -3); mood("room", -2); return `You said ${pl.name} has a point. He's happier (morale ${pl.morale}); the board are not.`; }
			m(2); return `You talked to ${pl.name} and he took the post down.`;
		}
		if (issue.kind === "confront") {
			if (choice === "peace") { pl.morale = clamp(pl.morale + 8, 5, 100); pl.promised = 2; mood("room", -2); return `You made peace with ${pl.name} and promised him games. Some of the squad think he got his way.`; }
			if (choice === "fine") { pl.morale = clamp(pl.morale - 10, 5, 100); mood("room", 3); const f = Math.max(0.001, wageOf(pl) / 52); c.budget = Math.round((c.budget + f) * 1000) / 1000; nudgeForm(pl, -0.3); return `${pl.name} has been fined a week's wages for refusing to warm up. Morale ${pl.morale}.`; }
			if (choice === "drop") { pl.morale = clamp(pl.morale - 12, 5, 100); mood("room", 2); dropToBench(pl); nudgeForm(pl, -0.4); return `${pl.name} is out of the side until he apologises. Morale ${pl.morale}.`; }
			pl.listed = true; pl.wantsOut = true; mood("room", 1); return `${pl.name} is on the transfer list. Clubs will bid for him when a window is open.`;
		}
		if (issue.kind === "training") {
			const other = clubPlayer(issue.other), both = [ pl, other ].filter(Boolean), hit = (p, m, f) => { if (p) { p.morale = clamp(p.morale + m, 5, 100); nudgeForm(p, f); } };
			if (choice === "a") { hit(pl, -8, -0.3); hit(other, 2, 0); mood("room", 2); return `You came down on ${pl.name}. ${issue.other} feels he was in the right.`; }
			if (choice === "b") { hit(other, -8, -0.3); hit(pl, 2, 0); mood("room", 2); return `You came down on ${issue.other}. ${pl.name} feels he was in the right.`; }
			if (choice === "both") { for (const p of both) { hit(p, -6, -0.2); } mood("room", 3); return `Both ${pl.name} and ${issue.other} have been fined. The squad know where the line is.`; }
			for (const p of both) { hit(p, 3, 0.1); } mood("room", -1); return `You sat ${pl.name} and ${issue.other} down together. They shook hands, for now.`;
		}
		return "";
	}
	// In a match: a hostile crowd boos your side off at full time (a league game you lost), and boos when
	// a favourite is taken off.
	function fansAtFullTime (h, a) {
		const d = league && league.drama;
		if (!leagueMatch || leagueMatch.intl || !d || !Number.isFinite(d.fans) || h >= a || d.fans >= 50) { return; }
		if (typeof crowdBoo === "function") { crowdBoo(d.fans < 35 ? 1.4 : 1); }
		toast(d.fans < 35 ? `The fans boo at full time: "${fansWord(d.fans)}"` : "Boos from the stands at full time", "#e05a4f");
	}
	function fansAtSub (outName) {
		const d = league && league.drama, pl = leagueMatch && !leagueMatch.intl ? clubPlayer(outName) : null;
		if (!pl || !d || !Number.isFinite(d.fans) || d.fans >= 55 || roleOf(pl, league.club) !== "key") { return; }
		if (typeof crowdBoo === "function") { crowdBoo(0.8); }
		toast(`Boos as ${outName} goes off`, "#e05a4f");
	}
