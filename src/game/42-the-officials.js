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
	// The stretcher in 3D: two medics in green carry it on, one at each end, set it down beside him, roll him on
	// and carry him off. Drawn only: the simulation's stretcher (stretcherPos, STRETCH_T) is unchanged.
	const MEDIC_KIT3 = { shirt: "#1f8a4c", shorts: "#1d2330", socks: "#1d2330", second: "#e9ecea", pattern: 0, ink: "#e9ecea", gloves: null, sleeves: true, boots: "#15181a", ring: null };
	const MEDIC_LOOK3 = [ { skin: "#c98e64", hair: "#2a1d14", style: "short", face: 2 }, { skin: "#f1c9a5", hair: "#6a4a2a", style: "buzz", face: 5 } ];
	const medics3 = [ 0, 1 ].map(i => ({ x: 0, y: 0, vx: 0, vy: 0, dir: 0, stride: 0, runAmt: 0, idlePh: i * 1.7, role: "staff", team: -1 }));
	const STRETCH_H3 = 14.2, STRETCH_L3 = 19;   // the height it is carried at (the medics' hands) and its half length
	// Where the stretcher is this frame, how high, and where the injured man is drawn (null: where he fell).
	function stretcher3 () {
		const s = stretcher, q = s && stretcherPos();
		if (!q) { return null; }
		const [ a, b ] = STRETCH_T, n = s.n, ax = Math.sign(s.at.y - s.from.y) || 1;
		const ox = 11;   // it comes on, is set down and goes off a stride to the side of where he fell
		let h = STRETCH_H3, roll = -1;
		if (n >= a && n < a + b) {
			const u = (n - a) / b;
			if (u < 0.3) { h = lerp3(STRETCH_H3, 1.4, smooth3(u / 0.3)); }
			else if (u < 0.6) { h = 1.4; roll = smooth3((u - 0.3) / 0.3); }
			else { h = lerp3(1.4, STRETCH_H3, smooth3((u - 0.6) / 0.4)); roll = 1; }
		} else if (n >= a + b) { roll = 1; }
		const x = q.x + ox, y = q.y;
		const man = roll < 0 ? null : { x: lerp3(s.at.x, x, roll), y: lerp3(s.at.y, y, roll), h: roll * (h + 0.6) };
		return { x, y, h, ax, man, down: n >= a && n < a + b ? 1 - (h - 1.4) / (STRETCH_H3 - 1.4) : 0, off: n >= a + b };
	}
	function medics3D (WX, WD, st, dt) {
		const F = G3.fig, T = THREE;
		if (!F.stretch || F.stretch.parent !== G3.scene) {
			const g = new T.Group(), canvasM = mat3D("#e9ecea"), poleM = mat3D("#b8352f");
			const c = new T.Mesh(new T.BoxGeometry(9.2, 0.7, STRETCH_L3 * 1.6), canvasM); g.add(c);
			for (const sx of [ -5, 5 ]) { const pm = new T.Mesh(new T.BoxGeometry(0.9, 0.9, STRETCH_L3 * 2), poleM); pm.position.x = sx; g.add(pm); }
			F.stretch = g; G3.scene.add(g);
		}
		F.stretch.visible = !!st;
		F.medicRigs = null;
		if (!st) { return; }
		F.stretch.position.set(WX(st.x), st.h, st.y);
		if (F.stretchFor !== stretcher) { F.stretchFor = stretcher; for (const m of medics3) { m.x = m.y = 0; m.runAmt = 0; } }   // a new stretcher: no speed carried over from the last one
		F.medicRigs = [];
		medics3.forEach((m, i) => {
			if (F.n >= MAXF3) { return; }
			const end = i ? 1 : -1, nx = st.x, ny = st.y + end * (STRETCH_L3 + 3.5 + 4.5 * st.down);
			const vx = m.x ? (nx - m.x) / Math.max(dt, 0.25) : 0, vy = m.y ? (ny - m.y) / Math.max(dt, 0.25) : 0, v = Math.hypot(vx, vy);
			m.x = nx; m.y = ny; m.vx = vx; m.vy = vy;
			m.runAmt += (Math.min(1, v / 2.6) - m.runAmt) * Math.min(1, 0.2 * dt);
			m.stride += Math.PI * 2 * (0.95 + 0.5 * v) / 60 * clamp(v / 0.4, 0, 1) * dt; m.idlePh += 0.028 * dt;
			m.dir = v > 0.3 ? Math.atan2(vy, vx) : end > 0 ? -Math.PI / 2 : Math.PI / 2;   // on the move he faces the way they go; set down, he faces the stretcher
			const r = F.rigs[F.n];
			r.mir = WX(1) < WX(0) ? -1 : 1;
			pose3D(r, m, WX(m.x), m.y, WD(m.dir), 0, 0);
			// The handles: in front of him if the stretcher is ahead, behind him if he leads it. Bent over to set it down.
			const ahead = Math.cos(m.dir) * (st.x - m.x) + Math.sin(m.dir) * (st.y - m.y) > 0;
			for (let k = 0; k < 2; k++) { r.sh[k].rotation.z = ahead ? 0.32 : -0.3; r.sh[k].rotation.x = OUT3(k) * 0.12; r.el[k].rotation.z = ahead ? 0.35 : 0.15; r.ha[k].rotation.set(0, 0, 0); }
			if (st.down > 0) {   // a squat to set it down: hips drop, knees bend, back over it
				const d = st.down; r.hips.position.y -= 7 * d; r.spine.rotation.z -= 0.85 * d; r.neck.rotation.z += 0.4 * d;
				for (let k = 0; k < 2; k++) { r.hip[k].rotation.z += 1.0 * d; r.kn[k].rotation.z -= 1.7 * d; r.an[k].rotation.z += 0.6 * d; r.sh[k].rotation.z += 0.45 * d; }
			}
			commitFigure3D(r, MEDIC_LOOK3[i], MEDIC_KIT3, null);
			F.medicRigs.push(r);
		});
	}
	// Every figure this frame: the players, then the officials.
	function drawFigures3D (WX, WD) {
		const F = G3.fig;
		for (const k in F.parts) { F.cnt[k] = 0; }
		// Each side's captain, chosen once per match; if he goes off the armband passes to the next in line.
		// Yours is the man on the pitch with the best season (see captainScore); theirs, and yours outside a
		// league, the best passer and defender together.
		if (!F.capt || F.captFor !== players || F.capt.some((c, t) => c && !players.includes(c))) {
			F.captFor = players;
			F.capt = [ 0, 1 ].map(t => outfield(t).reduce((a, q) => (!a || A(q, "pas") + A(q, "def") > A(a, "pas") + A(a, "def") ? q : a), null));
			const ms = league && league.club ? matchSquad() : null, sq = ms ? [ ...ms.squad, ...ms.bench ] : [];
			const mine = new Map(outfield(0).map(q => [ sq.find(pl => pl.name === q.name), q ]).filter(([ pl ]) => pl));
			const ic = intlSide && league.intl && league.intl.capt ? [ ...mine.keys() ].find(pl => pl.name === league.intl.capt) : null;   // the national side's own captain (18j)
			const best = ic || pickCaptain([ ...mine.keys() ]);
			if (best) { F.capt[0] = mine.get(best); }
			// Theirs, in a league match, by form: the last five ratings (see rateCpuRound), eased in the same way.
			const rec = league && leagueMatch && league.cpuForm && league.cpuForm.season === league.season && league.cpuForm.clubs[leagueMatch.opp];
			if (rec) {
				const sc = q => { const f = rec[q.name] || []; return (f.reduce((t, v) => t + v, 0) + 6.5 * 3) / (f.length + 3) + 0.0004 * (A(q, "pas") + A(q, "def")); };
				const c = outfield(1).filter(q => (rec[q.name] || []).length).reduce((a, q) => (!a || sc(q) > sc(a) ? q : a), null);
				if (c) { F.capt[1] = c; }
			}
		}
		// rigOf: which figure each drawn player got this frame (off-screen players get none)
		F.n = 0; F.rigOf = new Map(); F.nums.count = 0; if (F.chest) { F.chest.count = 0; } if (F.names) { F.names.count = 0; }
		// Repaint the chest prints when the kits or the clubs change.
		const ck = `${KITS[0].outfield}${KITS[0].second}${KITS[0].ink}|${KITS[1].outfield}${KITS[1].second}${KITS[1].ink}|${YOU.name}|${opp && opp.name}`;
		if (F.chest && F.chestKey !== ck) {
			F.chestKey = ck;
			const g = F.chestCv.getContext && F.chestCv.getContext("2d");
			if (g) { paintChest3D(g, 0, KITS[0], YOU); paintChest3D(g, 1, KITS[1], opp); F.chestTex.needsUpdate = true; }
		} F.rings.count = 0; F.blobs.count = 0; F.longs.count = 0;
		const dt = frameDt / 16.7, st3 = state === "play" ? stretcher3() : null, mirAll = WX(1) < WX(0) ? -1 : 1;
		for (const rg of F.rigs) { rg.mir = mirAll; }   // everyone's left and right (and ground speed) follow the mirrored pitch
		for (const p of players) {
			if (F.n >= MAXF3) { break; }
			const rig = F.rigs[F.n], pd = F.prevDir.get(p), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
			// The body turns, it doesn't snap: the simulation may swing his facing round in one frame, so
			// the figure eases toward it (a quick exponential, capped near 9 rad/s), with the head and chest
			// leading the hips (your own man quicker, ~16 rad/s). Straight to it in a replay, with reduced motion, or when he is moved.
			let ys = F.yawSt.get(p);
			if (!ys) { ys = { yaw: p.dir, x: p.x, y: p.y }; F.yawSt.set(p, ys); }
			// In an action (a kick, a slide, a header, a dive, a fall, a throw) the body faces where the play goes.
			const acting = p.kickA > 0 || p.slideAI > 0 || (p.lunge > 0 && players.indexOf(p) === ctrl) || p.dive > 0 || p.fall > 0 || p.throwA > 0 || jumpAmt(p) > 0;
			if (reduceMotion || replayOn() || acting || Math.hypot(p.x - ys.x, p.y - ys.y) > 40) { ys.yaw = p.dir; }
			else { const mine = players.indexOf(p) === ctrl, wind = p.windUp > 0, cap = (mine ? 0.016 : wind ? 0.015 : 0.0095) * frameDt; ys.yaw = wrapA(ys.yaw + clamp(wrapA(p.dir - ys.yaw) * (1 - Math.exp(-frameDt / (mine || wind ? 40 : 65))), -cap, cap)); }   // yours a touch quicker, so control stays crisp; winding up, he squares up to the ball as quick as yours (still a turn, never a snap)
			ys.x = p.x; ys.y = p.y;
			// Acceleration along his facing, smoothed, for the lean (none in a replay).
			const fv = (p.vx || 0) * Math.cos(p.dir) + (p.vy || 0) * Math.sin(p.dir);
			ys.acc = replayOn() || ys.fv === undefined ? 0 : (ys.acc || 0) + ((fv - ys.fv) / Math.max(dt, 0.25) - (ys.acc || 0)) * (1 - Math.exp(-frameDt / 140));
			ys.fv = fv; rig.acc = ys.acc;
			const face = ys.yaw, lead = -clamp(wrapA(p.dir - face), -1.2, 1.2);
			const turn = pd === undefined ? 0 : wrapA(face - pd) / dt;
			F.prevDir.set(p, face);
			const dBall = Math.hypot(ball.x - p.x, ball.y - p.y);
			const near = p.role === "gk" ? clamp(1 - dBall / (260 * S), 0, 1) : 0;
			// How far the head turns to follow the ball: the angle from his facing to it, within a
			// neck's reach, fading out past 420 units, mirrored with the pitch.
			const relB = wrapA(Math.atan2(ball.y - p.y, ball.x - p.x) - face);
			let yaw = -clamp(relB, -0.85, 0.85) * clamp(1 - dBall / (420 * S), 0, 1);
			// Shoulder checks: off the ball in open play, every few seconds a quick look over the shoulder away
			// from the ball (to see who is behind him), as a midfielder does before the ball comes. Timed from the
			// match frame and his own seed, so it is the same each time it is drawn; none in a replay.
			const chk = p.role !== "gk" && p.team >= 0 && ball.owner && ball.owner !== p && p !== receiver && state === "play" && !replayOn() && !acting && dBall > 90 * S && dBall < 900 * S ? shoulderCheck3(p, ball.owner.team === p.team) : 0;
			if (chk > 0) { yaw = lerp3(yaw, (relB >= 0 ? 1 : -1) * 1.15, chk); }
			const mir = WX(1) < WX(0) ? -1 : 1;
			rig.mir = mir;   // the pose needs it to tell his left from his right
			const ride = st3 && st3.man && stretcher.p === p ? st3.man : null;   // on the stretcher: lying along it
			if (ride) { pose3D(rig, p, WX(ride.x), ride.y - st3.ax * 12.5, WD(st3.ax > 0 ? Math.PI / 2 : -Math.PI / 2), 0, 0); rig.root.position.y += ride.h; }   // the figure's root is at his feet: set back half his length so he lies within it
			else { const ho = huddleOff3(p); pose3D(rig, p, WX(p.x + (ho ? ho[0] : 0)), p.y + (ho ? ho[1] : 0), WD(face), mir * turn, near, mir * yaw, mir * lead); }   // (ho: drawn apart in the goal huddle)
			if (p.stageY) { rig.root.position.y += p.stageY; }   // up on the trophy stage or the bus (44a)
			blendUpper3D(rig, ys, !!ride || acting || p.windUp > 0 || reduceMotion || replayOn() || frameDt > 100);
			{ build(p); const [ ht, br ] = bodyType3(p); rig.root.scale.set(ht * br, ht, ht * br); }   // tall and short, broad and slight
			F.rigOf.set(p, rig);
			commitFigure3D(rig, look(p), kit3D(p), p.num);
		}
		if (state === "play" || state === "goal" || state === "half" || state === "paused") { updateOfficials3(state === "play" || state === "goal" ? dt : 0); }
		const rk = refKit();
		F.flags.count = 0;
		officials3.forEach((o, k) => {
			if (F.n >= MAXF3) { return; }
			const rig = F.rigs[F.n];
			pose3D(rig, o, WX(o.x), o.y, WD(o.dir), 0, 0);
			if (o.stageY) { rig.root.position.y += o.stageY; }
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
		medics3D(WX, WD, st3, dt);
		staff3D(WX);
		warmups3D();
		ballKids3D();
		for (const k in F.parts) {
			const m = F.parts[k];
			m.count = F.cnt[k]; m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) { m.instanceColor.needsUpdate = true; }
			if (m.geometry.attributes.aLo0) { const ga = m.geometry.attributes; for (const a of [ ga.aLo0, ga.aLo1, ga.aLo2, ga.aLo3, ga.aCol2 ]) { if (a) { a.needsUpdate = true; } } }
		}
		{ const ha = F.parts.head.geometry.attributes, hr = F.parts.hair.geometry.attributes; ha.aFace.needsUpdate = true; ha.aJaw.needsUpdate = true; hr.aHairA.needsUpdate = true; hr.aHairB.needsUpdate = true; hr.aJaw.needsUpdate = true; }
		const tg = F.parts.torso.geometry;
		tg.attributes.aPat.needsUpdate = true; tg.attributes.aCol2.needsUpdate = true;
		for (const m of [ F.nums, F.rings, F.blobs, F.longs ]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) { m.instanceColor.needsUpdate = true; } }
		if (F.chest) { F.chest.instanceMatrix.needsUpdate = true; F.chest.geometry.attributes.aRow.needsUpdate = true; }
		if (F.names) { F.names.instanceMatrix.needsUpdate = true; F.names.geometry.attributes.aCell.needsUpdate = true; }
		F.nums.geometry.attributes.aCell.needsUpdate = true;
	}
