	/* ---------- the crowd in 3D ----------
	   Every seat a fan: a body, a head, two arms and (for a few) a flag, as instances of one shape
	   whose vertices are tagged by part. The vertex shader does all the moving (the sway, standing,
	   jumping, arms up, a flag waved), driven by a handful of uniforms, so the crowd costs the CPU
	   nothing per frame. The back rows of the far stand and the ends use a lighter shape (body and
	   head only): at that distance arms are a pixel. The near stand is only drawn when the camera
	   looks back at it. */
	const crowdMood = { excite: 0, home: 0, away: 0, ooh: 0, wave: 0 };
	const CROWD_U = { uTime: { value: 0 }, uExcite: { value: 0 }, uHome: { value: 0 }, uAway: { value: 0 }, uOoh: { value: 0 }, uWave: { value: 0 }, uOla: { value: 0 }, uOlaA: { value: 0 }, uMid: { value: [ 0, 0, 1, 1 ] } };
	// A fan's shape, facing +z (the pitch). Every camera looks at the stands from the pitch side, so
	// the faces turned away from it (backs and bottoms) are left out.
	function fanGeometry3D (kind) {   // "lite", "full" or "hi" (the rounded shape for the front rows)
		const lite = kind === "lite" || kind === true;
		const pos = [], nor = [], part = [], idx = [];
		const quad = (q, n, pt) => {
			const b = pos.length / 3;
			for (let i = 0; i < 4; i++) { const [ x, y, z ] = q[i]; pos.push(x, y, z); nor.push(...(Array.isArray(n[0]) ? n[i] : n)); part.push(pt); }
			idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
		};
		// A rounded body part: rings [ y, r ] from bottom to top round (cx, cz), squashed front to back
		// by kz; the faces turned away from the pitch are left out. Rings from hairFrom up are hair.
		const lathe = (cx, cz, rings, segs, kz, pt, hairFrom = 99) => {
			for (let j = 0; j < rings.length - 1; j++) {
				const [ y0, r0 ] = rings[j], [ y1, r1 ] = rings[j + 1], dy = y1 - y0, dr = r1 - r0, L = Math.hypot(dy, dr) || 1;
				const ny = -dr / L, nr = dy / L, p = y0 >= hairFrom ? 4 : pt;
				for (let k = 0; k < segs; k++) {
					const a0 = k / segs * Math.PI * 2, a1 = (k + 1) / segs * Math.PI * 2;
					if (Math.sin((a0 + a1) / 2) < -0.35) { continue; }
					const v = (a, y, r) => [ cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * kz ];
					const n = a => { const x = Math.cos(a) * nr, z = Math.sin(a) * nr / kz, l = Math.hypot(x, ny, z) || 1; return [ x / l, ny / l, z / l ]; };
					quad([ v(a1, y0, r0), v(a0, y0, r0), v(a0, y1, r1), v(a1, y1, r1) ], [ n(a1), n(a0), n(a0), n(a1) ], p);
				}
			}
		};
		if (kind === "hi") {
			// Legs (seen when he stands), a torso with sloping shoulders, a neck, a rounded head with
			// hair, arms with hands modelled raised (the shader swings them down), and the flag.
			for (const sx of [ -0.95, 0.95 ]) { lathe(sx, 0.3, [ [ -2.8, 0.72 ], [ 0.9, 0.92 ] ], 6, 1, 6); }
			lathe(0, 0, [ [ 0.4, 1.8 ], [ 3.2, 2.05 ], [ 6.0, 2.55 ], [ 7.25, 2.45 ], [ 7.95, 1.65 ], [ 8.35, 0.85 ] ], 8, 0.62, 7);
			lathe(0, 0, [ [ 8.0, 0.68 ], [ 9.3, 0.72 ] ], 6, 1, 1);
			lathe(0.05, 0, [ [ 8.95, 0.55 ], [ 9.3, 1.22 ], [ 9.95, 1.52 ], [ 10.65, 1.6 ], [ 11.2, 1.46 ], [ 11.7, 1.02 ], [ 11.98, 0.3 ] ], 8, 0.94, 1, 11.2);
			for (const sx of [ -2.6, 2.6 ]) {
				lathe(sx * 1.04, 0, [ [ 7.2, 0.78 ], [ 10.4, 0.7 ], [ 13.5, 0.6 ] ], 6, 1, 8);
				lathe(sx * 1.04, 0, [ [ 13.4, 0.62 ], [ 14.4, 0.58 ], [ 15.1, 0.2 ] ], 5, 0.8, 5);
			}
		}
		const box = (cx, cy, cz, wt, wb, sy, sz, pt, topPt = pt) => {
			const ht = wt / 2, hb = wb / 2, hy = sy / 2, hz = sz / 2, y0 = cy - hy, y1 = cy + hy;
			const sl = (ht - hb) / sy, ln = Math.hypot(1, sl);
			quad([ [ cx - ht, y1, cz - hz ], [ cx - ht, y1, cz + hz ], [ cx + ht, y1, cz + hz ], [ cx + ht, y1, cz - hz ] ], [ 0, 1, 0 ], topPt);
			quad([ [ cx - hb, y0, cz + hz ], [ cx + hb, y0, cz + hz ], [ cx + ht, y1, cz + hz ], [ cx - ht, y1, cz + hz ] ], [ 0, 0, 1 ], pt);
			quad([ [ cx + hb, y0, cz + hz ], [ cx + hb, y0, cz - hz ], [ cx + ht, y1, cz - hz ], [ cx + ht, y1, cz + hz ] ], [ 1 / ln, -sl / ln, 0 ], pt);
			quad([ [ cx - hb, y0, cz - hz ], [ cx - hb, y0, cz + hz ], [ cx - ht, y1, cz + hz ], [ cx - ht, y1, cz - hz ] ], [ -1 / ln, -sl / ln, 0 ], pt);
		};
		const finish = () => {
			const g = new THREE.BufferGeometry();
			g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
			g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
			g.setIndex(idx);
			return g;
		};
		if (kind === "hi") { box(0, 14.5, 0, 6, 6, 4, 0.2, 3); return finish(); }
		if (lite) {
			box(0, 4.2, 0, 5.0, 3.9, 7.2, 3.0, 0);    // body, sitting (the shader stands him up)
			box(0, 9.7, 0, 2.9, 2.9, 3.2, 2.8, 1, 4);
		} else {
			// Rounded but light: a torso with shoulders and a round head, the front halves only.
			lathe(0, 0, [ [ 0.6, 1.9 ], [ 4.0, 2.2 ], [ 6.6, 2.6 ], [ 7.8, 1.75 ], [ 8.35, 0.8 ] ], 6, 0.62, 0);
			lathe(0.05, 0, [ [ 8.7, 0.7 ], [ 9.3, 1.35 ], [ 10.3, 1.6 ], [ 11.2, 1.38 ], [ 11.95, 0.45 ] ], 6, 0.94, 1, 11.2);
		}
		if (!lite) {
			box(-3.3, 9.5, 0, 1.1, 1.1, 6.5, 1.1, 2);   // arms, modelled raised; the shader lowers them
			box(3.3, 9.5, 0, 1.1, 1.1, 6.5, 1.1, 2);
			box(0, 14.5, 0, 6, 6, 4, 0.2, 3);           // a flag or scarf held up (folded away unless he has one)
		}
		return finish();
	}
	let crowdMat3 = null;
	function crowdMaterial3D () {
		if (crowdMat3) { return crowdMat3; }
		const m = crowdMat3 = new THREE.MeshLambertMaterial({ color: 0xffffff });
		m.onBeforeCompile = sh => {
			Object.assign(sh.uniforms, CROWD_U);
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", `#include <common>
					attribute float aPart; attribute vec4 aFan; attribute vec3 aSkin;
					uniform float uTime, uExcite, uHome, uAway, uOoh, uWave, uOla, uOlaA; uniform vec4 uMid;`)
				.replace("#include <color_vertex>", `#include <color_vertex>
					int pt = int(aPart + 0.5);
					if (pt == 1 || pt == 5) { vColor.rgb = aSkin; }
					if (pt == 4) { float hq = fract(aFan.x * 7.31); vColor.rgb = hq > 0.9 ? vec3(0.62, 0.5, 0.3) : hq > 0.8 ? vec3(0.45, 0.45, 0.45) : aSkin * 0.22 + vec3(0.02); }
					if (pt == 6) { vColor.rgb = vColor.rgb * 0.12 + (fract(aFan.x * 3.7) > 0.5 ? vec3(0.1, 0.12, 0.18) : vec3(0.16, 0.15, 0.13)); }`)
				.replace("#include <begin_vertex>", `
					vec3 transformed = vec3(position);
					float phase = aFan.x, side = aFan.y, standy = aFan.z, hasFlag = aFan.w;
					float mood = side > 0.75 ? uHome : side < 0.25 ? uAway : 0.5 * uHome;
					float up = max(mood, 0.0), down = max(-mood, 0.0);
					float excite = clamp(uExcite + up * 0.7, 0.0, 1.0);
					float stand = smoothstep(0.3, 0.7, excite * 0.85 + standy * 0.35 - 0.1 + uOoh * 0.4 * step(0.4, phase));
					float t = uTime;
					float sway = sin(t * (1.1 + phase * 0.8) + phase * 6.2832) * (0.35 + 1.4 * excite);
					float bounce = up * abs(sin(t * (5.5 + phase * 2.5) + phase * 6.2832)) * (3.0 + 3.0 * phase) * step(0.35, standy + up * 0.5);
					float ooh = uOoh * step(0.3, phase);
					float armsUp = clamp(up * 1.3 * step(0.25, phase) + ooh * 1.2 + (excite - 0.75) * 2.0 * step(0.6, phase), 0.0, 1.0);
					// La Ola: the Mexican wave, a band of fans standing with their arms up that runs round the bowl.
					#ifdef USE_INSTANCING
					if (uOla > 0.001) {
						vec2 ip = (vec2(instanceMatrix[3].x, instanceMatrix[3].z) - uMid.xy) / uMid.zw;
						float da = mod(atan(ip.y, ip.x) - uOlaA + 3.14159, 6.28318) - 3.14159;
						float ola = uOla * exp(-da * da * 22.0) * (0.75 + 0.25 * phase);
						stand = max(stand, ola); armsUp = max(armsUp, ola);
					}
					#endif
					int ptv = int(aPart + 0.5);
					if (ptv == 0) { transformed.y *= 1.0 + 0.45 * stand; }
					if (ptv == 1 || ptv == 4 || ptv == 7) { transformed.y += 3.3 * stand - down * 1.2; transformed.z += down * 0.8; }
					if (ptv == 6) { transformed.y += 3.3 * stand; }
					if (ptv == 5 || ptv == 8) {
						// The rounded fans' arms swing about the shoulder: down by their sides, up, or hands to heads.
						float lift = armsUp, sg = transformed.x > 0.0 ? 1.0 : -1.0;
						vec2 pv = vec2(sg * 2.7, 7.3), d = transformed.xy - pv;
						float th = -sg * ((1.0 - lift) * 2.9 - ooh * 0.6), cs = cos(th), sn = sin(th);
						transformed.xy = pv + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
						transformed.y += 3.3 * stand + lift * abs(sin(t * 6.0 + phase * 6.2832)) * 1.4 * up - down * 1.2 * (1.0 - lift);
						transformed.z += ooh * 0.5 * (1.0 - up) + down * 0.8;
					}
					if (ptv == 2) {
						transformed.y += 3.3 * stand;
						float lift = armsUp;
						transformed.y -= (1.0 - lift) * 7.0;
						transformed.x = mix(transformed.x * 1.25, transformed.x * (0.45 + 0.55 * (1.0 - ooh)), lift);
						transformed.y += lift * abs(sin(t * 6.0 + phase * 6.2832)) * 1.4 * up;
						transformed.z += ooh * 0.9 * (1.0 - up);
					}
					if (ptv == 3) {
						float show = hasFlag * clamp(uWave + up * 1.5 + (excite - 0.55) * 2.0, 0.0, 1.0) * stand;
						transformed = vec3(0.0, 11.0, 0.0) + (transformed - vec3(0.0, 11.0, 0.0)) * show;
						transformed.y += 3.3 * stand;
						transformed.z += sin(t * 7.0 + phase * 6.2832 + transformed.x * 0.9) * 1.1 * show;
					}
					transformed.y += bounce;
					transformed.x += sway * (0.4 + 0.6 * stand);
				`);
		};
		m.customProgramCacheKey = () => "ff-crowd";
		return m;
	}
	// Fill the bowl: a fan in most seats of every row, in the home colours, with the visitors in the
	// far corner of the main stand and gaps for the aisles. B: the bowl's plan and rows. The front
	// rows get the rounded shape, the high rows the light one, as the Graphics setting allows.
	function buildCrowd3D (st, B) {
		const T = THREE, GQ = gfx3(), SEAT = GQ.seat;
		const gs = gstyle || { fill: 0.8 };
		const hk = KITS[homeSide] || KITS[0], ak = KITS[1 - homeSide] || KITS[1];
		const homeC = hk.outfield, homeC2 = hk.second || "#1f2a36", awayC = ak.outfield;
		const neutrals = [ "#2c3135", "#4a5057", "#8a8f94", "#d9dcdf", "#1e2a38", "#5c4a3a", "#7a2f2f", "#2f4a6a" ];
		const skins = [ "#f1c9a5", "#e0ac86", "#c68a5e", "#9c6a44", "#6e4a30", "#4a3222" ];
		let h = 7919;
		const rnd = () => (h = (h * 48271) % 2147483647) / 2147483647;
		const lists = { full: [], lite: [], near: [], hi: [], nearHi: [] };
		const fill = clamp(gs.fill * GQ.fill, 0.2, 1);
		B.rows.forEach((row, i) => {
			const dS = row.d + row.rd * 0.66, ring = B.ring(dS), y = row.h + 1.5;
			for (let j = 0; j < B.N; j++) {
				const a = ring[j], b = ring[B.nxt(j)], L = Math.hypot(b.x - a.x, b.z - a.z), nearSide = B.isNear(j), ai = B.aisles(j);
				for (let s = (i % 2 ? SEAT : SEAT / 2); s < L - SEAT * 0.3; s += SEAT) {
					const u = s / L;
					if (ai.some(v => Math.abs(v - u) * L < 5.5)) { continue; }   // the aisle
					const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
					if (nearSide && row.h < 20 && Math.abs(x - FW / 2) < 190 * Math.sqrt(S) * 1.24 + 26 && Math.abs(x - FW / 2) > 14) { continue; }   // the dugouts
					const away = x > FW * 0.8 && z < FH * 0.22 && !nearSide;
					if (!(away ? rnd() < 0.9 : rnd() < fill)) { continue; }   // an empty seat
					const nx = a.nx + (b.nx - a.nx) * u, nz = a.nz + (b.nz - a.nz) * u, q = rnd();
					const color = away ? (q < 0.75 ? awayC : neutrals[Math.floor(rnd() * neutrals.length)])
						: q < 0.55 ? homeC : q < 0.65 ? homeC2 : neutrals[Math.floor(rnd() * neutrals.length)];
					const side = away ? 0 : color === homeC || color === homeC2 ? 1 : 0.5;
					const fan = { x, y, z, ry: Math.atan2(-nx, -nz) + (rnd() - 0.5) * 0.3, side, phase: rnd(), stand: rnd(), flag: rnd() < 0.07 ? 1 : 0, skin: skins[Math.floor(rnd() * skins.length)], color, scale: 1.5 + rnd() * 0.2, wide: 0.88 + rnd() * 0.26, tall: 0.9 + rnd() * 0.2 };
					lists[nearSide ? (i < GQ.nearHiRows ? "nearHi" : "near") : i < GQ.hiRows && !away ? "hi" : i >= GQ.liteRow ? "lite" : "full"].push(fan);
				}
			}
		});
		const mat = crowdMaterial3D(), M = new T.Matrix4(), P = new T.Vector3(), Sc = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler(), C = new T.Color();
		const make = (fans, kind) => {
			if (!fans.length) { return null; }
			const geo = fanGeometry3D(kind), n = fans.length;
			const mesh = new T.InstancedMesh(geo, mat, n);
			const fa = new Float32Array(n * 4), sk = new Float32Array(n * 3);
			fans.forEach((f, i) => {
				M.compose(P.set(f.x, f.y, f.z), Q.setFromEuler(E.set(0, f.ry, 0)), Sc.set(f.scale * f.wide, f.scale * f.tall, f.scale));
				mesh.setMatrixAt(i, M); mesh.setColorAt(i, C.set(f.color));
				fa.set([ f.phase, f.side, f.stand, f.flag ], i * 4);
				C.set(f.skin); sk.set([ C.r, C.g, C.b ], i * 3);
			});
			geo.setAttribute("aFan", new T.InstancedBufferAttribute(fa, 4));
			geo.setAttribute("aSkin", new T.InstancedBufferAttribute(sk, 3));
			mesh.frustumCulled = false;
			mesh.userData.ownGeo = true;
			st.add(mesh);
			return mesh;
		};
		G3.crowd = { full: make(lists.full, "full"), lite: make(lists.lite, "lite"), near: make(lists.near, "full"), hi: make(lists.hi, "hi"), nearHi: make(lists.nearHi, "hi") };
		G3.crowd.count = Object.values(lists).reduce((n, l) => n + l.length, 0);
	}
	// The stands' moods: excitement follows the match's heat; goals, chances and fouls give jolts that fade.
	function animateCrowd3D () {
		const k = frameDt / 1000, m = crowdMood;
		m.excite += ((state === "play" || state === "goal" ? crowdHeat : 0.15) - m.excite) * Math.min(1, k * 2.5);
		CROWD_U.uTime.value = reduceMotion ? 0 : performance.now() / 1000;
		CROWD_U.uExcite.value = reduceMotion ? 0.2 : m.excite;
		CROWD_U.uHome.value = m.home; CROWD_U.uAway.value = m.away; CROWD_U.uOoh.value = m.ooh; CROWD_U.uWave.value = m.wave;
		// La Ola: after a long quiet spell (or with the home side two up) the stands start a Mexican
		// wave that runs round the bowl a couple of times. Not with reduced motion.
		const live = state === "play" && freeze <= 0, now = performance.now();
		m.lull = live && crowdHeat < 0.3 ? (m.lull || 0) + k : 0;
		const cruising = live && score[homeSide] - score[1 - homeSide] >= 2 && m.lull > 6;
		if (!reduceMotion && !(m.olaT > 0) && (m.lull > 20 || cruising) && now - (m.olaLast || -1e9) > 70000) { m.olaT = 15; m.olaLast = now; }
		if (state !== "play" && state !== "goal") { m.olaT = 0; }
		if (m.olaT > 0) { m.olaT -= k; m.olaA = (m.olaA || 0) + k * 0.95; }
		m.ola = (m.ola || 0) + ((m.olaT > 1.2 ? 1 : 0) - (m.ola || 0)) * Math.min(1, k * 1.6);
		CROWD_U.uOla.value = reduceMotion ? 0 : m.ola;
		CROWD_U.uOlaA.value = m.olaA || 0;
		const mid = CROWD_U.uMid.value; mid[0] = FW / 2; mid[1] = FH / 2; mid[2] = FW / 2 + 160; mid[3] = FH / 2 + 160;
	}
	// The stands' jolts fade: a cheer in a couple of seconds, a gasp quicker.
	function stepCrowdMood (k) {
		const m = crowdMood;
		m.home *= Math.pow(0.5, k / 2.2); m.away *= Math.pow(0.5, k / 2.2);
		m.ooh *= Math.pow(0.5, k / 0.6); m.wave *= Math.pow(0.5, k / 3);
	}
	// Match events, for the stands. home/away here are the home club's fans and the visitors'.
	function ev3d (kind, data) {
		const m = crowdMood, homeFans = homeSide;
		if (kind === "goal") {
			if (data && data.scorer === homeFans) { m.home = 1; m.away = -1; m.wave = 1; } else { m.away = 1; m.home = -1; }
			m.ooh = 0;
		} else if (kind === "near" || kind === "ooh") { m.ooh = 1; m.excite = Math.min(1, m.excite + 0.35); }
		else if (kind === "roar") { if (!(data > 0.8)) { m.home = Math.max(m.home, 0.5 * (data || 0.5)); } }
		else if (kind === "groan") { m.home = Math.min(m.home, -0.5); }
		else if (kind === "foul") { m.ooh = Math.max(m.ooh, 0.6); }
		else if (kind === "save") { m.ooh = 1; if (data === homeFans) { m.home = Math.max(m.home, 0.5); } else { m.away = Math.max(m.away, 0.5); } }
		else if (kind === "final") { const won = score[homeFans] > score[1 - homeFans], lost = score[homeFans] < score[1 - homeFans]; m.home = won ? 0.8 : lost ? -0.5 : 0; m.away = lost ? 0.8 : won ? -0.5 : 0; }
		else if (kind === "chant") { m.wave = Math.max(m.wave, 0.7); }
	}
	// How far a spot on the pitch is from the 3D camera (sounds fade with it); 0 when not in 3D.
	function listenerDist3D (x, y) {
		if (camMode !== "3d" || !G3.cam) { return 0; }
		const sw = endsSwapped(), p = G3.cam.position;
		return Math.hypot((sw ? FW - x : x) - p.x, y - p.z, p.y);
	}
	// Which shot the broadcast is on: wide from the gantry between the action, tight behind a
	// set piece, otherwise following the ball along the near stand.
	const FOLLOW_FOV = 40;
	// The kick-off sweep: at the start of each half the camera swings in from high over a corner of
	// the ground and comes down to the broadcast position while the 3-2-1 runs, arriving with the
	// whistle. Not with reduced motion.
	let introSweep = null;
	function shot3D (out) {
		const wideDrift = reduceMotion ? 0 : Math.sin(performance.now() / 9000) * FW * 0.1;
		if (benchCam()) {
			out.kind = "wide";
			out.eye.set(FW / 2 + wideDrift, FH * 0.92, FH + FH * 1.02);
			out.look.set(FW / 2, 10, FH * 0.4);
			return out;
		}
		if (introSweep && state === "play" && !reduceMotion) {
			const T = 1 - freeze / KICKOFF_FREEZE;
			if (freeze > 0 && freezeKind === "kickoff" && T >= 0 && T < 1) {
				const e = smooth3(T), a = -1.05 * (1 - e), R = FH * (1.95 - 1.13 * e);
				out.kind = "intro";
				out.eye.set(FW / 2 + Math.sin(a) * R * 1.25, FH * (1.2 - 0.7 * e), FH / 2 + Math.cos(a) * R);
				out.look.set(FW / 2, 0, FH / 2);
				return out;
			}
			introSweep = null;
		}
		if (replayOn()) { return replayShot(out); }
		const sw = endsSwapped(), WX = x => (sw ? FW - x : x);
		const o = ball.owner;
		if (celebTracking()) {
			// The celebration: a low camera out on the pitch, tracking the scorer with the fans behind him.
			const h = celeb.hero, nearSide = h.y > FH / 2;
			out.kind = "celeb";
			out.eye.set(WX(clamp(h.x + (h.x < FW / 2 ? 120 : -120), 30, FW - 30)), 42, clamp(h.y + (nearSide ? -230 : 230), 20, FH - 20));
			out.look.set(WX(h.x), 16, h.y + (nearSide ? 30 : -30));
			return out;
		}
		if (stretcher && state === "play") {
			// The stretcher: the camera goes to the injured man.
			const q = stretcherPos() || stretcher.at;
			out.kind = "stretcher";
			out.eye.set(WX(q.x), 150, clamp(q.y + 320, 120, FH + MY * 0.8));
			out.look.set(WX(q.x), 4, q.y);
			return out;
		}
		if (setPiece && setPiece.taker && o === setPiece.taker && state === "play" && (setPiece.kind === "free" || setPiece.kind === "pen")) {
			const gx = attackX(setPiece.team), dx0 = gx - ball.x, dy0 = FH / 2 - ball.y, L = Math.hypot(dx0, dy0) || 1, dx = dx0 / L, dy = dy0 / L;
			out.kind = "set" + setPiece.kind + setPiece.team;
			out.eye.set(WX(clamp(ball.x - dx * 250, -MX * 0.5, FW + MX * 0.5)), 110, clamp(ball.y - dy * 250 + 90, -MY * 0.4, FH + MY * 0.5));
			out.look.set(WX(ball.x + dx * 140), 12, ball.y + dy * 140);
			return out;
		}
		const fx0 = o ? o.x : ball.x, fy0 = o ? o.y : ball.y, vx = o ? o.vx : ball.vx, vy = o ? o.vy : ball.vy;
		let tx = fx0 + vx * 14;
		const ty = clamp(fy0 + vy * 14, FH * 0.22, FH * 0.78);
		// The near touchline is closest to the lens, so the view is narrowest there. Clamp the camera
		// against that width, not the mid-pitch width, so it can travel far enough to keep the near
		// corner flags and both goals in shot.
		const eyeH = FH * 0.5, eyeZ = FH * 1.32, lookZ = FH * 0.5;
		const tanX = Math.tan(FOLLOW_FOV * Math.PI / 360) * G3.cam.aspect;
		const half = Math.hypot(eyeH, eyeZ - lookZ) * tanX, halfNear = Math.hypot(eyeH, eyeZ - FH) * tanX;
		tx = half * 2 >= FW ? FW / 2 : clamp(tx, halfNear - MX * 0.55, FW - halfNear + MX * 0.55);
		out.kind = "follow";
		out.eye.set(WX(tx), eyeH, eyeZ);
		out.look.set(WX(tx), 0, ty);
		return out;
	}
	const shotWant = { kind: "", eye: null, look: null };
	function camera3D () {
		if (!shotWant.eye) { shotWant.eye = new THREE.Vector3(); shotWant.look = new THREE.Vector3(); }
		G3.cam.aspect = VW / VH;
		shot3D(shotWant);
		// Open play uses a wider lens so the near touchline and corner flags fit; other shots keep 36.
		G3.cam.fov = shotWant.kind === "follow" ? FOLLOW_FOV : 36;
		G3.cam.updateProjectionMatrix();
		// A new shot is a cut; within a shot the camera glides, eased by elapsed time.
		if (shotWant.kind !== G3.shot) { G3.shot = shotWant.kind; G3.eye.copy(shotWant.eye); G3.look.copy(shotWant.look); }
		else {
			const ease = reduceMotion ? 1 : 1 - Math.exp(-frameDt / 240);
			G3.eye.lerp(shotWant.eye, ease); G3.look.lerp(shotWant.look, ease);
		}
		G3.cam.position.copy(G3.eye);
		G3.cam.lookAt(G3.look);
		G3.cam.updateMatrixWorld();
	}
	function sync3D () {
		buildStadium3D();
		const sw = endsSwapped(), WX = x => (sw ? FW - x : x), WD = d => (sw ? Math.PI - d : d);
		camera3D();
		// The broadcast camera sits in the near stand, so that side of the ground (its seats, fans, roof
		// and lights) is only drawn when the camera is out in front of it, looking back.
		const showNear = G3.eye.z < FH + F_SIDE3 - 2 || G3.shot === "intro" || G3.shot.startsWith("replay");
		if (G3.nearRoof) { for (const o of G3.nearRoof) { o.visible = showNear; } }
		if (G3.nearStand) { G3.nearStand.visible = showNear; }
		if (G3.crowd) { for (const m of [ G3.crowd.near, G3.crowd.nearHi ]) { if (m) { m.visible = showNear; } } }
		// The players and the officials, posed and drawn as instances; the stands breathe with the match.
		drawFigures3D(WX, WD);
		animateCrowd3D();
		// The ball, at its true height, rolling; its shadow stays on the grass.
		const h = Math.max(0, ball.z || 0), bx = WX(ball.x), bz = ball.y;
		G3.ball.position.set(bx, h * Z3 + 5, bz);
		const spd = Math.hypot(ball.vx, ball.vy);
		if (spd > 0.01 && !reduceMotion) {
			G3.v.set(ball.vy, 0, -(sw ? -ball.vx : ball.vx)).normalize();
			G3.ball.rotateOnWorldAxis(G3.v, spd / 5 * frameDt / 16.7);
		}
		animateNets3D(bx, bz, h * Z3 + 5, frameDt / 16.7);
		const sh = 1 / (1 + h / 90);
		G3.ballShadow.position.set(bx + 2 + h * 0.06, 0.3, bz + 1.5 + h * 0.04);
		G3.ballShadow.scale.set(4.5 * sh + 2, 1, 4.5 * sh + 2);
		G3.ballShadow.material.opacity = 0.3 * sh + 0.08;
		if (G3.shot.startsWith("replay")) { for (const m of Object.values(G3.marks)) { m.visible = false; } return; }   // a clean picture for the replay
		// The markers on the grass.
		const mk = G3.marks, me = human(), playing = state === "play" && freeze <= 0;
		const isHuman = me && state !== "intro";
		for (const m of Object.values(mk)) { m.visible = false; }
		if (isHuman) {
			const x = WX(me.x), z = me.y;
			mk.me.visible = mk.meFill.visible = mk.arrow.visible = mk.cone.visible = true;
			mk.me.position.set(x, 0.45, z); mk.me.scale.set(22, 1, 22);
			mk.meFill.position.set(x, 0.4, z); mk.meFill.scale.set(22, 1, 22);
			mk.arrow.position.set(x, 0.5, z); mk.arrow.rotation.y = -WD(me.dir);
			mk.cone.position.set(x, 46 + (reduceMotion ? 0 : Math.sin(frame * 0.15) * 1.5), z);
		}
		if (playing && !receiver && !(ball.owner && ball.owner.team === 0) && !inHands(ball.owner)) {   // who S switches you to: a dashed ring at his feet
			const m = nextSwitchTarget();
			if (m) { mk.next.visible = true; mk.next.position.set(WX(m.x), 0.45, m.y); mk.next.scale.set(19, 1, 19); mk.next.rotation.y = reduceMotion ? 0 : -frame * 0.03; }
		}
		if (playing && me && ball.owner === me) {
			const t = passTarget(me);
			if (t) { mk.pass.visible = true; mk.pass.position.set(WX(t.x), 0.5, t.y); mk.pass.scale.set(24, 1, 24); mk.pass.rotation.y = reduceMotion ? 0 : frame * 0.02; }
			if (offsideOn()) {
				const line = offsideLine(0);
				if (line > FW / 2 + 1) { mk.offside.visible = true; mk.offside.position.set(WX(line), 0.4, FH / 2); mk.offside.scale.set(2.2, 0.5, FH); }
			}
		}
		if (setPiece && setPiece.kind === "free" && ball.owner === setPiece.taker) {
			const R = fkDist();
			mk.fk.visible = true; mk.fk.position.set(bx, 0.45, bz); mk.fk.scale.set(R, 1, R);
			if (setPiece.wall && setPiece.wall.length) {
				const w = setPiece.wall, a = w[0], b = w[w.length - 1];
				const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
				const nx = ball.x - (a.x + b.x) / 2, ny = ball.y - (a.y + b.y) / 2, nl = Math.hypot(nx, ny) || 1;
				mk.wall.visible = true;
				mk.wall.position.set(WX((a.x + b.x) / 2 + nx / nl * 13), 0.5, (a.y + b.y) / 2 + ny / nl * 13);
				mk.wall.scale.set(L + 28, 0.6, 3);
				mk.wall.rotation.y = -WD(Math.atan2(dy, dx));
			}
		}
		if (ball.owner && inHands(ball.owner) && state === "play") {
			mk.keeper.visible = true; mk.keeper.position.set(WX(ball.owner.x), 0.4, ball.owner.y); mk.keeper.scale.set(KEEPER_CLEAR, 1, KEEPER_CLEAR);
		}
		if (tut && tut.marker) {
			const r = 22 + (reduceMotion ? 0 : Math.sin(frame * 0.12) * 4);
			mk.tut.visible = mk.tutFill.visible = true;
			mk.tut.position.set(WX(tut.marker.x), 0.5, tut.marker.y); mk.tut.scale.set(r, 1, r);
			mk.tutFill.position.set(WX(tut.marker.x), 0.45, tut.marker.y); mk.tutFill.scale.set(r, 1, r);
		}
	}
	// A point on the pitch (x, y, height) to the screen, in the HUD's units; null when it is behind the camera.
	function proj3D (x, y, z) {
		const sw = endsSwapped();
		G3.v.set(sw ? FW - x : x, z, y);
		const d = G3.v.distanceTo(G3.cam.position);
		G3.v.project(G3.cam);
		if (G3.v.z > 1 || G3.v.z < -1) { return null; }
		return { x: (G3.v.x + 1) / 2 * VW, y: (1 - G3.v.y) / 2 * VH, k: VH / (2 * d * Math.tan(G3.cam.fov * Math.PI / 360)) };
	}
	// The HUD over the 3D picture: everything the 2D cameras write in words and marks.
	function hud3D () {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
		if (replayOn()) { drawRain(); return; }
		const me = human(), playing = state === "play" && freeze <= 0;
		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		for (const p of players) {
			const tiredMark = !p.injured && p.team === 0 && p.role !== "gk" && staOf(p) < TIRED_STA;
			if (!p.yellow && !p.injured && !tiredMark) { continue; }
			const q = proj3D(p.x, p.y, 36);
			if (!q) { continue; }
			if (tiredMark) { drawTired(q.x - 18, q.y - 10); }
			if (p.yellow) {
				ctx.fillStyle = "#ffd21f"; ctx.fillRect(q.x + 6, q.y - 10, 5, 7);
				if (p.yellow > 1) { ctx.fillRect(q.x + 9, q.y - 8, 5, 7); }
			}
			if (p.injured) { ctx.fillStyle = "#ffffff"; ctx.fillRect(q.x - 13, q.y - 10, 7, 7); ctx.fillStyle = "#d8343f"; ctx.fillRect(q.x - 10.5, q.y - 9, 2, 5); ctx.fillRect(q.x - 12, q.y - 7.5, 5, 2); }
		}
		if (me && state !== "intro") {
			const foot = proj3D(me.x, me.y, 0), top = proj3D(me.x, me.y, 56);
			if (foot) {
				drawSprintBar(me, foot.x, foot.y + Math.max(5, 7 * foot.k), Math.max(22, 30 * foot.k));
				if (me.lungeCd > 0 && ball.owner !== me) {   // tackle recharging
					const c = 1 - me.lungeCd / LUNGE_CD, r = 26 * foot.k;
					ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 3;
					ctx.beginPath(); ctx.ellipse(foot.x, foot.y, r, r * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2); ctx.stroke();
				}
				if ((charging || passCharge) && ball.owner === me) {
					const [ ax, ay ] = chargeAim(me), tip = proj3D(ax, ay, 0);
					if (tip) { drawChargeUI(foot.x, foot.y, tip.x, tip.y, Math.max(0.6, foot.k)); }
				}
				if (charging) {
					const c = clamp((frame - chargeStart) / 50, 0, 1), r = 28 * foot.k;
					ctx.strokeStyle = "#f2b52e"; ctx.lineWidth = 4;
					ctx.beginPath(); ctx.ellipse(foot.x, foot.y, r, r * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2); ctx.stroke();
				}
			}
			if (top && me.name) {
				ctx.font = "700 12px Barlow, Arial, sans-serif";
				const label = `${me.num} ${me.name}`, w = ctx.measureText(label).width;
				ctx.fillStyle = "rgba(8, 13, 11, 0.8)"; ctx.fillRect(top.x - w / 2 - 5, top.y - 18, w + 10, 16);
				ctx.fillStyle = "#eef6ea"; ctx.fillText(label, top.x, top.y - 10);
			}
		}
		if (playing && me && ball.owner === me) {
			const m = strikerTarget(me), q = m && proj3D(m.x, m.y, 44);
			if (q) {
				ctx.fillStyle = "rgba(242, 181, 46, 0.95)"; ctx.font = "800 15px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
				ctx.fillText("Q", q.x, q.y);
			}
			if (offsideOn()) {
				const line = offsideLine(0);
				if (line > FW / 2 + 1) {
					ctx.fillStyle = "rgba(222, 79, 90, 0.95)"; ctx.font = "800 11px Barlow, Arial, sans-serif";
					for (const o of players) {
						if (o.team !== 0 || o === me || o.role === "gk" || !isOffside(o, line)) { continue; }
						const r = proj3D(o.x, o.y, 0);
						if (r) { ctx.fillText("OFF", r.x, r.y + 12); }
					}
				}
			}
			if (charging && aimY !== null && shotInRange(me)) {   // the shot: where it could end up, and the crosshair
				const power = clamp((frame - chargeStart) / 50, 0, 1), spread = shotSpread(me, power), cb = 55 * Z3;
				const c = [ proj3D(FW, aimY - spread, 0), proj3D(FW, aimY + spread, 0), proj3D(FW, aimY + spread, cb), proj3D(FW, aimY - spread, cb) ];
				if (c.every(Boolean)) {
					ctx.fillStyle = "rgba(242, 181, 46, 0.28)";
					ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); for (let i = 1; i < 4; i++) { ctx.lineTo(c[i].x, c[i].y); } ctx.closePath(); ctx.fill();
				}
				const g = proj3D(FW, aimY, 16), b = proj3D(ball.x, ball.y, 3);
				if (g && b) {
					ctx.save();
					ctx.strokeStyle = "rgba(242, 181, 46, 0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([ 6, 6 ]);
					ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(g.x, g.y); ctx.stroke();
					ctx.setLineDash([]); ctx.strokeStyle = "#f2b52e"; ctx.lineWidth = 2.5;
					ctx.beginPath(); ctx.arc(g.x, g.y, 8, 0, Math.PI * 2); ctx.stroke();
					ctx.beginPath(); ctx.moveTo(g.x - 12, g.y); ctx.lineTo(g.x + 12, g.y); ctx.moveTo(g.x, g.y - 12); ctx.lineTo(g.x, g.y + 12); ctx.stroke();
					ctx.restore();
				}
			}
		}
		if (playing && !receiver && !(ball.owner && ball.owner.team === 0) && !inHands(ball.owner)) {   // who S switches you to
			const m = nextSwitchTarget(), q = m && proj3D(m.x, m.y, 46);
			if (q) {
				ctx.strokeStyle = "rgba(255, 255, 255, 0.75)"; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(q.x - 7, q.y - 8); ctx.lineTo(q.x + 7, q.y - 8); ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.stroke();
				drawKeyChip(q.x, q.y - 19, "S");
				ctx.textAlign = "center"; ctx.textBaseline = "middle";
			}
		}
		// Pop-up rings and words (goal, won it, saved) over the spot.
		for (const f of fx) {
			if (f.toast) { continue; }
			const k = f.t / (f.life || 40), q = proj3D(f.p ? f.p.x : f.x, f.p ? f.p.y : f.y, 0);
			if (!q) { continue; }
			const r = (20 + (reduceMotion ? 0 : k * 26)) * q.k;
			ctx.globalAlpha = 1 - k;
			ctx.strokeStyle = f.color; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
			if (f.label) {
				ctx.fillStyle = f.color; ctx.font = "800 22px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
				ctx.fillText(f.label.toUpperCase(), q.x, q.y - 60 * q.k - 14 - (reduceMotion ? 0 : k * 16));
			}
		}
		ctx.globalAlpha = 1;
		drawRain();
		// An arrow at the screen edge when your player is out of the picture.
		if (me && state !== "intro") {
			const q = proj3D(me.x, me.y, 16);
			const sx = q ? q.x : VW / 2, sy = q ? q.y : VH + 100, pad = 26;
			if (!q || sx < 0 || sx > VW || sy < 0 || sy > VH) {
				const ex = clamp(sx, pad, VW - pad), ey = clamp(sy, pad, VH - pad), a = Math.atan2(sy - ey, sx - ex);
				ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
				ctx.fillStyle = "#ffffff";
				ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
				ctx.restore();
			}
		}
		drawMinimap();
		drawPenAim(true);
		drawReview(true);
		drawStretcher(true);
		drawHints();
		drawPowerMeter();
		drawToasts();
		drawCountdown();
	}
	// One frame of the 3D view. False means "not this frame" (still loading, or unavailable),
	// and the caller paints a 2D camera instead.
	function drawScene3D () {
		const st = threeState();
		if (st === "failed") {
			setCam(wideScreen ? "tv" : "top");
			toast("3D view unavailable here (three.js did not load): showing the " + (wideScreen ? "TV" : "overhead") + " camera", "#eef6ea");
			return false;
		}
		if (st === "loading") {
			if (!threeToldLoading) { threeToldLoading = true; toast("Loading 3D view", "#eef6ea"); }
			return false;
		}
		if (!G3.renderer && !init3D()) { return false; }
		if (G3.lost) { return false; }
		fitView();
		if (G3.w !== canvas.width || G3.h !== canvas.height) { G3.w = canvas.width; G3.h = canvas.height; resize3D(); }
		// Keep the 2D cameras' target moving too, so a switch back is smooth (and the minimap frame is right).
		const [ tx, ty ] = camTarget(), ease = reduceMotion ? 1 : 1 - Math.exp(-frameDt / 190);
		camX += (tx - camX) * ease; camY += (ty - camY) * ease;
		let restore = null;
		try {
			if (replayOn()) { restore = applyReplay(); }
			try { sync3D(); G3.renderer.render(G3.scene, G3.cam); } finally { if (restore) { restore(); } }
			hud3D();
			if (threeToldLoading) { threeToldLoading = false; fx = fx.filter(f => !(f.toast && f.label === "Loading 3D view")); }
		} catch (e) {
			threeFailed = true;
			return false;
		}
		return true;
	}

	// The simulation runs at 60 steps a second; screens often refresh faster. Remember
	// where everything was before each step and draw in between, so motion stays smooth.
	function snapshotPrev () {
		for (const p of players) { p.px = p.x; p.py = p.y; p.pdir = p.dir; p.pstride = p.stride; }
		if (ball) { ball.px = ball.x; ball.py = ball.y; ball.pz = ball.z; }
	}

