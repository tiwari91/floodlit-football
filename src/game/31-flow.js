	/* ---------- flow ---------- */
	function newMatch () {
		leagueMatch = mode === "league" ? currentFixture() : null;
		applyFormat(mode === "league" && league ? league.fmt : fmtSel.value);
		setOpponent(leagueMatch ? TEAMS[leagueMatch.opp] : FRIENDLY, !leagueMatch || leagueMatch.home);
		homeSide = !leagueMatch || leagueMatch.home ? 0 : 1;
		cond = leagueMatch
			? makeConditions((leagueMatch.home ? YOU : TEAMS[leagueMatch.opp]).surface, league.weather[leagueMatch.round], league.wind[leagueMatch.round], league.ko[leagueMatch.round])
			: makeConditions(groundSel.value, weatherSel.value, null, "night");
		// Home advantage: the visitors play a little below their rating.
		// Home advantage: the visitors play a little below their rating.
		oppStrength = leagueMatch ? getStr(leagueMatch.opp) + (leagueMatch.home ? -0.3 : 0.3) : { easy: 2, normal: 3, hard: 4.5 }[diffSel.value] || 3;
		// The corner shootout is played against a side nearer your own level.
		const oppStr = leagueMatch ? getStr(leagueMatch.opp) + (leagueMatch.home ? -0.3 : 0.3) : (mode === "corners" ? { easy: 1.5, normal: 2.2, hard: 3.4 } : { easy: 2, normal: 3, hard: 4.5 })[diffSel.value] || 3;
		diff = strengthCfg(oppStr);
		applyLevel();
		subNo = [ 0, 0 ]; stall = 0; addedDone = [ false, false ];
		planOthers(leagueMatch);
		oppSquad = cpuSquad(leagueMatch ? leagueMatch.opp : 99, oppStr);
		$("fmtName").textContent = FMT.label;
		score = [ 0, 0 ];
		stats = { passes: 0, completed: 0, shots: 0, tackles: 0, aiTackles: 0, corners: 0, fouls: 0, cards: 0 };
		oppStats = { passes: 0, completed: 0, shots: 0, tackles: 0, corners: 0, fouls: 0, cards: 0 }; oppPending = false;
		matchInjuries = []; matchInjInfo = {};
		matchCards = []; dismissed = [];
		matchLog = []; matchGoals = [];
		subsLeft = SUBS_MAX; cpuSubs = SUBS_MAX; subLog = []; cameOn = []; wentOff = []; subPick = {}; genericBench = null; cpuSubWin = 0; matchSta = {};
		updateSubsBtn();
		possFrames = [ 0, 0 ];
		tally = newTally(); cornerAt = [ -9999, -9999 ];
		momentum = leagueMatch ? (homeSide === 0 ? 0.12 : -0.12) : 0;   // the home crowd gives the home side a start
		passStreak = [ 0, 0 ]; bestStreak = [ 0, 0 ]; heavyTouches = [ 0, 0 ];
		mentality = [ 0, 0 ];
		surge = null;
		teamShape = [ shapeKeyOf(fmtKey), shapeKeyOf(fmtKey) ];
		readInstructions();
		// The computer has its own way of playing, never a copy of yours: a league club keeps its
		// identity (changing it only if it would match you exactly); a friendly opponent is drawn at random.
		if (leagueMatch) {
			[ style[1], press[1] ] = cpuInstructions(leagueMatch.opp, getStr(leagueMatch.opp));
			if (style[1] === style[0] && press[1] === press[0]) {
				const alts = Object.keys(STYLES).filter(k => k !== style[0]);
				style[1] = alts[leagueMatch.opp % alts.length];
			}
		} else {
			const ss = Object.keys(STYLES).filter(k => k !== style[0]), ps = Object.keys(PRESSES);
			style[1] = ss[Math.floor(Math.random() * ss.length)];
			press[1] = ps[Math.floor(Math.random() * ps.length)];
		}
		// The computer's line follows its press, and each club has its own way of tackling.
		line[1] = press[1] === "high" ? "high" : press[1] === "low" ? "deep" : "normal";
		tackling[1] = leagueMatch ? [ "normal", "hard", "careful", "normal" ][leagueMatch.opp % 4] : [ "careful", "normal", "hard" ][Math.floor(Math.random() * 3)];
		moodZone = 0;
		matchLen = Number(lenSel.value);
		timeLeft = matchLen;
		makePlayers();
		applySquad();
		reshape(1, cpuShapeKey());   // and its own formation
		buildCrowd();
		kickoff(0);
		freeze = 0;
		goFlash = 0;
		halfDone = false;
		renderModeBadge();
		renderHud();
		updateNextNote();
	}

	// Settings changed mid-match wait for the next one; say so.
	function updateNextNote () {
		const live = state !== "intro" && state !== "full";
		const seasonFmt = false;
		nextNote.textContent = seasonFmt ? "Teams applies from the next season" : "Applies from the next match";
		const condChanged = (mode === "friendly" && cond && (weatherSel.value !== cond.weatherKey || groundSel.value !== cond.surfaceKey)) ||
			(FMT.shape && shapeOf(fmtKey) !== FMT.shape);
		nextNote.hidden = !(seasonFmt || (live && (fmtSel.value !== fmtKey || Number(lenSel.value) !== matchLen || condChanged)));
	}

