	/* ---------- AI ---------- */
	const inAttackBox = p => rel(p.team, p.x) > FW - (FMT.box + 60) && Math.abs(p.y - FH / 2) < FMT.goal / 2 + FMT.box;
	const inOwnBox = p => rel(p.team, p.x) < FMT.box + 60 && Math.abs(p.y - FH / 2) < FMT.goal / 2 + FMT.box;
	const isWide = (y, f = 0.26) => Math.abs(y - FH / 2) > FH * f;

	// Keep teammates from bunching: nudge a target away from any teammate standing near it.
	function spreadTarget (p, t) {
		const gap = 46 * Math.sqrt(S);   // enough to stop a crowd, close enough for a short pass
		for (const q of players) {
			if (q.team !== p.team || q === p || q.role === "gk") { continue; }
			const dx = t[0] - q.x, dy = t[1] - q.y, d = Math.hypot(dx, dy);
			if (d > 0 && d < gap) { t[0] += dx / d * (gap - d) * 0.45; t[1] += dy / d * (gap - d) * 0.45; }
		}
		return [ clamp(t[0], 20, FW - 20), clamp(t[1], 20, FH - 20) ];
	}

