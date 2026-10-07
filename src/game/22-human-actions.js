	/* ---------- human actions ---------- */
	// Opponents (of team `side`, red by default) standing in the line between two points.
	function laneBlockers (a, b, side = 1) {
		const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
		let n = 0;
		for (const q of team(side)) {
			const t = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / L2, 0, 1);
			// Anyone more than a stride along the line counts, however close to the passer:
			// a man right in front of you is the likeliest to cut it out.
			if (t * Math.sqrt(L2) > 8 && Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y) < 30) { n++; }
		}
		return n;
	}

	// The teammate a pass would reach right now: the one you face most directly,
	// preferring an open lane over one a defender is standing in.
	// The current pick is sticky: a new teammate has to be clearly better before
	// the ring moves, so it doesn't flicker as you turn.
	let lastPass = { from: null, to: null };
	function passTarget (p) {
		let best = null, bestScore = -Infinity, keepScore = -Infinity;
		const prev = lastPass.from === p ? lastPass.to : null;
		for (const m of outfield(0)) {
			if (m === p) { continue; }
			const a = Math.atan2(m.y - p.y, m.x - p.x);
			const off = offsideOn() && isOffside(m, offsideLine(0)) ? 0.8 : 0;
			// Facing still matters most, but a teammate with a man on him, or a defender
			// in the lane, is a worse pass than a free one a little further round.
			const s = Math.cos(a - p.dir) * 1.2 - dist(p, m) / 900 - laneBlockers(p, m) * 0.9 - off + clamp(openness(m) / 160, 0, 0.6);
			if (m === prev) { keepScore = s; }
			if (s > bestScore) { bestScore = s; best = m; }
		}
		if (prev && keepScore > bestScore - 0.18) { best = prev; }
		lastPass = { from: p, to: best };
		return best;
	}

	// Who S would switch you to while you defend: the other player best placed to reach the ball.
	// Pressing S again straight away moves on to the next best, so a few presses cycle the back line.
	let cycleSeen = new Set(), cycleAt = -1000;
	function nextSwitchTarget () {
		const cur = human();
		const recent = frame - cycleAt < 75 ? cycleSeen : null;
		return bestDefender(m => m === cur || (recent && recent.has(m))) || bestDefender(cur);
	}

	function startPass (p, m, lead) {
		if (lead) {
			// Through ball: into the space ahead of the teammate, toward goal.
			// Charged: a soft one is played to feet-ish, a driven one well into the space.
			const tx = clamp(m.x + (passPow < 0 ? 130 : 80 + passPow * 100), 40, FW - 40), ty = m.y;
			const je = passErr(p);
			kick(p, tx + (Math.random() * 2 - 1) * je, ty + (Math.random() * 2 - 1) * je, clamp((Math.hypot(tx - ball.x, ty - ball.y) / 55 + 2) * cond.passComp * passMul(), 6, 19));
		} else {
			passTo(p, m);
		}
		handOff(m, lead ? 130 : 100);
		// The passer goes for the return: a one-two.
		const dirX = p.team === 0 ? 1 : -1;
		p.oneTwo = frame + 80;
		p.oneTwoX = clamp(p.x + dirX * 150 * Math.sqrt(S), 20, FW - 20);
		p.oneTwoY = clamp(p.y + (m.y > p.y ? -40 : 40), 30, FH - 30);
	}

	// After any pass of yours: control follows the ball to whoever it is meant for.
	function handOff (m, timer) {
		charging = false;   // otherwise the receiver inherits the charge and fires on release
		passCharge = null;
		ctrl = players.indexOf(m);
		receiver = m;
		receiveTimer = timer;
		stats.passes++;
		pendingPass = true;
	}

	// Who E would find: your most advanced, most open player ahead of the ball,
	// preferring a forward.
	function strikerTarget (p) {
		const ahead = outfield(0).filter(m => m !== p && m.x > p.x + 60);
		const fwds = ahead.filter(m => m.role === "fwd");
		let best = null, bs = -Infinity;
		for (const m of fwds.length ? fwds : ahead) {
			const s = m.x / FW + openness(m) / 300 - (offsideOn() && isOffside(m, offsideLine(0)) ? 1 : 0) + (tr(m, "target") ? 0.25 : 0);
			if (s > bs) { bs = s; best = m; }
		}
		return best;
	}

	// Long ball into the striker's run: along the ground when the lane is open,
	// over the top when a red shirt is in the way or it is a very long way.
	function humanLong () {
		const p = human();
		if (!ball.owner && ball.z > 4 && state === "play") { headIntent = { kind: "clear", at: frame }; }
		if (ball.owner !== p) { return; }
		if (tut) { tut.flags.long = true; }
		if (p.role === "gk" && !setPiece) {
			// A keeper's long kick: upfield to the striker, dropping in front of him.
			const m = strikerTarget(p);
			if (m) { const [ lx, ly ] = leadPoint(p, m); loftTo(p, lx, ly); handOff(m, 170); } else { gkDistribute(p); }
			return;
		}
		if (setPiece && setPiece.taker === p) { takeSetPiece(p, true); return; }
		// Central and in range of goal, Q chips the keeper.
		if (shotInRange(p) && !isWide(p.y, 0.2) && Math.hypot(FW - p.x, FH / 2 - p.y) < 480 * Math.sqrt(S)) { charging = false; aimY = null; chipShot(p); return; }
		// From out wide in the final third, Q whips a cross to the best-placed teammate in the box.
		if (rel(0, p.x) > FW * 0.68 && isWide(p.y)) {
			const box = outfield(0).filter(q => q !== p && inAttackBox(q)).sort((a, b) => openness(b) - openness(a));
			if (box.length) { loftTo(p, box[0].x - 8, box[0].y, (p.y < FH / 2 ? 1 : -1) * 18 * GH); handOff(box[0], 170); return; }
		}
		const m = strikerTarget(p);
		if (!m) { return; }
		const [ lx0, ly0 ] = leadPoint(p, m), je = passErr(p) * (style[0] === "direct" || style[0] === "counter" ? 0.6 : 1);
		const tx = lx0 + (Math.random() * 2 - 1) * je, ty = ly0 + (Math.random() * 2 - 1) * je;
		const d = Math.hypot(tx - ball.x, ty - ball.y);
		if (laneBlockers(p, { x: tx, y: ty }) > 0 || d > 520) {
			loftTo(p, tx, ty);
		} else {
			kick(p, tx, ty, clamp((d / 50 + 2.5) * cond.passComp * passMul(), 7, 20));
		}
		handOff(m, 170);
	}

	function humanThrough () {
		const p = human();
		if (ball.owner !== p) { return; }
		if (tut) { tut.flags.through = true; }
		if (setPiece && setPiece.taker === p) {
			if (setPiece.kind === "free" && shotInRange(p)) { liftShot(p); return; }
			takeSetPiece(p, false, "through");
			return;
		}
		const m = passTarget(p);
		if (m) { startPass(p, m, true); }
	}

	// Where a player running flat out first gets to the travelling ball.
	function interceptPoint (p) {
		let bx = ball.x, by = ball.y, vx = ball.vx, vy = ball.vy;
		const reach = BASE_SPD * 1.4;
		for (let t = 1; t <= 90; t++) {
			bx += vx; by += vy; vx *= cond.roll; vy *= cond.roll;
			if (Math.hypot(bx - p.x, by - p.y) <= reach * t + 14) { break; }
		}
		return [ clamp(bx, 12, FW - 12), clamp(by, 12, FH - 12) ];
	}

	// Hold to charge a pass: a tap rolls it softly, a full hold drives it. The pass goes on release.
	let passCharge = null, passPow = -1;   // passPow < 0: no charge (the computer, set pieces)
	const PASS_FN = { pass: () => humanPass(), through: () => humanThrough(), long: () => humanLong() };
	const passMul = () => (passPow < 0 ? 1 : 0.78 + passPow * 0.5);
	const chargeOf = start => clamp((frame - start) / 50, 0, 1);
	function passPress (kind) {
		if (odr) { endOdr(); return; }
		const p = human();
		if (state === "play" && freeze <= 0 && p && ball.owner === p && !(setPiece && setPiece.taker === p) && !charging) {
			passCharge = { kind, start: frame };
			return;
		}
		PASS_FN[kind]();
	}
	function passRelease (kind) {
		if (!passCharge || passCharge.kind !== kind) { return; }
		const pc = passCharge;
		passCharge = null;
		if (state !== "play" || freeze > 0 || ball.owner !== human()) { return; }
		passPow = chargeOf(pc.start);
		try { PASS_FN[kind](); } finally { passPow = -1; }
	}

	function humanPass () {
		const p = human();
		if (!ball.owner && ball.z > 4 && state === "play") { headIntent = { kind: "pass", at: frame }; }
		if (ball.owner !== p) { switchToNearest(true); return; }
		if (setPiece && setPiece.taker === p) { takeSetPiece(p, false); return; }
		const best = passTarget(p);
		if (best) { startPass(p, best, false); }
	}

	function humanShootRelease () {
		if (!charging) { return; }
		charging = false;
		const p = human();
		if (ball.owner !== p) { return; }
		const power = clamp((frame - chargeStart) / 50, 0, 1);
		const sho = A(p, "sho");
		const speed = (9 + power * 9) * (1 + (sho - 65) * 0.004);   // better finishers hit it harder
		stats.shots++;
		tally.shots[0]++;
		if (shotInRange(p)) { crowdReact("chance", 0); }
		// Aim assist: keyboard facing only has 8 directions, so a shot taken
		// roughly toward goal bends onto target. Lean up or down picks the corner;
		// more power means closer to the post (and a little more risk).
		const gx = FW + 20;
		if (shotInRange(p) && aimY !== null) {
			// At the spot you aimed at, give or take the spread for this power and shooter.
			const ty = aimY + (Math.random() * 2 - 1) * shotSpread(p, power);
			kick(p, gx, ty, speed);
			// A full-power strike rises; a poor finisher can blaze it over the bar.
			ball.vz = power > 0.8 ? (power - 0.8) * 12 + Math.max(0, 65 - sho) * 0.2 * power : 0;
			aimY = null;
			return;
		}
		aimY = null;
		const reach = 700;
		kick(p, ball.x + Math.cos(p.dir) * reach, ball.y + Math.sin(p.dir) * reach, speed);
	}

	// Aiming: while you charge a shot at goal, up and down move a crosshair along the
	// goal mouth. Harder shots stray further from it; poor finishers stray more.
	let aimY = null;
	function shotInRange (p) {
		const toGoal = Math.atan2(FH / 2 - ball.y, FW + 20 - ball.x);
		const off = Math.atan2(Math.sin(p.dir - toGoal), Math.cos(p.dir - toGoal));
		return ball.x > FW - 650 * Math.sqrt(S) && Math.abs(off) < 1.0;
	}
	function shotSpread (p, power) {
		return (6 + power * 18 + 22 * edge(1) + Math.max(0, 65 - A(p, "sho")) * 0.4 + 30 * Math.max(0, 0.75 - staOf(p))) * GH * (tr(p, "poacher") && inAttackBox(p) ? 0.75 : 1);
	}

	function humanShootPress () {
		if (odr) { endOdr(); return; }
		const p = human();
		if (!ball.owner && ball.z > 4 && state === "play") { headIntent = { kind: "goal", at: frame }; }
		if (state !== "play" || freeze > 0) { return; }
		if (p.role === "gk" && ball.owner === p) { humanLong(); return; }   // a keeper's D is a long kick
		if (setPiece && setPiece.kind === "pen" && setPiece.taker === p && ball.owner === p) { takePenalty(p); return; }
		if (ball.owner === p) {
			charging = true;
			chargeStart = frame;
			// Start the crosshair where you are leaning: the far post if you're square on.
			const lean = Math.sin(p.dir), side = Math.abs(lean) > 0.2 ? Math.sign(lean) : (ball.y < FH / 2 ? 1 : -1);
			aimY = FH / 2 + side * (FMT.goal / 2) * 0.55;
		}
	}

	function humanTackle () {
		if (odr) { endOdr(); return; }
		const p = human();
		if (state !== "play" || freeze > 0 || ball.owner === p || p === receiver) { return; }
		if (p.lunge <= 0 && p.lungeCd <= 0) {
			const o = ball.owner;
			// Right alongside the carrier: a shoulder challenge. You stay on your feet;
			// win it and you come away with the ball, lose it and you are knocked off stride.
			if (o && o.team === 1 && !inHands(o) && dist(p, o) < 36) {
				p.lungeCd = LUNGE_CD;
				p.dir = Math.atan2(o.y - p.y, o.x - p.x);
				if (Math.random() < 0.35 * defMul(p) * mood(0, 0.4)) {
					o.kickCd = 40;
					gainBall(p);
					swing(0, 0.08);
					burst(p.x, p.y, "Won it");
					sfx("tackle");
					stats.tackles++;
					crowdReact("tackle", 0);
				} else if (Math.random() < 0.1) {
					commitFoul(p, o, false);
				} else {
					p.vx *= 0.3; p.vy *= 0.3;
					o.vx *= 0.7; o.vy *= 0.7;   // it still slows them
				}
				return;
			}
			// Further out: a slide tackle, aimed at where the carrier is heading
			// rather than just the way you happen to face. Beyond slide range (or with the ball
			// loose and far off) A is a press instead: hold it and he closes the ball down himself.
			const target = o && o.team === 1 ? o : null;
			if (target ? dist(p, target) >= 95 : dist(p, ball) > 70) { return; }
			if (target) { p.dir = Math.atan2(target.y + target.vy * 6 - p.y, target.x + target.vx * 6 - p.x); }
			p.lunge = 14;
			p.lungeCd = LUNGE_CD;
			p.slideHit = false;
		}
	}

	// How many frames a player needs to get to the ball, allowing for where it is going.
	function timeToBall (m) {
		const reach = BASE_SPD * 1.35;
		if (ball.owner) {
			const o = ball.owner, px = o.x + o.vx * 12, py = o.y + o.vy * 12;
			return Math.hypot(px - m.x, py - m.y) / reach;
		}
		// A ball in the air: whoever gets to where it comes down.
		if (ball.z > 4 && ball.landT > 0) { return Math.hypot(ball.landX - m.x, ball.landY - m.y) / reach; }
		let bx = ball.x, by = ball.y, vx = ball.vx, vy = ball.vy;
		for (let t = 1; t <= 120; t++) {
			bx += vx; by += vy; vx *= cond.roll; vy *= cond.roll;
			if (Math.hypot(bx - m.x, by - m.y) <= reach * t + 18) { return t; }
		}
		return 120 + Math.hypot(bx - m.x, by - m.y) / reach;
	}

	// Lower is better: first to the ball, with a penalty for being caught on the
	// wrong side of an attacker (not between them and your goal).
	function switchScore (m) {
		let sc = timeToBall(m);
		const o = ball.owner;
		if (o && o.team === 1) {
			// Eases in as the player falls behind the ball, so the score doesn't jump as the ball passes them.
			sc += clamp((m.x - o.x) / 3, 0, 25);
			// Off the line from the carrier to your goal (not goal-side): a smaller penalty.
			if (dist(m, o) > 30) {
				const toGoal = Math.atan2(FH / 2 - o.y, 0 - o.x), toMe = Math.atan2(m.y - o.y, m.x - o.x);
				const off = Math.abs(Math.atan2(Math.sin(toMe - toGoal), Math.cos(toMe - toGoal)));
				sc += clamp((off - 0.7) * 8, 0, 10);
			}
		} else if (!o && ball.vx < -1) {
			// A loose ball running toward your goal: the man already behind it is the one to take.
			sc += clamp((m.x - ball.x) / 4, 0, 15);
		}
		return sc;
	}

	// except: a player to leave out, or a test for players to leave out.
	function bestDefender (except) {
		const skip = typeof except === "function" ? except : m => m === except;
		let best = null, bs = Infinity;
		for (const m of outfield(0)) {
			if (skip(m)) { continue; }
			const sc = switchScore(m);
			if (sc < bs) { bs = sc; best = m; }
		}
		return best;
	}

	let leftPlayer = null, leftAt = -1000;
	let supporter = [ null, null ];
	// Direction input held right now (arrows, touch stick or pad), so a fresh press counts at once.
	const dirHeld = () => keys.has("ArrowLeft") || keys.has("ArrowRight") || keys.has("ArrowUp") || keys.has("ArrowDown") || Math.hypot(stickVec.x + padVec.x, stickVec.y + padVec.y) > 0.2;
	const steeringNow = () => dirHeld() || frame - steerAt < STEER_RECENT || pressHeld || touchPress || padPressBtn;
	// Who you control while defending. S (force) always wins and holds for MANUAL_LOCK.
	// Otherwise the Auto switch setting decides:
	//   assisted   one switch when the ball is lost, then held; while you steer or press, only an
	//              out-of-the-play rescue (once a spell, with a message); idle, a clearly better man,
	//              at most twice a second and never straight back to the man just left. In every
	//              mode but manual: the ball at a teammate's feet while your man is well off it
	//              hands you that teammate at once, whatever you are doing.
	//   manual     no auto-switch at all (restarts, send-offs and subs are handled elsewhere).
	//   aggressive the quick rules: any clearly better-placed defender, whatever you are doing.
	function switchToNearest (force) {
		const cur = human();
		let best, hold = AUTO_HOLD, cue = null, kind = force ? "manual" : "idle";
		if (force) {
			best = nextSwitchTarget();
			if (frame - cycleAt >= 75) { cycleSeen = new Set([ cur ]); }
			if (best) { cycleSeen.add(best); }
			cycleAt = frame;
			manualLock = MANUAL_LOCK;   // keep the auto-switch from snapping straight back
			turnoverPending = false;
			autoHold = 0;
			if (tut) { tut.flags.switched = true; }
		} else {
			if (autoSwitchMode === "manual") { turnoverPending = false; return; }
			if (cur.lunge > 0) { return; }   // never take the player away mid-slide
			const turnover = turnoverPending;
			turnoverPending = false;
			const cs0 = switchScore(cur);
			// The ball is at (or about to be at) a teammate's feet and your man is well off it: he is
			// yours at once, hold or no hold, steering or not. Not when your own man is nearly there
			// too, and not straight back to the man you just left.
			let near = null, nt = Infinity;
			for (const m of outfield(0)) {
				if (m === cur || (frame - leftAt < NEAR_GUARD && m === leftPlayer)) { continue; }
				const t = timeToBall(m);
				if (t < nt) { nt = t; near = m; }
			}
			const ct = timeToBall(cur);
			if (near && nt <= NEAR_BALL && ct >= 14 && ct - nt > 10) {
				best = near; hold = AUTO_HOLD; kind = "near";
			} else if (autoSwitchMode === "aggressive") {
				if (cs0 < 14) { return; }         // they are about to get there: leave them be
				best = bestDefender(frame - leftAt < 45 ? leftPlayer : null);   // don't hand straight back
				const fresh = frame - possLostAt < 40 || (ball.owner && ball.owner.team === 1 && cur.x > ball.owner.x + 30);
				const bs = best ? switchScore(best) : Infinity;
				if (!best || best === cur || !(bs < cs0 * (fresh ? 0.9 : 0.8) && cs0 - bs > (fresh ? 3 : 6))) { return; }
				hold = 0; kind = "aggressive";
			} else if (turnover) {
				// The ball has just been lost: once, to the best goal-side defender, then hold that choice.
				best = bestDefender(null);
				const bs = best ? switchScore(best) : Infinity;
				if (!best || best === cur || !(bs < cs0 * 0.85 && cs0 - bs > 4)) { autoHold = AUTO_HOLD; return; }
				hold = AUTO_HOLD_TURNOVER; kind = "turnover";
			} else {
				if (autoHold > 0) { return; }
				if (cs0 < 14) { return; }         // they are about to get there: leave them be
				best = bestDefender(frame - leftAt < HANDBACK_GUARD ? leftPlayer : null);   // never straight back
				const bs = best ? switchScore(best) : Infinity;
				if (!best || best === cur) { return; }
				if (steeringNow()) {
					// You are driving this man: he stays yours while he is near the ball or closing on it.
					// Two rescues, both needing a teammate twice as quick to the ball and half a second clearer:
					// far from the ball (steering a man well away from the play is not steering into it), or
					// beaten (the ball well past him toward your goal), the latter once a spell.
					const bp = ball.owner || ball, dc = dist(cur, bp);
					const far = dc > 260 && dist(best, bp) < dc * 0.5;
					const beaten = cur.x > bp.x + 140 * Math.sqrt(S) && !steerSwitchDone;
					if (!(bs < cs0 * 0.5 && cs0 - bs > 30) || !(far || beaten)) { return; }
					if (!far) { steerSwitchDone = true; }
					hold = AUTO_HOLD_TURNOVER;
					cue = far ? "Switched: your man was far from the ball" : "Switched: your man was out of the play"; kind = "rescue";
				} else if (!(bs < cs0 * 0.85 && cs0 - bs > 4)) { return; }   // clearly better placed: sooner by a sixth and a fifteenth of a second
			}
		}
		if (!best || best === cur) { return; }
		leftPlayer = cur;
		leftAt = frame;
		ctrl = players.indexOf(best);
		switchCd = force ? 15 : 12;
		if (!force) { autoHold = hold; }
		lastSwitchKind = kind;
		if (cue) { toast(cue, "#eef6ea"); }
		flashPlayer(best);
	}
