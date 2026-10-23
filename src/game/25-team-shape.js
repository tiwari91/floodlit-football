	/* ---------- team shape ----------
	   A side moves as three lines. Each line has one depth a frame, set from where the ball is,
	   the tactic (style with the ball, press without it) and the mentality; a player keeps only a
	   flattened trace of his formation stagger inside his line. So the back four slides as a back
	   four, the gaps between the lines open with the ball and close without it, and the whole side
	   shifts across towards the ball by the same amount. */
	const shapeCache = [ { frame: -1 }, { frame: -1 } ];
	function teamShapeInfo (t) {
		const c = shapeCache[t];
		if (c.frame === frame && c.FW === FW && c.n === players.length) { return c; }
		const inPoss = ball.owner ? ball.owner.team === t : possTeam === t;
		const st = style[t], pr = press[t], ment = mentality[t];
		const bx = rel(t, ball.x);
		const sum = { def: [ 0, 0 ], mid: [ 0, 0 ], fwd: [ 0, 0 ] };
		for (const p of players) { if (p.team === t && sum[p.role]) { sum[p.role][0] += rel(t, p.bx); sum[p.role][1]++; } }
		const base = { def: sum.def[1] ? sum.def[0] / sum.def[1] : FW * 0.18, fwd: sum.fwd[1] ? sum.fwd[0] / sum.fwd[1] : FW * 0.56 };
		base.mid = sum.mid[1] ? sum.mid[0] / sum.mid[1] : (base.def + base.fwd) / 2;
		// The back line follows the ball's depth: from the edge of the box when the ball is deep to
		// the halfway line pressing high or going all out. On top, the side pushes on; rattled, it sits.
		// The back line moves as one: it steps up together when the ball goes backwards or their man on it
		// turns away from goal, and drops a few yards when he has his head up with time to pick a pass.
		const oc = ball.owner && ball.owner.team !== t ? ball.owner : null;
		let squeeze = 0;
		if (!inPoss && line[t] !== "deep") {
			const back = oc ? (t === 0 ? oc.vx > 0.8 : oc.vx < -0.8) : !ball.owner && (t === 0 ? ball.vx > 3 : ball.vx < -3) && lastTouch !== t;
			if (back) { squeeze = 45; } else if (oc && frame - (oc.gotAt || 0) > 14 && openness(oc) > 60 * Math.sqrt(S) && rel(t, oc.x) < FW * 0.62) { squeeze = -30; }
		}
		const up = squeeze + (inPoss ? { possession: 40, balanced: 70, direct: 95, counter: 105 }[st]
			: { high: 40, mid: -30, low: -100 }[pr] - (st === "counter" ? 20 : 0)) + ment * 55 + 20 * edge(t) - 15 * edge(1 - t) + LINE_UP[line[t]] * (inPoss ? 0.5 : 1);
		const defLo = FW * (ment < 0 || line[t] === "deep" ? 0.06 : line[t] === "high" ? 0.14 : 0.09), defHi = FW * clamp(0.5 + ment * 0.06 + (inPoss ? 0.06 : 0) + (line[t] === "high" ? 0.06 : line[t] === "deep" ? -0.08 : 0), 0.36, 0.72);
		let defX;
		if (inPoss) { defX = clamp(base.def + (bx - FW * 0.5) * 0.5 + up * S, defLo, defHi); } else {
			// Without the ball the line is set from where the ball is. With it at halfway: the edge of the box
			// for a deep line, a third of the way up for a normal one, near halfway for a high one; the press,
			// the mentality and the moment shade that. As the ball comes on, every line drops smoothly, and
			// it reaches the six-yard box only once the ball is in the box. Past halfway it pushes up behind it.
			const L = FW * clamp({ deep: 0.18, normal: 0.27, high: 0.405 }[line[t]] + { high: 0.025, mid: 0, low: -0.02 }[pr] - (st === "counter" ? 0.01 : 0) +
				ment * 0.015 + 0.01 * edge(t) - 0.01 * edge(1 - t) + squeeze * 0.0004, 0.15, 0.48);
			const box = FMT.box + 20, k = clamp((bx - box) / (FW * 0.5 - box), 0, 1);
			defX = bx <= FW * 0.5 ? FW * 0.06 + (L - FW * 0.06) * k * (2 - k) * 0.5 + (L - FW * 0.06) * k * 0.5 : L + (bx - FW * 0.5) * 0.15;
			defX = Math.min(defX, FW * 0.55, Math.max(FW * 0.05, bx - 45 * S));   // always goal-side of the ball
		}
		// The gaps between the lines: stretched with the ball, compact without it, and squeezed
		// tighter still as the ball comes towards our goal.
		let stretch = inPoss ? { possession: 0.95, balanced: 1.1, direct: 1.25, counter: 1.3 }[st] : { high: 0.9, mid: 0.8, low: 0.7 }[pr];
		if (!inPoss) { stretch *= clamp(0.6 + bx / FW * 0.6, 0.6, 1); }
		const midX = clamp(defX + (base.mid - base.def) * stretch, FW * 0.18, FW * 0.85);
		let fwdX = midX + (base.fwd - base.mid) * stretch;
		if (inPoss && offsideOn()) { fwdX = Math.min(fwdX, offsideLine(t) - 25 * S); }   // the front line plays on the shoulder
		fwdX = clamp(fwdX, FW * 0.3, FW - 80 * S);
		// Across the pitch the side slides towards the ball as one, and narrows without it.
		const shiftY = (ball.y - FH / 2) * (inPoss ? 0.22 : 0.36);
		const width = inPoss ? (st === "possession" ? 0.95 : 1) : { high: 0.8, mid: 0.7, low: 0.62 }[pr];
		Object.assign(c, { frame, FW, n: players.length, inPoss, defX, midX, fwdX, base, shiftY, width });
		return c;
	}

	// A player's slot in that shape: his line's depth plus a trace of his formation stagger (a
	// wing-back a touch ahead of the centre-backs, a number ten ahead of the holding pair).
	function slotTarget (p) {
		const sh = teamShapeInfo(p.team);
		const stagger = (rel(p.team, p.bx) - sh.base[p.role]) * (p.role === "def" ? 0.3 : p.role === "mid" ? 0.7 : 0.8);
		let r = sh[p.role + "X"] + stagger;
		if (sh.inPoss && offsideOn()) {
			r = Math.min(r, offsideLine(p.team) - 10);
			// A forward doesn't read the line perfectly: now and then he loiters a yard or two beyond it, or is
			// slow back when it steps up (more often the slower he is), and a pass to him then is offside.
			if (p.role === "fwd") {
				if (!(p.lazyAt > frame)) { p.lazyAt = frame + 150 + Math.floor(Math.random() * 150); p.lazy = Math.random() < 0.12 + (65 - A(p, "pac")) * 0.004 ? 6 + Math.random() * 28 : 0; }
				if (p.lazy) { r = Math.max(r, offsideLine(p.team) - 10 + p.lazy); }
			}
		}
		const ty = FH / 2 + (p.by - FH / 2) * sh.width + sh.shiftY;
		return [ p.team === 0 ? r : FW - r, clamp(ty, 40, FH - 40) ];
	}


	/* ---------- team instructions at work ----------
	   What the press and the style cost in legs: a high press runs a side into the ground, a low block
	   saves it, keeping the ball is easier on the legs than chasing it back. */
	const STA_PRESS = { high: 1.22, mid: 1, low: 0.86 }, STA_STYLE = { possession: 0.94, balanced: 1, direct: 1.03, counter: 1.06 };
	const tacticDrain = t => ((ball.owner ? ball.owner.team === t : possTeam === t) ? STA_STYLE[style[t]] || 1 : STA_PRESS[press[t]] || 1);
	// A pressing trigger: a heavy first touch, a man receiving with his back to goal or running back
	// toward his own goal, or one pinned on the touchline. A pressing side jumps on it from further away.
	function pressTrigger (o) {
		if (!o || o.role === "gk" || inHands(o)) { return false; }
		const t = o.team;
		return (frame - (o.gotAt || 0) < 24 && dist(o, ball) > 22) || (t === 0 ? o.vx < -0.8 : o.vx > 0.8) || isWide(o.y, 0.42);
	}
	// How far out a side's nearest man goes to the ball (its press), with the trigger on top.
	function pressReach (t, o) {
		const pr = press[t], trig = pressTrigger(o), own = o ? rel(t, o.x) : FW;
		if (pr === "high") { return (trig ? 560 : 420) * Math.sqrt(S); }
		if (pr === "low") { return own < FW * 0.35 ? (trig ? 230 : 160) * Math.sqrt(S) : trig && own < FW * 0.5 ? 140 * Math.sqrt(S) : 80; }
		return own < FW * 0.5 || trig ? (trig ? 340 : 260) * Math.sqrt(S) : 150 * Math.sqrt(S);
	}
	// The computer reads the match about once a minute: chasing a game late, it presses high and goes
	// direct; holding a lead late, it sits in a low block and counters; outclassed on ratings it sits
	// deeper, and a side running out of legs eases off the press. Otherwise it plays its own way.
	let cpuTacBase = null;
	const sideRating = t => { const o = outfield(t); return o.reduce((s, q) => s + (A(q, "pas") + A(q, "sho") + A(q, "def") + A(q, "pac")) / 4, 0) / Math.max(1, o.length); };
	function cpuTactics () {
		if (tut || shoot || (surge && surge.team === 1)) { return; }
		const b = cpuTacBase || (cpuTacBase = { style: style[1], press: press[1], line: line[1] });
		const lead = score[1] - score[0], left = timeLeft / Math.max(1e-6, matchLen), gap = sideRating(1) - sideRating(0);
		const legs = outfield(1).reduce((s, q) => s + staOf(q), 0) / Math.max(1, outfield(1).length);
		// A low block is a choice the game forces (a lead to hold late on, or a side clearly better than this
		// one), never where it starts: a club that likes to sit deep plays a mid block until then.
		let st = b.style, pr = b.press === "low" ? "mid" : b.press;
		if (lead < 0 && left < 0.4) { pr = "high"; st = lead < -1 || st === "counter" ? "direct" : st; }
		else if (lead > 0 && left < 0.3) { pr = "low"; st = "counter"; }
		else if (gap < -8 && lead >= 0) { pr = "low"; st = st === "possession" ? "balanced" : "counter"; }
		else if (gap < -4 && lead >= 0 && pr === "high") { pr = "mid"; }
		else if (gap > 5 && lead <= 0 && left < 0.6) { pr = "high"; }
		if (pr === "high" && legs < 0.62 && !(lead < 0 && left < 0.4)) { pr = "mid"; }
		if (pr === press[1] && st === style[1] && line[1] === (pr === "high" ? "high" : pr === "low" ? "deep" : "normal")) { return; }
		const was = press[1];
		style[1] = st; press[1] = pr; line[1] = pr === "high" ? "high" : pr === "low" ? "deep" : "normal";
		if (pr !== was && state === "play" && !bulkSim) { toast(`${opp.short}: ${PRESSES[pr]}`, "#f2b52e"); }
	}

	// Whether a slide is worth it: at a loose touch, yes; from behind, hardly ever; as the last man
	// with nobody behind him, only if it is there to be won.
	function slideOdds (p, o) {
		const moving = Math.hypot(o.vx, o.vy) > 0.5;
		const behind = moving && Math.cos(Math.atan2(o.y - p.y, o.x - p.x) - Math.atan2(o.vy, o.vx)) > 0.55;
		const loose = dist(o, ball) > 24;
		const last = !players.some(q => q.team === p.team && q !== p && q.role !== "gk" && rel(p.team, q.x) < rel(p.team, p.x));
		return (loose ? 2 : 1) * (behind ? 0.3 : 1) * (last && !loose ? 0.4 : 1);
	}
