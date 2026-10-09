	/* ---------- the footballers in 3D ----------
	   One articulated rig per figure (hips, spine, chest, neck, head, shoulders, elbows, hands,
	   hips, knees and ankles), posed from the simulation every frame. The body parts are instances
	   of two dozen shared shapes, so every player and official together costs about twenty-five draw
	   calls. A figure is 32 units tall, about 1.95 m against the goal; the head is about a seventh and a
	   half of that. The shapes are lofted from cross-sections (a torso broad at the shoulders and narrow
	   at the waist, a chest and shoulder blades, a calf and a thigh), so they read as athletes, not capsules. */
	const MAXF3 = 40;   // figures the instanced parts can hold: 22 players, 3 officials, 2 managers and 8 on the benches
	// Which joint carries which part. Limbs appear twice (left, right); the instance buffers are
	// sized from this plan, so a pair of limbs always has two slots per figure.
	const PART_PLAN3 = [
		[ "torso", "spine" ], [ "collar", "spine" ], [ "shorts", "hips" ], [ "neck", "neck" ], [ "head", "head" ], [ "hair", "head" ], [ "ear", "head" ], [ "ear", "head" ], [ "nose", "head" ], [ "tail", "head" ],
		[ "sleeve", "sh", 0 ], [ "sleeve", "sh", 1 ], [ "cuff", "sh", 0 ], [ "cuff", "sh", 1 ],
		[ "upperArm", "sh", 0 ], [ "upperArm", "sh", 1 ], [ "foreArm", "el", 0 ], [ "foreArm", "el", 1 ], [ "hand", "ha", 0 ], [ "hand", "ha", 1 ],
		[ "shortLeg", "hip", 0 ], [ "shortLeg", "hip", 1 ], [ "thigh", "hip", 0 ], [ "thigh", "hip", 1 ], [ "knee", "kn", 0 ], [ "knee", "kn", 1 ],
		[ "shin", "kn", 0 ], [ "shin", "kn", 1 ], [ "band", "kn", 0 ], [ "band", "kn", 1 ],
		[ "boot", "an", 0 ], [ "boot", "an", 1 ], [ "sole", "an", 0 ], [ "sole", "an", 1 ]
	];
	const PER_FIG3 = PART_PLAN3.reduce((m, [ n ]) => { m[n] = (m[n] || 0) + 1; return m; }, {});
	const PATTERN3 = { plain: 0, stripes: 1, hoops: 2, halves: 3, sash: 4 };
	const HAIR_SCALE3 = { short: [ 1, 1, 1 ], crop: [ 1.02, 1.06, 1.02 ], curly: [ 1.14, 1.2, 1.14 ], afro: [ 1.3, 1.3, 1.3 ], long: [ 1.06, 1.12, 1.06 ], tied: [ 1.02, 1.04, 1.02 ], buzz: [ 0.98, 0.96, 0.98 ], shaved: null };
	// Long hair falls down the back of the head; tied hair is a bun at the crown. One unit sphere, placed per style.
	const TAIL3 = { long: [ -1.55, 1.45, 0, 0.8, 1.75, 1.6 ], tied: [ -1.95, 3.55, 0, 0.88, 0.85, 0.88 ] };
	let HM3 = null;   // scratch matrices for the hair, made once three.js is here
	const BOOTS3 = [ "#15181a", "#f2f2f2", "#15181a", "#2bd1ff", "#ff4f6a", "#15181a", "#f2b52e", "#8cff5a" ];
	// One face into the atlas: cell (x0, y0), 256 wide (once round the head) by 128 (crown to chin).
	// The front of the head is the middle of the cell; the eye line sits a little above the equator.
	// Features are drawn bold so the mipmapped texture still shows eyes and brows at mid distance.
	// open: the celebrating version of the same face, mouth wide open.
	function paintFace3D (g, x0, y0, v, open) {
		const cx = x0 + 128, ey = y0 + 60, brow = v % 4, mouth = (v >> 1) % 3, beard = v === 3 || v === 7, stubble = v === 2 || v === 5;
		const ink = "#22150e", dark = "rgba(20, 12, 8, 0.6)";
		g.save();
		g.clearRect(x0, y0, 256, 128);
		g.lineCap = "round";
		// Shadow under the brow ridge and in the eye sockets, down the sides of the nose, under the cheekbones.
		g.fillStyle = "rgba(40, 20, 10, 0.2)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 16, ey - 1, 13, 8, 0, 0, Math.PI * 2); g.fill(); }
		g.fillStyle = "rgba(40, 20, 10, 0.12)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 34, ey + 22, 9, 14, sgn * 0.3, 0, Math.PI * 2); g.fill(); }
		g.fillStyle = "rgba(40, 20, 10, 0.16)";
		g.beginPath(); g.moveTo(cx - 3, ey + 4); g.lineTo(cx - 8, ey + 20); g.lineTo(cx + 8, ey + 20); g.lineTo(cx + 3, ey + 4); g.closePath(); g.fill();
		// warm cheeks
		g.fillStyle = "rgba(200, 70, 60, 0.1)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 24, ey + 15, 8, 5, 0, 0, Math.PI * 2); g.fill(); }
		for (const sgn of [ -1, 1 ]) {
			const x = cx + sgn * 16;
			// the eye: a white almond, an iris, a pupil and a glint (wider open when celebrating)
			const eh = open ? 6.6 : 5.6;
			g.fillStyle = "#f8f4ee"; g.beginPath(); g.ellipse(x, ey, 9.5, eh, 0, 0, Math.PI * 2); g.fill();
			g.fillStyle = v % 3 === 1 ? "#35577a" : v % 3 === 2 ? "#4a6a36" : "#3a2210"; g.beginPath(); g.arc(x + sgn * 0.5, ey + 0.4, 4.4, 0, Math.PI * 2); g.fill();
			g.fillStyle = "#0c0604"; g.beginPath(); g.arc(x + sgn * 0.5, ey + 0.4, 2.3, 0, Math.PI * 2); g.fill();
			g.fillStyle = "rgba(255, 255, 255, 0.9)"; g.beginPath(); g.arc(x - 1.3 + sgn * 0.5, ey - 1.3, 1.2, 0, Math.PI * 2); g.fill();
			// upper lid and lashes, a fainter lower lid
			g.strokeStyle = ink; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, ey, 9.5, eh, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
			g.strokeStyle = "rgba(40, 20, 10, 0.35)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, ey, 9.5, eh, 0, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
			// the brow: flat, arched, heavy or angled; raised when celebrating
			const by = open ? -4 : 0;
			g.strokeStyle = ink; g.lineWidth = brow === 2 ? 6 : 4.4;
			g.beginPath();
			if (brow === 1) { g.moveTo(x - sgn * 10, ey - 10 + by); g.quadraticCurveTo(x, ey - 17 + by, x + sgn * 11, ey - 11 + by); }
			else if (brow === 3) { g.moveTo(x - sgn * 10, ey - 11 + by); g.lineTo(x + sgn * 11, ey - 14 + by); }
			else { g.moveTo(x - sgn * 10, ey - 12 + by); g.quadraticCurveTo(x, ey - 14 + by, x + sgn * 11, ey - 11.5 + by); }
			g.stroke();
		}
		// nostrils and the underside of the nose
		g.fillStyle = "rgba(50, 20, 12, 0.55)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 3.6, ey + 19, 2.2, 1.4, 0, 0, Math.PI * 2); g.fill(); }
		// stubble or a beard across the jaw (under the mouth, so the lips sit on top)
		if (stubble || beard) {
			g.fillStyle = beard ? "rgba(26, 16, 10, 0.85)" : "rgba(26, 16, 10, 0.32)";
			g.beginPath(); g.moveTo(cx - 46, ey + 12); g.quadraticCurveTo(cx - 42, ey + 54, cx, ey + 60); g.quadraticCurveTo(cx + 42, ey + 54, cx + 46, ey + 12);
			g.quadraticCurveTo(cx + 30, ey + 24, cx + 12, ey + 22); g.quadraticCurveTo(cx, ey + 20, cx - 12, ey + 22); g.quadraticCurveTo(cx - 30, ey + 24, cx - 46, ey + 12); g.closePath(); g.fill();
		}
		// the mouth
		if (open) {
			g.fillStyle = "#3a0e0c"; g.beginPath(); g.ellipse(cx, ey + 31, 10, 8, 0, 0, Math.PI * 2); g.fill();
			g.fillStyle = "#f2ece2"; g.fillRect(cx - 7, ey + 24, 14, 3);
			g.fillStyle = "#b8524a"; g.beginPath(); g.ellipse(cx, ey + 36, 6, 2.4, 0, 0, Math.PI * 2); g.fill();
			g.strokeStyle = "rgba(120, 40, 34, 0.9)"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, ey + 31, 10, 8, 0, 0, Math.PI * 2); g.stroke();
		} else {
			g.strokeStyle = "rgba(70, 22, 18, 0.9)"; g.lineWidth = 3; g.beginPath();
			if (mouth === 1) { g.moveTo(cx - 10, ey + 28); g.quadraticCurveTo(cx, ey + 34, cx + 10, ey + 28); }
			else if (mouth === 2) { g.moveTo(cx - 9, ey + 30); g.quadraticCurveTo(cx, ey + 27, cx + 9, ey + 30); }
			else { g.moveTo(cx - 9, ey + 29); g.lineTo(cx + 9, ey + 29); }
			g.stroke();
			g.fillStyle = beard ? "rgba(178, 84, 70, 0.85)" : "rgba(160, 60, 50, 0.3)"; g.beginPath(); g.ellipse(cx, ey + 33, 7, 2.6, 0, 0, Math.PI * 2); g.fill();
		}
		g.restore();
	}
	// A body part lofted through cross-sections. Each ring is [ y, half width (z), depth to the front
	// (+x), depth to the back, x offset of its centre ]; the section is a rounded box (a superellipse,
	// exponent ex), closed at both ends. Front and back differ, so a calf bulges behind and a shin pad
	// in front, a chest forward and shoulder blades back.
	function loft3D (rings, seg = 10, ex = 2.2) {
		const pos = [], idx = [], e = 2 / ex, n = rings.length;
		for (const [ y, w, df, db, ox = 0 ] of rings) {
			for (let j = 0; j < seg; j++) {
				const a = j / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
				pos.push(ox + Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? df : db), y, Math.sign(s) * Math.pow(Math.abs(s), e) * w);
			}
		}
		const b = n * seg, t = b + 1, r0 = rings[0], r1 = rings[n - 1];
		pos.push(r0[4] || 0, r0[0], 0, r1[4] || 0, r1[0], 0);
		for (let i = 0; i < n - 1; i++) {
			for (let j = 0; j < seg; j++) {
				const a = i * seg + j, bb = i * seg + (j + 1) % seg, c = a + seg, d = bb + seg;
				idx.push(a, c, bb, bb, c, d);
			}
		}
		for (let j = 0; j < seg; j++) { idx.push(b, j, (j + 1) % seg); idx.push(t, (n - 1) * seg + (j + 1) % seg, (n - 1) * seg + j); }
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		g.setIndex(idx);
		// rings run either way (top down for limbs); keep the faces pointing out
		if (rings[0][0] > rings[n - 1][0]) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const k = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = k; } }
		g.computeVertexNormals();
		return g;
	}
	// Several shapes as one (positions and normals only; every part is a flat colour).
	function merge3D (list) {
		const pos = [], nor = [];
		for (const g0 of list) {
			const g = g0.index ? g0.toNonIndexed() : g0;
			if (!g.attributes.normal) { g.computeVertexNormals(); }
			pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
		return g;
	}
	// The torso's sections (in the spine's frame, y 0 at the waist), shared by the shirt and the number on its back.
	const TORSO3 = [
		[ -0.75, 3.12, 2.08, 2.0 ], [ -0.45, 3.1, 2.06, 1.98 ], [ -0.4, 3.0, 1.98, 1.9 ], [ 1.2, 2.95, 1.95, 1.88 ], [ 3.0, 3.2, 2.08, 2.0 ],
		[ 4.8, 3.66, 2.36, 2.1 ], [ 6.3, 4.02, 2.56, 2.24 ], [ 7.6, 4.26, 2.42, 2.36 ], [ 8.6, 4.28, 2.08, 2.2 ],
		[ 9.3, 3.35, 1.68, 1.8 ], [ 9.85, 1.9, 1.36, 1.46 ]
	];
	const TORSO_EX3 = 2.5;
	// How far the back of the shirt is from the spine at height y, across at z.
	function backDepth3D (y, z) {
		let i = 0;
		while (i < TORSO3.length - 2 && TORSO3[i + 1][0] < y) { i++; }
		const a = TORSO3[i], b = TORSO3[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
		const w = a[1] + (b[1] - a[1]) * t, db = a[3] + (b[3] - a[3]) * t, q = clamp(Math.abs(z) / w, 0, 0.999);
		return db * Math.pow(1 - Math.pow(q, TORSO_EX3), 1 / TORSO_EX3);
	}
	function initFigures3D () {
		const T = THREE;
		const defs = {
			torso: () => loft3D(TORSO3, 16, TORSO_EX3),
			// A ribbed collar round the base of the neck, in the trim colour.
			collar: () => loft3D([ [ 9.2, 1.95, 1.62, 1.72 ], [ 9.55, 2.0, 1.66, 1.76 ], [ 10.05, 1.7, 1.48, 1.56 ], [ 10.25, 1.5, 1.3, 1.38 ] ], 12, 2.2),
			// The shorts: a waistband and seat on the hips, and a leg for each thigh (shortLeg) so they move with the stride.
			shorts: () => loft3D([ [ 1.6, 3.05, 2.02, 2.05 ], [ 1.75, 3.12, 2.08, 2.1 ], [ 0.6, 3.5, 2.15, 2.32 ], [ -0.9, 3.8, 2.18, 2.4 ], [ -1.9, 3.5, 2.0, 2.1 ], [ -2.3, 2.6, 1.6, 1.6 ] ], 12, 2.4),
			shortLeg: () => loft3D([ [ 0.9, 1.7, 1.8, 1.95 ], [ -0.6, 1.88, 1.92, 2.04 ], [ -3.1, 1.84, 1.9, 1.94, 0.1 ], [ -3.4, 1.92, 1.98, 2.02, 0.12 ], [ -3.65, 1.9, 1.95, 1.99, 0.12 ], [ -3.7, 1.5, 1.5, 1.5, 0.12 ] ], 10, 2.2),
			neck: () => loft3D([ [ -0.6, 1.4, 1.2, 1.3 ], [ 0.4, 1.22, 1.08, 1.12, -0.05 ], [ 1.4, 1.1, 1.0, 1.0, 0.05 ], [ 2.3, 1.0, 0.95, 0.95, 0.1 ], [ 2.5, 0.6, 0.6, 0.6, 0.1 ] ], 10, 2),
			head: () => {
			// A skull that narrows to a jaw and a chin rather than an egg: below the cheekbones the sides
			// draw in and the back of the head tucks under; the front keeps its line down to the chin.
			const g = new T.SphereGeometry(2.15, 18, 14), P = g.attributes.position;
			for (let i = 0; i < P.count; i++) {
				const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = clamp(-y / 2.15, 0, 1), u = clamp((y + 0.3) / 1.5, 0, 1);
				P.setXYZ(i, x * (x < 0 ? 1 - 0.22 * t : 1 + 0.03 * t), y, z * (1 - 0.3 * t * t) * (1 + 0.04 * (1 - u) * (1 - t)));
			}
			g.computeVertexNormals(); g.scale(0.96, 1.12, 0.94); g.translate(0.2, 2.25, 0); return g;
		},
		ear: () => { const g = new T.SphereGeometry(0.62, 8, 6); g.scale(0.55, 1.05, 0.38); g.translate(0.05, 2.3, 0); return g; },
		nose: () => { const g = new T.ConeGeometry(0.42, 1.0, 6); g.rotateZ(-0.35); g.scale(0.85, 1, 0.9); g.translate(2.12, 1.86, 0); return g; },
		tail: () => new T.SphereGeometry(1, 9, 7),
			hair: () => { const g = new T.SphereGeometry(2.38, 12, 7, 0, Math.PI * 2, 0, 1.55); g.scale(0.96, 1.12, 0.94); g.rotateZ(0.42); g.translate(0.2, 2.25, 0); return g; },   // concentric with the head, tilted: high at the brow, low at the nape
			// Short sleeves over the shoulder (a rounded cap, the deltoid under it) ending in a cuff.
			sleeve: () => loft3D([ [ 1.45, 0.35, 0.35, 0.35 ], [ 1.25, 1.0, 1.0, 1.0 ], [ 0.7, 1.38, 1.36, 1.36 ], [ -0.4, 1.45, 1.42, 1.42 ], [ -1.9, 1.32, 1.3, 1.3 ], [ -2.35, 1.28, 1.26, 1.26 ], [ -2.4, 0.9, 0.9, 0.9 ] ], 10, 2.0),
			cuff: () => loft3D([ [ -2.05, 1.33, 1.31, 1.31 ], [ -2.4, 1.33, 1.31, 1.31 ], [ -2.45, 1.0, 1.0, 1.0 ] ], 10, 2.0),
			upperArm: () => loft3D([ [ 0.5, 0.75, 0.75, 0.75 ], [ 0, 1.02, 1.0, 1.0 ], [ -1.6, 1.0, 1.1, 0.98 ], [ -3.1, 0.9, 1.06, 0.92 ], [ -4.7, 0.78, 0.8, 0.8 ], [ -5.6, 0.72, 0.72, 0.76 ], [ -6.0, 0.4, 0.4, 0.45 ] ], 9, 2.0),
			foreArm: () => loft3D([ [ 0.4, 0.5, 0.5, 0.55 ], [ 0, 0.76, 0.76, 0.8 ], [ -1.2, 0.86, 0.84, 0.9 ], [ -2.8, 0.72, 0.7, 0.72 ], [ -4.4, 0.56, 0.48, 0.5 ], [ -5.2, 0.52, 0.46, 0.46 ], [ -5.5, 0.3, 0.3, 0.3 ] ], 9, 2.0),
			// A flat hand with the fingers together and a thumb in front.
			hand: () => {
				const palm = loft3D([ [ 0.2, 0.3, 0.42, 0.42 ], [ -0.35, 0.36, 0.58, 0.56 ], [ -1.2, 0.34, 0.6, 0.56 ], [ -1.9, 0.3, 0.52, 0.5 ], [ -2.3, 0.2, 0.36, 0.36 ], [ -2.45, 0.08, 0.15, 0.15 ] ], 8, 2.2);
				const th = loft3D([ [ 0.1, 0.2, 0.2, 0.2 ], [ -0.2, 0.22, 0.24, 0.24 ], [ -0.9, 0.18, 0.2, 0.2 ], [ -1.15, 0.08, 0.08, 0.08 ] ], 6, 2);
				th.rotateZ(0.45); th.translate(0.42, -0.45, 0.14);
				return merge3D([ palm, th ]);
			},
			thigh: () => loft3D([ [ 0.9, 1.4, 1.4, 1.5 ], [ -0.6, 1.68, 1.72, 1.66 ], [ -2.6, 1.6, 1.82, 1.58 ], [ -4.6, 1.38, 1.6, 1.36 ], [ -6.3, 1.12, 1.24, 1.08 ], [ -7.2, 1.06, 1.18, 1.0 ], [ -7.8, 0.82, 0.86, 0.82 ], [ -8.0, 0.5, 0.5, 0.5 ] ], 10, 2.0),
			knee: () => { const g = new T.SphereGeometry(1.0, 9, 7); g.scale(1.08, 1.0, 1.02); g.translate(0.08, -0.15, 0); return g; },
			// The sock over the calf and the shin pad: the calf bulges behind, the pad stands proud in front.
			shin: () => loft3D([ [ -0.4, 1.08, 1.05, 1.1 ], [ -1.3, 1.12, 1.28, 1.38 ], [ -2.6, 1.04, 1.32, 1.34 ], [ -3.8, 0.92, 1.24, 1.02 ], [ -4.4, 0.8, 0.86, 0.84 ], [ -5.6, 0.7, 0.7, 0.72 ], [ -6.5, 0.68, 0.66, 0.7 ], [ -6.9, 0.45, 0.45, 0.45 ] ], 10, 2.1),
			// The sock turned over below the knee, in the trim colour.
			band: () => loft3D([ [ -0.15, 1.1, 1.1, 1.12 ], [ -0.35, 1.18, 1.18, 1.2 ], [ -1.05, 1.2, 1.22, 1.3 ], [ -1.25, 1.12, 1.18, 1.26 ] ], 10, 2.1),
			// The boot: lofted heel to toe (built along y, then laid along x with the sole underneath).
			boot: () => {
				const g = loft3D([ [ -1.3, 0.5, 0.46, 0.5, 0.22 ], [ -1.05, 0.76, 0.54, 1.0, 0.16 ], [ 0, 0.82, 0.52, 0.96, 0.18 ], [ 1.2, 0.86, 0.36, 0.56, 0.34 ], [ 2.4, 0.8, 0.28, 0.38, 0.42 ], [ 3.1, 0.62, 0.24, 0.26, 0.46 ], [ 3.5, 0.28, 0.2, 0.12, 0.5 ] ], 10, 2.3);
				g.rotateZ(-Math.PI / 2); return g;
			},
			// The sole plate and its studs, in a colour that stands out from the boot.
			sole: () => {
				const plate = loft3D([ [ -1.32, 0.48, 0.09, 0.09 ], [ -1.0, 0.72, 0.09, 0.09 ], [ 0, 0.76, 0.09, 0.09 ], [ 1.2, 0.84, 0.09, 0.09 ], [ 2.4, 0.78, 0.09, 0.09 ], [ 3.1, 0.6, 0.09, 0.09 ], [ 3.48, 0.26, 0.09, 0.09 ] ], 10, 3);
				plate.rotateZ(-Math.PI / 2); plate.translate(0, -0.75, 0);
				const list = [ plate ];
				for (const [ sx, sz ] of [ [ -0.75, -0.42 ], [ -0.75, 0.42 ], [ 1.0, -0.5 ], [ 1.0, 0.5 ], [ 2.1, -0.46 ], [ 2.1, 0.46 ], [ 2.9, 0 ] ]) {
					const c = new T.CylinderGeometry(0.17, 0.13, 0.32, 5); c.translate(sx, -0.98, sz); list.push(c);
				}
				return merge3D(list);
			}
		};
		const plain = new T.MeshLambertMaterial({ color: 0xffffff });
		// The shirt: the kit's pattern (stripes, hoops, halves, a sash) drawn in its second colour.
		const shirtMat = new T.MeshLambertMaterial({ color: 0xffffff });
		shirtMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aPat; attribute vec3 aCol2; varying float vPat; varying vec3 vCol2; varying vec3 vKp;")
				.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPat = aPat; vCol2 = aCol2; vKp = position;");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <common>", "#include <common>\nvarying float vPat; varying vec3 vCol2; varying vec3 vKp;")
				.replace("#include <color_fragment>", `#include <color_fragment>
					float km = 0.0;
					if (vPat > 0.5 && vPat < 1.5) { km = step(0.0, sin(atan(vKp.z, vKp.x) * 5.0)); }
					else if (vPat > 1.5 && vPat < 2.5) { km = step(0.0, sin(vKp.y * 1.7)); }
					else if (vPat > 2.5 && vPat < 3.5) { km = step(0.0, vKp.z); }
					else if (vPat > 3.5) { km = 1.0 - step(1.5, abs(vKp.y - 4.7 + vKp.z * 0.95)); }
					diffuseColor.rgb = mix(diffuseColor.rgb, vCol2, km);`);
		};
		shirtMat.customProgramCacheKey = () => "ff-shirt";
		// Faces: an atlas of eight, painted once (eyes, brows, a nose, a mouth, stubble or a beard on
		// some), wrapped round the head sphere with the face at the front. Each figure picks its cell
		// with an instanced attribute; the painted parts are laid over the skin colour, the rest is skin.
		const fc = document.createElement("canvas"); fc.width = 1024; fc.height = 512;
		const fg = fc.getContext && fc.getContext("2d");
		if (fg) {
			for (let v = 0; v < 16; v++) { paintFace3D(fg, (v % 4) * 256, Math.floor(v / 4) * 128, v % 8, v >= 8); }
		}
		const faceTex = tex3D(fc);
		faceTex.minFilter = T.LinearMipmapLinearFilter; faceTex.magFilter = T.LinearFilter; faceTex.generateMipmaps = true;   // mipmaps: at mid distance the eyes and brows blur to dark marks rather than flicker out
		const headMat = new T.MeshLambertMaterial({ color: 0xffffff, map: faceTex });
		headMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aFace;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + vec2(mod(aFace, 4.0), 3.0 - floor(aFace / 4.0))) / vec2(4.0, 4.0);");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <map_fragment>", "")
				.replace("#include <color_fragment>", "#include <color_fragment>\nvec4 fx = texture2D(map, vMapUv); diffuseColor.rgb = mix(diffuseColor.rgb, fx.rgb, fx.a);");
		};
		headMat.customProgramCacheKey = () => "ff-face";
		const parts = {}, white = new T.Color(1, 1, 1);
		for (const name of Object.keys(defs)) {
			const geo = defs[name], cap = MAXF3 * PER_FIG3[name];
			const g = geo();
			if (name === "torso") {
				g.setAttribute("aPat", new T.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(T.DynamicDrawUsage));
				g.setAttribute("aCol2", new T.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(T.DynamicDrawUsage));
			}
			if (name === "head") { g.setAttribute("aFace", new T.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(T.DynamicDrawUsage)); }
			const m = new T.InstancedMesh(g, name === "torso" ? shirtMat : name === "head" ? headMat : plain, cap);
			m.instanceMatrix.setUsage(T.DynamicDrawUsage);
			m.setColorAt(0, white);   // so the colour buffer exists before the first frame
			m.frustumCulled = false; m.count = 0;
			parts[name] = m;
			G3.scene.add(m);
		}
		// Numbers on the backs: one atlas of 0-99, a plane per figure picking its cell.
		const ac = document.createElement("canvas"); ac.width = ac.height = 640;
		const ag = ac.getContext && ac.getContext("2d");
		if (ag) {
			ag.textAlign = "center"; ag.textBaseline = "middle"; ag.font = "700 46px 'Barlow', 'Helvetica Neue', Arial, sans-serif";
			ag.lineWidth = 5; ag.strokeStyle = "rgba(0, 0, 0, 0.45)"; ag.fillStyle = "#ffffff";
			for (let n = 0; n < 100; n++) { const x = (n % 10) * 64 + 32, y = Math.floor(n / 10) * 64 + 35; ag.strokeText(String(n), x, y); ag.fillText(String(n), x, y); }
		}
		const numMat = new T.MeshLambertMaterial({ color: 0xffffff, map: tex3D(ac), alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });
		numMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aCell;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + vec2(mod(aCell, 10.0), 9.0 - floor(aCell / 10.0))) / 10.0;");
		};
		numMat.customProgramCacheKey = () => "ff-num";
		// curved onto the back of the shirt, just proud of it
		const ng = new T.PlaneGeometry(4.2, 4.7, 6, 4).rotateY(-Math.PI / 2).translate(0, 5.6, 0), NP = ng.attributes.position;
		for (let i = 0; i < NP.count; i++) { NP.setX(i, -backDepth3D(NP.getY(i), NP.getZ(i)) - 0.06); }
		ng.computeVertexNormals();
		ng.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(MAXF3), 1).setUsage(T.DynamicDrawUsage));
		const nums = new T.InstancedMesh(ng, numMat, MAXF3);
		nums.instanceMatrix.setUsage(T.DynamicDrawUsage); nums.setColorAt(0, white); nums.frustumCulled = false; nums.count = 0;
		G3.scene.add(nums);
		// A kit-coloured ring at each player's feet (it keeps the sides readable from the gantry) and a soft shadow.
		const rings = new T.InstancedMesh(G3.geo.ring, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), MAXF3);
		const blobs = new T.InstancedMesh(G3.geo.shadow, new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }), MAXF3);
		// Under four floodlights a player throws four faint shadows, one away from each (as many as the Graphics setting draws).
		const longs = new T.InstancedMesh(G3.geo.shadow, new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false }), MAXF3 * 4);
		for (const m of [ rings, blobs, longs ]) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; G3.scene.add(m); }
		rings.setColorAt(0, white);
		// The assistants' flags, held in the hand: a pole and a red-and-yellow chequered cloth.
		const FA = acc3();
		accBox3(FA, 0, -6.0, 0, 0.45, 11, 0.45, "#2a2d31");
		for (let a = 0; a < 2; a++) {
			for (let b = 0; b < 2; b++) {
				const y0 = -11.2 + a * 2.25, z0 = 0.3 + b * 2.8;
				accQuad3(FA, [ 0, y0, z0 ], [ 0, y0, z0 + 2.8 ], [ 0, y0 + 2.25, z0 + 2.8 ], [ 0, y0 + 2.25, z0 ], (a + b) % 2 ? "#ffd21f" : "#e8262b");
			}
		}
		const flags = new T.InstancedMesh(geoAcc3(FA), new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }), 2);
		flags.instanceMatrix.setUsage(T.DynamicDrawUsage); flags.frustumCulled = false; flags.count = 0;
		G3.scene.add(flags);
		const node = (parent, x, y, z) => { const o = new T.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
		const rigs = [];
		for (let i = 0; i < MAXF3; i++) {
			const root = new T.Object3D();
			root.rotation.order = "YXZ";   // lean and roll in his own frame, then face the way he runs
			const hips = node(root, 0, 15.6, 0), spine = node(hips, 0, 0.6, 0), chest = node(spine, 0, 5.4, 0), neck = node(chest, 0, 3.6, 0), head = node(neck, 0, 2.0, 0);
			head.scale.setScalar(0.86);   // the head (and its hair, ears and nose) about 1/7.5 of his height
			const sh = [ node(chest, 0, 2.95, -4.6), node(chest, 0, 2.95, 4.6) ], el = sh.map(s => node(s, 0, -5.6, 0)), ha = el.map(e => node(e, 0, -5.2, 0));
			const hip = [ node(hips, 0, -1.0, -2.45), node(hips, 0, -1.0, 2.45) ], kn = hip.map(h => node(h, 0, -7.3, 0)), an = kn.map(k => node(k, 0, -6.5, 0));
			rigs.push({ root, hips, spine, chest, neck, head, sh, el, ha, hip, kn, an });
		}
		G3.fig = { parts, nums, rings, blobs, longs, flags, rigs, cnt: {}, n: 0, M: new T.Matrix4(), M2: new T.Matrix4(), C: new T.Color(), V: new T.Vector3(), S: new T.Vector3(), Q: new T.Quaternion(), prevDir: new WeakMap() };
	}
	// Reset a rig to standing.
	function resetRig3D (r) {
		r.hips.position.set(0, 15.6, 0); r.hips.rotation.set(0, 0, 0);
		r.spine.rotation.set(0, 0, 0); r.chest.rotation.set(0, 0, 0); r.neck.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
		for (let i = 0; i < 2; i++) { r.sh[i].rotation.set(0, 0, 0); r.el[i].rotation.set(0, 0, 0); r.ha[i].rotation.set(0, 0, 0); r.hip[i].rotation.set(0, 0, 0); r.kn[i].rotation.set(0, 0, 0); r.an[i].rotation.set(0, 0, 0); }
		r.root.rotation.set(0, 0, 0); r.root.position.set(0, 0, 0); r.root.scale.setScalar(1);
	}
	const smooth3 = t => t * t * (3 - 2 * t);
	const lerp3 = (a, b, t) => a + (b - a) * t;
	// A footballer's pose from the simulation: the run (its stride and how hard he is running), the
	// idle weight shift, the keeper's set, a kick (pass or shot, its backswing from the power), a
	// throw-in, a header, a slide, the keeper's dive, a fall when fouled, and the celebrations.
	function pose3D (r, p, x, z, dir, turn, ballNear, ballYaw = 0) {
		resetRig3D(r);
		const rm = reduceMotion;
		const spd = Math.hypot(p.vx || 0, p.vy || 0);
		const a = clamp(p.runAmt || 0, 0, 1), ph = rm ? 0 : p.stride || 0, jump = rm ? 0 : jumpAmt(p);
		const shuf = clamp(p.shuf || 0, 0, 1), cel = r.cel = clamp(p.celebA || 0, 0, 1), kneel = clamp(p.kneel || 0, 0, 1), sulk = clamp(p.sulk || 0, 0, 1);
		const down = (p.lunge > 0 && players.indexOf(p) === ctrl) || p.slideAI > 0;
		const fall = p.fall > 0 ? 1 - p.fall / FALL_T : -1, dive = p.dive > 0 ? 1 - p.dive / DIVE_T : -1, thr = p.throwA > 0 ? 1 - p.throwA / THROW_T : -1;
		const idle = rm ? 0 : p.idlePh || 0, gk = p.role === "gk";
		let y = 0;
		// The running cycle: hips swing the thighs, knees fold on the recovery, arms counter-swing.
		const A = 0.22 + 0.62 * a * (1 - 0.4 * shuf), K = 0.5 + 1.3 * a, armA = (0.25 + 0.65 * a) * (1 - 0.5 * shuf);
		for (let i = 0; i < 2; i++) {
			const s = i ? 1 : -1, phi = ph + (i ? Math.PI : 0), sn = Math.sin(phi), cs = Math.cos(phi);
			const limp = p.injured && i === 0 ? 0.55 : 1;
			r.hip[i].rotation.z = A * sn * limp;
			r.kn[i].rotation.z = -(K * clamp(cs, 0, 1) * clamp(a + 0.15, 0, 1) + 0.12 + 0.1 * a) * limp;
			r.an[i].rotation.z = 0.25 * a * clamp(-sn, 0, 1) - 0.1 * clamp(cs, 0, 1) * a;
			r.sh[i].rotation.z = -armA * sn; r.sh[i].rotation.x = s * (0.1 + 0.08 * a);
			r.el[i].rotation.z = 0.45 + 0.95 * a;
		}
		r.hips.position.y = 15.6 - 0.5 * a + Math.abs(Math.cos(ph)) * 0.9 * a + (a < 0.2 ? Math.sin(idle) * 0.12 : 0);
		r.spine.rotation.z = 0.06 + 0.2 * a * a;
		r.hips.rotation.x = clamp(turn * 1.4, -0.3, 0.3) * clamp(spd, 0, 1);
		r.neck.rotation.z = -r.spine.rotation.z * 0.6;
		if (a < 0.2) { r.chest.rotation.y = Math.sin(idle * 0.5) * 0.05; r.sh[0].rotation.z += Math.sin(idle) * 0.03; r.sh[1].rotation.z -= Math.sin(idle) * 0.03; r.head.rotation.y = Math.sin(idle * 0.37) * 0.25; }
		// Planting to stop or cut: knees bent, weight back, feet wide for a few frames.
		const plant = !rm && p.plant > 0 && !down && jump <= 0 ? p.plant / 10 : 0;
		if (plant > 0) {
			r.spine.rotation.z -= 0.28 * plant; r.hips.position.y -= 1.4 * plant;
			for (let i = 0; i < 2; i++) { r.kn[i].rotation.z -= 0.35 * plant; r.hip[i].rotation.x += (i ? 1 : -1) * 0.14 * plant; r.hip[i].rotation.z += 0.18 * plant; }
		}
		// Flat out: leaning further in, the arms pumping higher and tighter.
		const sp = clamp(p.sprintAmt || 0, 0, 1) * a;
		if (sp > 0) { r.spine.rotation.z += 0.14 * sp; for (let i = 0; i < 2; i++) { r.el[i].rotation.z += 0.3 * sp; r.sh[i].rotation.z *= 1 + 0.25 * sp; } }
		// Eyes on the ball: the head turns toward it when it is near, and drops to the feet on the ball.
		if (!rm && ball && fall < 0 && dive < 0 && thr < 0 && cel <= 0 && !down) {
			if (ball.owner === p) {
				r.neck.rotation.z += 0.2;
				// Each touch: the boot comes through and flicks the ball on.
				const tap = p.touchPh !== undefined && a > 0.2 ? Math.max(0, 1 - p.touchPh / 0.22) : 0;
				if (tap > 0) { const kf = build(p).left ? 0 : 1; r.an[kf].rotation.z -= 0.4 * tap; r.kn[kf].rotation.z += 0.15 * tap; }
			} else {
				r.head.rotation.y += ballYaw;
			}
		}
		// The keeper on his toes when the ball is near: knees bent, hands ready.
		if (gk && ballNear > 0 && !down && jump <= 0 && fall < 0 && dive < 0 && !(p.kickA > 0)) {
			const g = ballNear * (1 - a);
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z += 0.42 * g; r.kn[i].rotation.z -= 0.75 * g; r.sh[i].rotation.z += 0.75 * g; r.sh[i].rotation.x += (i ? 1 : -1) * 0.55 * g; r.el[i].rotation.z += 0.6 * g; }
			r.hips.position.y -= 2.6 * g; r.spine.rotation.z += 0.3 * g;
		}
		// Kicking: a backswing, the strike and the follow-through on the kicking leg; the other leg
		// plants and the arms open for balance. Shots swing further than passes (kickPow).
		const ks = rm || jump > 0 || down ? null : kickSwing(p);
		if (ks) {
			const kf = build(p).left ? 0 : 1, pl = 1 - kf, pw = p.kickPow || 0.5;
			r.hip[kf].rotation.z = ks.s * 1.15; r.kn[kf].rotation.z = -ks.bend * 1.25; r.an[kf].rotation.z = 0.35;
			r.hip[pl].rotation.z = -0.12; r.kn[pl].rotation.z = -0.38;
			r.spine.rotation.z = 0.05 - 0.18 * ks.s - 0.1 * pw; r.hips.rotation.x += (kf ? -1 : 1) * 0.12;
			r.sh[pl].rotation.z = 0.5 * ks.s + 0.2; r.sh[kf].rotation.z = -0.4 * ks.s; r.sh[kf].rotation.x = (kf ? 1 : -1) * (0.35 + 0.5 * Math.abs(ks.s) * (0.6 + pw)); r.sh[pl].rotation.x = (pl ? 1 : -1) * (0.4 + 0.3 * pw);
			r.el[kf].rotation.z = 0.5; r.el[pl].rotation.z = 0.7;
		}
		// A throw-in: ball over the head, arching back, then whipping forward.
		if (thr >= 0) {
			const back = thr < 0.35 ? thr / 0.35 : 1 - (thr - 0.35) / 0.65, fwd = thr > 0.35 ? 1 : 0;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = -2.6 + 1.2 * (1 - back) * fwd; r.sh[i].rotation.x = (i ? 1 : -1) * 0.2; r.el[i].rotation.z = 1.5 * back; }
			r.spine.rotation.z = -0.35 * back + 0.25 * (1 - back) * fwd;
			r.hip[1].rotation.z = 0.3; r.kn[1].rotation.z = -0.3; r.hip[0].rotation.z = -0.3;
		}
		// Up for a header: legs tucked, arms out, the head snaps forward at the top.
		if (jump > 0) {
			y += jump * 13;
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z = 0.35 * jump + (i ? 0.25 : -0.1) * jump; r.kn[i].rotation.z = -1.1 * jump; r.sh[i].rotation.x = (i ? 1 : -1) * 2.2 * jump; r.sh[i].rotation.z = -0.5 * jump; r.el[i].rotation.z = 0.35; }
			r.spine.rotation.z = -0.2 * jump + 0.35 * Math.max(0, jump - 0.75) * 4;
			r.neck.rotation.z = -0.3 * jump + 0.9 * Math.max(0, jump - 0.8) * 5;
		}
		// Sliding in: on his side, one leg out at the ball, an arm on the turf.
		if (down) {
			r.root.rotation.z = 1.05; y -= 5.5;
			r.hip[1].rotation.z = 1.25; r.kn[1].rotation.z = -0.05; r.hip[0].rotation.z = 0.35; r.kn[0].rotation.z = -1.7;
			r.sh[0].rotation.z = -1.7; r.sh[0].rotation.x = -0.5; r.el[0].rotation.z = 0.2;
			r.sh[1].rotation.z = 0.8; r.sh[1].rotation.x = 1.3; r.el[1].rotation.z = 0.5;
			r.spine.rotation.z = -0.2; r.neck.rotation.z = 0.35;
		}
		// The keeper's dive: flat out to one side, arms at full stretch.
		if (dive >= 0) {
			const side = p.diveSide || 1, arc = Math.sin(Math.PI * Math.min(1, dive * 1.15)), lay = smooth3(Math.min(1, dive * 1.6));
			r.root.rotation.x = -side * 1.35 * lay; r.root.rotation.z = -0.25 * arc;
			y += 9 * arc - 6 * lay + 4;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = -2.75; r.sh[i].rotation.x = (i ? 1 : -1) * 0.25; r.el[i].rotation.z = 0.1; r.hip[i].rotation.z = -0.15 + 0.15 * i; r.kn[i].rotation.z = -0.3 - 0.4 * i; }
			r.spine.rotation.z = -0.15;
		}
		// Fouled: he goes down, lies there, then picks himself up.
		if (fall >= 0) {
			const k = fall < 0.22 ? smooth3(fall / 0.22) : fall < 0.62 ? 1 : 1 - smooth3((fall - 0.62) / 0.38);
			r.root.rotation.z = -1.45 * k; r.root.rotation.x = 0.35 * k * Math.sin(idle * 2);
			y += 2.8 * k;
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z = (0.4 + 0.5 * i) * k; r.kn[i].rotation.z = -(0.9 + 0.6 * i) * k; r.sh[i].rotation.z = (-0.6 + 1.2 * i) * k; r.sh[i].rotation.x = (i ? 1 : -1) * 0.6 * k; r.el[i].rotation.z = 1.2 * k; }
			r.spine.rotation.z = 0.35 * k; r.neck.rotation.z = 0.5 * k;
		}
		// Celebrating: arms up and out; on his knees he arches back and spreads them wide. The scorer may
		// instead fly to the corner like an aeroplane, pump his fist, or kiss the badge; team-mates who
		// reach him hug him.
		const ck = p.celebK | 0, hug = clamp(p.hug || 0, 0, 1) * cel;
		if (cel > 0 && fall < 0 && ck === 2) {
			const w = cel, bank = rm ? 0 : Math.sin(idle * 1.6) * 0.22 * a;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.15, w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * (1.45 + (i ? 1 : -1) * bank * 0.6), w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.12, w); }
			r.root.rotation.x += bank; r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.15, w); r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.2, w);
		} else if (cel > 0 && fall < 0 && ck === 3) {
			// The fist pump: one bent arm driven down hard, again and again, leaning back and roaring.
			const pump = rm ? 0.5 : Math.pow(0.5 + 0.5 * Math.sin(idle * 7), 2), w = cel;
			r.sh[1].rotation.z = lerp3(r.sh[1].rotation.z, -1.5 + 1.0 * pump, w); r.sh[1].rotation.x = lerp3(r.sh[1].rotation.x, 0.35, w); r.el[1].rotation.z = lerp3(r.el[1].rotation.z, 1.9 - 0.4 * pump, w);
			r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, -0.2, w); r.sh[0].rotation.x = lerp3(r.sh[0].rotation.x, -0.55, w); r.el[0].rotation.z = lerp3(r.el[0].rotation.z, 1.5, w);
			r.spine.rotation.z = lerp3(r.spine.rotation.z, -0.18 + 0.12 * pump, w); r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.45, w);
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.x = (i ? 1 : -1) * 0.12 * w; r.kn[i].rotation.z -= 0.25 * w * pump; }
			r.hips.position.y -= 0.8 * w * pump;
		} else if (cel > 0 && fall < 0 && ck === 4) {
			// Kissing the badge: the shirt pulled up to the lips, the other arm pointing to the fans.
			const w = cel, pt = rm ? 0 : Math.sin(idle * 2) * 0.12;
			r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, -1.25, w); r.sh[0].rotation.x = lerp3(r.sh[0].rotation.x, 0.35, w); r.el[0].rotation.z = lerp3(r.el[0].rotation.z, 2.3, w);
			r.sh[1].rotation.z = lerp3(r.sh[1].rotation.z, -2.55 + pt, w); r.sh[1].rotation.x = lerp3(r.sh[1].rotation.x, 0.45, w); r.el[1].rotation.z = lerp3(r.el[1].rotation.z, 0.1, w);
			r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.3, w); r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.08, w);
		} else if (hug > 0.02 && fall < 0) {
			// The hug: arms forward and round him, leaning in, a little bounce.
			const b = rm ? 0 : Math.sin(idle * 6 + x * 0.02) * 0.08;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, -1.35 + b, hug); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * 0.5, hug); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 1.25, hug); }
			r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.3, hug); r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.1, hug);
			r.hips.position.y += b * 6 * hug;
		} else if (cel > 0 && fall < 0) {
			const w = cel * (1 - 0.4 * kneel), wave = Math.sin(idle * 3 + x * 0.01) * 0.25 * cel;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, -0.45 + wave * (i ? -1 : 1), w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * (2.35 + 0.5 * kneel), w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.3, w); }
			r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.35 * cel, cel);
		}
		if (kneel > 0) {
			r.hips.position.y = lerp3(r.hips.position.y, 9.2, kneel);   // on the knees, not through the turf
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z = lerp3(r.hip[i].rotation.z, 0.05, kneel); r.kn[i].rotation.z = lerp3(r.kn[i].rotation.z, -1.6, kneel); r.an[i].rotation.z = 0.6 * kneel; }
			r.spine.rotation.z = lerp3(r.spine.rotation.z, -0.4, kneel);
		}
		// Beaten: head down, shoulders rounded, arms hanging.
		if (sulk > 0) {
			r.spine.rotation.z += 0.28 * sulk; r.neck.rotation.z += 0.6 * sulk;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z *= 1 - 0.7 * sulk; r.el[i].rotation.z *= 1 - 0.6 * sulk; }
		}
		r.root.position.set(x, y, z);
		r.root.rotation.y = -dir;
	}
	// What a figure wears. Keepers in their own colour with gloves and long sleeves.
	function kit3D (p) {
		const kit = KITS[p.team] || KITS[0], gk = p.role === "gk";
		const shirt = gk ? kit.gk : kit.outfield, shorts = gk ? "#1f2a36" : kit.second || "#1f2a36";
		return {
			shirt, shorts, socks: gk ? "#1f2a36" : shirt, second: kit.second || shirt, pattern: gk ? 0 : PATTERN3[kit.pattern] || 0,
			ink: gk ? "#0e1a24" : kit.ink || "#ffffff", gloves: gk ? (lum(shirt) > 0.5 ? "#15181a" : "#f2f2f2") : null, sleeves: gk,
			boots: BOOTS3[(p.num || 0) % BOOTS3.length], ring: shirt
		};
	}
	// The trim (collar, cuffs, sock tops): the kit's second colour, or its number colour on a plain kit.
	const trim3D = kit => (kit.second && kit.second !== kit.shirt ? kit.second : kit.ink || kit.shirt);
	// Commit one posed rig to the instanced parts.
	function commitFigure3D (rig, lk, kit, num) {
		const F = G3.fig, M = F.M, C = F.C;
		if (F.n >= MAXF3) { return; }
		F.n++;
		rig.root.updateMatrixWorld(true);
		if (!HM3) { HM3 = [ new THREE.Matrix4(), new THREE.Matrix4() ]; }
		for (const [ name, joint, side ] of PART_PLAN3) {
			const mesh = F.parts[name], node = side === undefined ? rig[joint] : rig[joint][side];
			let mtx = node.matrixWorld;
			if (name === "hair") {
				const s = HAIR_SCALE3[lk.style] === undefined ? HAIR_SCALE3.short : HAIR_SCALE3[lk.style];
				if (!s) { continue; }
				// scaled about the middle of the head, so a big afro grows out all round rather than up
				mtx = M.makeTranslation(0.2, 2.25, 0).multiply(HM3[0].makeScale(s[0], s[1], s[2])).multiply(HM3[1].makeTranslation(-0.2, -2.25, 0)).premultiply(node.matrixWorld);
			} else if (name === "tail") {
				const t = TAIL3[lk.style];
				if (!t) { continue; }
				mtx = M.makeTranslation(t[0], t[1], t[2]).multiply(HM3[0].makeScale(t[3], t[4], t[5])).premultiply(node.matrixWorld);
			} else if (name === "ear") {
				mtx = M.makeTranslation(0.05, 0, F.cnt.ear % 2 ? 1.92 : -1.92).premultiply(node.matrixWorld);
			} else if (name === "hand" && kit.gloves) { mtx = M.makeScale(1.45, 1.3, 1.5).premultiply(node.matrixWorld); }
			const k = F.cnt[name]++;
			if (k >= mesh.instanceMatrix.count) { F.cnt[name]--; continue; }   // never past the buffer
			mesh.setMatrixAt(k, mtx);
			if (name === "cuff" && kit.sleeves) { continue; }   // a keeper's long sleeves have no cuff at the biceps
			const c = name === "torso" || name === "sleeve" || ((name === "upperArm" || name === "foreArm") && kit.sleeves) ? kit.shirt
				: name === "collar" || name === "cuff" || name === "band" ? trim3D(kit) : name === "sole" ? (lum(kit.boots) > 0.5 ? "#26292c" : "#e4e6e8")
				: name === "shorts" || name === "shortLeg" ? kit.shorts : name === "shin" ? kit.socks : name === "boot" ? kit.boots
				: name === "hair" || name === "tail" ? lk.hair : name === "hand" && kit.gloves ? kit.gloves : lk.skin;
			mesh.setColorAt(k, C.set(c));
			if (name === "torso") {
				const g = mesh.geometry, pat = g.attributes.aPat, c2 = g.attributes.aCol2;
				pat.setX(k, kit.pattern); C.set(kit.second); c2.setXYZ(k, C.r, C.g, C.b);
			} else if (name === "head") { mesh.geometry.attributes.aFace.setX(k, ((lk.face || 0) % 8 + 8) % 8 + ((rig.cel || 0) > 0.3 ? 8 : 0)); }   // celebrating: the open-mouthed face
		}
		const V = F.V.setFromMatrixPosition(rig.root.matrixWorld), x = V.x, z = V.z, air = Math.max(0, V.y);
		F.blobs.setMatrixAt(F.blobs.count++, M.compose(V.set(x + 2, 0.2, z + 1.5), F.Q.identity(), F.S.set(11 + air * 0.15, 1, 7 + air * 0.1)));
		const ns = gfx3().shadows - 1;
		if (ns > 0 && air < 20) {
			for (let k = 0; k < 4; k++) {
				if (ns < 4 && k % 2) { continue; }   // Medium: the two lights on one diagonal
				const lx = k === 0 || k === 3 ? -160 : FW + 160, lz = k < 2 ? -160 : FH + 160;
				const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz) || 1, len = clamp(32 * d / 950, 10, 52);
				F.longs.setMatrixAt(F.longs.count++, M.compose(V.set(x + dx / d * len * 0.5, 0.15, z + dz / d * len * 0.5), F.Q.setFromAxisAngle(F.Y || (F.Y = new THREE.Vector3(0, 1, 0)), -Math.atan2(dz, dx)), F.S.set(len * 0.5, 1, 3.4)));
			}
		}
		if (kit.ring) {
			const r = F.rings.count++;
			F.rings.setMatrixAt(r, M.compose(V.set(x, 0.25, z), F.Q.identity(), F.S.set(16, 1, 16)));
			F.rings.setColorAt(r, C.set(kit.ring));
		}
		if (num !== null && num !== undefined) {
			const n = F.nums.count++;
			F.nums.setMatrixAt(n, rig.spine.matrixWorld);
			F.nums.setColorAt(n, C.set(kit.ink));
			F.nums.geometry.attributes.aCell.setX(n, clamp(Math.round(num), 0, 99));
		}
	}
