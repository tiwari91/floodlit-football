	/* ---------- the officials ----------
	   Not part of the simulation: the referee keeps a diagonal to the ball, the assistants run the
	   far touchline level with the second-last defender. */
	// The referees' kit: whichever of the bright officials' colours sits furthest from both sides'
	// shirts, both keepers and the grass, so the officials never blend into a team or the night.
	const REF_COLOURS3 = [ "#f4d61e", "#ff5fa2", "#2ad0f5", "#ff8a1f", "#9b7bff", "#b8f03c", "#f4f4f4" ];
	let refKit3 = null, refKitKey3 = "";
	function refKit () {
		const key = `${KITS[0].outfield}${KITS[1].outfield}${KITS[0].gk}${KITS[1].gk}`;
		if (refKit3 && refKitKey3 === key) { return refKit3; }
		const avoid = [ KITS[0].outfield, KITS[1].outfield, KITS[0].gk, KITS[1].gk, KITS[0].second || KITS[0].outfield, KITS[1].second || KITS[1].outfield ];
		const score = c => Math.min(...avoid.map(a => deltaE(c, a)), deltaE(c, "#1f6a3b") * 1.4);
		const shirt = REF_COLOURS3.reduce((a, b) => (score(b) > score(a) ? b : a));
		refKitKey3 = key;
		refKit3 = { shirt, shorts: "#15171a", socks: "#15171a", second: shirt, pattern: 0, ink: "#15171a", gloves: null, sleeves: false, boots: "#15181a", ring: null };
		return refKit3;
	}
	// The assistants' flags: raised straight up for offside, up and out when the ball goes out of play.
	let flagCall = null;   // { k: 1 or 2 (which assistant), kind: "off" | "out", t: frames left }
	function raiseFlag (x, kind) { if (!bulkSim) { flagCall = { k: x < FW / 2 ? 1 : 2, kind, t: kind === "off" ? 100 : 70 }; } }
	const officials3 = [ 0, 1, 2 ].map(i => ({ x: 0, y: 0, vx: 0, vy: 0, dir: -Math.PI / 2, stride: 0, runAmt: 0, idlePh: i * 2, role: "ref", team: -1,
		look: { skin: [ "#e0ac86", "#9c6a44", "#f1c9a5" ][i], hair: "#1b1410", style: [ "buzz", "short", "shaved" ][i], face: [ 1, 4, 6 ][i] } }));
	let officialsFor3 = null;
	function stepOfficial3 (o, tx, ty, maxSpd, dt) {
		const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
		const want = d < 6 ? 0 : Math.min(maxSpd, d / 20);
		const wx = d ? dx / d * want : 0, wy = d ? dy / d * want : 0;
		o.vx += (wx - o.vx) * Math.min(1, 0.08 * dt); o.vy += (wy - o.vy) * Math.min(1, 0.08 * dt);
		o.x += o.vx * dt; o.y += o.vy * dt;
		const spd = Math.hypot(o.vx, o.vy);
		if (spd > 0.25) { const a = Math.atan2(o.vy, o.vx); o.dir += Math.atan2(Math.sin(a - o.dir), Math.cos(a - o.dir)) * Math.min(1, 0.12 * dt); }
		o.stride += Math.PI * 2 * (0.95 + 0.5 * spd) / 60 * clamp(spd / 0.4, 0, 1) * dt;
		o.runAmt += (Math.min(1, spd / 2.6) - o.runAmt) * Math.min(1, 0.1 * dt);
		o.idlePh += 0.028 * dt;
	}
	function updateOfficials3 (dt) {
		if (!ball) { return; }
		if (officialsFor3 !== players) {   // a new match: back to their marks
			officialsFor3 = players;
			officials3[0].x = FW / 2 - 120; officials3[0].y = FH / 2 + 160;
			officials3[1].x = FW * 0.25; officials3[1].y = -6; officials3[2].x = FW * 0.75; officials3[2].y = -6;
		}
		const live = state === "play" || state === "goal";
		{
			const o = officials3[0];
			let tx = ball.x - (ball.x > FW / 2 ? 140 : -140) * (live ? 1 : 0.4), ty = ball.y + 150 * S;
			if (freeze > 0 && freezeKind === "kickoff") { tx = FW / 2 - 60; ty = FH / 2 + 90; }
			tx = clamp(tx, 40, FW - 40); ty = clamp(ty, 30, FH - 30);
			for (const p of players) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy); if (d < 26 && d > 0.01) { tx += dx / d * 30; ty += dy / d * 30; } }
			stepOfficial3(o, tx, ty, live ? 2.1 : 0.9, dt);
		}
		// The assistant on the left half watches team 0's defence, the other team 1's.
		for (let k = 1; k <= 2; k++) {
			const o = officials3[k], defTeam = k === 1 ? 0 : 1;
			const defs = players.filter(p => p.team === defTeam).map(p => (defTeam === 0 ? p.x : FW - p.x)).sort((a, b) => a - b);
			const second = defs.length > 1 ? defs[1] : 0;
			let lineX = defTeam === 0 ? second : FW - second;
			lineX = defTeam === 0 ? Math.min(lineX, ball.x, FW / 2) : Math.max(lineX, ball.x, FW / 2);
			const flagUp = flagCall && flagCall.k === k;   // he stands still with his flag up
			stepOfficial3(o, flagUp ? o.x : clamp(lineX, k === 1 ? 10 : FW / 2, k === 1 ? FW / 2 : FW - 10), -6, live ? 2.6 : 1, dt);
			o.dir = Math.PI / 2;   // facing the pitch, running sideways
		}
	}
	// Every figure this frame: the players, then the officials.
	function drawFigures3D (WX, WD) {
		const F = G3.fig;
		for (const k in F.parts) { F.cnt[k] = 0; }
		F.n = 0; F.nums.count = 0; F.rings.count = 0; F.blobs.count = 0; F.longs.count = 0;
		const dt = frameDt / 16.7;
		for (const p of players) {
			if (F.n >= MAXF3) { break; }
			const rig = F.rigs[F.n], pd = F.prevDir.get(p);
			const turn = pd === undefined ? 0 : Math.atan2(Math.sin(p.dir - pd), Math.cos(p.dir - pd)) / dt;
			F.prevDir.set(p, p.dir);
			const dBall = Math.hypot(ball.x - p.x, ball.y - p.y);
			const near = p.role === "gk" ? clamp(1 - dBall / (260 * S), 0, 1) : 0;
			// How far the head turns to follow the ball: the angle from his facing to it, within a
			// neck's reach, fading out past 420 units, mirrored with the pitch.
			const relB = Math.atan2(Math.sin(Math.atan2(ball.y - p.y, ball.x - p.x) - p.dir), Math.cos(Math.atan2(ball.y - p.y, ball.x - p.x) - p.dir));
			const yaw = -clamp(relB, -0.85, 0.85) * clamp(1 - dBall / (420 * S), 0, 1);
			pose3D(rig, p, WX(p.x), p.y, WD(p.dir), WX(1) < WX(0) ? -turn : turn, near, WX(1) < WX(0) ? -yaw : yaw);
			rig.root.scale.setScalar(0.95 + 0.1 * build(p).seed);   // tall and short
			commitFigure3D(rig, look(p), kit3D(p), p.num);
		}
		if (state === "play" || state === "goal" || state === "half" || state === "paused") { updateOfficials3(state === "play" || state === "goal" ? dt : 0); }
		const rk = refKit();
		F.flags.count = 0;
		officials3.forEach((o, k) => {
			if (F.n >= MAXF3) { return; }
			const rig = F.rigs[F.n];
			pose3D(rig, o, WX(o.x), o.y, WD(o.dir), 0, 0);
			if (k > 0) {
				// The flag hand: down by his side and a little forward, or up for a call (and waved).
				const up = flagCall && flagCall.k === k ? flagCall : null, wave = reduceMotion || !up ? 0 : Math.sin(frame * 0.5) * 0.25;
				if (up && up.kind === "off") { rig.sh[1].rotation.set(0, 0, -3.05); rig.el[1].rotation.z = 0; rig.ha[1].rotation.set(wave, 0, 0); }
				else if (up) { rig.sh[1].rotation.set(0.75, 0, -2.2); rig.el[1].rotation.z = 0.05; rig.ha[1].rotation.set(wave, 0, 0); }
				else { rig.sh[1].rotation.z = -0.35; rig.sh[1].rotation.x = 0.3; rig.el[1].rotation.z = 0.3; rig.ha[1].rotation.z = -0.55; }
			}
			commitFigure3D(rig, o.look, rk, null);
			if (k > 0 && F.flags.count < 2) { F.flags.setMatrixAt(F.flags.count++, rig.ha[1].matrixWorld); }
		});
		F.flags.instanceMatrix.needsUpdate = true;
		staff3D(WX);
		for (const k in F.parts) {
			const m = F.parts[k];
			m.count = F.cnt[k]; m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) { m.instanceColor.needsUpdate = true; }
		}
		F.parts.head.geometry.attributes.aFace.needsUpdate = true;
		const tg = F.parts.torso.geometry;
		tg.attributes.aPat.needsUpdate = true; tg.attributes.aCol2.needsUpdate = true;
		for (const m of [ F.nums, F.rings, F.blobs, F.longs ]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) { m.instanceColor.needsUpdate = true; } }
		F.nums.geometry.attributes.aCell.needsUpdate = true;
	}
