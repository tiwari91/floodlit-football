	/* ---------- the footballers in 3D ----------
	   One articulated rig per figure (hips, spine, chest, neck, head, shoulders, elbows, hands,
	   hips, knees and ankles), posed from the simulation every frame. The body parts are instances
	   of a dozen shared shapes, so every player and official together costs about fifteen draw
	   calls. A figure is 32 units tall, about 1.95 m against the goal; the head is about an eighth of that, the
	   limbs athletic rather than toy-thick. */
	const MAXF3 = 32;   // figures the instanced parts can hold: 22 players, 3 officials, room to spare
	// Which joint carries which part. Limbs appear twice (left, right); the instance buffers are
	// sized from this plan, so a pair of limbs always has two slots per figure.
	const PART_PLAN3 = [
		[ "torso", "spine" ], [ "shoulders", "spine" ], [ "shorts", "hips" ], [ "neck", "neck" ], [ "head", "head" ], [ "hair", "head" ],
		[ "upperArm", "sh", 0 ], [ "upperArm", "sh", 1 ], [ "foreArm", "el", 0 ], [ "foreArm", "el", 1 ], [ "hand", "ha", 0 ], [ "hand", "ha", 1 ],
		[ "thigh", "hip", 0 ], [ "thigh", "hip", 1 ], [ "shin", "kn", 0 ], [ "shin", "kn", 1 ], [ "boot", "an", 0 ], [ "boot", "an", 1 ]
	];
	const PER_FIG3 = PART_PLAN3.reduce((m, [ n ]) => { m[n] = (m[n] || 0) + 1; return m; }, {});
	const PATTERN3 = { plain: 0, stripes: 1, hoops: 2, halves: 3, sash: 4 };
	const HAIR_SCALE3 = { short: [ 1, 1, 1 ], curly: [ 1.14, 1.2, 1.14 ], long: [ 1.06, 1.35, 1.06 ], buzz: [ 0.98, 0.96, 0.98 ], shaved: null };
	const BOOTS3 = [ "#15181a", "#f2f2f2", "#15181a", "#2bd1ff", "#ff4f6a", "#15181a", "#f2b52e", "#8cff5a" ];
	// One face into the atlas: cell (x0, y0), 256 wide (once round the head) by 128 (crown to chin).
	// The front of the head is the middle of the cell; the eye line sits a little above the equator.
	function paintFace3D (g, x0, y0, v) {
		const cx = x0 + 128, ey = y0 + 62, brow = v % 4, mouth = (v >> 1) % 3, beard = v === 3 || v === 7, stubble = v === 2 || v === 5;
		const ink = "#2a1a12", dark = "rgba(20, 12, 8, 0.55)";
		g.save();
		g.clearRect(x0, y0, 256, 128);
		// A soft shadow under the brow and down the sides of the nose, so the face reads from a distance.
		g.fillStyle = "rgba(30, 18, 10, 0.16)";
		g.beginPath(); g.ellipse(cx, ey + 1, 30, 7, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = "rgba(30, 18, 10, 0.11)";
		g.beginPath(); g.moveTo(cx - 1.5, ey + 5); g.lineTo(cx - 4, ey + 18); g.lineTo(cx + 4, ey + 18); g.lineTo(cx + 1.5, ey + 5); g.closePath(); g.fill();
		for (const sgn of [ -1, 1 ]) {
			const x = cx + sgn * 15;
			// the eye: a white almond, an iris, a pupil and a glint
			g.fillStyle = "#f6f1ea"; g.beginPath(); g.ellipse(x, ey, 8.5, 5, 0, 0, Math.PI * 2); g.fill();
			g.fillStyle = v % 3 === 1 ? "#3a5a7a" : v % 3 === 2 ? "#4a6a3a" : "#3a2414"; g.beginPath(); g.arc(x + sgn * 0.5, ey + 0.5, 3.6, 0, Math.PI * 2); g.fill();
			g.fillStyle = "#120a06"; g.beginPath(); g.arc(x + sgn * 0.5, ey + 0.5, 1.9, 0, Math.PI * 2); g.fill();
			g.fillStyle = "rgba(255, 255, 255, 0.85)"; g.beginPath(); g.arc(x - 1 + sgn * 0.5, ey - 1, 1, 0, Math.PI * 2); g.fill();
			// the lid line
			g.strokeStyle = dark; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, ey, 8.5, 5, 0, Math.PI, Math.PI * 2); g.stroke();
			// the brow: flat, arched, heavy or raised
			g.strokeStyle = ink; g.lineCap = "round"; g.lineWidth = brow === 2 ? 4.2 : 2.8;
			g.beginPath();
			if (brow === 1) { g.moveTo(x - sgn * 9, ey - 9); g.quadraticCurveTo(x, ey - 15, x + sgn * 9, ey - 10); }
			else if (brow === 3) { g.moveTo(x - sgn * 9, ey - 10); g.lineTo(x + sgn * 9, ey - 13); }
			else { g.moveTo(x - sgn * 9, ey - 10.5); g.lineTo(x + sgn * 9, ey - 10.5); }
			g.stroke();
		}
		// the mouth: a straight line, a slight smile or a set jaw
		g.strokeStyle = "rgba(60, 22, 18, 0.8)"; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath();
		if (mouth === 1) { g.moveTo(cx - 9, ey + 26); g.quadraticCurveTo(cx, ey + 31, cx + 9, ey + 26); }
		else if (mouth === 2) { g.moveTo(cx - 8, ey + 28); g.quadraticCurveTo(cx, ey + 25, cx + 8, ey + 28); }
		else { g.moveTo(cx - 8, ey + 27); g.lineTo(cx + 8, ey + 27); }
		g.stroke();
		// the ears, a shade darker than the skin, out at the sides
		g.fillStyle = "rgba(60, 30, 15, 0.22)";
		for (const sgn of [ -1, 1 ]) { g.beginPath(); g.ellipse(cx + sgn * 62, ey + 6, 6, 9, 0, 0, Math.PI * 2); g.fill(); }
		// stubble or a beard across the jaw
		if (stubble || beard) {
			g.fillStyle = beard ? "rgba(28, 18, 12, 0.78)" : "rgba(28, 18, 12, 0.3)";
			g.beginPath(); g.moveTo(cx - 44, ey + 14); g.quadraticCurveTo(cx - 40, ey + 52, cx, ey + 56); g.quadraticCurveTo(cx + 40, ey + 52, cx + 44, ey + 14);
			g.quadraticCurveTo(cx + 30, ey + 23, cx + 12, ey + 21); g.quadraticCurveTo(cx, ey + 19, cx - 12, ey + 21); g.quadraticCurveTo(cx - 30, ey + 23, cx - 44, ey + 14); g.closePath(); g.fill();
			if (beard) { g.fillStyle = "rgba(90, 50, 35, 0.9)"; g.beginPath(); g.ellipse(cx, ey + 27, 7, 2.2, 0, 0, Math.PI * 2); g.fill(); }
		}
		g.restore();
	}
	function initFigures3D () {
		const T = THREE;
		const defs = {
			torso: () => { const g = new T.CylinderGeometry(4.15, 3.05, 9.4, 14); g.translate(0, 4.7, 0); g.scale(0.7, 1, 1); return g; },
			shoulders: () => { const g = new T.CapsuleGeometry(1.7, 6.4, 4, 10); g.rotateX(Math.PI / 2); g.translate(0, 8.7, 0); g.scale(0.78, 1, 1); return g; },
			shorts: () => { const g = new T.CylinderGeometry(3.45, 3.95, 4.6, 12); g.translate(0, -1.9, 0); g.scale(0.78, 1, 1); return g; },
			neck: () => { const g = new T.CylinderGeometry(0.9, 1.05, 2.2, 8); g.translate(0, 0.8, 0); return g; },
			head: () => { const g = new T.SphereGeometry(2.15, 14, 10); g.scale(0.96, 1.12, 0.94); g.translate(0.2, 2.25, 0); return g; },
			hair: () => { const g = new T.SphereGeometry(2.38, 12, 7, 0, Math.PI * 2, 0, 1.55); g.scale(0.96, 1.12, 0.94); g.rotateZ(0.42); g.translate(0.2, 2.25, 0); return g; },   // concentric with the head, tilted: high at the brow, low at the nape
			upperArm: () => { const g = new T.CapsuleGeometry(0.98, 4.6, 3, 7); g.translate(0, -2.5, 0); return g; },
			foreArm: () => { const g = new T.CapsuleGeometry(0.8, 4.4, 3, 7); g.translate(0, -2.4, 0); return g; },
			hand: () => { const g = new T.SphereGeometry(0.9, 7, 5); g.scale(1, 1.25, 0.8); g.translate(0, -0.6, 0); return g; },
			thigh: () => { const g = new T.CapsuleGeometry(1.38, 5.7, 3, 7); g.translate(0, -3.0, 0); return g; },
			shin: () => { const g = new T.CapsuleGeometry(1.08, 5.2, 3, 7); g.translate(0, -3.0, 0); return g; },
			boot: () => { const g = new T.CapsuleGeometry(0.75, 2.6, 3, 7); g.rotateZ(Math.PI / 2); g.scale(1, 0.95, 1.2); g.translate(1.0, -0.25, 0); return g; }
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
		const fc = document.createElement("canvas"); fc.width = 1024; fc.height = 256;
		const fg = fc.getContext && fc.getContext("2d");
		if (fg) {
			for (let v = 0; v < 8; v++) { paintFace3D(fg, (v % 4) * 256, Math.floor(v / 4) * 128, v); }
		}
		const faceTex = tex3D(fc);
		faceTex.minFilter = T.LinearFilter; faceTex.magFilter = T.LinearFilter; faceTex.generateMipmaps = false;
		const headMat = new T.MeshLambertMaterial({ color: 0xffffff, map: faceTex });
		headMat.onBeforeCompile = sh => {
			sh.vertexShader = sh.vertexShader
				.replace("#include <common>", "#include <common>\nattribute float aFace;")
				.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (uv + vec2(mod(aFace, 4.0), 1.0 - floor(aFace / 4.0))) / vec2(4.0, 2.0);");
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
		const ng = new T.PlaneGeometry(4.6, 5.2).rotateY(-Math.PI / 2).translate(-3.08, 5.4, 0);
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
			const hips = node(root, 0, 15.6, 0), spine = node(hips, 0, 0.6, 0), chest = node(spine, 0, 5.4, 0), neck = node(chest, 0, 3.4, 0), head = node(neck, 0, 1.6, 0);
			const sh = [ node(chest, 0, 3.0, -4.95), node(chest, 0, 3.0, 4.95) ], el = sh.map(s => node(s, 0, -5.6, 0)), ha = el.map(e => node(e, 0, -5.2, 0));
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
		const shuf = clamp(p.shuf || 0, 0, 1), cel = clamp(p.celebA || 0, 0, 1), kneel = clamp(p.kneel || 0, 0, 1), sulk = clamp(p.sulk || 0, 0, 1);
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
		// Celebrating: arms up and out; on his knees he arches back and spreads them wide.
		if (cel > 0 && fall < 0) {
			const w = cel * (1 - 0.4 * kneel), wave = Math.sin(idle * 3 + x * 0.01) * 0.25 * cel;
			for (let i = 0; i < 2; i++) { r.sh[i].rotation.z = lerp3(r.sh[i].rotation.z, -0.45 + wave * (i ? -1 : 1), w); r.sh[i].rotation.x = lerp3(r.sh[i].rotation.x, (i ? 1 : -1) * (2.35 + 0.5 * kneel), w); r.el[i].rotation.z = lerp3(r.el[i].rotation.z, 0.3, w); }
			r.neck.rotation.z = lerp3(r.neck.rotation.z, -0.35 * cel, cel);
		}
		if (kneel > 0) {
			r.hips.position.y = lerp3(r.hips.position.y, 8, kneel);
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
	// Commit one posed rig to the instanced parts.
	function commitFigure3D (rig, lk, kit, num) {
		const F = G3.fig, M = F.M, C = F.C;
		if (F.n >= MAXF3) { return; }
		F.n++;
		rig.root.updateMatrixWorld(true);
		for (const [ name, joint, side ] of PART_PLAN3) {
			const mesh = F.parts[name], node = side === undefined ? rig[joint] : rig[joint][side];
			let mtx = node.matrixWorld;
			if (name === "hair") {
				const s = HAIR_SCALE3[lk.style] === undefined ? HAIR_SCALE3.short : HAIR_SCALE3[lk.style];
				if (!s) { continue; }
				mtx = M.makeScale(s[0], s[1], s[2]).premultiply(node.matrixWorld);
			} else if (name === "hand" && kit.gloves) { mtx = M.makeScale(1.45, 1.3, 1.5).premultiply(node.matrixWorld); }
			const k = F.cnt[name]++;
			if (k >= mesh.instanceMatrix.count) { F.cnt[name]--; continue; }   // never past the buffer
			mesh.setMatrixAt(k, mtx);
			const c = name === "torso" || name === "shoulders" || name === "upperArm" || (name === "foreArm" && kit.sleeves) ? kit.shirt
				: name === "shorts" ? kit.shorts : name === "shin" ? kit.socks : name === "boot" ? kit.boots
				: name === "hair" ? lk.hair : name === "hand" && kit.gloves ? kit.gloves : lk.skin;
			mesh.setColorAt(k, C.set(c));
			if (name === "torso") {
				const g = mesh.geometry, pat = g.attributes.aPat, c2 = g.attributes.aCol2;
				pat.setX(k, kit.pattern); C.set(kit.second); c2.setXYZ(k, C.r, C.g, C.b);
			} else if (name === "head") { mesh.geometry.attributes.aFace.setX(k, lk.face || 0); }
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
