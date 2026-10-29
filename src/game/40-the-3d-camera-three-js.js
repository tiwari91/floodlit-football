	/* ---------- the 3D camera (three.js) ----------
	   A third view of the same match, drawn with WebGL. The simulation is untouched: every frame
	   the scene reads the players, the ball (with its height), the pitch, the goals and the
	   stands, and a broadcast camera follows the ball. The 2D canvas stays on top, cleared to
	   transparent, and carries the HUD: hints, toasts, the countdown, the minimap, names and
	   markers. three.js comes from cdnjs; if WebGL or the script is unavailable, the view
	   falls back to the 2D cameras. */
	let canvas3d = $("pitch3d");
	const threeEl = $("threeLib");
	let threeFailed = !threeEl || !canvas3d, threeWaitStart = 0, threeToldLoading = false;
	if (threeEl) { threeEl.addEventListener("error", () => { threeFailed = true; }); }
	const watchCanvas3D = c => {
		// (Only the canvas in use counts: a retired one, dropped for a Graphics change, also reports a loss.)
		c.addEventListener("webglcontextlost", e => { e.preventDefault(); if (c === canvas3d) { G3.lost = true; } });
		c.addEventListener("webglcontextrestored", () => { if (c === canvas3d) { G3.lost = false; } });
	};
	if (canvas3d) { watchCanvas3D(canvas3d); }
	const Z3 = Z_W;   // ball and crossbar heights, in pitch pixels
	const G3 = {   // everything the WebGL view owns
		renderer: null, scene: null, cam: null, lost: false, geo: null, mats: new Map(),
		stadium: null, stadiumKey: "", standsRef: null, fig: null, crowd: null, ball: null, ballShadow: null, marks: null,
		eye: null, look: null, shot: "", v: null, glowTex: null
	};
	// Graphics: how much the 3D view draws. Crowd density and the rows that get the detailed fan
	// shape, the floodlight towers' lattice, the players' floodlight shadows, the pixel ratio and
	// antialiasing. Phones start on Low (Medium on a big tablet), computers on High (Medium on a
	// four-core machine); the choice is remembered.
	// Light is for a laptop that runs warm: half the frames (30 a second, which the fixed-step simulation
	// does not notice), about a third of High's pixels (and below one a CSS pixel on a big screen), no
	// antialiasing, a thinner crowd on benches, no floodlight shadows, smaller lamp glare, a cheaper wet
	// pitch (four lamps mirrored, not eight), half the rain and a softer HUD canvas.
	// fps: the cap in play. budget/minRatio: the 3D pixel budget and how far under 1 it may go.
	// hud: the 2D canvas's pixel ratio cap. glare: the lamp halo's size. wetLamps: lamps the wet pitch
	// mirrors. rain: share of the rain streaks. benches: seats as a bench along the row. dyn: dynamic resolution.
	// fill over 1: a fuller house than the ground's own (its empty seats taken).
	// feet: a soft contact shadow under each boot (Medium and High). grass: the fine blade grain close up.
	// bloom: the broad halo round the floodlights at night, and the boards' light on the grass.
	const GFX3 = {
		light: { seat: 18, fill: 0.5, hiRows: 0, nearHiRows: 0, liteRow: 1, lattice: false, shadows: 1, ratio: 1, aa: false, fps: 30, budget: 1.3e6, minRatio: 0.75, dyn: true, hud: 1.25, glare: 0.6, wetLamps: 4, rain: 0.45, benches: true },
		low: { seat: 15, fill: 0.62, hiRows: 0, nearHiRows: 2, liteRow: 3, lattice: false, shadows: 1, ratio: 1, aa: false, benches: true },
		medium: { seat: 12, fill: 0.9, hiRows: 0, nearHiRows: 4, liteRow: 6, lattice: true, shadows: 3, ratio: 1.5, aa: !coarse, dyn: true, feet: true, grass: true, bloom: true },
		high: { seat: 10, fill: 1.15, hiRows: 2, nearHiRows: 5, liteRow: 8, lattice: true, shadows: 5, ratio: 2, aa: true, dyn: true, feet: true, grass: true, bloom: true }
	};
	const GFX_NAME = { light: "Light", low: "Low", medium: "Medium", high: "High" };
	// The sponsors on the boards: invented names, none of them a real brand.
	const BOARD_ADS3 = [ "Norvexa", "Kestralux", "Brixolt Energy", "Zephanio", "Talventa", "Gruvexis" ];
	const mixHex3 = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return "#" + A.lerp(B, t).getHexString(); };
	const PIX_BUDGET3 = 3.2e6;
	// A software renderer (no real GPU) or a two-core machine starts on Light.
	const weakGPU = (() => {
		try {
			const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl");
			if (!gl) { return false; }
			const ext = gl.getExtension("WEBGL_debug_renderer_info"), name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
			const lose = gl.getExtension("WEBGL_lose_context"); if (lose) { lose.loseContext(); }
			return /swiftshader|llvmpipe|software|basic render/i.test(name);
		} catch (e) { return false; }
	})();
	const defaultGfx = () => {
		const cores = navigator.hardwareConcurrency || 4;
		if (weakGPU || cores <= 2) { return "light"; }
		if (coarse) { let big = false; try { big = Math.min(screen.width, screen.height) >= 700; } catch (e) { /* none */ } return big && cores >= 6 ? "medium" : "low"; }
		return cores <= 4 ? "medium" : "high";
	};
	let gfxLevel = defaultGfx();
	const threeState = () => {
		if (threeFailed) { return "failed"; }
		if (window.THREE) { return "ready"; }
		if (!threeWaitStart) { threeWaitStart = performance.now(); }
		else if (performance.now() - threeWaitStart > 15000) { threeFailed = true; return "failed"; }
		return "loading";
	};
	function show3D (on) {
		if (!canvas3d) { return; }
		canvas3d.hidden = !on;
		if (on) { resize3D(); }
	}
	function resize3D () {
		if (!G3.renderer || !canvas3d || canvas3d.hidden) { return; }
		const rect = canvas3d.getBoundingClientRect();
		// A pixel budget as well as the level's ratio: a retina laptop at 2x was drawing over five million
		// pixels sixty times a second, which is what made it run hot; about three million looks the same.
		const Q = gfx3(), budget = Math.sqrt((Q.budget || PIX_BUDGET3) / Math.max(1, rect.width * rect.height));
		if (DYN3.lvl !== gfxLevel) { DYN3.lvl = gfxLevel; DYN3.s = 1; DYN3.over = DYN3.under = 0; }
		G3.renderer.setPixelRatio(Math.max(Q.minRatio || 1, Math.min(window.devicePixelRatio || 1, Q.ratio, budget)) * (Q.dyn ? DYN3.s : 1));
		G3.renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
	}
	// Dynamic resolution (High and Medium): when the GPU's time for a frame stays over budget the 3D picture
	// is drawn with fewer pixels, a tenth at a time down to 0.6 of the level's own scale, and it climbs back
	// once there is room for the next step. Over budget for 2 s to step down, room for 5 s to step up, and
	// a few seconds between steps, so it never flickers (each step also resizes the drawing buffer). The GPU's
	// time comes from a timer query where the browser has one; elsewhere the frame time stands in for it.
	// Light steps down the same way (so a wider TV shot drops detail, never to the 2D view); Low keeps its fixed scale. The 2D HUD is untouched.
	const DYN3 = { s: 1, min: 0.6, step: 0.1, lvl: "", ms: 0, has: false, over: 0, under: 0, at: -1e9, ext: undefined, q: null, gl: null, budget: 7, room: 5 };
	function gpuBegin3D () {
		if (!gfx3().dyn || window.__ffNoGpuTimer || DYN3.q) { return null; }
		const gl = G3.renderer.getContext();
		if (DYN3.gl !== gl) { DYN3.gl = gl; DYN3.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") || null; }
		if (!DYN3.ext) { return null; }
		const q = gl.createQuery(); gl.beginQuery(DYN3.ext.TIME_ELAPSED_EXT, q);
		return q;
	}
	function gpuEnd3D (q) {
		const gl = DYN3.gl;
		if (q) { gl.endQuery(DYN3.ext.TIME_ELAPSED_EXT); DYN3.q = q; return; }
		if (!DYN3.q || gl !== G3.renderer.getContext()) { if (DYN3.q && gl !== G3.renderer.getContext()) { DYN3.q = null; } return; }
		if (!gl.getQueryParameter(DYN3.q, gl.QUERY_RESULT_AVAILABLE)) { return; }   // never wait for it
		if (!gl.getParameter(DYN3.ext.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(DYN3.q, gl.QUERY_RESULT) / 1e6; DYN3.ms = DYN3.has ? DYN3.ms + (ms - DYN3.ms) * 0.08 : ms; DYN3.has = true; }
		gl.deleteQuery(DYN3.q); DYN3.q = null;
	}
	// Once a drawn frame in play: judge the GPU time (or, without a timer, the frame time) and step the scale.
	function dynTick3D (dt, now, cap) {
		if (!gfx3().dyn || !G3.renderer || state !== "play" || !view3D()) { return; }
		const sec = Math.min(dt, 100) / 1000;
		let over, room;
		if (DYN3.has) {
			over = DYN3.ms > DYN3.budget;
			const up = Math.min(1, DYN3.s + DYN3.step) / DYN3.s;
			room = DYN3.ms * up * up < DYN3.room;   // the next step up would still fit
		} else {
			if (dt > 80 || cap) { return; }   // a capped frame is long on purpose
			DYN3.ms += (dt - DYN3.ms) * 0.05;
			over = DYN3.ms > 20; room = DYN3.ms < 17.6;
		}
		DYN3.over = over ? DYN3.over + sec : Math.max(0, DYN3.over - sec * 2);
		DYN3.under = room && !over ? DYN3.under + sec : 0;
		let to = DYN3.s;
		if (DYN3.over > 2 && now - DYN3.at > 2500 && DYN3.s > DYN3.min + 1e-3) { to = Math.max(DYN3.min, DYN3.s - DYN3.step); }
		else if (DYN3.under > 5 && now - DYN3.at > 5000 && DYN3.s < 1) { to = Math.min(1, DYN3.s + DYN3.step); }
		if (to !== DYN3.s) { DYN3.s = +to.toFixed(2); DYN3.at = now; DYN3.over = DYN3.under = 0; if (!DYN3.has) { DYN3.ms = 16.7; } resize3D(); }
	}
	const dynFloored3D = () => !gfx3().dyn || DYN3.s <= DYN3.min + 1e-3;
	// One material per colour, shared by every mesh that wears it.
	function mat3D (hex, lit = true) {
		const key = (lit ? "L" : "B") + hex;
		let m = G3.mats.get(key);
		if (!m) {
			m = lit ? new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
			G3.mats.set(key, m);
		}
		return m;
	}
	// A picture painted on a canvas is sRGB; tell three.js so it is not read as linear and washed out.
	const tex3D = c => { const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) { t.colorSpace = THREE.SRGBColorSpace; } return t; };
	const flat3D = (geo, color, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
	function init3D () {
		try {
			const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: gfx3().aa, powerPreference: "high-performance", alpha: false });
			G3.aa = gfx3().aa;
			renderer.setClearColor(0x070c12, 1);
			// A broadcast picture: a neutral tone curve (it leaves the club colours and the grass alone and only
			// rolls off the highlights, the lit shirts and the floodlights) a touch over exposed.
			if (THREE.NeutralToneMapping !== undefined) { renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08; }
			G3.renderer = renderer;
			G3.scene = new THREE.Scene();
			G3.cam = new THREE.PerspectiveCamera(36, 16 / 9, 8, 30000);
			G3.eye = new THREE.Vector3(); G3.look = new THREE.Vector3(); G3.v = new THREE.Vector3();
			// Shared geometry: the ball, rings and markers. (The footballers are built in initFigures3D.)
			const g = G3.geo = {
				ball: new THREE.SphereGeometry(5, 16, 12), shadow: new THREE.CircleGeometry(1, 14),
				ring: new THREE.RingGeometry(0.9, 1, 40), disc: new THREE.CircleGeometry(1, 32), cone: new THREE.ConeGeometry(4.5, 9, 4),
				arrow: (() => { const b = new THREE.BufferGeometry(); b.setAttribute("position", new THREE.Float32BufferAttribute([ 33, 0, 0, 25, 0, 6, 25, 0, -6 ], 3)); b.computeVertexNormals(); return b; })(),
				box: new THREE.BoxGeometry(1, 1, 1)
			};
			for (const k of [ "shadow", "ring", "disc" ]) { g[k].rotateX(-Math.PI / 2); }   // lie flat on the grass
			g.cone.rotateX(Math.PI);   // point down
			// The ball: white with dark patches, so its spin shows.
			const bc = document.createElement("canvas"); bc.width = 128; bc.height = 64;
			const bg = bc.getContext && bc.getContext("2d");
			let ballMat = mat3D("#fbfdf9");
			if (bg) {
				bg.fillStyle = "#fbfdf9"; bg.fillRect(0, 0, 128, 64);
				bg.fillStyle = "#1b2420";
				for (const [ x, y ] of [ [ 16, 16 ], [ 64, 16 ], [ 112, 16 ], [ 40, 48 ], [ 88, 48 ], [ 64, 32 ] ]) { bg.beginPath(); bg.arc(x, y, 7, 0, Math.PI * 2); bg.fill(); }
				const bt = tex3D(bc);
				ballMat = new THREE.MeshLambertMaterial({ map: bt });
			}
			G3.ball = new THREE.Mesh(g.ball, ballMat);
			// A soft shadow: dark in the middle and fading out to nothing, never a disc with an edge. Shared
			// by the ball's shadow and the shadows under the players (and their feet).
			const sc = document.createElement("canvas"); sc.width = sc.height = 64;
			const sg = sc.getContext && sc.getContext("2d");
			if (sg) {
				const im = sg.createImageData(64, 64);
				for (let y = 0; y < 64; y++) { for (let x = 0; x < 64; x++) { const r2 = ((x - 31.5) ** 2 + (y - 31.5) ** 2) / (31.5 * 31.5), o = (y * 64 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = r2 >= 1 ? 0 : Math.round(255 * Math.exp(-2.6 * r2) * (1 - r2 * r2)); } }
				sg.putImageData(im, 0, 0);
				G3.softTex = new THREE.CanvasTexture(sc);
			}
			G3.ballShadow = flat3D(g.shadow, 0x000000, G3.softTex ? 0.62 : 0.4);
			if (G3.softTex) { G3.ballShadow.material.map = G3.softTex; }
			G3.scene.add(G3.ball, G3.ballShadow);
			// The markers painted on the grass: pass ring, your ring and arrow, the offside line, the
			// referee's spray and the wall, the keeper's ring, the tutorial's ring.
			const amber = 0xf2b52e;
			const mk = {
				pass: flat3D(g.ring, amber, 0.95), me: flat3D(g.ring, amber, 0.95), meFill: flat3D(g.disc, amber, 0.2), arrow: flat3D(g.arrow, amber, 1),
				cone: new THREE.Mesh(g.cone, mat3D("#f2b52e", false)), offside: flat3D(g.box, 0xde4f5a, 0.55), fk: flat3D(g.ring, 0xffffff, 0.55),
				wall: flat3D(g.box, 0xffffff, 0.8), keeper: flat3D(g.ring, 0xffffff, 0.28), tut: flat3D(g.ring, amber, 0.9), tutFill: flat3D(g.disc, amber, 0.25),
				next: flat3D(g.ring, 0xffffff, 0.42)
			};
			mk.arrow.material.side = THREE.DoubleSide;
			for (const m of Object.values(mk)) { m.visible = false; G3.scene.add(m); }
			G3.marks = mk;
			initFigures3D();
			// The glow round a floodlight.
			const gc = document.createElement("canvas"); gc.width = gc.height = 64;
			const gg = gc.getContext && gc.getContext("2d");
			if (gg) {
				const grad = gg.createRadialGradient(32, 32, 2, 32, 32, 32);
				grad.addColorStop(0, "rgba(255, 255, 255, 0.9)"); grad.addColorStop(0.35, "rgba(255, 255, 255, 0.3)"); grad.addColorStop(1, "rgba(255, 255, 255, 0)");   // white: each ground tints it to its lamps
				gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
				G3.glowTex = tex3D(gc);
			}
			// The bloom round a floodlight at night: a wide, faint halo with a soft horizontal streak, as a
			// broadcast lens shows it. Drawn on billboards (Medium and High), not points, so it can be big.
			const hc = document.createElement("canvas"); hc.width = hc.height = 128;
			const hg = hc.getContext && hc.getContext("2d");
			if (hg) {
				const im = hg.createImageData(128, 128);
				for (let y = 0; y < 128; y++) {
					for (let x = 0; x < 128; x++) {
						const dx = (x - 63.5) / 63.5, dy = (y - 63.5) / 63.5, r = Math.hypot(dx, dy), o = (y * 128 + x) * 4;
						const halo = Math.exp(-r * r * 9) * 0.85 + Math.exp(-r * r * 2.2) * 0.22, streak = Math.exp(-dy * dy * 900) * Math.max(0, 1 - Math.abs(dx)) ** 2 * 0.45;
						const a = Math.min(1, (halo + streak) * Math.max(0, 1 - r * r * r));
						im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = Math.round(255 * a);
					}
				}
				hg.putImageData(im, 0, 0);
				G3.haloTex = new THREE.CanvasTexture(hc);
			}
			G3.shot = "";
			return true;
		} catch (e) {
			threeFailed = true;
			G3.renderer = null;
			return false;
		}
	}
	// A quad standing in space, with a picture on it: the stands.
	function quad3D (a, b, c, d, uv, material) {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute([ ...a, ...b, ...c, ...d ], 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex([ 0, 1, 2, 0, 2, 3 ]);
		geo.computeVertexNormals();
		return new THREE.Mesh(geo, material);
	}
	function canvasTex3D (c) {
		const t = tex3D(c);
		if (G3.renderer.capabilities.isWebGL2) { t.anisotropy = Math.min(8, G3.renderer.capabilities.getMaxAnisotropy()); }
		else { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
		return t;
	}
	// Static geometry merged into one mesh, a colour on every vertex: the stands, roofs, pylons and
	// goal frames are hundreds of boxes and quads but cost one draw call each.
	const acc3 = () => ({ pos: [], nor: [], col: [] });
	const col3 = c => (Array.isArray(c) ? c : (() => { const k = new THREE.Color(c); return [ k.r, k.g, k.b ]; })());
	function accGeo3 (A, geo, c, m) {
		const g = geo.index ? geo.toNonIndexed() : geo.clone();
		if (m) { g.applyMatrix4(m); }
		const p = g.attributes.position.array, n = g.attributes.normal.array, k = col3(c);
		for (let i = 0; i < p.length; i++) { A.pos.push(p[i]); A.nor.push(n[i]); }
		for (let i = 0; i < p.length; i += 3) { A.col.push(k[0], k[1], k[2]); }
		g.dispose();
	}
	// A quad; want (optional) is the side it should face: the winding is turned to match.
	function accQuad3 (A, a, b, c, d, col, want) {
		const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
		const k = col3(col);
		const flip = want && nx * want[0] + ny * want[1] + nz * want[2] < 0;
		if (flip) { nx = -nx; ny = -ny; nz = -nz; }
		for (const v of flip ? [ a, c, b, a, d, c ] : [ a, b, c, a, c, d ]) { A.pos.push(v[0], v[1], v[2]); A.nor.push(nx, ny, nz); A.col.push(k[0], k[1], k[2]); }
	}
	let box3Geo = null;
	const M3 = { m: null, q: null, p: null, s: null, e: null };
	function box3Init () { if (!box3Geo) { box3Geo = new THREE.BoxGeometry(1, 1, 1); M3.m = new THREE.Matrix4(); M3.q = new THREE.Quaternion(); M3.p = new THREE.Vector3(); M3.s = new THREE.Vector3(); M3.e = new THREE.Euler(); } }
	function accBox3 (A, cx, cy, cz, sx, sy, sz, col, ry = 0, rx = 0, rz = 0) {
		box3Init();
		M3.m.compose(M3.p.set(cx, cy, cz), M3.q.setFromEuler(M3.e.set(rx, ry, rz, "YXZ")), M3.s.set(sx, sy, sz));
		accGeo3(A, box3Geo, col, M3.m);
	}
	// A thin box from one point to another: a strut, a cable, a lattice member.
	function accBeam3 (A, a, b, w, col) {
		const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
		box3Init();
		M3.q.setFromUnitVectors(M3.p.set(0, 1, 0), M3.s.set(dx / L, dy / L, dz / L));
		M3.m.compose(M3.p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), M3.q, M3.s.set(w, L, w));
		accGeo3(A, box3Geo, col, M3.m);
	}
	function geoAcc3 (A) {
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(A.pos, 3));
		g.setAttribute("normal", new THREE.Float32BufferAttribute(A.nor, 3));
		g.setAttribute("color", new THREE.Float32BufferAttribute(A.col, 3));
		return g;
	}
	function meshAcc3 (A, material) {
		if (!A.pos.length) { return null; }
		const m = new THREE.Mesh(geoAcc3(A), material);
		m.userData.ownGeo = true;
		return m;
	}
	// The ground: built once per match (it changes with the club, the format, the weather, the
	// surface and the Graphics setting). The pitch is the 2D cameras' painting laid flat; round it
	// stands a stadium in the Mexican manner, one of three shapes the ground picks: a two-tier bowl
	// with a ring of private boxes between the tiers under a ring roof (like the Azteca), one tall
	// oval tier under a ring roof (like the Akron), or a tight rectangle of two tiers with roofs on
	// the long sides and mountains behind (like Monterrey). Everything that stands still is merged
	// into a handful of meshes, so the whole ground is a few draw calls.
	const ARCH3 = {
		azteca: { rc: 150, tiers: [ [ 9, 10, 5.6 ], [ 9, 9.2, 8.8 ] ], roofIn: 0.5, ring: true },
		akron: { rc: 320, tiers: [ [ 15, 10, 7.6 ] ], roofIn: 0.32, ring: true },
		monterrey: { rc: 40, tiers: [ [ 8, 10, 6.6 ], [ 8, 9.4, 9.6 ] ], roofIn: 0.4, ring: false }
	};
	const F_SIDE3 = 24, F_END3 = NET + 28;   // the stands' front: back from the touchlines, and from the goal lines
	// The bowl's plan d out from its front: a rounded rectangle round the pitch, as points with their
	// outward normals. Every distance gives the same number of points, so the rows line up.
	function bowlRing3 (d, rc) {
		const ax = FW / 2 + F_END3, az = FH / 2 + F_SIDE3, r0 = Math.min(rc, az - 20, ax - 20), R = r0 + d, cx = FW / 2, cz = FH / 2, K = 8, pts = [];
		const C = [ [ cx + ax - r0, cz - az + r0 ], [ cx + ax - r0, cz + az - r0 ], [ cx - ax + r0, cz + az - r0 ], [ cx - ax + r0, cz - az + r0 ] ];
		for (let c = 0; c < 4; c++) {
			for (let k = 0; k <= K; k++) {
				const a = (c - 1) * Math.PI / 2 + k / K * Math.PI / 2, nx = Math.cos(a), nz = Math.sin(a);
				pts.push({ x: C[c][0] + nx * R, z: C[c][1] + nz * R, nx, nz });
			}
		}
		return pts;   // closed: the last point joins the first along the far touchline
	}
	// The rows, front to back: [ distance out, tread height, tread depth, rise ], with the boxes and
	// the upper tier's front between two tiers.
	function bowlProfile3 (A) {
		const rows = [];
		let d = 0, h = 3, band = null, upper = null;
		A.tiers.forEach(([ n, rd, rh ], ti) => {
			if (ti > 0) { band = { d, h0: h, h1: h + 17 }; d -= 10; h += 22; upper = { d, h }; }
			for (let i = 0; i < n; i++) { rows.push({ d, h, rd, rh, tier: ti, last: i === n - 1 }); d += rd; h += rh; }
		});
		return { rows, band, upper, back: d, top: h };
	}
	const gfx3 = () => GFX3[gfxLevel] || GFX3.high;
	// A wet pitch: no longer a broad specular band from the two key lights (a flat pale wash over the near
	// side), but each floodlight's own reflection, seen where the surface mirrors it toward the camera:
	// tight and bright where water lies (low-frequency puddle noise), broken into glints by the blades
	// everywhere else (a per-blade normal jitter), and stronger at grazing angles (Fresnel).
	let WET_LAMPS3 = null;   // made once three.js is here
	const wetLampCol3 = [ 1, 0.94, 0.82 ];   // the colour the wet grass mirrors: the ground's lamps
	const wetLamps3 = () => WET_LAMPS3 || (WET_LAMPS3 = Array.from({ length: 8 }, () => new THREE.Vector3(0, -1e4, 0)));
	function wetGround3D (mat, nLamps = 8) {
		mat.onBeforeCompile = sh => {
			sh.uniforms.ffLamps = { value: wetLamps3() }; sh.uniforms.ffWet = { value: Math.min(1.5, cond.wet) }; sh.uniforms.ffLampCol = { value: wetLampCol3 };
			sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <common>", `#include <common>
					varying vec3 vWp; uniform vec3 ffLamps[8]; uniform float ffWet; uniform vec3 ffLampCol;
					float ffH (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					float ffNz (vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ffH(i), ffH(i + vec2(1.0, 0.0)), f.x), mix(ffH(i + vec2(0.0, 1.0)), ffH(i + vec2(1.0, 1.0)), f.x), f.y); }`)
				.replace("#include <map_fragment>", `#include <map_fragment>
					{
						vec2 q = vWp.xz;
						float pud = smoothstep(0.6, 0.85, ffNz(q / 150.0) * 0.6 + ffNz(q / 41.0) * 0.4);
						// the surface's tilt: smooth undulation (no per-pixel sparkle), finer ripples only close in
						float dist = length(cameraPosition - vWp), fine = 1.0 - smoothstep(250.0, 900.0, dist);
						vec2 tilt = vec2(ffNz(q / 9.0) - 0.5, ffNz(q / 9.0 + 17.0) - 0.5) + fine * 0.6 * vec2(ffNz(q / 2.6 + 5.0) - 0.5, ffNz(q / 2.6 + 41.0) - 0.5);
						float rough = mix(0.7, 0.16, pud);
						vec3 n = normalize(vec3(tilt.x * rough, 1.0, tilt.y * rough));
						vec3 V = normalize(cameraPosition - vWp);
						float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
						float shin = mix(60.0, 500.0, pud), norm = (shin + 8.0) / 25.0;
						float sp = 0.0;
						for (int i = 0; i < 8; i += ${8 / nLamps}) { vec3 L = normalize(ffLamps[i] - vWp); sp += ${8 / nLamps}.0 * pow(max(dot(n, normalize(L + V)), 0.0), shin); }
						float blade = 0.55 + 0.45 * ffNz(q / 1.7);   // the blades break up the mirror, softly
						diffuseColor.rgb = diffuseColor.rgb * (1.0 - 0.1 * pud * ffWet) + ffLampCol * 0.35 * (1.0 - exp(-sp * norm * fres * blade * ffWet * 0.08));   // soft roll-off, never a white patch
					}`);
		};
		mat.customProgramCacheKey = () => "ff-wet" + nLamps;
	}
	// The grass up close, on top of the painted pitch (and the wet sheen, if any): the mowing stripes catch
	// the light by the way the blades lie, so a band is light seen one way and dark seen the other, as on a
	// broadcast (all levels: a few instructions); and, Medium and High, a fine blade grain that fades out by
	// distance, so the camera at pitch level sees grass, not a blurred picture of it.
	function grassShader3D (mat, gs, detail) {
		const mow = gs && cond.surfaceKey !== "turf" ? gs.mow : "stripes";
		const kind = mow === "checks" ? 2 : mow === "diag" ? 3 : mow === "rings" ? 0 : 1;
		const bands = Math.round(FW / (mow === "wide" ? 200 : 100)), prev = mat.onBeforeCompile, prevKey = prev ? mat.customProgramCacheKey() : "";
		mat.onBeforeCompile = (sh, r) => {
			if (prev) { prev(sh, r); }
			sh.uniforms.ffPitch = { value: new THREE.Vector4(FW, FH, FW / bands, FW / 14) };
			sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vGp;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
			sh.fragmentShader = sh.fragmentShader
				.replace("#include <common>", `#include <common>
					varying vec3 vGp; uniform vec4 ffPitch;
					float ffGh (vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
					float ffGn (vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ffGh(i), ffGh(i + vec2(1.0, 0.0)), f.x), mix(ffGh(i + vec2(0.0, 1.0)), ffGh(i + vec2(1.0, 1.0)), f.x), f.y); }`)
				.replace("#include <map_fragment>", `#include <map_fragment>
					{
						vec2 q = vGp.xz; vec3 V = cameraPosition - vGp; float dist = length(V); vec2 v2 = normalize(V.xz + vec2(1e-4));
						float inP = step(0.0, q.x) * step(q.x, ffPitch.x) * step(0.0, q.y) * step(q.y, ffPitch.y), sheen = 0.0;
						${kind === 1 ? "sheen = (mod(floor(q.x / ffPitch.z), 2.0) * 2.0 - 1.0) * v2.y;" : ""}
						${kind === 2 ? "float cp = mod(floor(q.x / (ffPitch.x / 12.0)) + floor(q.y / (ffPitch.y / 8.0)), 2.0); sheen = cp > 0.5 ? v2.y : v2.x;" : ""}
						${kind === 3 ? "vec2 dq = q - ffPitch.xy * 0.5; float u = (dq.x + dq.y) * 0.7071; sheen = (1.0 - 2.0 * mod(floor(u / ffPitch.w), 2.0)) * dot(v2, vec2(-0.7071, 0.7071));" : ""}
						diffuseColor.rgb *= 1.0 + 0.075 * sheen * inP;
						${detail ? `float near = 1.0 - smoothstep(120.0, 620.0, dist);
						if (near > 0.0) {
							float g1 = ffGn(q * vec2(1.9, 0.55)), g2 = ffGn(q * vec2(0.6, 2.3) + 13.0), g3 = ffGn(q * 0.11);
							diffuseColor.rgb *= 1.0 + near * (0.16 * (g1 * g2 - 0.28) + 0.06 * (g3 - 0.5));
						}` : ""}
					}`);
		};
		mat.customProgramCacheKey = () => `${prevKey}|ff-grass${kind}${detail ? "d" : ""}`;
	}
	// An afternoon in the sun: the stands' shadow on the grass, painted into the pitch picture once (no cost
	// per frame). The sun comes over the near stand (as the players' shadows say); the sunlit part of the pitch
	// is the opening of the bowl (the roof's front edge, or the top of an open stand) carried down along the
	// sun's rays, and everything outside it is in shade. Not under cloud (rain, snow) and not at night.
	function standShadow (g, gs) {
		if (!g || cond.ko !== "day" || cond.wet || cond.snow || !gs) { return; }
		const A = ARCH3[gs.arch] || ARCH3.azteca, P = bowlProfile3(A), [ sx, sz ] = sunDir3D(), cot = 2.3;   // a low sun (about 23 degrees): a 3pm kick-off in the season
		const r0 = bowlRing3(0, A.rc), rR = bowlRing3(P.back * A.roofIn, A.rc), rB = bowlRing3(P.back, A.rc);
		const c = document.createElement("canvas"); c.width = g.canvas.width; c.height = g.canvas.height;
		const s = c.getContext && c.getContext("2d");
		if (!s || !s.fill) { return; }
		const k = c.width / WW;
		s.scale(k, k);
		s.fillStyle = "rgb(4, 14, 22)"; s.fillRect(0, 0, WW, WH);
		s.globalCompositeOperation = "destination-out";
		try { s.filter = "blur(6px)"; } catch (e) { /* a hard edge, then */ }
		s.beginPath();
		r0.forEach((p, i) => {
			const roofed = gs.roof && (A.ring || Math.abs(p.nz) > 0.92), q = roofed ? rR[i] : rB[i], h = roofed ? P.top + 36 : P.top + 12;
			const x = q.x + sx * h * cot + MX, y = q.z + sz * h * cot + MY;
			if (i) { s.lineTo(x, y); } else { s.moveTo(x, y); }
		});
		s.closePath(); s.fill();
		g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = cond.heat ? 0.4 : 0.33; g.drawImage(c, 0, 0); g.restore();
	}
	function buildStadium3D () {
		const gs = gstyle || { mow: "stripes", roof: true, lights: "roof", fill: 0.8, seat: "#3b4a58", concrete: "#1b2520", steps: "#262f21", arch: "azteca" };
		const key = `${WW}x${WH}|${cond.label}|${cond.ko}|${cond.surfaceKey}|${gs.mow}${gs.roof}${gs.lights}${gs.fill}${gs.arch}${gs.mountains}|${gs.nat}${gs.seats}${gs.flags}${gs.bunting}${gs.concrete}|${KITS[0].outfield}${KITS[1].outfield}${homeSide}|${gfxLevel}`;
		if (G3.stadium && G3.stadiumKey === key && G3.standsRef === stands) { return; }
		if (G3.stadium) {
			G3.nearStand = null;
			G3.scene.remove(G3.stadium);
			G3.stadium.traverse(o => {
				if (o.geometry && o.userData.ownGeo) { o.geometry.dispose(); if (o.isInstancedMesh) { o.dispose(); } }
				if (o.material && o.userData.ownMat) { if (o.material.map) { o.material.map.dispose(); } if (o.material.emissiveMap) { o.material.emissiveMap.dispose(); } o.material.dispose(); }
			});
		}
		G3.stadiumKey = key; G3.standsRef = stands;
		const st = new THREE.Group(), Q = gfx3();
		G3.nearRoof = [];   // the near side of the ground: hidden while the camera sits in it
		const own = (o, mat = false) => { o.userData.ownGeo = true; o.userData.ownMat = mat; return o; };
		const ownMat = o => { o.userData.ownMat = true; return o; };
		// 1. The pitch: painted flat (no stands), laid on the ground. Unlit, so it reads exactly like the
		// 2D painting; in the rain the floodlights glance off it (a specular sheen).
		const pc = document.createElement("canvas"); pc.width = Math.ceil(WW); pc.height = Math.ceil(WH);
		const pg = pc.getContext && pc.getContext("2d");
		if (pg) {
			const keep = ctx, keepStands = stands;
			ctx = pg; stands = null;
			try { drawPitch(true); } finally { ctx = keep; stands = keepStands; }
			standShadow(pg, gs);
			const tex = canvasTex3D(pc);
			const mat = new THREE.MeshBasicMaterial({ map: tex });
			if (cond.wet > 0) { wetGround3D(mat, Q.wetLamps || 8); }
			grassShader3D(mat, gs, !!Q.grass);
			const ground = own(new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), mat), true);
			ground.rotation.x = -Math.PI / 2;
			ground.position.set(WW / 2 - MX, 0, WH / 2 - MY);
			st.add(ground);
		}
		// The land round the stadium, seen past the far stand from the gantry: by night near black; by day
		// muted grass and fields that fade into the haze toward the horizon (the fog does the fading), and the
		// clear colour behind everything is the haze too, so there is never a black void under a day sky.
		const dayLand = cond.ko === "day";
		const landCol = !dayLand ? (cond.surfaceKey === "turf" ? "#13311f" : "#0f2416") : cond.snow ? "#c3c9cc" : cond.wet ? "#3f5843" : cond.heat ? "#6f6c4e" : "#4a6542";
		if (G3.renderer) { G3.renderer.setClearColor(cond.fog ? (dayLand ? 0xb4babe : 0x343c43) : dayLand ? (cond.snow ? 0xc4cbd0 : cond.wet ? 0x8d979e : cond.heat ? 0xd9ccb0 : 0xa9bfd0) : 0x070c12, 1); }
		// By night as by day it runs out past where the fog has closed in: a smaller sheet ended in plain view,
		// a lighter slab with an edge round the stadium in the kick-off and half-time sweeps.
		const apron = new THREE.Mesh(new THREE.PlaneGeometry(WW * 14, WH * 14), mat3D(landCol, false));
		apron.rotation.x = -Math.PI / 2; apron.position.set(FW / 2, -0.6, FH / 2);
		st.add(own(apron));
		// 2. The stadium.
		const A = ARCH3[gs.arch] || ARCH3.azteca, P = bowlProfile3(A), rings = {}, ring = d => rings[d] || (rings[d] = bowlRing3(d, A.rc));
		const N = ring(0).length, nxt = j => (j + 1) % N;
		const isNear = j => { const a = ring(0)[j], b = ring(0)[nxt(j)]; return (a.nz + b.nz) / 2 > 0.45; };
		const longSide = j => { const a = ring(0)[j], b = ring(0)[nxt(j)]; return Math.abs(a.nz + b.nz) / 2 > 0.92; };
		const main = acc3(), near = acc3(), lamp = acc3(), nearLamp = acc3(), hills = acc3(), glow = [], nearGlow = [];
		const shade = (c, k) => { const v = col3(c); return [ v[0] * k, v[1] * k, v[2] * k ]; };
		const conc = col3(gs.concrete), step = shade(gs.steps, 1.35), riser = shade(gs.concrete, 0.8);
		const club = col3(KITS[homeSide].outfield);
		// The country's dress: its lamps (and the wet grass mirrors them), its roof's sheeting, its flags.
		const lampC = gs.lamp || [ 1.3, 1.22, 1.02 ], lampM = Math.max(...lampC);
		lampC.forEach((v, i) => { wetLampCol3[i] = 0.25 + 0.75 * v / lampM; });
		const natCols = (gs.natCols || [ "#ffffff", "#c8102e", "#ffffff" ]).map(col3);
		// Along segment j at distance d: the point a fraction u of the way.
		const at = (j, d, u, y) => { const a = ring(d)[j], b = ring(d)[nxt(j)]; return [ a.x + (b.x - a.x) * u, y, a.z + (b.z - a.z) * u ]; };
		const inward = j => { const a = ring(0)[j], b = ring(0)[nxt(j)]; return [ -(a.nx + b.nx) / 2, 0, -(a.nz + b.nz) / 2 ]; };
		const segLen = (j, d) => { const a = ring(d)[j], b = ring(d)[nxt(j)]; return Math.hypot(b.x - a.x, b.z - a.z); };
		// A strip between distances d0 and d1 (at heights y0, y1) along segment j, from u0 to u1.
		const strip = (T, j, d0, y0, d1, y1, col, u0 = 0, u1 = 1) => {
			const want = d0 === d1 ? inward(j) : y1 >= y0 - 0.01 && Math.abs(y1 - y0) < Math.abs(d1 - d0) ? [ 0, 1, 0 ] : inward(j);
			accQuad3(T, at(j, d0, u0, y0), at(j, d0, u1, y0), at(j, d1, u1, y1), at(j, d1, u0, y1), col, want);
		};
		// Aisles: stairs up through the seats every so often (none in the corners' first rows).
		const aisles = [];
		for (let j = 0; j < N; j++) {
			const L = segLen(j, 0);
			if (L > 200) { const n = Math.round(L / 150); for (let k = 1; k < n; k++) { aisles.push([ j, k / n ]); } } else if (j % 2 === 0) { aisles.push([ j, 0.5 ]); }
		}
		const aislesOf = j => aisles.filter(a => a[0] === j).map(a => a[1]);
		const lastRow = P.rows[P.rows.length - 1];
		// Seats: one by one (a pan and a back, in the ground's colours) where the Graphics level allows, built
		// with the crowd so that every empty place has a seat and none sits inside a fan; none on a terrace.
		const seatsMode = gs.seats || "club", seatEach = !!stands && !Q.benches && seatsMode !== "terrace";
		for (let j = 0; j < N; j++) {
			const T = isNear(j) ? near : main, TL = isNear(j) ? nearLamp : lamp, ai = aislesOf(j);
			// The front wall, with a painted band in the club's colour.
			strip(T, j, 0, 0, 0, P.rows[0].h, shade(conc, 0.7));
			strip(T, j, 0, P.rows[0].h - 1.6, 0, P.rows[0].h - 0.4, shade(club, 0.75));
			for (const [ ri, r ] of P.rows.entries()) {
				strip(T, j, r.d, r.h, r.d + r.rd, r.h, step);                                   // the tread
				if (!seatEach && seatsMode !== "terrace") {   // the seats as a bench along the row (Low graphics); otherwise one by one, with the crowd
					const sc = seatsMode === "multi" ? [ 0.2, 0.21, 0.23 ] : col3(seatColOf(gs, ri / P.rows.length, j) || gs.seat);
					strip(T, j, r.d + r.rd * 0.48, r.h, r.d + r.rd * 0.48, r.h + 2.4, sc);
					strip(T, j, r.d + r.rd * 0.48, r.h + 2.4, r.d + r.rd * 0.86, r.h + 2.4, shade(sc, 1.18));
				}
				if (!r.last) { strip(T, j, r.d + r.rd, r.h, r.d + r.rd, r.h + r.rh, riser); }  // the riser up to the next row
				const L = segLen(j, r.d + r.rd * 0.5);
				for (const u of ai) {   // the aisle's steps, lighter, over the seats
					const w = 3.2 / Math.max(1, L);
					strip(T, j, r.d, r.h + 2.5, r.d + r.rd, r.h + 2.5, shade(conc, 1.9), u - w, u + w);
				}
			}
			// The private boxes between the tiers: dark glass with the lights on in most of them,
			// and the upper tier's front above them with an LED ribbon in the club's colour.
			if (P.band) {
				const b = P.band, u = P.upper;
				strip(T, j, b.d, b.h0, b.d, b.h1, [ 0.05, 0.07, 0.09 ]);
				strip(T, j, b.d, b.h1, u.d, b.h1, shade(conc, 0.5));
				strip(T, j, u.d, b.h1, u.d, u.h, shade(conc, 0.85));
				const L = segLen(j, b.d), n = Math.max(1, Math.floor(L / 15));
				for (let k = 0; k < n; k++) {
					const hsh = Math.sin((j * 31 + k) * 12.9898) * 43758.5453, lit = hsh - Math.floor(hsh);
					if (lit < 0.25) { continue; }
					const u0 = (k + 0.12) / n, u1 = (k + 0.88) / n;
					strip(TL, j, b.d - 0.4, b.h0 + 4, b.d - 0.4, b.h1 - 3.5, lit > 0.8 ? [ 0.75, 0.86, 1 ] : [ 1, 0.82, 0.55 ], u0, u1);
				}
				strip(TL, j, u.d - 0.4, u.h - 7, u.d - 0.4, u.h - 2.5, shade(club, 0.9));
			}
			// The back wall and its parapet, down to the ground: open underneath, the sweeps over the ground
			// saw through under the stand to the pitch painting as a green wedge.
			strip(T, j, P.back, lastRow.h, P.back, P.top + 12, conc);
			const clad = cond.ko === "day" ? [ 0.36, 0.37, 0.39 ] : shade(gs.concrete, 1.15);   // the cladding outside: grey by day, dark by night
			strip(T, j, P.back, -0.5, P.back, lastRow.h + 0.5, clad);
			// Its outside, seen in the sweeps and the wide shots: a rib at each bay, a concourse band of
			// openings (lit warm by night), and a stair tower every few bays on the long sides.
			{
				const a0 = at(j, P.back, 0, 0), a1 = at(j, P.back, 1, 0), ry = Math.atan2(-(a1[2] - a0[2]), a1[0] - a0[0]), L = segLen(j, P.back);
				const ribC = clad.map(v => v * 1.25), night = cond.ko !== "day", TLo = isNear(j) ? nearLamp : lamp;
				const rb = at(j, P.back + 1.2, 0, 0); accBox3(T, rb[0], (P.top + 12) / 2, rb[2], 3.2, P.top + 12, 2.4, ribC, ry);
				const hb = Math.max(8, lastRow.h * 0.42), n = Math.floor(L / 24);
				const band = at(j, P.back + 0.5, 0.5, 0); accBox3(T, band[0], hb + 6.5, band[2], L, 1.6, 1.2, ribC, ry);   // the concourse floor's edge
				for (let k = 0; k < n; k++) {
					const o = at(j, P.back + 0.35, (k + 0.5) / n, 0);
					accBox3(night ? TLo : T, o[0], hb, o[2], 11, 8, 0.6, night ? [ 1.05, 0.8, 0.48 ] : [ 0.07, 0.08, 0.09 ], ry);
				}
				for (const u of !longSide(j) || L < 110 ? [] : L > 500 ? [ 0.22, 0.78 ] : [ 0.5 ]) {
					const tw = at(j, P.back + 9, u, 0), th = P.top + 4, tc = clad.map(v => v * 0.82);
					accBox3(T, tw[0], th / 2, tw[2], 30, th, 18, tc, ry);
					accBox3(T, tw[0], th + 1, tw[2], 33, 2, 21, ribC, ry);   // its cap
					for (let k = 0; k < 4; k++) {   // the stair windows, one per landing, up the outer face
						const sw = at(j, P.back + 18.4, u, 0);
						accBox3(night ? TLo : T, sw[0] + (k % 2 ? 6 : -6) * Math.cos(ry), th * (0.18 + 0.2 * k), sw[2] - (k % 2 ? 6 : -6) * Math.sin(ry), 5, 6, 0.6, night ? [ 0.95, 0.85, 0.65 ] : [ 0.07, 0.08, 0.09 ], ry);
					}
				}
			}
			strip(T, j, P.back - 3, P.top + 12, P.back, P.top + 12, cond.snow ? [ 0.84, 0.87, 0.9 ] : shade(conc, 1.2));   // the parapet's top (snow on it)
		}
		// The roof: a ring round the whole bowl, or over the two long sides, on masts with stays; the
		// floodlights in a line along its front edge at grounds lit that way.
		const roofLights = gs.roof && gs.lights === "roof";
		const lines = [], nearLines = [];
		if (gs.roof) {
			const rIn = P.back * A.roofIn, rOut = P.back + 8, hIn = P.top + 36, hOut = P.top + 24;
			const roofBase = gs.roofCol || [ 0.11, 0.12, 0.14 ], under = roofBase.map(v => v * 0.55 + 0.1);
			const roofC = cond.snow ? [ 0.84, 0.87, 0.9 ] : roofBase;   // snow lies on the roof
			for (let j = 0; j < N; j++) {
				if (!A.ring && !longSide(j)) { continue; }
				const T = isNear(j) ? near : main, TL = isNear(j) ? nearLamp : lamp, G = isNear(j) ? nearGlow : glow, Ln = isNear(j) ? nearLines : lines;
				strip(T, j, rIn, hIn, rOut, hOut, under);
				strip(T, j, rIn, hIn - 10, rIn, hIn + 1.5, roofC);
				// The roof's build: standing-seam sheeting (raised ribs down the slope), a gutter and fascia
				// along the back edge, and under it steel trusses from the front edge to the back wall, one
				// to a bay, each a top and bottom chord with zig-zag web.
				{
					const L = segLen(j, rIn), nr = Math.max(2, Math.round(L / 9)), seam = roofC.map(v => Math.min(1, v * 1.25 + 0.17)), steel = [ 0.26, 0.27, 0.3 ];
					for (let k = 0; k <= nr; k++) { const u = k / nr; accBeam3(T, at(j, rIn, u, hIn + 0.5), at(j, rOut, u, hOut + 0.5), 0.45, seam); }
					// Seen from outside, the top: a translucent rooflight band (pale by day, lit from below at night),
					// purlins across the ribs and a capping strip along the front edge, so it reads as built, not a slab.
					const fH = f => hIn + (hOut - hIn) * f, fD = f => rIn + (rOut - rIn) * f;
					if (!cond.snow) { strip(T, j, fD(0.4), fH(0.4) + 0.35, fD(0.56), fH(0.56) + 0.35, cond.ko === "day" ? [ 0.46, 0.5, 0.54 ] : [ 0.42, 0.37, 0.27 ]); }
					for (const f of [ 0.22, 0.4, 0.56, 0.78 ]) { accBeam3(T, at(j, fD(f), 0, fH(f) + 0.7), at(j, fD(f), 1, fH(f) + 0.7), 0.7, roofC.map(v => v * 0.6)); }
					accBeam3(T, at(j, rIn + 0.6, 0, hIn + 0.8), at(j, rIn + 0.6, 1, hIn + 0.8), 1.4, [ 0.5, 0.52, 0.55 ]);   // the front capping
					accBeam3(T, at(j, rOut + 1, 0, hOut - 0.5), at(j, rOut + 1, 1, hOut - 0.5), 2.2, [ 0.2, 0.21, 0.23 ]);   // the gutter
					accBeam3(T, at(j, rOut + 0.3, 0, hOut - 3), at(j, rOut + 0.3, 1, hOut - 3), 1.2, [ 0.32, 0.33, 0.36 ]);   // the fascia under it
					if (Q.lattice) {
						const nt = Math.max(1, Math.round(L / 60));
						for (let k = 0; k <= nt; k++) {
							const u = k / nt, depth = 7, segs = 6;
							const top = f => { const d = rIn + (rOut - rIn) * f; return at(j, d, u, hIn + (hOut - hIn) * f - 0.6); };
							const bot = f => { const d = rIn + 3 + (rOut - rIn - 3) * f; const p0 = at(j, d, u, hIn + (hOut - hIn) * f - 0.6 - depth * Math.sin(Math.PI * Math.min(1, 0.15 + f))); return p0; };
							accBeam3(T, bot(0), bot(1), 0.7, steel);
							for (let q = 0; q < segs; q++) { accBeam3(T, top(q / segs), bot((q + 1) / segs), 0.45, steel); accBeam3(T, bot((q + 1) / segs), top((q + 1) / segs), 0.45, steel); }
						}
					}
				}
				if (roofLights) {
					strip(TL, j, rIn + 1, hIn - 10.4, rIn + 4.5, hIn - 10.4, lampC);
					const L = segLen(j, rIn), n = Math.max(1, Math.round(L / 120));
					for (let k = 0; k < n; k++) { glow.length < 400 && G.push(...at(j, rIn + 2, (k + 0.5) / n, hIn - 13)); }
				}
				// A mast at the back of every other segment end, with a stay to the roof's front edge.
				if (j % 2 === 0) {
					const base = at(j, rOut + 3, 0, 0), top = at(j, rOut + 3, 0, hOut + 46), tip = at(j, rIn + 6, 0, hIn + 2);
					mast3D(T, base, top, Q.lattice);
					Ln.push(...top, ...tip, ...top, ...at(j, (rIn + rOut) / 2, 0, (hIn + hOut) / 2 + 1));
				}
			}
			// The ground's name hung on the far roof's front edge, just in front of it (pitch side) so the
			// edge never cuts through the lettering.
			G3.signAt = { y: hIn - 6, z: -F_SIDE3 - rIn + 1.2 };
		} else {
			G3.signAt = { y: P.top + 20, z: -F_SIDE3 - P.back + 2 };
		}
		// Flags along the top of the stands, the nation's and the club's in turn, on poles at the back of the
		// roof (or the stand's parapet where there is none); at some grounds a string of pennants in the
		// national colours across the stands' front. All merged into the stand meshes: no extra draw calls.
		{
			const clubCols = [ KITS[homeSide].outfield, KITS[homeSide].second || "#ffffff", KITS[homeSide].outfield ].map(col3);
			if (gs.flags) {
				let k = 0;
				for (let j = 0; j < N; j += 2) {
					const roofed = gs.roof && (A.ring || longSide(j)), d = roofed ? P.back + 6 : P.back - 1.5, y0 = roofed ? P.top + 24 : P.top + 12;
					const T = isNear(j) ? near : main, base = at(j, d, 0.5, y0), top = [ base[0], y0 + 40, base[2] ];
					accBeam3(T, base, top, 1.1, [ 0.55, 0.57, 0.6 ]);
					// the cloth flies along the stand, three bands across it
					const a0 = at(j, d, 0, 0), a1 = at(j, d, 1, 0), tx = a1[0] - a0[0], tz = a1[2] - a0[2], tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl;
					const fc = k++ % 2 ? clubCols : natCols, fw = 32, fh = 20, wave = 2.6;
					for (let b = 0; b < 3; b++) {
						const f0 = b / 3, f1 = (b + 1) / 3, w0 = Math.sin(f0 * 5) * wave, w1 = Math.sin(f1 * 5) * wave, inw = inward(j);
						const p = (f, w, y) => [ top[0] + ux * fw * f + inw[0] * w, y, top[2] + uz * fw * f + inw[2] * w ];
						accQuad3(T, p(f0, w0, top[1] - fh), p(f1, w1, top[1] - fh), p(f1, w1, top[1]), p(f0, w0, top[1]), fc[b], inw);
					}
				}
			}
			if (gs.bunting) {
				const dB = P.band ? P.upper.d - 0.6 : P.back - 1.2, yB = P.band ? P.upper.h - 0.5 : P.top + 11;
				let c = 0;
				for (let j = 0; j < N; j++) {
					const T = isNear(j) ? near : main, L = segLen(j, dB), n = Math.max(2, Math.floor(L / 9)), inw = inward(j);
					for (let q = 0; q < n; q++) {
						const u0 = (q + 0.1) / n, u1 = (q + 0.9) / n, um = (u0 + u1) / 2, sag = Math.sin(Math.PI * (q + 0.5) / n) * 2.5;
						const A0 = at(j, dB, u0, yB - sag), A1 = at(j, dB, u1, yB - sag), M0 = at(j, dB - 0.6, um, yB - sag - 8);
						const k3 = natCols[c++ % 3];
						for (const v of [ A0, A1, M0 ]) { T.pos.push(v[0], v[1], v[2]); T.nor.push(inw[0], 0.3, inw[2]); T.col.push(k3[0], k3[1], k3[2]); }
					}
				}
			}
		}
		// A roof mast: a three-legged steel lattice tapering up from the ground (chords, rings and zig-zag
		// bracing), capped with a head plate and a warning lamp, rather than a bare pole. A plain tapered
		// column at Low graphics.
		function mast3D (T, base, top, lattice) {
			const steel = [ 0.27, 0.29, 0.32 ], H = top[1] - base[1], w0 = 5.5, w1 = 2.2;
			const leg = (h, k) => { const w = w0 + (w1 - w0) * h / H, a = k * Math.PI * 2 / 3; return [ base[0] + Math.cos(a) * w, base[1] + h, base[2] + Math.sin(a) * w ]; };
			if (!lattice) { accBeam3(T, base, top, 3.2, steel); }
			else {
				for (let k = 0; k < 3; k++) { accBeam3(T, leg(0, k), leg(H, k), 1.1, steel); }
				const step = 16;
				for (let h = 0; h < H - 2; h += step) {
					const h1 = Math.min(H, h + step);
					for (let k = 0; k < 3; k++) { accBeam3(T, leg(h1, k), leg(h1, (k + 1) % 3), 0.55, steel); accBeam3(T, leg(h, k), leg(h1, (k + 1) % 3), 0.45, steel); }
				}
			}
			accBox3(T, top[0], top[1] + 1.5, top[2], 9, 3, 9, [ 0.18, 0.19, 0.21 ], 0, 0);
			accBox3(T, top[0], top[1] + 4, top[2], 1.6, 2, 1.6, [ 1.6, 0.25, 0.2 ], 0, 0);   // the red warning lamp
		}
		// Floodlight pylons at the four corners, lattice towers with a bank of lamps on top.
		if (!roofLights) {
			const PH = P.top + 175, steel = [ 0.3, 0.32, 0.35 ];
			for (const [ sx, sz ] of [ [ -1, -1 ], [ 1, -1 ], [ 1, 1 ], [ -1, 1 ] ]) {
				const T = sz > 0 ? near : main, TL = sz > 0 ? nearLamp : lamp, G = sz > 0 ? nearGlow : glow;
				const ax = FW / 2 + F_END3, az = FH / 2 + F_SIDE3, r0 = Math.min(A.rc, az - 20, ax - 20), R = r0 + P.back + 46;
				const cx = FW / 2 + sx * (ax - r0) + sx * R * 0.7071, cz = FH / 2 + sz * (az - r0) + sz * R * 0.7071;
				const leg = (h, i) => { const w = 15 - 10 * h / PH; return [ cx + (i & 1 ? w : -w), h, cz + (i & 2 ? w : -w) ]; };
				const order = [ 0, 1, 3, 2 ];
				if (gs.pylon === "pole") {
					// A slim steel pole (the newer grounds'): a tapering tube in three sections, a collar at each joint.
					for (let k = 0; k < 3; k++) {
						const h0 = PH * k / 3, h1 = PH * (k + 1) / 3, w = 7 - 1.6 * k;
						accBeam3(T, [ cx, h0, cz ], [ cx, h1 + 0.5, cz ], w, steel);
						accBox3(T, cx, h1, cz, w + 1.4, 1.6, w + 1.4, steel.map(v => v * 0.8));
					}
				} else { for (let i = 0; i < 4; i++) { accBeam3(T, leg(0, i), leg(PH, i), 2.2, steel); } }
				if (Q.lattice && gs.pylon !== "pole") {
					for (let h = 26; h < PH - 4; h += 26) {
						for (let k = 0; k < 4; k++) {
							const a = order[k], b = order[(k + 1) % 4];
							accBeam3(T, leg(h, a), leg(h, b), 0.9, steel);
							accBeam3(T, leg(h - 26, a), leg(h, b), 0.7, steel);
						}
					}
				}
				// The lamp bank, turned to the centre spot and tipped down at it.
				const ry = Math.atan2(FW / 2 - cx, FH / 2 - cz), fx = Math.sin(ry), fz = Math.cos(ry);
				accBox3(T, cx, PH + 14, cz, 74, 40, 5, [ 0.16, 0.17, 0.19 ], ry, 0.42);
				for (let a = 0; a < 3; a++) {
					for (let b = 0; b < 6; b++) {
						const lx = (b - 2.5) * 11.5, ly = (a - 1) * 11.5, tilt = 0.42, cy = PH + 14 + ly * Math.cos(tilt), off = 3 - ly * Math.sin(tilt);
						const px = cx + Math.cos(ry) * lx + fx * off, pz = cz - Math.sin(ry) * lx + fz * off;
						const rx = Math.cos(ry) * 4.4, rz = -Math.sin(ry) * 4.4, up = 4.4 * Math.cos(tilt), back = -4.4 * Math.sin(tilt);
						accQuad3(TL, [ px - rx, cy - up, pz - rz - fz * back ], [ px + rx, cy - up, pz + rz - fz * back ], [ px + rx, cy + up, pz + rz + fz * back ], [ px - rx, cy + up, pz - rz + fz * back ], lampC, [ fx, 0, fz ]);
					}
				}
				G.push(cx + fx * 9, PH + 14, cz + fz * 9);
			}
		}
		// The tunnel, in the middle of the near stand between the dugouts: a mouth in the front wall
		// with a concrete surround and a light over it, and the club's extendable canopy out to the boards.
		{
			const tz = FH + F_SIDE3, r = 16, z1 = FH + 5, n = 12, white = [ 0.92, 0.93, 0.94 ], dark = [ 0.03, 0.035, 0.04 ];
			accBox3(near, FW / 2, 13, tz + 3, 48, 26, 6, conc);
			accQuad3(near, [ FW / 2 - 15, 0, tz - 0.2 ], [ FW / 2 + 15, 0, tz - 0.2 ], [ FW / 2 + 15, 19, tz - 0.2 ], [ FW / 2 - 15, 19, tz - 0.2 ], dark, [ 0, 0, 1 ]);
			accBox3(nearLamp, FW / 2, 21.5, tz - 0.4, 26, 1.4, 0.6, lampC);
			for (let k = 0; k < n; k++) {
				const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n, am = (a0 + a1) / 2;
				const P0 = z => [ FW / 2 + Math.cos(a0) * r, Math.sin(a0) * r, z ], P1 = z => [ FW / 2 + Math.cos(a1) * r, Math.sin(a1) * r, z ];
				accQuad3(near, P0(tz - 0.5), P1(tz - 0.5), P1(z1), P0(z1), club, [ Math.cos(am), Math.sin(am), 0 ]);
				// white hoops round the canopy, and its open end
				for (const zr of [ z1 + 0.6, (z1 + tz) / 2, tz - 1.5 ]) {
					const R0 = z => [ FW / 2 + Math.cos(a0) * (r + 0.35), Math.sin(a0) * (r + 0.35), z ], R1 = z => [ FW / 2 + Math.cos(a1) * (r + 0.35), Math.sin(a1) * (r + 0.35), z ];
					accQuad3(near, R0(zr - 0.6), R1(zr - 0.6), R1(zr + 0.6), R0(zr + 0.6), white, [ Math.cos(am), Math.sin(am), 0 ]);
				}
			}
		}
		// The big screen above the end behind the left-hand goal, showing the score (hung under the
		// roof's front edge where the roof runs round the ends, otherwise on legs on top of the stand).
		// Off: at most grounds it sat inside the end stand's crowd rather than above it.
		const SHOW_BIG_SCREEN = false;
		if (SHOW_BIG_SCREEN) {
			const hung = gs.roof && A.ring, d = hung ? P.back * A.roofIn + 2 : P.back - 8, W = 180, H = 54;
			const sx = -F_END3 - d, cy = hung ? P.top + 36 - 12 - H / 2 : P.top + 10 + H / 2, frameC = [ 0.07, 0.075, 0.085 ];
			accBox3(main, sx - 2.5, cy, FH / 2, 4, H + 6, W + 6, frameC);
			if (hung) { for (const zz of [ -W * 0.35, W * 0.35 ]) { accBeam3(main, [ sx - 2.5, cy + H / 2, FH / 2 + zz ], [ sx - 2.5, P.top + 27, FH / 2 + zz ], 1.2, frameC); } }
			else { for (const zz of [ -W * 0.3, W * 0.3 ]) { accBeam3(main, [ sx - 2.5, P.top - 30, FH / 2 + zz ], [ sx - 2.5, cy, FH / 2 + zz ], 3, frameC); } }
			const scv = document.createElement("canvas"); scv.width = 640; scv.height = 194;
			const tex = canvasTex3D(scv);
			const scr = own(new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), true);
			scr.rotation.y = Math.PI / 2; scr.position.set(sx + 0.2, cy, FH / 2);
			st.add(scr);
			G3.screen = { cv: scv, tex, key: "" };
		}
		// Mountains behind the far stand at some grounds: black against the night sky; by day, blue-grey with
		// distance (the far ridge paler, the near one greener and darker), greyer in rain, pale in snow,
		// a warm haze in the heat. Never a black wall under an afternoon sky.
		if (gs.mountains || gs.arch === "monterrey") {
			let mh = 4242;
			const mr = () => (mh = (mh * 48271) % 2147483647) / 2147483647;
			const lit = cond.ko === "day";
			const cols = !lit ? [ [ 0.05, 0.07, 0.1 ], [ 0.035, 0.05, 0.07 ] ]
				: cond.snow ? [ [ 0.72, 0.75, 0.78 ], [ 0.55, 0.59, 0.62 ] ]
				: cond.wet ? [ [ 0.48, 0.53, 0.57 ], [ 0.34, 0.39, 0.41 ] ]
				: cond.heat ? [ [ 0.7, 0.66, 0.58 ], [ 0.5, 0.49, 0.41 ] ]
				: [ [ 0.55, 0.64, 0.72 ], [ 0.36, 0.46, 0.45 ] ];
			for (const [ z, k, col ] of [ [ -FH * 3.6, 1, cols[0] ], [ -FH * 2.7, 0.62, cols[1] ] ]) {
				const x0 = -FW * 2, x1 = FW * 3, n = 48;
				let prev = null;
				for (let i = 0; i <= n; i++) {
					const x = x0 + (x1 - x0) * i / n, f = i / n;
					// A saddle: two peaks with a dip between them, and smaller ridges either side.
					const saddle = Math.exp(-Math.pow((f - 0.42) / 0.07, 2)) + 0.85 * Math.exp(-Math.pow((f - 0.58) / 0.06, 2));
					const y = FH * k * (0.28 + 0.55 * saddle + 0.16 * Math.sin(f * 23 + k) + 0.1 * mr());
					if (prev) { accQuad3(hills, [ prev[0], -10, z ], [ x, -10, z ], [ x, y, z ], [ prev[0], prev[1], z ], col, [ 0, 0, 1 ]); }
					prev = [ x, y ];
				}
			}
		}
		if (stands) {
			// The ground's name, white on black, across the far side.
			const nc = document.createElement("canvas"); nc.width = 1024; nc.height = 64;
			const ng = nc.getContext && nc.getContext("2d");
			if (ng && ng.fillText) {
				const name = matchGround().toUpperCase();
				ng.fillStyle = "#0d1216"; ng.fillRect(0, 0, 1024, 64);
				ng.font = "900 46px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif"; ng.textAlign = "center"; ng.textBaseline = "middle";
				ng.fillStyle = "#eef2ec"; ng.fillText(name, 512, 34);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(400, 25), new THREE.MeshBasicMaterial({ map: canvasTex3D(nc) }));
				sign.position.set(FW / 2, G3.signAt.y, G3.signAt.z);
				st.add(own(sign, true));
			}
			buildCrowd3D(st, { ring, N, nxt, isNear, aisles: aislesOf, rows: P.rows, segLen, seats: seatEach ? { main, near, at } : null });
		}
		// The four merged meshes: the stands and roof (lit), the lamps and lit windows (unlit), each
		// in a far and a near part, plus the stays and the floodlights' glow.
		// In the rain the seats, steps and roofs are wet: darker, with a gloss that catches the lights.
		const solid = ownMat(cond.wet
			? new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xd2d4d6, specular: cond.wet > 1 ? 0x4c545c : 0x3a4148, shininess: 55 })
			: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
		const bright = ownMat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
		const mMain = meshAcc3(main, solid), mNear = meshAcc3(near, solid), mLamp = meshAcc3(lamp, bright), mNearLamp = meshAcc3(nearLamp, bright);
		const mHills = meshAcc3(hills, ownMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
		for (const m of [ mMain, mNear, mLamp, mNearLamp, mHills ]) { if (m) { st.add(m); } }
		if (mNear) { G3.nearRoof.push(mNear); }
		if (mNearLamp) { G3.nearRoof.push(mNearLamp); }
		G3.nearStand = mNear;
		const stays = (pts, isNearSide) => {
			if (!pts.length) { return; }
			const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
			const l = own(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x59626b })), true);
			st.add(l); if (isNearSide) { G3.nearRoof.push(l); }
		};
		stays(lines, false); stays(nearLines, true);
		const glowPts = (pts, isNearSide) => {
			if (!pts.length || !G3.glowTex) { return; }
			const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
			const haze = cond.fog ? 1.9 : cond.wet || cond.snow ? 1.45 : 1;   // the wet air (or the snow) catches the light: a wider halo
			const p = own(new THREE.Points(g, new THREE.PointsMaterial({ map: G3.glowTex, color: new THREE.Color(...wetLampCol3), size: (roofLights ? 110 : 260) * haze * (Q.glare || 1), sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75, fog: false })), true);
			st.add(p); if (isNearSide) { G3.nearRoof.push(p); }
		};
		glowPts(glow, false); glowPts(nearGlow, true);
		// At night, Medium and High: a broad bloom round the lamps, every few lamps along a roof (one draw call a side).
		const bloom = (pts, isNearSide) => {
			if (!pts.length || !G3.haloTex || !Q.bloom || cond.ko === "day") { return; }
			const n = pts.length / 3, step = Math.max(1, Math.round(n / 40)), cs = [];
			for (let i = 0; i < n; i += step) { cs.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); }
			const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
			g.index = base.index; g.setAttribute("position", base.attributes.position); g.setAttribute("uv", base.attributes.uv);
			g.setAttribute("aC", new THREE.InstancedBufferAttribute(new Float32Array(cs), 3)); g.instanceCount = cs.length / 3;
			const haze = cond.fog ? 1.6 : cond.wet || cond.snow ? 1.3 : 1;
			const mat = new THREE.ShaderMaterial({
				uniforms: { map: { value: G3.haloTex }, uSize: { value: (roofLights ? 330 : 820) * haze * (step > 1 ? 1.15 : 1) }, uCol: { value: new THREE.Color(...wetLampCol3).multiplyScalar(roofLights ? 0.3 : 0.42) } },
				vertexShader: "attribute vec3 aC; uniform float uSize; varying vec2 vUv; void main () { vUv = uv; vec4 mv = viewMatrix * vec4(aC, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }",
				fragmentShader: "uniform sampler2D map; uniform vec3 uCol; varying vec2 vUv; void main () { float a = texture2D(map, vUv).a; gl_FragColor = vec4(uCol * a, 1.0); }",
				blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false
			});
			const m = own(new THREE.Mesh(g, mat), true); m.frustumCulled = false; m.renderOrder = 2;
			base.dispose = () => {};
			st.add(m); if (isNearSide) { G3.nearRoof.push(m); }
		};
		bloom(glow, false); bloom(nearGlow, true);
		// The wet pitch reflects these lamps: up to eight, spread along the lists.
		const lampsAll = [ ...glow, ...nearGlow ], nL = lampsAll.length / 3;
		wetLamps3().forEach((v, i) => { if (nL) { const k = Math.floor((i + 0.5) * nL / 8) * 3; v.set(lampsAll[k], lampsAll[k + 1], lampsAll[k + 2]); } else { v.set(0, -1e4, 0); } });
		// 3. The goals: frames merged into one white mesh, and the nets (both in one mesh) with give.
		const cb = 55 * Z3, bb = cb * 0.72, gmid = (GOAL_T + GOAL_B) / 2, gw = GOAL_B - GOAL_T;
		const frame = acc3(), M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
		const post = new THREE.CylinderGeometry(1.7, 1.7, 1, 10), thin = new THREE.CylinderGeometry(1, 1, 1, 6);
		const put = (geo, x, y, z, len, rx) => { M.compose(V.set(x, y, z), Qn.setFromEuler(E.set(rx, 0, 0)), Sc.set(1, len, 1)); accGeo3(frame, geo, "#f7faf5", M); };
		for (const left of [ true, false ]) {
			const x0 = left ? 0 : FW, xb = left ? -NET : FW + NET;
			for (const y of [ GOAL_T, GOAL_B ]) { put(post, x0, cb / 2, y, cb, 0); put(thin, xb, bb / 2, y, bb, 0); }
			put(post, x0, cb, gmid, gw + 3.4, Math.PI / 2);
			put(thin, xb, bb, gmid, gw, Math.PI / 2);
			// The stanchions along the ground to the back of the net.
			for (const y of [ GOAL_T, GOAL_B ]) { M.compose(V.set((x0 + xb) / 2, 0.8, y), Qn.setFromEuler(E.set(0, 0, Math.PI / 2)), Sc.set(1, NET, 1)); accGeo3(frame, thin, "#d9ded8", M); }
		}
		post.dispose(); thin.dispose();
		st.add(meshAcc3(frame, ownMat(new THREE.MeshBasicMaterial({ vertexColors: true }))));
		buildNets3D(st, cb, bb, gw);
		// 4. The dugouts, sunk in front of the near stand.
		const dw = 190 * Math.sqrt(S);
		for (const cx of [ FW / 2 - dw * 0.62 - 20, FW / 2 + dw * 0.62 + 20 ]) {
			const dug = new THREE.Mesh(G3.geo.box, mat3D("#0c1214", false));
			dug.scale.set(dw, 13, 10); dug.position.set(cx, 6.5, FH + F_SIDE3 + 12); st.add(dug);
			const roof = new THREE.Mesh(G3.geo.box, new THREE.MeshBasicMaterial({ color: 0x8cb4c8, transparent: true, opacity: 0.35 }));
			roof.scale.set(dw + 6, 1.2, 22); roof.position.set(cx, 14, FH + F_SIDE3 + 7); st.add(ownMat(roof));
			// The bench the substitutes sit on, under the canopy.
			const seat = new THREE.Mesh(G3.geo.box, mat3D("#2b323b", false));
			seat.scale.set(dw - 6, 1.6, 6); seat.position.set(cx, 7, FH + F_SIDE3 + 5); st.add(seat);
			G3.nearRoof.push(dug, roof, seat); dug.userData.dugout = cx;
		}
		// 4b. LED advertising boards all round the pitch, with gaps for the dugouts: invented sponsors (no real
		// brand) on dark panels, lit from behind (not tone mapped, so they glow), a fine grid of LEDs over
		// them, and every few seconds the panels roll on to the next sponsor (a texture offset, nothing
		// allocated). Medium and High at night: their light spills on to the grass in front of them.
		const ac = document.createElement("canvas"); ac.width = 2048; ac.height = 96;
		const ag = ac.getContext && ac.getContext("2d");
		if (ag) {
			// The ground's own words (in the country's language) are kept for two panels in eight.
			const words = gs.words || [ "FLOODLIT", "MATCHDAY", "LIGA", "KICK OFF", "PREMIER", "NIGHT GAME", "90 MINUTOS", "GOL" ];
			const nc = (gs.natCols || [ "#c8102e" ]).find(c => lum(c) < 0.75 && lum(c) > 0.04) || "#c8102e";
			const home = KITS[homeSide].outfield, homeInk = lum(home) < 0.3 ? "#ffffff" : "#0b0f12";
			const panels = [
				[ BOARD_ADS3[0], "#0a1a33", "#5fd0ff" ], [ BOARD_ADS3[1], "#f4f6f8", "#101820" ], [ words[0], home, homeInk ], [ BOARD_ADS3[2], "#111111", "#f2b52e" ],
				[ BOARD_ADS3[3], "#0d3b2a", "#d8ff6a" ], [ BOARD_ADS3[4], nc, lum(nc) < 0.45 ? "#ffffff" : "#0b0f12" ], [ words[3], home, homeInk ], [ BOARD_ADS3[5], "#2a0a3a", "#ff7ad9" ]
			];
			panels.forEach(([ txt, bgc, fg ], i) => {
				const x0 = i * 256, gr = ag.createLinearGradient(0, 0, 0, 96);
				gr.addColorStop(0, bgc); gr.addColorStop(1, mixHex3(bgc, "#000000", 0.35));
				ag.fillStyle = gr; ag.fillRect(x0, 0, 256, 96);
				ag.fillStyle = fg; ag.fillRect(x0 + 10, 12, 6, 72);   // a sponsor's bar
				ag.font = "800 46px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif"; ag.textAlign = "center"; ag.textBaseline = "middle";
				ag.fillText(String(txt).toUpperCase(), x0 + 134, 50, 220);
			});
			// The LEDs: a dark grid every few pixels, fine enough to read as a screen close up and vanish by distance.
			ag.fillStyle = "rgba(0, 0, 0, 0.28)";
			for (let x = 0; x < 2048; x += 4) { ag.fillRect(x, 0, 1, 96); }
			for (let y = 0; y < 96; y += 4) { ag.fillRect(0, y, 2048, 1); }
			const tex = canvasTex3D(ac); tex.wrapS = THREE.RepeatWrapping;
			G3.boardTex = tex;
			const boardMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(cond.ko === "day" ? 0.92 : 1.12, cond.ko === "day" ? 0.92 : 1.12, cond.ko === "day" ? 0.92 : 1.12) });
			const spill = Q.bloom && cond.ko !== "day" ? acc3() : null;
			let first = true;
			const backs = [];   // the boards' backs: a dark panel behind each run (seen from the near side, the boards showed nothing)
			const board = (a0, a1, fixed, ry, alongX) => {
				const w = a1 - a0;
				if (w < 24) { return; }
				// A whole number of panels on every run of boards, starting on a panel's edge, so a gap
				// (the dugouts, the tunnel, the corners) never cuts a word in half.
				const geo = new THREE.PlaneGeometry(w, 16), uv = geo.attributes.uv, n = Math.max(1, Math.round(w / 37.5)), c0 = ((Math.round(a0 / 37.5) % 8) + 8) % 8;
				for (let i = 0; i < uv.count; i++) { uv.setX(i, (c0 + uv.getX(i) * n) / 8); }
				const m = new THREE.Mesh(geo, boardMat);
				if (alongX) { m.position.set(a0 + w / 2, 8, fixed); } else { m.position.set(fixed, 8, a0 + w / 2); }
				m.rotation.y = ry;
				m.userData.ownGeo = true; m.userData.ownMat = first; first = false;
				st.add(m);
				{
					const o = 0.7 * (alongX ? (fixed < FH / 2 ? -1 : 1) : (fixed < FW / 2 ? -1 : 1));   // a hand's width behind the screen
					const q = (a, y) => (alongX ? [ a, y, fixed + o ] : [ fixed + o, y, a ]);
					backs.push(...q(a0, 0), ...q(a1, 0), ...q(a1, 16.4), ...q(a0, 0), ...q(a1, 16.4), ...q(a0, 16.4));
				}
				if (spill) {
					// a strip of light on the grass, from the foot of the board out toward the pitch
					const d = 22, inX = alongX ? 0 : (fixed < 0 ? 1 : -1), inZ = alongX ? (fixed < 0 ? 1 : -1) : 0;
					const p = (a, o) => (alongX ? [ a, 0.3, fixed + inZ * o ] : [ fixed + inX * o, 0.3, a ]);
					accQuad3(spill, p(a0, 0.5), p(a1, 0.5), p(a1, d), p(a0, d), [ 0, 0, 0 ]);
				}
			};
			board(-F_END3 + 16, FW + F_END3 - 16, -12, 0, true);
			const gaps = [ FW / 2 - dw * 0.62 - 20, FW / 2 + dw * 0.62 + 20 ].map(cx => [ cx - dw / 2 - 6, cx + dw / 2 + 6 ]);
			board(-F_END3 + 16, gaps[0][0], FH + 12, Math.PI, true); board(gaps[0][1], FW / 2 - 20, FH + 12, Math.PI, true); board(FW / 2 + 20, gaps[1][0], FH + 12, Math.PI, true); board(gaps[1][1], FW + F_END3 - 16, FH + 12, Math.PI, true);   // a gap for the tunnel
			board(-6, FH + 6, -NET - 12, Math.PI / 2, false); board(-6, FH + 6, FW + NET + 12, -Math.PI / 2, false);
			if (backs.length) {
				// One mesh for all of them: a dark frame, a shade lighter by day.
				const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(backs, 3));
				st.add(own(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cond.ko === "day" ? 0x3b4247 : 0x15191c, side: THREE.DoubleSide })), true));
			}
			// Behind the near boards a concrete surround runs to the stand (the camera saw bare land there,
			// a flat band along the bottom of the picture where the near stand is left out).
			{
				const day = cond.ko === "day", w = FW + 2 * F_END3 + 600, d = 240;
				const sur = own(new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: day ? (cond.wet ? 0x3e4441 : 0x4d534d) : (cond.wet ? 0x15191b : 0x191e20) })), true);
				sur.rotation.x = -Math.PI / 2; sur.position.set(FW / 2, 0.15, FH + 13 + d / 2);
				st.add(sur);
			}
			if (spill && spill.pos.length) {
				// Brightest at the board, fading out over the grass: the fade is the strip's own depth (uv.y).
				const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(spill.pos, 3));
				const fade = new Float32Array(spill.pos.length / 3);
				for (let i = 0; i < fade.length; i++) { fade[i] = [ 1, 1, 0, 1, 0, 0 ][i % 6]; }   // each quad (a, b, c, a, c, d): a and b at the board, c and d out on the grass
				g.setAttribute("aF", new THREE.BufferAttribute(fade, 1));
				const sm = new THREE.ShaderMaterial({
					vertexShader: "attribute float aF; varying float vF; void main () { vF = aF; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
					fragmentShader: "varying float vF; void main () { gl_FragColor = vec4(vec3(0.75, 0.82, 0.95) * 0.11 * vF * vF, 1.0); }",
					blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, side: THREE.DoubleSide
				});
				st.add(own(new THREE.Mesh(g, sm), true));
			}
		}
		// 5. The night: a sky that darkens overhead, a few stars, and the floodlights lighting the players.
		const sc = document.createElement("canvas"); sc.width = 2; sc.height = 128;
		const sg = sc.getContext && sc.getContext("2d");
		if (sg) {
			const grad = sg.createLinearGradient(0, 0, 0, 128);
			const day = cond.ko === "day";
			const stops = cond.fog ? (day ? [ "#9aa1a6", "#aeb4b8", "#b4babe" ] : [ "#151a1f", "#2a3238", "#343c43" ]) : day ? (cond.snow ? [ "#6f7880", "#a0a8ae", "#d6dadd" ] : cond.wet ? [ "#454f58", "#6b7680", "#a2abb2" ] : cond.heat ? [ "#2a6fb4", "#86b3d6", "#eadbbd" ] : [ "#2f639a", "#6e9cc6", "#c3d6e4" ]) : [ "#010206", "#060b11", "#121d26" ];
			grad.addColorStop(0, stops[0]); grad.addColorStop(0.55, stops[1]); grad.addColorStop(1, stops[2]);
			sg.fillStyle = grad; sg.fillRect(0, 0, 2, 128);
			const sky = new THREE.Mesh(new THREE.SphereGeometry(FH * 9, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshBasicMaterial({ map: tex3D(sc), side: THREE.BackSide, fog: false }));
			sky.position.set(FW / 2, -FH * 0.2, FH / 2); st.add(own(sky, true));
		}
		const starPts = [];
		let sh = 12345;
		const srnd = () => (sh = (sh * 48271) % 2147483647) / 2147483647;
		for (let i = 0; i < 260; i++) {
			const a = srnd() * Math.PI * 2, e = 0.15 + srnd() * 1.3, r = FH * 8;
			starPts.push(FW / 2 + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, FH / 2 + Math.sin(a) * Math.cos(e) * r);
		}
		const stg = new THREE.BufferGeometry(); stg.setAttribute("position", new THREE.Float32BufferAttribute(starPts, 3));
		const dayLit = cond.ko === "day";
		if (!dayLit) { st.add(own(new THREE.Points(stg, new THREE.PointsMaterial({ color: 0xdde6ff, size: 1.8, sizeAttenuation: false, fog: false })), true)); }
		// Intensities carry the factor of PI that three.js scaled in for us before r155.
		const LI = Math.PI;
		st.add(new THREE.AmbientLight(dayLit ? 0x9aa7b2 : 0x5e6a74, (dayLit ? 0.85 : 0.5) * LI));
		st.add(new THREE.HemisphereLight(dayLit ? 0x9cb9d6 : 0x46586c, dayLit ? 0x2e4a34 : 0x1e3a2a, (dayLit ? 0.7 : 0.45) * LI));
		const key1 = new THREE.DirectionalLight(0xfff1d6, (dayLit ? 0.9 : 0.75) * LI); key1.position.set(-FW * 0.2, FH * 1.6, FH * 1.6); key1.target.position.set(FW / 2, 0, FH / 2);
		const key2 = new THREE.DirectionalLight(0xfff1d6, 0.45 * LI); key2.position.set(FW * 1.2, FH * 1.6, -FH * 0.5); key2.target.position.set(FW / 2, 0, FH / 2);
		st.add(key1, key1.target, key2, key2.target);
		// At night the lamps on the far side catch the players' edges, as they do on television: a cool back light.
		if (!dayLit) { const rim = new THREE.DirectionalLight(0xdce6ff, 0.42 * LI); rim.position.set(FW * 0.5, FH * 1.1, -FH * 1.6); rim.target.position.set(FW / 2, 0, FH / 2); st.add(rim, rim.target); }
		// A little haze with distance, so the far stand and roof sit back behind the pitch: thicker in the
		// heat, in rain (wet air, lit by the floodlights at night) and in snow. (There is no fog weather:
		// fog thickest of all, closing in over the pitch itself.) At night the air is a lit blue-grey, never black,
		// so the far crowd fades rather than darkens.
		const hazeCol = cond.fog ? (dayLit ? 0xb4babe : 0x343c43) : cond.snow ? (dayLit ? 0xc4cbd0 : 0x2a3036) : dayLit ? (cond.wet ? 0x8d979e : cond.heat ? 0xd9ccb0 : 0xa9bfd0) : cond.wet ? 0x1a232c : 0x0d151d;
		const hazeAt = cond.fog ? [ 0.1, 2.0 ] : cond.snow ? [ 1.1, 5 ] : cond.wet === 2 ? [ 0.9, 6 ] : cond.wet ? [ 1.1, 7.5 ] : cond.heat ? [ 1.1, 7 ] : dayLit ? [ 1.4, 9 ] : [ 1.6, 10 ];
		G3.scene.fog = new THREE.Fog(hazeCol, FH * hazeAt[0], FH * hazeAt[1]);
		G3.stadium = st;
		G3.scene.add(st);
	}
	// The nets: a mesh of lines over the roof, the back and the sides of each goal, every knot a
	// vertex that can move. The frame and the ground hold the edges; a ball in the net pushes the
	// knots near it back and sets the net swinging, which dies away.
	function buildNets3D (st, cb, bb, gw) {
		const pos = [], rest = [], nrm = [], wgt = [], idx = [], goalOf = [];
		const panel = (g, nu, nv, P, n) => {   // P(u, v) -> [ x, y, z ]; n: the way the panel gives
			const b = pos.length / 3;
			for (let j = 0; j <= nv; j++) {
				for (let i = 0; i <= nu; i++) {
					const p = P(i / nu, j / nv);
					pos.push(...p); rest.push(...p); nrm.push(...n); goalOf.push(g);
					wgt.push(Math.sin(Math.PI * i / nu) * Math.sin(Math.PI * j / nv));
				}
			}
			for (let j = 0; j <= nv; j++) { for (let i = 0; i <= nu; i++) {
				const k = b + j * (nu + 1) + i;
				if (i < nu) { idx.push(k, k + 1); }
				if (j < nv) { idx.push(k, k + nu + 1); }
			} }
		};
		const cols = Math.max(8, Math.round(gw / 14));
		[ true, false ].forEach((left, g) => {
			const x0 = left ? 0 : FW, xb = left ? -NET : FW + NET, out = left ? -1 : 1;
			const lerp = (a, b, t) => a + (b - a) * t;
			// The roof of the net: from the crossbar back to the rear bar, sagging a little in the middle.
			panel(g, cols, 4, (u, v) => [ lerp(x0, xb, v), lerp(cb, bb, v) - Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 2.5, lerp(GOAL_T, GOAL_B, u) ], [ out * 0.4, 0.9, 0 ]);
			// The back: hanging from the rear bar to the ground.
			panel(g, cols, 6, (u, v) => [ xb + out * Math.sin(Math.PI * v) * Math.sin(Math.PI * u) * 2, lerp(bb, 0, v), lerp(GOAL_T, GOAL_B, u) ], [ out, 0, 0 ]);
			// The sides.
			for (const [ y, s ] of [ [ GOAL_T, -1 ], [ GOAL_B, 1 ] ]) {
				panel(g, 4, 6, (u, v) => [ lerp(x0, xb, u), lerp(lerp(cb, bb, u), 0, v), y ], [ 0, 0, s ]);
			}
		});
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
		geo.setIndex(idx);
		const net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 }));
		net.userData.ownGeo = true; net.userData.ownMat = true;
		st.add(net);
		G3.nets = { net, rest: Float32Array.from(rest), nrm: Float32Array.from(nrm), wgt: Float32Array.from(wgt), goalOf, amp: [ 0, 0 ], ph: [ 0, 0 ], hit: [ null, null ], inside: [ false, false ], moving: false, rip: [ 0, 0 ], rt: [ 0, 0 ], rAt: [ null, null ] };
	}
	// The ball off the woodwork: the frame shudders and the net swings from the post or the bar.
	function shakeGoal3D (left, y, z) {
		const NT = G3.nets;
		if (!NT || bulkSim) { return; }
		const wx = (endsSwapped() ? !left : left) ? 0 : FW, g = wx < FW / 2 ? 0 : 1;
		NT.amp[g] = Math.max(NT.amp[g], 4.5); NT.ph[g] = 0; NT.hit[g] = [ wx, Math.max(0, z) * Z3, y ]; NT.moving = true;
		if (gfxLevel !== "light") { NT.rip[g] = Math.max(NT.rip[g], 1.6); NT.rt[g] = 0; NT.rAt[g] = NT.hit[g]; }
	}
	// Every frame: is the ball in a net? It bulges where the ball is (a pocket that holds while the ball sits
	// in it) and swings, and from where it struck a ring of ripple runs out across the mesh and dies away.
	// All of it moves the net's own knots, no extra draw call. Light has the bulge and swing, not the ripple.
	const NET_RIP_W = 15, NET_RIP_V = 3.4, NET_RIP_L = 9;   // the ripple's width, its speed out (a frame), its wavelength
	function animateNets3D (bx, by, bh, dt) {
		const NT = G3.nets;
		if (!NT) { return; }
		const cb = 55 * Z3, rippled = gfxLevel !== "light";
		let any = false;
		for (let g = 0; g < 2; g++) {
			const inside = (g === 0 ? bx < -1 : bx > FW + 1) && by > GOAL_T - 2 && by < GOAL_B + 2 && bh < cb + 4;
			if (inside && !NT.inside[g]) {
				const pace = Math.hypot(ball.vx || 0, ball.vy || 0);
				NT.amp[g] = Math.min(9, 3 + pace * 0.9); NT.ph[g] = 0; NT.hit[g] = [ bx, bh, by ];
				NT.rip[g] = rippled ? Math.min(4.5, 1.2 + pace * 0.3) : 0; NT.rt[g] = 0; NT.rAt[g] = [ bx, bh, by ];
			}
			NT.inside[g] = inside;
			if (inside) { NT.hit[g] = [ bx, bh, by ]; }
			NT.ph[g] += dt * 0.32;
			NT.amp[g] *= Math.pow(0.955, dt);
			NT.rt[g] += dt; NT.rip[g] *= Math.pow(0.95, dt);
			if (NT.rip[g] < 0.05) { NT.rip[g] = 0; }
			if (NT.amp[g] > 0.05 || inside || NT.rip[g] > 0) { any = true; }
		}
		if (!any && !NT.moving) { return; }
		NT.moving = any;
		const arr = NT.net.geometry.attributes.position.array, R = NT.rest, n = NT.nrm, w = NT.wgt;
		for (let k = 0, v = 0; v < w.length; v++, k += 3) {
			const g = NT.goalOf[v], h = NT.hit[g];
			let d = 0;
			if (h && w[v] > 0) {
				const dx = R[k] - h[0], dy = R[k + 1] - h[1], dz = R[k + 2] - h[2], dd = dx * dx + dy * dy + dz * dz;
				const fall = Math.exp(-dd / (2 * 34 * 34));
				d = w[v] * fall * (NT.amp[g] * Math.sin(NT.ph[g]) + (NT.inside[g] ? 3.5 : 0));
				const ra = NT.rAt[g];
				if (NT.rip[g] > 0 && ra) {   // the ring running out from where it struck
					const r = Math.hypot(R[k] - ra[0], R[k + 1] - ra[1], R[k + 2] - ra[2]) - NT.rt[g] * NET_RIP_V;
					if (r > -3 * NET_RIP_W && r < 3 * NET_RIP_W) { d += Math.sqrt(w[v]) * NT.rip[g] * Math.exp(-r * r / (2 * NET_RIP_W * NET_RIP_W)) * Math.cos(r / NET_RIP_L * Math.PI); }
				}
			}
			arr[k] = R[k] + n[k] * d; arr[k + 1] = R[k + 1] + n[k + 1] * d; arr[k + 2] = R[k + 2] + n[k + 2] * d;
		}
		NT.net.geometry.attributes.position.needsUpdate = true;
	}
