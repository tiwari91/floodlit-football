	/* ---------- how the footballers move ----------
	   Drawing only: everything here reads the simulation and never writes to it. The feet are placed
	   rather than swung: each foot is set down on the grass and stays there while the body passes over
	   it (its stance), then is carried through to the next footfall (its swing), and the legs reach
	   their feet through a two-bone solve (hip to knee to ankle). The cadence is the simulation's own
	   (p.stride, which also times the touches on the ball); the length of each step comes from the
	   ground speed, so a planted boot never slides. */
	// How far the drawn moment sits behind the integer timers (kickA, windUp, jump...): the picture is
	// drawn part of the way from the last frame to this one (38-camera), and the replays between two
	// recorded frames, so a strike lands on the frame the ball goes rather than a frame either side.
	let animLag = 0;
	const LEG_A3 = 7.3, LEG_B3 = 6.5, ANK3 = 0.8, HIP_W3 = 2.45, LEG3 = LEG_A3 + LEG_B3;
	const GRAV_FIG3 = 0.07;   // a man in the air: rig units a frame, a frame (a touch over real gravity, for snap)
	// A figure's size against the rig (drawFigures3D scales each player: taller and broader men).
	const figScale3 = p => (p.team >= 0 && p.role !== "staff" && p.build ? 0.95 + 0.1 * p.build.seed + (p.role === "gk" ? 0.03 : 0) : 1);
	// One leg to a point: the ankle at (Dx, Dy, Dz) from the hip joint, in his own frame (x forward, y up,
	// z to his right). The thigh swings forward on hip z and out on hip x, the knee folds the shin back,
	// and the ankle lays the foot flat (plus toe: + lifts the toes, - points them).
	function legIK3 (r, i, Dx, Dy, Dz, toe = 0) {
		const A = LEG_A3, B = LEG_B3, d = clamp(Math.hypot(Dx, Dy, Dz), 4, A + B - 0.02), lc = Math.hypot(Dy, Dz) || 1e-6;
		const ax = Math.atan2(-Dz, -Dy), fold = Math.PI - Math.acos(clamp((A * A + B * B - d * d) / (2 * A * B), -1, 1));
		const az = Math.atan2(Dx, lc) + Math.acos(clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1));
		r.hip[i].rotation.x = ax; r.hip[i].rotation.z = az;
		r.kn[i].rotation.z = -fold; r.an[i].rotation.z = fold - az + toe; r.an[i].rotation.x = -ax * 0.8;
	}
	// The same, with the ankle's target in his own (root) frame: measured from where the hip joint really
	// is, and turned into the pelvis's frame (it leans, rolls and twists with the stride), so a foot put
	// on the grass stays there whatever the hips do.
	const rx3 = (v, a) => { const c = Math.cos(a), s = Math.sin(a), y = v[1] * c - v[2] * s; v[2] = v[1] * s + v[2] * c; v[1] = y; return v; };
	const ry3 = (v, a) => { const c = Math.cos(a), s = Math.sin(a), x = v[0] * c + v[2] * s; v[2] = -v[0] * s + v[2] * c; v[0] = x; return v; };
	const rz3 = (v, a) => { const c = Math.cos(a), s = Math.sin(a), x = v[0] * c - v[1] * s; v[1] = v[0] * s + v[1] * c; v[0] = x; return v; };
	function hipAt3 (r, i) {
		const e = r.hips.rotation, v = rx3(ry3(rz3([ 0, -1, i ? HIP_W3 : -HIP_W3 ], e.z), e.y), e.x), P = r.hips.position;
		return [ P.x + v[0], P.y + v[1], P.z + v[2] ];
	}
	function footTo3 (r, i, X, Y, Z, toe = 0) {
		const hj = hipAt3(r, i), e = r.hips.rotation, d = rz3(ry3(rx3([ X - hj[0], Y - hj[1], Z - hj[2] ], -e.x), -e.y), -e.z);
		legIK3(r, i, d[0], d[1], d[2], toe);
	}
	// The run, walk, backpedal or side-shuffle for one frame: where each ankle goes, in his own frame, and
	// how high the hips ride. ph is the simulation's stride phase; face his drawn facing (the ground speed
	// is split against it, so a man still turning runs on his feet, not sideways across them).
	// o: crouch (lower the hips), wide (feet apart), fwd/lift/toe per leg (a foot eased forward, a heel up).
	function gait3 (p, ph, face, mir, o = {}) {
		const sc = figScale3(p) * (p.team >= 0 && p.build && p.build.girth ? p.build.girth : 1);
		const vxw = mir * (p.vx || 0), vzw = p.vy || 0, c = Math.cos(face), s = Math.sin(face);
		let vf = (vxw * c + vzw * s) / sc, vl = (-vxw * s + vzw * c) / sc;
		const spd = Math.hypot(p.vx || 0, p.vy || 0), g = p.build || { stride: 1 }, shuf = clamp(p.shuf || 0, 0, 1);
		// The cadence, exactly as stepLimbs advances p.stride: so many cycles a frame at this speed.
		const dph = Math.PI * 2 * (0.95 + 0.5 * spd) / (g.stride || 1) * (1 + 0.35 * shuf) / 60 * clamp(spd / 0.4, 0, 1);
		const T = dph > 1e-4 ? Math.PI * 2 / dph : 1e9;
		let vr = Math.hypot(vf, vl);
		const ux = vr > 1e-4 ? vf / vr : 1, uz = vr > 1e-4 ? vl / vr : 0;
		const back = clamp(-ux, 0, 1), side = Math.abs(uz);
		// Running he is in the air between footfalls (each foot down for under a third of the cycle at a
		// sprint); walking there is a moment on both feet. Backwards and sideways, shorter and quicker.
		const jogK = smooth3(clamp((vr - 0.4) / 0.45, 0, 1)), runK = clamp((vr - 1.0) / 1.8, 0, 1);   // a walk turns to a jog (a moment in the air) by 0.85, a jog to a sprint by 2.8
		// The length of a footfall's travel under him is the ground passed while it is down: where that
		// would be further than a leg reaches, the foot is down for less of the stride (more time in the air).
		const Lmax = 17 * (1 - back) * (1 - side) + 10 * back + 11 * side * (1 - back);
		const beta = clamp(Math.min(0.62 - 0.26 * jogK - 0.12 * runK + 0.06 * back, Lmax / Math.max(1e-3, vr * T)), 0.16, 0.62);
		const L = Math.min(vr * beta * T, Lmax), land = 0.4 - 0.12 * back;   // a foot comes down a little ahead of the hip and leaves further behind
		const mov = clamp(spd / 0.35, 0, 1), still = 1 - mov;
		const lift = (0.9 + 2.8 * jogK + 5 * runK * runK + 0.6 * shuf) * mov;   // the swinging foot's height: a shuffle, a jog, a sprinter's heel up under him
		const comp = (0.012 + 0.04 * jogK + 0.04 * runK) * mov;   // the stance knee gives under him, more the harder he runs
		const hr0 = (0.4 + 0.6 * jogK + 0.8 * runK) * mov;   // the heel peels up before the toe leaves
		const wide0 = 0.15 + (o.wide || 0) + 0.5 * side * mov;
		const feet = [];
		// Sideways he gallops rather than crossing his feet: the leading foot steps out and the other
		// follows it in a moment later, instead of the two alternating half a stride apart.
		const sideK = smooth3(clamp((side - 0.45) / 0.35, 0, 1)) * (1 - back), off1 = Math.PI + sideK * (uz >= 0 ? -0.7 : 0.7) * Math.PI;
		const wide = wide0 + 2.6 * sideK * mov;   // and wider, so the following foot comes in beside the leading one, not onto it
		for (let i = 0; i < 2; i++) {
			const sgn = i ? 1 : -1, phi = ph + (i ? off1 : 0);
			const u = (((phi - Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;   // 0 as this foot lands (as its arm is furthest back)
			const st = u < beta, sv = st ? u / beta : (u - beta) / (1 - beta);
			let al, y, toe;
			if (st) {
				al = L * (land - sv);
				const hr = hr0 * smooth3(clamp((sv - 0.55) / 0.45, 0, 1));
				y = ANK3 + hr; toe = -Math.asin(clamp(hr / 3.2, 0, 0.9)) + 0.18 * (1 - jogK) * mov * clamp(1 - sv / 0.12, 0, 1);   // walking, the heel strikes toes-up
			} else {
				// Through the air: a curve from where it left to where it lands, leaving at the ground's pace
				// and slowing to meet it; up high behind him at a sprint (the heel to the hip), low at a walk.
				const Tsw = (1 - beta) * T, p0 = -L * (1 - land), p1 = L * land, m0 = -vr * Math.min(Tsw, 60) * 0.6, m1 = -vr * Math.min(Tsw, 60) * 0.25;
				const s2 = sv * sv, s3 = s2 * sv;
				al = (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + sv) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
				const peak = 0.5 - 0.1 * jogK - 0.12 * runK, k = Math.log(0.5) / Math.log(peak);
				y = ANK3 + hr0 * (1 - smooth3(clamp(sv / 0.25, 0, 1))) + lift * Math.sin(Math.PI * Math.pow(sv, k));
				toe = lerp3(-0.3 - 0.2 * jogK - 0.3 * runK, 0.08 + 0.22 * (1 - jogK), smooth3(sv)) * mov;
			}
			let x = al * ux + (o.fwd ? o.fwd[i] : 0), z = sgn * (HIP_W3 + wide) + al * uz;
			y += o.lift ? o.lift[i] : 0; if (o.toe) { toe += o.toe[i]; }
			feet.push({ x, y, z, toe, st, sv, hz: sgn * HIP_W3 });
		}
		// Side-stepping, the feet never cross: the travelling foot stops short of the planted one.
		if (feet[1].z - feet[0].z < 1.6 && !(feet[0].st && feet[1].st)) { const f = feet[0].st ? feet[1] : feet[1].st ? feet[0] : uz >= 0 ? feet[0] : feet[1], o2 = f === feet[0] ? feet[1] : feet[0]; f.z = o2.z + (f === feet[1] ? 1.6 : -1.6); }
		// How high the hips can ride: no higher than lets every planted foot (before its heel rises) reach
		// the grass with the knee a touch bent; in the air between footfalls, eased from one to the next.
		const reachAt = f => { const kk = 1 - 0.01 * still - comp * Math.sin(Math.PI * clamp(f.sv / 0.8, 0, 1)), dz = f.z - f.hz; return Math.sqrt(Math.max(0, (LEG3 * kk) ** 2 - f.x * f.x - dz * dz)) + f.y; };
		// Neither foot down: between the last footfall's height and the next's.
		const L0 = L * (1 - land), L1 = L * land, fl = feet.reduce((m, f) => (f.st ? m : Math.max(m, f.sv)), 0);
		const hOff = Math.sqrt(Math.max(0, (LEG3 * (1 - comp * 0.3)) ** 2 - L0 * L0 * 0.4)) + ANK3 + hr0, hOn = Math.sqrt(Math.max(0, (LEG3 * (1 - 0.01 * still)) ** 2 - L1 * L1)) + ANK3;
		const hAir = lerp3(hOff, hOn, smooth3(fl)) + 0.3 * runK * Math.sin(Math.PI * fl);
		const sup = feet.filter(f => f.st && f.sv < 0.8);
		let h = hAir;
		if (sup.length) {
			// The weighted feet set the height; one just landing takes the weight over a frame or two
			// rather than snapping the hips down.
			for (const f of sup) { f.need = reachAt(f); f.ramp = smooth3(clamp(f.sv / 0.12, 0, 1)); }
			const set = sup.filter(f => f.ramp >= 1);
			h = set.length ? Math.min(...set.map(f => f.need)) : hAir;
			for (const f of sup) { if (f.ramp < 1) { h = Math.min(h, lerp3(h, f.need, f.ramp)); } }
		}
		h = Math.min(h, LEG3 * (1 - 0.01 * still) + ANK3) - (o.crouch || 0);
		// Late in a step the heel comes up as far as it must to keep the toes on the grass.
		for (const f of feet) {
			if (!f.st) { continue; }
			const dz = f.z - f.hz, r2 = (LEG3 - 0.05) ** 2 - f.x * f.x - dz * dz;
			const yMin = r2 > 0 ? h - Math.sqrt(r2) : h;
			if (yMin > f.y) { const up = Math.min(yMin - f.y, 3); f.y += up; f.toe -= Math.asin(clamp(up / 3.2, 0, 0.9)); }
		}
		return { h, feet, runK, jogK, L, beta, vf, vl, vr, mov };
	}
	// Put both legs on the feet gait3 chose, and the hips at its height (the hip joint is 1 below the hips).
	function legsTo3 (r, G) {
		r.hips.position.y = G.h + 1;
		for (let i = 0; i < 2; i++) { const f = G.feet[i]; footTo3(r, i, f.x, f.y, f.z, f.toe); }
	}
	/* The strike. kickClock3: frames from the moment the ball leaves his boot, at the drawn moment
	   (negative while he winds up: the simulation holds the ball at his feet windUp frames, then lets
	   it go and counts kickA down from KICK_T). Contact is drawn on the frame the ball starts to move. */
	function kickClock3 (p) {
		if (p.windUp > 0) { return 1 - p.windUp - animLag; }
		if (p.kickA > 0) { return KICK_T - p.kickA - animLag; }
		return null;
	}
	// What sort of kick: a side-footed pass, a driven ball or shot off the laces, a chip or lofted ball
	// (under it, leaning back), a clearance (the big swing, away), a volley (first time off a dropping
	// ball). Kept for the whole kick, so the swing never changes its mind at contact.
	const KICK_K3 = new WeakMap();
	function kickKind3 (p) {
		const live = !replayOn() && !odr, c = live ? KICK_K3.get(p) : null, key = `${p.kickPow}|${p.kickLoft ? 1 : 0}`;
		if (c && c.key === key) { return c.kind; }
		const snap = p.windSnap, pow = p.kickPow || 0.5;
		const shot = snap ? !!snap.shot : !!(ball && ball.lastBy === p && ball.shot);
		const own = p.team >= 0 && rel(p.team, p.x) < FW * 0.3;
		const volley = p.windN === 1 && (p.recvZ || 0) > 10 && p.gotAt !== undefined && frame - p.gotAt < 16;
		const kind = volley ? "volley" : p.kickLoft ? (shot ? "chip" : own && pow > 0.5 ? "clear" : "loft") : own && pow > 0.75 && !shot ? "clear" : pow > 0.55 || shot ? "drive" : "pass";
		if (live) { KICK_K3.set(p, { key, kind }); }
		return kind;
	}
	// The kicking leg's shape at the top of the backswing and at the end of the follow-through, per kind:
	// thigh angle (forward +), knee fold, toe (+ up), the leg turned out (side-foot), the body's lean (+ back).
	const KICK_SHAPE3 = {
		pass: { bh: -0.32, bk: 1.0, ft: [ 0.6, 0.25, 0.05 ], out: 1.05, lean: -0.1, n: 0.8 },
		drive: { bh: -0.62, bk: 1.75, ft: [ 1.35, 0.12, -0.75 ], out: 0.12, lean: -0.3, n: 1 },
		chip: { bh: -0.45, bk: 1.35, ft: [ 0.95, 0.4, 0.2 ], out: 0.2, lean: 0.18, n: 0.9 },
		loft: { bh: -0.6, bk: 1.6, ft: [ 1.4, 0.15, -0.35 ], out: 0.3, lean: 0.12, n: 1 },
		clear: { bh: -0.7, bk: 1.8, ft: [ 1.75, 0.1, -0.5 ], out: 0.2, lean: 0.22, n: 1.1 },
		volley: { bh: -0.4, bk: 1.5, ft: [ 1.3, 0.2, -0.6 ], out: 0.1, lean: 0.3, n: 1, side: 0.75 }
	};
	// The kicking leg along the swing, given its contact pose C (hip, knee fold, toe): the backswing
	// (thigh back, heel up to the seat) while he winds up, the hip leading the downswing and the knee
	// snapping straight late, through the ball, the follow-through up toward the target, then the leg
	// back down to the run. w: how much of the run's own leg to keep (1 = all).
	function kickLeg3 (k, kind, pow, n, C) {
		const S = KICK_SHAPE3[kind] || KICK_SHAPE3.drive, sc = 0.7 + 0.45 * pow;
		const B = [ S.bh * sc, S.bk * (0.75 + 0.3 * pow), -0.55 ], Fh = S.ft[0] * (0.75 + 0.35 * pow);
		const span = Math.max(1, n) + 1, down = Math.min(1.4, span * 0.45);   // frames for the downswing: the quickest part
		if (k < -down) {   // the backswing
			const t = clamp((k + span) / Math.max(0.3, span - down), 0, 1), e = smooth3(t);
			return { hip: B[0], knee: B[1], toe: B[2], w: 1 - e, bw: e, fw: 0 };
		}
		if (k < 0) {   // the downswing: the thigh comes through first, the knee whips straight last
			const t = clamp((k + down) / down, 0, 1);
			return { hip: lerp3(B[0], C[0], smooth3(t)), knee: lerp3(B[1], C[1], Math.pow(t, 2.2)), toe: lerp3(B[2], C[2], t), w: 0, bw: 1 - t, fw: 0 };
		}
		if (k < 4) {   // through the ball and up
			const t = k / 4, e = 1 - (1 - t) * (1 - t);
			return { hip: lerp3(C[0], Fh, e), knee: lerp3(C[1], S.ft[1], e), toe: lerp3(C[2], S.ft[2], e), w: 0, bw: 0, fw: e };
		}
		const t = clamp((k - 4) / 9, 0, 1), e = smooth3(t);   // and down, back into his stride
		return { hip: lerp3(Fh, 0.1, e), knee: lerp3(S.ft[1], 0.5, e), toe: lerp3(S.ft[2], 0, e), w: smooth3(clamp((k - 6) / 7, 0, 1)), bw: 0, fw: 1 - e };
	}
	// The ball's drawn height (as sync3D draws it): a ball taken on the chest or thigh drops to his feet.
	function ballDrawH3 () {
		const ow = ball.owner, rs = ow && (ow.recvK === "chest" || ow.recvK === "thigh") && ow.gotAt !== undefined ? frame - ow.gotAt : 99;
		return Math.max(0, ball.z || 0, rs >= 0 && rs < 14 ? (ow.recvZ || 0) * Math.pow(1 - rs / 14, 2) : 0);
	}
	// The kick in 3D. Before contact the boot is aimed at the ball itself (where it is drawn), so the
	// strike meets it on the frame it goes; the standing foot is planted beside the ball and stays put
	// as the leg follows through. Returns the pose numbers the arms and body use, or null.
	const KICK_C3 = new WeakMap();
	function kickPose3 (r, p, G, x, z, dir) {
		const k = kickClock3(p);
		if (k === null || k > 15) { return null; }
		if (p.role === "gk") { const h = gkHand3(p); if (h && h.kind !== "punt") { return null; } }   // thrown or rolled out: no swing of the leg
		const kind = kickKind3(p), pow = p.kickPow || 0.5, n = p.windUp > 0 || (p.kickA > 0 && p.windN && KICK_T - p.kickA < 16) ? p.windN || 1 : 0;
		const kf = p.build && p.build.left ? 0 : 1, pl = 1 - kf, sk = kf ? 1 : -1, sc = figScale3(p), S = KICK_SHAPE3[kind];
		const m = r.mir || 1, c = Math.cos(dir), s = Math.sin(dir);
		const toLocal = (bx, by) => { const dx = (m < 0 ? FW - bx : bx) - x, dz = by - z; return [ (dx * c + dz * s) / sc, (-dx * s + dz * c) / sc ]; };
		// Where the ball is to be met: at his feet while he winds up; once struck, where it was.
		let C = KICK_C3.get(p);
		const atFeet = ball && ball.owner === p, prevBall = ball && !ball.owner && ball.lastBy === p && ball.px !== undefined && k < 1.2;
		let bl = null;
		if (atFeet || prevBall) {
			const [ bf, bs ] = atFeet ? toLocal(ball.x, ball.y) : toLocal(ball.px, ball.py);
			const br = (G3.ballR || 2.6) / sc, hb = (atFeet ? ballDrawH3() : ball.pz || 0) * Z3 / sc + br;
			if (bf > 1 && bf < 30 && Math.abs(bs) < 12) {
				bl = [ bf, bs, hb, br ];
				// The ankle behind the ball's centre: the laces (toe pointed) for a drive, the inside of a
				// foot turned out for a pass, lower and under it for a chip.
				const side = kind === "pass" ? 0.9 * sk : 0;
				const ay = kind === "chip" ? Math.max(ANK3, hb - br * 0.9) : kind === "pass" ? Math.max(ANK3, hb - br * 0.45) : Math.max(ANK3 + 0.2, hb - br * 0.3);
				const ax = bf - br - (kind === "pass" ? 0.9 : 1.6), az = bs - side;
				const hj = hipAt3(r, kf);
				C = { ax, ay, az, hj: hj[1] };
				if (!replayOn() && !odr) { KICK_C3.set(p, C); }
			}
		}
		if (!C) { C = { ax: 6, ay: 2.4, az: sk * 1.2, hj: r.hips.position.y - 1 }; }
		// The standing foot: beside the ball, a boot's width to its side and a little behind it.
		const sp = pl ? 1 : -1, wind = k < 0 ? smooth3(clamp((k + Math.max(1, n) + 1) / (Math.max(1, n) + 0.6), 0, 1)) : 1;
		let plantX = C.ax - 0.5, plantZ = C.az + sk * 0 + sp * 4.6;
		if (k > 0) { plantX -= G.vf * k; }   // planted: as he carries on past it, it is left behind him
		const plantW = k < 0 ? wind : 1 - smooth3(clamp((k - 5) / 6, 0, 1)) * (plantX < -6 ? 1 : 0.6);
		r.hips.position.y -= (1.6 + 0.8 * pow) * Math.min(wind, plantW) * (k < 6 ? 1 : 0.5);   // the standing knee gives under him
		const pg = G.feet[pl];
		footTo3(r, pl, lerp3(pg.x, plantX, plantW), lerp3(pg.y, ANK3, plantW), lerp3(pg.z, plantZ, plantW), lerp3(pg.toe, 0, plantW));
		// The kicking leg: its contact pose from the ball (solved now), the swing around it.
		const kg = G.feet[kf];
		footTo3(r, kf, C.ax, C.ay, C.az, kind === "drive" || kind === "clear" || kind === "volley" ? -0.85 : kind === "pass" ? 0.1 : -0.3);
		const Cp = [ r.hip[kf].rotation.z, -r.kn[kf].rotation.z, r.an[kf].rotation.z - (-r.kn[kf].rotation.z - r.hip[kf].rotation.z) ], Cx = r.hip[kf].rotation.x;
		const L = kickLeg3(k, kind, pow, n, Cp);
		footTo3(r, kf, kg.x, kg.y, kg.z, kg.toe);   // his running leg, for the blend
		const run = [ r.hip[kf].rotation.z, -r.kn[kf].rotation.z, r.hip[kf].rotation.x ];
		const w = L.w;
		r.hip[kf].rotation.z = lerp3(L.hip, run[0], w);
		r.kn[kf].rotation.z = -lerp3(L.knee, run[1], w);
		r.hip[kf].rotation.x = lerp3(Cx * (k < 0 ? 1 - L.bw * 0.6 : 1) + (S.side || 0) * sk * -L.fw, run[2], w);
		r.an[kf].rotation.z = lerp3(L.knee - L.hip + L.toe, r.an[kf].rotation.z, w);
		r.hip[kf].rotation.y = (S.out || 0) * -sk * (1 - w) * (k < 0 ? 0.6 + 0.4 * (1 - L.bw) : 1);   // a side-foot: the leg turned out, the inside of the boot to the ball
		return { k, kind, kf, pl, sk, pow, w, bw: L.bw, fw: L.fw, S };
	}
	/* Headers. The simulation decides a header on the frame the ball reaches him and only then sets
	   p.jump, so drawn from p.jump alone he would leave the ground after the ball had gone. Instead the
	   jump is timed from the ball's own flight: its closest pass by his head, from a little before to a
	   little after now (its path run forward, and back, under gravity). He gathers, takes off so that he
	   is at the top as it arrives with his head at its height, and comes down after; a ball below his
	   head is met stooping. Pure arithmetic on the ball and the man, so replays and slow motion match. */
	const HEAD_H3 = 29.5;   // the forehead on a standing man, rig units
	function aerial3 (p, sc) {
		if (!ball || ball.owner || p.role === "gk" || (ball.z || 0) <= 0.5 && !(ball.vz > 0)) { return null; }
		const vx = ball.vx || 0, vy = ball.vy || 0, vz = ball.vz || 0, z0 = ball.z || 0;
		let best = null;
		for (let t = -20; t <= 22; t++) {
			const z = z0 + vz * t - 0.5 * GRAV * t * t;
			if (z < 6 || z > 64) { continue; }
			const d = Math.hypot(ball.x + vx * t - (p.x + (p.vx || 0) * Math.max(0, t)), ball.y + vy * t - (p.y + (p.vy || 0) * Math.max(0, t)));
			if (d < 27 && (!best || d < best.d)) { best = { t, d, z }; }
		}
		if (!best) { return null; }
		const top = best.z * Z3 / sc - HEAD_H3, hj = clamp(top, 0, 12), tUp = Math.sqrt(2 * hj / GRAV_FIG3) || 0;
		const t = best.t - animLag;   // frames until (or since, negative) the ball reaches him
		let y = 0, gather = 0, land = 0;
		if (Math.abs(t) < tUp) { y = hj - 0.5 * GRAV_FIG3 * t * t; }
		else if (t >= tUp && t < tUp + 7) { gather = Math.sin(Math.PI * (t - tUp) / 7); }
		else if (t <= -tUp && t > -tUp - 7) { land = Math.sin(Math.PI * (-t - tUp) / 7); }
		const near = clamp((27 - best.d) / 8, 0, 1), stoop = clamp(-top / 14, 0, 1) * clamp(1 - Math.abs(t) / 8, 0, 1);
		if (y <= 0 && gather <= 0 && land <= 0 && stoop <= 0) { return null; }
		return { y: y * near, gather: gather * near, land: land * near, stoop: stoop * near, t, hj, att: ball.lastBy && ball.lastBy.team === p.team, mine: ball.headed && ball.lastBy === p, up: hj > 0 ? y / hj : 0 };
	}
	/* The keeper's dive. The simulation starts it (p.dive, p.diveSide) as a shot comes and saves within
	   his reach; the drawing works out where the ball will pass him (its path run forward, or back once
	   it has been parried) and lays him out toward that point: flat along the grass for a low shot,
	   across for one at his hip, springing up for the top corner, the gloves at the ball. Caught, the ball
	   comes in to his chest; afterwards he gets up (diveCd runs on after the dive). */
	const DIVE3 = new WeakMap();
	function diveAim3 (p, x, z, dir, sc, m) {
		const c = Math.cos(dir), s = Math.sin(dir);
		let best = null;
		if (ball && !ball.owner) {
			for (let t = -8; t <= 30; t++) {
				const bz = (ball.z || 0) + (ball.vz || 0) * t - 0.5 * GRAV * t * t;
				if (bz < 0 && t > 0) { break; }
				const bx = ball.x + (ball.vx || 0) * t, by = ball.y + (ball.vy || 0) * t, dx = (m < 0 ? FW - bx : bx) - x, dz = by - z;
				const f = dx * c + dz * s, l = -dx * s + dz * c, d = Math.hypot(f, l);
				if (!best || d < best.d) { best = { d, f: f / sc, l: l / sc, h: Math.max(0, bz) * Z3 / sc + 2 }; }
				if (d < 24 * sc && t >= 0) { break; }   // where it comes within his reach (the save is made there)
			}
		}
		return best && best.d < 60 * sc ? best : null;
	}
	function divePose3 (r, p, dv, x, z, dir) {
		const sc = figScale3(p), m = r.mir || 1, live = !replayOn() && !odr;
		let D = DIVE3.get(p);
		const aim = diveAim3(p, x, z, dir, sc, m);
		if (!D || D.at > dv + 0.05 || !live) { D = { at: dv, l: aim ? aim.l : -(p.diveSide || 1) * 22, h: aim ? aim.h : 8, f: aim ? aim.f : 0 }; }
		if (aim && dv < 0.6) { D.l = aim.l; D.h = aim.h; D.f = aim.f; }   // until it reaches him the aim follows the ball
		D.at = dv; if (live) { DIVE3.set(p, D); }
		const side = Math.sign(D.l) || -(p.diveSide || 1), L = Math.abs(D.l), h = clamp(D.h, 1.5, 44), R = 36.5;
		// lay: how far over from upright; the root lifted and slid toward the ball so the gloves reach it
		const th = clamp(Math.atan2(L, Math.max(1, h - 6)), 0.3, 1.5);
		const go = smooth3(clamp((dv - 0.08) / 0.3, 0, 1)), sink = Math.sin(Math.PI * clamp(dv / 0.16, 0, 1)), down = smooth3(clamp((dv - 0.62) / 0.3, 0, 1));
		const y0 = clamp(h - R * Math.cos(th), 0, 14), sx = clamp(L - R * Math.sin(th), -4, 12);
		const thE = lerp3(th, Math.max(th, 1.45), down), yE = lerp3(y0, 1.2, down);
		r.root.rotation.x = side * thE * go;
		r.root.rotation.z = -0.15 * go;   // a little forward, attacking the ball rather than falling back
		D.th = thE; D.side = side;
		return { side, go, sink, down, yLift: yE * go - 1.5 * sink, slide: side * sx * go, fwd: clamp(D.f - 6, -4, 16) * go, caught: ball && ball.owner === p };
	}
	// The same swing for the TV camera's side-on figure: the kicking thigh's angle and knee bend (its
	// contact pose a nominal one: the stand camera never sees the boot meet the ball closely enough to aim it).
	function kickTV (p) {
		const k = kickClock3(p);
		if (k === null || k > 15) { return null; }
		const n = p.windUp > 0 || p.windN ? p.windN || 1 : 0, L = kickLeg3(k, kickKind3(p), p.kickPow || 0.5, n, [ 0.35, 0.1, -0.3 ]);
		return { s: lerp3(L.hip, 0, L.w), bend: lerp3(L.knee, 0.3, L.w), w: L.w, bw: L.bw };
	}
	// Slides seen, so the getting up afterwards is his (the same countdown follows a challenge on his feet).
	const SLID3 = new WeakMap();
	// Challenges on his feet: your shoulder challenge (lungeCd fresh, no slide), a tackle just won (the ball
	// just his, the loser held off it: kickCd 40), the man who lost it stumbling, and two men running
	// shoulder to shoulder leaning into each other. Read from the simulation's own counters.
	function challenge3 (p, x, z, dir, m) {
		const me = players.indexOf(p) === ctrl, c = Math.cos(dir), s = Math.sin(dir);
		let shove = 0, poke = 0, stumble = 0, lean = 0, side = 0, best = 1e9;
		const since = p.gotAt !== undefined ? frame - p.gotAt : 99, spd = Math.hypot(p.vx || 0, p.vy || 0);
		for (const q of players) {
			if (q.team === p.team || q.role === "gk") { continue; }
			const dx = (q.x - p.x) * m, dz = q.y - p.y, f = dx * c + dz * s, l = -dx * s + dz * c, d = Math.hypot(f, l);
			if (d > 34 || d >= best) { continue; }
			let hit = 0;
			if (me && !(p.lunge > 0) && p.lungeCd > 33 && !SLID3.get(p) && ball.owner === q) { shove = Math.sin(Math.PI * clamp((45 - p.lungeCd) / 12, 0, 1)); hit = 1; }
			if (ball.owner === p && since >= 0 && since < 10 && !p.recv && q.kickCd > 28) { poke = Math.sin(Math.PI * since / 10); hit = 1; }
			if (ball.owner === q && p.kickCd > 30 && q.gotAt !== undefined && frame - q.gotAt < 10) { stumble = Math.sin(Math.PI * clamp((40 - p.kickCd) / 10, 0, 1)); hit = 1; }
			const qs = Math.hypot(q.vx || 0, q.vy || 0);
			if (spd > 1.2 && qs > 1.2 && Math.abs(f) < 10 && Math.abs(l) > 7 && Math.abs(l) < 22 && ((p.vx || 0) * (q.vx || 0) + (p.vy || 0) * (q.vy || 0)) / (spd * qs) > 0.6) { lean = clamp((22 - Math.abs(l)) / 9, 0, 1); hit = 1; }
			if (hit) { best = d; side = Math.sign(l) || 1; }
		}
		return best < 1e9 ? { shove, poke, stumble, lean, side } : null;
	}
	// The keeper's distribution from his hands: he held it (in his area, not a goal kick) just before the
	// kick, and the kind follows the ball: along the grass short a roll, lofted and soft a throw, else a punt.
	const HELD3 = new WeakMap();
	function gkHand3 (p) {
		if (ball && ball.owner === p && inHands(p) && !(setPiece && setPiece.kind === "goalkick")) { HELD3.set(p, frame); }
		const k = p.kickA > 0 ? kickClock3(p) : null, h = HELD3.get(p);
		if (k === null || h === undefined || frame - h > KICK_T + 2) { return null; }
		return { k, kind: p.kickLoft ? ((p.kickPow || 0.5) < 0.55 ? "throw" : "punt") : (p.kickPow || 0.5) < 0.7 ? "roll" : "punt" };
	}
	// The keeper with the ball in his hands (in his area, not a goal kick off the grass): how far it is
	// gathered up to his chest, 0..1. Up over the first frames after he takes it; down to his feet again
	// as he winds up to kick it out (the boot meets it on the grass, where the simulation has it).
	function holdW3 (p) {
		if (!p || p.role !== "gk" || !ball || ball.owner !== p || !inHands(p) || (setPiece && setPiece.kind === "goalkick") || p.dive > 0 || p.fall > 0) { return 0; }
		const since = p.gotAt !== undefined ? frame - p.gotAt : 99;
		let w = smooth3(clamp((since + 1) / 6, 0, 1));
		if (p.windUp > 0) { w *= smooth3(clamp((p.windUp - 1) / Math.max(1, (p.windN || 1) - 1), 0, 1)); }
		return w;
	}
	// A shot blocked by an outfield man: blockShot sends the ball back off him and sets his kickCd to 12,
	// the shooter still the ball's last touch. Seen as that rise in kickCd (to 9..12, allowing for skipped
	// draws) with the ball loose off a shot from the other side; posed for BLOCK_T3 frames from then.
	const BLOCK_T3 = 14, BLK3 = new WeakMap();
	function block3 (p) {
		if (p.role === "gk" || p.team < 0 || replayOn() || odr) { return 0; }
		const s = BLK3.get(p) || { cd: 0, at: -99 }, cd = p.kickCd || 0;
		if (cd > s.cd && cd <= 12 && cd >= 9 && !(p.kickA > 0) && !ball.owner && ball.shot && ball.lastBy && ball.lastBy.team !== p.team && Math.hypot(ball.x - p.x, ball.y - p.y) < 60) { s.at = frame - (12 - cd); }
		s.cd = cd; BLK3.set(p, s);
		const t = (frame - s.at) / BLOCK_T3;
		return t >= 0 && t < 1 ? t : 0;
	}
	// Slides seen, so the getting up afterwards is his: both cameras keep this up to date every frame.
	function getUp3 (p, down) {
		if (down) { SLID3.set(p, true); }
		else if (!(p.lungeCd > 17) && !(p.slideCd > 94)) { SLID3.delete(p); }
		return !down && SLID3.get(p) ? (p.slideCd > 94 ? (p.slideCd - 94) / 14 : p.lungeCd > 17 && p.lungeCd <= 31 ? (p.lungeCd - 17) / 14 : 0) : 0;
	}
	// The goal huddle: team-mates run in to the scorer and can end up drawn inside each other. Drawn
	// apart (never moved in the simulation): any two men closer than HUDDLE_GAP3 are eased out to that
	// gap, the scorer held where he is. Worked out once per simulation frame; eases back to nothing after.
	const HUDDLE_GAP3 = 15, HUD3 = { at: -1, off: new Map() };
	function huddleOff3 (p) {
		if (HUD3.at !== frame) {
			HUD3.at = frame;
			const on = state === "goal" && !replayOn() && !odr, hero = on && typeof celeb !== "undefined" && celeb ? celeb.hero : null, want = new Map();
			if (on) {
				for (let i = 0; i < players.length; i++) {
					const a = players[i];
					for (let j = i + 1; j < players.length; j++) {
						const b = players[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
						if (d >= HUDDLE_GAP3) { continue; }
						const ux = d > 0.01 ? dx / d : Math.cos(i * 2.4), uy = d > 0.01 ? dy / d : Math.sin(i * 2.4), push = HUDDLE_GAP3 - d;
						const wa = a === hero ? 0 : b === hero ? 1 : 0.5, wb = 1 - wa;
						const A = want.get(a) || [ 0, 0 ], B = want.get(b) || [ 0, 0 ];
						A[0] -= ux * push * wa; A[1] -= uy * push * wa; B[0] += ux * push * wb; B[1] += uy * push * wb;
						want.set(a, A); want.set(b, B);
					}
				}
			}
			for (const q of players) {
				const w = want.get(q), o = HUD3.off.get(q);
				if (!w && !o) { continue; }
				const t = w || [ 0, 0 ], c = o || [ 0, 0 ], k = reduceMotion ? 1 : 0.25;
				c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k;
				if (!w && Math.abs(c[0]) + Math.abs(c[1]) < 0.05) { HUD3.off.delete(q); } else { HUD3.off.set(q, c); }
			}
		}
		return HUD3.off.get(p) || null;
	}
