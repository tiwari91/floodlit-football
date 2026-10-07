	/* ---------- corners and goal kicks ---------- */
	let lastTouch = -1;     // team that last touched the ball
	let setPiece = null;    // { kind: "corner", team, taker } until the corner is taken
	let deadBall = null;    // { kind, taker, indirect }: the restart waiting to be taken (its first kick is the restart)
	let restartWalk = null; // a throw-in or goal kick: the taker walks to the ball while the other side backs off
	// Start a restart with a walk: the ball sits on its spot, the taker walks (or jogs) to it and the
	// opponents back off to where they must stand; then the usual pause over the ball.
	function walkToSpot (taker, spot, movers, dir, frames) {
		const far = Math.hypot(spot.x - taker.x, spot.y - taker.y);
		if (far < 16 || bulkSim) {
			taker.x = spot.x; taker.y = spot.y; taker.dir = dir;
			for (const m of movers) { m.q.x = m.x; m.q.y = m.y; }
			return;
		}
		restartWalk = { p: taker, x: spot.x, y: spot.y, dir, movers, frames, n: 0 };
		ball.owner = null; ball.x = spot.x; ball.y = spot.y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
		freeze = 1; freezeKind = "walk";
		tally.walks++;
	}
	function stepWalk () {
		const w = restartWalk;
		if (!w || !players.includes(w.p)) { restartWalk = null; freeze = 0; return; }
		w.n++;
		const go = (q, x, y, spd) => {
			const dx = x - q.x, dy = y - q.y, d = Math.hypot(dx, dy);
			if (d <= spd) { q.x = x; q.y = y; q.vx = q.vy = 0; return true; }
			q.vx = dx / d * spd; q.vy = dy / d * spd; q.x += q.vx; q.y += q.vy;
			q.dir = turnToward(q.dir, Math.atan2(dy, dx), 0.25);
			return false;
		};
		// A walk if it's close, a jog if it isn't; nobody takes more than about two and a half seconds.
		const far = Math.hypot(w.x - w.p.x, w.y - w.p.y);
		const there = go(w.p, w.x, w.y, BASE_SPD * clamp(0.75 + far / 250, 0.75, 1.5));
		for (const m of w.movers) { if (players.includes(m.q)) { go(m.q, m.x, m.y, BASE_SPD * 1.05); } }
		for (const q of players) { if (q !== w.p && !w.movers.some(m => m.q === q)) { q.vx *= 0.8; q.vy *= 0.8; } }
		if (there || w.n > 150) {
			w.p.x = w.x; w.p.y = w.y; w.p.vx = w.p.vy = 0; w.p.dir = w.dir;
			for (const m of w.movers) { m.q.x = m.x; m.q.y = m.y; m.q.vx = m.q.vy = 0; }
			ball.owner = w.p;
			restartWalk = null;
			freeze = w.frames; freezeKind = "free";
		}
	}
	function outOfPlay (leftEnd) {
		if (shoot) { shootEnd(ball.shot ? "Off target" : "Out of play"); return; }
		const defTeam = leftEnd ? 0 : 1;   // you defend the left goal
		raiseFlag(ball.x, "out");
		if (ball.shot && frame - (ball.kickedAt || -999) < 120 && Math.abs(ball.y - FH / 2) < FMT.goal / 2 + 70 * GH && (ball.z || 0) < 95) { ooh(); ev3d("near"); if (ball.lastBy) { crowdReact("near", ball.lastBy.team); benchReact("near", { team: ball.lastBy.team }); } }
		else if (ball.shot && frame - (ball.kickedAt || -999) < 150 && ball.lastBy) { if (ball.lastBy.team === homeSide) { groan(); } crowdReact("miss", ball.lastBy.team); }   // a clear miss
		if (lastTouch === defTeam) { awardCorner(1 - defTeam, leftEnd, ball.y < FH / 2); } else { awardGoalKick(defTeam, leftEnd); }
	}

	function restartBanner (text, forTeam) {
		banner.textContent = text;
		banner.className = "banner " + (forTeam === 0 ? "home" : "away");
		banner.hidden = false;
		setTimeout(() => { if (banner.textContent === text) { banner.hidden = true; } }, 1000);
		$("announce").textContent = `${text} to ${forTeam === 0 ? "you" : opp.name}.`;
	}

	function setPieceStart (taker, frames) {
		receiver = null; pendingPass = false; charging = false;
		restartWalk = null;
		offside = { team: -1, set: new Set() };
		for (const q of players) { q.vx = q.vy = 0; q.lunge = 0; q.tx = undefined; }
		ball.owner = taker; ball.z = 0; ball.vz = 0; ball.vx = ball.vy = 0;
		taker.hold = 0; taker.think = 20; taker.kickCd = 0;
		passStreak[1 - taker.team] = 0;   // the ball went dead: the other side's run is over
		possTeam = taker.team;
		lastTouch = taker.team;
		if (taker.team === 0 && taker.role !== "gk") { ctrl = players.indexOf(taker); }
		freeze = frames;
		freezeKind = "free";
		sfx("whistle");
		snapshotPrev();
	}

	function awardCorner (att, leftEnd, top) {
		const gx = leftEnd ? 0 : FW, inward = leftEnd ? 1 : -1, def = 1 - att;
		const corner = { x: leftEnd ? 10 : FW - 10, y: top ? 10 : FH - 10 };
		const atk = outfield(att), dfs = outfield(def);
		// Big men up: forwards and the two tallest (first) defenders attack the ball.
		const runners = [ ...atk.filter(p => p.role === "fwd"), ...atk.filter(p => p.role === "def") ].slice(0, Math.min(4, atk.length - 1));   // someone must be left to take it
		const rest = atk.filter(p => !runners.includes(p));
		if (!rest.length) { awardGoalKick(def, leftEnd); return; }   // nobody left to take it (a side down to the bare few)
		const taker = rest.reduce((a, b) => (dist(a, corner) < dist(b, corner) ? a : b));
		taker.x = corner.x; taker.y = corner.y; taker.dir = Math.atan2(FH / 2 - corner.y, gx + inward * 90 - corner.x);
		// The runners start in a knot around the penalty spot and attack a zone each when the ball
		// is struck: near post, far post, the spot and the middle of the six-yard box. Each has a man
		// goal-side of him; two more defenders hold the near post and the six-yard line; one attacker
		// waits on the edge of the box for the second ball.
		const sy = top ? -1 : 1, Z = cornerSpots(gx, inward, sy), aims = [ Z.near, Z.far, Z.spot, Z.six ];
		const starts = [ [ 0.62, 0.12 * sy ], [ 0.7, -0.22 * sy ], [ 0.86, 0.02 ], [ 0.6, -0.05 * sy ] ].map(([ dx, dy ]) => [ gx + inward * dx * FMT.box, FH / 2 + dy * FMT.box ]);
		const markers = dfs.slice().sort((a, b) => (Math.abs(a.x - gx) - (a.role === "def") * 80) - (Math.abs(b.x - gx) - (b.role === "def") * 80));
		const plan = { att, def, gx, inward, sy, role: new Map(), delivered: false, at: frame, attacker: null, defender: null };
		runners.forEach((r, i) => {
			r.x = starts[i][0]; r.y = starts[i][1];
			plan.role.set(r, { kind: "run", start: starts[i], aim: aims[i] });
			const m = markers.shift();
			if (m) { m.x = starts[i][0] - inward * 16; m.y = starts[i][1] + 6 * sy; plan.role.set(m, { kind: "mark", man: r }); }   // goal-side of their man
		});
		for (const spot of [ [ gx + inward * FMT.box * 0.12, FH / 2 + sy * FMT.goal * 0.45 ], [ gx + inward * FMT.box * 0.32, FH / 2 ] ]) {
			const z = markers.shift();
			if (z) { z.x = spot[0]; z.y = spot[1]; plan.role.set(z, { kind: "zone", spot }); }
		}
		const edgeMan = rest.filter(q => q !== taker).sort((a, b) => Math.abs(a.x - gx) - Math.abs(b.x - gx))[0];
		if (edgeMan) { const spot = [ gx + inward * (FMT.box + 45), FH / 2 - sy * 40 ]; edgeMan.x = spot[0]; edgeMan.y = spot[1]; plan.role.set(edgeMan, { kind: "edge", spot }); }
		cornerPlan = plan;
		const gk = team(def).find(q => q.role === "gk");
		if (gk) { gk.x = gx + inward * 20; gk.y = FH / 2 + sy * 8; }
		// Everyone else from the defending side keeps their distance from the taker.
		for (const q of players) {
			if (q.team !== def) { continue; }
			const d = dist(q, taker);
			if (d < 90) { q.x = clamp(taker.x + (q.x - taker.x) / (d || 1) * 90, 12, FW - 12); q.y = clamp(taker.y + (q.y - taker.y) / (d || 1) * 90, 12, FH - 12); }
		}
		setPieceStart(taker, 70);
		setPiece = { kind: "corner", team: att, taker };
		deadBall = { kind: "corner", taker };
		if (att === 0) { stats.corners = (stats.corners || 0) + 1; } else { oppStats.corners++; }
		tally.corners[att]++; cornerAt[att] = frame + 9999;   // counts from the delivery
		restartBanner("Corner", att);
	}

	function awardGoalKick (def, leftEnd) {
		const gk = team(def).find(q => q.role === "gk");
		if (!gk) { return; }
		const spot = { x: leftEnd ? 60 : FW - 60, y: FH / 2 };
		// The other side leaves the area.
		const edge = FMT.box + 70, movers = [];
		for (const q of players) {
			if (q.team === def || rel(def, q.x) >= edge) { continue; }
			movers.push({ q, x: def === 0 ? edge + 10 : FW - edge - 10, y: q.y });
		}
		setPieceStart(gk, 45);
		setPiece = { kind: "goalkick", team: def, taker: gk };
		deadBall = { kind: "goalkick", taker: gk };
		walkToSpot(gk, spot, movers, def === 0 ? 0 : Math.PI, 45);
		restartBanner("Goal kick", def);
	}

