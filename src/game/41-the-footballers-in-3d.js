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
		[ "sleeve", "sh", 0 ], [ "sleeve", "sh", 1 ], [ "cuff", "sh", 0 ], [ "cuff", "sh", 1 ], [ "armband", "sh", 0 ],
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
	// Sixteen faces: four brows (flat, arched, heavy, angled) at two weights, three mouths, three eye
	// colours, narrower eyes on half of them, and the facial hair below.
	const FACES3 = 16;
	// Facial hair by face: none, stubble, a full beard, a short beard, a moustache, a goatee (with a
	// moustache), a chin strap along the jaw, or a moustache over stubble. The 2D TV camera reads it too.
	const FACE_HAIR3 = [ "", "", "stubble", "beard", "", "stubble", "", "beard", "moustache", "goatee", "", "stubble", "chin", "", "mstub", "short" ];
	function paintFace3D (g, x0, y0, v, open) {
		const cx = x0 + 128, ey = y0 + 60, brow = v % 4, mouth = (v >> 1) % 3, fh = FACE_HAIR3[v] || "", beard = fh === "beard", stubble = fh === "stubble" || fh === "mstub";
		const bw = v >= 8 ? (v % 3 === 0 ? 0.8 : 1.25) : 1, narrow = v >= 8 && v % 2 === 1;   // brow weight; narrower eyes
		const ink = "#22150e", dark = "rgba(20, 12, 8, 0.6)";
		g.save();
		g.clearRect(x0, y0, 256, 128);
		g.lineCap = "round";
		// Soft shadow in the eye sockets and under the cheekbones (the head's shape does the rest), blurred so
		// nothing has a painted edge.
		g.filter = "blur(3px)";
		g.fillStyle = "rgba(40, 20, 10, 0.26)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 16, ey - 2, 13, 8.5, 0, 0, Math.PI * 2); g.fill(); }
		g.fillStyle = "rgba(40, 20, 10, 0.05)";   // faint: the modelled hollow and the light do most of it
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 34, ey + 22, 9, 14, sgn * 0.3, 0, Math.PI * 2); g.fill(); }
		// warm cheeks
		g.fillStyle = "rgba(150, 60, 45, 0.035)";   // the faintest warmth on the cheeks, never a painted spot
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 24, ey + 15, 9, 6, 0, 0, Math.PI * 2); g.fill(); }
		g.filter = "none";
		for (const sgn of [ -1, 1 ]) {
			const x = cx + sgn * 16;
			// The eye, life-size rather than a cartoon's: a narrow almond of off-white mostly covered by the
			// upper lid, a small iris and pupil half under it, a soft lid shadow, a faint lower lid, no big glint.
			const eh = (open ? 4.2 : 3.3) * (narrow ? 0.82 : 1), ew = 6.6;
			g.save(); g.beginPath(); g.ellipse(x, ey, ew, eh, 0, 0, Math.PI * 2); g.clip();
			g.fillStyle = "#d9d0c4"; g.fillRect(x - ew, ey - eh, ew * 2, eh * 2);
			g.fillStyle = v % 3 === 1 ? "#3d5a74" : v % 3 === 2 ? "#4f6340" : "#3b2414"; g.beginPath(); g.arc(x + sgn * 0.4, ey + 0.6, 3.3, 0, Math.PI * 2); g.fill();
			g.fillStyle = "#0c0604"; g.beginPath(); g.arc(x + sgn * 0.4, ey + 0.6, 1.5, 0, Math.PI * 2); g.fill();
			g.fillStyle = "rgba(30, 14, 6, 0.45)"; g.fillRect(x - ew, ey - eh, ew * 2, eh * 0.75);   // the lid's shadow over the top of the eye
			g.restore();
			g.fillStyle = "rgba(255, 255, 255, 0.55)"; g.beginPath(); g.arc(x - 1 + sgn * 0.4, ey - 0.4, 0.6, 0, Math.PI * 2); g.fill();
			g.strokeStyle = "rgba(34, 21, 14, 0.85)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, ey, ew, eh, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
			g.strokeStyle = "rgba(60, 30, 18, 0.22)"; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, ey - 1.5, ew + 1, eh + 2.5, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();   // the lid crease
			g.strokeStyle = "rgba(40, 20, 10, 0.22)"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, ey, ew, eh, 0, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
			// the brow: flat, arched, heavy or angled; raised when celebrating
			const by = open ? -4 : 0;
			g.strokeStyle = "rgba(34, 21, 14, 0.62)"; g.lineWidth = (brow === 2 ? 3.8 : 2.8) * bw; g.filter = "blur(0.6px)";
			g.beginPath();
			if (brow === 1) { g.moveTo(x - sgn * 10, ey - 10 + by); g.quadraticCurveTo(x, ey - 17 + by, x + sgn * 11, ey - 11 + by); }
			else if (brow === 3) { g.moveTo(x - sgn * 10, ey - 11 + by); g.lineTo(x + sgn * 11, ey - 14 + by); }
			else { g.moveTo(x - sgn * 10, ey - 12 + by); g.quadraticCurveTo(x, ey - 14 + by, x + sgn * 11, ey - 11.5 + by); }
			g.stroke(); g.filter = "none";
		}
		// nostrils and the underside of the nose
		g.fillStyle = "rgba(50, 20, 12, 0.3)"; g.filter = "blur(0.8px)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 3.8, ey + 20, 1.8, 1.1, 0, 0, Math.PI * 2); g.fill(); }
		g.filter = "none";
		// stubble or a beard across the jaw (under the mouth, so the lips sit on top)
		// Worked out per pixel rather than as a blurred shape: the density rises over 10px below the cheek
		// line (low under the nose, high at the sides) and runs up into the sideburn by the ear, so there
		// is no edge on the cheek, and it never depends on canvas blur support.
		if (fh) {
			const bc = document.createElement("canvas"); bc.width = 256; bc.height = 128;
			const bg = bc.getContext("2d"), im = bg.createImageData(256, 128), full = beard || fh === "short" || fh === "chin", A = beard ? 0.74 : fh === "short" ? 0.5 : fh === "chin" ? 0.7 : 0.2, ey0 = ey - y0;
			const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
			for (let py = 0; py < 128; py++) {
				for (let px = 0; px < 256; px++) {
					const u = Math.abs(px - 128) / 56, dy = py - ey0, ax = Math.abs(px - 128);
					const n = 0.82 + 0.18 * ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1;
					let a = 0;
					if (stubble || full) {
						const top = 22 - 11 * u * u - 14 * Math.max(0, (u - 0.72) / 0.28) ** 2;   // under the nose, along the cheek, up to the sideburn
						const ramp = Math.min(1, Math.max(0, (dy - top) / (full ? 9 : 13)));
						const side = 1 - Math.min(1, Math.max(0, (u - 0.92) / 0.16));
						const lip = full ? 1 : 1 - 0.6 * Math.exp(-(((px - 128) / 9) ** 2) - ((dy - 31) / 4) ** 2);   // stubble thins on the lip itself
						const strap = fh === "chin" ? 1 - (1 - sm(37 - 14 * u * u, 43 - 14 * u * u, dy)) * (1 - sm(0.84, 0.98, u)) : 1;   // the chin strap: only along the line of the jaw
						a = A * ramp * ramp * (3 - 2 * ramp) * side * lip * strap;
					}
					if (fh === "moustache" || fh === "goatee" || fh === "mstub") {   // over the lip, down to the corners of the mouth
						const dr = 3.5 * (ax / 13) ** 2, th = 1 - 0.45 * (ax / 14) ** 2;   // drooping at the corners, thinning out to them
						a = Math.max(a, 0.66 * sm(22 + dr, 24.5 + dr, dy) * (1 - sm(24.5 + dr + 2.6 * th, 27 + dr + 2.6 * th, dy)) * (1 - sm(10, 15, ax)));
					}
					if (fh === "goatee") { const r = Math.hypot(ax / 11, (dy - 39) / 8); a = Math.max(a, 0.66 * (1 - sm(0.7, 1.05, r)) * sm(31.5, 33.5, dy)); }   // and a rounded tuft on the chin
					a *= n;
					const o = (py * 256 + px) * 4; im.data[o] = 26; im.data[o + 1] = 16; im.data[o + 2] = 10; im.data[o + 3] = Math.round(255 * a);
				}
			}
			bg.putImageData(im, 0, 0); g.drawImage(bc, x0, y0);
		}
		// the mouth
		if (open) {
			g.fillStyle = "#3a0e0c"; g.beginPath(); g.ellipse(cx, ey + 31, 10, 8, 0, 0, Math.PI * 2); g.fill();
			g.fillStyle = "#f2ece2"; g.fillRect(cx - 7, ey + 24, 14, 3);
			g.fillStyle = "#b8524a"; g.beginPath(); g.ellipse(cx, ey + 36, 6, 2.4, 0, 0, Math.PI * 2); g.fill();
			g.strokeStyle = "rgba(120, 40, 34, 0.9)"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, ey + 31, 10, 8, 0, 0, Math.PI * 2); g.stroke();
		} else {
			g.strokeStyle = "rgba(70, 26, 20, 0.6)"; g.lineWidth = 2; g.beginPath();
			if (mouth === 1) { g.moveTo(cx - 10, ey + 28); g.quadraticCurveTo(cx, ey + 34, cx + 10, ey + 28); }
			else if (mouth === 2) { g.moveTo(cx - 9, ey + 30); g.quadraticCurveTo(cx, ey + 27, cx + 9, ey + 30); }
			else { g.moveTo(cx - 9, ey + 29); g.lineTo(cx + 9, ey + 29); }
			g.stroke();
			g.fillStyle = beard ? "rgba(150, 76, 64, 0.75)" : "rgba(70, 30, 24, 0.16)"; g.beginPath(); g.ellipse(cx, ey + 32.5, 7.5, 2.2, 0, 0, Math.PI * 2); g.fill();   // the lower lip as a shade, not a dot
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
		[ 4.8, 3.66, 2.36, 2.1 ], [ 6.3, 4.02, 2.56, 2.24 ], [ 7.6, 4.26, 2.42, 2.36 ], [ 8.3, 4.24, 2.16, 2.24 ],
		[ 8.9, 4.0, 1.96, 2.08 ], [ 9.45, 3.05, 1.7, 1.84 ], [ 9.85, 1.95, 1.42, 1.52 ], [ 10.05, 1.6, 1.3, 1.4 ]   // the trapezius slopes from the neck down to the shoulder
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
	// How far the front of the shirt is from the spine at height y, across at z.
	function frontDepth3D (y, z) {
		let i = 0;
		while (i < TORSO3.length - 2 && TORSO3[i + 1][0] < y) { i++; }
		const a = TORSO3[i], b = TORSO3[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
		const w = a[1] + (b[1] - a[1]) * t, df = a[2] + (b[2] - a[2]) * t, q = clamp(Math.abs(z) / w, 0, 0.999);
		return df * Math.pow(1 - Math.pow(q, TORSO_EX3), 1 / TORSO_EX3);
	}
	// The front of the shirt: the club's crest on the left breast, a kit maker's mark on the right and a
	// shirt sponsor across the chest, all invented. One atlas row per side, repainted when the kits change.
	const SPONSORS3 = [ "NORTHLINE", "KESTREL AIR", "VOLTA", "BRIGHTWATER", "ORBITEL", "HALCYON", "TERRAFOLD", "MERIDIAN", "AXIOM BANK", "SUNVALE", "CORAL TELECOM", "FENWAY TYRES" ];
	function paintChest3D (g, row, kit, club) {
		const y0 = row * 128, ink = kit.ink || "#ffffff", w = 512;
		g.clearRect(0, y0, w, 128);
		const name = (club && club.name) || "Club", h = [ ...name ].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7);
		// the crest (on the wearer's left, so the viewer's right): a shield in the trim colour with the initial
		const cx = w * 0.7, cy = y0 + 34, sc = 1.35;
		g.beginPath(); g.moveTo(cx - 15 * sc, cy - 18 * sc); g.lineTo(cx + 15 * sc, cy - 18 * sc); g.lineTo(cx + 15 * sc, cy + 2 * sc); g.quadraticCurveTo(cx + 13 * sc, cy + 16 * sc, cx, cy + 22 * sc); g.quadraticCurveTo(cx - 13 * sc, cy + 16 * sc, cx - 15 * sc, cy + 2 * sc); g.closePath();
		g.fillStyle = kit.second && kit.second !== kit.outfield ? kit.second : ink; g.fill();
		g.lineWidth = 3; g.strokeStyle = ink; g.stroke();
		g.fillStyle = kit.outfield; g.font = "900 32px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
		g.fillText(name.charAt(0).toUpperCase(), cx, cy + 1);
		// the maker's mark: a small swoosh-like chevron (no real brand)
		g.strokeStyle = ink; g.lineWidth = 6; g.lineCap = "round";
		g.beginPath(); g.moveTo(w * 0.25, cy - 2); g.lineTo(w * 0.29, cy + 9); g.lineTo(w * 0.37, cy - 11); g.stroke();
		// the sponsor across the chest
		g.fillStyle = ink; g.font = "900 62px 'Barlow', 'Helvetica Neue', Arial, sans-serif"; g.textBaseline = "middle";
		g.fillText(SPONSORS3[h % SPONSORS3.length], w / 2, y0 + 98, w * 0.94);
	}
	// ---------- the head ----------
	// A sculpted head rather than a ball: a unit sphere pushed into an ellipsoid the shape of a skull
	// (longer than it is wide, taller than long), then modelled with soft bumps and hollows in the
	// directions where they sit: a brow ridge over eye sockets, cheekbones with a hollow under them,
	// the muzzle and lips, a chin, the angle of the jaw, the back of the skull. The face atlas's
	// features land where the sockets are (the eye line a little above the equator). (x forward, y up.)
	const HEAD_R3 = [ 1.98, 2.36, 1.7 ];   // half length, height, width of the skull ellipsoid
	const HEAD_C3 = [ 0.2, 2.25, 0 ];      // its centre on the head joint
	const HEAD_BUMPS3 = [
		// [ y, z, ry, rz, amount, front-only ]: a gaussian along the surface, centred on direction (y, z)
		[ 0.36, 0.3, 0.12, 0.3, 0.14, 1 ], [ 0.36, -0.3, 0.12, 0.3, 0.14, 1 ],      // the brow ridge
		[ 0.12, 0.37, 0.12, 0.15, -0.2, 1 ], [ 0.12, -0.37, 0.12, 0.15, -0.2, 1 ],   // eye sockets
		[ -0.04, 0.62, 0.14, 0.16, 0.1, 1 ], [ -0.04, -0.62, 0.14, 0.16, 0.1, 1 ],   // cheekbones
		[ -0.3, 0.55, 0.14, 0.16, -0.08, 1 ], [ -0.3, -0.55, 0.14, 0.16, -0.08, 1 ], // hollows under them
		[ -0.55, 0, 0.18, 0.28, 0.1, 1 ],                                           // the muzzle and lips
		[ -0.84, 0, 0.14, 0.3, 0.16, 1 ],                                           // the chin, square rather than pointed
		[ -0.55, 0.8, 0.18, 0.16, 0.09, 0 ], [ -0.55, -0.8, 0.18, 0.16, 0.09, 0 ],  // the angle of the jaw
		[ 0.6, 0.0, 0.25, 0.5, 0.05, 1 ],                                           // the forehead, rounded
		[ 0.42, 0.8, 0.16, 0.14, -0.06, 1 ], [ 0.42, -0.8, 0.16, 0.14, -0.06, 1 ]   // temples
	];
	function headPoint3 (dx, dy, dz) {
		let x = dx * HEAD_R3[0], y = dy * HEAD_R3[1], z = dz * HEAD_R3[2];
		const t = clamp(-dy, 0, 1), front = clamp((dx - 0.15) / 0.5, 0, 1), back = clamp(-dx / 0.6, 0, 1);
		// the jaw: narrower toward the chin, the angle of the jaw kept under the ears
		z *= 1 - 0.2 * Math.pow(t, 2.2) * (0.5 + 0.5 * front);
		// under the skull at the back, the head tucks in to the neck; the back of the skull bulges a little
		x *= 1 - 0.38 * back * Math.pow(t, 1.3) + 0.06 * back * Math.exp(-Math.pow((dy - 0.2) / 0.4, 2));
		// the face plane is flatter than the skull: the front is pulled back at the sides, kept at the middle
		x -= 0.22 * front * dz * dz * HEAD_R3[0];
		// the lower face comes forward of the line of the skull, the chin most
		x += 0.16 * front * Math.pow(t, 1.4) * HEAD_R3[0] * (1 - Math.abs(dz));
		let bump = 0;
		for (const [ by, bz, ry, rz, a, fo ] of HEAD_BUMPS3) { bump += a * Math.exp(-Math.pow((dy - by) / ry, 2) - Math.pow((dz - bz) / rz, 2)) * (fo ? front : 1); }
		const n = Math.hypot(x, y, z) || 1;
		return [ x + x / n * bump + HEAD_C3[0], y + y / n * bump + HEAD_C3[1], z + z / n * bump + HEAD_C3[2] ];
	}
	function sculpt3D (g) {
		const P = g.attributes.position, dir = new Float32Array(P.count * 3);
		for (let i = 0; i < P.count; i++) {
			const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = Math.hypot(x, y, z) || 1;
			dir[i * 3] = x / n; dir[i * 3 + 1] = y / n; dir[i * 3 + 2] = z / n;
			const q = headPoint3(x / n, y / n, z / n); P.setXYZ(i, q[0], q[1], q[2]);
		}
		g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
		g.computeVertexNormals();
		return weldNormals3D(g);
	}
	// A sphere repeats its vertices down the UV seam and at the poles; average the normals of vertices that
	// share a position, so the shading (and the hair lifted along the normal) has no crease down the back.
	function weldNormals3D (g) {
		const P = g.attributes.position, N = g.attributes.normal, groups = new Map();
		for (let i = 0; i < P.count; i++) {
			const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
			(groups.get(k) || groups.set(k, []).get(k)).push(i);
		}
		for (const ids of groups.values()) {
			if (ids.length < 2) { continue; }
			let x = 0, y = 0, z = 0;
			for (const i of ids) { x += N.getX(i); y += N.getY(i); z += N.getZ(i); }
			const n = Math.hypot(x, y, z) || 1;
			for (const i of ids) { N.setXYZ(i, x / n, y / n, z / n); }
		}
		return g;
	}
	// The ear: on the side of the head, its top level with the brows and its lobe with the nose.
	const EAR3 = (() => { const q = headPoint3(-0.12, -0.04, Math.sqrt(1 - 0.12 * 0.12 - 0.04 * 0.04)); return [ q[0], q[1], q[2] + 0.05 ]; })();
	// Where the nose meets the brow: each man's nose is scaled from here, so it never leaves the face.
	const NOSE_ROOT3 = headPoint3(Math.sqrt(1 - 0.24 * 0.24), 0.24, 0);
	// The nose: a ridge lofted down the middle of the face from between the eyes to the tip, widening into
	// the wings over the nostrils, set into the face so only its front stands out.
	function noseGeo3 () {
		const surf = y => { const dy = (y - HEAD_C3[1]) / HEAD_R3[1]; return headPoint3(Math.sqrt(Math.max(0, 1 - dy * dy)), dy, 0)[0]; };
		const ring = (dy, w, df) => { const y = HEAD_C3[1] + dy * HEAD_R3[1], sx = surf(y); return [ y, w, df, 0.25, sx - 0.25 ]; };
		const g = loft3D([ ring(0.24, 0.12, 0.27), ring(0.14, 0.17, 0.33), ring(0.0, 0.22, 0.46), ring(-0.14, 0.27, 0.62), ring(-0.24, 0.36, 0.7), ring(-0.3, 0.38, 0.6), ring(-0.35, 0.3, 0.36) ], 10, 2.0);
		return g;
	}
	// Hair styles drawn by the hair shader on a copy of the skull surface: [ thickness over the top, at the
	// sides, over the brow (a fringe or a quiff), curl, hairline lift (a receding line) ]. Thickness tapers
	// to nothing at the hairline, where the hair dips under the skin, so there is never a helmet's edge.
	const HAIR_STYLES3 = { short: [ 0.2, 0.12, 0.16, 0, 0 ], crop: [ 0.42, 0.08, 0.42, 0, 0 ], curly: [ 0.42, 0.26, 0.3, 1, 0 ], afro: [ 0.95, 0.75, 0.7, 1, -0.04 ], long: [ 0.26, 0.24, 0.2, 0, 0 ], tied: [ 0.16, 0.12, 0.1, 0, 0 ], buzz: [ 0.05, 0.04, 0.04, 0, 0.02 ], shaved: [ 0, 0, 0, 0, 1 ] };
	const HAIR_IDS3 = Object.keys(HAIR_STYLES3);
	// Painted face detail by distance: the pale parts (whites of the eyes, teeth) go by 190 units; the dark
	// marks (brows, the shade of the eye sockets, the mouth, facial hair) grow bolder from the first pair of
	// distances to the second, so the mipmapped face still reads as brows over eyes and a mouth at the
	// celebration and broadcast cameras, and only fade out between the last pair (beyond the gantry camera).
	const FACE_FADE3 = [ 150, 450, 1300, 1900 ], FACE_BOLD3 = 1.8, FACE_PALE3 = [ 70, 190 ];
	// Close-up light on skin and hair, after three.js's Lambert lighting: the flat ambient fill eases off on
	// surfaces facing down (under the brow, nose and chin), a warm band where the key light turns to shadow,
	// a rim of floodlight on the edge turned to the light, and a faint sheen. All of it fades out by
	// distance, so the broadcast camera sees the figures as before. k: [ fill, warmth, rim, sheen ].
	const SKIN_LIGHT3 = [ 1, 1, 1, 1 ], HAIR_LIGHT3 = [ 0.6, 0, 0.7, 0.5 ], BODY_LIGHT3 = [ 1, 0, 0.8, 0 ];
	function skinLight3D (fs, k) {
		return fs.replace("#include <aomap_fragment>", `#include <aomap_fragment>
			{
				vec3 sN = normalize(normal), sV = normalize(vViewPosition);
				float sNear = 1.0 - smoothstep(160.0, 560.0, length(vViewPosition));
				float sUp = dot(sN, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
				reflectedLight.indirectDiffuse *= 1.0 - ${(0.16 * k[0]).toFixed(3)} * sNear - ${(0.3 * k[0]).toFixed(3)} * sNear * (1.0 - smoothstep(-0.7, 0.5, sUp));
				reflectedLight.directDiffuse *= 1.0 + ${(0.3 * k[0]).toFixed(3)} * sNear;   // the key light carries more of the shape
				vec3 sKey = vec3(0.0); float sSheen = 0.0;
				#if NUM_DIR_LIGHTS > 0
				for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
					vec3 L = directionalLights[i].direction; float nl = dot(sN, L);
					sKey += directionalLights[i].color * smoothstep(-0.3, 0.45, nl);
					sSheen += pow(max(dot(sN, normalize(L + sV)), 0.0), 16.0) * max(nl, 0.0) * dot(directionalLights[i].color, vec3(0.3, 0.59, 0.11));
					reflectedLight.directDiffuse += directionalLights[i].color * diffuseColor.rgb * vec3(0.045, 0.014, 0.0) * ${k[1].toFixed(2)} * exp(-nl * nl / 0.06) * sNear;
				}
				#endif
				float sRim = pow(1.0 - clamp(dot(sN, sV), 0.0, 1.0), 3.0);
				reflectedLight.directDiffuse += sKey * mix(diffuseColor.rgb, vec3(1.0), 0.4) * sRim * ${(0.26 * k[2]).toFixed(3)} * sNear;
				reflectedLight.directDiffuse += vec3(1.0, 0.95, 0.88) * sSheen * ${(0.045 * k[3]).toFixed(4)} * sNear;
			}`);
	}
	function initFigures3D () {
		const T = THREE;
		const defs = {
			torso: () => loft3D(TORSO3, 16, TORSO_EX3),
			// A ribbed collar round the base of the neck, in the trim colour.
			collar: () => loft3D([ [ 9.2, 1.95, 1.62, 1.72 ], [ 9.55, 2.0, 1.66, 1.76 ], [ 10.05, 1.7, 1.48, 1.56 ], [ 10.25, 1.5, 1.3, 1.38 ] ], 12, 2.2),
			// The shorts: a waistband and seat on the hips, and a leg for each thigh (shortLeg) so they move with the stride.
			shorts: () => loft3D([ [ 1.6, 3.05, 2.02, 2.05 ], [ 1.75, 3.12, 2.08, 2.1 ], [ 0.6, 3.5, 2.15, 2.32 ], [ -0.9, 3.8, 2.18, 2.4 ], [ -1.9, 3.5, 2.0, 2.1 ], [ -2.3, 2.6, 1.6, 1.6 ] ], 12, 2.4),
			shortLeg: () => loft3D([ [ 0.9, 1.8, 1.9, 2.05 ], [ -0.6, 2.02, 2.12, 2.16 ], [ -2.5, 2.0, 2.2, 2.08, 0.1 ], [ -2.75, 2.06, 2.26, 2.12, 0.12 ], [ -2.95, 2.04, 2.22, 2.1, 0.12 ], [ -3.0, 1.62, 1.7, 1.6, 0.12 ] ], 12, 2.2),   // shorts to mid-thigh, over the fuller quads
			neck: () => loft3D([ [ -0.6, 1.6, 1.38, 1.5 ], [ 0.4, 1.42, 1.24, 1.3, -0.05 ], [ 1.4, 1.3, 1.16, 1.18, 0.05 ], [ 2.3, 1.18, 1.1, 1.1, 0.1 ], [ 2.5, 0.7, 0.7, 0.7, 0.1 ] ], 10, 2),   // a footballer's neck, not a stalk
			head: () => sculpt3D(new T.SphereGeometry(1, 48, 36)),
		ear: () => { const g = new T.SphereGeometry(0.58, 10, 8); g.scale(0.5, 1.0, 0.32); g.rotateZ(0.18); return g; },
		nose: () => noseGeo3(),
		tail: () => new T.SphereGeometry(1, 9, 7),
			hair: () => sculpt3D(new T.SphereGeometry(1, 48, 36)),   // the skull's own surface; the hair shader lifts it by style
			// Short sleeves over the shoulder (a rounded cap, the deltoid under it) ending in a cuff.
			sleeve: () => loft3D([ [ 0.5, 0.3, 0.3, 0.3 ], [ 0.36, 0.9, 0.92, 0.92 ], [ 0.0, 1.2, 1.2, 1.2 ], [ -0.5, 1.28, 1.27, 1.27 ], [ -1.9, 1.22, 1.2, 1.2 ], [ -2.35, 1.18, 1.16, 1.16 ], [ -2.4, 0.85, 0.85, 0.85 ] ], 10, 2.0),   // a fitted sleeve: the cap no higher than the shoulder line, so no pads
			// The captain's armband on the left upper arm, just below the sleeve.
			armband: () => loft3D([ [ -2.75, 1.12, 1.16, 1.14 ], [ -2.8, 1.17, 1.21, 1.19 ], [ -3.65, 1.12, 1.16, 1.12 ], [ -3.7, 1.06, 1.1, 1.06 ] ], 12, 2.0),
			cuff: () => loft3D([ [ -2.05, 1.23, 1.21, 1.21 ], [ -2.4, 1.23, 1.21, 1.21 ], [ -2.45, 0.92, 0.92, 0.92 ] ], 10, 2.0),
			upperArm: () => loft3D([ [ 0.25, 0.7, 0.7, 0.7 ], [ -0.1, 1.02, 1.0, 1.0 ], [ -1.6, 1.0, 1.1, 0.98 ], [ -3.1, 0.9, 1.06, 0.92 ], [ -4.7, 0.78, 0.8, 0.8 ], [ -5.6, 0.72, 0.72, 0.76 ], [ -6.0, 0.4, 0.4, 0.45 ] ], 9, 2.0),
			foreArm: () => loft3D([ [ 0.4, 0.55, 0.55, 0.6 ], [ 0, 0.84, 0.82, 0.88 ], [ -1.1, 0.96, 0.92, 0.98 ], [ -2.6, 0.8, 0.76, 0.78 ], [ -4.2, 0.6, 0.5, 0.52 ], [ -4.9, 0.54, 0.46, 0.46 ], [ -5.2, 0.32, 0.3, 0.3 ] ], 9, 2.0),   // muscle below the elbow, a slimmer wrist; a little shorter
			// A flat hand with the fingers together and a thumb in front.
			// A relaxed hand, half closed: the palm with a wrist and knuckles, four fingers curled forward in
			// two bends (shorter at the little finger), and a thumb along the side of the index finger.
			hand: () => {
				const palm = loft3D([ [ 0.3, 0.36, 0.4, 0.4 ], [ -0.1, 0.42, 0.5, 0.48 ], [ -0.8, 0.52, 0.55, 0.5 ], [ -1.35, 0.58, 0.52, 0.48 ], [ -1.55, 0.52, 0.46, 0.42 ] ], 10, 2.4);
				const parts = [ palm ];
				[ [ 0.36, 1.0 ], [ 0.12, 1.06 ], [ -0.12, 1.0 ], [ -0.36, 0.86 ] ].forEach(([ z, k ]) => {
					const f1 = loft3D([ [ 0, 0.13, 0.15, 0.14 ], [ -0.55 * k, 0.12, 0.14, 0.13 ], [ -0.62 * k, 0.1, 0.12, 0.1 ] ], 6, 2);
					f1.rotateZ(-0.7); f1.translate(0, -1.45, z);
					const f2 = loft3D([ [ 0, 0.12, 0.13, 0.12 ], [ -0.5 * k, 0.1, 0.11, 0.1 ], [ -0.58 * k, 0.05, 0.06, 0.05 ] ], 6, 2);
					f2.rotateZ(-1.5); f2.translate(-0.36 * k, -1.62 - 0.2 * k, z);
					parts.push(f1, f2);
				});
				const th = loft3D([ [ 0.1, 0.17, 0.18, 0.18 ], [ -0.35, 0.18, 0.2, 0.2 ], [ -0.85, 0.14, 0.16, 0.15 ], [ -0.98, 0.06, 0.07, 0.07 ] ], 6, 2);
				th.rotateZ(-0.45); th.rotateX(-0.35); th.translate(-0.3, -0.55, 0.42);
				parts.push(th);
				return merge3D(parts);
			},
			thigh: () => loft3D([ [ 0.9, 1.5, 1.5, 1.6 ], [ -0.6, 1.88, 1.98, 1.86 ], [ -2.6, 1.82, 2.1, 1.78 ], [ -4.6, 1.56, 1.86, 1.5 ], [ -6.3, 1.2, 1.38, 1.14 ], [ -7.0, 1.08, 1.2, 1.02 ], [ -7.35, 0.9, 0.95, 0.88 ], [ -7.45, 0.5, 0.5, 0.5 ] ], 12, 2.0),   // ends inside the kneecap, never into the sock   // a footballer's quads: full above the knee, the front bulging
			knee: () => { const g = new T.SphereGeometry(1.02, 14, 10); g.scale(1.08, 1.0, 1.02); g.translate(0.08, -0.15, 0); return g; },
			// The sock over the calf and the shin pad: the calf bulges behind, the pad stands proud in front.
			shin: () => loft3D([ [ -0.6, 1.08, 1.05, 1.1 ], [ -1.3, 1.16, 1.3, 1.48 ], [ -2.6, 1.1, 1.34, 1.46 ], [ -3.8, 0.94, 1.24, 1.06 ], [ -4.4, 0.8, 0.86, 0.84 ], [ -5.6, 0.7, 0.7, 0.72 ], [ -6.5, 0.68, 0.66, 0.7 ], [ -6.9, 0.45, 0.45, 0.45 ] ], 10, 2.1),   // the calf full behind, tapering to the ankle
			// The sock turned over below the knee, in the trim colour.
			band: () => loft3D([ [ -0.5, 1.15, 1.14, 1.18 ], [ -0.65, 1.19, 1.2, 1.25 ], [ -1.15, 1.24, 1.38, 1.52 ], [ -1.35, 1.26, 1.42, 1.58 ], [ -1.4, 1.18, 1.32, 1.48 ] ], 10, 2.1),   // always just outside the calf under it, so the leg never shows through the fold
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
		// The rest of him (arms, legs, kit) takes the same close-up shaping as the head, without the skin's
		// warmth and sheen, so a face never looks lit differently from the arm beside it.
		const plain = new T.MeshLambertMaterial({ color: 0xffffff });
		plain.onBeforeCompile = sh => { sh.fragmentShader = skinLight3D(sh.fragmentShader, BODY_LIGHT3); };
		plain.customProgramCacheKey = () => "ff-body";
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
					diffuseColor.rgb = mix(diffuseColor.rgb, vCol2, km);
					diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(-0.6, 6.8, vKp.y);   // cloth in shade toward the hem, under the chest`);
			sh.fragmentShader = skinLight3D(sh.fragmentShader, BODY_LIGHT3);
		};
		shirtMat.customProgramCacheKey = () => "ff-shirt";
		// Faces: an atlas of sixteen, each also open-mouthed, painted once (eyes, brows, a nose, a mouth,
		// facial hair on some), wrapped round the head sphere with the face at the front. Each figure picks its cell
		// with an instanced attribute; the painted parts are laid over the skin colour, the rest is skin.
		const fc = document.createElement("canvas"); fc.width = 1024; fc.height = 1024;
		const fg = fc.getContext && fc.getContext("2d");
		if (fg) {
			for (let v = 0; v < FACES3 * 2; v++) { paintFace3D(fg, (v % 4) * 256, Math.floor(v / 4) * 128, v % FACES3, v >= FACES3); }
		}
		const faceTex = tex3D(fc);
		faceTex.minFilter = T.LinearMipmapLinearFilter; faceTex.magFilter = T.LinearFilter; faceTex.generateMipmaps = true;   // mipmaps: at mid distance the eyes and brows blur to dark marks rather than flicker out
		const headMat = new T.MeshLambertMaterial({ color: 0xffffff, map: faceTex });
		headMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aFace; attribute float aJaw; varying float vFaceD; varying float vFaceI;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + vec2(mod(max(aFace, 0.0), 4.0), 7.0 - floor(max(aFace, 0.0) / 4.0))) / vec2(4.0, 8.0); vFaceI = aFace;")
				.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.z *= mix(1.0, aJaw, pow(clamp((2.25 - transformed.y) / 2.4, 0.0, 1.0), 2.0));")
				.replace("#include <project_vertex>", "#include <project_vertex>\nvFaceD = -mvPosition.z;");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <common>", "#include <common>\nvarying float vFaceD; varying float vFaceI;")
				.replace("#include <map_fragment>", "")
				.replace("#include <color_fragment>", `#include <color_fragment>\nvec4 fx = vFaceI < -0.5 ? vec4(0.0) : texture2D(map, vMapUv); float fxL = dot(fx.rgb - diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); float fxP = smoothstep(0.0, 0.08, fxL); diffuseColor.rgb = mix(diffuseColor.rgb, fx.rgb, min(0.92, fx.a * (1.0 + ${FACE_BOLD3.toFixed(2)} * (1.0 - fxP) * smoothstep(${FACE_FADE3[0].toFixed(1)}, ${FACE_FADE3[1].toFixed(1)}, vFaceD))) * (1.0 - smoothstep(mix(${FACE_FADE3[2].toFixed(1)}, ${FACE_PALE3[0].toFixed(1)}, fxP), mix(${FACE_FADE3[3].toFixed(1)}, ${FACE_PALE3[1].toFixed(1)}, fxP), vFaceD)));`);   // anything lighter than the skin (the whites of the eyes, teeth) goes first, before it reads as a pale dot; the dark marks grow bolder with distance
			sh.fragmentShader = skinLight3D(sh.fragmentShader, SKIN_LIGHT3);
		};
		headMat.customProgramCacheKey = () => "ff-face";
		// The hair: the skull's surface lifted along its normal by the style's thickness (aHairA: over the top,
		// at the sides, over the brow, curl; aHairB: how far the hairline is raised), tapering to nothing at the
		// hairline and dipping under the skin beyond it. A little strand-to-strand variation in the shade.
		const hairMat = new T.MeshLambertMaterial({ color: 0xffffff });
		hairMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute vec3 aDir; attribute vec4 aHairA; attribute float aHairB; attribute float aJaw; varying vec3 vHd;")
				.replace("#include <begin_vertex>", `#include <begin_vertex>
					vec3 d = aDir;
					// the hairline: high on the forehead, down to the top of the ear at the side (a narrow
					// sideburn in front of it), low at the nape
					float line = d.x > 0.0 ? mix(0.06, 0.57, pow(d.x, 0.85)) : mix(0.06, -0.46, pow(-d.x, 1.2));
					line += 0.08 * smoothstep(0.35, 0.75, d.x) * exp(-pow((abs(d.z) - 0.4) / 0.16, 2.0));   // the corners of the forehead set back, so the hairline is rounded, not a fringe ruled across the brow
					float earZone = exp(-pow((d.x + 0.04) / 0.22, 2.0)) * smoothstep(0.55, 0.9, abs(d.z));
					float burn = exp(-pow((d.x - 0.2) / 0.06, 2.0)) * smoothstep(0.6, 0.9, abs(d.z));
					line = mix(line, 0.22, earZone);
					line = mix(line, -0.12, burn) + aHairB;
					vCov = d.y - line;
					float body = smoothstep(0.0, 0.22, vCov);
					float th = mix(aHairA.y, aHairA.x, smoothstep(0.05, 0.75, d.y));
					th = mix(th, aHairA.z, smoothstep(0.25, 0.75, d.x) * smoothstep(0.25, 0.6, d.y));
					th += aHairA.w * 0.1 * sin(d.x * 23.0) * sin(d.y * 21.0) * sin(d.z * 25.0);
					transformed += objectNormal * (0.03 + max(th, 0.0) * body);
					transformed.z *= mix(1.0, aJaw, pow(clamp((2.25 - transformed.y) / 2.4, 0.0, 1.0), 2.0));
					vHd = d;`);
			sh.vertexShader = sh.vertexShader.replace("varying vec3 vHd;", "varying vec3 vHd; varying float vCov;");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <common>", "#include <common>\nvarying vec3 vHd; varying float vCov; float ffHash (vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }")
				.replace("#include <color_fragment>", `#include <color_fragment>
					if (vCov < 0.035 * (ffHash(vHd * 140.0) - 0.35)) { discard; }   // a soft, slightly ragged hairline cut per pixel, never a triangle's edge
					diffuseColor.rgb *= 0.84 + 0.16 * ffHash(vHd * vec3(70.0, 90.0, 70.0));
					diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.12, vCov);   // thinner, darker at the line`);
			sh.fragmentShader = skinLight3D(sh.fragmentShader, HAIR_LIGHT3);
		};
		hairMat.customProgramCacheKey = () => "ff-hair";
		// The neck, ears and nose take the head's light, so there is no seam where they meet it.
		const skinMat = new T.MeshLambertMaterial({ color: 0xffffff });
		skinMat.onBeforeCompile = sh => { sh.fragmentShader = skinLight3D(sh.fragmentShader, SKIN_LIGHT3); };
		skinMat.customProgramCacheKey = () => "ff-skin";
		const parts = {}, white = new T.Color(1, 1, 1);
		for (const name of Object.keys(defs)) {
			const geo = defs[name], cap = MAXF3 * PER_FIG3[name];
			const g = geo();
			if (name === "torso") {
				g.setAttribute("aPat", new T.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(T.DynamicDrawUsage));
				g.setAttribute("aCol2", new T.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(T.DynamicDrawUsage));
			}
			const ia = (n, k) => g.setAttribute(n, new T.InstancedBufferAttribute(new Float32Array(cap * k), k).setUsage(T.DynamicDrawUsage));
			if (name === "head") { ia("aFace", 1); ia("aJaw", 1); }
			if (name === "hair") { ia("aHairA", 4); ia("aHairB", 1); ia("aJaw", 1); }
			const m = new T.InstancedMesh(g, name === "torso" ? shirtMat : name === "head" ? headMat : name === "hair" ? hairMat : name === "neck" || name === "ear" || name === "nose" ? skinMat : plain, cap);
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
		// Names across the shoulders, above the number: one atlas cell per figure, repainted when the names change.
		const nmc = document.createElement("canvas"); nmc.width = 1024; nmc.height = 512;
		const nameTex = tex3D(nmc);
		const nameMat = new T.MeshLambertMaterial({ map: nameTex, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
		nameMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aCell;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + vec2(mod(aCell, 4.0), 7.0 - floor(aCell / 4.0))) / vec2(4.0, 8.0);");
		};
		nameMat.customProgramCacheKey = () => "ff-name";
		const nmg = new T.PlaneGeometry(4.6, 1.15, 8, 1).rotateY(-Math.PI / 2).translate(0, 8.35, 0), MP = nmg.attributes.position;
		for (let i = 0; i < MP.count; i++) { MP.setX(i, -backDepth3D(MP.getY(i), MP.getZ(i)) - 0.06); }
		nmg.computeVertexNormals();
		nmg.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(MAXF3), 1).setUsage(T.DynamicDrawUsage));
		const names = new T.InstancedMesh(nmg, nameMat, MAXF3);
		names.instanceMatrix.setUsage(T.DynamicDrawUsage); names.frustumCulled = false; names.count = 0;
		G3.scene.add(names);
		// The chest print, curved onto the front of the shirt like the number on the back.
		const cc = document.createElement("canvas"); cc.width = 512; cc.height = 256;
		const chestTex = tex3D(cc);
		const chestMat = new T.MeshLambertMaterial({ map: chestTex, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
		chestMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aRow;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = vec2(uv.x, (uv.y + 1.0 - aRow) * 0.5);");
		};
		chestMat.customProgramCacheKey = () => "ff-chest";
		const cg = new T.PlaneGeometry(5.6, 2.8, 8, 4).rotateY(Math.PI / 2).translate(0, 6.1, 0), CP = cg.attributes.position;
		for (let i = 0; i < CP.count; i++) { CP.setX(i, frontDepth3D(CP.getY(i), CP.getZ(i)) + 0.06); }
		cg.computeVertexNormals();
		cg.setAttribute("aRow", new T.InstancedBufferAttribute(new Float32Array(MAXF3), 1).setUsage(T.DynamicDrawUsage));
		const chest = new T.InstancedMesh(cg, chestMat, MAXF3);
		chest.instanceMatrix.setUsage(T.DynamicDrawUsage); chest.frustumCulled = false; chest.count = 0;
		G3.scene.add(chest);
		// A kit-coloured ring at each player's feet (it keeps the sides readable from the gantry) and a soft shadow.
		const rings = new T.InstancedMesh(G3.geo.ring, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.36, depthWrite: false }), MAXF3);   // the side's ring under each man: a hint, not a halo
		const blobs = new T.InstancedMesh(G3.geo.shadow, new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }), MAXF3);
		// Under four floodlights a player throws four faint shadows, one away from each (as many as the Graphics setting draws).
		// The floodlight shadows: darkest at his feet and fading out toward the tip with soft sides, as a
		// shadow from a lamp a long way off does; an even grey ellipse read as four dark legs round each man.
		const lsc = document.createElement("canvas"); lsc.width = 64; lsc.height = 32;
		const lsg = lsc.getContext && lsc.getContext("2d");
		if (lsg) { const im = lsg.createImageData(64, 32); for (let y = 0; y < 32; y++) { for (let x = 0; x < 64; x++) { const u = x / 63, v = Math.abs(y / 31 - 0.5) * 2, a = Math.pow(1 - u, 1.4) * (1 - v * v) * Math.min(1, u * 8 + 0.3); im.data[(y * 64 + x) * 4 + 3] = Math.round(255 * a); } } lsg.putImageData(im, 0, 0); }
		const longs = new T.InstancedMesh(G3.geo.shadow, new T.MeshBasicMaterial({ color: 0x000000, map: lsg ? new T.CanvasTexture(lsc) : null, transparent: true, opacity: lsg ? 0.2 : 0.12, depthWrite: false }), MAXF3 * 4);
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
			const sh = [ node(chest, 0, 2.75, -4.35), node(chest, 0, 2.75, 4.35) ], el = sh.map(s => node(s, 0, -5.6, 0)), ha = el.map(e => node(e, 0, -4.95, 0));
			const hip = [ node(hips, 0, -1.0, -2.45), node(hips, 0, -1.0, 2.45) ], kn = hip.map(h => node(h, 0, -7.3, 0)), an = kn.map(k => node(k, 0, -6.5, 0));
			rigs.push({ root, hips, spine, chest, neck, head, sh, el, ha, hip, kn, an });
		}
		G3.fig = { parts, nums, chest, chestCv: cc, chestTex, chestKey: '', names, nameCv: nmc, nameTex, nameKeys: [], rings, blobs, longs, flags, rigs, cnt: {}, n: 0, M: new T.Matrix4(), M2: new T.Matrix4(), C: new T.Color(), V: new T.Vector3(), S: new T.Vector3(), Q: new T.Quaternion(), prevDir: new WeakMap(), yawSt: new WeakMap() };
	}
	// The arm axes, measured: +z on a shoulder swings the arm forward, and +x on the right shoulder
	// (i = 1) or -x on the left (i = 0) brings it IN across the body. So "out to the side" is OUT3(i).
	const OUT3 = i => (i ? -1 : 1);
	// Reset a rig to standing.
	function resetRig3D (r) {
		r.hips.position.set(0, 15.6, 0); r.hips.rotation.set(0, 0, 0);
		r.spine.rotation.set(0, 0, 0); r.chest.rotation.set(0, 0, 0); r.neck.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
		for (let i = 0; i < 2; i++) { r.sh[i].rotation.set(0, 0, 0); r.el[i].rotation.set(0, 0, 0); r.ha[i].rotation.set(0, 0, 0); r.hip[i].rotation.set(0, 0, 0); r.kn[i].rotation.set(0, 0, 0); r.an[i].rotation.set(0, 0, 0); }
		r.root.rotation.set(0, 0, 0); r.root.position.set(0, 0, 0); r.root.scale.setScalar(1);
	}
	// Which way shadows fall on the grass: away from the main key light (high over the near stand,
	// toward the far side of the pitch), as a unit (x, z).
	const sunDir3D = () => { const dx = FW * 0.7, dz = -FH * 1.1, l = Math.hypot(dx, dz) || 1; return [ dx / l, dz / l ]; };
	const smooth3 = t => t * t * (3 - 2 * t);
	const lerp3 = (a, b, t) => a + (b - a) * t;
	// A footballer's pose from the simulation: the run (its stride and how hard he is running), the
	// idle weight shift, the keeper's set, a kick (pass or shot, its backswing from the power), a
	// throw-in, a header, a slide, the keeper's dive, a fall when fouled, and the celebrations.
	function pose3D (r, p, x, z, dir, turn, ballNear, ballYaw = 0, lead = 0) {
		const acc = r.acc || 0; r.acc = 0;   // set by the player loop for this frame only
		resetRig3D(r);
		const rm = reduceMotion;
		const spd = Math.hypot(p.vx || 0, p.vy || 0);
		const a = clamp(p.runAmt || 0, 0, 1), ph = rm ? 0 : p.stride || 0, jump = rm ? 0 : jumpAmt(p);
		const shuf = clamp(p.shuf || 0, 0, 1), cel = r.cel = clamp(p.celebA || 0, 0, 1), kneel = clamp(p.kneel || 0, 0, 1), sulk = clamp(p.sulk || 0, 0, 1);
		const down = (p.lunge > 0 && players.indexOf(p) === ctrl) || p.slideAI > 0;
		const fall = p.fall > 0 ? 1 - p.fall / FALL_T : -1, dive = p.dive > 0 ? 1 - p.dive / DIVE_T : -1, thr = p.throwA > 0 ? 1 - p.throwA / THROW_T : -1;
		const idle = rm ? 0 : p.idlePh || 0, gk = p.role === "gk";
		let y = 0, ox = 0, oz = 0;   // ox, oz: the figure drawn off his spot for a moment (a dive stretching to the ball)
		// The running cycle: hips swing the thighs, knees fold on the recovery, arms counter-swing.
		// Each man runs his own way (gv): arm carriage, elbow bend, bounce, lean and twist.
		const gv = p.build && p.build.arm !== undefined ? p.build : { arm: 1, elbow: 0, lean: 0, bounce: 1, twist: 1 };
		const armA = (0.25 + 0.65 * a) * (1 - 0.5 * shuf) * gv.arm;
		for (let i = 0; i < 2; i++) {
			const phi = ph + (i ? Math.PI : 0), sn = Math.sin(phi);
			// The arm: the upper arm swings further back than forward, and the forearm is steered to an angle
			// (from hanging straight down) rather than the elbow to a fixed bend, so the hand comes through
			// from beside the hip (about 0.95 rad) to chest height in front (about 1.85) with the elbow near
			// a right angle, never reaching out straight or trailing behind the body.
			const sw = -sn, run = clamp((a - 0.12) / 0.35, 0, 1);
			// Measured on the rig (hand against shoulder, in his own frame, running at 0.8): the front hand
			// comes up to the lower chest about 6.5 ahead and a little in toward the middle; the back hand is
			// by the hip, level with the shoulder line, while the upper arm stays within 25 degrees of
			// vertical behind. The forearm hangs nearer straight down behind (about 0.45 rad) and comes up
			// toward the horizontal in front (about 1.6), so neither hand is held out in front the whole way round.
			r.sh[i].rotation.z = armA * (sw > 0 ? 0.48 * sw : 0.5 * sw);
			// Sideways (OUT3): the arms hang a little away from the sides, coming in as they swing forward.
			r.sh[i].rotation.x = OUT3(i) * (0.12 + 0.05 * a - 0.2 * a * clamp(sw, 0, 1));
			const fore = 0.42 + 1.18 * (sw + 1) / 2 + gv.elbow * 0.5;
			r.el[i].rotation.z = lerp3(0.45 + gv.elbow + 0.5 * a, clamp(fore - r.sh[i].rotation.z, 0.75, 1.75), run);
		}
		// The legs are placed once the crouches below are known (go: lower the hips, feet wider, one foot eased forward...).
		const go = { crouch: 0, wide: 0, fwd: [ 0, 0 ], lift: [ 0, 0 ], toe: [ 0, 0 ] };
		r.spine.rotation.z = -(0.06 + 0.2 * a * a + gv.lean * a);   // measured on the rig: -z on the spine leans him forward (forward is +x, the toe and the nose)
		// The pelvis turns with the leading leg and the shoulders against it; the head stays steady.
		// A little roll and sideways shift of the hips onto the standing leg.
		if (!rm && a > 0.05) {
			const tw = Math.sin(ph) * a * (1 - 0.5 * shuf) * gv.twist;
			r.hips.rotation.y = -0.14 * tw; r.chest.rotation.y = 0.34 * tw; r.neck.rotation.y = -0.18 * tw;
			r.hips.rotation.x += 0.05 * Math.cos(ph) * a; r.hips.position.z = 0.35 * Math.cos(ph) * a;
		}
		// Speeding up he leans into it; braking, he sits back (r.acc from the caller, smoothed).
		if (!rm && acc) { r.spine.rotation.z -= clamp(acc * 2.2, -0.16, 0.2); }
		// Standing, nobody stands to attention: weight on one leg (hips over it, the other knee eased
		// and that hip dropped, the shoulders tilted back against it), a slight turn, his own elbow bend,
		// breathing. Run out of legs and he stands bent over with his hands on his knees.
		const acting = p.kickA > 0 || p.windUp > 0 || thr >= 0 || jump > 0 || down || dive >= 0 || fall >= 0 || cel > 0;
		const still = rm || acting ? 0 : clamp(1 - a * 5, 0, 1) * (1 - shuf);
		if (still > 0 && !gk) {
			const sd = p.build ? p.build.seed : 0.5, side = sd < 0.5 ? 0 : 1, sgn = side ? 1 : -1, free = 1 - side;
			r.hips.position.z += sgn * 0.55 * still; r.hips.rotation.x -= sgn * 0.06 * still; r.chest.rotation.x += sgn * 0.05 * still;
			go.fwd[free] += 1.3 * still; go.lift[free] += 0.25 * still; go.toe[free] -= 0.2 * still; go.crouch += 0.15 * still;   // the free foot eased forward, its knee soft and heel light
			r.chest.rotation.y += (sd - 0.5) * 0.4 * still;
			r.spine.rotation.z += Math.sin(idle * 1.3) * 0.015 * still;
			for (let i = 0; i < 2; i++) { r.el[i].rotation.z += (0.1 + 0.3 * ((sd * 7.3 + i * 0.31) % 1)) * still; r.sh[i].rotation.x += OUT3(i) * 0.04 * still; }   // arms eased away from the sides
			const calm = state !== "play" || freeze > 0;   // only at a stoppage: in open play a tired man stays upright
			const w = p.team >= 0 && calm ? clamp((0.6 - staOf(p)) / 0.25, 0, 1) * still : 0;
			if (w > 0) {
				r.spine.rotation.z -= 0.5 * w; go.crouch += 1.1 * w; r.neck.rotation.z += 0.35 * w;
				for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.32, w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * 0.08, w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.1, w); }
			}
		}
		// Cornering he leans into the turn, the whole body from the feet (and the pelvis a little more).
		const bank = rm ? 0 : clamp(turn * 6 * clamp(spd / 2, 0, 1.5), -0.32, 0.32);
		r.root.rotation.x = 0.7 * bank; r.hips.rotation.x += 0.3 * bank;
		r.neck.rotation.z = -r.spine.rotation.z * 0.85;   // the head stays near level, eyes up the pitch, whatever the lean
		if (a < 0.2) { r.chest.rotation.y = Math.sin(idle * 0.5) * 0.05; r.sh[0].rotation.z += Math.sin(idle) * 0.03; r.sh[1].rotation.z -= Math.sin(idle) * 0.03; r.head.rotation.y = Math.sin(idle * 0.37) * 0.25; }
		// Planting to stop or cut: knees bent, weight back, feet wide for a few frames.
		const plant = !rm && p.plant > 0 && !down && jump <= 0 ? p.plant / 10 : 0;
		if (plant > 0) {
			r.spine.rotation.z += 0.28 * plant; go.crouch += 1.6 * plant; go.wide += 0.5 * plant;
			for (let i = 0; i < 2; i++) { go.fwd[i] += 2.2 * plant; }   // the feet dug in ahead of him, weight back over them
		}
		// Flat out: leaning further in, the arms pumping higher and tighter.
		const sp = clamp(p.sprintAmt || 0, 0, 1) * a;
		if (sp > 0) { r.spine.rotation.z -= 0.14 * sp; for (let i = 0; i < 2; i++) { r.el[i].rotation.z += 0.15 * sp; r.sh[i].rotation.z *= 1 + 0.25 * sp; } }
		// Never a hand up by the face: the elbow stays near a right angle, the upper arm comes
		// through to about 55 degrees forward and 50 back (the kick, throw and celebrations set their own).
		// Running, the hand comes through to chest height, not the chin: the upper arm swings forward
		// less than back (about 0.55 rad against 0.95), and the more it is forward the less the elbow
		// folds, so the forearm never points at the sky.
		// The arms swing from the chest, which leans forward as he runs: without taking the lean back
		// off, the backswing would point the upper arm 60 degrees or more behind him and the hands would
		// trail off his back. So, running, the swing is measured from straight down, not from the torso.
		const lean = rm || acting ? 0 : clamp(-r.spine.rotation.z, 0, 0.5) * clamp((a - 0.12) / 0.35, 0, 1);   // a forward lean (-z) swings the arms back with the chest: add it back
		// The arm swing's centre is carried a little forward as he leans into his running (0.22 rad), so the
		// backswing stays within about 25 degrees behind vertical.
		const carry = rm || acting ? 0 : 0.05 * clamp((a - 0.12) / 0.35, 0, 1);
		for (let i = 0; i < 2; i++) {
			r.sh[i].rotation.z = clamp(r.sh[i].rotation.z + lean + carry, -0.95 + lean, 0.62 + lean + carry);
			r.el[i].rotation.z = Math.min(r.el[i].rotation.z, 1.8, 2.0 - Math.max(0, r.sh[i].rotation.z - lean));
		}
		// Eyes on the ball: the head turns toward it when it is near, and drops to the feet on the ball.
		if (!rm && ball && fall < 0 && dive < 0 && thr < 0 && cel <= 0 && !down) {
			if (ball.owner === p) {
				r.neck.rotation.z -= 0.2;
			} else {
				r.head.rotation.y += ballYaw;
			}
		}
		// Reactions (set by moment()): hands on his head after a near miss, a fist pumped after a big
		// tackle. The angles are measured on the rig: shoulder forward 2.3 and out 0.8, elbow 1.9 puts
		// the hand on the crown.
		if (!rm && !acting && cel <= 0 && !down) {
			const hh = p.headHands > 0 ? clamp(p.headHands / 20, 0, 1) * clamp((95 - p.headHands) / 8, 0, 1) : 0;
			if (hh > 0) {
				for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 2.3, hh); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 0.8, hh); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 1.9, hh); }
				r.neck.rotation.z += 0.25 * hh;   // and he looks up at the sky (+z on the neck tips the head back)
			}
			const fp = p.fistPump > 0 ? clamp(p.fistPump / 12, 0, 1) * clamp((55 - p.fistPump) / 6, 0, 1) : 0;
			if (fp > 0) {
				const i = 1, pump = 0.25 * Math.sin((50 - p.fistPump) * 0.45);
				r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.55 + pump, fp); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 0.25, fp); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 2.25, fp);
				r.chest.rotation.y -= 0.12 * fp;
			}
		}
		// Off the ball and on it: receiving a pass, shielding it, jockeying the man on it. Each eases in
		// and out (p.jockW / p.shieldW are visual state, smoothed here) and gives way to any action.
		if (!rm && !acting && cel <= 0 && !down && p.team >= 0 && p.role !== "staff" && state === "play") {
			const o = ball && ball.owner, wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
			// Jockeying: goal-side of the carrier, facing him, not flat out: crouched, side-on, arms out.
			let jw = 0;
			if (o && o.team !== p.team && !gk && o.role !== "gk") {
				const d = dist(p, o), facing = Math.cos(wrap(Math.atan2(o.y - p.y, o.x - p.x) - (p.dir || 0)));
				jw = clamp((55 - d) / 15, 0, 1) * clamp((facing - 0.5) / 0.3, 0, 1) * clamp((0.75 - a) / 0.35, 0, 1);
			}
			p.jockW = (p.jockW || 0) + (jw - (p.jockW || 0)) * 0.15;
			const J = p.jockW;
			if (J > 0.02) {
				r.spine.rotation.z -= 0.18 * J; r.hips.rotation.y += 0.32 * J; r.chest.rotation.y -= 0.18 * J;
				go.crouch += 1.6 * J; go.wide += 1.0 * J; go.fwd[1] += 2.2 * J; go.fwd[0] -= 2.2 * J;   // low and side-on, feet apart, one foot ahead of the other
				for (let i = 0; i < 2; i++) { r.sh[i].rotation.x += OUT3(i) * 0.32 * J; r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.25, J); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.7, J); }
			}
			// Shielding: on the ball, slow, a man at his shoulder or behind: low, and the arm on that side out to hold him off.
			let sw = 0, side = 1;
			if (o === p && !gk) {
				let near = null, nd = 1e9;
				for (const q of players) { if (q.team !== p.team && q.role !== "gk") { const d = dist(p, q); if (d < nd) { nd = d; near = q; } } }
				if (near) {
					const rel = wrap(Math.atan2(near.y - p.y, near.x - p.x) - (p.dir || 0));
					sw = clamp((32 - nd) / 10, 0, 1) * clamp((Math.abs(rel) - 0.9) / 0.4, 0, 1) * clamp((0.7 - a) / 0.3, 0, 1);
					side = rel * (r.mir || 1) > 0 ? 1 : 0;   // which of his arms faces the man (the pitch can be mirrored)
				}
			}
			p.shieldW = (p.shieldW || 0) + (sw - (p.shieldW || 0)) * 0.15;
			p.shieldSide = sw > 0 ? side : (p.shieldSide ?? 1);
			const S2 = p.shieldW;
			if (S2 > 0.02) {
				const i = p.shieldSide;
				r.spine.rotation.z -= 0.12 * S2; r.chest.rotation.y += (i ? -1 : 1) * 0.25 * S2;
				go.crouch += 1.1 * S2; go.wide += 0.7 * S2;
				r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 0.95, S2); r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.15, S2); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.35, S2);
			}
		}
		// The keeper on his toes when the ball is near: knees bent, feet apart, hands ready (the arms below).
		const gSet = gk && ballNear > 0 && !down && jump <= 0 && fall < 0 && dive < 0 && !(p.kickA > 0) ? ballNear * (1 - a) : 0;
		if (gSet > 0) { go.crouch += 2.6 * gSet; go.wide += 1.3 * gSet; go.toe[0] -= 0.15 * gSet; go.toe[1] -= 0.15 * gSet; }   // up on the balls of his feet
		// The legs: each foot set down and carried through (see gait3), the hips as high as the planted feet allow.
		const G = r.gait = gait3(rm ? Object.assign(Object.create(p), { vx: 0, vy: 0 }) : p, ph, dir, r.mir || 1, go);
		legsTo3(r, G);
		// Each touch on the run: the foot coming through reaches on and flicks the ball ahead.
		if (!rm && ball && ball.owner === p && !acting && p.touchPh !== undefined && a > 0.2) {
			const tap = Math.max(0, 1 - p.touchPh / 0.22), i = G.feet[0].st ? 1 : 0, f = G.feet[i];
			if (tap > 0 && !f.st) { footTo3(r, i, f.x + 2.4 * tap, Math.max(ANK3, f.y - 0.8 * tap), f.z, f.toe - 0.35 * tap); }
		}
		if (!rm && !acting && cel <= 0 && !down && p.team >= 0 && p.role !== "staff" && state === "play") {
			const o = ball && ball.owner;
			// Receiving: the first few frames after a pass reaches him (p.recvK, chosen in gainBall). On the
			// chest he leans back, arms out; on the thigh the knee comes up to waist height; under the sole the
			// foot reaches forward, toes up; with the inside of the foot the leg turns out to cushion it; turning,
			// the hips open toward goal as the foot drags it round; a heavy touch, he lunges after it.
			const K = p.recvK || (p.recv === 2 ? "chest" : "inside"), win = K === "chest" || K === "thigh" ? 22 : 18;
			const since = p.recv && p.gotAt !== undefined ? frame - p.gotAt : 99, rk = since < win ? Math.sin(Math.PI * clamp(since / win, 0, 1)) : 0;
			if (rk > 0 && o === p) {
				const f = build(p).left ? 0 : 1;
				if (K === "chest") {
					r.spine.rotation.z += 0.36 * rk; r.neck.rotation.z -= 0.3 * rk;   // measured: +z on the spine takes the head back, -z on the neck tips the chin down to the ball
					for (let i = 0; i < 2; i++) { r.kn[i].rotation.z -= 0.22 * rk; r.sh[i].rotation.x += OUT3(i) * 0.8 * rk; r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.1, rk); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.5, rk); }
				} else if (K === "thigh") {
					r.hip[f].rotation.z += 1.25 * rk; r.kn[f].rotation.z -= 1.35 * rk; r.an[f].rotation.z += 0.2 * rk; r.kn[1 - f].rotation.z -= 0.2 * rk;
					r.spine.rotation.z += 0.1 * rk; r.neck.rotation.z -= 0.3 * rk;
					for (let i = 0; i < 2; i++) { r.sh[i].rotation.x += OUT3(i) * 0.6 * rk; }
				} else if (K === "sole") {
					r.hip[f].rotation.z += 0.85 * rk; r.kn[f].rotation.z -= 0.4 * rk; r.an[f].rotation.z += 0.6 * rk; r.kn[1 - f].rotation.z -= 0.15 * rk;
					r.spine.rotation.z += 0.05 * rk; r.neck.rotation.z -= 0.25 * rk;
					for (let i = 0; i < 2; i++) { r.sh[i].rotation.x += OUT3(i) * 0.35 * rk; }
				} else if (K === "heavy") {
					r.hip[f].rotation.z += 0.95 * rk; r.kn[f].rotation.z -= 0.25 * rk; r.an[f].rotation.z += 0.1 * rk; r.kn[1 - f].rotation.z -= 0.3 * rk;
					r.spine.rotation.z -= 0.2 * rk;   // lunging forward after it
					for (let i = 0; i < 2; i++) { r.sh[i].rotation.x += OUT3(i) * 0.65 * rk; }
				} else {
					r.hip[f].rotation.z += 0.65 * rk; r.kn[f].rotation.z -= 0.8 * rk; r.an[f].rotation.z += 0.3 * rk; r.spine.rotation.z += 0.08 * rk; r.neck.rotation.z -= 0.2 * rk;
					r.hip[f].rotation.y += OUT3(f) * 0.75 * rk;   // the leg turned out: the inside of the boot to the ball
					for (let i = 0; i < 2; i++) { r.sh[i].rotation.x += OUT3(i) * 0.4 * rk; }
					if (K === "turn" && p.turnTo !== undefined) {
						const tw = -Math.sign(Math.atan2(Math.sin(p.turnTo - (p.dir || 0)), Math.cos(p.turnTo - (p.dir || 0)))) * (r.mir || 1);
						r.hips.rotation.y += 0.5 * tw * rk; r.chest.rotation.y += 0.35 * tw * rk; r.neck.rotation.y += 0.3 * tw * rk;
					}
				}
			}
		}
		// Turning: the head and then the chest come round first, the hips follow.
		if (!rm && lead && fall < 0 && dive < 0 && !down) { r.chest.rotation.y += lead * 0.35; r.neck.rotation.y += lead * 0.3; }
		if (gSet > 0) {
			const g = gSet;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z += 0.75 * g; r.sh[i].rotation.x += OUT3(i) * 0.35 * g; r.el[i].rotation.z += 0.6 * g; }
			r.spine.rotation.z -= 0.3 * g;
		}
		// Kicking (see kickPose3): the standing foot beside the ball, the leg back, through the ball on the
		// frame it goes and up after it; the arms open for balance, the hips wind and unwind against the
		// shoulders, over the ball for a drive, back under it for a chip or a clearance.
		const kp = rm || jump > 0 || down ? null : kickPose3(r, p, G, x, z, dir);
		if (kp) {
			const { kf, pl, sk, pow, bw, fw, S } = kp, u = 1 - kp.w, sw = r.hip[kf].rotation.z;
			r.hips.rotation.y += sk * (-0.34 * bw + 0.4 * fw) * u; r.chest.rotation.y -= sk * (-0.22 * bw + 0.3 * fw) * u;
			r.spine.rotation.z = lerp3(r.spine.rotation.z, S.lean * (0.6 + 0.4 * pow) * (0.5 + 0.5 * Math.max(bw, fw)) - 0.08, u);
			r.root.rotation.x -= sk * (S.side || 0) * 0.55 * fw * u;   // a volley: leaning away from the leg as it comes round
			r.neck.rotation.z -= 0.18 * u;   // eyes down on the ball
			r.sh[pl].rotation.z = lerp3(r.sh[pl].rotation.z, 0.25 + 0.45 * clamp(sw, -0.5, 1.5) * 0.6 + 0.35 * bw, u); r.sh[pl].rotation.x = lerp3(r.sh[pl].rotation.x, OUT3(pl) * (0.45 + 0.45 * pow), u);
			r.sh[kf].rotation.z = lerp3(r.sh[kf].rotation.z, -0.35 * clamp(sw, 0, 1.6) - 0.1, u); r.sh[kf].rotation.x = lerp3(r.sh[kf].rotation.x, OUT3(kf) * (0.4 + 0.55 * pow * (0.5 + 0.5 * Math.max(bw, fw))), u);
			r.el[kf].rotation.z = lerp3(r.el[kf].rotation.z, 0.5, u); r.el[pl].rotation.z = lerp3(r.el[pl].rotation.z, 0.75, u);
		}
		// A throw-in: ball over the head, arching back, then whipping forward.
		if (thr >= 0) {
			const back = thr < 0.35 ? thr / 0.35 : 1 - (thr - 0.35) / 0.65, fwd = thr > 0.35 ? 1 : 0;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = 2.75 - 1.3 * (1 - back) * fwd; r.sh[i].rotation.x = OUT3(i) * 0.12; r.el[i].rotation.z = 1.45 * back + 0.1; }   // up over his head (forward through to overhead), the ball behind it, then whipped forward; past horizontal OUT3 brings the hands in, to the ball
			r.spine.rotation.z = 0.35 * back - 0.25 * (1 - back) * fwd;
			r.hip[1].rotation.z = 0.3; r.kn[1].rotation.z = -0.3; r.hip[0].rotation.z = -0.3;
		}
		// Going up for a ball in the air (aerial3): he gathers, takes off to be at the top as it arrives,
		// arms up and out for leverage, head cocked back, then snaps his neck through it (down at goal,
		// up and away for a clearance) and lands on bent knees. A ball under his head, he stoops to it.
		const air = rm || down || dive >= 0 || fall >= 0 || cel > 0 || state !== "play" && !replayOn() ? null : aerial3(p, figScale3(p));
		if (air) {
			const up = air.up, g = air.gather, l = air.land, st = air.stoop, sc = figScale3(p);
			y += air.y * sc - (1.6 * g + 1.8 * l + 2.4 * st) * sc;
			for (let i = 0; i < 2; i++) {
				r.kn[i].rotation.z -= 0.75 * g + 0.8 * l + 0.6 * st + (0.55 + (i ? 0.45 : 0)) * up; r.hip[i].rotation.z += 0.35 * g + 0.4 * l + 0.3 * st + (i ? 0.55 : 0.12) * up;
				r.an[i].rotation.z += 0.4 * g + 0.4 * l - 0.35 * up;
				const armOut = 1.5 * up + 0.5 * st, armUp = 0.45 * up - 0.7 * g;
				r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * armOut, Math.min(1, up + st + g)); r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, armUp, Math.min(1, up + g)); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.9, up);
			}
			const snap = smooth3(clamp((1.5 - air.t) / 3, 0, 1)) * (1 - smooth3(clamp((-air.t - 5) / 6, 0, 1))), cock = clamp(air.t / 6, 0, 1) * (up + st) * (1 - snap);
			const goal = air.mine ? !!ball.shot : air.att;
			r.spine.rotation.z += 0.22 * cock - (goal ? 0.45 : 0.28) * snap * Math.max(up, st, 0.5) - 0.85 * st;
			r.neck.rotation.z += 0.32 * cock - (goal ? 0.55 : 0.05) * snap + 0.35 * st;
		}
		// Up for a header: legs tucked, arms out, the head snaps forward at the top.
		if (jump > 0 && !air) {
			y += jump * 13;
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z = 0.35 * jump + (i ? 0.25 : -0.1) * jump; r.kn[i].rotation.z = -1.1 * jump; r.sh[i].rotation.x = OUT3(i) * 2.2 * jump; r.sh[i].rotation.z = -0.5 * jump; r.el[i].rotation.z = 0.35; }
			r.spine.rotation.z = 0.2 * jump - 0.35 * Math.max(0, jump - 0.75) * 4;
			r.neck.rotation.z = 0.3 * jump - 0.9 * Math.max(0, jump - 0.8) * 5;
		}
		// Sliding in: on his side, one leg out at the ball, an arm on the turf. He drops into it over the
		// first frames, and once it is over (slideCd / lungeCd run on) he gets back up off the grass.
		const slideT = p.slideAI > 0 ? 1 - p.slideAI / 12 : down ? 1 - p.lunge / 14 : -1;
		if (down) { SLID3.set(p, true); }
		else if (!(p.lungeCd > 17) && !(p.slideCd > 94)) { SLID3.delete(p); }
		const getUp = !down && fall < 0 && dive < 0 && SLID3.get(p) ? (p.slideCd > 94 ? (p.slideCd - 94) / 14 : p.lungeCd > 17 && p.lungeCd <= 31 ? (p.lungeCd - 17) / 14 : 0) : 0;
		if (down) {
			const e = rm ? 1 : smooth3(clamp(slideT / 0.22, 0, 1)), L = (o, t) => lerp3(o, t, e);
			r.root.rotation.z = L(0, 1.05); y -= 5.5 * e;
			r.hip[1].rotation.z = L(r.hip[1].rotation.z, 1.25); r.kn[1].rotation.z = L(r.kn[1].rotation.z, -0.05); r.hip[0].rotation.z = L(r.hip[0].rotation.z, 0.35); r.kn[0].rotation.z = L(r.kn[0].rotation.z, -1.7);
			r.hip[0].rotation.x = L(r.hip[0].rotation.x, 0); r.hip[1].rotation.x = L(r.hip[1].rotation.x, 0); r.an[1].rotation.z = L(r.an[1].rotation.z, 0.3);
			r.sh[0].rotation.z = L(r.sh[0].rotation.z, -1.7); r.sh[0].rotation.x = L(r.sh[0].rotation.x, -0.5); r.el[0].rotation.z = L(r.el[0].rotation.z, 0.2);
			r.sh[1].rotation.z = L(r.sh[1].rotation.z, 0.8); r.sh[1].rotation.x = L(r.sh[1].rotation.x, 1.3); r.el[1].rotation.z = L(r.el[1].rotation.z, 0.5);
			r.spine.rotation.z = L(r.spine.rotation.z, -0.2); r.neck.rotation.z = L(r.neck.rotation.z, 0.35);
		} else if (getUp > 0) {
			const w = smooth3(clamp(getUp, 0, 1));
			r.root.rotation.z = 0.75 * w * w; y -= 3.2 * w;
			for (let i = 0; i < 2; i++) { r.kn[i].rotation.z -= (i ? 0.6 : 1.3) * w; r.hip[i].rotation.z += (i ? 0.3 : 0.8) * w; }
			r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, -1.2, w); r.sh[0].rotation.x = lerp3(r.sh[0].rotation.x, -0.4, w); r.el[0].rotation.z = lerp3(r.el[0].rotation.z, 0.3, w);   // a hand pushing off the turf
			r.spine.rotation.z -= 0.3 * w;
		}
		// Challenges on his feet, and shoulder to shoulder (challenge3): leaning in, the near leg poking at the
		// ball; and the man who lost it stumbling.
		if (!down && getUp <= 0 && fall < 0 && dive < 0 && !kp && !air && cel <= 0 && p.team >= 0 && p.role !== "staff" && !rm) {
			const ch = challenge3(p, x, z, dir, r.mir || 1);
			if (ch) {
				const sd = ch.side, i = sd > 0 ? 1 : 0;
				r.root.rotation.x += sd * (0.12 * ch.lean + 0.22 * ch.shove); r.chest.rotation.x += sd * 0.15 * (ch.lean + ch.shove);
				r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 0.55, Math.max(ch.lean, ch.shove)); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 1.1, ch.shove);
				if (ch.poke > 0) { r.hip[i].rotation.z += 0.75 * ch.poke; r.kn[i].rotation.z = lerp3(r.kn[i].rotation.z, -0.2, ch.poke); r.an[i].rotation.z += 0.3 * ch.poke; r.spine.rotation.z -= 0.25 * ch.poke; y -= 1.2 * ch.poke; }
				if (ch.stumble > 0) { r.spine.rotation.z -= 0.45 * ch.stumble; y -= 1.5 * ch.stumble; for (let k = 0; k < 2; k++) { r.kn[k].rotation.z -= 0.45 * ch.stumble; r.sh[k].rotation.x = lerp3(r.sh[k].rotation.x, OUT3(k) * 1.0, ch.stumble); r.sh[k].rotation.z = lerp3(r.sh[k].rotation.z, 0.6, ch.stumble); } }
			}
		}
		// The keeper's distribution from his hands (gkHand3): an overarm throw, a roll along the grass, a punt.
		const gh = gk && !rm && dive < 0 && fall < 0 ? gkHand3(p) : null;
		if (gh) {
			const t = gh.k, a2 = OUT3(1), thr = smooth3(clamp(t / 4, 0, 1)), back = 1 - thr, rel2 = 1 - smooth3(clamp((t - 6) / 8, 0, 1)) * (t >= 0 ? 1 : 0);
			if (gh.kind === "throw") {
				r.sh[1].rotation.z = lerp3(lerp3(r.sh[1].rotation.z, -2.4, back), 1.4, thr) * rel2 + r.sh[1].rotation.z * (1 - rel2); r.sh[1].rotation.x = a2 * 0.35 * rel2; r.el[1].rotation.z = 0.25 + 0.6 * back * (1 - thr);
				r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, 0.9 * (back + thr * 0.5), rel2); r.chest.rotation.y += (0.45 * back - 0.4 * thr) * rel2; r.spine.rotation.z += (0.18 * back - 0.3 * thr) * rel2;
			} else if (gh.kind === "roll") {
				r.sh[1].rotation.z = lerp3(r.sh[1].rotation.z, lerp3(-0.9 * back, 0.7, thr), rel2); r.el[1].rotation.z = lerp3(r.el[1].rotation.z, 0.1, rel2);
				r.spine.rotation.z -= 0.65 * Math.max(back, thr) * rel2; y -= 3 * Math.max(back, thr) * rel2; r.kn[0].rotation.z -= 1.0 * Math.max(back, thr) * rel2; r.hip[0].rotation.z += 0.9 * Math.max(back, thr) * rel2;
			} else {
				for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.9 * back * (1 - thr), rel2); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * (0.3 + 0.7 * thr), rel2); }   // the ball held out, dropped, arms out as he swings through it
			}
		}
		// The keeper's dive (divePose3): laid out toward where the ball passes him, the gloves at it; the
		// leg on that side drawn up, the other driving off; a catch gathered in to the chest.
		if (dive >= 0) {
			const dp = divePose3(r, p, dive, x, z, dir), sc = figScale3(p), lead = dp.side > 0 ? 1 : 0;
			y += dp.yLift * sc; ox += (dp.fwd * Math.cos(dir) - dp.slide * Math.sin(dir)) * sc; oz += (dp.fwd * Math.sin(dir) + dp.slide * Math.cos(dir)) * sc;
			const hold = dp.caught ? smooth3(clamp((dive - 0.35) / 0.25, 0, 1)) : 0;
			for (let i = 0; i < 2; i++) {
				r.sh[i].rotation.z = lerp3(lerp3(-0.4, -2.85, dp.go), 1.25, hold); r.sh[i].rotation.x = lerp3((i ? 1 : -1) * 0.22 * dp.go, -OUT3(i) * 0.25, hold); r.el[i].rotation.z = lerp3(0.12 + 0.5 * dp.sink, 1.75, hold);
				r.hip[i].rotation.z = i === lead ? 0.15 + 0.5 * dp.go : -0.1 - 0.1 * dp.go; r.kn[i].rotation.z = i === lead ? -0.4 - 0.7 * dp.go : -0.15 - 0.6 * dp.sink;
				r.hip[i].rotation.x = 0; r.an[i].rotation.z = -0.4 * dp.go;
			}
			r.spine.rotation.z = -0.1 - 0.15 * hold; r.neck.rotation.z = 0.15 * dp.go;
		} else if (gk && p.diveCd > 28 && fall < 0) {
			// Down after a dive: he gets up, pushing off the grass, knees under him.
			const D = DIVE3.get(p), k = smooth3(clamp((p.diveCd - 28) / 16, 0, 1)), th = D ? D.th || 1.4 : 1.4, side = D ? D.side || 1 : -(p.diveSide || 1);
			r.root.rotation.x = side * th * k * k; y += 1.2 * k;
			for (let i = 0; i < 2; i++) { r.kn[i].rotation.z -= 1.1 * k; r.hip[i].rotation.z += 0.7 * k; r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, -0.4, k); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 0.6, k); }
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
		r.shirtHead = ck === 6 && cel > 0.5 && fall < 0;
		if (cel > 0 && fall < 0 && ck === 2) {
			const w = cel, bank = rm ? 0 : Math.sin(idle * 1.6) * 0.22 * a;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.15, w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * (1.45 + (i ? 1 : -1) * bank * 0.6), w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.12, w); }   // wings out
			r.root.rotation.x += bank; r.spine.rotation.z = lerp3(r.spine.rotation.z, -0.15, w); r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.2, w);
		} else if (cel > 0 && fall < 0 && ck === 3) {
			// The fist pump: one bent arm driven down hard, again and again, leaning back and roaring.
			const pump = rm ? 0.5 : Math.pow(0.5 + 0.5 * Math.sin(idle * 7), 2), w = cel;
			r.sh[1].rotation.z = lerp3(r.sh[1].rotation.z, 1.5 - 1.0 * pump, w); r.sh[1].rotation.x = lerp3(r.sh[1].rotation.x, OUT3(1) * 0.2, w); r.el[1].rotation.z = lerp3(r.el[1].rotation.z, 1.9 - 0.4 * pump, w);   // the fist up by his face, driven down to his chest
			r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, 0.2, w); r.sh[0].rotation.x = lerp3(r.sh[0].rotation.x, OUT3(0) * 0.2, w); r.el[0].rotation.z = lerp3(r.el[0].rotation.z, 1.5, w);
			r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.18 - 0.12 * pump, w); r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.45, w);
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.x = (i ? 1 : -1) * 0.12 * w; r.kn[i].rotation.z -= 0.25 * w * pump; }
			r.hips.position.y -= 0.8 * w * pump;
		} else if (cel > 0 && fall < 0 && ck === 4) {
			// Kissing the badge: the shirt pulled up to the lips, the other arm pointing to the fans.
			const w = cel, pt = rm ? 0 : Math.sin(idle * 2) * 0.12;
			r.sh[0].rotation.z = lerp3(r.sh[0].rotation.z, 0.55, w); r.sh[0].rotation.x = lerp3(r.sh[0].rotation.x, -OUT3(0) * 0.3, w); r.el[0].rotation.z = lerp3(r.el[0].rotation.z, 2.35, w);   // the shirt (badge) up to his lips
			r.sh[1].rotation.z = lerp3(r.sh[1].rotation.z, 2.3 + pt, w); r.sh[1].rotation.x = lerp3(r.sh[1].rotation.x, -OUT3(1) * 0.3, w); r.el[1].rotation.z = lerp3(r.el[1].rotation.z, 0.1, w);   // the other arm up, pointing to the fans
			r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.3, w); r.spine.rotation.z = lerp3(r.spine.rotation.z, -0.08, w);
		} else if (cel > 0 && fall < 0 && ck === 6) {
			// The shirt pulled up over his head: both hands up at the crown holding it, elbows high and wide.
			// Found by search on the rig: the arm raised out to the side (OUT3 on x), turned (OUT3 on y) so the
			// elbow bends the forearm in over the head; hands 2.3 over the head, in front of the face, elbows 2.7 out.
			const w = cel;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.2, w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * 2.4, w); r.sh[i].rotation.y = lerp3(r.sh[i].rotation.y, OUT3(i) * 1.3, w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 2.0, w); }
			r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.2, w);
		} else if (cel > 0 && fall < 0 && ck === 5) {
			// A brace or a hat-trick: both arms straight up, pointing to the sky, head back.
			const w = cel, pt = rm ? 0 : Math.sin(idle * 1.5) * 0.06;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 2.85 + pt * (i ? 1 : -1), w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, -OUT3(i) * 0.32, w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.15, w); }   // forward through to overhead, a little out (past horizontal, -OUT3 is out)
			r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.5, w); r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.12, w);
		} else if (hug > 0.02 && fall < 0) {
			// The hug: arms forward and round him, leaning in, a little bounce.
			const b = rm ? 0 : Math.sin(idle * 6 + x * 0.02) * 0.08;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 1.25 + b, hug); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * 0.45, hug); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 1.0, hug); }   // forward (+z) and round him, not behind his own back
			r.spine.rotation.z = lerp3(r.spine.rotation.z, -0.3, hug); r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.1, hug);
			r.hips.position.y += b * 6 * hug;
		} else if (cel > 0 && fall < 0) {
			// Team-mates near him hold celebA at 0.7: that must still be arms up, not arms stuck out level at the
			// shoulders, so the weight reaches 1 by then (the in-between only shows for a moment as they rise).
			const w = clamp(cel * 1.5, 0, 1) * (1 - 0.4 * kneel), wave = Math.sin(idle * 3 + x * 0.01) * 0.25 * cel;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, 0.15 + wave * (i ? -1 : 1), w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, OUT3(i) * (2.35 + 0.5 * kneel), w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.3, w); }   // arms up and out wide, not crossed
			r.neck.rotation.z = lerp3(r.neck.rotation.z, 0.35 * cel, cel);
		}
		if (kneel > 0) {
			r.hips.position.y = lerp3(r.hips.position.y, 9.2, kneel);   // on the knees, not through the turf
			for (let i = 0; i < 2; i++) { r.hip[i].rotation.z = lerp3(r.hip[i].rotation.z, 0.05, kneel); r.kn[i].rotation.z = lerp3(r.kn[i].rotation.z, -1.6, kneel); r.an[i].rotation.z = 0.6 * kneel; }
			r.spine.rotation.z = lerp3(r.spine.rotation.z, 0.4, kneel);   // arched back (+z)
		}
		// Beaten: head down, shoulders rounded, arms hanging.
		if (sulk > 0) {
			r.spine.rotation.z -= 0.28 * sulk; r.neck.rotation.z -= 0.6 * sulk;   // measured: -z on the spine bows him forward, -z on the neck drops the chin
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z *= 1 - 0.7 * sulk; r.el[i].rotation.z *= 1 - 0.6 * sulk; }
		}
		r.root.position.set(x + ox, y, z + oz);
		r.root.rotation.y = -dir;
	}
	// What a figure wears. Keepers in their own colour with gloves and long sleeves.
	// Long sleeves: everyone in the snow, most players in the rain, a few at night, nobody on a dry afternoon or in the heat.
	// Each player's own choice (from his build), so it is the same every match in those conditions.
	function longSleeves3D (p) {
		if (!cond || p.team < 0 || p.role === "staff") { return false; }
		const h = build(p).seed;
		return cond.snow ? true : cond.heat ? false : cond.wet >= 1 ? h < 0.8 : cond.ko !== "day" ? h < 0.3 : false;
	}
	function kit3D (p) {
		const kit = KITS[p.team] || KITS[0], gk = p.role === "gk";
		const shirt = gk ? kit.gk : kit.outfield, shorts = gk ? "#1f2a36" : kit.second || "#1f2a36";
		return {
			shirt, shorts, socks: gk ? "#1f2a36" : shirt, second: kit.second || shirt, pattern: gk ? 0 : PATTERN3[kit.pattern] || 0,
			ink: gk ? "#0e1a24" : kit.ink || "#ffffff", gloves: gk ? (lum(shirt) > 0.5 ? "#15181a" : "#f2f2f2") : null, sleeves: gk || longSleeves3D(p),
			captain: !!(G3.fig && G3.fig.capt && G3.fig.capt[p.team] === p),
			boots: BOOTS3[(p.num || 0) % BOOTS3.length], ring: shirt, team: p.team, gk, name: p.name || ""
		};
	}
	// The trim (collar, cuffs, sock tops): the kit's second colour, or its number colour on a plain kit.
	const trim3D = kit => (kit.second && kit.second !== kit.shirt ? kit.second : kit.ink || kit.shirt);
	// Commit one posed rig to the instanced parts.
	// Which cell of the face atlas: his own face, open-mouthed when celebrating; -1 (none) with his shirt over his head.
	const faceCell3D = (lk, rig) => (rig.shirtHead ? -1 : ((lk.face || 0) % FACES3 + FACES3) % FACES3 + ((rig.cel || 0) > 0.3 ? FACES3 : 0));
	function commitFigure3D (rig, lk, kit, num) {
		const F = G3.fig, M = F.M, C = F.C;
		if (F.n >= MAXF3) { return; }
		F.n++;
		rig.root.updateMatrixWorld(true);
		if (!HM3) { HM3 = [ new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4() ]; }
		// His head's own proportions (longer or rounder, a broader or narrower jaw), fixed by his look.
		if (!lk.shape) { const h = hashStr(`${lk.skin}|${lk.hair}|${lk.style}|${lk.face}|${lk.name || ""}`), u = k => ((h >>> (k * 6)) % 41) / 40; lk.shape = [ 0.95 + 0.09 * u(0), 0.97 + 0.06 * u(1), 0.95 + 0.08 * u(2), 0.9 + 0.17 * u(3) ]; const h2 = hashStr(`${h}nose`), v = k => ((h2 >>> (k * 6)) % 41) / 40; lk.shape.push(-0.03 + 0.08 * v(0), 0.86 + 0.32 * v(1), 0.93 + 0.16 * v(2), 0.84 + 0.4 * v(3)); }   // and his hairline (higher or lower), his nose (how far it stands out, how long, how broad)
		const HS = HM3[2].makeTranslation(HEAD_C3[0], HEAD_C3[1], 0).multiply(HM3[0].makeScale(lk.shape[0], lk.shape[1], lk.shape[2])).multiply(HM3[1].makeTranslation(-HEAD_C3[0], -HEAD_C3[1], 0));
		const hairStyle = rig.shirtHead ? "afro" : HAIR_STYLES3[lk.style] ? lk.style : "short";
		for (const [ name, joint, side ] of PART_PLAN3) {
			const mesh = F.parts[name], node = side === undefined ? rig[joint] : rig[joint][side];
			let mtx = node.matrixWorld;
			if (name === "hair") {
				if (hairStyle === "shaved") { continue; }
				mtx = M.copy(HS).premultiply(node.matrixWorld);
			} else if (name === "head") {
				mtx = M.copy(HS).premultiply(node.matrixWorld);
			} else if (name === "nose") {
				mtx = M.makeTranslation(NOSE_ROOT3[0], NOSE_ROOT3[1], 0).multiply(HM3[0].makeScale(lk.shape[5], lk.shape[6], lk.shape[7])).multiply(HM3[1].makeTranslation(-NOSE_ROOT3[0], -NOSE_ROOT3[1], 0)).premultiply(HS).premultiply(node.matrixWorld);
			} else if (name === "tail") {
				const t = rig.shirtHead ? null : TAIL3[lk.style];
				if (!t) { continue; }
				mtx = M.makeTranslation(t[0], t[1], t[2]).multiply(HM3[0].makeScale(t[3], t[4], t[5])).premultiply(HS).premultiply(node.matrixWorld);
			} else if (name === "ear") {
				mtx = M.makeTranslation(EAR3[0], EAR3[1], F.cnt.ear % 2 ? EAR3[2] : -EAR3[2]).premultiply(HS).premultiply(node.matrixWorld);
			} else if (name === "hand" && kit.gloves) { mtx = M.makeScale(1.45, 1.3, 1.5).premultiply(node.matrixWorld); }
			if (name === "cuff" && kit.sleeves) { continue; }   // long sleeves have no cuff at the biceps
			if (name === "armband" && !kit.captain) { continue; }
			const k = F.cnt[name]++;
			if (k >= mesh.instanceMatrix.count) { F.cnt[name]--; continue; }   // never past the buffer
			mesh.setMatrixAt(k, mtx);
			if (name === "armband") { mesh.setColorAt(k, C.set(deltaE(kit.shirt, "#f4f1e6") < 25 ? "#1d2330" : "#f4f1e6")); continue; }   // white, or dark on a white shirt
			const sh = rig.shirtHead && (name === "torso" || name === "collar") ? lk.skin : rig.shirtHead && (name === "head" || name === "hair" || name === "ear") ? kit.shirt : null;   // shirt over his head: bare chest, the shirt bunched round his head
			const c = sh ? sh : name === "torso" || name === "sleeve" || ((name === "upperArm" || name === "foreArm") && kit.sleeves) ? kit.shirt
				: name === "collar" || name === "cuff" || name === "band" ? trim3D(kit) : name === "sole" ? (lum(kit.boots) > 0.5 ? "#26292c" : "#e4e6e8")
				: name === "shorts" || name === "shortLeg" ? kit.shorts : name === "shin" ? kit.socks : name === "boot" ? kit.boots
				: name === "hair" || name === "tail" ? lk.hair : name === "hand" && kit.gloves ? kit.gloves : lk.skin;
			mesh.setColorAt(k, C.set(c));
			if (name === "torso") {
				const g = mesh.geometry, pat = g.attributes.aPat, c2 = g.attributes.aCol2;
				pat.setX(k, kit.pattern); C.set(kit.second); c2.setXYZ(k, C.r, C.g, C.b);
			} else if (name === "head") { const ga = mesh.geometry.attributes; ga.aFace.setX(k, faceCell3D(lk, rig)); ga.aJaw.setX(k, lk.shape[3]); }
			else if (name === "hair") { const ga = mesh.geometry.attributes, hs = HAIR_STYLES3[hairStyle]; ga.aHairA.setXYZW(k, hs[0], hs[1], hs[2], hs[3]); ga.aHairB.setX(k, hs[4] + lk.shape[4]); ga.aJaw.setX(k, lk.shape[3]); }   // celebrating: the open-mouthed face
		}
		const V = F.V.setFromMatrixPosition(rig.root.matrixWorld), x = V.x, z = V.z, air = Math.max(0, V.y);
		const [ sux, suz ] = sunDir3D();
		F.blobs.setMatrixAt(F.blobs.count++, M.compose(V.set(x + sux * 2.4, 0.2, z + suz * 2.4), F.Q.identity(), F.S.set(11 + air * 0.15, 1, 7 + air * 0.1)));
		const ns = gfx3().shadows - 1;
		if (ns > 0 && air < 20 && cond && cond.ko === "day") {
			// An afternoon game: one sun shadow, the same way for everyone, longer than his blob.
			const len = 26, [ ux, uz ] = sunDir3D(); F.longs.material.opacity = 0.2;
			F.longs.setMatrixAt(F.longs.count++, M.compose(V.set(x + ux * len * 0.5, 0.15, z + uz * len * 0.5), F.Q.setFromAxisAngle(F.Y || (F.Y = new THREE.Vector3(0, 1, 0)), -Math.atan2(uz, ux)), F.S.set(len * 0.5, 1, 4.2)));
		} else if (ns > 0 && air < 20) {
			F.longs.material.opacity = 0.12;
			for (let k = 0; k < 4; k++) {
				if (ns < 4 && k % 2) { continue; }   // Medium: the two lights on one diagonal
				const lx = k === 0 || k === 3 ? -160 : FW + 160, lz = k < 2 ? -160 : FH + 160;
				const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz) || 1, len = clamp(28 * d / 950, 9, 36);
				F.longs.setMatrixAt(F.longs.count++, M.compose(V.set(x + dx / d * len * 0.5, 0.15, z + dz / d * len * 0.5), F.Q.setFromAxisAngle(F.Y || (F.Y = new THREE.Vector3(0, 1, 0)), -Math.atan2(dz, dx)), F.S.set(len * 0.5, 1, 3.4)));
			}
		}
		if (kit.ring) {
			const r = F.rings.count++;
			F.rings.setMatrixAt(r, M.compose(V.set(x, 0.25, z), F.Q.identity(), F.S.set(12, 1, 12)));
			F.rings.setColorAt(r, C.set(kit.ring));
		}
		if (num !== null && num !== undefined) {
			const n = F.nums.count++;
			F.nums.setMatrixAt(n, rig.spine.matrixWorld);
			F.nums.setColorAt(n, C.set(kit.ink));
			F.nums.geometry.attributes.aCell.setX(n, clamp(Math.round(num), 0, 99));
			if (F.names && kit.name && F.names.count < 32) {
				// The surname in the number's colour, in this figure's own cell (repainted only when it changes).
				const k = F.names.count++, label = `${kit.name.replace(/^.*?\.\s*/, "").toUpperCase()}|${kit.ink}`;
				if (F.nameKeys[k] !== label) {
					F.nameKeys[k] = label;
					const g = F.nameCv.getContext && F.nameCv.getContext("2d");
					if (g) {
						const x0 = (k % 4) * 256, y0 = Math.floor(k / 4) * 64;
						g.clearRect(x0, y0, 256, 64);
						g.fillStyle = kit.ink; g.font = "800 40px 'Barlow', 'Helvetica Neue', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
						g.fillText(label.split("|")[0], x0 + 128, y0 + 34, 240);
						F.nameTex.needsUpdate = true;
					}
				}
				F.names.setMatrixAt(k, rig.spine.matrixWorld);
				F.names.geometry.attributes.aCell.setX(k, k);
			}
			if (F.chest && !kit.gk && (kit.team === 0 || kit.team === 1)) {
				const c = F.chest.count++;
				F.chest.setMatrixAt(c, rig.spine.matrixWorld);
				F.chest.geometry.attributes.aRow.setX(c, kit.team);
			}
		}
	}
