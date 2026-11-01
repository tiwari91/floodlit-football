	/* ---------- Welcome: floodlights on ---------- */
	// A five-second intro over the page on the first visit of the day: a toy footballer in an amber kit
	// flicks the FLOODLIGHTS switch off, the room goes dark, he flicks it back on and the title card says
	// "press any key". Any key, click or tap skips it, and that first press also unlocks sound.
	// Never shown to automated browsers (the test suites), with ?nointro, or when the system asks for reduced
	// motion; ?intro shows it again. The full 14-second film lives in its own repo (floodlit-film).
	{
		const qs = new URLSearchParams(location.search);
		const today = new Date().toISOString().slice(0, 10);
		const seenKey = "ff.introSeen";
		let seen = null;
		try { seen = localStorage.getItem(seenKey); } catch (e) { /* storage unavailable */ }
		const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
		const wanted = !qs.has("nointro") && (qs.has("intro") || (!navigator.webdriver && !reduced && seen !== today));
		if (wanted) runIntro();

		function runIntro () {
			try { localStorage.setItem(seenKey, today); } catch (e) { /* storage unavailable */ }
			const root = document.createElement("div");
			root.id = "intro";
			root.setAttribute("role", "dialog");
			root.setAttribute("aria-label", "Floodlit Football");
			root.innerHTML = '<canvas aria-hidden="true"></canvas>'
				+ '<div class="intro-card"><h1>Floodlit Football</h1><p>Press any key to kick off</p></div>'
				+ '<button type="button" class="intro-skip">Skip</button>';
			document.body.appendChild(root);
			const cv = root.querySelector("canvas");
			let stop = null, closing = false;

			const close = (e) => {
				if (closing) return;
				if (e && (e.metaKey || e.ctrlKey || e.altKey)) return;           // browser shortcuts (reload, address bar) stay the browser's
				if (e) { e.preventDefault(); e.stopImmediatePropagation(); }   // the press that closes the intro is not a game input
				closing = true;
				sting();
				root.classList.add("out");
				setTimeout(() => { if (stop) stop(); root.remove(); removeEventListener("keydown", close, true); }, 380);
			};
			addEventListener("keydown", close, true);
			root.addEventListener("pointerdown", close);

			// wait (up to 4 s) for three.js, which the page loads for its 3D view; without it, just the title card
			const t0 = performance.now();
			const wait = () => {
				if (closing) return;
				if (window.THREE) { try { stop = scene(window.THREE, cv, root); } catch (err) { root.classList.add("card-on"); } return; }
				if (performance.now() - t0 > 4000) { root.classList.add("card-on"); return; }
				setTimeout(wait, 50);
			};
			wait();
		}

		// a click, the floodlights' hum and a rising major chord, made on the spot (the press unlocked audio)
		function sting () {
			let ac;
			try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
			const now = ac.currentTime + 0.02, out = ac.createGain();
			out.gain.value = 0.5; out.connect(ac.destination);
			const tone = (t, f, type, peak, dec, f2) => {
				const o = ac.createOscillator(), g = ac.createGain();
				o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dec);
				g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
				o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
			};
			tone(now, 2600, "square", 0.05, 0.03);
			tone(now + 0.02, 110, "sine", 0.25, 0.5, 220);
			[523.25, 659.25, 783.99].forEach((f, i) => tone(now + 0.08 + i * 0.07, f, "sine", 0.12, 0.9));
			setTimeout(() => ac.close && ac.close(), 1600);
		}

		// the scene: returns a function that stops the loop and frees the GPU
		function scene (T, cv, root) {
			const DUR = 5.0, FRAME = 1 / 60;
			const clamp01 = (x) => Math.min(1, Math.max(0, x));
			const lerp = (a, b, k) => a + (b - a) * k;
			const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
			const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
			const bump = (t, a, m, b) => (t < m ? smooth((t - a) / (m - a)) : 1 - smooth((t - m) / (b - m)));
			const track = (keys) => (t) => {
				if (t <= keys[0][0]) return keys[0][1];
				for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t < t1) return lerp(v0, v1, smoother((t - t0) / (t1 - t0))); }
				return keys[keys.length - 1][1];
			};

			const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
			renderer.setPixelRatio(Math.min(2, devicePixelRatio));
			renderer.outputColorSpace = T.SRGBColorSpace;
			renderer.toneMapping = T.ACESFilmicToneMapping;
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = T.PCFSoftShadowMap;
			const camera = new T.PerspectiveCamera(27, 16 / 9, 0.5, 600);   // a 50 mm lens
			const fit = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
			fit(); addEventListener("resize", fit);
			const scene = new T.Scene();
			const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o || {}));
			const amber = new T.Color("#f2b52e");

			// the flicks: off at 0.6 s, back on at 2.15 s, each over a quarter of a second
			const FLICKS = [{ t: 0.6, to: 1 }, { t: 2.15, to: 0 }];
			const worldAt = (t) => { let w = 0; for (const f of FLICKS) if (t >= f.t) w = lerp(w, f.to, smooth((t - f.t) / 0.25)); return w; };
			const knobAt = (t) => { let k = 0; for (const f of FLICKS) if (t >= f.t) k = lerp(k, f.to, smooth((t - f.t) / (3 * FRAME))); return k; };

			// room: desk, walls, two floodlight towers as desk lamps (they are the room's lights)
			const desk = new T.Mesh(new T.BoxGeometry(170, 3, 90), std("#ece9e2", { roughness: 0.75 }));
			desk.position.set(0, -1.5, -5); desk.receiveShadow = true; scene.add(desk);
			const wallMat = std("#f4f2ec", { roughness: 0.95 });
			const back = new T.Mesh(new T.PlaneGeometry(400, 260), wallMat); back.position.set(0, 60, -50); back.receiveShadow = true; scene.add(back);
			const towers = [-27, 27].map((x) => {
				const g = new T.Group(); g.position.set(x, 0, -14); scene.add(g);
				const grey = std("#9aa3a0", { metalness: 0.6, roughness: 0.35 });
				const base = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, 0.8, 32), grey); base.position.y = 0.4; g.add(base);
				const mast = new T.Mesh(new T.CylinderGeometry(0.35, 0.5, 30, 16), grey); mast.position.y = 15; g.add(mast);
				const head = new T.Group(); head.position.y = 31.3; head.rotation.x = 0.35; g.add(head);
				head.add(new T.Mesh(new T.BoxGeometry(6.2, 4.2, 0.8), std("#5d6765", { metalness: 0.5, roughness: 0.4 })));
				const lamps = new T.MeshStandardMaterial({ color: "#fff6d6", emissive: "#fff2c8", emissiveIntensity: 2 });
				for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const l = new T.Mesh(new T.CircleGeometry(0.75, 24), lamps); l.position.set(-2 + i * 2, -0.95 + j * 1.9, 0.41); head.add(l); }
				const spot = new T.SpotLight("#fff1d2", 0, 160, 0.95, 0.6, 1.2); spot.position.set(0, 31.3, 1); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004;
				g.add(spot); scene.add(spot.target); spot.target.position.set(x * 0.15, 0, 10);
				return { lamps, spot };
			});

			// the monitor, its Floodlit settings page (light and dark versions) and the FLOODLIGHTS switch
			const SW = 40, SH = 23, SB = 1.75, MX = 12, PX = 64;
			const PILL = { y: 2.35, w: 2.4, h: 0.92 }, TRAVEL = 0.74;
			const page = (dark) => {
				const c = document.createElement("canvas"); c.width = SW * PX; c.height = SH * PX;
				const g = c.getContext("2d"), cm = (v) => v * PX, X = (x) => cm(x - MX + SW / 2), Y = (y) => cm(SH - (y - SB));
				const ink = dark ? "#e9f0ea" : "#13211a", panel = dark ? "#13211a" : "#ffffff";
				g.fillStyle = dark ? "#0d1612" : "#eef3ec"; g.fillRect(0, 0, c.width, c.height);
				g.fillStyle = panel; g.fillRect(0, 0, c.width, cm(1.6));
				g.fillStyle = "#f2b52e"; g.font = `800 ${cm(0.85)}px "Big Shoulders Display", "Arial Narrow", Arial`; g.textBaseline = "middle";
				g.fillText("FLOODLIT FOOTBALL", cm(1.2), cm(0.82));
				const px0 = X(-5), py0 = Y(17.4), pw = cm(18), ph = cm(10.4);
				g.fillStyle = dark ? "#0f2a1b" : "#41a058"; g.fillRect(px0, py0, pw, ph);
				g.strokeStyle = dark ? "rgba(233,240,234,.22)" : "rgba(255,255,255,.9)"; g.lineWidth = cm(0.09);
				g.strokeRect(px0 + cm(0.5), py0 + cm(0.5), pw - cm(1), ph - cm(1));
				g.beginPath(); g.moveTo(px0 + pw / 2, py0 + cm(0.5)); g.lineTo(px0 + pw / 2, py0 + ph - cm(0.5)); g.stroke();
				g.beginPath(); g.arc(px0 + pw / 2, py0 + ph / 2, cm(1.5), 0, 7); g.stroke();
				g.beginPath(); g.roundRect(X(-4.4), Y(PILL.y + 1.55), cm(8.8), cm(2.55), cm(0.35)); g.fillStyle = panel; g.fill();
				g.fillStyle = ink; g.font = `800 ${cm(0.62)}px "Big Shoulders Display", "Arial Narrow", Arial`; g.textAlign = "center";
				g.fillText("FLOODLIGHTS", X(0), Y(PILL.y + 1.0));
				g.beginPath(); g.roundRect(X(-PILL.w / 2), Y(PILL.y + PILL.h / 2), cm(PILL.w), cm(PILL.h), cm(PILL.h / 2));
				g.fillStyle = dark ? "#0a120f" : "#e2e9df"; g.fill();
				g.font = `700 ${cm(0.3)}px Barlow, Arial`; g.fillStyle = dark ? "#93a79a" : "#3c5246";
				g.fillText(dark ? "OFF" : "ON", X(dark ? -TRAVEL / 2 : TRAVEL / 2), Y(PILL.y) + cm(0.02));
				const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
			};
			const screenMat = new T.ShaderMaterial({
				uniforms: { a: { value: page(false) }, b: { value: page(true) }, k: { value: 0 }, gain: { value: 1 } },
				vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
				fragmentShader: "uniform sampler2D a; uniform sampler2D b; uniform float k; uniform float gain; varying vec2 vUv;\n"
					+ "void main(){ gl_FragColor = vec4(mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, k) * gain, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"
			});
			const mon = new T.Group(); mon.position.x = MX; scene.add(mon);
			const metal = std("#7a8084", { roughness: 0.55, metalness: 0.3 });
			const plate = new T.Mesh(new T.BoxGeometry(30, 0.8, 15), metal); plate.position.set(-5, 0.4, 3); plate.castShadow = plate.receiveShadow = true; mon.add(plate);
			const neck = new T.Mesh(new T.BoxGeometry(5, 14, 1.6), metal); neck.position.set(0, 7.5, -4); mon.add(neck);
			const body = new T.Mesh(new T.BoxGeometry(SW + 1.2, SH + 1.2, 2.2), std("#1c1f22", { roughness: 0.4, metalness: 0.3 })); body.position.set(0, SB + SH / 2, -1.12); body.castShadow = true; mon.add(body);
			const screen = new T.Mesh(new T.PlaneGeometry(SW, SH), screenMat); screen.position.set(0, SB + SH / 2, -0.005); mon.add(screen);
			const knobMat = new T.MeshBasicMaterial({ color: amber.clone() });
			const knob = new T.Mesh(new T.CircleGeometry(0.36, 48), knobMat); knob.position.set(-MX, PILL.y, 0.004); mon.add(knob);
			const knobX = (k) => -TRAVEL / 2 + TRAVEL * k;
			const glow = new T.PointLight("#dfe9e4", 0, 90, 1.4); glow.position.set(4, 9, 8); scene.add(glow);
			const ball = new T.Mesh(new T.SphereGeometry(0.55, 32, 24), std("#f4f4f0", { roughness: 0.5 })); ball.position.set(5.6, 1.35, -1.2); ball.castShadow = true; scene.add(ball);

			const hemi = new T.HemisphereLight("#ffffff", "#d8d2c4", 0); scene.add(hemi);
			const sun = new T.DirectionalLight("#fff4e2", 0); sun.position.set(-60, 90, 60); sun.castShadow = true;
			sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 10, far: 250 }); scene.add(sun);
			const moon = new T.DirectionalLight("#5f8f97", 0); moon.position.set(-50, 60, -40); scene.add(moon);
			const warm = new T.PointLight("#ff9a55", 0, 9, 2); scene.add(warm);   // keeps the amber kit amber in the dark

			// the player, 2 cm tall
			const hero = new T.Group(); scene.add(hero);
			const mats = { skin: std("#e2b48c", { roughness: 0.55 }), kit: std(amber, { roughness: 0.5 }), shorts: std("#13211a"), sock: std("#f4f2ea", { roughness: 0.7 }), boot: std("#141414", { roughness: 0.35 }), hair: std("#2b1c14", { roughness: 0.8 }) };
			for (const m of Object.values(mats)) m.userData.base = m.color.clone();
			const dark = std("#1a1a1a", { roughness: 0.4 });
			const S = (r, m, sx = 1, sy = 1, sz = 1) => { const o = new T.Mesh(new T.SphereGeometry(r, 32, 24), m); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
			const cap = (r, l, m) => { const o = new T.Mesh(new T.CapsuleGeometry(r, l, 8, 16), m); o.castShadow = true; return o; };
			for (const sx of [-1, 1]) { const l = cap(0.12, 0.22, mats.sock); l.position.set(sx * 0.17, 0.25, 0); hero.add(l); const b = S(0.15, mats.boot, 1, 0.62, 1.45); b.position.set(sx * 0.17, 0.09, 0.06); hero.add(b); }
			const torso = new T.Group(); torso.position.y = 0.42; hero.add(torso);
			const sh = S(0.4, mats.shorts, 1, 0.55, 0.85); sh.position.y = 0.06; torso.add(sh);
			const shirt = S(0.42, mats.kit, 1, 1.05, 0.86); shirt.position.y = 0.42; torso.add(shirt);
			const head = new T.Group(); head.position.y = 1.1; torso.add(head);
			const skull = S(0.44, mats.skin); skull.position.y = 0.3; head.add(skull);
			const hair = S(0.455, mats.hair, 1, 0.62, 1); hair.position.set(0, 0.47, -0.04); head.add(hair);
			const nose = S(0.06, mats.skin); nose.position.set(0, 0.25, 0.43); head.add(nose);
			const eyeM = new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15, emissive: "#ffffff", emissiveIntensity: 0 });
			const eyes = [-1, 1].map((sx) => {
				const e = new T.Group(); e.position.set(sx * 0.155, 0.36, 0.37); e.rotation.y = sx * 0.18; head.add(e);
				e.add(S(0.13, eyeM, 1, 1.15, 0.6));
				const look = new T.Group(); e.add(look);
				const p = S(0.075, dark, 1, 1.12, 0.5); p.position.z = 0.065; look.add(p);
				const gl = new T.Mesh(new T.CircleGeometry(0.026, 16), new T.MeshBasicMaterial({ color: "#ffffff" })); gl.position.set(0.025, 0.035, 0.105); look.add(gl);
				const lid = S(0.138, mats.skin, 1, 1.16, 0.64); lid.position.y = 0.155; e.add(lid);
				const brow = new T.Mesh(new T.CapsuleGeometry(0.025, 0.13, 6, 12), mats.hair); brow.rotation.z = Math.PI / 2; brow.position.set(0, 0.21, 0.04); e.add(brow);
				return { e, look, lid, brow, sx };
			});
			const mouth = new T.Mesh(new T.TorusGeometry(0.09, 0.022, 10, 32, Math.PI), dark); mouth.position.set(0, 0.13, 0.4); mouth.rotation.z = Math.PI; head.add(mouth);
			const mouthO = S(0.055, dark, 1, 1.2, 0.4); mouthO.position.set(0, 0.12, 0.415); head.add(mouthO);
			const arm = (sx) => { const s = new T.Group(); s.position.set(sx * 0.42, 0.64, 0); torso.add(s); const u = cap(0.085, 0.3, mats.kit); s.add(u); const n = S(0.115, mats.skin); s.add(n); return { s, u, n, sx }; };
			const armR = arm(-1), armL = arm(1);
			const NUB = 0.115, YAW = -0.5, PLATE = 0.8;
			const v3 = (x, y, z) => new T.Vector3(x, y, z);
			const touch = (k) => v3(knobX(k), PILL.y, NUB + 0.003);
			// stand where his right nub just reaches both ends of the switch
			let HX = 1.6, HZ = 0.9;
			{
				let best = 1e9;
				for (let x = 0.6; x <= 2.6; x += 0.02) for (let z = 0.66; z <= 1.4; z += 0.02) {
					hero.position.set(x, PLATE, z); hero.rotation.y = YAW; hero.updateMatrixWorld(true);
					const s = armR.s.getWorldPosition(new T.Vector3());
					const err = Math.max(Math.abs(s.distanceTo(touch(0)) - 0.56), Math.abs(s.distanceTo(touch(1)) - 0.56));
					if (err < best) { best = err; HX = x; HZ = z; }
				}
			}
			const aim = (a, target) => {
				a.s.updateWorldMatrix(true, false);
				const local = a.s.worldToLocal(target.clone()), len = local.length(), dir = local.clone().normalize();
				a.n.position.copy(dir).multiplyScalar(len); a.u.position.copy(dir).multiplyScalar(len / 2);
				a.u.scale.set(1, (len - 0.1) / 0.3, 1); a.u.quaternion.setFromUnitVectors(v3(0, 1, 0), dir);
			};

			// the performance
			const reach = track([[0, 1], [0.8, 1], [1.05, 0], [1.85, 0], [2.08, 1], [2.45, 1], [2.8, 0], [DUR, 0]]);
			const contact = (t) => { let c = 1; for (const f of FLICKS) if (t > f.t - 0.24 && t < f.t + 0.14) c = Math.min(c, 1 - 0.75 * bump(t, f.t - 0.24, f.t - 0.08, f.t - FRAME)); return c; };
			const lookYaw = track([[0, 0.2], [0.72, 0.2], [0.95, -0.7], [1.35, 0.75], [1.75, 0.2], [2.5, 0.2], [2.9, -0.5], [DUR, -0.5]]);
			const lookPitch = track([[0, -0.08], [0.9, 0.12], [1.7, 0.05], [2.5, -0.05], [2.9, 0.06], [DUR, 0.06]]);
			const surprise = track([[0.6, 0], [0.7, 1], [1.5, 1], [1.8, 0]]);
			const happy = track([[0, 0.3], [2.15, 0.3], [2.35, 1], [DUR, 1]]);
			const blink = (t) => Math.max(bump(t, 1.62, 1.69, 1.78), bump(t, 3.62, 3.69, 3.78));
			const camR = track([[0, 22], [2.3, 22], [3.4, 15], [DUR, 15]]);
			const camAz = track([[0, -0.62], [2.3, -0.62], [3.4, -0.4], [DUR, -0.4]]);
			const camEl = track([[0, 0.18], [3.4, 0.12], [DUR, 0.12]]);

			const draw = (t) => {
				const w = worldAt(t), lit = 1 - w;
				for (const { lamps, spot } of towers) { lamps.emissiveIntensity = lerp(0.04, 2.4, lit); spot.intensity = 2400 * lit; }
				sun.intensity = 1.3 * lit; moon.intensity = 2.2 * w;
				hemi.intensity = lerp(1.1, 1.25, lit);
				hemi.color.setRGB(lerp(0.22, 1, lit), lerp(0.36, 1, lit), lerp(0.4, 1, lit));
				hemi.groundColor.setRGB(lerp(0.05, 0.85, lit), lerp(0.09, 0.82, lit), lerp(0.08, 0.77, lit));
				wallMat.color.set("#f4f2ec").lerp(new T.Color("#2c4a44"), w);
				desk.material.color.set("#ece9e2").lerp(new T.Color("#33433d"), w);
				screenMat.uniforms.k.value = w; screenMat.uniforms.gain.value = lerp(1.05, 0.9, w);
				glow.intensity = lerp(45, 160, w); glow.color.setRGB(lerp(0.95, 0.55, w), lerp(0.97, 0.78, w), lerp(0.95, 0.72, w));
				renderer.toneMappingExposure = lerp(0.82, 2.35, w);
				const k = knobAt(t); knob.position.x = knobX(k) - MX;
				knobMat.color.copy(amber).multiplyScalar(lerp(1, 0.82, w));

				hero.position.set(HX, PLATE, HZ); hero.rotation.y = YAW;
				const br = 0.012 * Math.sin(t * Math.PI * 2 / 1.75); torso.scale.set(1 + br, 1 + br * 0.5, 1 + br);
				const lead = 7 * FRAME;
				head.rotation.set(-lookPitch(t - lead), lookYaw(t - lead) * 0.85, 0.05 * surprise(t));
				const ey = lookYaw(t) - lookYaw(t - lead) * 0.85, su = surprise(t), hp = happy(t), bl = blink(t);
				for (const e of eyes) {
					e.look.position.set(clamp01(Math.abs(ey) * 1.4) * Math.sign(ey) * 0.045, 0, 0);
					e.e.scale.set(1 + 0.12 * su, 1 + 0.12 * su, 1);
					e.lid.position.y = lerp(0.155, -0.005, bl); e.lid.visible = bl > 0.02;
					e.brow.position.y = 0.21 + 0.06 * su;
				}
				mouthO.visible = su > 0.35; mouth.visible = !mouthO.visible;
				mouth.scale.set(lerp(0.8, 1.2, hp), lerp(0.5, 1, hp), 1);
				hero.updateMatrixWorld(true);
				const c = contact(t);
				const target = touch(k).add(v3(0.08 * (1 - c), -0.05 * (1 - c), 0.35 * (1 - c)));
				const rest = armR.s.localToWorld(v3(-0.12, -0.46, 0.06));
				aim(armR, rest.lerp(target, smooth(reach(t))));
				aim(armL, armL.s.localToWorld(v3(0.12, -0.46, 0.06 + 0.03 * Math.sin(t * 3))));
				for (const m of Object.values(mats)) m.emissive.copy(m.userData.base).multiplyScalar(0.05 * w);
				warm.intensity = 1.3 * w; warm.position.copy(hero.position).add(v3(0.6, 1.6, 2.2));
				eyeM.emissiveIntensity = 0.6 * w;

				const R = camR(t), az = camAz(t), el = camEl(t), tg = v3(HX - 0.55, lerp(3.2, 1.0, smooth((t - 2.3) / 1.1)), HZ * 0.6);
				camera.position.set(tg.x + R * Math.sin(az) * Math.cos(el), tg.y + R * Math.sin(el), tg.z + R * Math.cos(az) * Math.cos(el));
				camera.lookAt(tg);
				renderer.render(scene, camera);
			};

			// play once, then idle (breathing and blinking) under the title card
			const start = performance.now();
			let raf = 0;
			const frame = () => {
				let t = (performance.now() - start) / 1000;
				if (t > 2.9) root.classList.add("card-on");
				if (t > DUR) t = 3.4 + ((t - 3.4) % (DUR - 3.4));
				draw(t);
				raf = requestAnimationFrame(frame);
			};
			frame();
			return () => {
				cancelAnimationFrame(raf);
				removeEventListener("resize", fit);
				scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { for (const u of Object.values(o.material.uniforms || {})) if (u.value && u.value.dispose) u.value.dispose(); o.material.dispose(); } });
				renderer.dispose();
				renderer.forceContextLoss && renderer.forceContextLoss();
			};
		}
	}
