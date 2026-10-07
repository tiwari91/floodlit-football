	/* ---------- runs off the ball ----------
	   With the ball, one player at a time (two in eleven-a-side) makes a run: in behind the back
	   line, round the outside to overlap, or into a pocket between the lines. He is picked on
	   purpose, for the space he would run into and a lane the carrier could find him down, stays
	   onside, runs for a couple of seconds, then tucks back into his slot. Everyone else holds
	   the shape, so the lines read as lines and the runner shows up as the pass. */
	const runPlan = [ { next: 0 }, { next: 0 } ];
	function planRuns (t) {
		const c = ball.owner, ours = c ? c.team === t : possTeam === t;
		const mine = outfield(t);
		let running = 0;
		for (const p of mine) {
			if (p.run && (frame > p.run.until || !ours || p === c || p === receiver)) { p.run = null; p.runCd = frame + 90 + Math.floor(Math.random() * 60); }
			if (p.run) { running++; }
		}
		if (!ours || !c || c.role === "gk" || state !== "play" || setPiece || (freeze > 0)) { return; }
		const rp = runPlan[t];
		if (running >= (N >= 11 ? 2 : 1) || frame < rp.next) { return; }
		rp.next = frame + 30 + Math.floor(Math.random() * 40);   // a new idea about every second
		if (frame - (c.gotAt || 0) < 12) { return; }   // he has only just got it: let him look up first
		const cr = rel(t, c.x), line = offsideOn() ? offsideLine(t) : FW - 60 * S, root = Math.sqrt(S);
		const space = q => { let d = Infinity; for (const o of players) { if (o.team !== t) { d = Math.min(d, Math.hypot(o.x - q.x, o.y - q.y)); } } return Math.min(d, 220 * root); };
		let best = null, bs = 0.15;
		for (const p of mine) {
			if (p === c || p.run || p === receiver || (p.runCd || 0) > frame || supporter[t] === p || (t === 0 && players.indexOf(p) === ctrl)) { continue; }
			const pr = rel(t, p.x), wide = isWide(p.by, 0.25);
			const consider = (kind, rr, y, bonus) => {
				if (offsideOn()) { rr = Math.min(rr, line - 8); }
				rr = clamp(rr, 30, FW - 40); y = clamp(y, 50, FH - 50);
				const q = { x: t === 0 ? rr : FW - rr, y };
				const far = Math.hypot(q.x - p.x, q.y - p.y);
				if (far < 60 * root || far > 420 * root) { return; }
				const s = space(q) / 90 + bonus - laneBlockers(c, q, 1 - t) * 0.45 - Math.max(0, Math.hypot(q.x - c.x, q.y - c.y) - 380 * root) / 300;
				if (s > bs) { bs = s; best = { p, run: { kind, x: q.x, y: q.y, until: frame + 90 + Math.floor(Math.random() * 60) } }; }
			};
			// In behind: a forward, or an attacking midfielder once the ball is over halfway.
			if ((p.role === "fwd" || p.cam || tr(p, "pace") || (p.role === "mid" && cr > FW * 0.5)) && pr > cr - 80 * S && cr > FW * 0.3) {
				consider("behind", Math.max(line - 6, pr + 110 * S, cr + 90 * S), p.y + (p.y - c.y) * 0.3, (p.role === "fwd" ? 0.5 : 0.2) + (tr(p, "pace") ? 0.55 : 0) - (tr(p, "target") ? 0.3 : 0));
			}
			// Overlap: a wide player on the carrier's flank goes round the outside of him.
			if (wide && isWide(c.y, 0.18) && Math.sign(c.y - FH / 2) === Math.sign(p.by - FH / 2) && pr < cr + 40 && cr > FW * 0.35 && style[t] !== "counter") {
				consider("overlap", cr + 130 * S, FH / 2 + Math.sign(p.by - FH / 2) * FH * 0.44, p.role === "def" ? 0.35 : 0.25);
			}
			// A pocket: a midfielder steps up into the space between their lines, off the ball's side.
			if (p.role === "mid" && pr < cr + 60 * S && cr > FW * 0.3) {
				consider("pocket", cr + 120 * S, FH / 2 + (p.by - FH / 2) * 0.5 + (c.y < FH / 2 ? 70 : -70) * root, 0.1);
			}
		}
		if (best) { best.p.run = best.run; tallyBy(best.p, best.run.kind); }
	}

	// Where a player without the ball wants to be, and why (the kind). One idea at a time.
	function rawFormationTarget (p) {
		const dirX = p.team === 0 ? 1 : -1;
		const inPoss = ball.owner && ball.owner.team === p.team;
		// Short support: the teammate nearest the carrier comes close, at an angle, to offer a pass.
		if (inPoss && ball.owner !== p && p.role !== "gk" && supporter[p.team] === p) {
			const c = ball.owner, side = p.y < c.y ? -1 : 1, back = style[p.team] === "possession" ? 0.1 : 0.35;
			const sx = c.x - dirX * 55 * S * back + dirX * 40 * S, sy = c.y + side * 85 * Math.sqrt(S);
			return [ clamp(sx, 20, FW - 20), clamp(sy, 30, FH - 30), "support" ];
		}
		// A one-two: having just passed, go for the return in the space ahead.
		if (inPoss && ball.owner !== p && p.oneTwo > frame) {
			let rr = rel(p.team, p.oneTwoX);
			if (offsideOn()) { rr = Math.min(rr, offsideLine(p.team) - 10); }
			return [ p.team === 0 ? rr : FW - rr, p.oneTwoY, "onetwo" ];
		}
		// His run: to the spot he picked, held onside as the line moves.
		if (p.run && inPoss) {
			let rr = rel(p.team, p.run.x);
			if (offsideOn()) { rr = Math.min(rr, offsideLine(p.team) - 8); }
			return [ p.team === 0 ? rr : FW - rr, p.run.y, "run" ];
		}
		// The ball is wide in the final third: forwards attack the box (near post, far post, spot).
		if (inPoss && p.role === "fwd" && ball.owner !== p && isWide(ball.owner.y) && rel(p.team, ball.owner.x) > FW * 0.68) {
			const c = ball.owner, k = outfield(p.team).filter(m => m.role === "fwd").indexOf(p), side = Math.sign(c.y - FH / 2) || 1;
			const [ fx, fy ] = [ [ 0.1, 0.11 * side ], [ 0.12, -0.13 * side ], [ 0.17, 0 ] ][Math.max(0, k) % 3];
			let rr = FW - fx * FW;
			if (offsideOn()) { rr = Math.min(rr, offsideLine(p.team) - 6); }
			return [ p.team === 0 ? rr : FW - rr, FH / 2 + fy * FH, "box" ];
		}
		// The attacking midfielder: with the ball on, the pocket between the carrier and the
		// striker, on the other side from the ball, as a short option.
		if (inPoss && p.cam && ball.owner !== p) {
			const c = ball.owner, st = outfield(p.team).filter(m => m.role === "fwd").sort((a, b) => rel(p.team, b.x) - rel(p.team, a.x))[0];
			const cr = rel(p.team, c.x), sr = st ? rel(p.team, st.x) : cr + 250;
			let r = clamp((cr + sr) / 2, cr + 70, FW * 0.85);
			if (offsideOn()) { r = Math.min(r, offsideLine(p.team) - 20); }
			const y = FH / 2 + (p.by - FH / 2) * 0.4 + (c.y < FH / 2 ? 55 : -55);
			return [ p.team === 0 ? r : FW - r, clamp(y, 50, FH - 50), "cam" ];
		}
		const [ x, y ] = slotTarget(p);
		return [ x, y, "slot" ];
	}

	// A change of idea eases in over about three quarters of a second, from where he was heading,
	// rather than snapping the target across the pitch and turning him on the spot.
	const BLEND = 45;
	function formationTarget (p) {
		let [ x, y, kind ] = rawFormationTarget(p);
		// A poacher hangs on the last defender's shoulder in the box whenever his side has it up there.
		if (tr(p, "poacher") && !p.run && (ball.owner ? ball.owner.team === p.team : possTeam === p.team) && rel(p.team, ball.x) > FW * 0.5) {
			const line = offsideOn() ? offsideLine(p.team) - 10 : FW - FMT.box * 0.5, rr = Math.min(line, FW - FMT.box * 0.45);
			const px = p.team === 0 ? rr : FW - rr, py = FH / 2 + clamp(y - FH / 2, -FMT.goal * 0.6, FMT.goal * 0.6);
			x += (px - x) * 0.85; y += (py - y) * 0.85; kind = "poach";
		}
		if (p.tKind !== kind) {
			const recent = p.tRaw && frame - p.tRawF <= 2;
			p.tFrom = recent ? p.tRaw : p.tx !== undefined ? [ p.tx, p.ty ] : null;
			p.tBlend = frame;
			p.tKind = kind;
		}
		let ex = x, ey = y;
		if (p.tFrom) {
			const s = (frame - p.tBlend) / BLEND;
			if (s >= 1) { p.tFrom = null; } else { const e = s * s * (3 - 2 * s); ex += (p.tFrom[0] - x) * (1 - e); ey += (p.tFrom[1] - y) * (1 - e); }
		}
		p.tRaw = [ ex, ey ]; p.tRawF = frame;
		return [ ex, ey ];
	}

	// Is a loose ball on its way into this keeper's goal? Where will it cross his line?
	function shotAt (p) {
		if (ball.owner) { return null; }
		const toward = p.team === 0 ? ball.vx < -3 : ball.vx > 3;
		if (!toward) { return null; }
		const lineX = p.team === 0 ? 20 : FW - 20, tt = (lineX - ball.x) / ball.vx;
		if (tt <= 0 || tt > 70) { return null; }
		const py = ball.y + ball.vy * tt;
		return py > GOAL_T - 25 && py < GOAL_B + 25 ? { y: py, tt } : null;
	}

	function gkTarget (p) {
		const ownLine = p.team === 0 ? 0 : FW;
		// A shot on its way: go to where it will cross the line (better keepers read it earlier).
		const sh = shotAt(p);
		if (sh) {
			// Cut across the ball's path: the nearest point on it between here and the line.
			const vx = ball.vx, vy = ball.vy, v2 = vx * vx + vy * vy || 1;
			const tt = clamp(((p.x - ball.x) * vx + (p.y - ball.y) * vy) / v2, 2, sh.tt);
			const cx = ball.x + vx * tt, cy = clamp(ball.y + vy * tt, GOAL_T - 10, GOAL_B + 10);
			if (!(p.dive > 0) && !(p.diveCd > 0) && sh.tt < 26 && Math.abs(cy - p.y) > 15 && Math.hypot(vx, vy) > 8) {
				const lat = (cy - p.y) * Math.cos(p.dir) - (cx - p.x) * Math.sin(p.dir);
				p.dive = DIVE_T; p.diveSide = lat > 0 ? -1 : 1; p.diveCd = 70;
			}
			return [ cx, cy ];
		}
		// A cross dropping into his area: come and claim it if he can get there first.
		if (!ball.owner && lastTouch !== p.team && (ball.z > 6 || ball.vz > 0) && !ball.shot && ball.landT > 0) {
			const lr = rel(p.team, ball.landX), ly = Math.abs(ball.landY - FH / 2);
			if (lr < FMT.box * (shoot ? 0.38 : tr(p, "sweeper") ? 0.78 : 0.6) && ly < FMT.goal / 2 + FMT.box * (shoot ? 0.2 : 0.4)) {
				const reach = (ball.landT + 10) * BASE_SPD * 1.15;
				if (Math.hypot(ball.landX - p.x, ball.landY - p.y) < reach) { p.claiming = frame; return [ ball.landX, ball.landY ]; }
			}
		}
		const loose = !ball.owner;
		const r = rel(p.team, ball.x);
		const sweeperK = tr(p, "sweeper");
		if (loose && r < (sweeperK ? 270 : 150) * GH && Math.abs(ball.y - FH / 2) < (sweeperK ? 260 : 170) * GH) {
			const mates = team(p.team);
			const nearest = mates.reduce((a, b) => (dist(a, ball) < dist(b, ball) ? a : b));
			if (nearest === p) { return [ ball.x, ball.y ]; }
		}
		// An attacker running at goal: come off the line along the line to the ball and narrow the
		// angle, further the closer he gets; one on one with nobody between, rush out to smother it.
		const carrier = ball.owner && ball.owner.team !== p.team ? ball.owner : null;
		if (carrier && !setPiece) {
			const gxl = p.team === 0 ? 0 : FW, db = Math.hypot(ball.x - gxl, ball.y - FH / 2) || 1, R = 420 * Math.sqrt(S);
			if (db < R) {
				const between = players.some(q => q.team === p.team && q.role !== "gk" && rel(p.team, q.x) < rel(p.team, carrier.x) - 8 && Math.abs(q.y - carrier.y) < 70 * Math.sqrt(S));
				const rush = !between && db < (sweeperK ? 310 : 240) * Math.sqrt(S) && Math.abs(ball.y - FH / 2) < FMT.goal / 2 + FMT.box * (sweeperK ? 0.9 : 0.6);
				const out = rush ? Math.min(db * 0.6, (sweeperK ? 170 : 120) * GH) : 22 + clamp((R - db) * 0.1, 0, 40 * GH);
				return [ gxl + (ball.x - gxl) / db * out, FH / 2 + (ball.y - FH / 2) / db * out * 0.85 ];
			}
		}
		// All-out attack, or a sweeper keeper with his side on the ball: he stands well off his line.
		const sweep = mentality[p.team] >= 2 ? 70 * S : sweeperK && (ball.owner ? ball.owner.team === p.team : possTeam === p.team) ? 85 * S : sweeperK ? 30 * S : 0;
		const x = p.team === 0 ? ownLine + 22 + sweep : ownLine - 22 - sweep;
		const y = FH / 2 + clamp((ball.y - FH / 2) * 0.45, -54 * GH, 54 * GH);
		return [ x, y ];
	}

	// Who chases a loose ball: the player who can get there first, allowing for where it
	// is rolling (a passer who just hit it is not the one to run after it).
	function chaserFor (t) {
		let best = null, bd = Infinity;
		const spot = ball.z > 0 ? { x: ball.landX, y: ball.landY } : null;
		for (const p of outfield(t)) {
			const d = spot ? dist(p, spot) / (BASE_SPD * 1.35) : timeToBall(p) + (p.kickCd > 0 ? 30 : 0);
			if (d < bd) { bd = d; best = p; }
		}
		return best;
	}

	function aiOwnerAct (p) {
		const cfg = p.team === 1 ? diff : DIFF.normal;
		if (setPiece && (setPiece.kind === "free" || setPiece.kind === "pen") && setPiece.taker === p) {
			// The computer's free kick: a moment over the ball, then a shot if it's close, else find a man.
			if (++p.hold < (setPiece.kind === "pen" ? 60 : 40)) { return null; }
			if (setPiece.kind === "pen") { takePenalty(p); return null; }
			const ind = setPiece.indirect, lay = setPiece.layoff && players.includes(setPiece.layoff.p) ? setPiece.layoff.p : null;
			setPiece = null;
			const g = { x: attackX(p.team), y: FH / 2 };
			if (lay && (ind || Math.random() < 0.2)) { passTo(p, lay); return null; }
			if (!ind && dist(p, g) < 250 * Math.sqrt(S) && Math.random() < 0.7) {
				if (Math.random() < 0.55) { liftShot(p); return null; }
				shootAt(p, 0.75 + Math.random() * 0.25, FH / 2 + (Math.random() * 2 - 1) * FMT.goal * 0.48);
				ooh();
				return null;
			}
			const mates = outfield(p.team).filter(m => m !== p && dist(m, p) < 420 * Math.sqrt(S));
			const m = mates.sort((a, b) => openness(b) - openness(a))[0];
			if (m) { passTo(p, m); } else { kick(p, g.x, g.y, 12); }
			return null;
		}
		if (setPiece && setPiece.kind === "throw" && setPiece.taker === p) {
			// The computer's throw: find an open teammate within range.
			if (++p.hold < 25) { return null; }
			const mates = outfield(p.team).filter(m => m !== p && dist(m, p) < 330 * Math.sqrt(S));
			const m = mates.sort((a, b) => (openness(b) - dist(b, p) * 0.2) - (openness(a) - dist(a, p) * 0.2))[0];
			throwIn(p, m || null, m ? dist(m, p) > 190 * Math.sqrt(S) : false);
			return null;
		}
		if (setPiece && setPiece.kind === "corner" && setPiece.taker === p) {
			// The computer's corner: a moment to set, then a cross to one of the runners in the box.
			if (++p.hold < 30) { return null; }
			const r = Math.random();
			cornerCross(p, null, r < 0.4 ? "near" : r < 0.75 ? "far" : "spot", Math.random() < 0.6 ? "in" : "out");
			return null;
		}
		if (p.role === "gk") {
			p.hold++;
			// A second or so with the ball, so the team can spread out before he plays it.
			if (p.hold < (p.holdFor || (p.holdFor = 60 + Math.floor(Math.random() * 30)))) { return null; }
			gkDistribute(p);
			return null;
		}
		const goal = { x: attackX(p.team), y: FH / 2 };
		const dg = dist(p, goal);
		// Test harness: a carrier who only ever runs at goal and shoots from close in, to measure how
		// well the other side stops a dribbler.
		if (dribbleTest && p.team === 0 && p.role !== "gk") {
			if (dg < 190 * Math.sqrt(S)) { shootAt(p, 0.85, FH / 2 + (Math.random() * 2 - 1) * FMT.goal * 0.35); return null; }
			return [ goal.x, FH / 2 + (p.y - FH / 2) * 0.7 ];
		}
		if (--p.think <= 0) {
			p.think = Math.max(2, cfg.think + (p.team === 1 ? lv.think : 0) + Math.round(6 * edge(1 - p.team) - 2 * edge(p.team)));   // rattled players dither; confident ones play quicker
			// Wide in the final third: cross it into the box.
			if (rel(p.team, p.x) > FW * 0.72 && isWide(p.y) && Math.random() < 0.45) {
				const goalX = attackX(p.team);
				const box = outfield(p.team).filter(m => m !== p && inAttackBox(m));
				if (box.length) {
					const m = box.sort((a, b) => openness(b) - openness(a))[0];
					const bend = (Math.random() < 0.5 ? 1 : -1) * (8 + Math.random() * 16) * GH;
					loftTo(p, m.x + (goalX === FW ? -8 : 8), m.y + (Math.random() * 2 - 1) * (18 + 40 * edge(1 - p.team)), bend);
					return null;
				}
			}
			const range = Math.sqrt(S);
			// Close in: shoot. Further out and crowded: sometimes try one from distance.
			const crowded = openness(p) < 70;
			const longShot = dg < 400 * range && (crowded || edge(p.team) > 0.5) && Math.random() < 0.18 + 0.1 * edge(p.team);   // on top, they fancy one from range
			// One on one with the keeper off his line: sometimes dink it over him.
			const keeper = players.find(q => q.team !== p.team && q.role === "gk");
			if (keeper && dg < 330 * range && dg > 110 * range && rel(keeper.team, keeper.x) > 55 * GH && dist(keeper, p) < dg * 0.75 && Math.random() < 0.3) { chipShot(p); return null; }
			if (dg < 170 * range || (dg < 270 * range && Math.random() < 0.35) || longShot) {
				// Better finishers are more accurate and hit it harder.
				const fin = (clamp(1.3 - (A(p, "sho") - 50) / 100, 0.6, 1.4) + Math.max(0, 0.75 - staOf(p)) * 0.8) * (tr(p, "poacher") && inAttackBox(p) ? 0.7 : 1);
				const aim = FH / 2 + ((Math.random() * 2 - 1) * 42 + (Math.random() * 2 - 1) * (cfg.spread + 45 * edge(1 - p.team)) * fin * (p.team === 1 ? lv.shot : 1)) * GH;
				shootAt(p, clamp(0.55 + Math.random() * 0.45 + (A(p, "sho") - 65) * 0.004, 0.4, 1), aim);
				return null;
			}
			// A forward timing a run on the offside line: slide a through ball into the space behind.
			if (offsideOn() && Math.random() < (style[p.team] === "possession" ? 0.15 : style[p.team] === "balanced" ? 0.3 : 0.45) + 0.12 * edge(p.team) + (tr(p, "playmaker") ? 0.2 : 0) && openness(p) > 45) {
				const line = offsideLine(p.team);
				const runner = outfield(p.team).filter(m => m !== p && (m.role === "fwd" || tr(m, "pace")) && !isOffside(m, line) && line - rel(p.team, m.x) < 90 &&
					rel(p.team, m.x) > rel(p.team, p.x) + 40).sort((a, b) => openness(b) - openness(a))[0];
				if (runner) {
					const [ lx, ly ] = leadPoint(p, runner);
					if (laneBlockers(p, { x: lx, y: ly }, 1 - p.team) === 0) {
						const err = 20 + 50 * edge(1 - p.team), d = Math.hypot(lx - ball.x, ly - ball.y);
						notePass(p);
						kick(p, lx + (Math.random() * 2 - 1) * err, ly + (Math.random() * 2 - 1) * err, clamp((d / 55 + 2) * cond.passComp, 6, 16));
						return null;
					}
				}
			}
			// Now and then a defender or midfielder hits one over the top to a forward.
			const longRate = { possession: 0.015, balanced: 0.05, direct: 0.12, counter: 0.1 }[style[p.team]];
			if ((p.role === "def" || p.role === "mid") && Math.random() < longRate * (tr(p, "playmaker") ? 1.6 : 1) * (outfield(p.team).some(m => tr(m, "target")) ? 1.4 : 1)) {
				const f = outfield(p.team).filter(m => m.role === "fwd" && rel(p.team, m.x) - rel(p.team, p.x) > 300)
					.sort((a, b) => (openness(b) + (tr(b, "target") ? 70 : 0)) - (openness(a) + (tr(a, "target") ? 70 : 0)))[0];
				if (f) {
					const [ lx, ly ] = leadPoint(p, f);
					const err = (30 + 60 * edge(1 - p.team)) * (style[p.team] === "direct" || style[p.team] === "counter" ? 0.6 : 1);
					loftTo(p, lx + (Math.random() * 2 - 1) * err, ly + (Math.random() * 2 - 1) * err);
					return null;
				}
			}
			const pressure = openness(p) < 55;
			// Possession sides move it on short and often; direct sides look forward.
			if (pressure || Math.random() < (style[p.team] === "possession" ? 0.14 : 0.06)) {
				let best = null, bs = -Infinity;
				for (const m of outfield(p.team)) {
					if (m === p) { continue; }
					const d = dist(p, m);
					if (d < 70 || d > (tr(p, "playmaker") ? 620 : 460) * Math.sqrt(S)) { continue; }
					const adv = (rel(p.team, m.x) - rel(p.team, p.x)) / 300 * (style[p.team] === "possession" ? 0.5 : style[p.team] === "balanced" ? 1 : 1.6);
					const s = adv + openness(m) / 120 - d / (style[p.team] === "possession" ? 400 : 800);
					if (offsideOn() && isOffside(m, offsideLine(p.team))) { continue; }
					if (openness(m) > 40 && s > bs) { bs = s; best = m; }
				}
				// Under pressure, look for the open player on the far side: switch the play.
				if (pressure) {
					const far = outfield(p.team).filter(m => m !== p && Math.abs(m.y - p.y) > FH * 0.45 && openness(m) > 90 && dist(p, m) < 520 * Math.sqrt(S) &&
						!(offsideOn() && isOffside(m, offsideLine(p.team))))[0];
					if (far && Math.random() < 0.5) { loftTo(p, far.x + (attackX(p.team) === FW ? 30 : -30), far.y); return null; }
				}
				if (best && (pressure || bs > (style[p.team] === "possession" ? 0.5 : 0.9))) { passTo(p, best); return null; }
			}
		}
		// Dribble toward goal, stepping around a defender in the way.
		// A wide man carries it down the line toward the byline; everyone else drifts inside toward goal.
		let ty = isWide(p.y, 0.22) && rel(p.team, p.x) < FW * 0.86 ? p.y : FH / 2 + (p.y - FH / 2) * 0.5;
		const opp = players.filter(q => q.team !== p.team);
		const block = opp.find(q => dist(q, p) < 75 && (q.x - p.x) * (goal.x - p.x) > 0);
		if (block) { ty = p.y + (p.y > block.y ? 110 : -110); }
		return [ goal.x, clamp(ty, 30, FH - 30) ];
	}

