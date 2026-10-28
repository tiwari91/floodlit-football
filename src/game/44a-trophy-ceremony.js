	/* ---------- the trophy ceremony ----------
	   Win something and the 3D view stages the presentation on the pitch: a stage in the centre circle
	   with the competition's name behind it, the players walking up one by one for their medals, the
	   captain lifting the trophy with confetti, tickertape and pyro going off and the stands roaring,
	   then a short open-top bus parade through the town. It takes the real footballers (posed through
	   the same fields the match uses), the real crowd and the 3D camera; the trophy is lathe-turned and
	   the stage, bus and streets are a few merged or instanced meshes. Any key or tap skips it.
	   With reduced motion it is one still picture of the lift; in the 2D cameras (or without WebGL)
	   it is the old card with fireworks. Light graphics draws less of everything. */
	let cer = null;
	const trophyQueue = [];
	const ceremonyActive = () => !!cer;
	// Trophies won during a matchday (the League Cup, the continental cup): shown once the full-time card is up.
	function queueTrophy (what) { if (what && !trophyQueue.includes(what)) { trophyQueue.push(what); } }
	function trophyDue () {
		if (!trophyQueue.length) { return; }
		const list = trophyQueue.splice(0);
		if (cer) { for (const w of list) { if (!cer.what.includes(w)) { cer.what.push(w); } } setCerCaption(); return; }
		celebrateTrophy(list.join(" and the "));
	}
	const CER_DETAIL = {
		light: { confetti: 160, pyro: false, sparks: 0, fans: 260, blocks: 26, lamps: false, flares: 0 },
		low: { confetti: 320, pyro: true, sparks: 0, fans: 520, blocks: 40, lamps: true, flares: 0 },
		medium: { confetti: 600, pyro: true, sparks: 160, fans: 900, blocks: 54, lamps: true, flares: 6 },
		high: { confetti: 900, pyro: true, sparks: 260, fans: 1300, blocks: 64, lamps: true, flares: 10 }
	};
	// Which trophy: the shape of the cup and the words on the stage.
	function trophyKind (what) {
		const w = String(what || "").toLowerCase();
		if (/continental/.test(w)) { return { shape: "ears", comp: "CONTINENTAL CHAMPIONS CUP", head: "WINNERS", label: "the Continental Champions Cup" }; }
		if (/european nations/.test(w)) { return { shape: "cup", comp: "EUROPEAN NATIONS CUP", head: "WINNERS", label: "the European Nations Cup trophy" }; }
		if (/international|world championship/.test(w)) { return { shape: "cup", comp: "WORLD CHAMPIONSHIP", head: "WINNERS", label: "the World Championship trophy" }; }   // a national side's (18j)
		if (/league cup/.test(w)) { return { shape: "lid", comp: "LEAGUE CUP", head: "WINNERS", label: "the League Cup" }; }
		return { shape: "cup", comp: "THE LEAGUE", head: "CHAMPIONS", label: "the league trophy" };
	}
	const CER_STAGE = { W: 230, D: 44, H: 12 };
	const CER_KEYS = [ "x", "y", "dir", "stride", "runAmt", "vx", "vy", "celebA", "celebK", "hug", "jump", "kneel", "sulk", "fall", "dive", "throwA", "kickA", "windUp", "px", "py", "pdir", "pstride", "stageY", "lunge", "slideAI", "shuf", "plant", "idlePh" ];
	const snapFields = o => { const s = {}; for (const k of CER_KEYS) { s[k] = o[k]; } return s; };
	const restoreFields = (o, s) => { for (const k of CER_KEYS) { if (s[k] === undefined) { delete o[k]; } else { o[k] = s[k]; } } };
	const cerSmooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

	// The trophy: turned on a lathe, with handles; three shapes for the three competitions.
	function trophyGeo3D (shape) {
		const T = THREE, A = acc3(), gold = "#d9aa45", dark = "#9c7426";
		const prof = shape === "lid"
			? [ [ 0, 0 ], [ 3.4, 0 ], [ 3.4, 1.6 ], [ 2.4, 2.0 ], [ 1.0, 3.2 ], [ 0.8, 5.6 ], [ 1.6, 6.2 ], [ 2.6, 7.4 ], [ 3.0, 10.5 ], [ 3.3, 13.4 ], [ 3.0, 13.8 ], [ 2.0, 14.6 ], [ 0.6, 15.6 ], [ 0.9, 16.4 ], [ 0, 17.0 ] ]
			: shape === "ears"
				? [ [ 0, 0 ], [ 3.0, 0 ], [ 3.0, 1.2 ], [ 2.2, 1.6 ], [ 1.0, 2.6 ], [ 0.8, 5.0 ], [ 1.8, 6.0 ], [ 3.4, 7.4 ], [ 4.2, 9.6 ], [ 4.4, 12.4 ], [ 4.0, 12.6 ], [ 3.9, 12.0 ], [ 0, 12.0 ] ]
				: [ [ 0, 0 ], [ 3.6, 0 ], [ 3.6, 1.4 ], [ 2.6, 1.8 ], [ 1.1, 3.0 ], [ 0.9, 5.4 ], [ 2.0, 6.4 ], [ 3.6, 8.0 ], [ 4.1, 10.6 ], [ 4.4, 12.6 ], [ 4.0, 12.8 ], [ 3.9, 12.2 ], [ 0, 12.2 ] ];
		const lathe = new T.LatheGeometry(prof.map(([ r, y ]) => new T.Vector2(r, y)), 24);
		lathe.computeVertexNormals();
		accGeo3(A, lathe, gold); lathe.dispose();
		const band = new T.TorusGeometry(shape === "lid" ? 3.05 : 3.9, 0.22, 6, 24).rotateX(Math.PI / 2).translate(0, shape === "lid" ? 10.5 : 10.4, 0);
		accGeo3(A, band, dark); band.dispose();
		const ear = shape === "ears" ? [ 4.4, 0.55, 9.6 ] : shape === "lid" ? [ 1.9, 0.38, 9.4 ] : [ 2.4, 0.42, 9.8 ];
		for (const s of [ -1, 1 ]) {
			const h = new T.TorusGeometry(ear[0], ear[1], 8, 18, Math.PI * 1.25).rotateZ(-Math.PI * 0.62).translate(s * ((shape === "ears" ? 3.9 : 3.5) + ear[0] * 0.55), ear[2], 0);
			if (s < 0) { h.rotateY(Math.PI); }
			accGeo3(A, h, gold); h.dispose();
		}
		return geoAcc3(A);
	}
	function goldMat3D () {
		return new THREE.MeshPhongMaterial({ vertexColors: true, color: 0xffffff, specular: 0xfff0b8, shininess: 70, emissive: 0x3a2808 });
	}
	// The words behind the stage, painted like an LED wall.
	function stageBoard3D (kind) {
		const c = document.createElement("canvas"); c.width = 1024; c.height = 320;
		const g = c.getContext && c.getContext("2d");
		if (g) {
			const k = KITS[0] || {}, a = k.outfield || "#f2b52e", b = k.second || "#1d2330";
			const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, "#0b1424"); gr.addColorStop(1, "#05080e");
			g.fillStyle = gr; g.fillRect(0, 0, 1024, 320);
			g.fillStyle = a; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 306, 1024, 14);
			g.fillStyle = b; g.fillRect(0, 14, 1024, 5); g.fillRect(0, 301, 1024, 5);
			g.textAlign = "center"; g.textBaseline = "middle";
			g.fillStyle = "#e8d7a0"; g.font = "700 44px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
			g.fillText(kind.comp, 512, 66);
			g.fillStyle = "#ffd36a"; g.font = "800 132px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
			g.fillText(kind.head, 512, 168);
			g.fillStyle = "#ffffff"; g.font = "600 40px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
			g.fillText(`${String(YOU.name || "").toUpperCase()}  ·  SEASON ${league ? league.season : 1}`, 512, 262);
		}
		return tex3D(c);
	}
	// The stage: a deck with steps up at one end, a gold edge, a truss arch with the board, a plinth.
	function buildStage3D (C, kind) {
		const { W, D, H } = CER_STAGE, g = new THREE.Group(), A = acc3(), sx = C.sx, sz = C.sz;
		const deck = "#141b26", edge = "#c9a24a", truss = "#b9c0c8";
		accBox3(A, sx, H / 2, sz, W, H, D, deck);
		accBox3(A, sx, H + 0.2, sz, W, 0.4, D, "#1d2737");
		accBox3(A, sx, H - 1, sz + D / 2 + 0.3, W, 2, 0.6, edge);
		for (let k = 0; k < 4; k++) { accBox3(A, sx - W / 2 - 4 - k * 5, H * (3.5 - k) / 4 / 2, sz + D / 2 - 9, 5, H * (3.5 - k) / 4, 18, k % 2 ? "#1a2230" : "#222c3c"); }   // the steps
		for (const s of [ -1, 1 ]) { accBox3(A, sx + s * (W / 2 - 6), H + 45, sz - D / 2 + 3, 4, 90, 4, truss); accBox3(A, sx + s * (W / 2 - 6), H + 45, sz - D / 2 + 9, 4, 90, 4, truss); }
		accBox3(A, sx, H + 92, sz - D / 2 + 6, W - 6, 4, 10, truss);
		accBox3(A, C.presX + 12, H + 5, C.frontZ - 4, 6, 10, 6, "#e9e6dc");   // the plinth
		const m = meshAcc3(A, new THREE.MeshLambertMaterial({ vertexColors: true }));
		m.userData.ownMat = true; g.add(m);
		const board = new THREE.Mesh(new THREE.PlaneGeometry(W - 20, (W - 20) * 0.3125), new THREE.MeshBasicMaterial({ map: stageBoard3D(kind), toneMapped: false }));
		board.position.set(sx, H + 52, sz - D / 2 + 6.5); board.userData.ownGeo = board.userData.ownMat = true; g.add(board);
		return g;
	}
	// Confetti: small cards in gold, white and the club's colours, tumbling down.
	function buildConfetti3D (n) {
		const geo = new THREE.PlaneGeometry(2.2, 1.3), mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
		const mesh = new THREE.InstancedMesh(geo, mat, n);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
		const cols = [ "#ffd36a", "#ffffff", "#e9c35a", KITS[0].outfield || "#f2b52e", KITS[0].second || "#ffffff", "#f4f1e6" ], C = new THREE.Color();
		for (let i = 0; i < n; i++) { mesh.setColorAt(i, C.set(cols[i % cols.length])); }
		mesh.userData.ownGeo = mesh.userData.ownMat = true;
		return { mesh, n, p: new Float32Array(n * 3), v: new Float32Array(n * 3), r: new Float32Array(n * 3), live: 0, M: new THREE.Matrix4(), Q: new THREE.Quaternion(), E: new THREE.Euler(), V: new THREE.Vector3(), S: new THREE.Vector3(1, 1, 1) };
	}
	// Throw confetti: from (x, y, z) up and out (a cannon), or as a fall from above over an area.
	function throwConfetti3D (cf, x, y, z, spread, up, fall) {
		for (let i = 0; i < cf.n; i++) {
			if (Math.random() > 0.55 && cf.live) { continue; }
			const r = Math.random;
			cf.p[i * 3] = x + (r() - 0.5) * spread; cf.p[i * 3 + 1] = fall ? y + r() * 120 : y; cf.p[i * 3 + 2] = z + (r() - 0.5) * spread * (fall ? 0.6 : 0.3);
			cf.v[i * 3] = (r() - 0.5) * (fall ? 10 : 60); cf.v[i * 3 + 1] = fall ? -8 - r() * 8 : up * (0.6 + r() * 0.6); cf.v[i * 3 + 2] = (r() - 0.5) * (fall ? 10 : 50);
			cf.r[i * 3] = r() * 6; cf.r[i * 3 + 1] = r() * 6; cf.r[i * 3 + 2] = 2 + r() * 6;
		}
		cf.live = cf.n;
	}
	function stepConfetti3D (cf, k, now) {
		if (!cf.live) { cf.mesh.count = 0; return; }
		let n = 0;
		for (let i = 0; i < cf.n; i++) {
			const o = i * 3;
			if (k > 0) {
				cf.v[o + 1] = Math.max(cf.v[o + 1] - 70 * k, -11);   // paper falls slowly
				cf.v[o] *= 1 - 0.8 * k; cf.v[o + 2] *= 1 - 0.8 * k;
				cf.p[o] += (cf.v[o] + Math.sin(now * 2.1 + i) * 5) * k; cf.p[o + 1] += cf.v[o + 1] * k; cf.p[o + 2] += (cf.v[o + 2] + Math.cos(now * 1.7 + i * 1.3) * 5) * k;
			}
			const onGround = cf.p[o + 1] <= 0.3;
			if (onGround) { cf.p[o + 1] = 0.3; }
			const spin = onGround || reduceMotion ? 0 : now * cf.r[o + 2];
			cf.M.compose(cf.V.set(cf.p[o], cf.p[o + 1], cf.p[o + 2]), cf.Q.setFromEuler(cf.E.set(onGround ? -Math.PI / 2 : cf.r[o] + spin, cf.r[o + 1] + spin * 0.7, 0)), cf.S);
			cf.mesh.setMatrixAt(n++, cf.M);
		}
		cf.mesh.count = n; cf.mesh.instanceMatrix.needsUpdate = true;
	}
	// Pyro along the front of the stage: flame jets that fire on the lift, and spark fountains.
	function buildPyro3D (C, Q) {
		const g = new THREE.Group(), jets = [];
		if (!Q.pyro) { return { g, jets, sparks: null }; }
		const geo = new THREE.ConeGeometry(3.2, 34, 10, 1, true).translate(0, 17, 0);
		const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
		const core = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
		[ -0.46, -0.2, 0.2, 0.46 ].forEach((u, i) => {
			const j = new THREE.Mesh(geo, i ? mat : mat); j.position.set(C.sx + u * CER_STAGE.W, CER_STAGE.H, C.frontZ + 10); j.visible = false;
			const c = new THREE.Mesh(geo, core); c.scale.set(0.45, 0.7, 0.45); j.add(c);
			g.add(j); jets.push(j);
		});
		g.userData.disp = [ geo, mat, core ];
		let sparks = null;
		if (Q.sparks && G3.glowTex) {
			const n = Q.sparks, pg = new THREE.BufferGeometry(), pa = new Float32Array(n * 3).fill(-1e4);
			pg.setAttribute("position", new THREE.BufferAttribute(pa, 3).setUsage(THREE.DynamicDrawUsage));
			const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffd890, map: G3.glowTex, size: 3.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
			pts.frustumCulled = false; pts.userData.ownGeo = true; pts.userData.disp = [ pts.material ];
			g.add(pts);
			sparks = { pts, n, v: new Float32Array(n * 3), life: new Float32Array(n) };
		}
		return { g, jets, sparks };
	}
	// The open-top bus and the street: buildings, lamp posts and fans along both pavements.
	function buildParade3D (C, Q, kind) {
		const T = THREE, g = new T.Group(), PZ = C.sz, X0 = C.busX0 - 700, X1 = C.busX0 + 1500, rnd = (() => { let h = 4242; return () => (h = (h * 48271) % 2147483647) / 2147483647; })();
		g.visible = false;
		// The road, the pavements and the kerbs.
		const R = acc3();
		accBox3(R, (X0 + X1) / 2, -0.5, PZ, X1 - X0, 1, 124, "#2b2e33");
		for (const s of [ -1, 1 ]) { accBox3(R, (X0 + X1) / 2, 1, PZ + s * 82, X1 - X0, 2, 40, "#6d6a64"); accBox3(R, (X0 + X1) / 2, 1.2, PZ + s * 62.5, X1 - X0, 2.4, 1.6, "#9b978e"); }
		for (let x = X0; x < X1; x += 60) { accBox3(R, x, 0.05, PZ, 26, 0.2, 1.4, "#d8d4c4"); }
		// Lamp posts.
		const lampAt = [];
		for (let x = X0 + 40; x < X1; x += 170) {
			for (const s of [ -1, 1 ]) { accBox3(R, x, 45, PZ + s * 66, 1.6, 90, 1.6, "#2e3236"); accBox3(R, x, 89, PZ + s * 60, 1.4, 1.4, 12, "#2e3236"); lampAt.push([ x, 87, PZ + s * 55 ]); }
		}
		const road = meshAcc3(R, new T.MeshLambertMaterial({ vertexColors: true })); road.userData.ownMat = true; g.add(road);
		// Buildings: instanced boxes with a lit-window texture, tinted per block.
		const wc = document.createElement("canvas"); wc.width = 64; wc.height = 128;
		const wg = wc.getContext && wc.getContext("2d");
		if (wg) {
			wg.fillStyle = "#ffffff"; wg.fillRect(0, 0, 64, 128);
			for (let r = 0; r < 8; r++) { for (let c = 0; c < 4; c++) { const lit = (r * 7 + c * 3) % 5 < 2; wg.fillStyle = lit ? "#3a3326" : "#20252c"; wg.fillRect(4 + c * 15, 6 + r * 15, 9, 10); } }
		}
		const ec = document.createElement("canvas"); ec.width = 64; ec.height = 128;
		const eg = ec.getContext && ec.getContext("2d");
		if (eg) { eg.fillStyle = "#000000"; eg.fillRect(0, 0, 64, 128); for (let r = 0; r < 8; r++) { for (let c = 0; c < 4; c++) { if ((r * 7 + c * 3) % 5 < 2) { eg.fillStyle = "#ffcf7a"; eg.fillRect(4 + c * 15, 6 + r * 15, 9, 10); } } } }
		const bmat = new T.MeshLambertMaterial({ map: wg ? tex3D(wc) : null, emissive: 0xffffff, emissiveMap: eg ? tex3D(ec) : null, emissiveIntensity: eg ? 0.9 : 0 });
		const bgeo = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
		const blocks = new T.InstancedMesh(bgeo, bmat, Q.blocks * 2);
		const stone = [ "#8a6b55", "#a58a6c", "#6f5a4c", "#b8a891", "#7b7f86", "#94775d", "#5f6a72" ], M = new T.Matrix4(), V = new T.Vector3(), Sc = new T.Vector3(), Qn = new T.Quaternion(), Cc = new T.Color();
		let nb = 0;
		for (const s of [ -1, 1 ]) {
			for (let x = X0, k = 0; x < X1 && k < Q.blocks; k++) {
				const w = 60 + rnd() * 70, h = 110 + rnd() * 230, d = 70 + rnd() * 40;
				M.compose(V.set(x + w / 2, 0, PZ + s * (104 + d / 2)), Qn, Sc.set(w - 2, h, d));
				blocks.setMatrixAt(nb, M); blocks.setColorAt(nb, Cc.set(stone[Math.floor(rnd() * stone.length)])); nb++;
				x += w;
			}
		}
		blocks.count = nb; blocks.userData.ownGeo = blocks.userData.ownMat = true; g.add(blocks);
		// The fans: the crowd's own figure and material, packed three or four deep on both pavements.
		const fgeo = fanGeometry3D(Q.fans > 600 ? "full" : "lite"), n = Q.fans, fans = new T.InstancedMesh(fgeo, crowdMaterial3D(), n);
		const fa = new Float32Array(n * 4), sk = new Float32Array(n * 3), skins = [ "#f1c9a5", "#e0ac86", "#c68a5e", "#9c6a44", "#6e4a30", "#4a3222" ];
		const kc = [ KITS[0].outfield || "#f2b52e", KITS[0].second || "#1f2a36" ], neutrals = [ "#2c3135", "#4a5057", "#8a8f94", "#1e2a38", "#5c4a3a" ], E = new T.Euler();
		for (let i = 0; i < n; i++) {
			const s = i % 2 ? 1 : -1, row = Math.floor(rnd() * 4), x = C.busX0 - 350 + rnd() * 1500, z = PZ + s * (67 + row * 8 + rnd() * 3);
			const sc = 0.95 + rnd() * 0.15;
			M.compose(V.set(x, 2 + row * 0.8, z), Qn.setFromEuler(E.set(0, (s > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.6, 0)), Sc.set(sc, sc, sc));
			fans.setMatrixAt(i, M);
			const q = rnd();
			fans.setColorAt(i, Cc.set(q < 0.6 ? kc[0] : q < 0.75 ? kc[1] : neutrals[Math.floor(rnd() * neutrals.length)]));
			fa.set([ rnd(), 1, 0.8 + rnd() * 0.2, rnd() < 0.3 ? 1 : 0 ], i * 4);
			Cc.set(skins[Math.floor(rnd() * skins.length)]); sk.set([ Cc.r, Cc.g, Cc.b ], i * 3);
		}
		fgeo.setAttribute("aFan", new T.InstancedBufferAttribute(fa, 4));
		fgeo.setAttribute("aSkin", new T.InstancedBufferAttribute(sk, 3));
		fans.frustumCulled = false; fans.userData.ownGeo = true;   // the material is the crowd's, shared: never disposed here
		g.add(fans);
		// Lamp glows and flares: sprites, no extra lights.
		if (Q.lamps && G3.glowTex) {
			const pts = [];
			for (const l of lampAt) { pts.push(l[0], l[1], l[2]); }
			const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
			const lamps = new T.Points(lg, new T.PointsMaterial({ color: 0xffd9a0, map: G3.glowTex, size: 26, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
			lamps.userData.ownGeo = lamps.userData.ownMat = true; g.add(lamps);
		}
		let flares = null;
		if (Q.flares && G3.glowTex) {
			const pts = [];
			for (let i = 0; i < Q.flares; i++) { const s = i % 2 ? 1 : -1; pts.push(C.busX0 - 150 + rnd() * 1200, 22, PZ + s * (70 + rnd() * 20)); }
			const fg = new T.BufferGeometry(); fg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
			flares = new T.Points(fg, new T.PointsMaterial({ color: 0xff3a22, map: G3.glowTex, size: 34, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
			flares.userData.ownGeo = flares.userData.ownMat = true; g.add(flares);
		}
		// The bus: a double-decker in the club colours with the top taken off, and a banner down each side.
		const B = acc3(), k0 = KITS[0].outfield || "#c8102e", k1 = KITS[0].second || "#ffffff", L = 190, Wd = 44, deckY = C.deckY;
		accBox3(B, 0, 6 + (deckY - 6) / 2, 0, L, deckY - 6, Wd, k0);
		accBox3(B, 0, 18, 0, L - 4, 11, Wd + 0.6, "#1a2028");       // lower deck windows
		accBox3(B, L / 2 - 1, 22, 0, 2.4, 20, Wd - 8, "#1a2028");   // the windscreen
		accBox3(B, 0, deckY + 0.6, 0, L - 2, 1.2, Wd - 2, "#2a2f35");
		for (const s of [ -1, 1 ]) { accBox3(B, 0, deckY + 6, s * (Wd / 2 - 1), L - 2, 1.4, 1.4, "#d9dde2"); for (let x = -L / 2 + 6; x < L / 2; x += 18) { accBox3(B, x, deckY + 3, s * (Wd / 2 - 1), 1, 6, 1, "#d9dde2"); } }
		accBox3(B, L / 2 - 1, deckY + 6, 0, 1.4, 1.4, Wd - 2, "#d9dde2"); accBox3(B, -L / 2 + 1, deckY + 6, 0, 1.4, 1.4, Wd - 2, "#d9dde2");
		accBox3(B, 0, 5, 0, L - 10, 4, Wd - 2, "#14171b");
		const wheel = new T.CylinderGeometry(7, 7, 5, 14).rotateX(Math.PI / 2);
		for (const wx of [ -L / 2 + 30, L / 2 - 34 ]) { for (const s of [ -1, 1 ]) { accGeo3(B, wheel, "#15171a", new T.Matrix4().makeTranslation(wx, 7, s * (Wd / 2 - 2))); } }
		wheel.dispose();
		const bus = new T.Group(), body = meshAcc3(B, new T.MeshLambertMaterial({ vertexColors: true })); body.userData.ownMat = true; bus.add(body);
		const bc = document.createElement("canvas"); bc.width = 1024; bc.height = 128;
		const bg = bc.getContext && bc.getContext("2d");
		if (bg) {
			bg.fillStyle = k1; bg.fillRect(0, 0, 1024, 128); bg.fillStyle = k0; bg.fillRect(0, 10, 1024, 108);
			bg.fillStyle = lum(k0) > 0.55 ? "#111111" : "#ffffff"; bg.textAlign = "center"; bg.textBaseline = "middle"; bg.font = "800 80px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
			bg.fillText(`${kind.head}  ${league ? league.season : ""}`.trim(), 512, 68);
		}
		const btex = bg ? tex3D(bc) : null, bgeo2 = new T.PlaneGeometry(L - 30, 20);
		for (const s of [ -1, 1 ]) { const m = new T.Mesh(bgeo2, new T.MeshLambertMaterial({ map: btex })); m.position.set(-4, 36, s * (Wd / 2 + 0.5)); if (s < 0) { m.rotation.y = Math.PI; } m.userData.ownMat = true; bus.add(m); }
		bus.userData.disp = [ bgeo2, btex ].filter(Boolean);
		g.add(bus);
		// Light for the street: a low evening sun and the sky.
		const LI = Math.PI;
		const amb = new T.HemisphereLight(0x8fa3c8, 0x3a2f28, 0.75 * LI), sun = new T.DirectionalLight(0xffc890, 1.1 * LI);
		sun.position.set(C.busX0 + 900, 380, PZ + 520); sun.target.position.set(C.busX0 + 300, 0, PZ);
		g.add(amb, sun, sun.target, new T.AmbientLight(0x6c7488, 0.35 * LI));
		const sc = document.createElement("canvas"); sc.width = 2; sc.height = 128;
		const sg = sc.getContext && sc.getContext("2d");
		if (sg) { const gr = sg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#1b2546"); gr.addColorStop(0.55, "#a35f4a"); gr.addColorStop(1, "#f0b070"); sg.fillStyle = gr; sg.fillRect(0, 0, 2, 128); }
		const sky = new T.Mesh(new T.SphereGeometry(4000, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), new T.MeshBasicMaterial({ map: sg ? tex3D(sc) : null, color: sg ? 0xffffff : 0x2b3550, side: T.BackSide, fog: false }));
		sky.position.set(C.busX0 + 400, -200, PZ); sky.userData.ownGeo = sky.userData.ownMat = true; g.add(sky);
		return { g, bus, fans, flares, fog: new T.Fog(0x8a6a62, 700, 2600) };
	}
	// Dispose everything the ceremony made (never the shared geometry, the crowd's material or the material cache).
	function disposeCer3D (root) {
		root.traverse(o => {
			if (o.userData.ownGeo && o.geometry) { o.geometry.dispose(); }
			if (o.isInstancedMesh && o.userData.ownGeo) { o.dispose(); }
			if (o.userData.ownMat && o.material) { for (const m of [].concat(o.material)) { if (m.map && m.map !== G3.glowTex) { m.map.dispose(); } if (m.emissiveMap) { m.emissiveMap.dispose(); } m.dispose(); } }
			for (const d of o.userData.disp || []) { if (d && d.dispose && d !== G3.glowTex) { d.dispose(); } }
		});
	}

	/* The plan: where everyone goes and when. Times in seconds from the start. */
	function planCeremony (C) {
		const { W, D, H } = CER_STAGE, sx = C.sx, sz = C.sz, mine = C.team, N = mine.length;
		C.frontZ = sz + D / 2; C.laneF = sz + 13; C.laneM = sz + 1; C.laneB = sz - 12;
		C.presX = sx - W / 2 + 46;
		const walkV = 62, stepGap = clamp(11 / N, 1, 1.7), tLine = 2.8;
		const queue = q => [ sx - W / 2 - 34 - q * 12, C.frontZ + 10 ];
		const others = mine.filter(p => p !== C.capt), slots = others.map((p, i) => sx + W / 2 - 22 - i * (W - 50) / Math.max(1, others.length - 1 + (others.length === 1 ? 1 : 0)));
		C.plan = new Map();
		mine.forEach((p, i) => {
			const start = tLine + i * stepGap, isCapt = p === C.capt;
			const pts = [ [ ...queue(0), 0, 0 ], [ sx - W / 2 - 16, C.frontZ - 9, 0, 0 ], [ sx - W / 2 + 6, C.laneF, H, 0 ], [ C.presX - 13, C.laneF, H, isCapt ? 1.6 : 0.7 ] ];
			if (isCapt) { pts.push([ sx, C.laneF, H, 0 ]); }
			else { const j = others.indexOf(p); pts.push([ C.presX - 13, C.laneM, H, 0 ], [ slots[j], C.laneM, H, 0 ], [ slots[j], C.laneB, H, 0 ]); }
			// Times along the path at walking pace, holding still where a pause is asked for (the handshake).
			const legs = []; let t = start;
			for (let k = 1; k < pts.length; k++) {
				const a = pts[k - 1], b = pts[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]), dur = d / walkV * (b[2] !== a[2] ? 1.5 : 1);
				legs.push({ a, b, t0: t, t1: t + dur }); t += dur;
				if (b[3]) { legs.push({ a: b, b, t0: t, t1: t + b[3], pause: true }); t += b[3]; }
			}
			const medalAt = legs.find(l => l.pause).t0 + 0.35;
			C.plan.set(p, { i, start, legs, end: t, medalAt, gather: [ sx - W / 2 - 70 + (Math.random() - 0.5) * 120, C.frontZ + 60 + Math.random() * 90 ], queue, isCapt, slot: isCapt ? sx : slots[others.indexOf(p)], jumpPh: Math.random() });
		});
		const cp = C.plan.get(C.capt);
		C.tTrophy = cp.legs.find(l => l.pause).t0 + 0.6;
		C.tLift = cp.end + 1.2;
		C.tParade = C.tLift + 9;
		C.tEnd = C.reduced ? 1e9 : C.tParade + 11.5;
		C.busX0 = sx - 520; C.deckY = 52;
		const opp = C.oppTeam;
		C.oppPlan = new Map(opp.map((p, i) => [ p, [ sx + W / 2 + 26 + (i % 2) * 14, C.frontZ + 34 - Math.floor(i / 2) * 15 ] ]));
		return C;
	}
	// A player's spot (world x, z, height) at time t, and the way he faces when standing.
	function cerSpot (C, p, t) {
		const pl = C.plan.get(p);
		if (t < pl.start) {
			// Gathering, then queueing at the foot of the steps; the queue shuffles up as each man goes.
			let q = pl.i;
			for (const o of C.plan.values()) { if (o.i < pl.i) { q -= clamp((t - o.start) / 0.7, 0, 1); } }
			const [ qx, qz ] = pl.queue(q), u = cerSmooth((t - 0.2) / 2.4);
			return { x: lerp3(pl.gather[0], qx, u), z: lerp3(pl.gather[1], qz, u), h: 0, face: 0 };
		}
		for (const l of pl.legs) {
			if (t <= l.t1) {
				const u = l.pause ? 0 : clamp((t - l.t0) / Math.max(1e-3, l.t1 - l.t0), 0, 1);
				return { x: lerp3(l.a[0], l.b[0], u), z: lerp3(l.a[1], l.b[1], u), h: lerp3(l.a[2], l.b[2], cerSmooth(u)), face: l.pause ? 0 : null };
			}
		}
		const last = pl.legs[pl.legs.length - 1].b;
		return { x: last[0], z: last[1], h: last[2], face: Math.PI / 2 };
	}
	// The parade: the bus's front at time t, and each man's place on the top deck.
	const busX = (C, t) => C.busX0 + Math.max(0, t - C.tParade) * 46;
	function deckSpot (C, p, t) {
		const pl = C.plan.get(p), bx = busX(C, t);
		if (pl.isCapt) { return { x: bx + 74, z: C.sz + 6, h: C.deckY, face: Math.PI / 2 }; }
		const k = pl.i - (C.plan.get(C.capt).i < pl.i ? 1 : 0), row = k % 2, col = Math.floor(k / 2);
		return { x: bx + 56 - col * 22 + row * 9, z: C.sz + (row ? -9 : 9), h: C.deckY, face: Math.PI / 2 + (row ? 0.25 : -0.15) };
	}
	// Put a figure at a world spot: the match's own fields, mirrored back into pitch terms.
	function placeFig (C, p, s, k, t) {
		const sw = C.sw, x = sw ? FW - s.x : s.x;
		const st = C.walk.get(p) || { x: s.x, z: s.z, stride: 0, run: 0, dir: s.face === null ? 0 : s.face };
		const dx = s.x - st.x, dz = s.z - st.z, d = Math.hypot(dx, dz), v = k > 0 ? d / (k * 60) : 0;   // units a step, as the simulation counts them
		const moving = v > 0.08 && d < 40;
		const wd = moving ? Math.atan2(dz, dx) : s.face !== null && s.face !== undefined ? s.face : st.dir;
		st.run += ((moving ? clamp(v / 2.6, 0, 1) : 0) - st.run) * Math.min(1, k * 8);
		if (moving && !reduceMotion) { st.stride += Math.PI * 2 * (0.95 + 0.5 * v) / 60 * clamp(v / 0.4, 0, 1) * k * 60; }
		st.x = s.x; st.z = s.z; st.dir = wd;
		C.walk.set(p, st);
		p.x = p.px = x; p.y = p.py = s.z; p.dir = p.pdir = sw ? Math.PI - wd : wd;
		p.stride = p.pstride = st.stride; p.runAmt = st.run;
		p.vx = moving ? dx / d * v * (sw ? -1 : 1) : 0; p.vy = moving ? dz / d * v : 0;
		p.stageY = s.h || 0;
		p.fall = p.dive = p.throwA = p.kickA = p.windUp = p.lunge = p.slideAI = p.plant = 0; p.kneel = p.sulk = p.shuf = 0;
	}

	// Start it. False: the caller shows the 2D card instead.
	function trophyCeremony (what) {
		if (cer) { if (!cer.what.includes(what)) { cer.what.push(what); setCerCaption(); } return true; }
		if (bulkSim || !view3D() || !window.THREE || threeFailed || !G3.renderer || !G3.scene || G3.lost || !G3.fig || state !== "full") { return false; }
		const mine = team(0), opp = team(1);
		if (mine.length < 3) { return false; }
		const capt = (G3.fig.capt && G3.fig.capt[0] && mine.includes(G3.fig.capt[0])) ? G3.fig.capt[0] : mine.find(p => p.role !== "gk") || mine[0];
		const ordered = [ ...mine.filter(p => p !== capt).sort((a, b) => (a.num || 99) - (b.num || 99)), capt ];
		const C = cer = {
			what: [ what ], kind: trophyKind(what), scene: G3.scene, t0: performance.now(), last: performance.now(), reduced: !!reduceMotion,
			sx: FW / 2, sz: FH / 2, sw: endsSwapped(), team: ordered, oppTeam: opp, capt, walk: new Map(), Q: CER_DETAIL[gfxLevel] || CER_DETAIL.high,
			snap: new Map([ ...players, ...officials3 ].map(o => [ o, snapFields(o) ])), fog: G3.scene.fog, bg: G3.scene.background, ballVis: G3.ball ? G3.ball.visible : true,
			eye: new THREE.Vector3(), look: new THREE.Vector3(), snapCam: true, fired: {}, ovWas: overlay.hidden
		};
		planCeremony(C);
		// The things we add to the scene, in one group, so they all go when it ends.
		C.root = new THREE.Group(); C.root.name = "ceremony";
		C.stage = buildStage3D(C, C.kind); C.root.add(C.stage);
		C.trophy = new THREE.Mesh(trophyGeo3D(C.kind.shape), goldMat3D()); C.trophy.userData.ownGeo = C.trophy.userData.ownMat = true; C.root.add(C.trophy);
		const MA = acc3();   // a medal: a gold disc on a ribbon in the club's colours, hung round the neck
		accGeo3(MA, new THREE.CylinderGeometry(1.25, 1.25, 0.35, 16).rotateZ(Math.PI / 2), "#e2b54c", new THREE.Matrix4().makeTranslation(3.05, 5.4, 0));
		for (const s of [ -1, 1 ]) { accBeam3(MA, [ 3.0, 6.5, s * 0.3 ], [ 2.1, 9.7, s * 1.35 ], 0.55, s < 0 ? (KITS[0].outfield || "#c8102e") : (KITS[0].second || "#ffffff")); }
		C.medals = new THREE.InstancedMesh(geoAcc3(MA), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0xffeebb }), ordered.length);
		C.medals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); C.medals.frustumCulled = false; C.medals.count = 0; C.medals.userData.ownGeo = C.medals.userData.ownMat = true;
		C.root.add(C.medals);
		C.confetti = buildConfetti3D(C.Q.confetti); C.root.add(C.confetti.mesh);
		C.pyro = buildPyro3D(C, C.Q); C.root.add(C.pyro.g);
		if (!C.reduced) { C.parade = buildParade3D(C, C.Q, C.kind); C.root.add(C.parade.g); }
		G3.scene.add(C.root);
		// The words under the picture, a fade for the cut to the streets, and the skip.
		const wrap = $("pitchwrap");
		C.cap = document.createElement("div"); C.cap.className = "cer-cap"; C.cap.setAttribute("role", "status");
		Object.assign(C.cap.style, { position: "absolute", left: "50%", bottom: "9%", transform: "translateX(-50%)", padding: "10px 22px", background: "rgba(6, 10, 16, 0.78)", color: "#fff", borderLeft: `6px solid ${KITS[0].outfield || "#f2b52e"}`, font: "600 20px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap", maxWidth: "92%", overflow: "hidden", textOverflow: "ellipsis" });
		C.hint = document.createElement("div");
		Object.assign(C.hint.style, { position: "absolute", right: "14px", top: "12px", padding: "4px 10px", background: "rgba(6, 10, 16, 0.6)", color: "#d8dee6", font: "500 13px system-ui, sans-serif", borderRadius: "4px", pointerEvents: "none", zIndex: 6 });
		C.hint.textContent = C.reduced ? "Press any key to continue" : "Press any key to skip";
		C.fade = document.createElement("div");
		Object.assign(C.fade.style, { position: "absolute", inset: "0", background: "#000", opacity: "0", pointerEvents: "none", zIndex: 5 });
		if (wrap) { wrap.append(C.fade, C.cap, C.hint); }
		C.skip = e => {
			if (e.type === "keydown" && (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta")) { return; }
			e.preventDefault(); e.stopImmediatePropagation(); endCeremony("skip");
		};
		window.addEventListener("keydown", C.skip, true);
		window.addEventListener("pointerdown", C.skip, true);
		overlay.hidden = true;
		// A clean picture: the match furniture (score bug, ticker, tips, menu) steps out until it is over.
		C.hidden = [ "scoreBug", "coachMark", "lowerThird", "commLine", "bcTicker", "bcBoard", "menuToggle", "banner" ].map($).filter(Boolean).map(e => [ e, e.style.visibility ]);
		for (const [ e ] of C.hidden) { e.style.visibility = "hidden"; }
		setCerCaption();
		$("announce").textContent = `${captainName()} lifts ${C.kind.label}.`;
		return true;
	}
	function setCerCaption (t) {
		const C = cer;
		if (!C || !C.cap) { return; }
		if (t === undefined) { t = (performance.now() - C.t0) / 1000; }
		let s;
		if (C.reduced || (t >= C.tLift && t < C.tParade)) { s = `${C.capt.name || captainName()} lifts ${C.what.map(w => trophyKind(w).label).join(" and ")}`; }
		else if (t >= C.tParade) { s = "The open-top bus parade"; }
		else if (t < C.plan.get(C.team[0]).start) { s = `${YOU.name}: ${trophyKind(C.what[0]).comp.toLowerCase()} ${trophyKind(C.what[0]).head.toLowerCase()}`; }
		else {
			const up = C.team.filter(p => C.plan.get(p).start <= t).pop();
			s = up === C.capt ? `The captain, ${up.name}` : `${up.name}${up.num ? ` (${up.num})` : ""} collects his medal`;
		}
		if (C.cap.textContent !== s) { C.cap.textContent = s; }
	}
	function ceremonySeek (t) {
		if (!cer) { return false; }
		cer.t0 = performance.now() - t * 1000; cer.last = performance.now(); cer.snapCam = true; cer.walk.clear(); cer.fired = {};
		if (t > cer.tLift + 0.2) { throwConfetti3D(cer.confetti, cer.sx, 120, cer.sz, 260, 0, true); cer.fired.lift = true; }
		if (t > cer.tParade) { cer.fired.parade = true; throwConfetti3D(cer.confetti, busX(cer, t) + 80, 140, cer.sz, 400, 0, true); }
		return true;
	}
	function ceremonyInfo () {
		const C = cer;
		if (!C) { return { on: false }; }
		const t = (performance.now() - C.t0) / 1000;
		return { on: true, t, phase: C.reduced ? "still" : t < C.plan.get(C.team[0]).start ? "stage" : t < C.tLift ? "medals" : t < C.tParade ? "lift" : "parade", what: C.what.slice(), medals: C.medals.count, team: C.team.length, tLift: C.tLift, tParade: C.tParade, tEnd: C.tEnd, objects: C.root ? (() => { let n = 0; C.root.traverse(() => { n++; }); return n; })() : 0, caption: C.cap ? C.cap.textContent : "" };
	}
	function endCeremony (why) {
		const C = cer;
		if (!C) { return; }
		cer = null;
		window.removeEventListener("keydown", C.skip, true);
		window.removeEventListener("pointerdown", C.skip, true);
		for (const e of [ C.cap, C.hint, C.fade ]) { if (e) { e.remove(); } }
		for (const [ e, v ] of C.hidden || []) { e.style.visibility = v; }
		if (C.root) { if (C.root.parent) { C.root.parent.remove(C.root); } disposeCer3D(C.root); }
		for (const [ o, s ] of C.snap) { restoreFields(o, s); }
		if (C.scene === G3.scene && G3.scene) {
			G3.scene.fog = C.fog; G3.scene.background = C.bg;
			if (G3.stadium) { G3.stadium.visible = true; }
			if (G3.ball) { G3.ball.visible = C.ballVis; }
			G3.shot = "";   // the match camera cuts back in
		}
		if (G3.fig && G3.fig.yawSt) { for (const p of C.snap.keys()) { G3.fig.yawSt.delete(p); } }
		// Back to the full-time card, with the trophy on it.
		if (state === "full") {
			overlay.hidden = C.ovWas;
			const tr = $("ovTrophy");
			tr.style.setProperty("--tr-kit", KITS[0].outfield || "#f2b52e");
			$("ovTrophyText").textContent = `${captainName()} lifts ${C.what.map(w => trophyKind(w).label).join(" and ")}`;
			tr.hidden = false;
		}
		C.ended = why || "end";
		lastCeremony = { why: C.ended, what: C.what.slice() };
	}
	let lastCeremony = null;

	// One frame of the ceremony, called by the 3D view in place of its own frame. False: not ours.
	function ceremony3D () {
		const C = cer;
		if (!C) { return false; }
		if (C.scene !== G3.scene || state !== "full" || !G3.fig) { endCeremony("lost"); return false; }
		const now = performance.now(), k = reduceMotion ? 0 : Math.min(0.1, (now - C.last) / 1000);
		C.last = now;
		let t = (now - C.t0) / 1000;
		if (C.reduced) { t = C.tLift + 2.2; }
		if (t >= C.tEnd) { endCeremony("done"); return false; }
		const parade = !C.reduced && t >= C.tParade;
		// The players and officials, where the plan has them.
		for (const p of C.team) {
			const s = parade ? deckSpot(C, p, t) : cerSpot(C, p, t), pl = C.plan.get(p);
			placeFig(C, p, s, k, t);
			p.celebA = 0; p.celebK = 0; p.hug = 0; p.jump = 0;
			const lifted = t >= C.tLift && !parade;
			if (p === C.capt && t >= C.tTrophy) {
				const up = parade ? (Math.sin((t - C.tParade) * 1.3) > -0.2 ? 1 : 0) : lifted ? 1 : 0;
				if (up) { p.celebA = 1; p.celebK = 5; } else { p.celebA = 0.6; p.hug = 1; }
			} else if (lifted || parade) {
				const u = ((t * (parade ? 1.1 : 1.45) + pl.jumpPh) % 1);
				p.celebA = parade ? 0.75 : 1;
				if (!reduceMotion && (lifted ? t > C.tLift + 0.4 : u < 0.5)) { p.jump = JUMP * (1 - u); }
			}
		}
		for (const p of C.oppTeam) {
			const s = C.oppPlan.get(p);
			placeFig(C, p, parade ? { x: -9000, z: -9000, h: 0, face: 0 } : { x: s[0], z: s[1], h: 0, face: Math.PI }, k, t);
			p.celebA = 0; p.celebK = 0; p.hug = 0; p.jump = 0; p.sulk = parade ? 0 : 0.35;
		}
		officials3.forEach((o, i) => {
			const s = !parade && i === 0 ? { x: C.presX + 2, z: C.laneF, h: CER_STAGE.H, face: Math.PI } : { x: -9000 - i * 50, z: -9000, h: 0, face: 0 };
			placeFig(C, o, s, k, t);
		});
		// The crowd: up on its feet for the lift, the scarves out.
		const mineFans = homeSide === 0 ? "home" : "away";
		crowdMood[mineFans] = Math.max(crowdMood[mineFans] || 0, t >= C.tLift ? 1 : 0.55);
		sync3D();
		// After the figures are posed: the medals, the trophy, the stage dressing.
		const F = G3.fig, M = C.Mx || (C.Mx = new THREE.Matrix4());
		let nm = 0;
		for (const p of C.team) {
			const r = F.rigOf.get(p);
			if (!r || t < C.plan.get(p).medalAt) { continue; }
			C.medals.setMatrixAt(nm++, M.copy(r.spine.matrixWorld));
		}
		C.medals.count = nm; C.medals.instanceMatrix.needsUpdate = true;
		const cr = F.rigOf.get(C.capt), tr = C.trophy, V = C.V || (C.V = [ new THREE.Vector3(), new THREE.Vector3() ]);
		if (t >= C.tTrophy && cr) {
			cr.ha[0].getWorldPosition(V[0]); cr.ha[1].getWorldPosition(V[1]);
			const up = C.capt.celebK === 5;
			tr.position.set((V[0].x + V[1].x) / 2, (V[0].y + V[1].y) / 2 - (up ? 4.5 : 6.5), (V[0].z + V[1].z) / 2);
			tr.rotation.set(0, -C.capt.dir + (C.sw ? Math.PI : 0), 0);
		} else { tr.position.set(C.presX + 12, CER_STAGE.H + 10, C.frontZ - 4); tr.rotation.set(0, 0.4, 0); }
		const s3 = parade ? 1 : 1;
		tr.scale.setScalar(s3);
		// The lift: confetti cannons, tickertape from the ends, pyro and the roar.
		if (!C.fired.lift && t >= C.tLift) {
			C.fired.lift = true;
			throwConfetti3D(C.confetti, C.sx, CER_STAGE.H + 4, C.frontZ, CER_STAGE.W, 150, false);
			if (typeof throwTape3D === "function") { throwTape3D(); }
			cerRoar(1);
		}
		if (!C.fired.parade && parade) {
			C.fired.parade = true;
			C.confetti.live = 0; throwConfetti3D(C.confetti, busX(C, t) + 120, 120, C.sz, 500, 0, true);
			if (soundOn && audio && typeof chant === "function") { try { chant(1); } catch (e) { /* the song is a nicety */ } }
			cerRoar(0.7);
		}
		if (parade && !C.reduced && C.confetti.live && ((t - C.tParade) % 4) < k) { throwConfetti3D(C.confetti, busX(C, t) + 160, 120, C.sz, 420, 0, true); }
		stepConfetti3D(C.confetti, k, now / 1000);
		stepPyro3D(C, t, k);
		// Stadium or streets.
		if (C.parade) {
			C.parade.g.visible = parade; C.stage.visible = !parade;
			if (G3.stadium) { G3.stadium.visible = !parade; }
			G3.scene.fog = parade ? C.parade.fog : C.fog;
			if (parade) { C.parade.bus.position.set(busX(C, t), 0, C.sz); if (C.parade.flares) { C.parade.flares.material.size = 30 + Math.sin(now / 70) * 6; } }
		}
		if (G3.ball) { G3.ball.visible = false; }
		if (G3.marks) { for (const m of Object.values(G3.marks)) { m.visible = false; } }
		if (G3.trail) { for (const m of G3.trail.ghosts) { m.visible = false; } }
		if (G3.contact) { G3.contact.blob.visible = false; G3.contact.drops.visible = false; }
		CROWD_U.uExcite.value = reduceMotion ? 0.2 : t >= C.tLift ? 1 : 0.7;
		cerCamera(C, t, parade);
		// The near stand: drawn only while the camera is out in front of it.
		const showNear = !parade && G3.cam.position.z < FH + F_SIDE3 - 2;
		if (G3.nearRoof) { for (const o of G3.nearRoof) { o.visible = showNear; } }
		if (G3.nearStand) { G3.nearStand.visible = showNear; }
		if (G3.crowd) { for (const m of [ G3.crowd.near, G3.crowd.nearHi ]) { if (m) { m.visible = showNear; } } }
		// The fade to the streets and back out at the end.
		const fo = C.reduced ? 0 : Math.max(clamp(1 - Math.abs(t - C.tParade) / 0.55, 0, 1), clamp((t - (C.tEnd - 0.8)) / 0.8, 0, 1));
		C.fade.style.opacity = fo.toFixed(3);
		setCerCaption(t);
		ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(scale, 0, 0, scale, 0, 0);
		G3.renderer.render(G3.scene, G3.cam);
		return true;
	}
	function stepPyro3D (C, t, k) {
		const P = C.pyro, u = t - C.tLift;
		const on = !C.reduced && u >= 0 && t < C.tParade && (u < 1.6 || (u > 3.2 && u < 4.2) || (u > 6 && u < 6.8));
		P.jets.forEach((j, i) => { j.visible = on; if (on) { const f = 0.75 + 0.35 * Math.sin(t * 40 + i * 2.1) + 0.15 * Math.random(); j.scale.set(1 + 0.2 * Math.random(), f * (u < 0.25 ? u / 0.25 : 1), 1 + 0.2 * Math.random()); } });
		if (on && !C.fired["bang" + Math.floor(u / 2)]) { C.fired["bang" + Math.floor(u / 2)] = true; cerBang(); }
		const S = P.sparks;
		if (!S) { return; }
		const a = S.pts.geometry.attributes.position.array, fountain = !C.reduced && t >= C.tLift - 0.5 && t < C.tParade;
		for (let i = 0; i < S.n; i++) {
			const o = i * 3;
			if (S.life[i] <= 0) {
				if (!fountain || Math.random() > 0.25) { a[o + 1] = -1e4; continue; }
				const side = i % 2 ? 1 : -1;
				a[o] = C.sx + side * (CER_STAGE.W / 2 - 4); a[o + 1] = CER_STAGE.H; a[o + 2] = C.frontZ - 2;
				S.v[o] = (Math.random() - 0.5) * 30; S.v[o + 1] = 110 + Math.random() * 60; S.v[o + 2] = (Math.random() - 0.5) * 30; S.life[i] = 0.7 + Math.random() * 0.6;
			}
			S.life[i] -= k; S.v[o + 1] -= 260 * k;
			a[o] += S.v[o] * k; a[o + 1] += S.v[o + 1] * k; a[o + 2] += S.v[o + 2] * k;
		}
		S.pts.geometry.attributes.position.needsUpdate = true;
	}
	// The camera: a crane over the stage, then with each man up the steps, a sweep round the lift, then the bus.
	function cerCamera (C, t, parade) {
		const H = CER_STAGE.H, eye = C.eyeW || (C.eyeW = new THREE.Vector3()), look = C.lookW || (C.lookW = new THREE.Vector3());
		let fov = 38;
		if (C.reduced) { eye.set(C.sx + 30, H + 62, C.frontZ + 175); look.set(C.sx, H + 26, C.laneF - 6); }
		else if (parade) {
			const bx = busX(C, t), u = (t - C.tParade) / Math.max(1, C.tEnd - C.tParade);
			if (u < 0.4) { eye.set(bx + 330 - u * 180, 34 + u * 30, C.sz + 40); look.set(bx + 60, C.deckY + 14, C.sz); }
			else if (u < 0.75) { eye.set(bx + 70, 70, C.sz + 58); look.set(bx + 20, C.deckY + 18, C.sz); fov = 44; }
			else { const w = (u - 0.75) / 0.25; eye.set(bx - 60 - w * 120, 120 + w * 200, C.sz + 50 + w * 30); look.set(bx + 60, C.deckY, C.sz); fov = 46; }
		} else if (t < C.plan.get(C.team[0]).start) {
			const u = cerSmooth(t / C.plan.get(C.team[0]).start);
			eye.set(C.sx + lerp3(460, 120, u), lerp3(320, 95, u), C.sz + lerp3(620, 300, u)); look.set(C.sx - lerp3(40, 70, u), H + 18, C.sz + 10);
		} else if (t < C.tLift) {
			const up = C.team.filter(p => C.plan.get(p).start <= t + 0.4).pop(), s = cerSpot(C, up, t);
			eye.set(s.x + 55, H + 42, C.frontZ + 150); look.set(s.x + 6, s.h + 22, s.z);
			fov = 34;
		} else {
			const u = (t - C.tLift) / (C.tParade - C.tLift), a = -0.35 + 2.4 * cerSmooth(u), r = lerp3(130, 190, u);
			if (u < 0.12) { eye.set(C.sx + 18, H + 14, C.laneF + 70); look.set(C.sx, H + 36, C.laneF); fov = 42; }
			else { eye.set(C.sx + Math.sin(a) * r, H + 50 + 50 * u, C.sz + Math.cos(a) * r); look.set(C.sx, H + 30, C.sz + 4); }
		}
		if (C.snapCam || reduceMotion) { C.eye.copy(eye); C.look.copy(look); C.snapCam = false; C.cut = parade; }
		else {
			if (parade !== C.cut) { C.cut = parade; C.eye.copy(eye); C.look.copy(look); }
			const e = 1 - Math.exp(-frameDt / (t < C.tLift ? 420 : 160));
			C.eye.lerp(eye, e); C.look.lerp(look, e);
		}
		G3.cam.position.copy(C.eye); G3.cam.lookAt(C.look);
		G3.cam.fov = fov; G3.cam.aspect = VW / VH; G3.cam.updateProjectionMatrix(); G3.cam.updateMatrixWorld();
		G3.eye.copy(C.eye); G3.look.copy(C.look);
	}
	// The sound of it: the roar going up, and a thump for each burst of pyro.
	function cerRoar (loud) {
		if (!soundOn || !audio || reduceMotion) { return; }
		try {
			const t = audio.currentTime + 0.03;
			noiseBurst("brown", t, 4.5, 0.22 * loud, "lowpass", 900, 400, 0.7, 0);
			noiseBurst("white", t + 0.1, 3.5, 0.03 * loud, "bandpass", 1400, 900, 0.8, 0);
			voices(t, 24, 210, 330, 4, 0.05 * loud, 1100, 0);
		} catch (e) { /* no sound is fine */ }
	}
	function cerBang () {
		if (!soundOn || !audio) { return; }
		try { const t = audio.currentTime + 0.02; noiseBurst("brown", t, 0.6, 0.2, "lowpass", 700, 90, 0.7, 0); noiseBurst("white", t, 0.9, 0.025, "highpass", 2500, 4000, 0.7, 0); } catch (e) { /* none */ }
	}
