	/* ---------- momentum ----------
	   -1 (CPU on top) .. +1 (you on top). Keeping the ball builds it; tackles,
	   completed passes and goals swing it. The side on top plays a little quicker
	   and sharper; the side under it is rattled: slower, misplaced passes, wider
	   shots, weaker tackles and saves. */
	const POSS_GAIN = 1 / (60 * 12);   // ~12 s of unbroken possession to go from even to full
	let momentum = 0, moodZone = 0;
	const edge = t => (t === 0 ? Math.max(0, momentum) : Math.max(0, -momentum));
	const mood = (t, amt) => 1 + amt * edge(t) - amt * edge(1 - t);
	function swing (t, amt) { momentum = clamp(momentum + (t === 0 ? amt : -amt), -1, 1); }
	// After a goal the scorers go for another: for about four match minutes they press high and
	// squeeze up, and the side that conceded wobbles (loose passes, heavy touches, softer tackles).
	let surge = null;   // { team, until, press, line }
	const surgeMins = 4;
	const wobble = t => (surge && surge.team !== t ? 1 : 0);
	function startSurge (t) {
		endSurge();
		surge = { team: t, until: frame + Math.round(matchLen * 60 * surgeMins / 90), press: press[t], line: line[t] };
		press[t] = "high"; line[t] = "high";
	}
	function endSurge () {
		if (!surge) { return; }
		press[surge.team] = surge.press; line[surge.team] = surge.line;
		surge = null;
	}
	// Pass runs: every completed pass in a row adds a little more, so a side that keeps
	// knocking it about takes over the game and the side chasing it gets tense.
	let passStreak = [ 0, 0 ], bestStreak = [ 0, 0 ], heavyTouches = [ 0, 0 ];
	const teamName = t => (t === 0 ? "You" : opp.short);
	function completedPass (t) {
		const n = ++passStreak[t];
		bestStreak[t] = Math.max(bestStreak[t], n);
		swing(t, 0.012 + 0.004 * Math.min(n, 10) + 0.02 * edge(1 - t));   // a tense side calms itself by keeping it
		if (n === 5) { toast(`${n} passes in a row`, t === 0 ? "#7fd49b" : "#f2b52e"); }
		else if (n === 10 || n === 15 || n === 20) {
			toast(n === 10 ? "Olé! 10 passes in a row" : `Olé! ${n} passes, ${t === 0 ? opp.short : "you"} can't get near it`, t === 0 ? "#7fd49b" : "#f2b52e");
			if (typeof chant === "function" && (homeSide === t || n >= 15)) { try { chant(0.9); } catch (e) { /* audio is optional */ } }
		}
	}
	// The home crowd lifts its side: late in a game it isn't winning comfortably, a home attack into the final
	// third brings a roar and a chant, and the players feed off it (momentum swings their way, so they play a
	// little quicker and sharper, and the visitors a little more nervous). Your own fans give more when they
	// love you and little when they have turned on you (league.drama.fans, 18k); never in the tutorial.
	let liftAt = -99999;
	function crowdLift () {
		if (tut || shoot || state !== "play" || !ball.owner || ball.owner.team !== homeSide || frame - liftAt < 60 * 22) { return; }
		const t = homeSide, lead = score[t] - score[1 - t], late = timeLeft < matchLen * 0.3;
		const deep = Math.abs(ball.x - attackX(t)) < FW * 0.33;
		if (!deep || lead >= 2 || (!late && lead >= 0)) { return; }
		const fans = t === 0 && league && league.drama && Number.isFinite(league.drama.fans) ? league.drama.fans : 65;
		const k = clamp(0.3 + (fans - 30) / 50, 0.3, 1.3);
		liftAt = frame;
		swing(t, 0.08 * k);
		if (typeof chant === "function") { try { chant(0.7 + 0.3 * k); } catch (e) { /* audio is optional */ } }
		toast(k < 0.5 ? "A nervous crowd, a few voices try to lift them" : t === 0 ? "The crowd roars you on" : `The home crowd roars ${opp.short} on`, t === 0 ? "#7fd49b" : "#f2b52e");
	}
	// Winning it back breaks the spell, and the more rattled you were the more it settles you.
	function breakStreak (loser, winner) {
		if (passStreak[loser] >= 5 || edge(loser) > 0.3) { swing(winner, 0.03 + 0.08 * edge(loser)); }
		passStreak[loser] = 0;
	}
	let pendingPass = false;
	let diff = DIFF.normal;
	let charging = false, chargeStart = 0;
	let soundOn = true, audio = null;
	const keys = new Set();
	const stickVec = { x: 0, y: 0 };
	let padSprint = false;
	let fx = [];
	let mode = "league";           // league | friendly
	let league = null;             // the season save
	let leagueMatch = null;        // { round, home, opp } while a league fixture is on
	let opp = FRIENDLY;            // who team 1 is right now

	const store = {
		get (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
		set (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
		del (k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
	};

	const reduceMotion = (() => {
		try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
	})();

