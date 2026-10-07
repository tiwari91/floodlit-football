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
	const GFX3 = {
		low: { seat: 15, fill: 0.62, hiRows: 0, nearHiRows: 2, liteRow: 3, lattice: false, shadows: 1, ratio: 1, aa: false },
		medium: { seat: 12, fill: 0.82, hiRows: 0, nearHiRows: 4, liteRow: 6, lattice: true, shadows: 3, ratio: 1.5, aa: !coarse },
		high: { seat: 10, fill: 1, hiRows: 2, nearHiRows: 5, liteRow: 8, lattice: true, shadows: 5, ratio: 2, aa: true }
	};
	const GFX_NAME = { low: "Low", medium: "Medium", high: "High" };
	const defaultGfx = () => {
		const cores = navigator.hardwareConcurrency || 4;
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
		G3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx3().ratio));
		G3.renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
	}
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
			G3.ballShadow = flat3D(g.shadow, 0x000000, 0.4);
			G3.scene.add(G3.ball, G3.ballShadow);
			// The markers painted on the grass: pass ring, your ring and arrow, the offside line, the
			// referee's spray and the wall, the keeper's ring, the tutorial's ring.
			const amber = 0xf2b52e;
			const mk = {
				pass: flat3D(g.ring, amber, 0.95), me: flat3D(g.ring, amber, 0.95), meFill: flat3D(g.disc, amber, 0.2), arrow: flat3D(g.arrow, amber, 1),
				cone: new THREE.Mesh(g.cone, mat3D("#f2b52e", false)), offside: flat3D(g.box, 0xde4f5a, 0.55), fk: flat3D(g.ring, 0xffffff, 0.55),
				wall: flat3D(g.box, 0xffffff, 0.8), keeper: flat3D(g.ring, 0xffffff, 0.28), tut: flat3D(g.ring, amber, 0.9), tutFill: flat3D(g.disc, amber, 0.25),
				next: flat3D(g.ring, 0xffffff, 0.7)
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
				grad.addColorStop(0, "rgba(255, 244, 210, 0.9)"); grad.addColorStop(0.35, "rgba(255, 244, 210, 0.3)"); grad.addColorStop(1, "rgba(255, 244, 210, 0)");
				gg.fillStyle = grad; gg.fillRect(0, 0, 64, 64);
				G3.glowTex = tex3D(gc);
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
	function buildStadium3D () {
		const gs = gstyle || { mow: "stripes", roof: true, lights: "roof", fill: 0.8, seat: "#3b4a58", concrete: "#1b2520", steps: "#262f21", arch: "azteca" };
		const key = `${WW}x${WH}|${cond.label}|${cond.ko}|${cond.surfaceKey}|${gs.mow}${gs.roof}${gs.lights}${gs.fill}${gs.arch}${gs.mountains}|${KITS[0].outfield}${KITS[1].outfield}${homeSide}|${gfxLevel}`;
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
			const tex = canvasTex3D(pc);
			const mat = cond.wet > 0
				? new THREE.MeshPhongMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, specular: new THREE.Color(0.08 + 0.1 * cond.wet, 0.09 + 0.11 * cond.wet, 0.1 + 0.11 * cond.wet), shininess: 34 })
				: new THREE.MeshBasicMaterial({ map: tex });
			const ground = own(new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), mat), true);
			ground.rotation.x = -Math.PI / 2;
			ground.position.set(WW / 2 - MX, 0, WH / 2 - MY);
			st.add(ground);
		}
		const apron = new THREE.Mesh(new THREE.PlaneGeometry(WW * 4, WH * 4), mat3D(cond.surfaceKey === "turf" ? "#13311f" : "#0f2416", false));
		apron.rotation.x = -Math.PI / 2; apron.position.set(FW / 2, -0.6, FH / 2);
		st.add(own(apron));
		// 2. The stadium.
		const A = ARCH3[gs.arch] || ARCH3.azteca, P = bowlProfile3(A), rings = {}, ring = d => rings[d] || (rings[d] = bowlRing3(d, A.rc));
		const N = ring(0).length, nxt = j => (j + 1) % N;
		const isNear = j => { const a = ring(0)[j], b = ring(0)[nxt(j)]; return (a.nz + b.nz) / 2 > 0.45; };
		const longSide = j => { const a = ring(0)[j], b = ring(0)[nxt(j)]; return Math.abs(a.nz + b.nz) / 2 > 0.92; };
		const main = acc3(), near = acc3(), lamp = acc3(), nearLamp = acc3(), hills = acc3(), glow = [], nearGlow = [];
		const shade = (c, k) => { const v = col3(c); return [ v[0] * k, v[1] * k, v[2] * k ]; };
		const conc = col3(gs.concrete), step = shade(gs.steps, 1.35), riser = shade(gs.concrete, 0.8), seat = col3(gs.seat), seatTop = shade(gs.seat, 1.18);
		const club = col3(KITS[homeSide].outfield);
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
		for (let j = 0; j < N; j++) {
			const T = isNear(j) ? near : main, TL = isNear(j) ? nearLamp : lamp, ai = aislesOf(j);
			// The front wall, with a painted band in the club's colour.
			strip(T, j, 0, 0, 0, P.rows[0].h, shade(conc, 0.7));
			strip(T, j, 0, P.rows[0].h - 1.6, 0, P.rows[0].h - 0.4, shade(club, 0.75));
			for (const r of P.rows) {
				strip(T, j, r.d, r.h, r.d + r.rd, r.h, step);                                   // the tread
				strip(T, j, r.d + r.rd * 0.48, r.h, r.d + r.rd * 0.48, r.h + 2.4, seat);           // the seats
				strip(T, j, r.d + r.rd * 0.48, r.h + 2.4, r.d + r.rd * 0.86, r.h + 2.4, seatTop);
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
			// The back wall and its parapet.
			strip(T, j, P.back, lastRow.h, P.back, P.top + 12, conc);
			strip(T, j, P.back - 3, P.top + 12, P.back, P.top + 12, shade(conc, 1.2));
		}
		// The roof: a ring round the whole bowl, or over the two long sides, on masts with stays; the
		// floodlights in a line along its front edge at grounds lit that way.
		const roofLights = gs.roof && gs.lights === "roof";
		const lines = [], nearLines = [];
		if (gs.roof) {
			const rIn = P.back * A.roofIn, rOut = P.back + 8, hIn = P.top + 36, hOut = P.top + 24;
			const roofC = [ 0.11, 0.12, 0.14 ], under = [ 0.2, 0.21, 0.23 ];
			for (let j = 0; j < N; j++) {
				if (!A.ring && !longSide(j)) { continue; }
				const T = isNear(j) ? near : main, TL = isNear(j) ? nearLamp : lamp, G = isNear(j) ? nearGlow : glow, Ln = isNear(j) ? nearLines : lines;
				strip(T, j, rIn, hIn, rOut, hOut, under);
				strip(T, j, rIn, hIn - 10, rIn, hIn + 1.5, roofC);
				if (roofLights) {
					strip(TL, j, rIn + 1, hIn - 10.4, rIn + 4.5, hIn - 10.4, [ 1.25, 1.18, 1.0 ]);
					const L = segLen(j, rIn), n = Math.max(1, Math.round(L / 120));
					for (let k = 0; k < n; k++) { glow.length < 400 && G.push(...at(j, rIn + 2, (k + 0.5) / n, hIn - 13)); }
				}
				// A mast at the back of every other segment end, with a stay to the roof's front edge.
				if (j % 2 === 0) {
					const base = at(j, rOut + 3, 0, 0), top = at(j, rOut + 3, 0, hOut + 46), tip = at(j, rIn + 6, 0, hIn + 2);
					accBeam3(T, base, top, 3.2, [ 0.24, 0.26, 0.29 ]);
					Ln.push(...top, ...tip, ...top, ...at(j, (rIn + rOut) / 2, 0, (hIn + hOut) / 2 + 1));
				}
			}
			// The ground's name along the far roof's front edge.
			G3.signAt = { y: hIn - 4.5, z: -F_SIDE3 - rIn - 0.6 };
		} else {
			G3.signAt = { y: P.top + 20, z: -F_SIDE3 - P.back + 2 };
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
				for (let i = 0; i < 4; i++) { accBeam3(T, leg(0, i), leg(PH, i), 2.2, steel); }
				if (Q.lattice) {
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
						accQuad3(TL, [ px - rx, cy - up, pz - rz - fz * back ], [ px + rx, cy - up, pz + rz - fz * back ], [ px + rx, cy + up, pz + rz + fz * back ], [ px - rx, cy + up, pz - rz + fz * back ], [ 1.3, 1.22, 1.02 ], [ fx, 0, fz ]);
					}
				}
				G.push(cx + fx * 9, PH + 14, cz + fz * 9);
			}
		}
		// Mountains behind the far stand at some grounds, black against the night sky.
		if (gs.mountains || gs.arch === "monterrey") {
			let mh = 4242;
			const mr = () => (mh = (mh * 48271) % 2147483647) / 2147483647;
			for (const [ z, k, col ] of [ [ -FH * 3.6, 1, [ 0.05, 0.07, 0.1 ] ], [ -FH * 2.7, 0.62, [ 0.035, 0.05, 0.07 ] ] ]) {
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
		// The four merged meshes: the stands and roof (lit), the lamps and lit windows (unlit), each
		// in a far and a near part, plus the stays and the floodlights' glow.
		const solid = ownMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
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
			const p = own(new THREE.Points(g, new THREE.PointsMaterial({ map: G3.glowTex, size: roofLights ? 110 : 260, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75, fog: false })), true);
			st.add(p); if (isNearSide) { G3.nearRoof.push(p); }
		};
		glowPts(glow, false); glowPts(nearGlow, true);
		if (stands) {
			// The ground's name, white on black, across the far side.
			const nc = document.createElement("canvas"); nc.width = 1024; nc.height = 64;
			const ng = nc.getContext && nc.getContext("2d");
			if (ng && ng.fillText) {
				const name = (leagueMatch ? (leagueMatch.home ? YOU : TEAMS[leagueMatch.opp]).ground : YOU.ground).toUpperCase();
				ng.fillStyle = "#0d1216"; ng.fillRect(0, 0, 1024, 64);
				ng.font = "900 46px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif"; ng.textAlign = "center"; ng.textBaseline = "middle";
				ng.fillStyle = "#eef2ec"; ng.fillText(name, 512, 34);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(400, 25), new THREE.MeshBasicMaterial({ map: canvasTex3D(nc) }));
				sign.position.set(FW / 2, G3.signAt.y, G3.signAt.z);
				st.add(own(sign, true));
			}
			buildCrowd3D(st, { ring, N, nxt, isNear, aisles: aislesOf, rows: P.rows, segLen });
		}
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
			dug.scale.set(dw, 13, 18); dug.position.set(cx, 6.5, FH + F_SIDE3 + 8); st.add(dug);
			const roof = new THREE.Mesh(G3.geo.box, new THREE.MeshBasicMaterial({ color: 0x8cb4c8, transparent: true, opacity: 0.35 }));
			roof.scale.set(dw + 6, 1.2, 22); roof.position.set(cx, 14, FH + F_SIDE3 + 7); st.add(ownMat(roof));
			G3.nearRoof.push(dug, roof); dug.userData.dugout = cx;
		}
		// 4b. Advertising boards all round the pitch, lit like LED hoardings, with gaps for the dugouts.
		const ac = document.createElement("canvas"); ac.width = 1024; ac.height = 48;
		const ag = ac.getContext && ac.getContext("2d");
		if (ag) {
			const words = [ "FLOODLIT", "MATCHDAY", "LIGA", "KICK OFF", "PREMIER", "NIGHT GAME", "90 MINUTOS", "GOL" ];
			const cols = [ [ "#102a4a", "#ffffff" ], [ "#ffffff", "#0d1b2a" ], [ KITS[homeSide].outfield, lum(KITS[homeSide].outfield) < 0.3 ? "#ffffff" : "#0b0f12" ], [ "#1d1d1d", "#f2b52e" ] ];
			for (let i = 0; i < 8; i++) {
				const [ bgc, fg ] = cols[i % cols.length];
				ag.fillStyle = bgc; ag.fillRect(i * 128, 0, 128, 48);
				ag.fillStyle = fg; ag.font = "800 22px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif"; ag.textAlign = "center"; ag.textBaseline = "middle";
				ag.fillText(words[i], i * 128 + 64, 25);
			}
			const tex = canvasTex3D(ac); tex.wrapS = THREE.RepeatWrapping;
			const boardMat = new THREE.MeshBasicMaterial({ map: tex });
			let first = true;
			const board = (a0, a1, fixed, ry, alongX) => {
				const w = a1 - a0;
				if (w < 24) { return; }
				const geo = new THREE.PlaneGeometry(w, 16), uv = geo.attributes.uv;
				for (let i = 0; i < uv.count; i++) { uv.setX(i, (a0 + uv.getX(i) * w) / 300); }
				const m = new THREE.Mesh(geo, boardMat);
				if (alongX) { m.position.set(a0 + w / 2, 8, fixed); } else { m.position.set(fixed, 8, a0 + w / 2); }
				m.rotation.y = ry;
				m.userData.ownGeo = true; m.userData.ownMat = first; first = false;
				st.add(m);
			};
			board(-F_END3 + 16, FW + F_END3 - 16, -12, 0, true);
			const gaps = [ FW / 2 - dw * 0.62 - 20, FW / 2 + dw * 0.62 + 20 ].map(cx => [ cx - dw / 2 - 6, cx + dw / 2 + 6 ]);
			board(-F_END3 + 16, gaps[0][0], FH + 12, Math.PI, true); board(gaps[0][1], gaps[1][0], FH + 12, Math.PI, true); board(gaps[1][1], FW + F_END3 - 16, FH + 12, Math.PI, true);
			board(-6, FH + 6, -NET - 12, Math.PI / 2, false); board(-6, FH + 6, FW + NET + 12, -Math.PI / 2, false);
		}
		// 5. The night: a sky that darkens overhead, a few stars, and the floodlights lighting the players.
		const sc = document.createElement("canvas"); sc.width = 2; sc.height = 128;
		const sg = sc.getContext && sc.getContext("2d");
		if (sg) {
			const grad = sg.createLinearGradient(0, 0, 0, 128);
			const day = cond.ko === "day";
			const stops = day ? (cond.wet ? [ "#454f58", "#6b7680", "#a2abb2" ] : [ "#2f639a", "#6e9cc6", "#c3d6e4" ]) : [ "#010206", "#060b11", "#121d26" ];
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
		G3.scene.fog = new THREE.Fog(dayLit ? (cond.wet ? 0x8d979e : 0xa9bfd0) : 0x070d13, FH * 2.6, FH * 7);
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
		G3.nets = { net, rest: Float32Array.from(rest), nrm: Float32Array.from(nrm), wgt: Float32Array.from(wgt), goalOf, amp: [ 0, 0 ], ph: [ 0, 0 ], hit: [ null, null ], inside: [ false, false ], moving: false };
	}
	// Every frame: is the ball in a net? Push it back where the ball is and let it swing.
	function animateNets3D (bx, by, bh, dt) {
		const NT = G3.nets;
		if (!NT) { return; }
		const cb = 55 * Z3;
		let any = false;
		for (let g = 0; g < 2; g++) {
			const inside = (g === 0 ? bx < -1 : bx > FW + 1) && by > GOAL_T - 2 && by < GOAL_B + 2 && bh < cb + 4;
			if (inside && !NT.inside[g]) { NT.amp[g] = Math.min(9, 3 + Math.hypot(ball.vx || 0, ball.vy || 0) * 0.9); NT.ph[g] = 0; NT.hit[g] = [ bx, bh, by ]; }
			NT.inside[g] = inside;
			if (inside) { NT.hit[g] = [ bx, bh, by ]; }
			NT.ph[g] += dt * 0.32;
			NT.amp[g] *= Math.pow(0.955, dt);
			if (NT.amp[g] > 0.05 || inside) { any = true; }
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
			}
			arr[k] = R[k] + n[k] * d; arr[k + 1] = R[k + 1] + n[k + 1] * d; arr[k + 2] = R[k + 2] + n[k + 2] * d;
		}
		NT.net.geometry.attributes.position.needsUpdate = true;
	}
