	/* ---------- the touchline cam ----------
	   A broadcast cutaway in the corner of the screen while play goes on: a foul, a card or a near
	   miss and the director cuts to the touchline for a couple of seconds. The manager steps up in
	   his technical area and lets the referee have it (or holds his head), the bench behind him
	   rises or protests, and the caption says what he is shouting. Drawn only while it is showing;
	   never in bulk simulation, the tutorial, the corner shootout, or on a phone. */
	const TLC_MS = 2600, TLC_GAP = 7000;
	let tlc = null, tlcLast = -1e9;
	const pickOf = (list, seed) => list[Math.abs(Math.floor(seed)) % list.length];
	function benchReact (kind, o = {}) {
		staffReact(kind, o);
		if (bulkSim || mode === "tutorial" || mode === "corners" || shoot || coarse || state === "intro") { return; }
		const now = performance.now();
		if (now - tlcLast < TLC_GAP && !o.card) { return; }   // a run of fouls doesn't keep cutting away; a card always does
		const seed = Math.floor(now / 7);
		let team, pose, line;
		if (kind === "foul") {
			team = o.fouled;
			pose = o.red ? "furious" : "shout";
			line = pickOf(o.red ? [ "Off! Get him off, ref!", "That's a red! A RED!" ] : o.card ? [ "Book him, ref!", "That's a card, surely!", "Every time! Book him!" ] : [ "Referee!", "That's a foul, ref!", "Come on, ref! Free kick!", "He's been clattered, ref!" ], seed);
		} else if (kind === "near") {
			team = o.team; pose = "anguish";
			line = pickOf([ "So close!", "How's that not in?!", "Unlucky! Keep going!", "Ohh! Inches!" ], seed);
		} else { return; }
		if (team !== 0 && team !== 1) { return; }
		tlc = { t0: now, team, pose, line, seed, fouler: kind === "foul" ? o.offender : null };
		tlcLast = now;
		shoutSfx(pose);
	}
	// A man's shout, synthesised: two voiced syllables through a mouth-like filter, behind the Sound setting.
	function shoutSfx (pose) {
		if (!soundOn || !audio) { return; }
		try {
			const t = audio.currentTime, hi = pose === "furious" ? 1.15 : pose === "anguish" ? 0.85 : 1;
			voices(t, 1, 220 * hi, 185 * hi, 0.32, 0.05, 1500, 0.35);
			voices(t + 0.36, 1, 250 * hi, 160 * hi, 0.5, 0.05, 1500, 0.35);
		} catch (e) { /* audio is a nicety */ }
	}
	function tlcCapsule (x1, y1, r1, x2, y2, r2) {
		const a = Math.atan2(y2 - y1, x2 - x1);
		ctx.beginPath(); ctx.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2); ctx.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2); ctx.closePath(); ctx.fill();
	}
	const tlcHash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h >>> 0) / 4294967296; };
	function drawTouchlineCam () {
		if (!tlc) { return; }
		const el = performance.now() - tlc.t0;
		if (el > TLC_MS || state === "intro" || state === "full") { tlc = null; return; }
		const w = 300, h = 170, x0 = SW - w - 16, y0 = SH - h - 16 - tickerUp();
		const fadeIn = Math.min(1, el / 180), fadeOut = Math.min(1, (TLC_MS - el) / 260), a = Math.min(fadeIn, fadeOut);
		const t = reduceMotion ? 0.6 : el / 1000, mo = reduceMotion ? 0 : 1;
		const kit = KITS[tlc.team] || KITS[0], col = kit.outfield, coat = tlc.team === 0 ? "#1d2330" : "#33252a";
		ctx.save();
		ctx.globalAlpha = a;
		ctx.translate(x0 + (1 - fadeIn) * 24, y0);
		// The frame and a soft drop shadow, like a broadcast box.
		ctx.fillStyle = "rgba(0, 0, 0, 0.45)"; ctx.fillRect(4, 5, w, h);
		ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
		// The stand behind: rows of fans in the home colours, out of focus.
		const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
		sky.addColorStop(0, "#0b1016"); sky.addColorStop(1, "#1a2028");
		ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.55);
		const homeCol = (KITS[homeSide] || KITS[0]).outfield;
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 30; c++) {
				const n = r * 31 + c, hx = c * 10.5 + (r % 2) * 5 + tlcHash(n) * 3, hy = 8 + r * 11 + (mo ? Math.sin(t * 6 + n) * (tlc.pose === "anguish" ? 1.4 : 0.6) : 0);
				ctx.fillStyle = tlcHash(n + 7) < 0.62 ? homeCol : tlcHash(n + 9) < 0.5 ? "#c9ccd2" : "#3a3f48";
				ctx.globalAlpha = a * 0.55;
				ctx.fillRect(hx, hy + 3, 6, 6);
				ctx.fillStyle = [ "#e0ac86", "#9c6a44", "#f1c9a5", "#6b4630" ][Math.floor(tlcHash(n + 3) * 4)];
				ctx.beginPath(); ctx.arc(hx + 3, hy, 2.4, 0, Math.PI * 2); ctx.fill();
			}
		}
		ctx.globalAlpha = a;
		// The advertising board and the grass of the technical area.
		ctx.fillStyle = "#0e1418"; ctx.fillRect(0, h * 0.56, w, 14);
		ctx.fillStyle = col; ctx.fillRect(0, h * 0.56 + 5, w, 3);
		const g = ctx.createLinearGradient(0, h * 0.64, 0, h);
		g.addColorStop(0, "#2d7a46"); g.addColorStop(1, "#1f5a33");
		ctx.fillStyle = g; ctx.fillRect(0, h * 0.64, w, h * 0.36);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 1.5; ctx.setLineDash([ 6, 4 ]);
		ctx.beginPath(); ctx.moveTo(0, h * 0.9); ctx.lineTo(w, h * 0.9); ctx.stroke(); ctx.setLineDash([]);   // the technical area's line
		// The dugout: a dark bay under a perspex roof, the substitutes in tracksuit tops on the bench.
		const dx0 = 8, dw = 150, dy0 = h * 0.4, dh = h * 0.3;
		ctx.fillStyle = "#11171c"; ctx.fillRect(dx0, dy0, dw, dh);
		ctx.fillStyle = "rgba(160, 200, 225, 0.28)"; ctx.fillRect(dx0 - 4, dy0 - 6, dw + 8, 7);
		ctx.fillStyle = "#2b3138"; ctx.fillRect(dx0, dy0 + dh * 0.72, dw, 4);   // the bench seat
		const rise = tlc.pose === "anguish" || tlc.pose === "furious" ? Math.min(1, el / 400) : tlc.pose === "shout" ? Math.min(0.5, el / 600) : 0;
		for (let i = 0; i < 5; i++) {
			const sx = dx0 + 16 + i * 29, up = rise * (0.6 + 0.4 * tlcHash(i + tlc.seed)) * 11, bob = mo ? Math.sin(t * 5 + i * 1.7) * 0.8 : 0;
			const base = dy0 + dh * 0.72 - up + bob;
			ctx.fillStyle = shadeHex(col, 0.55);
			tlcCapsule(sx, base, 6.5, sx, base - 13, 7.5);
			if (rise > 0.3 && tlc.pose !== "shout") {   // arms up or hands on heads
				ctx.fillStyle = shadeHex(col, 0.55);
				const arm = tlc.pose === "anguish" ? -0.4 : -1.1;
				for (const s of [ -1, 1 ]) { tlcCapsule(sx + s * 6, base - 11, 2.2, sx + s * (6 + Math.sin(arm) * 7), base - 11 - Math.cos(arm) * 13, 2); }
			}
			ctx.fillStyle = [ "#e0ac86", "#9c6a44", "#f1c9a5", "#6b4630", "#c68a5e" ][(i + tlc.team) % 5];
			ctx.beginPath(); ctx.arc(sx, base - 19, 5, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#1a1310"; ctx.beginPath(); ctx.arc(sx, base - 21, 5, Math.PI, 0); ctx.fill();
		}
		// A coach at the end of the dugout, in the club tracksuit.
		{
			const cx = dx0 + dw + 14, cy = h * 0.84;
			ctx.fillStyle = "#20252c"; tlcCapsule(cx - 3, cy, 3, cx - 3, cy - 22, 3); tlcCapsule(cx + 3, cy, 3, cx + 3, cy - 22, 3);
			ctx.fillStyle = shadeHex(col, 0.6); tlcCapsule(cx, cy - 22, 7, cx, cy - 40, 8);
			const pt = tlc.pose === "shout" || tlc.pose === "furious" ? 1 : 0;   // pointing at the incident
			ctx.fillStyle = shadeHex(col, 0.6); tlcCapsule(cx + 6, cy - 37, 2.4, cx + 6 + 14 * pt + 4, cy - 37 - 4 * pt + 12 * (1 - pt), 2.2);
			ctx.fillStyle = "#c68a5e"; ctx.beginPath(); ctx.arc(cx, cy - 47, 5.5, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#2b2018"; ctx.beginPath(); ctx.arc(cx, cy - 49, 5.6, Math.PI, 0); ctx.fill();
		}
		// The manager, nearest the camera in his technical area.
		{
			const step = Math.min(1, el / 450) * 10 * mo;
			const mx = 206 + step, gy = h * 0.97;
			const lean = tlc.pose === "anguish" ? -0.05 : 0.12 + (mo ? Math.sin(t * 8) * 0.04 : 0);
			const H = 112, hip = gy - H * 0.47, shY = hip - H * 0.3, shX = mx + Math.sin(lean) * H * 0.3;
			// legs, planted apart; shoes
			ctx.fillStyle = "#151a20";
			tlcCapsule(mx - 6, hip, 6.5, mx - 11, gy - 6, 5); tlcCapsule(mx + 6, hip, 6.5, mx + 12, gy - 6, 5);
			ctx.fillStyle = "#0b0b0b";
			ctx.beginPath(); ctx.ellipse(mx - 13, gy - 3, 8, 3.6, 0, 0, Math.PI * 2); ctx.ellipse(mx + 15, gy - 3, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
			// the long coat
			ctx.fillStyle = coat;
			ctx.beginPath();
			ctx.moveTo(mx - 17, hip + 16); ctx.lineTo(shX - 19, shY + 4); ctx.quadraticCurveTo(shX, shY - 8, shX + 19, shY + 4); ctx.lineTo(mx + 17, hip + 16); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(shX, shY + 2); ctx.lineTo(mx, hip + 14); ctx.stroke();   // the buttons' edge
			// arms, by pose
			const pump = mo ? Math.sin(t * 9) : 0;
			const arms = tlc.pose === "anguish" ? [ [ -2.5, -1.67 ], [ 2.5, 1.67 ] ]   // elbows out, hands on top of his head
				: tlc.pose === "furious" ? [ [ -2.4 - pump * 0.25, -0.4 ], [ 2.4 + pump * 0.25, 0.4 ] ]   // both up, pumping
				: [ [ -1.35 - pump * 0.18, -0.35 ], [ 1.35 + pump * 0.18, 0.35 ] ];   // out wide, palms open: "Referee!"
			for (let i = 0; i < 2; i++) {
				const s = i ? 1 : -1, ax = shX + s * 15, ay = shY + 4, [ u, f ] = arms[i];
				const ex = ax + Math.sin(u) * 22, ey = ay + Math.cos(u) * 22, hx2 = ex + Math.sin(u + f) * 20, hy2 = ey + Math.cos(u + f) * 20;
				ctx.fillStyle = coat; tlcCapsule(ax, ay, 6, ex, ey, 5); tlcCapsule(ex, ey, 5, hx2, hy2, 4.2);
				ctx.fillStyle = "#d9a07a"; ctx.beginPath(); ctx.arc(hx2, hy2, 4.4, 0, Math.PI * 2); ctx.fill();
			}
			// the club scarf
			ctx.fillStyle = col; tlcCapsule(shX - 9, shY + 2, 4, shX + 9, shY + 2, 4); tlcCapsule(shX + 5, shY + 3, 3.2, shX + 7, shY + 30, 3.2);
			ctx.fillStyle = shadeHex(col, 0.6); ctx.fillRect(shX + 4, shY + 22, 6, 3);
			// head: jaw thrust forward when he shouts, mouth open
			const hx = shX + Math.sin(lean) * 8 + (tlc.pose === "anguish" ? 0 : 2), hy = shY - 15 + (mo ? Math.abs(pump) * -1.5 : 0);
			ctx.fillStyle = "#d9a07a"; ctx.beginPath(); ctx.ellipse(hx, hy, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "rgba(0, 0, 0, 0.14)"; ctx.beginPath(); ctx.ellipse(hx - 4, hy + 2, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#3a3a3e"; ctx.beginPath(); ctx.ellipse(hx, hy - 7, 11.5, 7.5, 0, Math.PI, 0); ctx.fill();   // grey, as managers' hair is
			ctx.fillStyle = "#20140e";
			ctx.fillRect(hx - 6, hy - 3, 4, 2); ctx.fillRect(hx + 2, hy - 3, 4, 2);   // brows, furrowed
			const open = tlc.pose === "anguish" ? 2.5 : 3.5 + (mo ? Math.abs(pump) * 3 : 2);
			ctx.fillStyle = "#3b1210"; ctx.beginPath(); ctx.ellipse(hx + 0.5, hy + 6, 4, open, 0, 0, Math.PI * 2); ctx.fill();
		}
		// What he's shouting, in a bubble by his head.
		ctx.font = "800 13px Barlow, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		const tw = Math.min(w - 20, ctx.measureText(tlc.line).width + 16), bx = Math.max(10 + tw / 2, Math.min(w - 10 - tw / 2, 178)), by = 20 + (mo ? Math.sin(t * 9) * 1.2 : 0);
		ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
		ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - tw / 2, by - 11, tw, 22, 6) : ctx.rect(bx - tw / 2, by - 11, tw, 22); ctx.fill();
		ctx.beginPath(); ctx.moveTo(bx + 10, by + 10); ctx.lineTo(bx + 22, by + 24); ctx.lineTo(bx + 20, by + 10); ctx.closePath(); ctx.fill();
		ctx.fillStyle = "#111"; ctx.fillText(tlc.line, bx, by + 1, tw - 10);
		// The lower third: who this is.
		const name = tlc.team === 0 ? "YOUR MANAGER" : `${(opp && opp.short ? opp.short : "THEIR").toUpperCase()} MANAGER`;
		ctx.fillStyle = "rgba(8, 13, 11, 0.86)"; ctx.fillRect(0, h - 20, w, 20);
		ctx.fillStyle = col; ctx.fillRect(0, h - 20, 5, 20);
		ctx.font = "700 11px Barlow, Arial, sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#eef6ea";
		ctx.fillText(`TOUCHLINE CAM · ${name}`, 12, h - 9.5);
		ctx.restore();
		ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "rgba(238, 246, 234, 0.5)"; ctx.lineWidth = 1; ctx.strokeRect(x0 + (1 - fadeIn) * 24 + 0.5, y0 + 0.5, w - 1, h - 1); ctx.restore();
	}
	function shadeHex (hex, f) {
		if (typeof hex !== "string" || hex[0] !== "#" || hex.length !== 7) { return hex; }
		const n = parseInt(hex.slice(1), 16);
		return `rgb(${[ n >> 16, (n >> 8) & 255, n & 255 ].map(v => Math.round(v * f)).join(",")})`;
	}

	/* ---------- the managers and benches in 3D ----------
	   Each manager stands in his technical area in front of his dugout, following play and pointing,
	   clapping, protesting, holding his head after a miss, arms up for a goal. The substitutes (in
	   bibs) and a coach (in a tracksuit) sit on the bench under the canopy and jump up for a goal.
	   The touchline cutaway shows the same manager, in the same coat. Home side in the left dugout. */
	const STAFF_COAT = [ "#1d2330", "#33252a" ];
	const staff3 = [ 0, 1 ].map(t => ({
		g: "", t: 0, up: 0, nextPoint: 3000 + t * 2500,
		mgr: { x: 0, y: 0, vx: 0, vy: 0, dir: -Math.PI / 2, stride: 0, runAmt: 0, idlePh: t * 3, role: "staff", team: t },
		bench: [ 0, 1, 2, 3 ].map(i => ({ x: 0, y: 0, vx: 0, vy: 0, dir: -Math.PI / 2, stride: 0, runAmt: 0, idlePh: i * 1.7 + t, role: "staff", team: t, hop: Math.random() * 6 })),
		look: [ 0, 1, 2, 3, 4 ].map(i => ({ skin: [ "#e0ac86", "#9c6a44", "#f1c9a5", "#6b4630", "#c98e64" ][(i + t * 2) % 5], hair: i === 0 ? (t ? "#7d7d7d" : "#2a1d14") : [ "#1b1410", "#3a2416", "#0e0b09", "#6a4a2a" ][i % 4], style: [ "short", "buzz", "shaved", "short", "buzz" ][(i + t) % 5], face: (i * 3 + t) % 8 }))
	}));
	// A gesture for a while: "up" (arms raised), "head" (hands on head), "clap", "protest", "point".
	function staffReact (kind, o = {}) {
		const now = performance.now(), set = (t, g, ms) => { if (t === 0 || t === 1) { staff3[t].g = g; staff3[t].t = now + ms; } };
		if (kind === "goal") {
			set(o.team, o.muted ? "clap" : "up", 4200); set(1 - o.team, o.muted ? "clap" : "head", 3200); if (!o.muted) { staff3[o.team].up = now + 4200; }
			// Now and then the manager loses it, Mourinho at Old Trafford: out of his area and away down
			// the touchline at full tilt, fists going, sliding on his knees at the end of it.
			if ((o.force || Math.random() < (o.mgr ?? (o.wild ? 0.85 : o.muted ? 0 : 0.3))) && !reduceMotion && !bulkSim) { staff3[o.team].sprint = { t0: now, dir: 0 }; staff3[o.team].g = ""; }
			// A late winner or equaliser: the substitutes and the coach come off the bench and race down the touchline too.
			if (o.wild && (o.team === 0 || o.team === 1) && !reduceMotion && !bulkSim) { staff3[o.team].runOn = { t0: now, dir: 0 }; }
		}
		else if (kind === "near") { set(o.team, Math.random() < 0.6 ? "head" : "clap", 2200); }
		else if (kind === "foul") { set(o.fouled, "protest", 2400); }
	}
	function staffKit (t, kind) {
		const kit = KITS[t] || KITS[0];
		if (kind === "mgr") { return { shirt: STAFF_COAT[t], shorts: STAFF_COAT[t], socks: "#121418", second: "#e9e9e9", pattern: 0, ink: STAFF_COAT[t], gloves: null, sleeves: true, boots: "#121418", ring: null }; }
		if (kind === "coach") { const c = kit.second && kit.second !== kit.outfield ? kit.second : "#1f2a36"; return { shirt: c, shorts: c, socks: c, second: kit.outfield, pattern: 0, ink: kit.outfield, gloves: null, sleeves: true, boots: "#15181a", ring: null }; }
		const bib = t === 0 ? "#d6f03c" : "#ff7a1f";   // the substitutes' bibs over the kit
		return { shirt: bib, shorts: kit.second || "#1f2a36", socks: kit.outfield, second: bib, pattern: 0, ink: bib, gloves: null, sleeves: true, boots: BOOTS3[t % BOOTS3.length], ring: null };
	}
	// Substitutes warming up: three a side in bibs on the strip between the far touchline and the boards, the
	// home side's by the left-hand corner and the visitors' by the right, where the TV camera sees them. They jog
	// up and down the strip, stop at each end for a moment facing the play, and go back.
	const warm3 = [ 0, 1 ].map(t => [ 0, 1, 2 ].map(i => ({ x: 0, y: 0, vx: 0, vy: 0, dir: 0, stride: 0, runAmt: 0, idlePh: i * 2.3 + t, role: "staff", team: t, to: i % 2, wait: i * 0.9, on: false })));
	function warmups3D () {
		const F = G3.fig;
		if (!F || !ball || bulkSim || !(state === "play" || state === "paused" || state === "goal")) { return; }
		const dt = state === "paused" ? 0 : frameDt / 16.7;
		for (let t = 0; t < 2; t++) {
			const left = t === homeSide, xA = left ? 50 : FW - 230, xB = left ? 230 : FW - 50, sf = staff3[t];
			warm3[t].forEach((q, i) => {
				if (!q.on) { q.on = true; q.x = xA + (xB - xA) * (0.2 + 0.3 * i); q.y = -9; }
				const tx = q.to ? xB - i * 14 : xA + i * 14, d = tx - q.x;
				if (q.wait > 0) { q.wait -= dt / 60; q.vx *= Math.pow(0.85, dt); }
				else if (Math.abs(d) < 3) { q.to = 1 - q.to; q.wait = 1.4 + Math.random() * 1.6; }
				else { q.vx += (Math.sign(d) * Math.min(1.25, Math.abs(d) / 12) - q.vx) * Math.min(1, 0.08 * dt); }
				q.x += q.vx * dt;
				const spd = Math.abs(q.vx);
				q.runAmt += (Math.min(1, spd / 2.6) - q.runAmt) * Math.min(1, 0.1 * dt);
				q.stride += Math.PI * 2 * (0.95 + 0.5 * spd) / 60 * clamp(spd / 0.4, 0, 1) * dt; q.idlePh += 0.028 * dt;
				q.dir = spd > 0.3 ? (q.vx > 0 ? 0 : Math.PI) : Math.PI / 2;   // stopped, he watches the game
				if (F.n >= MAXF3) { return; }
				const r = F.rigs[F.n];
				pose3D(r, q, q.x, q.y, q.dir, 0, 0);
				commitFigure3D(r, sf.look[(i + 2) % 5], staffKit(t, "sub"), null);
			});
		}
	}
	// The manager mid-run, for the broadcast to cut to: his spot, while the run is on.
	function bossRun3D () {
		for (const sf of staff3) { if (sf.sprint) { const se = (performance.now() - sf.sprint.t0) / 1000; if (se > 0.4 && se < 4.6) { return sf.mgr; } } }
		return null;
	}
	// The manager's gesture, on a figure already posed by pose3D: g is "up", "head", "clap", "protest",
	// "point" or "" (hands behind his back); sprinting: the Mourinho run (kn: on his knees at the end of it).
	// Signs measured on the rig: +z on a shoulder swings the arm forward; OUT3 on x takes a hanging arm out
	// to the side (and, past horizontal, raises it out wide); -z on the spine leans forward; +z on the neck
	// tips the head back. Each gesture is checked numerically in tests/move.mjs.
	function staffGesture3D (r, g, ph, sprinting, kn) {
		const rm = reduceMotion, O = OUT3;
		if (sprinting) {
			// Fists pumping in front of him as he runs; on his knees at the end, both arms flung up and out.
			const pump = rm ? 0.5 : Math.abs(Math.sin(ph * 9));
			for (let i = 0; i < 2; i++) {
				const k = i ? pump : 1 - pump;
				r.sh[i].rotation.z = lerp3(0.5 + 1.0 * k, 0.25, kn); r.sh[i].rotation.x = O(i) * lerp3(0.25, 2.45, kn); r.el[i].rotation.z = lerp3(1.75 - 0.5 * k, 0.3, kn);
			}
			r.neck.rotation.z = 0.4; r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.35, kn);   // roaring, head back; arched back on his knees
		} else if (g === "up") { const b = rm ? 0 : Math.sin(ph * 6) * 0.15; for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = 0.25; r.sh[i].rotation.x = O(i) * (2.45 + b); r.el[i].rotation.z = 0.25; } r.neck.rotation.z = 0.35; }   // arms up and out, looking up
		else if (g === "head") { for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = 2.3; r.sh[i].rotation.x = O(i) * 0.8; r.el[i].rotation.z = 1.9; } r.spine.rotation.z = -0.1; r.neck.rotation.z = 0.25; }   // hands on his head, as the players do it
		else if (g === "clap") { const c = rm ? 0.5 : Math.abs(Math.sin(ph * 14)); for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = 0.75; r.sh[i].rotation.x = -O(i) * (0.5 + 0.12 * c); r.el[i].rotation.z = 1.3; r.sh[i].rotation.y = -O(i) * 0.5; } }   // hands meeting in front of his chest
		else if (g === "protest") { const c = rm ? 0 : Math.sin(ph * 5) * 0.15; for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = 0.55 + c; r.sh[i].rotation.x = O(i) * 0.75; r.el[i].rotation.z = 0.7; } r.neck.rotation.z = 0.15; }   // arms out in front, palms up: "what was that?"
		else if (g === "point") { r.sh[1].rotation.z = 1.5; r.sh[1].rotation.x = O(1) * 0.15; r.el[1].rotation.z = 0.05; r.sh[0].rotation.z = 0.1; r.sh[0].rotation.x = O(0) * 0.12; r.el[0].rotation.z = 0.6; }   // pointing out to the pitch
		else { for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = -0.6; r.sh[i].rotation.x = -O(i) * 0.3; r.el[i].rotation.z = 0.8; r.sh[i].rotation.y = O(i) * 0.4; } }   // hands behind his back
	}
	// A substitute on the bench: sitting (st 0, leaning forward, forearms on his thighs), or up on his feet
	// with his arms up and out (st 1); hop: a jump for joy.
	function benchPose3D (r, st, ph, hop, i) {
		const rm = reduceMotion, sit = 1 - st;
		r.hips.position.y = 15.6 * st + 9.2 * sit + hop;
		for (let k = 0; k < 2; k++) {
			r.hip[k].rotation.z = 1.5 * sit; r.kn[k].rotation.z = -1.5 * sit - 0.1; r.an[k].rotation.z = 0.1 * sit;
			r.sh[k].rotation.z = 0.45 * sit + 0.25 * st; r.sh[k].rotation.x = OUT3(k) * (0.12 * sit + 2.45 * st); r.el[k].rotation.z = 0.9 * sit + 0.25 * st;
		}
		r.spine.rotation.z = -0.18 * sit; r.neck.rotation.z = 0.12 * sit + (rm ? 0 : Math.sin(ph * 0.4) * 0.05);
		r.head.rotation.y = rm ? 0 : Math.sin(ph * 0.3 + i) * 0.3 * sit;
	}
	function staff3D (WX) {
		const F = G3.fig;
		if (!F || !ball || state === "intro" || bulkSim) { return; }
		const now = performance.now(), rm = reduceMotion, dw = 190 * Math.sqrt(S), dt = frameDt / 16.7;
		const bx = WX(ball.x), by = ball.y;
		for (let t = 0; t < 2; t++) {
			const sf = staff3[t], left = t === homeSide, cx = left ? FW / 2 - dw * 0.62 - 20 : FW / 2 + dw * 0.62 + 20;
			if (sf.g && now > sf.t) { sf.g = ""; }
			if (!sf.g && now > sf.nextPoint && state === "play") { sf.g = Math.random() < 0.7 ? "point" : "clap"; sf.t = now + 1500; sf.nextPoint = now + 5000 + Math.random() * 5000; }
			// The manager: paces his technical area a little with the play, and watches the ball.
			const m = sf.mgr;
			if (!m.x) { m.x = cx; m.y = FH + 13; }
			const sp = sf.sprint, se = sp ? (now - sp.t0) / 1000 : 0;
			if (sp && (se > 9 || state === "play" && se > 2 && !(now < sf.up))) { sf.sprint = null; }
			if (sf.sprint) {
				// The run: away from the dugout towards the end his side scored at, on the touchline itself.
				if (!sp.dir) { sp.dir = bx > cx ? 1 : -1; }
				const run = se < 3.4, slide = se >= 3.4 && se < 4.4;
				const want = run ? sp.dir * Math.min(2.7, se * 4) : 0;
				m.vx += (want - m.vx) * Math.min(1, (run ? 0.16 : slide ? 0.05 : 0.2) * dt);
				m.x = clamp(m.x + m.vx * dt, -40, FW + 40);
				m.y += ((run || slide ? FH + 3 : FH + 13) - m.y) * Math.min(1, 0.08 * dt);   // over the line on to the grass
				m.kneel = slide ? Math.min(1, (m.kneel || 0) + 0.12 * dt) : Math.max(0, (m.kneel || 0) - 0.05 * dt);
				m.celebA = run || slide ? 1 : Math.max(0, (m.celebA || 0) - 0.02 * dt);
			} else {
				const tx = cx + clamp((bx - cx) * 0.06, -dw * 0.3, dw * 0.3), d = tx - m.x, far = Math.abs(d) > dw * 0.6;
				m.vx += ((Math.abs(d) > 6 ? Math.sign(d) * Math.min(far ? 1.6 : 0.9, Math.abs(d) / 25) : 0) - m.vx) * Math.min(1, 0.06 * dt);   // jogs back sheepishly after a run
				m.x += m.vx * dt; m.y += (FH + 13 - m.y) * Math.min(1, 0.06 * dt);
				m.kneel = Math.max(0, (m.kneel || 0) - 0.05 * dt); m.celebA = Math.max(0, (m.celebA || 0) - 0.05 * dt);
			}
			m.runAmt += (Math.min(1, Math.abs(m.vx) / 2.6) - m.runAmt) * Math.min(1, 0.1 * dt);
			m.stride += Math.PI * 2 * (0.95 + 0.5 * Math.abs(m.vx)) / 60 * clamp(Math.abs(m.vx) / 0.4, 0, 1) * dt; m.idlePh += 0.028 * dt;
			m.dir = sf.sprint && Math.abs(m.vx) > 0.4 ? (m.vx > 0 ? 0 : Math.PI) : Math.atan2(by - m.y, bx - m.x);
			if (F.n < MAXF3) {
				const r = F.rigs[F.n];
				pose3D(r, m, m.x, m.y, m.dir, 0, 0);
				staffGesture3D(r, sf.g, rm ? 0 : m.idlePh, sf.sprint && (m.celebA || 0) > 0.3, m.kneel || 0);
				commitFigure3D(r, sf.look[0], staffKit(t, "mgr"), null);
			}
			// The bench running on: out of the dugout, over the line and away down the touchline towards the
			// end the goal went in at, arms up, then back to their seats.
			const ro = sf.runOn, re = ro ? (now - ro.t0) / 1000 : -1;
			if (ro && re > 7.5) { sf.runOn = null; }
			sf.bench.forEach((q, i) => {
				const hx = cx + (i - 1.5) * Math.min(26, dw / 5), hy = FH + F_SIDE3 + 5;
				if (!sf.runOn) { q.x = hx; q.y = hy; q.vx = q.vy = 0; q.celebA = 0; q.running = false; return; }
				if (!ro.dir) { ro.dir = bx > cx ? 1 : -1; }
				const out = re < 3.8, tx = out ? hx + ro.dir * (70 + 28 * i) * Math.min(1, re / 2.4) : hx, ty = out ? FH - 8 - 7 * i : hy;
				const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy), v = d > 2 ? Math.min(out ? 2.7 : 1.6, d / 8) : 0;
				q.vx += ((d ? dx / d * v : 0) - q.vx) * Math.min(1, 0.18 * dt); q.vy += ((d ? dy / d * v : 0) - q.vy) * Math.min(1, 0.18 * dt);
				q.x += q.vx * dt; q.y += q.vy * dt;
				q.runAmt = (q.runAmt || 0) + (Math.min(1, Math.hypot(q.vx, q.vy) / 2.6) - (q.runAmt || 0)) * Math.min(1, 0.12 * dt);
				q.stride = (q.stride || 0) + Math.PI * 2 * (0.95 + 0.5 * Math.hypot(q.vx, q.vy)) / 60 * clamp(Math.hypot(q.vx, q.vy) / 0.4, 0, 1) * dt;
				q.celebA = out ? Math.min(1, (q.celebA || 0) + 0.06 * dt) : Math.max(0, (q.celebA || 0) - 0.04 * dt);
				q.dir = Math.hypot(q.vx, q.vy) > 0.3 ? Math.atan2(q.vy, q.vx) : -Math.PI / 2;
				q.running = re < 6.5 || d > 4;
			});
			// The bench: only drawn when the dugouts are (the camera is not in the near stand).
			if (!G3.showNear) { continue; }
			const upAmt = now < sf.up ? 1 : 0;
			sf.bench.forEach((q, i) => {
				if (F.n >= MAXF3) { return; }
				const r = F.rigs[F.n];
				if (q.running) { pose3D(r, q, q.x, q.y, q.dir, 0, 0); commitFigure3D(r, sf.look[i + 1], staffKit(t, i === 3 ? "coach" : "sub"), null); return; }
				q.idlePh += 0.028 * dt;
				q.st = (q.st || 0) + (upAmt - (q.st || 0)) * Math.min(1, (upAmt ? 0.12 : 0.04) * dt);
				const st = q.st, ph = rm ? 0 : q.idlePh;
				pose3D(r, q, q.x, q.y, -Math.PI / 2, 0, 0);
				benchPose3D(r, st, ph, rm ? 0 : Math.max(0, Math.sin(ph * 7 + q.hop)) * 4 * st, i);
				commitFigure3D(r, sf.look[i + 1], staffKit(t, i === 3 ? "coach" : "sub"), null);
			});
		}
	}
