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
		const up = (inPoss ? { possession: 40, balanced: 70, direct: 95, counter: 105 }[st]
			: { high: 40, mid: -30, low: -100 }[pr] - (st === "counter" ? 20 : 0)) + ment * 55 + 20 * edge(t) - 15 * edge(1 - t) + LINE_UP[line[t]] * (inPoss ? 0.5 : 1);
		const defLo = FW * (ment < 0 || line[t] === "deep" ? 0.06 : line[t] === "high" ? 0.14 : 0.09), defHi = FW * clamp(0.5 + ment * 0.06 + (inPoss ? 0.06 : 0) + (line[t] === "high" ? 0.06 : line[t] === "deep" ? -0.08 : 0), 0.36, 0.72);
		let defX = clamp(base.def + (bx - FW * 0.5) * (inPoss ? 0.5 : 0.42) + up * S, defLo, defHi);
		if (!inPoss) { defX = Math.min(defX, Math.max(defLo, bx - (line[t] === "deep" ? 130 : line[t] === "high" ? 70 : 90) * S)); }   // defending, always goal-side of the ball
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
		if (sh.inPoss && offsideOn()) { r = Math.min(r, offsideLine(p.team) - 10); }
		const ty = FH / 2 + (p.by - FH / 2) * sh.width + sh.shiftY;
		return [ p.team === 0 ? r : FW - r, clamp(ty, 40, FH - 40) ];
	}

