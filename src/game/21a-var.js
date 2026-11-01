	/* ---------- VAR ----------
	   The video referee checks some goals. A goal by a man who was within a stride of the offside line when
	   the ball was played to him is always checked; any other goal now and then (a possible foul in the
	   build-up). The celebration stops, VAR CHECK goes up on the banner and the big screen and the crowd waits,
	   then the decision: beyond the line by any margin (or the foul): the goal is ruled out, the score goes
	   back and the defenders take a free kick from where it happened; otherwise the goal stands and the
	   celebration carries on. Not in the tutorial or a shoot-out, and no offside check with offside off.
	   Test hook: window.__ffVar = "out" or "stand" forces a build-up check with that outcome. */
	let varCheck = null;   // { scorer, kind, off, d, at, by, spot, started, decided }
	let lastPassOffside = null;   // the offside picture at the pass before the last kick (the shot)
	const VAR_LEN = 240, VAR_AT = 130;   // frames of checking (4 s), from this far into the celebration
	function varOnGoal (scorer) {
		varCheck = null;
		if (shoot || tut || bulkSim || mode === "tutorial") { return; }
		const by = ball.lastBy;
		if (!by || by.team !== scorer) { return; }   // own goals are not checked
		const P = lastPassOffside, mg = P && P.team === scorer && P.margin ? P.margin.get(by) : null, force = window.__ffVar;
		let kind = null, off = false, d = 0;
		if (mg && offsideOn() && !force) { kind = "offside"; d = mg.d; off = d > 0.4; }
		else if (force || Math.random() < 0.07) { kind = "foul"; off = force ? force === "out" : Math.random() < 0.3; }
		if (!kind) { return; }
		varCheck = { scorer, kind, off, d, at: VAR_AT, by, spot: { x: clamp(mg ? mg.x : by.x, 20, FW - 20), y: clamp(mg ? mg.y : by.y, 20, FH - 20) }, started: false, decided: false };
		goalTimer += VAR_LEN + 60;
	}
	const varChecking = () => !!(varCheck && celeb && varCheck.started && !varCheck.decided);
	// Each frame of a goal (after the celebration's step). Returns true while the check is on.
	function varStep () {
		const V = varCheck;
		if (!V || !celeb || V.decided) { return false; }
		const T = celeb.t, who = V.by.name || teamName(V.scorer);
		if (!V.started && T >= V.at) {
			V.started = true;
			banner.textContent = "VAR check"; banner.className = "banner call " + (V.scorer === 0 ? "home" : "away"); banner.hidden = false;
			caption("VAR", "review", V.kind === "offside" ? "Checking for offside" : "Checking the build-up", `${who} · ${minuteNow()}'`, V.scorer);
			$("announce").textContent = "The video referee is checking the goal.";
			if (typeof crowdHush !== "undefined") { crowdHush = Math.max(crowdHush, VAR_LEN); }
		}
		if (!V.started) { return false; }
		if (T < V.at + VAR_LEN) {
			for (const p of players) { p.vx *= 0.8; p.vy *= 0.8; p.celebA = (p.celebA || 0) * 0.95; p.hug = (p.hug || 0) * 0.9; p.kneel = (p.kneel || 0) * 0.9; }
			return true;
		}
		V.decided = true;
		if (!V.off) {
			banner.textContent = "Goal stands"; banner.className = "banner goal " + (V.scorer === 0 ? "home" : "away"); banner.hidden = false;
			caption("Goal stands", "review", V.kind === "offside" ? `Onside by ${cm(V.d)}` : "No foul", who, V.scorer);
			if (typeof roar === "function") { roar(0.8); }
			return false;
		}
		// Ruled out: the score, the log and the scorers go back, and the defenders take the free kick.
		score[V.scorer] = Math.max(0, score[V.scorer] - 1);
		tally.goals[V.scorer] = Math.max(0, tally.goals[V.scorer] - 1);
		for (let i = matchLog.length - 1; i >= 0; i--) { if (matchLog[i].kind === "goal" && matchLog[i].team === V.scorer) { matchLog.splice(i, 1); break; } }
		const list = V.scorer === 0 ? matchGoals : matchGoalsOpp, at = list.lastIndexOf(V.by.name);
		if (at >= 0) { list.splice(at, 1); }
		logEvent(V.scorer, "var", `${who}: goal ruled out by VAR (${V.kind === "offside" ? "offside" : "foul in the build-up"})`);
		caption("Goal ruled out", "review", V.kind === "offside" ? `Offside by ${cm(V.d)}` : "Foul in the build-up", who, V.scorer);
		banner.textContent = "No goal"; banner.className = "banner call " + (V.scorer === 0 ? "away" : "home"); banner.hidden = false;
		setTimeout(() => { if (banner.textContent === "No goal") { banner.hidden = true; } }, 1800);
		$("announce").textContent = `VAR: no goal. ${score[0]} to ${score[1]}.`;
		if (V.scorer === homeSide && typeof crowdBoo === "function") { crowdBoo(1.1); }
		for (const p of players) { p.celebA = 0; p.celebK = 0; p.hug = 0; p.kneel = 0; p.sulk = 0; p.jump = 0; p.headHands = 0; }
		celeb = null; replay = null; goalTimer = 0; state = "play";
		const defs = players.filter(q => q.team !== V.scorer && q.role !== "gk"), taker = defs.reduce((a, b) => (dist(a, V.spot) < dist(b, V.spot) ? a : b));
		taker.dir = taker.team === 0 ? 0 : Math.PI;
		if (V.kind === "offside") { tally.offsides[V.scorer]++; }
		awardFreeKick(taker.team, taker, { taker, spot: V.spot, indirect: V.kind === "offside", quiet: true });
		freeze = 60;
		varCheck = null;
		return false;
	}
