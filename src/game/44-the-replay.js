	/* ---------- the replay ----------
	   The last few seconds of play are kept: every player's position and pose, the ball and the
	   officials. After a goal in the 3D view, the celebration gives way to an instant replay of the
	   build-up, in slow motion, from another angle (high behind the goal, or low at the side of it),
	   then back to the scorer and the restart. Any key or tap skips it, as it does the celebration.
	   The match clock is stopped throughout, as it is for any goal. */
	const REC_F = [ "x", "y", "dir", "stride", "runAmt", "vx", "vy", "kickA", "kickPow", "jump", "slideAI", "fall", "dive", "diveSide", "throwA", "idlePh", "shuf", "celebA", "kneel", "sulk", "celebK", "hug" ];
	const REC_N = 360, REC_P = 24, REC_W = REC_P * REC_F.length + 5 + 15;   // frames kept, players, floats a frame
	const REPLAY_AT = 230, REPLAY_BEFORE = 150, REPLAY_AFTER = 28, REPLAY_SPEED = 0.64;
	const REPLAY_FR = Math.round((REPLAY_BEFORE + REPLAY_AFTER) / REPLAY_SPEED);   // frames on screen
	const rec = { buf: null, who: new Array(REC_N), head: 0, n: 0 };
	let replay = null;   // { end, len, left (frames still to record), angle, goalX, shotY }
	function recordFrame () {
		if (!rec.buf) { rec.buf = new Float32Array(REC_N * REC_W); }
		const b = rec.buf, o0 = rec.head * REC_W, NF = REC_F.length;
		rec.who[rec.head] = players;
		for (let i = 0; i < players.length && i < REC_P; i++) {
			const p = players[i], o = o0 + i * NF;
			for (let k = 0; k < NF; k++) { b[o + k] = +p[REC_F[k]] || 0; }
			if (p.lunge > 0 && i === ctrl) { b[o + 10] = 1; }   // your slide shows as a slide
		}
		const ob = o0 + REC_P * NF;
		b[ob] = ball.x; b[ob + 1] = ball.y; b[ob + 2] = ball.z || 0; b[ob + 3] = ball.vx; b[ob + 4] = ball.vy;
		officials3.forEach((f, k) => { const q = ob + 5 + k * 5; b[q] = f.x; b[q + 1] = f.y; b[q + 2] = f.dir; b[q + 3] = f.stride; b[q + 4] = f.runAmt; });
		rec.head = (rec.head + 1) % REC_N;
		rec.n = Math.min(REC_N, rec.n + 1);
	}
	// Called every simulated frame: keep recording during play, and for a moment after a goal (the
	// ball into the net), then hold the clip.
	function stepReplay () {
		if (state === "play") { recordFrame(); return; }
		if (state === "goal" && replay && replay.left > 0) {
			recordFrame();
			if (--replay.left === 0) { replay.end = (rec.head - 1 + REC_N) % REC_N; replay.len = Math.min(rec.n, REPLAY_BEFORE + REPLAY_AFTER); }
		}
	}
	// A goal: plan a replay if the 3D view is on and there is enough of the build-up to show.
	function cueReplay (scorer) {
		replay = null;
		if (camMode !== "3d" || !G3.renderer || threeFailed || rec.n < 60 || mode === "tutorial") { return 0; }
		replay = { left: REPLAY_AFTER, end: -1, len: 0, angle: (score[0] + score[1]) % 2, goalX: scorer === 0 ? FW : 0, shotY: ball.y };
		return REPLAY_FR;
	}
	const replayOn = () => !!(replay && replay.len > 0 && state === "goal" && celeb && celeb.t >= REPLAY_AT && celeb.t < REPLAY_AT + REPLAY_FR && goalTimer > 70 && camMode === "3d");
	// Where the clip is: a fractional frame, 0 at the start.
	const replayPos = () => clamp((celeb.t - REPLAY_AT) * REPLAY_SPEED, 0, replay.len - 1.001);
	// Put the recorded moment onto the players, the ball and the officials for drawing; returns
	// the function that puts everything back.
	function applyReplay (clip = replay, f = replayPos(), spd = REPLAY_SPEED) {
		const i0 = Math.floor(f), t = f - i0, NF = REC_F.length, b = rec.buf;
		const row = k => (clip.end - (clip.len - 1 - k) + REC_N * 2) % REC_N;
		const r0 = row(i0), r1 = row(Math.min(clip.len - 1, i0 + 1)), who = rec.who[r0] || players;
		const keep = [], keepPlayers = players, keepCtrl = ctrl;
		const lerpA = (a, c) => a + Math.atan2(Math.sin(c - a), Math.cos(c - a)) * t;
		who.forEach((p, i) => {
			if (i >= REC_P) { return; }
			const saved = {};
			for (const k of REC_F) { saved[k] = p[k]; }
			saved.lunge = p.lunge; keep.push([ p, saved ]);
			const a = r0 * REC_W + i * NF, c = r1 * REC_W + i * NF;
			REC_F.forEach((k, j) => { p[k] = b[a + j]; });
			p.x = b[a] + (b[c] - b[a]) * t; p.y = b[a + 1] + (b[c + 1] - b[a + 1]) * t;
			p.dir = lerpA(b[a + 2], b[c + 2]); p.stride = b[a + 3] + (b[c + 3] - b[a + 3]) * t;
			p.lunge = 0;
		});
		const ob0 = r0 * REC_W + REC_P * NF, ob1 = r1 * REC_W + REC_P * NF;
		const keepBall = [ ball.x, ball.y, ball.z, ball.vx, ball.vy ];
		ball.x = b[ob0] + (b[ob1] - b[ob0]) * t; ball.y = b[ob0 + 1] + (b[ob1 + 1] - b[ob0 + 1]) * t; ball.z = b[ob0 + 2] + (b[ob1 + 2] - b[ob0 + 2]) * t;
		ball.vx = b[ob0 + 3] * spd; ball.vy = b[ob0 + 4] * spd;
		const keepOff = officials3.map(o => [ o.x, o.y, o.dir, o.stride, o.runAmt ]);
		officials3.forEach((o, k) => { const q = ob0 + 5 + k * 5, q1 = ob1 + 5 + k * 5; o.x = b[q] + (b[q1] - b[q]) * t; o.y = b[q + 1] + (b[q1 + 1] - b[q + 1]) * t; o.dir = b[q + 2]; o.stride = b[q + 3]; o.runAmt = b[q + 4]; });
		players = who; ctrl = -1;
		return () => {
			for (const [ p, saved ] of keep) { Object.assign(p, saved); }
			[ ball.x, ball.y, ball.z, ball.vx, ball.vy ] = keepBall;
			officials3.forEach((o, k) => { [ o.x, o.y, o.dir, o.stride, o.runAmt ] = keepOff[k]; });
			players = keepPlayers; ctrl = keepCtrl;
		};
	}
	// The replay's camera: high in the stand behind the goal looking back up the pitch, or low at
	// the side of the goal looking across it. It follows the ball (with reduced motion it holds still).
	function replayShot (out) {
		const sw = endsSwapped(), gx = sw ? FW - replay.goalX : replay.goalX, side = gx > FW / 2 ? 1 : -1;
		const bx = sw ? FW - ball.x : ball.x, by = ball.y, bh = Math.max(0, ball.z || 0) * Z3;
		out.kind = "replay" + replay.angle;
		if (replay.angle === 0) {
			out.eye.set(gx + side * (F_END3 + 70), 96, clamp(FH / 2 - (replay.shotY - FH / 2) * 0.35, FH * 0.25, FH * 0.75));
		} else {
			out.eye.set(gx - side * 150, 24, FH + 4);
		}
		if (reduceMotion) { out.look.set(gx - side * 140, 8, FH / 2); } else { out.look.set(bx, 6 + bh * 0.5, by); }
		return out;
	}

