	/* ---------- corner shootout ----------
	   A practice game of corners: five each, taken in turn (you first), from alternate sides. A
	   round ends with a goal, the defending side winning the ball, the ball going dead or the box
	   being cleared, or six seconds after the delivery. Level after ten, it's sudden death in pairs
	   (three pairs at most, then honours even). No clock, no offside, nothing saved. */
	let shoot = null;
	function startShootout () {
		shoot = { n: 0, total: 10, att: 0, live: false, next: 0, at: 0, log: [], extra: 0 };
		freeze = 0;
		state = "play";
		pauseBtn.textContent = "Pause";
		nextShootCorner();
	}
	function nextShootCorner () {
		if (!shoot) { return; }
		shoot.next = 0;
		const [ a, b ] = score;
		const done = shoot.n >= shoot.total;
		// Settled early: one side can't be caught with the corners left.
		const rem = shoot.total - shoot.n, leftA = shoot.n % 2 === 0 ? Math.ceil(rem / 2) : Math.floor(rem / 2), leftB = rem - leftA;
		if (done || (shoot.n < 10 && (a > b + leftB || b > a + leftA))) {
			if (done && a === b && shoot.extra < 3) { shoot.extra++; shoot.total += 2; }
			else { finishShootout(); return; }
		}
		shoot.att = shoot.n % 2;
		const top = Math.floor(shoot.n / 2) % 2 === 0;
		banner.hidden = true;
		ball.owner = null; ball.z = 0; ball.vz = 0; ball.vx = ball.vy = 0; ball.shot = false; ball.headed = false;
		for (const p of players) { p.jump = 0; p.dive = 0; p.fall = 0; p.kickCd = 0; p.slideAI = 0; p.lunge = 0; p.run = null; }
		awardCorner(shoot.att, shoot.att === 1, top);
		if (!setPiece) { shootResult("No taker", -1); return; }
		// Defending one of theirs: you start on the marker nearest the goal.
		if (shoot.att === 1 && cornerPlan) {
			const mine = [ ...cornerPlan.role ].filter(([ q, r ]) => q.team === 0 && (r.kind === "mark" || r.kind === "zone")).map(([ q ]) => q).sort((x, y) => x.x - y.x);
			if (mine[0]) { ctrl = players.indexOf(mine[0]); manualLock = 30; }
		}
		shoot.live = true;
		shoot.at = frame;
		shoot.delivered = 0;
		restartBanner(`Corner ${shoot.n + 1} of ${shoot.total}${shoot.extra ? " · sudden death" : ""}`, shoot.att);
		renderModeBadge(); lastHud = ""; renderHud();
	}
	// The round is over: note what happened and line up the next one after a breath.
	function shootResult (what, scorer) {
		if (!shoot || !shoot.live) { return; }
		shoot.live = false;
		shoot.log.push({ att: shoot.att, what, goal: scorer === shoot.att, own: scorer >= 0 && scorer !== shoot.att, by: ball.lastBy ? ball.lastBy.name || "" : "" });
		shoot.n++;
		cornerPlan = null;
	}
	function shootEnd (what) {
		if (!shoot || !shoot.live) { return; }
		shootResult(what, -1);
		toast(what, shoot.log[shoot.log.length - 1].att === 0 ? "#de4f5a" : "#7fd49b");
		setPiece = null;
		ball.owner = null; ball.vx *= 0.2; ball.vy *= 0.2;
		freeze = 50; freezeKind = "free";
		shoot.next = frame + 50;
		renderModeBadge(); lastHud = "";
	}
	function shootTick () {
		if (!shoot || !shoot.live || state !== "play") { return; }
		if (!shoot.delivered && !setPiece) { shoot.delivered = frame; }
		if (!shoot.delivered) { return; }
		const def = 1 - shoot.att, since = frame - shoot.delivered, o = ball.owner;
		if (o && o.team === def && since > 2) { shootEnd(o.role === "gk" ? "Keeper claims it" : "Defended"); return; }
		if (rel(def, ball.x) > FMT.box + 170 && ball.z < 30) { shootEnd("Cleared"); return; }
		if (since > 360) { shootEnd("Time's up"); }
	}
	function finishShootout () {
		const [ a, b ] = score, log = shoot.log;
		const count = (t, f) => log.filter(e => e.att === t && f(e)).length;
		const rows = {
			you: "You", them: opp.short,
			rows: [
				[ "Corners", count(0, () => true), count(1, () => true) ],
				[ "Goals", count(0, e => e.goal), count(1, e => e.goal) ],
				[ "Headed in", count(0, e => e.goal && /Header/.test(e.what)), count(1, e => e.goal && /Header/.test(e.what)) ],
				[ "Keeper claimed", count(0, e => /Keeper/.test(e.what)), count(1, e => /Keeper/.test(e.what)) ],
				[ "Defended or cleared", count(0, e => /Defended|Cleared/.test(e.what)), count(1, e => /Defended|Cleared/.test(e.what)) ]
			]
		};
		const line = a > b ? `You win the corner shootout ${a}–${b}.` : a < b ? `${cap(opp.name)} win the corner shootout ${b}–${a}.` : `Honours even at ${a}–${b}.`;
		const marks = t => log.filter(e => e.att === t).map(e => (e.goal ? "●" : "○")).join(" ");
		const scorers = log.filter(e => e.goal).map(e => `${e.by || (e.att === 0 ? "you" : opp.short)}${/Header/.test(e.what) ? " (header)" : ""}`);
		const seq = `You ${marks(0)}  ·  ${opp.short} ${marks(1)}.${scorers.length ? ` Scored by ${scorers.join(", ")}.` : " Nobody scored."}`;
		shoot = null;
		cornerPlan = null; setPiece = null;
		state = "full";
		banner.hidden = true;
		sfx("final");
		$("announce").textContent = line;
		showOverlay("Corner shootout", `${line} ${seq}`, "Play again", rows);
		renderModeBadge(); lastHud = ""; renderHud();
	}

