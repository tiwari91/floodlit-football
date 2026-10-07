	/* ---------- the TV camera ---------- */
	// High in the main stand behind the near touchline, following the play along the line.
	// The pitch (with everything painted on it: shadows, rings, lines) is drawn flat into an
	// offscreen picture, then laid down in perspective one strip at a time; players, the ball,
	// the goals and the far stand stand up on top of it.
	// The 3D camera by default on a laptop or desktop with WebGL (TV without it); on a phone the
	// players would be tiny, so overhead.
	const wideScreen = (() => { try { return window.matchMedia("(min-width: 700px)").matches; } catch (e) { return false; } })();
	const webglOK = (() => {
		try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
	})();
	// top: overhead. tv: from the main stand. 3d: WebGL (three.js), when the browser can.
	// The player's own choice is saved under CAM_KEY, and only when they pick a camera themselves.
	// Older builds saved under "ff-cam" with a 2D default; that value is ignored (except an explicit
	// 3D) so it cannot hide the 3D view from someone who never chose a camera at all.
	const CAM_KEY = "ff-cam2";
	const defaultCam = () => (wideScreen && !coarse && webglOK ? "3d" : wideScreen ? "tv" : "top");
	let camMode = (() => {
		const s = store.get(CAM_KEY) || (store.get("ff-cam") === "3d" ? "3d" : null);
		return s === "tv" || s === "top" || s === "3d" ? s : defaultCam();
	})();
	const TV = { camX: null, Cy: 0, Hc: 0, th: 0, f: 1, cy: 0, key: "" };
	const Z_W = 0.71;   // ball and crossbar heights are in their own units; this turns them into pitch pixels
	function tvSetup () {
		const key = `${FW}x${FH}:${Math.round(VW)}x${Math.round(VH)}`;
		if (TV.key === key) { return; }
		TV.key = key;
		TV.Cy = FH * 2.4; TV.Hc = FH * 0.9; TV.cy = VH * 0.5;
		const an = Math.atan2(TV.Hc, TV.Cy - (FH + 26)), af = Math.atan2(TV.Hc, TV.Cy + 16);
		const bottom = VH - TV.cy, top = TV.cy - VH * 0.26;
		// The tilt that puts the near touchline on the bottom edge and the far one a quarter down.
		let lo = af, hi = an;
		for (let i = 0; i < 50; i++) {
			const th = (lo + hi) / 2;
			if (Math.tan(an - th) / bottom - Math.tan(th - af) / top > 0) { lo = th; } else { hi = th; }
		}
		TV.th = (lo + hi) / 2;
		TV.f = bottom / Math.tan(an - TV.th);
	}
	function tvProj (x, y, z) {
		const c = Math.cos(TV.th), s = Math.sin(TV.th), ry = y - TV.Cy, rz = z - TV.Hc;
		const depth = -ry * c - rz * s;
		if (depth < 1) { return null; }
		const k = TV.f / depth;
		return { x: VW / 2 + (x - TV.camX) * k, y: TV.cy - (-ry * s + rz * c) * k, k };
	}
	function tvRow (sy) {
		const c = Math.cos(TV.th), s = Math.sin(TV.th), v = -(sy - TV.cy) / TV.f, dz = -s + v * c;
		if (dz >= -1e-6) { return null; }
		const t = -TV.Hc / dz;
		return { y: TV.Cy + (-c - v * s) * t, t };
	}
	let tvTex = null;
	function tvGroundTex () {
		if (tvTex && tvTex.stands === stands && tvTex.w === WW && tvTex.h === WH && tvTex.cond === cond.label + cond.ko && tvTex.st === gstyle) { return; }
		const mk = () => { const c = document.createElement("canvas"); c.width = Math.ceil(WW); c.height = Math.ceil(WH); return c; };
		const c = mk(), d = mk(), g = c.getContext && c.getContext("2d"), dg = d.getContext && d.getContext("2d");
		if (!g || !dg) { tvTex = null; return; }
		const keep = ctx;
		ctx = g;
		try { drawPitch(true); } finally { ctx = keep; }
		tvTex = { c, d, dg, stands, w: WW, h: WH, cond: cond.label + cond.ko, st: gstyle };
	}
	function drawSceneTV () {
		fitView();
		tvSetup();
		tvGroundTex();
		if (!tvTex) { drawSceneTop(); return; }
		// Keep the overhead camera up to date too, so switching back is smooth.
		const [ tx, ty ] = camTarget(), ease = reduceMotion ? 1 : 1 - Math.exp(-frameDt / 190);
		camX += (tx - camX) * ease; camY += (ty - camY) * ease;
		const o = ball.owner, bx = celebTracking() ? celeb.hero.x : o ? o.x + o.vx * 14 : ball.x;
		const mid = tvRow(TV.cy), half = mid ? VW / 2 / TV.f * mid.t : FW;
		const want = half * 2 >= FW ? FW / 2 : clamp(bx, half - MX * 0.6, FW - half + MX * 0.6);
		TV.camX = TV.camX == null ? want : TV.camX + (want - TV.camX) * (reduceMotion ? 1 : 1 - Math.exp(-frameDt / 260));

		// 1. The flat layer: the pitch, then shadows and everything painted on the grass.
		const g = tvTex.dg;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.drawImage(tvTex.c, 0, 0);
		const keep = ctx;
		ctx = g;
		try {
			ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
			for (const p of players) { ctx.beginPath(); ctx.ellipse(MX + p.x + 3, MY + p.y + 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); }
			const bz = Math.max(0, ball.z);
			ctx.fillStyle = `rgba(0, 0, 0, ${0.4 / (1 + bz / 40)})`;
			ctx.beginPath(); ctx.ellipse(MX + ball.x + bz * 0.15, MY + ball.y + bz * 0.1, 5 + bz * 0.04, 3 + bz * 0.03, 0, 0, Math.PI * 2); ctx.fill();
			drawFreeKickSpray(); drawPassTarget(); drawStrikerMarker(); drawSwitchPreview(); drawOffsideLine(); drawAim(); drawPenAim(false); drawReview(false); drawStretcher(false);
			if (tut && tut.marker) {
				ctx.strokeStyle = "#f2b52e"; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.arc(MX + tut.marker.x, MY + tut.marker.y, 24, 0, Math.PI * 2); ctx.stroke();
			}
			drawFx(false);
		} finally { ctx = keep; }

		if (endsSwapped()) { ctx.setTransform(-scale, 0, 0, scale, VW * scale, 0); } else { ctx.setTransform(scale, 0, 0, scale, 0, 0); }
		// 2. The night sky, the far stand standing up behind the far touchline, the floodlights.
		const st = gstyle || { roof: true, lights: "pylons" };
		// The far stand is a tier rising back from the touchline: each row of its picture is
		// laid on the slope at its own depth.
		const standD = MY * 1.7, standH = MY * 1.9, xl = -MX - 40, xr = FW + MX + 40;
		const onTier = u => [ -14 - u * standD, u * standH ];   // u: 0 at the front, 1 at the back
		const back = tvProj(xl, ...onTier(1)), front = tvProj(xl, ...onTier(0));
		const sky = ctx.createLinearGradient(0, 0, 0, back ? back.y : VH * 0.3);
		if (cond.ko === "day") { sky.addColorStop(0, cond.wet ? "#59636d" : "#4f7aa6"); sky.addColorStop(1, cond.wet ? "#9aa3aa" : "#b9cddd"); } else { sky.addColorStop(0, "#020408"); sky.addColorStop(1, "#0f1920"); }
		ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
		if (stands && back && front) {
			const img = standTop(), rows = 40, rh = img.height / rows;
			for (let i = 0; i < rows; i++) {
				const u0 = 1 - i / rows, u1 = 1 - (i + 1) / rows;
				const a = tvProj(xl, ...onTier(u0)), b = tvProj(xr, ...onTier(u0)), c = tvProj(xl, ...onTier(u1));
				if (!a || !b || !c) { continue; }
				ctx.drawImage(img, 0, i * rh, img.width, rh, a.x, a.y, b.x - a.x, c.y - a.y + 0.8);
			}
			if (st.roof) {
				const r1 = tvProj(xl, -14 - standD * 1.05, standH * 1.12), r2 = tvProj(xr, -14 - standD * 1.05, standH * 1.12);
				if (r1 && r2) {
					ctx.fillStyle = "#0a0d10";
					ctx.fillRect(r1.x, r1.y, r2.x - r1.x, back.y - r1.y + 1);
					if (st.lights === "roof") {
						ctx.fillStyle = "#fff6d8";
						for (let x = xl + 30; x < xr; x += 70) { const q = tvProj(x, -14 - standD * 0.2, standH * 1.1); if (q) { ctx.fillRect(q.x, back.y - 5, 30 * q.k, 3); } }
					}
				}
			}
		}
		const wt = back;
		if (st.lights === "pylons") {
			for (const px of [ -MX * 0.6, FW + MX * 0.6 ]) {
				const foot = tvProj(px, -40, 0), head = tvProj(px, -40, standH * 2.3);
				if (!foot || !head) { continue; }
				ctx.strokeStyle = "#39434a"; ctx.lineWidth = Math.max(2, 5 * head.k);
				ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(head.x, head.y); ctx.stroke();
				const glow = ctx.createRadialGradient(head.x, head.y, 2, head.x, head.y, 90 * head.k + 30);
				glow.addColorStop(0, "rgba(255, 244, 210, 0.55)"); glow.addColorStop(1, "rgba(255, 244, 210, 0)");
				ctx.fillStyle = glow; ctx.fillRect(head.x - 140, head.y - 140, 280, 280);
				ctx.fillStyle = "#fff6d8"; ctx.fillRect(head.x - 22 * head.k, head.y - 12 * head.k, 44 * head.k, 16 * head.k);
			}
		}
		// 3. The pitch, strip by strip in perspective.
		const far = tvProj(TV.camX, -14, 0), y0 = Math.max(0, Math.floor(far ? far.y : 0));
		const R = 2;
		for (let sy = y0; sy < VH; sy += R) {
			const a = tvRow(sy), b = tvRow(sy + R);
			if (!a || !b) { continue; }
			const hw = VW / 2 / TV.f * a.t, sx0 = MX + TV.camX - hw, sw = hw * 2;
			const L = Math.max(0, sx0), Rr = Math.min(WW, sx0 + sw), ty0 = MY + a.y, th = Math.max(0.6, b.y - a.y);
			if (Rr <= L || ty0 < 0 || ty0 >= WH) { continue; }
			ctx.drawImage(tvTex.d, L, ty0, Rr - L, Math.min(th, WH - ty0), (L - sx0) / sw * VW, sy, (Rr - L) / sw * VW, R + 0.6);
		}
		// 4. Goals, players and the ball, far to near.
		const items = players.map(p => ({ y: p.y, draw: () => drawPlayerTV(p) }));
		items.push({ y: ball.y + 0.5, draw: drawBallTV });
		items.push({ y: GOAL_T, draw: () => drawGoalTV(true) }, { y: GOAL_T, draw: () => drawGoalTV(false) });
		items.sort((a, b) => a.y - b.y);
		for (const it of items) { it.draw(); }
		// Pop-up words (goal, won it, saved) stand up over the spot.
		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.font = "800 22px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
		for (const f of fx) {
			if (f.toast || !f.label) { continue; }
			const k = f.t / (f.life || 40), q = tvProj(f.p ? f.p.x : f.x, f.p ? f.p.y : f.y, 60);
			if (!q) { continue; }
			ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
			ctx.fillText(f.label.toUpperCase(), q.x, q.y - (reduceMotion ? 0 : k * 16));
		}
		ctx.globalAlpha = 1;
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		drawRain();
		drawMinimap();
		drawHints();
		drawPowerMeter();
		drawToasts();
		drawCountdown();
	}
	function drawGoalTV (left) {
		const x0 = left ? 0 : FW, xb = left ? -NET : FW + NET, cb = 55 * Z_W, bb = cb * 0.72;
		const P = (x, y, z) => tvProj(x, y, z);
		const seg = (a, b) => { if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } };
		// The net: a mesh from the frame back to the rear bar.
		ctx.strokeStyle = "rgba(255, 255, 255, 0.22)"; ctx.lineWidth = 1;
		ctx.beginPath();
		for (let y = GOAL_T; y <= GOAL_B + 0.1; y += (GOAL_B - GOAL_T) / 10) { seg(P(x0, y, cb), P(xb, y, bb)); seg(P(xb, y, bb), P(xb, y, 0)); }
		for (let z = 0; z <= bb + 0.1; z += bb / 4) { seg(P(xb, GOAL_T, z), P(xb, GOAL_B, z)); }
		ctx.stroke();
		ctx.strokeStyle = "#f7faf5"; ctx.lineCap = "round";
		const k = (P(x0, (GOAL_T + GOAL_B) / 2, 0) || { k: 1 }).k;
		ctx.lineWidth = Math.max(2, 3.2 * k);
		ctx.beginPath();
		seg(P(x0, GOAL_T, 0), P(x0, GOAL_T, cb)); seg(P(x0, GOAL_T, cb), P(x0, GOAL_B, cb)); seg(P(x0, GOAL_B, cb), P(x0, GOAL_B, 0));
		ctx.stroke();
		ctx.lineWidth = Math.max(1, 1.6 * k);
		ctx.beginPath();
		seg(P(x0, GOAL_T, cb), P(xb, GOAL_T, bb)); seg(P(x0, GOAL_B, cb), P(xb, GOAL_B, bb)); seg(P(xb, GOAL_T, bb), P(xb, GOAL_B, bb));
		seg(P(xb, GOAL_T, 0), P(xb, GOAL_T, bb)); seg(P(xb, GOAL_B, 0), P(xb, GOAL_B, bb));
		ctx.stroke();
		ctx.lineCap = "butt";
	}
	// A footballer seen from the stand: boots, legs, shorts, shirt, arms and head, running.
	function drawPlayerTV (p) {
		const b = tvProj(p.x, p.y, 0);
		if (!b) { return; }
		const kit = KITS[p.team], L = look(p), k = b.k;
		const down = (p.lunge > 0 && players.indexOf(p) === ctrl) || p.slideAI > 0;
		const jump = reduceMotion ? 0 : jumpAmt(p);
		const H = 34 * k * (down ? 0.55 : 1), Y = b.y - jump * 34 * k * 0.32;
		let X = b.x;
		// A soft shadow cast away from the floodlights, staying on the grass when he jumps.
		ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
		ctx.beginPath(); ctx.ellipse(X + H * 0.12, b.y + H * 0.01, H * 0.36, H * 0.07, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
		ctx.beginPath(); ctx.ellipse(X + H * 0.05, b.y, H * 0.22, H * 0.05, 0, 0, Math.PI * 2); ctx.fill();
		const shirt = p.role === "gk" ? kit.gk : kit.outfield, shorts = kit.second || "#1f2a36";
		const cd = Math.cos(p.dir);
		if (!p.faceTV || Math.abs(cd) > 0.3) { p.faceTV = cd >= 0 ? 1 : -1; }
		const face = p.faceTV;
		const sw = reduceMotion ? 0 : Math.sin(p.stride || 0) * clamp(p.runAmt || 0, 0, 1);
		// The run cycle: thigh and shin with the knee folding as the leg swings through, a lean into
		// the run and a lift off the ground each stride, arms bent at the elbow working against the
		// legs, far-side limbs a shade darker. Walking is the same action, smaller and upright.
		const a = down ? 0 : clamp(p.runAmt || 0, 0, 1), ph = reduceMotion ? 0 : p.stride || 0;
		const shuf = down ? 0 : p.shuf || 0, ks = down || reduceMotion ? null : kickSwing(p), cel = p.celebA || 0;
		// Leaning into the run, back against a planted cut, upright when shuffling.
		const lean = a * a * 0.26 * (1 - 0.6 * shuf) - (p.plant > 0 ? 0.2 * p.plant / 10 : 0) + (ks ? 0.08 : 0);
		const bob = reduceMotion ? 0 : Math.abs(Math.cos(ph)) * a * H * 0.035;
		if (!reduceMotion && a < 0.15 && !down && !jump) { X += Math.sin(p.idlePh || 0) * H * 0.012; }   // standing: shifting his weight
		const hipX = X, hipY = Y - H * 0.5 - bob + shuf * H * 0.035;
		const shX = hipX + face * Math.sin(lean) * H * 0.32, shY = hipY - Math.cos(lean) * H * 0.32;
		const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[ n >> 16, (n >> 8) & 255, n & 255 ].map(v => Math.round(v * f)).join(",")})`; };
		const Lt = H * 0.26, Ls = H * 0.26, Lu = H * 0.16, Lf = H * 0.15;
		const legPts = i => {
			if (down) { return i ? [ [ X + face * H * 0.3, Y - H * 0.25 ], [ X + face * H * 0.62, Y - H * 0.05 ] ] : [ [ X + face * H * 0.2, Y - H * 0.12 ], [ X + face * H * 0.5, Y ] ]; }
			const f = ph + i * Math.PI;
			let th = jump > 0 ? (i ? -0.25 : 0.2) * jump : (0.06 + a * 0.62 * (1 - 0.45 * shuf)) * Math.sin(f) + (i ? -0.04 : 0.04);
			let kn = jump > 0 ? 0.9 * jump : a * (0.18 + 1.35 * (1 - 0.5 * shuf) * Math.max(0, Math.cos(f))) + (1 - a) * 0.05 + shuf * 0.3;
			if (ks) { if (i === 0) { th = ks.s; kn = ks.bend; } else { th = -0.12; kn = 0.2; } }   // kicking leg, and the one planted beside the ball
			const kx = hipX + face * Math.sin(th) * Lt, ky = hipY + Math.cos(th) * Lt;
			return [ [ kx, ky ], [ kx + face * Math.sin(th - kn) * Ls, ky + Math.cos(th - kn) * Ls ] ];
		};
		const armPts = i => {
			const f = ph + i * Math.PI;
			let ua = jump > 0 ? Math.PI * (0.55 + 0.3 * jump) + (i ? 0.25 : -0.1) : -(0.1 + a * 0.75 * (1 - 0.5 * shuf)) * Math.sin(f) + shuf * 0.25, eb = jump > 0 ? 0.3 : 0.25 + a * 1.25;
			if (ks) { ua = i === 0 ? -0.6 : 0.9; eb = 0.5; }   // arms out for balance as he strikes it
			if (cel > 0) { ua = ua * (1 - cel) + (i ? 1.9 : 1.5) * cel; eb = eb * (1 - cel) + 0.15 * cel; }   // arms out wide
			if (!reduceMotion && a < 0.15 && !jump && !ks && !cel) { ua += Math.sin((p.idlePh || 0) + i) * 0.05; }
			const ex = shX + face * Math.sin(ua) * Lu, ey = shY + Math.cos(ua) * Lu;
			return [ [ ex, ey ], [ ex + face * Math.sin(ua + eb) * Lf, ey + Math.cos(ua + eb) * Lf ] ];
		};
		const drawLeg = (i, dark) => {
			const [ k, f ] = legPts(i);
			ctx.lineWidth = Math.max(1.4, H * 0.1);
			ctx.strokeStyle = dark ? shade(L.skin.length === 7 ? L.skin : "#c68a5e", 0.78) : L.skin;
			ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(k[0], k[1]); ctx.stroke();
			// Shorts over the top of the thigh.
			ctx.strokeStyle = dark ? shade(shorts, 0.72) : shorts; ctx.lineWidth = Math.max(1.8, H * 0.13);
			ctx.beginPath(); ctx.moveTo(hipX, hipY - H * 0.02); ctx.lineTo(hipX + (k[0] - hipX) * 0.45, hipY + (k[1] - hipY) * 0.45); ctx.stroke();
			ctx.lineWidth = Math.max(1.4, H * 0.1);
			// Bare knee, then the sock from just below it down to the boot.
			const sk = [ k[0] + (f[0] - k[0]) * 0.3, k[1] + (f[1] - k[1]) * 0.3 ];
			ctx.strokeStyle = dark ? shade(L.skin.length === 7 ? L.skin : "#c68a5e", 0.78) : L.skin;
			ctx.beginPath(); ctx.moveTo(k[0], k[1]); ctx.lineTo(sk[0], sk[1]); ctx.stroke();
			ctx.strokeStyle = dark ? shade(shirt, 0.72) : shirt;   // socks
			ctx.beginPath(); ctx.moveTo(sk[0], sk[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
			ctx.fillStyle = "#101010";
			ctx.beginPath(); ctx.ellipse(f[0] + face * H * 0.035, f[1], H * 0.065, H * 0.03, 0, 0, Math.PI * 2); ctx.fill();
		};
		const drawArm = (i, dark) => {
			const [ e, hnd ] = armPts(i);
			ctx.lineWidth = Math.max(1.2, H * 0.075);
			ctx.strokeStyle = dark ? shade(shirt, 0.72) : shirt;
			ctx.beginPath(); ctx.moveTo(shX, shY + H * 0.03); ctx.lineTo(e[0], e[1]); ctx.stroke();
			ctx.strokeStyle = dark ? shade(L.skin, 0.78) : L.skin;
			ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(hnd[0], hnd[1]); ctx.stroke();
			if (p.role === "gk") { ctx.fillStyle = dark ? "#b9c97e" : "#e8f7a1"; ctx.beginPath(); ctx.arc(hnd[0], hnd[1], Math.max(1.3, H * 0.055), 0, Math.PI * 2); ctx.fill(); }   // gloves
		};
		ctx.lineCap = "round"; ctx.lineJoin = "round";
		drawArm(1, true);
		drawLeg(1, true);
		// Shorts, then the shirt as a body that leans with the run.
		ctx.strokeStyle = shorts; ctx.lineWidth = Math.max(2, H * 0.2);
		ctx.beginPath(); ctx.moveTo(hipX, hipY + H * 0.02); ctx.lineTo(hipX + face * Math.sin(lean) * H * 0.06, hipY - H * 0.05); ctx.stroke();
		drawLeg(0, false);
		{
			// The torso: narrower at the waist than the chest, lit on the side toward the floodlights.
			const wx = hipX + face * Math.sin(lean) * H * 0.06, wy = hipY - H * 0.05, tx = shX, ty = shY + H * 0.04;
			const dx = tx - wx, dy = ty - wy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
			const w0 = H * 0.1, w1 = H * 0.135;
			ctx.fillStyle = shirt;
			ctx.beginPath();
			ctx.moveTo(wx + nx * w0, wy + ny * w0); ctx.lineTo(tx + nx * w1, ty + ny * w1);
			ctx.bezierCurveTo(tx + nx * w1 + dx / dl * H * 0.07, ty + ny * w1 + dy / dl * H * 0.07, tx - nx * w1 + dx / dl * H * 0.07, ty - ny * w1 + dy / dl * H * 0.07, tx - nx * w1, ty - ny * w1);
			ctx.lineTo(wx - nx * w0, wy - ny * w0); ctx.closePath(); ctx.fill();
			ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
			const bs = -face;   // his back is in the shade
			ctx.beginPath();
			ctx.moveTo(wx, wy); ctx.lineTo(tx, ty);
			ctx.lineTo(tx + nx * w1 * bs, ty + ny * w1 * bs); ctx.lineTo(wx + nx * w0 * bs, wy + ny * w0 * bs); ctx.closePath();
			ctx.fill();
		}
		if (kit.pattern === "stripes" && p.role !== "gk") {
			ctx.strokeStyle = shorts; ctx.lineWidth = Math.max(0.8, H * 0.035);
			ctx.beginPath(); ctx.moveTo(hipX + face * Math.sin(lean) * H * 0.06, hipY - H * 0.05); ctx.lineTo(shX, shY + H * 0.04); ctx.stroke();
		}
		drawArm(0, false);
		// Head, carried forward with the lean.
		const hx = shX + face * Math.sin(lean) * H * 0.09, hy = shY - H * 0.1;
		ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(hx, hy, H * 0.085, 0, Math.PI * 2); ctx.fill();
		if (!L.shaved) {
			ctx.fillStyle = L.hair;
			const hr = H * (L.style === "curly" ? 0.1 : L.style === "buzz" ? 0.086 : 0.088);
			ctx.beginPath(); ctx.arc(hx - face * H * 0.01, hy - H * (L.style === "buzz" ? 0.03 : 0.02), hr, Math.PI, 0); ctx.fill();
			if (L.style === "long") { ctx.fillRect(hx - face * H * 0.09 - H * 0.03, hy - H * 0.02, H * 0.06, H * 0.12); }
		}
		const sh = shY;
		ctx.lineCap = "butt";
		const top = sh - H * 0.24;
		if (p.yellow) { ctx.fillStyle = "#ffd21f"; ctx.fillRect(X + H * 0.18, top, 5, 7); }
		if (p.injured) { ctx.fillStyle = "#ffffff"; ctx.fillRect(X - H * 0.18 - 7, top, 7, 7); ctx.fillStyle = "#d8343f"; ctx.fillRect(X - H * 0.18 - 4.5, top + 1, 2, 5); ctx.fillRect(X - H * 0.18 - 6, top + 2.5, 5, 2); }
		else if (p.team === 0 && p.role !== "gk" && staOf(p) < TIRED_STA) { drawTired(X - H * 0.18 - 12, top); }
		// Sprinting: speed streaks trailing him.
		if ((p.sprintAmt || 0) > 0.45 && Math.hypot(p.vx, p.vy) > 1.2 && !reduceMotion) {
			const back = p.vx >= 0 ? -1 : 1, al = 0.25 + 0.35 * p.sprintAmt;
			ctx.strokeStyle = `rgba(255, 255, 255, ${al})`; ctx.lineWidth = Math.max(1.2, 2 * k);
			ctx.beginPath();
			for (const f of [ 0.35, 0.55, 0.75 ]) {
				const sy = b.y - H * f, sx = X + back * H * 0.3;
				ctx.moveTo(sx, sy); ctx.lineTo(sx + back * H * (0.35 + 0.15 * f), sy);
			}
			ctx.stroke();
		}
		// Your man: the marker and his name.
		if (p.team === 0 && players.indexOf(p) === ctrl && state !== "intro") {
			drawSprintBar(p, X, b.y + Math.max(4, 5 * k), Math.max(22, 30 * k));
			ctx.fillStyle = "#f2b52e";
			ctx.beginPath(); ctx.moveTo(X - 7, top - 12); ctx.lineTo(X + 7, top - 12); ctx.lineTo(X, top - 3); ctx.closePath(); ctx.fill();
			if (p.name) {
				ctx.font = "700 12px Barlow, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
				const label = `${p.num} ${p.name}`, w = ctx.measureText(label).width;
				ctx.fillStyle = "rgba(8, 13, 11, 0.8)"; ctx.fillRect(X - w / 2 - 5, top - 29, w + 10, 16);
				ctx.fillStyle = "#eef6ea"; ctx.fillText(label, X, top - 15);
			}
		}
	}
	function drawBallTV () {
		const q = tvProj(ball.x, ball.y, Math.max(0, ball.z) * Z_W + 3.2);
		if (!q) { return; }
		const r = Math.max(2.3, 3.4 * q.k);
		ctx.fillStyle = "#ffffff";
		ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = "rgba(0, 0, 0, 0.55)"; ctx.lineWidth = 1; ctx.stroke();
		ctx.fillStyle = "#1a1a1a";
		ctx.beginPath(); ctx.arc(q.x - r * 0.25, q.y - r * 0.2, r * 0.32, 0, Math.PI * 2); ctx.fill();
	}
	const CAM_LABEL = { top: "Camera: overhead", tv: "Camera: TV", "3d": "Camera: 3D" };
	const CAM_NAME = { top: "Overhead camera", tv: "TV camera", "3d": "3D camera" };
	const nextCam = () => (camMode === "top" ? "tv" : camMode === "tv" && webglOK ? "3d" : "top");
	// chosen: the player picked this camera (button or C), so remember it. Defaults and the
	// fallback when 3D cannot be shown are not saved, so 3D comes back once it can.
	function setCam (m, chosen = false) {
		if (m === "3d" && !webglOK) { m = wideScreen ? "tv" : "top"; }
		if (!CAM_LABEL[m]) { m = "top"; }
		camMode = m;
		if (chosen) { store.set(CAM_KEY, m); }
		const b = $("camBtn");
		b.textContent = CAM_LABEL[m];
		b.title = webglOK ? "Switch camera (C): overhead, TV or 3D" : "Switch camera (C): overhead or TV";
		b.setAttribute("aria-pressed", String(m !== "top"));
		show3D(m === "3d");
	}

