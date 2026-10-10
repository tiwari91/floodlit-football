	/* ---------- simulation ---------- */
	// Legs and arms: about one and a half full strides a second at a sprint, fewer
	// when jogging, and the swing eases in and out as a player starts and stops.
	// Cadence rises with speed (a walk is about one stride a second, a sprint about two and a
	// quarter) so the feet keep pace with the ground instead of skating. Moving sideways or
	// backwards he shuffles: shorter, quicker steps with the knees bent.
	function stepLimbs () {
		for (const p of players) {
			const spd = Math.hypot(p.vx, p.vy), g = build(p);
			const fwd = spd > 0.3 ? (p.vx * Math.cos(p.dir) + p.vy * Math.sin(p.dir)) / spd : 1;
			p.shuf = (p.shuf || 0) + ((spd > 0.3 && fwd < 0.35 ? 1 : 0) - (p.shuf || 0)) * 0.15;
			// Waiting for a pass he doesn't stand stock still: small steps to set his feet.
			const settle = receiver === p && spd < 0.5 && !ball.owner ? 1 : 0;
			const moving = Math.max(clamp(spd / 0.4, 0, 1), settle * 0.6);
			const hz = (0.95 + 0.5 * spd) / g.stride * (1 + 0.35 * p.shuf);
			p.stride = (p.stride || 0) + Math.PI * 2 * hz / 60 * moving;
			const target = Math.max(spd < 0.35 ? 0 : Math.min(1, spd / 2.6), settle * 0.22);
			p.runAmt = (p.runAmt || 0) + (target - (p.runAmt || 0)) * 0.12;
			p.idlePh = (p.idlePh || g.seed * 6.28) + 0.028;
			if (p.kickA > 0) { p.kickA--; }
			if (p.plant > 0) { p.plant--; }
		}
	}

	// Each player is built a little differently: how sharply he turns and how long he strides,
	// fixed per player so a side never moves in lockstep.
	function hashStr (t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h = Math.imul(h ^ t.charCodeAt(i), 16777619); } return h >>> 0; }
	function build (p) {
		if (!p.build) {
			const h = hashStr(p.name || `${p.team}-${p.idx}-${p.num}`);
			p.build = { seed: (h % 1000) / 1000, agil: 0.9 + ((h >> 4) % 21) / 100, stride: 0.93 + ((h >> 9) % 15) / 100, left: (h >> 13) % 5 === 0 };
		}
		// His running style: how high and wide he carries his arms, how much he bounces, leans and twists.
		if (p.build.arm === undefined) {
			const g = hashStr(`${p.name || `${p.team}-${p.idx}-${p.num}`}|gait`), u = k => ((g >>> (k * 5)) % 31) / 30;
			Object.assign(p.build, { arm: 0.85 + 0.3 * u(0), elbow: -0.12 + 0.3 * u(1), lean: -0.03 + 0.1 * u(2), bounce: 0.8 + 0.4 * u(3), twist: 0.8 + 0.45 * u(4) });
		}
		return p.build;
	}

	// Rotate an angle toward a target by at most `rate` radians.
	function turnToward (a, b, rate) {
		const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
		return a + clamp(d, -rate, rate);
	}

	// far: how far he really has to go (the point he steers at can be a smoothed step ahead).
	function steer (p, tx, ty, spd, far) {
		let dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
		if (d < 7 && (far || 0) > 20) { dx = dx || 0.01; dy = dy || 0.01; d = Math.max(d, 1); }   // on his way somewhere: keep going
		else if (d < 7) {
			if (!ball || dist(p, ball) < 380) { return [ 0, 0 ]; }   // near the play: set, ready
			// In position far from the ball: nobody stands like a statue. Shift about a little, at a walk.
			if (!p.idleT || frame > p.idleT) { p.idleT = frame + 90 + Math.floor(Math.random() * 120); p.idleX = (Math.random() * 2 - 1) * 14; p.idleY = (Math.random() * 2 - 1) * 14; }
			const ix = tx + p.idleX - p.x, iy = ty + p.idleY - p.y, id = Math.hypot(ix, iy);
			return id < 3 ? [ 0, 0 ] : [ ix / id * 0.32, iy / id * 0.32 ];
		}
		const s = spd * Math.min(1, Math.max(d, far || 0) / 26);
		return [ dx / d * s, dy / d * s ];
	}

	// Players have weight: they build up to speed over about half a second, and brake or
	// turn harder than they accelerate. Wet or muddy grass takes some grip away.
	const ACC_AI = 0.1, ACC_YOU = 0.24;
	// turn: how much of his push he can put sideways at speed (higher turns tighter).
	function movePlayer (p, dvx, dvy, grip = cond.grip, accMax = ACC_AI, turn = 0.55) {
		let ax = (dvx - p.vx) * grip, ay = (dvy - p.vy) * grip;
		const faster = dvx * dvx + dvy * dvy > p.vx * p.vx + p.vy * p.vy;
		const cap = accMax * (faster ? 1 : 1.7) * (cond.grip / 0.22) * (accMax < 1 ? build(p).agil : 1), a = Math.hypot(ax, ay);
		if (a > cap) { ax *= cap / a; ay *= cap / a; }
		// At speed he can't swing round on the spot: the sideways push is limited, so a turn is a
		// curve that tightens as he slows, and a hard change of direction means plant and cut.
		const v = Math.hypot(p.vx, p.vy);
		if (v > 1 && accMax < 1) {
			const ux = p.vx / v, uy = p.vy / v, along = ax * ux + ay * uy;
			let side = -ax * uy + ay * ux;
			const latCap = cap * clamp(1.9 / v, turn, 1);
			if (Math.abs(side) > latCap) { side = Math.sign(side) * latCap; }
			ax = along * ux - side * uy; ay = along * uy + side * ux;
			const want = Math.hypot(dvx, dvy);
			if (want > 0.3 && v > 1.4 && (dvx * ux + dvy * uy) / want < -0.2) { p.plant = 10; }
		}
		p.vx += ax;
		p.vy += ay;
		p.x = clamp(p.x + p.vx, 12, FW - 12);
		p.y = clamp(p.y + p.vy, 12, FH - 12);
	}

	const SPRINT_DRAIN = 1 / 270, SPRINT_FILL = 1 / 420;   // 4.5 s to empty, 7 s to refill (at 60 fps)
	function sprintUpdate (p, want, moving) {
		if (!Number.isFinite(p.sprintFuel)) { p.sprintFuel = 1; }
		if (p.sprintFuel < 0.05) { p.sprintOut = true; }
		if (p.sprintOut && p.sprintFuel >= 0.25) { p.sprintOut = false; }
		const on = want && !p.sprintOut && moving > 0.1;
		const btn = typeof document !== "undefined" && document.getElementById ? document.getElementById("padSprint") : null;
		const cls = (on ? "on" : "") + (p.sprintOut ? "out" : "");
		if (btn && btn.dataset && btn.dataset.st !== cls) { btn.dataset.st = cls; btn.classList.toggle("on", on); btn.classList.toggle("out", !!p.sprintOut); }
		if (on) {
			// Slower legs (low pace, or tired from too many starts) tire a little sooner.
			// Off the ball the tank lasts longer (about six seconds): a defender covers ground.
			p.sprintFuel = Math.max(0, p.sprintFuel - SPRINT_DRAIN * (1 + Math.max(0, 70 - A(p, "pac")) * 0.01) * (ball && ball.owner === p ? 1 : 0.75));
		} else {
			p.sprintFuel = Math.min(1, p.sprintFuel + SPRINT_FILL * (moving > 0.1 ? 1 : 1.6));
		}
		return on;
	}
	// A small tank under your man, shown while it is being used or refilling.
	function drawSprintBar (p, x, y, w) {
		const f = Number.isFinite(p.sprintFuel) ? p.sprintFuel : 1;
		if (f >= 0.999 && (p.sprintAmt || 0) < 0.05) { return; }
		const h = 4;
		ctx.fillStyle = "rgba(8, 13, 11, 0.75)"; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
		ctx.fillStyle = p.sprintOut ? "#e2594a" : f < 0.3 ? "#f2b52e" : "#7fd49b";
		ctx.fillRect(x - w / 2, y, w * f, h);
	}

	function humanInput () {
		let x = 0, y = 0;
		if (keys.has("ArrowLeft")) { x -= 1; }
		if (keys.has("ArrowRight")) { x += 1; }
		if (keys.has("ArrowUp")) { y -= 1; }
		if (keys.has("ArrowDown")) { y += 1; }
		x += stickVec.x + padVec.x; y += stickVec.y + padVec.y;
		if (rotTop) { const t = x; x = y; y = -t; }   // the picture is on its side: down the screen is along the pitch
		if (endsSwapped()) { x = -x; }   // right on screen is towards the other goal now
		const m = Math.hypot(x, y);
		if (m > 0.2) { steerAt = frame; }
		if (m > 1) { x /= m; y /= m; }
		return { x, y, m: Math.min(1, m), sprint: keys.has("KeyE") || keys.has("ShiftLeft") || keys.has("ShiftRight") || padSprint || padSprintBtn };
	}

	function update () {
		frame++;
		stepReplay();
		for (const p of players) { if (p.fall > 0) { p.fall--; } if (p.dive > 0) { p.dive--; } if (p.diveCd > 0) { p.diveCd--; } if (p.throwA > 0) { p.throwA--; } }
		if (flagCall && --flagCall.t <= 0) { flagCall = null; }
		// The crowd gets louder as the ball nears either goal, and goes up for goals.
		if (ball) {
			// Louder when the home side is bearing down on goal; when the visitors are, the noise
			// tightens into a nervous hum (crowdTense) rather than rising.
			const homeGoalX = homeSide === 0 ? 0 : FW, nearHome = 1 - clamp(Math.abs(ball.x - homeGoalX) / (FW * 0.33), 0, 1), nearAway = 1 - clamp(Math.abs(ball.x - (FW - homeGoalX)) / (FW * 0.33), 0, 1);
			// Build-up: a side in the final third with the ball lifts the noise, more with every pass strung
			// together, the home side's far more than the visitors'.
			const att = ball.owner ? ball.owner.team : -1;
			const buildUp = state === "play" && att >= 0 && rel(att, ball.x) > FW * 0.67 ? (0.3 + 0.06 * Math.min(passStreak[att], 8)) * (att === homeSide ? 1 : 0.4) : 0;
			// Conceding at home: a stunned few seconds, through the celebration and after the restart.
			if (state === "goal" && lastScorer !== homeSide) { crowdHush = 240; } else if (crowdHush > 0) { crowdHush--; }
			const heatTarget = crowdHush > 0 ? 0.05 : state === "goal" ? (lastScorer === homeSide ? 1 : 0.25) : state === "play" ? Math.max(nearAway * nearAway * 0.95, nearHome * nearHome * 0.45, buildUp) : 0.1;
			crowdHeat += (heatTarget - crowdHeat) * 0.03;
			// Late on, the side in front keeping the ball gets whistled.
			const lead = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
			if (state === "play" && lead >= 0 && minuteNow() >= 80 && att === lead) { if (++lateHold > 240) { crowdReact("late", lead); } } else if (att >= 0 && att !== lead) { lateHold = 0; }
			crowdTense += ((state === "play" ? nearHome * nearHome : 0) - crowdTense) * 0.03;
			stepCrowdMood(1 / 60);
		}
		if (fx.length) {
			for (const f of fx) { f.t++; }
			fx = fx.filter(f => f.t < (f.life || 40));
		}
		if (state === "goal") {
			celebrate();
			stepLimbs();
			syncOwnedBall();
			stepBall();
			if (--goalTimer <= 0) {
				banner.hidden = true;
				if (shoot) { state = "play"; nextShootCorner(); return; }
				if (timeLeft <= 0 && stall <= 0) { endMatch(); return; }
				state = "play";
				kickoff(lastConceded);
			}
			return;
		}
		if (state !== "play") { return; }
		if (shoot && shoot.next && frame >= shoot.next) { nextShootCorner(); }
		if (freeze > 0 && freezeKind === "review") {
			if (review) { review.n++; }
			if (--freeze <= 0) { finishReview(); }
			return;
		}
		if (freeze > 0 && freezeKind === "stretcher") {
			stepStretcher();
			stepLimbs();
			return;
		}
		if (freeze > 0 && freezeKind === "walk") {
			stepWalk();
			stepLimbs();
			syncOwnedBall();
			return;
		}
		if (freeze > 0) {
			freeze--;
			if (freezeKind === "kickoff") {
				if (freeze === 0) { sfx("whistle"); goFlash = 30; } else if (freeze % 30 === 0) { sfx("tick"); }
			}
			syncOwnedBall();
			return;
		}
		if (goFlash > 0) { goFlash--; }

		if (shoot) { shootTick(); if (state !== "play") { return; } }
		if (!tut && !shoot) {
			if (stall > 0) { stall = Math.max(0, stall - 1 / 60); } else { timeLeft = Math.max(0, timeLeft - 1 / 60); }
			if (!halfDone && timeLeft <= matchLen / 2) { if (!addedDone[0]) { startAdded(0); } else if (stall <= 0) { halfTime(); return; } }
		}
		tutTick();

		if (ball.owner) {
			const st = style[ball.owner.team];
			swing(ball.owner.team, POSS_GAIN * (st === "possession" ? 1.6 : st === "direct" || st === "counter" ? 0.8 : 1));
			possFrames[ball.owner.team]++;
		} else {
			momentum *= 0.998;   // a loose ball lets things settle
		}
		if (momentum > 0.6 && moodZone !== 1) {
			moodZone = 1; toast(`${opp.short} rattled`, "#f2b52e");
		} else if (momentum < -0.6 && moodZone !== -1) {
			moodZone = -1; toast("You're rattled", "#de4f5a");
		} else if (Math.abs(momentum) < 0.4) {
			if (moodZone === -1) { toast("Nerves settling", "#7fd49b"); } else if (moodZone === 1) { toast(`${opp.short} settling`, "#f2b52e"); }
			moodZone = 0;
		}
		if (timeLeft <= 0 && !shoot) { if (!addedDone[1] && !tut) { startAdded(1); } else if (stall <= 0) { endMatch(); return; } }

		if (frame % 120 === 0) { saveLive(); }
		if (frame % 60 === 0) { cpuSubCheck(); tiredNudge(); }
		if (surge && frame >= surge.until) { const t = surge.team; endSurge(); toast(t === 0 ? `${opp.short} have steadied` : "You've steadied", "#eef6ea"); }
		if (surge && frame % 90 === 0) { swing(surge.team, 0.02); }
		if (frame % 60 === 0 && leagueMatch !== undefined) {
			// Late on, the computer chases a game it is losing and sits on a lead.
			const lead = score[1] - score[0], late = timeLeft < matchLen * 0.3;
			setMentality(1, !late ? 0 : lead < -1 ? 2 : lead < 0 ? 1 : lead > 0 ? -1 : 0);
		}
		if (switchCd > 0) { switchCd--; }
		if (manualLock > 0) { manualLock--; }
		if (autoHold > 0) { autoHold--; }
		// A pass in flight belongs to its receiver until someone touches the ball
		// or it dies; auto-switch stays off meanwhile.
		if (receiver) {
			receiveTimer--;
			if (ball.owner || receiveTimer <= 0 || Math.hypot(ball.vx, ball.vy) < 1) { receiver = null; }
		}
		// Once your keeper has played it, control leaves him at once: you never run him out of goal by accident.
		if (human().role === "gk" && ball.owner !== human() && !receiver) {
			const b = bestDefender(human());
			if (b) { ctrl = players.indexOf(b); switchCd = 20; autoHold = AUTO_HOLD; lastSwitchKind = "gk"; }
		}
		if (!receiver && !(ball.owner && ball.owner.team === 0) && switchCd <= 0 && manualLock <= 0) { switchToNearest(false); }

		// Nobody presses a keeper holding the ball: both sides drop back into shape.
		const keeperHolds = inHands(ball.owner);
		const chaser1 = keeperHolds || (ball.owner && ball.owner.team === 1) ? null : chaserFor(1);
		const cover1 = (() => {
			if (!ball.owner || ball.owner.team !== 0 || keeperHolds) { return null; }
			const c = outfield(1).filter(p => p !== chaser1).sort((a, b) => dist(a, ball) - dist(b, ball));
			return c[0] || null;
		})();
		// Goal-side of a carrier, `gap` towards the goal team t defends, allowing for where he is going.
		const goalSide = (q, t, gap) => { const gx = t === 0 ? 0 : FW, ax = q.x + q.vx * 6, ay = q.y + q.vy * 6, dx = gx - ax, dy = FH / 2 - ay, d = Math.hypot(dx, dy) || 1, g = Math.min(gap, d * 0.6); return [ ax + dx / d * g, ay + dy / d * g ]; };
		// The second man: behind the one pressing, on the carrier's line to goal, so beating one
		// defender isn't a walk in on goal.
		const second1 = (() => {
			if (!cover1 || rel(1, ball.x) > FW * 0.7) { return null; }
			const c = outfield(1).filter(p => p !== chaser1 && p !== cover1 && rel(1, p.x) < rel(1, ball.x) + 40).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
			return c && dist(c, ball) < 420 * Math.sqrt(S) ? c : null;
		})();

		// Your teammates defend too. When the CPU has the ball, the nearest one
		// covers goal-side of it (and presses if you are out of the play), and the
		// rest pick up the red attackers closest to your goal.
		let cover0 = null, second0 = null;
		const marks0 = new Map();
		if (ball.owner && ball.owner.team === 1 && !keeperHolds) {
			const helpers = outfield(0).filter(p => players.indexOf(p) !== ctrl).sort((a, b) => dist(a, ball) - dist(b, ball));
			cover0 = helpers[0] || null;
			const back = helpers.slice(1).filter(p => rel(0, p.x) < rel(0, ball.x) + 40)[0];
			if (back && dist(back, ball) < 420 * Math.sqrt(S) && rel(0, ball.x) < FW * 0.7) { second0 = back; }
			const free = helpers.slice(1).filter(p => p !== second0);
			// Only attackers in your part of the pitch need a man on them.
			const threats = outfield(1).filter(q => q !== ball.owner && q.x < FW * (0.45 - 0.07 * Math.max(0, mentality[0]))).sort((a, b) => a.x - b.x);
			for (const q of threats) {
				if (!free.length) { break; }
				free.sort((a, b) => dist(a, q) - dist(b, q));
				marks0.set(free.shift(), q);
			}
		}
		const humanFar = dist(human(), ball) > 120;
		// Each side's short-support player: the nearest outfielder to its ball carrier.
		supporter = [ null, null ];
		if (ball.owner && ball.owner.role !== "gk") {
			const t = ball.owner.team, c = ball.owner;
			supporter[t] = outfield(t).filter(q => q !== c && q !== receiver && !(t === 0 && players.indexOf(q) === ctrl)).reduce((a, b) => (!a || dist(b, c) < dist(a, c) ? b : a), null);
		}
		planRuns(0); planRuns(1);
		stepCornerPlan();
		// A cross or long ball dropping into a box: the two nearest attackers attack the drop, and
		// the two nearest defenders go with them, goal-side.
		const airMen = new Map();
		if (!cornerPlan && !ball.owner && ball.z > 4 && ball.landT > 4 && !ball.shot && lastTouch >= 0) {
			const def = 1 - lastTouch, land = { x: ball.landX, y: ball.landY };
			if (rel(def, land.x) < FMT.box + 60 && Math.abs(land.y - FH / 2) < FMT.goal / 2 + FMT.box) {
				const near = t => outfield(t).filter(q => !(t === 0 && players.indexOf(q) === ctrl) && q !== receiver).sort((a, b) => dist(a, land) - dist(b, land)).slice(0, 2);
				for (const q of near(lastTouch)) { airMen.set(q, [ land.x, land.y ]); }
				const back = def === 0 ? -1 : 1;
				near(def).forEach((q, i) => airMen.set(q, [ land.x + back * (i ? 14 : 6), land.y + (i ? (land.y < FH / 2 ? 12 : -12) : 0) ]));
			}
		}
		// The computer's defenders mark your attackers goal-side, too.
		const marks1 = new Map();
		if (ball.owner && ball.owner.team === 0 && !keeperHolds) {
			const free = outfield(1).filter(p => p !== chaser1 && p !== cover1 && p !== second1);
			const threats = outfield(0).filter(q => q !== ball.owner && rel(1, q.x) < FW * 0.45).sort((a, b) => b.x - a.x);
			for (const q of threats) {
				if (!free.length) { break; }
				free.sort((a, b) => (dist(a, q) - (a.role === "def") * 60) - (dist(b, q) - (b.role === "def") * 60));   // prefer real defenders
				marks1.set(free.shift(), q);
			}
		}

		for (const p of players) {
			if (p.kickCd > 0) { p.kickCd--; }
			if (p.jump > 0) { p.jump--; }
			if (p.lungeCd > 0) { p.lungeCd--; }
			const isHuman = p.team === 0 && players.indexOf(p) === ctrl && !autoPilot;
			// Only the player you control slides; leftovers would fire when you next control them.
			if (!isHuman || p === receiver) { p.lunge = 0; }
			if (isHuman) { p.slideAI = 0; }   // an AI slide ends when you take the player over
			if (!isHuman && p.team === 0) {   // handed back to the computer: the sprint eases off and the tank refills
				p.sprintAmt = (p.sprintAmt || 0) * 0.88;
				if (Number.isFinite(p.sprintFuel)) { p.sprintFuel = Math.min(1, p.sprintFuel + SPRINT_FILL); p.sprintOut = p.sprintOut && p.sprintFuel < 0.25; }
			}
			const spdMul = (p.team === 1 ? diff.spd : 1) * (ball.owner === p ? 0.88 : 1) * (p.injured ? 0.8 : 1) * mood(p.team, 0.07) * paceMul(p) * cond.speed * (0.8 + 0.2 * staOf(p)) * (tr(p, "pace") ? 1.05 : 1);

			// The receiver runs onto the pass by itself; the arrows take over on the first touch.
			if (p === receiver && !ball.owner) {
				const [ tx, ty ] = ball.z > 0 ? [ ball.landX, ball.landY ] : interceptPoint(p);
				const [ dvx, dvy ] = steer(p, tx, ty, BASE_SPD * 1.08);
				movePlayer(p, dvx, dvy, cond.grip, ACC_YOU);
				p.dir = Math.atan2(ball.y - p.y, ball.x - p.x);
				continue;
			}

			if (isHuman) {
				const inp = humanInput();
				// Press assist: hold A (the Tackle button, or X on a pad) without the ball and your man
				// closes the carrier down by himself, goal-side, then stays tight and jockeys him; a
				// loose ball he runs to meet. The arrows still bend the run, and he sprints by himself
				// while the carrier is well away.
				const o = ball.owner;
				const pressing = (pressHeld || touchPress || padPressBtn) && o !== p && p.lunge <= 0 && !setPiece && !inHands(o) && p !== receiver && state === "play";
				let faceX = null, faceY = null;
				if (pressing) {
					let tx, ty, d;
					if (o && o.team === 1) {
						d = dist(p, o);
						const gx = 0 - o.x, gy = FH / 2 - o.y, gl = Math.hypot(gx, gy) || 1;
						const lead = Math.min(10, d / 7), gap = d > 60 ? 8 : 20;
						tx = o.x + o.vx * lead + gx / gl * gap; ty = o.y + o.vy * lead + gy / gl * gap;
						faceX = o.x; faceY = o.y;
					} else {
						[ tx, ty ] = ball.z > 0 ? [ ball.landX, ball.landY ] : interceptPoint(p);
						d = Math.hypot(tx - p.x, ty - p.y);
					}
					const dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy) || 1;
					let ax = dx / L + inp.x * 0.7, ay = dy / L + inp.y * 0.7;
					const al = Math.hypot(ax, ay) || 1;
					ax /= al; ay /= al;
					const m = clamp(L / 14, 0, 1);
					inp.x = ax * m; inp.y = ay * m; inp.m = m;
					inp.sprint = inp.sprint || d > 90;
				}
				// Turn quickly but not instantly, so the body and the ball at your feet sweep
				// round instead of snapping in 45° jumps. Faster without the ball.
				// Lining up a shot at goal: the arrows move the crosshair, and you keep facing the goal.
				const aiming = charging && ball.owner === p && aimY !== null && shotInRange(p);
				if (aiming) {
					p.dir = turnToward(p.dir, Math.atan2(aimY - ball.y, FW + 20 - ball.x), 0.12);
				} else if (faceX !== null && Math.hypot(faceX - p.x, faceY - p.y) < 80) {
					p.dir = turnToward(p.dir, Math.atan2(faceY - p.y, faceX - p.x), 0.35);   // jockeying: eyes on the carrier
				} else if (inp.m > 0.1) { p.dir = turnToward(p.dir, Math.atan2(inp.y, inp.x), ball.owner === p ? 0.3 : 0.5); }
				// Sprint builds up and eases off rather than switching, and runs on a tank that empties
				// in about four and a half seconds; run it dry and you jog until it has partly refilled.
				const sprinting = sprintUpdate(p, inp.sprint, inp.m);
				p.sprintAmt = (p.sprintAmt || 0) + ((sprinting ? 1 : 0) - (p.sprintAmt || 0)) * 0.12;
				// About 7.3 m/s jogging and 10 flat out. The ball slows you less at a sprint, so a
				// sprinting dribbler edges away from a chaser but a sprinting defender runs him down.
				const onBall = ball.owner === p ? (0.88 + 0.04 * p.sprintAmt) / 0.88 : 1;
				// Without the ball he runs a touch quicker than a dribbler, so a chase is a chase.
				let spd = BASE_SPD * ((ball.owner === p ? 0.88 : 0.94) + 0.34 * p.sprintAmt) * spdMul * onBall;
				if (setPiece && setPiece.taker === p && ball.owner === p) { spd = 0; }   // at a set piece the arrows only aim
				if (p.role === "gk" && ball.owner === p) {
					spd = 0;   // keeper with the ball: aim with the arrows, then S / W / Q / D
					if (++p.hold > 360 && !setPiece) { gkDistribute(p); }   // the six-second rule
				}
				if (aiming) {
					// Up/down moves the crosshair; you slow to set your feet and only drift forward.
					aimY = clamp(aimY + inp.y * 3.2 * GH, GOAL_T + 5, GOAL_B - 5);
					spd *= 0.35;
					inp.y = 0;
				}
				if (p.lunge > 0) {
					p.lunge--;
					movePlayer(p, Math.cos(p.dir) * BASE_SPD * 2, Math.sin(p.dir) * BASE_SPD * 2, cond.grip, 9);
				} else {
					// Your player answers the keys a little faster than the AI, and stops when you let go:
					// from a run that is a plant, weight back, before he is still.
					if (inp.m < 0.1 && Math.hypot(p.vx, p.vy) > 1.6 && !(p.plant > 0)) { p.plant = 8; }
					const grip = Math.max(cond.grip, 0.18) * (inp.m > 0.1 ? 1.3 : 1.7);
					movePlayer(p, inp.x * spd, inp.y * spd, Math.min(0.45, grip), ACC_YOU, ball.owner === p ? 0.6 : 0.85);
				}
				continue;
			}

			if (tut && p.team === 1 && p.role !== "gk") {
				if (p === tut.carrier && ball.owner === p) {
					movePlayer(p, -BASE_SPD * 0.55, 0);   // dribbling at you, slowly
					p.dir = Math.PI;
				} else {
					movePlayer(p, 0, 0);
				}
				continue;
			}
			// AI slide tackles: a defender alongside the carrier sometimes goes to ground.
			if (p.slideCd > 0) { p.slideCd--; }
			if (p.slideAI > 0) {
				p.slideAI--;
				movePlayer(p, Math.cos(p.dir) * BASE_SPD * 2, Math.sin(p.dir) * BASE_SPD * 2, cond.grip, 9);
				continue;
			}
			const carrier = ball.owner;
			if (carrier && carrier.team !== p.team && p.role !== "gk" && !inHands(carrier) && !(p.slideCd > 0) && dist(p, carrier) < 42 &&
				!(carrier.team === 0 && frame - (carrier.gotAt || 0) < 22) && Math.random() < 0.008 * defMul(p) * (p.role === "def" ? 1.4 : 1) * TACKLE_FX[tackling[p.team]].slide * (tr(p, "winner") ? 1.6 : 1)) {
				p.dir = Math.atan2(carrier.y + carrier.vy * 6 - p.y, carrier.x + carrier.vx * 6 - p.x);
				p.slideAI = 12;
				p.slideCd = 120;
				p.slideHit = false;
				continue;
			}

			let target, setRole = false;
			if (ball.owner === p) {
				target = aiOwnerAct(p);
				if (!target) { continue; }
			} else if (p.role === "gk") {
				target = gkTarget(p);
			} else if (cornerPlan && cornerPlan.role.has(p)) {
				target = cornerTarget(p); setRole = true;
			} else if (airMen.has(p)) {
				target = airMen.get(p); setRole = true;
			} else if (p === chaser1 || (autoPilot && players.indexOf(p) === ctrl && !(ball.owner && ball.owner.team === 0))) {
				// Read a ball in the air: run to where it will come down.
				target = ball.z > 0 ? [ ball.landX, ball.landY ] : [ ball.x + ball.vx * 6, ball.y + ball.vy * 6 ];
			} else if (p === cover1) {
				const own = { x: FW, y: FH / 2 };
				const k = press[1] === "high" ? 0.12 : press[1] === "low" ? 0.45 : 0.3;
				const in1 = press[1] === "high" ? dist(p, ball) < 220 * lv.press : press[1] === "low" ? dist(p, ball) < 90 * lv.press : rel(1, ball.x) < FW * 0.5 && dist(p, ball) < 160 * lv.press;
				target = in1 ? goalSide(ball.owner || ball, 1, dist(p, ball) > 70 ? 14 : 6) : [ ball.x + (own.x - ball.x) * k, ball.y + (own.y - ball.y) * k ];
			} else if (p === second1 || p === second0) {
				target = goalSide(ball.owner || ball, p.team, 80 * Math.sqrt(S));
			} else if (p === cover0) {
				const own = { x: 0, y: FH / 2 };
				const k = press[0] === "high" ? 0.12 : press[0] === "low" ? 0.45 : 0.3;
				// Your teammate presses like the computer does: if he's nearer the carrier than you, he goes.
				const dp = dist(p, ball), nearer = dp < dist(human(), ball);
				const goes = press[0] === "high" ? dp < 480 || nearer
					: press[0] === "low" ? dp < 90 || (nearer && rel(0, ball.x) < FW * 0.35 && dp < 200)
						: (nearer && dp < 380 * Math.sqrt(S)) || (rel(0, ball.x) < FW * 0.5 && dp < 200);
				target = goes ? goalSide(ball.owner || ball, 0, dist(p, ball) > 70 ? 14 : 6) : [ ball.x + (own.x - ball.x) * k, ball.y + (own.y - ball.y) * k ];
			} else if (marks1.has(p)) {
				const q = marks1.get(p), qx = q.x + q.vx * 8, qy = q.y + q.vy * 8, gx = FW - qx, gy = FH / 2 - qy, gd = Math.hypot(gx, gy) || 1;
				const gap = clamp(40 - (A(p, "def") - 65) * 0.6, 22, 55);   // tight, tighter for good markers
				target = [ qx + gx / gd * gap, qy + gy / gd * gap ];
			} else if (marks0.has(p)) {
				// Stand goal-side of your man, between him and your goal.
				const q = marks0.get(p), qx = q.x + q.vx * 8, qy = q.y + q.vy * 8, gx = 0 - qx, gy = FH / 2 - qy, gd = Math.hypot(gx, gy) || 1;
				const gap = clamp(40 - (A(p, "def") - 65) * 0.6, 22, 55);   // tight, tighter for good markers
				target = [ qx + gx / gd * gap, qy + gy / gd * gap ];
			} else {
				target = spreadTarget(p, formationTarget(p));
			}
			// The CPU carrier dribbles a touch slower than you run, so you can close it down.
			// A keeper facing a shot moves at full stretch; how quickly depends on his handling.
			const diving = p.role === "gk" && shotAt(p) ? 1.3 * (0.85 + 0.15 * defMul(p)) : 0;
			// Real pace: a chaser at full tilt tops out near 10 m/s, and a man with the ball is a touch slower.
			let sprint = diving || (p === chaser1 || p === cover0 || (p === cover1 && press[1] === "high") || ((p === second1 || p === second0) && dist(p, { x: target[0], y: target[1] }) > 60) ? 1.05 : ball.owner === p ? 0.96 : 1);
			if (!diving && p.team === 1 && sprint > 1 && lv !== LEVELS.normal) { sprint *= lv.chase; }   // difficulty: how hard they press
			// Off the ball, nobody runs flat out all game: they jog back into shape, stride out
			// when they're well out of position or near the ball, and markers match their runner.
			if (!diving && sprint === 1 && p.role !== "gk") {
				const off = Math.hypot(target[0] - p.x, target[1] - p.y), near = dist(p, ball);
				const ours = ball.owner ? ball.owner.team === p.team : possTeam === p.team;
				// On the ball's side of the game everyone is at it: supporting runs when we have it,
				// getting back into shape when we don't. Only the far side of the pitch takes a breather.
				// Pace grows with how far he is from where he wants to be, never the whole side flat out
				// at once; each player has his own work rate on top.
				const work = p.work || (p.work = 0.88 + ((p.idx * 37 + p.team * 11) % 7) * 0.03);
				let effort = clamp((ours ? 0.66 : 0.6) + off / 420, 0.6, 0.94) * work;
				if (near > 520 && off < 90) { effort = Math.min(effort, 0.62); }
				if (near < 240) { effort = Math.max(effort, 0.9 * work); }
				if (marks0.has(p) || marks1.has(p)) { effort = Math.max(effort, (off > 50 ? 1 : 0.82) * work); }
				p.effort = (p.effort || effort) + (effort - (p.effort || effort)) * 0.1;   // no sudden gear changes
				sprint = p.effort;
			}
			// At a stoppage nobody sprints about: they walk into place, and jog only if well out.
			if (setPiece && !diving && p !== setPiece.taker && p.role !== "gk") {
				const off = Math.hypot(target[0] - p.x, target[1] - p.y);
				sprint = Math.min(sprint, off > 160 ? 0.8 : off > 60 ? 0.5 : 0.34);
			}
			// Attacking a ball in the air (or a corner run once it's struck): flat out, straight at it.
			if (setRole) {
				const live = !setPiece && (!cornerPlan || cornerPlan.delivered);
				sprint = live ? 1.05 : Math.min(sprint, 0.5);
				p.tx = target[0]; p.ty = target[1];
			}
			// Smooth where AI players are heading so they don't twitch as the ball moves.
			if (p.tx === undefined || Math.hypot(target[0] - p.tx, target[1] - p.ty) > 900) { p.tx = target[0]; p.ty = target[1]; }
			// Everyone reads the play at his own speed, so a side never slides across in lockstep.
			const ours = ball.owner ? ball.owner.team === p.team : possTeam === p.team;
			// The shape glides after the ball rather than chasing it; getting back is quicker than pushing on.
			const k = ball.owner === p || p === chaser1 ? 1 : p === cover1 || p === cover0 || p === second1 || p === second0 ? 0.3 : (0.03 + ((p.idx * 7 + p.team * 3) % 5) * 0.012) * (ours ? 1 : 1.8);
			p.tx += (target[0] - p.tx) * k;
			p.ty += (target[1] - p.ty) * k;
			const [ dvx, dvy ] = steer(p, diving ? target[0] : p.tx, diving ? target[1] : p.ty, BASE_SPD * spdMul * sprint, Math.hypot(target[0] - p.x, target[1] - p.y));
			movePlayer(p, dvx, dvy, diving ? 0.4 : cond.grip, diving ? 9 : p.role === "gk" ? 0.16 : ball.owner === p ? 0.13 : ACC_AI);   // a dive is explosive
			// Where he looks: the man on the ball looks where he's going; everyone else keeps his
			// eyes on the ball, backpedalling when he drops off and turning to run only when he must.
			const sp = Math.hypot(p.vx, p.vy);
			if (ball.owner === p) {
				if (sp > 0.6) { p.dir = turnToward(p.dir, Math.atan2(p.vy, p.vx), 0.2); }
			} else {
				const toBall = Math.atan2(ball.y - p.y, ball.x - p.x), mv = Math.atan2(p.vy, p.vx);
				const away = Math.abs(Math.atan2(Math.sin(mv - toBall), Math.cos(mv - toBall))) > 1.9;
				const look = sp < 1.5 || (away && sp < 2.3) || p.role === "gk";
				p.dir = turnToward(p.dir, look || sp < 0.3 ? toBall : mv, look ? 0.12 : 0.2);
			}
		}

		drainStamina();
		separate();
		if (setPiece && ball.owner === setPiece.taker) {
			// Nobody waits forever: if you haven't taken your corner after 7 seconds, it goes in.
			setPiece.wait = (setPiece.wait || 0) + 1;
			if (setPiece.team === 0 && setPiece.wait > 420) { takeSetPiece(setPiece.taker, false); }
		}
		if (setPiece && ball.owner === setPiece.taker) {
			const R = setPiece.kind === "free" ? fkDist() : 80;
			if (setPiece.wall) { for (const w of setPiece.wall) { if (players.includes(w.p)) { w.p.x = w.x; w.p.y = w.y; w.p.vx = w.p.vy = 0; } } }
			if (setPiece.layoff && players.includes(setPiece.layoff.p)) { const w = setPiece.layoff; w.p.x = w.x; w.p.y = w.y; w.p.vx = w.p.vy = 0; }
			for (const q of players) {
				if (q.team === setPiece.team) { continue; }
				const d = dist(q, setPiece.taker);
				if (d < R) { q.x = clamp(setPiece.taker.x + (q.x - setPiece.taker.x) / (d || 1) * R, 12, FW - 12); q.y = clamp(setPiece.taker.y + (q.y - setPiece.taker.y) / (d || 1) * R, 12, FH - 12); }
			}
		} else if (setPiece && ball.owner !== setPiece.taker) {
			setPiece = null;
		}
		stepLimbs();
		keepClear();
		syncOwnedBall();
		stepBall();
		contest();
	}

	function separate () {
		for (let i = 0; i < players.length; i++) {
			for (let j = i + 1; j < players.length; j++) {
				const a = players[i], b = players[j];
				const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
				if (d > 0 && d < 26) {
					const push = (26 - d) * 0.3, nx = dx / d, ny = dy / d;   // part of the overlap per frame: no ping-pong
					a.x -= nx * push; a.y -= ny * push;
					b.x += nx * push; b.y += ny * push;
					// A crowd must not shove anyone off the pitch or into a net.
					a.x = clamp(a.x, 12, FW - 12); a.y = clamp(a.y, 12, FH - 12);
					b.x = clamp(b.x, 12, FW - 12); b.y = clamp(b.y, 12, FH - 12);
				}
			}
		}
	}

	function syncOwnedBall () {
		const o = ball.owner;
		if (!o) { return; }
		// Dribbling is a run of touches, not a ball stuck to the boot. Each stride knocks it ahead,
		// further the faster he runs (further still at a sprint and on wet grass, a little less for a
		// nimble player), and he closes in on it before the next touch. A heavy touch leaves the ball
		// a step away, where a defender can nick it (see the challenge below).
		const v = Math.hypot(o.vx, o.vy), held = inHands(o) || (setPiece && setPiece.taker === o);
		let ahead = 18;
		if (!held && v > 0.6) {
			const sprint = clamp(o.sprintAmt || 0, 0, 1);
			const reach = 18 + Math.min(16, v * 3.2) + sprint * 7 + (cond.wet ? 3 : 0) - (build(o).agil - 1) * 20;
			const ph = (((o.stride || 0) % Math.PI) + Math.PI) % Math.PI / Math.PI;   // 0 as a foot comes through, 1 just before the next
			ahead = reach - (reach - 18) * ph * 0.75;
			o.touchPh = ph;
		} else {
			o.touchPh = 1;
		}
		// The ball rolls to the spot at his feet rather than jumping there.
		const fxb = o.x + Math.cos(o.dir) * ahead, fyb = o.y + Math.sin(o.dir) * ahead;
		const settled = Math.hypot(fxb - ball.x, fyb - ball.y) > 60;   // a fresh gain from far away: take it
		const k = settled ? 1 : held || v < 0.6 ? 0.55 : 0.4;
		ball.x = settled ? fxb : ball.x + (fxb - ball.x) * k;
		ball.y = settled ? fyb : ball.y + (fyb - ball.y) * k;
		ball.vx = o.vx; ball.vy = o.vy;
		ball.z = 0; ball.vz = 0;
		ball.spin += Math.hypot(o.vx, o.vy) * 0.25;
		const inMouth = ball.y > GOAL_T && ball.y < GOAL_B;
		if (!inMouth) { ball.x = clamp(ball.x, 5, FW - 5); }
		// Nobody dribbles into their own net: without this a keeper collecting the
		// ball on the line while backing up put it over the line and conceded.
		if (o.team === 0) { ball.x = Math.max(ball.x, 5); } else { ball.x = Math.min(ball.x, FW - 5); }
		ball.y = clamp(ball.y, 5, FH - 5);
		checkGoal();
	}

	let lastConceded = 1, lastScorer = -1;

	function checkGoal () {
		if (state !== "play" || ball.z > 55) { return; }
		const inMouth = ball.y > GOAL_T && ball.y < GOAL_B;
		if (!inMouth) { return; }
		const sc = ball.x < -2 ? 1 : ball.x > FW + 2 ? 0 : -1;
		if (sc < 0) { return; }
		if (ball.indirect && ball.indirect.team === sc && ball.lastBy === ball.indirect && !shoot) {
			// Straight in from an indirect free kick, untouched: no goal, a goal kick.
			ball.indirect = null; tally.indirect++;
			awardGoalKick(1 - sc, sc === 1);
			showFoulNote("No goal: it was an indirect free kick, straight in", 1 - sc);
			$("announce").textContent = "No goal: an indirect free kick has to touch another player. Goal kick.";
			return;
		}
		goalScored(sc);
	}

	// After a goal: the scorer wheels away to the corner flag with his arms out and slides on his
	// knees in front of the fans; his teammates chase him and mob him; the other side trudges back
	// with their heads down while their keeper fetches the ball out of the net. Then everyone jogs
	// back for the restart. Seven seconds, or any key or tap to get on with it.
	let celeb = null, lastCelebStyle = 0;
	const celebTracking = () => state === "goal" && celeb && celeb.t > 45 && !replayOn();   // the camera is on the scorer
	function celebrate () {
		const C = celeb;
		if (!C) { return; }
		C.t++;
		const T = C.t, hero = C.hero, sc = lastScorer;
		const kneeling = C.kneelAt >= 0 && T - C.kneelAt < 70;
		if (C.kneelAt >= 0 && T === C.kneelAt + 1 && sc === homeSide) { roar(0.7); }   // the slide brings the fans up again
		const home = T > 300 + (C.rp || 0);   // back for the restart (later when there is a replay first)
		for (const p of players) {
			let tx = p.x, ty = p.y, spd = 0, acc = ACC_AI;
			const scored = p.team === sc;
			if (p === hero) {
				if (home) { tx = p.bx; ty = p.by; spd = BASE_SPD * 0.7; }
				else if (C.style !== 1) {
					// The other celebrations: a run (arms out like wings for the aeroplane), then he stops
					// and turns to the camera to pump his fist or kiss the badge in front of the fans.
					if (C.posedAt < 0) {
						[ tx, ty ] = C.target; spd = BASE_SPD; acc = 0.14;
						if (Math.hypot(tx - p.x, ty - p.y) < 40 || T > 140) { C.posedAt = T; if (sc === homeSide) { roar(0.6); } }
					}
					p.celebK = C.posedAt < 0 && C.style !== 2 ? 0 : C.style;
				} else if (kneeling) {
					// Sliding on his knees: he carries his pace into the slide and it bleeds away.
					p.vx *= 0.955; p.vy *= 0.955;
					p.x = clamp(p.x + p.vx, 12, FW - 12); p.y = clamp(p.y + p.vy, 12, FH - 12);
					p.kneel = Math.min(1, (p.kneel || 0) + 0.12);
					p.celebA = 1;
					continue;
				} else if (C.kneelAt < 0) {
					[ tx, ty ] = C.target; spd = BASE_SPD; acc = 0.14;
					if (Math.hypot(tx - p.x, ty - p.y) < 55 || T > 140) { C.kneelAt = T; }
				}
				p.kneel = Math.max(0, (p.kneel || 0) - 0.1);   // back on his feet, arms up, mobbed
			} else if (scored && p.role !== "gk") {
				if (home) { tx = p.bx; ty = p.by; spd = BASE_SPD * 0.7; }
				else {
					const d = dist(p, hero);
					if (d > 36) { tx = hero.x; ty = hero.y; spd = BASE_SPD * (d > 120 ? 1.45 : 0.85); }
					else if (T > (C.kneelAt >= 0 ? C.kneelAt + 20 : 120) && !(p.jump > 0) && Math.random() < 0.04) { p.jump = JUMP; }
				}
			} else if (scored) {   // their keeper wanders out of his goal
				tx = p.bx + (p.team === 0 ? 30 : -30); ty = p.by; spd = BASE_SPD * 0.3;
			} else if (p.role === "gk") {
				// Fetches the ball out of the net, then walks it out.
				if (!C.fetched) {
					tx = ball.x; ty = ball.y; spd = BASE_SPD * 0.7;
					if (dist(p, ball) < 36) { C.fetched = true; ball.owner = p; ball.vx = ball.vy = 0; ball.z = 0; ball.vz = 0; }   // (he cannot step into the net itself)
				} else { tx = p.bx + (p.team === 0 ? 60 : -60); ty = p.by; spd = BASE_SPD * 0.35; }
			} else {
				// Trudging back, heads down.
				tx = p.bx; ty = p.by; spd = BASE_SPD * (home ? 0.5 : 0.22);
			}
			p.sulk = clamp((p.sulk || 0) + (!scored && p.role !== "gk" && !home ? 0.03 : -0.05), 0, 1);
			const far = Math.hypot(tx - p.x, ty - p.y);
			const [ dvx, dvy ] = spd && far > 6 ? steer(p, tx, ty, spd, far) : [ 0, 0 ];
			movePlayer(p, dvx, dvy, cond.grip, acc);
			if (Math.hypot(p.vx, p.vy) > 0.4) { p.dir = turnToward(p.dir, Math.atan2(p.vy, p.vx), 0.15); }
			else if (scored && p !== hero && !home) { p.dir = turnToward(p.dir, Math.atan2(hero.y - p.y, hero.x - p.x), 0.1); }
			else if (p === hero && !home && (C.posedAt >= 0 || (C.style === 1 && C.kneelAt >= 0))) {
				// Facing the camera, which is out on the pitch in front of him with the fans behind.
				const ex = clamp(p.x + (p.x < FW / 2 ? 120 : -120), 30, FW - 30), ey = p.y + (p.y > FH / 2 ? -230 : 230);
				p.dir = turnToward(p.dir, Math.atan2(ey - p.y, ex - p.x), 0.12);
			}
			// Team-mates who reach him wrap their arms round him; the rest jump and punch the air.
			p.hug = clamp((p.hug || 0) + (scored && p !== hero && p.role !== "gk" && !home && dist(p, hero) < 40 ? 0.08 : -0.08), 0, 1);
			if (home && p === hero) { p.celebK = 0; }
			const armsUp = p === hero ? (home ? 0 : 1) : scored && p.role !== "gk" && !home && dist(p, hero) < 60 ? 0.7 : 0;
			p.celebA = (p.celebA || 0) + (armsUp - (p.celebA || 0)) * 0.08;
			if (p !== hero) { p.kneel = 0; }
		}
	}
	function skipCelebration () {
		if (state === "goal" && goalTimer > 70 && celeb && celeb.t > 20) { goalTimer = 70; }   // (the replay too)
	}

	function goalScored (scorer) {
		if (shoot) { if (shoot.live) { shootResult(scorer === shoot.att ? (ball.headed && ball.lastBy && ball.lastBy.team === scorer ? "Header, goal" : "Goal") : "Own goal", scorer); } else { return; } }
		score[scorer]++;
		tally.goals[scorer]++;
		slowMotion(70);
		if (ball.from === "free" && ball.lastBy && ball.lastBy.team === scorer) { tally.fkGoals[scorer]++; }
		if (ball.from === "pen" && ball.lastBy && ball.lastBy.team === scorer) { tally.penGoals[scorer]++; }
		if (ball.headed && ball.lastBy && ball.lastBy.team === scorer) { tally.headGoals[scorer]++; }
		if (frame - cornerAt[scorer] < 420) { tally.cornerGoals[scorer]++; }
		{
			const by = ball.lastBy;
			const own = by && by.team !== scorer;
			const name = by ? by.name || (by.team === 0 ? "You" : opp.short) : "";
			const headed = ball.headed && !own;
			logEvent(scorer, "goal", own ? `${name} (own goal)` : headed ? `${name || "Goal"} (header)` : name || "Goal");
			if (scorer === 0 && by && !own && by.name) { matchGoals.push(by.name); }
		}
		// A goal against the run of play flips it; one for the side on top just adds to it.
		if (edge(1 - scorer) > 0) { momentum = scorer === 0 ? 0.3 : -0.3; } else { swing(scorer, 0.22); }
		if (!shoot && !tut) { startSurge(scorer); }
		passStreak = [ 0, 0 ];
		lastConceded = 1 - scorer;
		lastScorer = scorer;
		ball.owner = null;
		charging = false;
		state = "goal";
		goalTimer = GOAL_CELEB + cueReplay(scorer);
		{
			const side = outfield(scorer);
			const hero = ball.lastBy && ball.lastBy.team === scorer ? ball.lastBy : side[side.length - 1] || team(scorer)[0];
			// How he celebrates: 1 knee slide, 2 aeroplane to the corner flag, 3 fist pump, 4 badge kiss
			// (never the same twice running). He heads for the corner flag, but not a marathon: at most
			// 260 units (less for the fist pump and the badge), so his teammates can catch him.
			let style = 1 + Math.floor(Math.random() * 4);
			if (style === lastCelebStyle) { style = style % 4 + 1; }
			lastCelebStyle = style;
			const cx = scorer === 0 ? FW - 70 : 70, cy = hero.y < FH / 2 ? 44 : FH - 44, dx = cx - hero.x, dy = cy - hero.y, L = Math.hypot(dx, dy) || 1, run = Math.min(L, style >= 3 ? 110 : 260);
			celeb = { t: 0, hero, style, target: [ hero.x + dx / L * run, hero.y + dy / L * run ], kneelAt: -1, posedAt: -1, fetched: false, rp: goalTimer - GOAL_CELEB };
			tlc = null;   // no touchline cutaway over a goal
			for (const p of players) { p.kneel = 0; p.sulk = 0; p.celebK = 0; p.hug = 0; }
			banner.textContent = ball.headed && ball.lastBy && ball.lastBy.team === scorer ? (scorer === 0 ? "Header! Goal" : `Header! ${opp.short} score`) : scorer === 0 ? "Goal" : `${opp.short} score`;
			const by = ball.lastBy, own = by && by.team !== scorer, who = own ? by : hero;
			caption(own ? "Own goal" : "Goal", "goal", (who && who.name) || (scorer === 0 ? "You" : opp.short), `${own ? "Own goal" : ball.headed ? "Header" : scorer === 0 ? "You" : opp.short} · ${minuteNow()}'${(() => { const n = scorer === 0 && !own && who && who.name ? matchGoals.filter(g => g === who.name).length : 0; return n === 2 ? " · Brace" : n === 3 ? " · Hat-trick" : n > 3 ? ` · ${n} goals` : ""; })()}`, own ? by.team : scorer);
		}
		banner.className = "banner goal " + (scorer === 0 ? "home" : "away");
		banner.hidden = false;
		$("announce").textContent = `${scorer === 0 ? "Goal for you" : `Goal for ${opp.name}`}. ${score[0]} to ${score[1]}.`;
		sfx("whistle");
		sfx("net");
		buzz(scorer === 0 ? [ 70, 50, 70 ] : 120);
		if (scorer === homeSide) { roar(1); playGoalSong(clubIdOfTeam(homeSide)); } else { groan(); awayCornerCheer(); }
		ev3d("goal", { scorer });
		renderHud();
	}

	function stepBall () {
		if (ball.owner) { return; }
		ball.x += ball.vx;
		ball.y += ball.vy;
		if (ball.z > 0 || ball.vz > 0) {
			const h0 = Math.max(ball.z, 0) + Math.abs(ball.vz) * 8;
			ball.z += ball.vz;
			ball.vz -= GRAV + (ball.dipG || 0);
			if (ball.curlT > 0) { ball.vx += ball.cax; ball.vy += ball.cay; ball.curlT--; }
			if (cond.wind.s) { const h = Math.min(1, ball.z / 30); ball.vx += cond.wind.ax * h; ball.vy += cond.wind.ay * h; }
			ball.vx *= AIR_DRAG;
			ball.vy *= AIR_DRAG;
			if (ball.z <= 0) {
				// Landing: a small bounce, and the grass takes some pace off.
				ball.z = 0; ball.curlT = 0; ball.dipG = 0;
				ball.vz = -ball.vz > 2 ? -ball.vz * cond.bounce : 0;
				ball.vx *= cond.land; ball.vy *= cond.land;
				if (cond.wet && h0 > 20) { splash(ball.x, ball.y); }
			}
		} else {
			ball.vx *= cond.roll;
			ball.vy *= cond.roll;
		}
		if (ball.z > 0) { predictLanding(); }
		ball.spin += Math.hypot(ball.vx, ball.vy) * 0.25;
		const inMouth = ball.y > GOAL_T + 4 && ball.y < GOAL_B - 4 && ball.z <= 55;   // higher is over the bar
		if (state === "play" && (ball.y < -4 || ball.y > FH + 4)) {
			// Over a touchline: a throw-in to the side that didn't touch it last.
			raiseFlag(ball.x, "out");
			awardThrow(lastTouch === 0 ? 1 : 0, ball.x, ball.y < 0);
			return;
		}
		if (state !== "play") {
			if (ball.y < 5) { ball.y = 5; ball.vy = Math.abs(ball.vy) * 0.7; }
			if (ball.y > FH - 5) { ball.y = FH - 5; ball.vy = -Math.abs(ball.vy) * 0.7; }
		}
		if (ball.x < -2 || ball.x > FW + 2) {
			// Inside a goal: the net soaks up the ball.
			if (inMouth || state === "goal") {
				ball.x = clamp(ball.x, -NET + 5, FW + NET - 5);
				ball.y = clamp(ball.y, GOAL_T + 5, GOAL_B - 5);
				if (ball.x <= -NET + 5 || ball.x >= FW + NET - 5) { ball.vx *= -0.2; }
				ball.vx *= 0.9; ball.vy *= 0.9;
				checkGoal();
				return;
			}
		}
		if (!inMouth) {
			if (state === "play") {
				// Over the goal line (wide, or over the bar): a corner or a goal kick.
				if (ball.x < -4) { outOfPlay(true); return; }
				if (ball.x > FW + 4) { outOfPlay(false); return; }
			} else {
				if (ball.x < 5) { ball.x = 5; ball.vx = Math.abs(ball.vx) * 0.7; }
				if (ball.x > FW - 5) { ball.x = FW - 5; ball.vx = -Math.abs(ball.vx) * 0.7; }
			}
		}
		checkGoal();
	}

