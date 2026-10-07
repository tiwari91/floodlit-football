	/* ---------- audio ----------
	   Everything is synthesised in WebAudio: the ball off a boot, the referee's whistle, and a
	   crowd built from layered noise and detuned voices that breathes with the match. */
	let master = null;
	function ensureAudio () {
		if (audio || !window.AudioContext) { return; }
		try {
			audio = new AudioContext();
			master = audio.createDynamicsCompressor();
			master.threshold.value = -16; master.knee.value = 20; master.ratio.value = 4; master.attack.value = 0.008; master.release.value = 0.3;
			master.connect(audio.destination);
		} catch (e) { audio = null; master = null; }
	}
	const out = () => master || audio.destination;
	// Sounds on the pitch fade with distance from the camera (the 3D view knows where it is).
	const gainAt = (x, y) => { const d = x === undefined ? 0 : listenerDist3D(x, y); return d ? clamp(1.3 / (1 + d / 900), 0.3, 1) : 1; };

	// A short buzz on a phone for the moments you feel: a tackle, a foul, a goal.
	const buzz = pattern => { if (coarse && navigator.vibrate && !bulkSim) { try { navigator.vibrate(pattern); } catch (e) { /* not allowed here */ } } };
	function peep (s, len, gain = 0.07) {
		const o = audio.createOscillator(), g = audio.createGain(), lfo = audio.createOscillator(), lg = audio.createGain();
		o.frequency.value = 2850; lfo.frequency.value = 42; lg.gain.value = 140;
		lfo.connect(lg).connect(o.frequency);
		g.gain.setValueAtTime(0, s);
		g.gain.linearRampToValueAtTime(gain, s + 0.015);
		g.gain.setValueAtTime(gain, s + len - 0.05);
		g.gain.linearRampToValueAtTime(0, s + len);
		o.connect(g).connect(out());
		o.start(s); lfo.start(s); o.stop(s + len); lfo.stop(s + len);
	}
	function thump (t, f0, f1, dur, gain, type = "triangle") {
		const o = audio.createOscillator(), g = audio.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		o.connect(g).connect(out());
		o.start(t); o.stop(t + dur + 0.02);
	}
	function sfx (kind, opt) {
		if (kind === "tackle" || kind === "foul") { buzz(25); }
		if (kind === "whistle" || kind === "final" || kind === "half" || kind === "foul") { ev3d(kind); }
		if (!soundOn || !audio || bulkSim) { return; }
		const t = audio.currentTime, o = opt || {}, pow = o.pow === undefined ? 0.5 : o.pow, dist = gainAt(o.x, o.y);
		if (kind === "whistle") { peep(t, 0.6); }
		else if (kind === "foul") { peep(t, 0.16); peep(t + 0.22, 0.16); }
		else if (kind === "half") { peep(t, 0.5); peep(t + 0.6, 0.5); }
		else if (kind === "final") { peep(t, 0.3); peep(t + 0.4, 0.3); peep(t + 0.8, 0.9); }
		else if (kind === "kick") {
			thump(t, 150 + 60 * pow, 48, 0.1 + 0.05 * pow, (0.1 + 0.2 * pow) * dist);
			noiseBurst("white", t, 0.035 + 0.02 * pow, (0.07 + 0.12 * pow) * dist, "bandpass", 2200 - 600 * pow, 1200, 0.9);
		} else if (kind === "header") {
			thump(t, 110, 60, 0.09, 0.09 * dist, "sine");
			noiseBurst("brown", t, 0.07, 0.14 * dist, "lowpass", 600, 300);
		} else if (kind === "tackle") {
			thump(t, 220, 80, 0.11, 0.05, "square");
			noiseBurst("brown", t, 0.12, 0.12, "lowpass", 700, 250);
		} else if (kind === "net") {
			noiseBurst("white", t + 0.05, 0.28, 0.05, "highpass", 2500, 4000, 0.5);
		} else if (kind === "tick") {
			const osc = audio.createOscillator(), g = audio.createGain();
			osc.frequency.value = 880;
			g.gain.setValueAtTime(0.04, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
			osc.connect(g).connect(out());
			osc.start(t); osc.stop(t + 0.09);
		}
	}

