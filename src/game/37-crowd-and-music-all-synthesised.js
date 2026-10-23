	/* ---------- crowd and music (all synthesised) ---------- */
	let musicOn = true, crowd = null, music = null;
	const bufs = {};
	function noise (kind) {
		if (bufs[kind]) { return bufs[kind]; }
		const len = audio.sampleRate * 3, b = audio.createBuffer(1, len, audio.sampleRate), d = b.getChannelData(0);
		let last = 0, b0 = 0, b1 = 0, b2 = 0;
		for (let i = 0; i < len; i++) {
			const w = Math.random() * 2 - 1;
			if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
			else if (kind === "pink") { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; }
			else { d[i] = w; }
		}
		return (bufs[kind] = b);
	}
	function noiseBurst (kind, t, dur, gain, filterType, f0, f1, q = 0.7, pan = 0) {
		const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
		src.buffer = noise(kind);
		f.type = filterType; f.Q.value = q;
		f.frequency.setValueAtTime(f0, t);
		f.frequency.linearRampToValueAtTime(f1, t + dur);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(gain, t + Math.min(0.3, dur * 0.25));
		g.gain.setValueAtTime(gain, t + dur * 0.55);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g);
		connectPan(g, pan);
		src.start(t, Math.random() * 1.8);
		src.stop(t + dur + 0.05);
	}
	function connectPan (node, pan) {
		if (pan && audio.createStereoPanner) { const p = audio.createStereoPanner(); p.pan.value = pan; node.connect(p).connect(out()); } else { node.connect(out()); }
	}
	// A few hundred voices: detuned saws through a vowel-ish filter, gliding from f0 to f1.
	function voices (t, n, f0, f1, dur, gain, lp = 900, pan = 0) {
		const g = audio.createGain(), f = audio.createBiquadFilter();
		f.type = "lowpass"; f.frequency.value = lp; f.Q.value = 0.8;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(gain, t + Math.min(0.25, dur * 0.3));
		g.gain.setValueAtTime(gain, t + dur * 0.6);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		g.connect(f);
		connectPan(f, pan);
		for (let v = 0; v < n; v++) {
			const o = audio.createOscillator();
			o.type = "sawtooth";
			o.detune.value = (Math.random() * 2 - 1) * 45;
			const k = 0.5 + (v % 3) * 0.5;   // octaves: men, women, the kids
			o.frequency.setValueAtTime(f0 * k, t);
			o.frequency.linearRampToValueAtTime(f1 * k, t + dur);
			o.connect(g);
			o.start(t); o.stop(t + dur + 0.05);
		}
	}
	const roar = big => {
		ev3d("roar", big);
		if (!soundOn || !audio) { return; }
		const t = audio.currentTime;
		noiseBurst("white", t, 3.8 + big, 0.16 * big, "bandpass", 650, 1150, 0.4);
		noiseBurst("pink", t, 3.4 + big, 0.14 * big, "bandpass", 1200, 800, 0.5, 0.2);
		noiseBurst("brown", t, 3.2, 0.14 * big, "lowpass", 900, 500);
		voices(t, 6, 230, 290, 1.4, 0.022 * big, 1100, -0.15);
		voices(t + 0.25, 5, 300, 260, 1.8, 0.016 * big, 900, 0.2);
		if (big >= 0.9) {
			// An air horn in the home end, and a second surge as the stand catches up.
			const h = audio.createOscillator(), h2 = audio.createOscillator(), hg = audio.createGain(), hf = audio.createBiquadFilter();
			h.type = "square"; h2.type = "square"; h.frequency.value = 311; h2.frequency.value = 466; hf.type = "lowpass"; hf.frequency.value = 1400;
			hg.gain.setValueAtTime(0.0001, t + 0.9); hg.gain.linearRampToValueAtTime(0.02, t + 1.0); hg.gain.setValueAtTime(0.02, t + 1.7); hg.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
			h.connect(hf); h2.connect(hf); hf.connect(hg); connectPan(hg, 0.35);
			h.start(t + 0.9); h2.start(t + 0.9); h.stop(t + 2.05); h2.stop(t + 2.05);
			noiseBurst("white", t + 1.6, 3, 0.1, "bandpass", 800, 1000, 0.5);
		}
	};
	// The crowd reacts to what just happened, and it is not neutral. kind: chance, save, tackle,
	// clear. Filled out with the crowd's sounds further down.
	function crowdReact (kind, t) { if (typeof crowdReactImpl === "function") { crowdReactImpl(kind, t); } }
	const groan = () => {
		ev3d("groan");
		if (!soundOn || !audio) { return; }
		const t = audio.currentTime;
		const k = 0.88 + Math.random() * 0.24, len = 1.4 + Math.random() * 0.8;   // never quite the same groan twice
		noiseBurst("brown", t, len + 0.2, 0.11, "lowpass", 800 * k, 240);
		voices(t, 5, 260 * k, 185 * k * (0.95 + Math.random() * 0.1), len, 0.014, 700);
		if (Math.random() < 0.5) { voices(t + 0.15, 4, 200 * k, 150 * k, len * 0.9, 0.009, 600, 0.2); }   // the deeper "awww" from the back of the stand
	};
	const ooh = () => {
		ev3d("ooh");
		if (!soundOn || !audio) { return; }
		const t = audio.currentTime;
		noiseBurst("brown", t, 1.0, 0.09, "bandpass", 380, 750, 1.4);
		noiseBurst("pink", t + 0.05, 0.9, 0.05, "bandpass", 600, 1100, 1.2);
		voices(t, 5, 240, 320, 0.7, 0.012, 800);
		voices(t + 0.45, 4, 310, 230, 0.6, 0.009, 700);
	};

	// Terrace chants: claps, then a few hundred voices on a simple tune (one of three), from the
	// home end, or from the away corner when the visitors are on top.
	// Every club has its own song, worked out from its name: a key (major or minor), a tempo, a
	// rhythm, a clap and a drum, a tune, and whether a few voices lead a call that the whole end answers.
	const SONG_RHYTHMS = [ [ 1, 1, 1, 1, 1, 1, 2 ], [ 1, 1, 2, 1, 1, 2 ], [ 0.5, 0.5, 1, 0.5, 0.5, 1, 1, 1, 2 ], [ 1.5, 0.5, 1, 1, 1.5, 0.5, 2 ], [ 1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 2 ], [ 2, 1, 1, 2, 1, 1, 2 ] ];
	const SONG_CLAPS = [ [ 0, 0.28, 0.56 ], [ 0, 0.5, 1, 1.25, 1.5 ], [ 0, 0.25, 0.5, 1 ], [ 0, 0.33, 0.66, 1, 1.17, 1.33 ], [ 0, 1 ] ];
	const songCache = new Map();
	function clubSong (id) {
		if (songCache.has(id)) { return songCache.get(id); }
		const club = typeof teamOf === "function" ? teamOf(id) : (TEAMS[id] || FRIENDLY);
		let h = hashStr(`${club.name}|song`) || 1;
		const r = n => { h = (h + 0x6D2B79F5) >>> 0; let z = Math.imul(h ^ (h >>> 15), 1 | h); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return (((z ^ (z >>> 14)) >>> 0) % n); };
		const minor = r(2) === 1, scale = minor ? [ 0, 2, 3, 5, 7, 8, 10, 12 ] : [ 0, 2, 4, 5, 7, 9, 11, 12 ];
		const rhythm = SONG_RHYTHMS[r(SONG_RHYTHMS.length)], notes = [];
		let deg = r(5), step = 0;
		for (let i = 0; i < rhythm.length; i++) {
			step = [ -2, -1, -1, 1, 1, 2, 0, 3 ][r(8)];
			if (deg + step < 0 || deg + step > 7) { step = -step; }
			deg = Math.max(0, Math.min(7, deg + step));
			if (i === rhythm.length - 1) { deg = [ 0, 4, 7 ][r(3)]; }
			notes.push(scale[deg]);
		}
		const song = { root: 62 + r(9), minor, notes, rhythm, beat: 0.24 + r(7) * 0.03, claps: SONG_CLAPS[r(SONG_CLAPS.length)], drum: 0.42 + r(5) * 0.05, call: r(3) > 0, wave: [ "sawtooth", "square", "sawtooth" ][r(3)] };
		songCache.set(id, song);
		return song;
	}
	// A line of the song, by a few voices (a call) or the whole end (the answer).
	function sing (t0, song, from, to, voices, g, pan) {
		const outG = audio.createGain(), lp = audio.createBiquadFilter();
		let len = 0;
		for (let i = from; i < to; i++) { len += song.rhythm[i] * song.beat; }
		lp.type = "lowpass"; lp.frequency.value = voices > 3 ? 1150 : 1500;
		outG.gain.setValueAtTime(0.0001, t0);
		outG.gain.linearRampToValueAtTime(g, t0 + 0.12);
		outG.gain.setValueAtTime(g, t0 + Math.max(0.15, len - 0.15));
		outG.gain.linearRampToValueAtTime(0.0001, t0 + len + 0.25);
		outG.connect(lp); connectPan(lp, pan);
		for (let v = 0; v < voices; v++) {
			const o = audio.createOscillator();
			o.type = song.wave;
			o.detune.value = (Math.random() * 2 - 1) * (voices > 3 ? 32 : 14);
			let at = t0;
			for (let i = from; i < to; i++) { o.frequency.setTargetAtTime(midiHz(song.root + song.notes[i] - (v >= voices - 2 && voices > 3 ? 12 : 0)), at, 0.03); at += song.rhythm[i] * song.beat; }
			o.connect(outG);
			o.start(t0); o.stop(t0 + len + 0.35);
		}
		return len;
	}
	// The team a set of fans follows: home or away end.
	const clubIdOfTeam = t => (t === 0 ? 0 : leagueMatch ? leagueMatch.opp : 99);
	const isDerby = () => !!leagueMatch && derbyOf(0, leagueMatch.opp);
	// The terrace repertoire. Every chant is a different shape, and none is sung twice running by the
	// same end; each time it is pitched and paced a little differently (a semitone or two either way, a
	// touch quicker or slower). The away end is fewer voices, thinner and off to one side.
	//   song: the club's own song (claps, the bombo, then the tune, often called and answered)
	//   clap: a rhythm clapped out, slow to fast, with a "Hey!" on the accents
	//   call: call and response, a few voices shout a two-note call and the whole end bellows it back
	//   swell: a long sustained "ohhh" that rises with the stand and dies away
	//   ole: one "o-lé" per pass in a long passing move (sung from updateCrowd, not picked here)
	//   party: the celebration song after a home goal, quick and bouncy, on a pentatonic tune
	const CHANT_KINDS = [ "song", "clap", "call", "swell" ];
	const lastChant = [ "", "" ];
	let chantLog = [];
	function chant (loud, away = false, kind = null) {
		ev3d("chant");
		if (!audio) { return null; }
		const end = away ? 1 : 0;
		if (!kind) {
			const pool = CHANT_KINDS.filter(k => k !== lastChant[end]), w = pool.map(k => (k === "song" ? 1.6 : 1));
			let r = Math.random() * w.reduce((a, b) => a + b, 0);
			kind = pool[pool.length - 1];
			for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) { kind = pool[i]; break; } }
		}
		lastChant[end] = kind;
		const shift = Math.floor(Math.random() * 5) - 2, tempo = 0.9 + Math.random() * 0.22;
		chantLog = [ ...chantLog, { kind, away, shift, tempo } ].slice(-12);
		const g = 0.035 * loud * (isDerby() ? 1.3 : 1) * (away ? 0.8 : 1), pan = (away ? 0.5 : -0.3) + (Math.random() - 0.5) * 0.12;
		const fans = { n: away ? 4 : 6, lp: away ? 1350 : 1150 }, t = audio.currentTime + 0.05;
		if (kind === "clap") { clapChant(t, g, pan, tempo, fans); }
		else if (kind === "call") { callChant(t, g, pan, tempo, shift, fans, away); }
		else if (kind === "swell") { swellChant(t, g, pan, shift, fans); }
		else if (kind === "party") { partyChant(t, g, pan, tempo, shift, fans); }
		else { songChant(t, g, pan, tempo, shift, away); }
		return kind;
	}
	function bombo (at, g, pan, f = 95) {
		const o = audio.createOscillator(), dg = audio.createGain();
		o.type = "sine"; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(48, at + 0.25);
		dg.gain.setValueAtTime(g, at); dg.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
		o.connect(dg); connectPan(dg, pan); o.start(at); o.stop(at + 0.32);
	}
	const clap1 = (at, g, pan) => noiseBurst("white", at, 0.07 + Math.random() * 0.03, g, "bandpass", 1600 + Math.random() * 500, 1500, 0.9, pan + (Math.random() - 0.5) * 0.15);
	const hey = (at, g, pan, fans, f = 230) => { voices(at, fans.n, f, f * 0.92, 0.32, g * 0.55, fans.lp + 300, pan); noiseBurst("pink", at, 0.35, g * 1.4, "bandpass", 900, 700, 0.8, pan); };
	// Clapped out: either slow claps that speed up into applause and a roar, or a fixed rhythm
	// (one of several) four times over with a shout on its last beat.
	const CLAP_RHYTHMS = [ [ 0, 1, 2, 2.5, 3 ], [ 0, 0.5, 1, 2, 3 ], [ 0, 1, 1.5, 2.5, 3 ], [ 0, 0.75, 1.5, 2, 2.5, 3 ] ];
	function clapChant (t, g, pan, tempo, fans) {
		if (Math.random() < 0.4) {
			let at = t, gap = 0.95 / tempo;
			for (let k = 0; k < 22 && gap > 0.12; k++) { clap1(at, g * (1.2 + k * 0.05), pan); at += gap; gap *= 0.86; }
			for (let k = 0; k < 16; k++) { clap1(at + Math.random() * 1.2, g * 1.4, pan); }
			hey(at + 0.2, g * 1.3, pan, fans, 250);
			return;
		}
		const beat = 0.42 / tempo, rh = CLAP_RHYTHMS[Math.floor(Math.random() * CLAP_RHYTHMS.length)];
		for (let bar = 0; bar < 4; bar++) {
			const t0 = t + bar * 4 * beat;
			for (const b of rh) { clap1(t0 + b * beat, g * 1.6, pan); }
			bombo(t0, g * 2.4, pan);
			hey(t0 + rh[rh.length - 1] * beat, g * (bar === 3 ? 1.5 : 1), pan, fans, 220 + bar * 6);
		}
	}
	// Call and response: the call a fifth or a fourth above the answer, sung four times, the answer louder each time.
	function callChant (t, g, pan, tempo, shift, fans, away) {
		const root = (away ? 57 : 55) + shift, beat = 0.3 / tempo, iv = Math.random() < 0.5 ? 7 : 5;
		const call = { root, notes: [ iv, iv, 0 ], rhythm: [ 1, 1, 2 ], beat, wave: "sawtooth" };
		const ans = { root: root - 12, notes: [ iv, 0, 0 ], rhythm: [ 1, 1, 2 ], beat, wave: away ? "square" : "sawtooth" };
		let at = t;
		for (let k = 0; k < 4; k++) {
			at += sing(at, call, 0, 3, 2, g * 0.7, pan - 0.15) + 0.12;
			bombo(at, g * 2.6, pan);
			at += sing(at, ans, 0, 3, fans.n, g * (1 + k * 0.1), pan) + 0.3;
		}
	}
	// A long "ohhh" on a chord, swelling for a few seconds as the whole stand comes in, then fading.
	function swellChant (t, g, pan, shift, fans) {
		const root = 50 + shift, chord = Math.random() < 0.5 ? [ 0, 4, 7, 12 ] : [ 0, 3, 7, 12 ], dur = 4 + Math.random() * 2.5;
		const out1 = audio.createGain(), lp = audio.createBiquadFilter();
		lp.type = "lowpass"; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(fans.lp + 200, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(600, t + dur);
		out1.gain.setValueAtTime(0.0001, t); out1.gain.linearRampToValueAtTime(g * 1.2, t + dur * 0.6); out1.gain.linearRampToValueAtTime(0.0001, t + dur);
		out1.connect(lp); connectPan(lp, pan);
		for (const n of chord) {
			for (let v = 0; v < 3; v++) {
				const o = audio.createOscillator();
				o.type = "sawtooth"; o.detune.value = (Math.random() * 2 - 1) * 28;
				o.frequency.setValueAtTime(midiHz(root + n), t);
				o.frequency.linearRampToValueAtTime(midiHz(root + n + (Math.random() < 0.3 ? 2 : 0)), t + dur * 0.7);   // a few voices drift up as it peaks
				o.connect(out1); o.start(t); o.stop(t + dur + 0.05);
			}
		}
		noiseBurst("pink", t, dur, g * 1.4, "bandpass", 500, 900, 0.6, pan);
	}
	// The celebration: a bouncy "na-na-na" tune on a major pentatonic over quick claps and the drum, twice through.
	function partyChant (t, g, pan, tempo, shift, fans) {
		const pent = [ 0, 2, 4, 7, 9, 12 ], notes = [], rhythm = [];
		let d = Math.floor(Math.random() * 3);
		for (let i = 0; i < 8; i++) { d = clamp(d + [ -1, 1, 1, 2, -2, 0 ][Math.floor(Math.random() * 6)], 0, 5); notes.push(pent[d]); rhythm.push(i === 7 ? 2 : i % 4 === 3 ? 1.5 : 0.5); }
		const tune = { root: 60 + shift, notes, rhythm, beat: 0.27 / tempo, wave: "sawtooth" };
		let at = t;
		for (let k = 0; k < 2; k++) {
			const len = sing(at, tune, 0, notes.length, fans.n, g * 1.15, pan);
			for (let c = 0; c < len / tune.beat; c++) { clap1(at + c * tune.beat, g * 1.5, pan); if (c % 2 === 0) { bombo(at + c * tune.beat, g * 2.2, pan); } }
			at += len + 0.2;
		}
		hey(at, g * 1.5, pan, fans, 260);
	}
	// "Olé!": the home end sings one for each pass in a long move of theirs (from the fifth pass on).
	function oleChant (n, away) {
		if (!soundOn || !audio || bulkSim) { return; }
		const t = audio.currentTime + 0.05, pan = away ? 0.5 : -0.3, g = 0.03 * Math.min(1.6, 0.8 + n * 0.1) * (away ? 0.8 : 1), root = 62 + (n % 2);
		sing(t, { root, notes: [ 0, 4, 2 ], rhythm: [ 0.8, 1.4, 0.2 ], beat: 0.24 + Math.random() * 0.04, wave: "sawtooth" }, 0, 2, away ? 4 : 6, g, pan);
		noiseBurst("pink", t + 0.15, 0.6, g * 1.2, "bandpass", 700, 1000, 0.7, pan);
	}
	function songChant (t, g, pan, tempo, shift, away) {
		const id = clubIdOfTeam(away ? 1 - homeSide : homeSide), base = clubSong(id);
		const song = { ...base, root: base.root + shift, beat: base.beat / tempo, drum: base.drum / tempo };
		const bar = song.beat * 4;
		for (let k = 0; k < 3; k++) {
			for (const b of song.claps) { noiseBurst("white", t + k * bar + b * song.beat * 2, 0.09, g * 1.6, "bandpass", 1800, 1600, 0.9, pan); }
		}
		// The bombo: the terrace drum beats the club's rhythm under the clapping and on through the song.
		const n = Math.round((3 * bar + 8 * song.beat * 2) / song.drum);
		for (let k = 0; k < n; k++) {
			const at = t + k * song.drum, o = audio.createOscillator(), dg = audio.createGain();
			o.type = "sine"; o.frequency.setValueAtTime(song.minor ? 88 : 98, at); o.frequency.exponentialRampToValueAtTime(48, at + 0.25);
			dg.gain.setValueAtTime(g * (k % 4 === 3 ? 3.2 : 2.2), at); dg.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
			o.connect(dg); connectPan(dg, pan); o.start(at); o.stop(at + 0.32);
		}
		const t0 = t + 3 * bar + 0.15, half = Math.ceil(song.notes.length / 2);
		if (song.call) {
			// A few voices lead off, the whole end answers, and then they all sing it through.
			const a = sing(t0, song, 0, half, 2, g * 0.75, pan - 0.15);
			const b = sing(t0 + a + 0.1, song, half, song.notes.length, 6, g, pan);
			sing(t0 + a + b + 0.35, song, 0, song.notes.length, 6, g * 1.1, pan);
		} else {
			const a = sing(t0, song, 0, song.notes.length, 6, g, pan);
			sing(t0 + a + 0.3, song, 0, song.notes.length, 6, g * 1.1, pan);
		}
	}

	// Goal songs: when the home side scores, the stadium PA plays the club's own short goal song,
	// worked out from its name like the chants (key, tempo, riff, sound), and the home end sings along.
	const goalSongCache = new Map();
	function goalSong (id) {
		if (goalSongCache.has(id)) { return goalSongCache.get(id); }
		const club = typeof teamOf === "function" ? teamOf(id) : (TEAMS[id] || FRIENDLY);
		let h = hashStr(`${club.name}|goalsong`) || 1;
		const r = n => { h = (h + 0x6D2B79F5) >>> 0; let z = Math.imul(h ^ (h >>> 15), 1 | h); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return (((z ^ (z >>> 14)) >>> 0) % n); };
		const minor = r(4) === 0, scale = minor ? [ 0, 3, 5, 7, 10, 12, 15 ] : [ 0, 2, 4, 7, 9, 12, 14 ];   // pentatonic: it always sounds like a terrace tune
		// A one-bar riff of eighths (0 = rest), played twice, then an answer bar and the riff again to finish.
		const riff = [], answer = [];
		let deg = r(3);
		for (let i = 0; i < 8; i++) { deg = Math.max(0, Math.min(6, deg + [ -1, 0, 1, 1, 2, -2 ][r(6)])); riff.push(i > 0 && r(5) === 0 ? null : scale[deg]); }
		for (let i = 0; i < 8; i++) { deg = Math.max(0, Math.min(6, deg + [ -1, 1, 0, -2 ][r(4)])); answer.push(i === 7 ? scale[[ 0, 2, 5 ][r(3)]] : i % 3 === 2 && r(2) ? null : scale[deg]); }
		const song = { root: 57 + r(8), minor, bars: [ riff, riff, answer, riff ], eighth: 60 / (126 + r(5) * 8) / 2, lead: [ "square", "sawtooth", "triangle" ][r(3)], bass: r(2) === 1 };
		goalSongCache.set(id, song);
		return song;
	}
	function playGoalSong (id) {
		if (!soundOn || !audio || bulkSim) { return; }
		const song = goalSong(id), E = song.eighth, t0 = audio.currentTime + 1.6, g = 0.05;
		// The PA: tinny (band-limited) with a slap of echo off the far stand.
		const bus = audio.createGain(), bp = audio.createBiquadFilter(), dl = audio.createDelay(1), fb = audio.createGain();
		bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 0.5;
		dl.delayTime.value = 0.23; fb.gain.value = 0.32;
		bus.connect(bp); bp.connect(out()); bp.connect(dl); dl.connect(fb).connect(dl); dl.connect(out());
		const len = song.bars.length * 8 * E;
		bus.gain.setValueAtTime(1, t0); bus.gain.setValueAtTime(1, t0 + len - 0.2); bus.gain.linearRampToValueAtTime(0.0001, t0 + len + 0.6);
		const tone = (t, n, dur, gain, type) => {
			const o = audio.createOscillator(), og = audio.createGain();
			o.type = type; o.frequency.value = midiHz(n);
			og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(gain, t + 0.01); og.gain.setValueAtTime(gain * 0.8, t + dur * 0.7); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
			o.connect(og).connect(bus); o.start(t); o.stop(t + dur + 0.02);
		};
		song.bars.forEach((bar, b) => {
			const bt = t0 + b * 8 * E;
			bar.forEach((n, i) => { if (n !== null) { tone(bt + i * E, song.root + n, E * 0.9, g, song.lead); tone(bt + i * E, song.root + n + 12, E * 0.6, g * 0.3, "sine"); } });
			for (let k = 0; k < 4; k++) {   // four on the floor, and a clap on two and four
				const s0 = bt + k * 2 * E, o = audio.createOscillator(), dg = audio.createGain();
				o.type = "sine"; o.frequency.setValueAtTime(120, s0); o.frequency.exponentialRampToValueAtTime(45, s0 + 0.2);
				dg.gain.setValueAtTime(g * 3, s0); dg.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.22); o.connect(dg).connect(bus); o.start(s0); o.stop(s0 + 0.24);
				if (k % 2) { noiseBurst("white", s0, 0.1, g * 1.4, "bandpass", 1700, 1500, 1, 0); }
				if (song.bass) { tone(s0 + E, song.root - 24 + (k === 2 ? 7 : 0), E * 0.8, g * 0.9, "triangle"); }
			}
		});
		// The home end joins in from the second time through the riff: the tune on the voices.
		const notes = [], rhythm = [];
		for (const bar of song.bars.slice(1)) { for (const n of bar) { if (n === null && rhythm.length) { rhythm[rhythm.length - 1] += 1; } else { notes.push(n === null ? bar.find(x => x !== null) || 0 : n); rhythm.push(1); } } }
		sing(t0 + 8 * E, { root: song.root - 12, notes, rhythm, beat: E, wave: "sawtooth" }, 0, notes.length, 6, 0.03, -0.25);
		clapAlong(t0 + 8 * E, 24, 2 * E);
		setTimeout(() => { try { bus.disconnect(); dl.disconnect(); fb.disconnect(); } catch (e) { /* already gone */ } }, (len + 6) * 1000);
		// Then the home end's own celebration song as the PA fades (once play is back on, or still celebrating).
		setTimeout(() => { if (soundOn && audio && !bulkSim && (state === "play" || state === "goal")) { chant(1.1, false, "party"); if (crowd) { crowd.nextChant = Math.max(crowd.nextChant, audio.currentTime + 14); } } }, (len + 1.8) * 1000);
	}
	// A gasp: the whole ground drawing breath at once, at the woodwork or a big save. Loudest from the
	// end whose side had the shot; the other end lets out a lower sigh of relief.
	let gaspAt = -1e9;
	function gasp (t) {
		if (!soundOn || !audio || bulkSim || frame - gaspAt < 90) { return; }
		gaspAt = frame;
		const at = audio.currentTime + 0.01, home = t === homeSide, pan = home ? -0.2 : 0.5;
		noiseBurst("white", at, 0.55, home ? 0.09 : 0.05, "bandpass", 900, 2600, 0.8, pan);
		voices(at + 0.05, 4, 280, 360, 0.45, home ? 0.013 : 0.008, 1200, pan);
		noiseBurst("brown", at + 0.45, 1.2, home ? 0.04 : 0.06, "lowpass", 600, 260, 0.7, home ? 0.4 : -0.2);
	}

	function clapAlong (t, n, every) { for (let k = 0; k < n; k++) { noiseBurst("white", t + k * every, 0.08, 0.04, "bandpass", 1900, 1700, 0.9, -0.3); } }
	// An away goal: only the away corner, a cheer and a burst of clapping from over in their end.
	function awayCornerCheer () {
		if (!soundOn || !audio || bulkSim) { return; }
		const t = audio.currentTime + 0.1;
		noiseBurst("pink", t, 3, 0.07, "bandpass", 700, 1200, 0.6, 0.65);
		voices(t, 5, 260, 340, 2.2, 0.014, 1000, 0.65);
		for (let k = 0; k < 14; k++) { noiseBurst("white", t + 1.2 + k * 0.3, 0.06, 0.03, "bandpass", 1900, 1700, 0.9, 0.65); }
	}

	// A partisan crowd. The home end cheers its side's chances, saves, tackles and clearances, and
	// applauds; the visitors' good moments get a murmur, a groan or, for a foul on one of the home
	// side, whistles and boos. The away corner (and the 3D stands' away fans) celebrate theirs.
	const reactAt = {};
	function crowdReactImpl (kind, t) {
		if (bulkSim || (state !== "play" && state !== "goal") || !(t === 0 || t === 1)) { return; }
		const key = kind + t, now = frame;
		if (now - (reactAt[key] ?? -999) < (kind === "late" ? 420 : kind === "tackle" || kind === "clear" ? 150 : 50)) { return; }
		reactAt[key] = now;
		const home = t === homeSide, m = crowdMood;
		if (kind === "late") { m.home = Math.min(m.home, home ? 0.1 : -0.3); }
		const lvl = { chance: 0.75, save: 0.9, near: 0.8, tackle: 0.45, clear: 0.4, foul: 0.7 }[kind] || 0.5;
		if (kind === "foul") {
			// t committed it: the home end jeers a visitor's foul; its own player's gets a shrug.
			if (!home) { m.home = Math.min(m.home, -0.3); m.ooh = Math.max(m.ooh, 0.6); } else { m.away = Math.min(m.away, -0.3); }
		} else if (home) {
			m.home = Math.max(m.home, lvl * 0.8); m.excite = Math.min(1, m.excite + lvl * 0.3);
			if (kind === "chance" || kind === "near") { m.ooh = Math.max(m.ooh, 0.8); }
		} else {
			m.away = Math.max(m.away, lvl * 0.8); m.home = Math.min(m.home, -0.25 * lvl);
			if (kind === "chance") { m.ooh = Math.max(m.ooh, 0.5); }
		}
		if (!soundOn || !audio) { return; }
		const at = audio.currentTime + 0.02;
		const clapping = (g, dur, pan) => { for (let i = 0; i < 18; i++) { const f = 1400 + Math.random() * 1100; noiseBurst("white", at + Math.random() * dur, 0.045, g * (0.6 + Math.random() * 0.6), "bandpass", f, f, 1.3, pan + (Math.random() - 0.5) * 0.4); } };
		const cheer = (g, pan = -0.2) => { noiseBurst("pink", at, 1.5, 0.09 * g, "bandpass", 650, 1250, 0.6, pan); voices(at, 5, 250, 330, 1.2, 0.016 * g, 1050, pan); };
		const murmur = (g, pan = 0) => { noiseBurst("brown", at, 1.3, 0.05 * g, "lowpass", 520, 300, 0.7, pan); voices(at, 4, 210, 190, 1.1, 0.007 * g, 600, pan); };
		const jeer = g => {
			voices(at, 5, 150, 128, 1.5, 0.014 * g, 520, -0.2);   // a boo
			for (let i = 0; i < 4; i++) {   // and whistles
				const o = audio.createOscillator(), wg = audio.createGain(), s0 = at + Math.random() * 0.4, f = 2300 + Math.random() * 900;
				o.type = "sine"; o.frequency.setValueAtTime(f, s0); o.frequency.linearRampToValueAtTime(f * 1.12, s0 + 0.35); o.frequency.linearRampToValueAtTime(f * 0.96, s0 + 0.8);
				wg.gain.setValueAtTime(0.0001, s0); wg.gain.linearRampToValueAtTime(0.006 * g, s0 + 0.06); wg.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.9);
				o.connect(wg); connectPan(wg, (Math.random() - 0.5) * 0.8); o.start(s0); o.stop(s0 + 0.95);
			}
		};
		const awayPan = 0.5;
		if (kind === "late") { jeer(home ? 0.7 : 1.2); return; }   // whistling for the final whistle, or at the visitors running it down
		if (kind === "miss") { if (home) { murmur(0.8); } else { cheer(0.2, -0.2); } return; }
		if (kind === "foul") { if (!home) { jeer(1); } else { murmur(0.4, awayPan); } return; }
		if (home) {
			if (kind === "chance") { cheer(0.75); }
			else if (kind === "near") { clapping(0.05, 1.6, -0.1); }
			else if (kind === "save") { cheer(0.9); clapping(0.06, 1.8, -0.1); }
			else { clapping(kind === "tackle" ? 0.05 : 0.04, 1.2, -0.1); if (kind === "tackle") { cheer(0.35); } }
		} else {
			// The home end goes quiet and anxious; the away corner gets its moment.
			murmur(kind === "chance" || kind === "save" ? 1 : 0.5);
			if (kind === "save" || kind === "chance") { cheer(0.25, awayPan); }
		}
	}

	// The crowd bed: a rumble, the wash of voices and the air above them, each breathing a little,
	// all of it swelling with the heat of the match.
	function updateCrowd () {
		if (typeof commTick === "function") { commTick(); }
		if (!audio) { return; }
		const live = soundOn && (state === "play" || state === "goal" || state === "half");
		if (!crowd && live) {
			const mk = (kind, type, f, q) => { const src = audio.createBufferSource(), fl = audio.createBiquadFilter(), g = audio.createGain(); src.buffer = noise(kind); src.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl).connect(g); src.start(0, Math.random()); return { src, f: fl, g }; };
			const rumble = mk("brown", "lowpass", 320, 0.6), vox = mk("pink", "bandpass", 750, 0.55), air = mk("white", "highpass", 2400, 0.4);
			let pan = null;
			if (audio.createStereoPanner) { pan = audio.createStereoPanner(); vox.g.connect(pan).connect(out()); } else { vox.g.connect(out()); }
			rumble.g.connect(out()); air.g.connect(out());
			crowd = { rumble, vox, air, pan, nextChant: audio.currentTime + 6 };
		}
		if (!crowd) { return; }
		const t = audio.currentTime, heat = live ? Math.max(crowdHeat, isDerby() ? 0.35 : 0) : 0;
		const breathe = 1 + 0.12 * Math.sin(t * 0.63) + 0.08 * Math.sin(t * 1.71 + 1);
		// An attack building toward the box: the home end rises in pitch and volume as its side carries the
		// ball in; when the visitors do, the noise drops to a low, anxious rumble. Eased, so it swells.
		const own = ball && ball.owner && state === "play" ? ball.owner.team : -1, deep = own >= 0 ? clamp((rel(own, ball.x) - FW * 0.6) / (FW * 0.3), 0, 1) : 0;
		const antTarget = own === homeSide ? deep : own >= 0 ? -0.6 * deep : 0;
		crowd.ant = (crowd.ant || 0) + (antTarget - (crowd.ant || 0)) * 0.04;
		const up = Math.max(0, crowd.ant), worry = Math.max(0, -crowd.ant);
		const quiet = (state === "half" ? 0.5 : 1) * (isDerby() ? 1.35 : 1) * (crowdHush > 0 ? 0.35 : 1);   // a derby is the loudest night of the season
		crowd.rumble.g.gain.setTargetAtTime(live ? (0.045 + 0.08 * heat + 0.03 * worry) * breathe * quiet : 0, t, 0.4);
		crowd.vox.g.gain.setTargetAtTime(live ? (0.022 + 0.085 * heat + 0.03 * up) * (1 - 0.3 * worry) * breathe * quiet : 0, t, 0.35);
		crowd.air.g.gain.setTargetAtTime(live ? (0.004 + 0.01 * heat + 0.006 * up) * quiet : 0, t, 0.5);
		crowd.vox.f.frequency.setTargetAtTime(620 + 650 * heat + 260 * up - 180 * crowdTense - 120 * worry + 70 * Math.sin(t * 0.9), t, 0.4);
		if (crowd.pan) { crowd.pan.pan.setTargetAtTime(0.22 * Math.sin(t * 0.21), t, 0.5); }
		// A passing move: each completed pass in a long spell of possession counts; from the fifth on the
		// side's end sings "olé" with every one (the home end, or the away end when theirs is going).
		const o = ball && ball.owner;
		if (o && o !== crowd.oleLast) {
			if (o.team !== crowd.oleTeam || !o.recv || state !== "play") { crowd.oleTeam = o.team; crowd.oleN = 0; }
			else {
				crowd.oleN = (crowd.oleN || 0) + 1;
				if (crowd.oleN >= 5 && crowdHush <= 0) { oleChant(crowd.oleN, o.team !== homeSide); crowd.nextChant = Math.max(crowd.nextChant, t + 6); }
			}
			crowd.oleLast = o;
		}
		if (live && state === "play" && freeze <= 0 && crowdHush <= 0 && t > crowd.nextChant) {
			// The home end sings, louder when the home side is on top; the away corner answers when theirs is.
			// In a derby both ends sing all night, trading songs.
			const awayUp = (isDerby() || edge(1 - homeSide) > 0.35) && Math.random() < 0.5;
			chant(awayUp ? (isDerby() ? 0.8 : 0.5) : 0.7 + 0.6 * edge(homeSide), awayUp);
			crowd.nextChant = t + (12 + Math.random() * 10 - 5 * edge(homeSide)) * (isDerby() ? 0.6 : 1);
		}
	}

	// The stadium anthem on the menus: a big, slow, broadcast-style theme in D major at 104 beats a
	// minute. A detuned string pad holds each chord, a horn carries the tune in two voices with a
	// choir "ah" under it, a bass walks the roots, timpani and a snare mark the beats, a cymbal
	// swells into each eight-bar phrase, and the whole thing sits in a hall reverb. Sixteen bars,
	// all synthesised; the second eight lift a step for the chorus.
	const BPM = 104, BEAT = 60 / BPM, BAR = BEAT * 4;
	const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);
	const CHORDS = { D: [ 50, 54, 57 ], A: [ 45, 49, 52 ], Bm: [ 47, 50, 54 ], G: [ 43, 47, 50 ], Em: [ 40, 43, 47 ], Asus: [ 45, 50, 52 ], "G/A": [ 45, 50, 54, 57 ] };
	const SONG = [   // [ chord, chord for the second half of the bar or null, eight melody notes (eighths; 0 holds the last) ]
		[ "D", null, [ 74, 0, 0, 0, 78, 0, 81, 0 ] ], [ "A", null, [ 81, 0, 0, 79, 78, 0, 76, 0 ] ],
		[ "Bm", null, [ 78, 0, 0, 0, 74, 0, 76, 0 ] ], [ "G", null, [ 74, 0, 0, 0, 0, 0, 69, 0 ] ],
		[ "D", null, [ 74, 0, 0, 0, 78, 0, 81, 0 ] ], [ "A", null, [ 81, 0, 0, 83, 81, 0, 79, 0 ] ],
		[ "Bm", null, [ 78, 0, 0, 0, 81, 0, 78, 0 ] ], [ "G", "Asus", [ 76, 0, 0, 0, 74, 0, 0, 0 ] ],
		[ "G", null, [ 79, 0, 0, 0, 78, 0, 76, 0 ] ], [ "D", null, [ 74, 0, 0, 0, 0, 0, 78, 0 ] ],
		[ "Em", null, [ 76, 0, 0, 0, 79, 0, 76, 0 ] ], [ "A", null, [ 73, 0, 0, 0, 0, 0, 76, 0 ] ],
		[ "G", null, [ 79, 0, 0, 0, 81, 0, 83, 0 ] ], [ "D", null, [ 81, 0, 0, 0, 0, 0, 78, 0 ] ],
		[ "Bm", null, [ 78, 0, 76, 0, 74, 0, 76, 0 ] ], [ "G/A", null, [ 73, 0, 0, 0, 74, 0, 0, 0 ] ]
	];
	// A third below in D major: two steps down the scale.
	const SCALE_D = [ 2, 4, 6, 7, 9, 11, 1 ];
	const thirdBelow = n => { const pc = n % 12, i = SCALE_D.indexOf(pc); if (i < 0) { return n - 4; } const pc2 = SCALE_D[(i + 5) % 7]; let m = n - ((pc - pc2 + 12) % 12); if (m === n) { m -= 12; } return m; };
	// The horn: two sawtooths a little apart through a lowpass that opens on the attack, a slow
	// swell in, vibrato on held notes, and a soft release.
	function horn (t, n, dur, gain) {
		const g = audio.createGain(), f = audio.createBiquadFilter();
		f.type = "lowpass"; f.Q.value = 1.2;
		f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1900, t + 0.09); f.frequency.exponentialRampToValueAtTime(1100, t + Math.max(0.15, dur));
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.06);
		g.gain.setValueAtTime(gain * 0.85, t + Math.max(0.08, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
		f.connect(g).connect(music.g);
		for (const d of [ -5, 5 ]) {
			const o = audio.createOscillator();
			o.type = "sawtooth"; o.frequency.value = midiHz(n); o.detune.value = d;
			if (dur > 0.5) {
				const lfo = audio.createOscillator(), lg = audio.createGain();
				lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(7, t + Math.min(dur, 0.7));
				lfo.connect(lg).connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.2);
			}
			o.connect(f); o.start(t); o.stop(t + dur + 0.2);
		}
	}
	// The choir: a sine with two formant bandpasses ("ah"), slow in and out, under the tune.
	function choir (t, n, dur, gain) {
		const g = audio.createGain(), o = audio.createOscillator(), o2 = audio.createOscillator();
		o.type = "triangle"; o.frequency.value = midiHz(n); o2.type = "sine"; o2.frequency.value = midiHz(n); o2.detune.value = 8;
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.18); g.gain.setValueAtTime(gain, t + Math.max(0.2, dur - 0.1)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
		for (const [ fq, q ] of [ [ 800, 6 ], [ 1150, 8 ] ]) {
			const f = audio.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = fq; f.Q.value = q;
			o.connect(f); o2.connect(f); f.connect(g);
		}
		g.connect(music.g); o.start(t); o2.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
	}
	// The strings: for each chord note, two detuned sawtooths an octave apart through a warm
	// lowpass, swelling in over the first beat and held to the end of the bar.
	function strings (t, notes, dur, gain) {
		const g = audio.createGain(), f = audio.createBiquadFilter();
		f.type = "lowpass"; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + dur * 0.6); f.Q.value = 0.6;
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + BEAT * 0.8); g.gain.setValueAtTime(gain, t + dur - 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
		f.connect(g).connect(music.g);
		for (const n of notes) {
			for (const [ oct, d ] of [ [ 0, -6 ], [ 0, 6 ], [ 12, 3 ] ]) {
				const o = audio.createOscillator(); o.type = "sawtooth"; o.frequency.value = midiHz(n + oct); o.detune.value = d;
				o.connect(f); o.start(t); o.stop(t + dur + 0.25);
			}
		}
	}
	function pluck (t, n, dur, gain, type = "triangle") {
		const o = audio.createOscillator(), g = audio.createGain();
		o.type = type; o.frequency.value = midiHz(n);
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(g).connect(music.g); o.start(t); o.stop(t + dur + 0.02);
	}
	function hit (t, dur, gain, type, f0, f1, q = 1) {   // filtered noise: a snare's rattle, hats, cymbals
		const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
		src.buffer = noise("white"); f.type = type; f.Q.value = q;
		f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1, t + dur);
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g).connect(music.g); src.start(t, Math.random()); src.stop(t + dur + 0.02);
	}
	function swell (t, dur, gain) {   // a cymbal roll that grows into the downbeat at t + dur
		const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
		src.buffer = noise("white"); f.type = "highpass"; f.frequency.value = 5000;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
		src.connect(f).connect(g).connect(music.g); src.start(t, Math.random()); src.stop(t + dur + 1);
	}
	function drum (t, f0, f1, dur, gain) {
		const o = audio.createOscillator(), g = audio.createGain();
		o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(g).connect(music.g); o.start(t); o.stop(t + dur + 0.02);
	}
	function scheduleBar (t, i) {
		const bar = i % SONG.length, [ c1, c2, mel ] = SONG[bar], E = BEAT / 2, chorus = bar >= 8;
		// Drums: a timpani on one and three, a snare on two and four, hats on the eighths, and a fill
		// at the end of each phrase. The first eight bars are quieter; the chorus brings the kit in.
		const lvl = chorus ? 1 : 0.7;
		for (let b = 0; b < 4; b++) {
			const s = t + b * BEAT;
			if (b % 2 === 0) { drum(s, 95, 42, 0.35, 0.9 * lvl); drum(s, 190, 60, 0.1, 0.25 * lvl); }
			else { hit(s, 0.17, 0.4 * lvl, "bandpass", 1900, 900, 0.8); drum(s, 220, 150, 0.08, 0.3 * lvl); }
			if (chorus) { hit(s + E, 0.05, 0.08, "highpass", 7000, 7000, 1); }
		}
		if (bar % 8 === 7) { for (let k = 0; k < 4; k++) { drum(t + 3 * BEAT + k * E / 2, 160 - k * 18, 70, 0.14, 0.5); hit(t + 3 * BEAT + k * E / 2, 0.08, 0.2, "bandpass", 1800, 1200, 1); } }
		if (bar % 8 === 6) { swell(t + 2 * BEAT, 2 * BEAT, 0.09); }
		if (bar % 8 === 0) { hit(t, 1.6, 0.11, "highpass", 6000, 3000, 0.7); }   // the crash on the downbeat
		// Strings: the chord, held through its half of the bar.
		for (let half = 0; half < 2; half++) {
			if (half && !c2) { break; }
			const ch = CHORDS[half ? c2 : c1], dur = c2 ? 2 * BEAT : BAR;
			strings(t + half * 2 * BEAT, ch.map(n => n + 12), dur, chorus ? 0.085 : 0.065);
		}
		// Bass: the root on one and three, the fifth on the "and" of four, an octave below the chord.
		for (let half = 0; half < 2; half++) {
			const ch = CHORDS[half && c2 ? c2 : c1], root = ch[0] - 12, s = t + half * 2 * BEAT;
			pluck(s, root, 0.9, 0.5); pluck(s, root, 0.5, 0.18, "sine");
			if (half) { pluck(s + BEAT + E, root + 7, 0.35, 0.3); } else { pluck(s + BEAT, root, 0.4, 0.3); }
		}
		// The tune: horn in two voices (a third apart), the choir an octave under the top line.
		mel.forEach((n, k) => {
			if (!n) { return; }
			let len = 1;
			while (k + len < mel.length && !mel[k + len]) { len++; }
			const s = t + k * E, dur = len * E * 0.95;
			horn(s, n - 12, dur, chorus ? 0.2 : 0.16); horn(s, thirdBelow(n) - 12, dur, chorus ? 0.11 : 0.08);
			choir(s, n - 24, dur, chorus ? 0.12 : 0.08);
		});
	}
	let hallBuf = null;
	function hallImpulse () {   // stereo noise that dies away over 2.5 s, darker as it fades
		if (hallBuf) { return hallBuf; }
		const sr = audio.sampleRate, len = Math.floor(sr * 2.5), b = audio.createBuffer(2, len, sr);
		for (let c = 0; c < 2; c++) {
			const d = b.getChannelData(c); let lp = 0;
			for (let i = 0; i < len; i++) {
				const env = Math.pow(1 - i / len, 2.6), w = Math.random() * 2 - 1;
				lp += (w - lp) * (0.35 - 0.25 * i / len);   // the tail loses its top end
				d[i] = lp * env * (i < sr * 0.02 ? i / (sr * 0.02) : 1);
			}
		}
		return (hallBuf = b);
	}
	// Two more menu tracks, in the style of a modern football game's soundtrack, and the three take
	// turns: a new one each time the menus come back. Each is a loop of sixteen bars written as
	// sixteenth-note patterns: a punchy kick, a clap or snare, hats, a pumping bass on the chord's
	// root, a soft pad and a short hook that comes in after the four-bar intro. Still all synthesised,
	// a handful of nodes a beat.
	const TRACKS = [
		{ name: "Floodlit anthem", bpm: BPM },
		{ name: "Under the lights", bpm: 124, chords: [ [ 57, 60, 64 ], [ 53, 57, 60 ], [ 52, 55, 60 ], [ 55, 59, 62 ] ],
			kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", bass: "x.xxx.xxx.xxx.xx", wave: "sawtooth",
			hook: [ [ 76, 0, 72, 0, 74, 0, 76, 0, 0, 0, 79, 0, 76, 0, 74, 0 ], [ 72, 0, 0, 0, 69, 0, 72, 0, 74, 0, 0, 0, 72, 0, 0, 0 ], [ 76, 0, 72, 0, 74, 0, 76, 0, 0, 0, 79, 0, 81, 0, 79, 0 ], [ 79, 0, 0, 0, 74, 0, 0, 0, 71, 0, 0, 0, 74, 0, 0, 0 ] ] },
		{ name: "Matchday", bpm: 94, chords: [ [ 52, 55, 59, 62 ], [ 48, 52, 55, 59 ], [ 55, 59, 62, 66 ], [ 50, 54, 57, 60 ] ],
			kick: "x.....x.x.....x.", snare: "....x.......x..x", hat: "x.xxx.x.x.xxx.x.", bass: "x.....x.x...x...", wave: "square",
			hook: [ [ 71, 0, 0, 74, 0, 0, 76, 0, 79, 0, 76, 0, 74, 0, 0, 0 ], [ 72, 0, 0, 0, 71, 0, 67, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], [ 71, 0, 0, 74, 0, 0, 76, 0, 79, 0, 81, 0, 79, 0, 0, 0 ], [ 78, 0, 0, 0, 76, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ] }
	];
	const VOLUMES = { quiet: [ "Quiet", 0.5 ], normal: [ "Normal", 1 ], loud: [ "Loud", 1.6 ] };
	let musicVol = "normal", trackNext = 0;
	const musicLevel = () => 0.055 * (VOLUMES[musicVol] || VOLUMES.normal)[1];
	function setMusicVol (v, save = true) {
		musicVol = VOLUMES[v] ? v : "normal";
		if (save) { store.set("ff-music-vol", musicVol); }
		const sel = $("musicVol");
		if (sel) { sel.value = musicVol; }
		if (music && audio) { music.g.gain.setTargetAtTime(musicLevel(), audio.currentTime, 0.3); }
	}
	function initMusicSettings () {
		musicVol = VOLUMES[store.get("ff-music-vol")] ? store.get("ff-music-vol") : "normal";
		trackNext = (Number(store.get("ff-track")) || 0) % TRACKS.length;
		if ($("musicVol") || !$("musicBtn")) { return; }
		const sel = document.createElement("select");
		sel.id = "musicVol"; sel.setAttribute("aria-label", "Music volume");
		for (const [ k, [ name ] ] of Object.entries(VOLUMES)) { const o = document.createElement("option"); o.value = k; o.textContent = name; sel.append(o); }
		sel.value = musicVol;
		sel.addEventListener("change", () => setMusicVol(sel.value));
		const row = $("musicVolRow");
		if (row) { row.append(sel); } else { $("musicBtn").after(sel); }
	}
	function pad (t, notes, dur, gain) {   // a soft, slow pad: a triangle and a detuned sine per note
		const g = audio.createGain(), f = audio.createBiquadFilter();
		f.type = "lowpass"; f.frequency.value = 1400;
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.setValueAtTime(gain, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
		f.connect(g).connect(music.g);
		for (const n of notes) { for (const [ type, d ] of [ [ "triangle", -7 ], [ "sine", 7 ] ]) { const o = audio.createOscillator(); o.type = type; o.frequency.value = midiHz(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.15); } }
	}
	function lead (t, n, dur, gain, type) {   // the hook: a bright pluck with a filter that closes
		const o = audio.createOscillator(), g = audio.createGain(), f = audio.createBiquadFilter();
		o.type = type; o.frequency.value = midiHz(n);
		f.type = "lowpass"; f.Q.value = 3; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
		g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
		o.connect(f).connect(g).connect(music.g); o.start(t); o.stop(t + dur + 0.08);
	}
	function grooveBar (t, i, tr) {
		const beat = 60 / tr.bpm, s16 = beat / 4, bar = i % 16, ch = tr.chords[bar % 4], intro = bar < 4, full = bar >= 8;
		for (let k = 0; k < 16; k++) {
			const s = t + k * s16;
			if (!intro && tr.kick[k] === "x") { drum(s, 130, 45, 0.28, 0.95); }
			if (tr.snare[k] === "x") { hit(s, 0.14, intro ? 0.18 : 0.34, "bandpass", 1600, 1100, 0.9); if (!intro) { drum(s, 210, 160, 0.06, 0.2); } }
			if (tr.hat[k] === "x") { hit(s, k % 4 === 2 ? 0.09 : 0.035, full ? 0.07 : 0.045, "highpass", 8000, 8000, 1); }
			if (!intro && tr.bass[k] === "x") { pluck(s, ch[0] - 24, s16 * 1.7, 0.42, tr.wave === "square" ? "triangle" : "sawtooth"); }
			const n = !intro && tr.hook[bar % 4][k];
			if (n) { let len = 1; while (k + len < 16 && !tr.hook[bar % 4][k + len]) { len++; } lead(s, n, Math.min(len, 4) * s16, full ? 0.11 : 0.08, tr.wave); }
		}
		pad(t, ch, beat * 4, intro ? 0.05 : 0.035);
		if (bar % 8 === 7) { for (let k = 0; k < 4; k++) { drum(t + 3 * beat + k * s16, 170 - k * 20, 70, 0.12, 0.5); } }
		if (bar % 8 === 6) { swell(t + 2 * beat, 2 * beat, 0.07); }
		if (bar % 8 === 0 && !intro) { hit(t, 1.4, 0.09, "highpass", 6000, 3000, 0.7); }
	}
	function updateMusic () {
		if (!audio) { return; }
		const want = soundOn && musicOn && (state === "intro" || state === "full" || state === "paused" || state === "half");
		const t = audio.currentTime;
		if (want && !music) {
			// The next track in turn, faded in over a couple of seconds.
			const k = trackNext % TRACKS.length, tr = TRACKS[k];
			trackNext = (k + 1) % TRACKS.length; store.set("ff-track", String(trackNext));
			music = { g: audio.createGain(), next: t + 0.1, bar: 0, track: k, barLen: 4 * 60 / tr.bpm };
			music.g.gain.value = 0;
			music.g.gain.setTargetAtTime(musicLevel(), t, 0.7);
			music.g.connect(audio.destination);
			// A hall around it: the dry mix plus a convolver with a two-and-a-half second decaying tail.
			try {
				const rv = audio.createConvolver(), wet = audio.createGain();
				rv.buffer = hallImpulse(); wet.gain.value = 0.38;
				music.g.connect(rv).connect(wet).connect(audio.destination);
				music.wet = wet;
			} catch (e) { /* no convolver: play it dry */ }
		}
		if (!want && music) {
			const g = music.g, wet = music.wet;
			g.gain.setTargetAtTime(0, t, 0.45);   // faded out as the match comes in
			setTimeout(() => { try { g.disconnect(); if (wet) { wet.disconnect(); } } catch (e) { /* gone */ } }, 3500);
			music = null;
			return;
		}
		if (music) { while (music.next < t + 0.6) { if (music.track) { grooveBar(music.next, music.bar++, TRACKS[music.track]); } else { scheduleBar(music.next, music.bar++); } music.next += music.barLen; } }
	}

	// Rain you can hear: filtered noise, while a match is on and sound is on.
	let rainNode = null;
	function updateRainSound () {
		const want = soundOn && audio && cond.wet > 0 && (state === "play" || state === "goal") ? cond.wet : 0;
		if (rainNode && rainNode.level !== want) {
			try { rainNode.src.stop(); } catch (e) { /* already stopped */ }
			rainNode = null;
		}
		if (!want || rainNode) { return; }
		try {
			const len = audio.sampleRate * 2, buf = audio.createBuffer(1, len, audio.sampleRate), data = buf.getChannelData(0);
			for (let i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
			const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
			src.buffer = buf; src.loop = true;
			f.type = "lowpass"; f.frequency.value = 800 + 500 * want;
			g.gain.value = 0.02 * want;
			src.connect(f).connect(g).connect(audio.destination);
			src.start();
			rainNode = { src, level: want };
		} catch (e) { rainNode = null; }
	}

	// What your buttons do right now, in the bottom-left corner.
	let hintsOn = true, padOn = false;
	let highContrast = false;   // Kit contrast: the other side in white or black with a dashed ring
	const coarse = (() => { try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } })();
	// proj (x, y) -> screen point, from the camera drawing them: with it, the hints fade back while a
	// player stands under them (judged against last frame's box), so they never hide a man in the corner.
	let hintsBox = null, hintsFade = 1;
	function drawHints (proj) {
		if (!hintsOn || coarse || state !== "play" || freeze > 0) { hintsBox = null; return; }
		const me = human();
		if (!me) { return; }
		const P = padOn;   // show controller buttons once a controller is in use
		let items;
		if (me.role === "gk" && ball.owner === me) {
			items = [ [ P ? "Stick" : "Arrows", "Aim" ], [ P ? "A" : "S", "Roll it out" ], [ P ? "Y" : "W", "Into a runner" ], [ P ? "RB" : "Q", "Kick long" ] ];
		} else if (setPiece && setPiece.taker === me && ball.owner === me) {
			items = setPiece.kind === "throw"
				? [ [ P ? "Stick" : "Arrows", "Aim" ], [ P ? "A" : "S", "Short throw" ], [ P ? "RB" : "Q", "Long throw" ] ]
				: setPiece.kind === "pen" ? [ [ P ? "Stick" : "↑ ↓", "Pick a side" ], [ P ? "B" : "D", "Take the penalty" ] ]
				: setPiece.kind === "free" && setPiece.indirect ? [ [ P ? "A" : "S", setPiece.layoff ? "Lay it off (indirect)" : "Pass (indirect)" ], [ P ? "RB" : "Q", "Long ball" ], [ P ? "B" : "D", "Shoot: needs a touch first" ] ]
				: setPiece.kind === "free" ? (shotInRange(me)
					? [ [ P ? "Stick" : "↑ ↓", "Pick a corner" ], [ P ? "Y" : "W", "Curl it over the wall" ], [ P ? "B" : "D", "Drive it low" ], [ P ? "A" : "S", setPiece.layoff ? "Lay it off" : "Pass" ] ]
					: [ [ P ? "Stick" : "Arrows", "Aim" ], [ P ? "A" : "S", "Pass" ], [ P ? "RB" : "Q", "Long ball" ], [ P ? "B" : "D", "Shoot" ] ])
				: setPiece.kind === "corner" ? [ [ P ? "A" : "S", "Near post (in-swinger)" ], [ P ? "RB" : "Q", "Far post (out-swinger)" ], [ P ? "Y" : "W", "Penalty spot" ] ]
				: [ [ P ? "Stick" : "Arrows", "Aim" ], [ P ? "A" : "S", "Short" ], [ P ? "RB" : "Q", "Long" ] ];
		} else if (setPiece && setPiece.kind === "pen" && setPiece.team === 1) {
			items = [ [ P ? "Stick" : "↑ ↓", "Hold to pick your keeper's dive" ] ];
		} else if (ball.owner === me && charging && aimY !== null && shotInRange(me)) {
			items = [ [ P ? "Stick" : "↑ ↓", "Aim in the goal" ], [ P ? "Release B" : "Release D", "Shoot (harder = wider)" ] ];
		} else if (ball.owner === me) {
			const chip = shotInRange(me) && !isWide(me.y, 0.2) && Math.hypot(FW - me.x, FH / 2 - me.y) < 480 * Math.sqrt(S);
			items = [ [ P ? "A" : "S", "Pass" ], [ P ? "Y" : "W", "Through ball" ], [ P ? "B" : "D", "Shoot, hold for power" ], [ P ? "RB" : "Q", chip ? "Chip the keeper" : rel(0, me.x) > FW * 0.68 && isWide(me.y) ? "Cross" : "Long ball" ], [ P ? "RT" : "E", "Sprint" ] ];
		} else if (ball.owner && ball.owner.team === 0) {
			items = [ [ P ? "A" : "S", "Switch" ], [ P ? "RT" : "E", "Sprint" ] ];
		} else {
			const close = ball.owner && ball.owner.team === 1 && dist(me, ball.owner) < 36;
			const far = !ball.owner || ball.owner.team !== 1 || dist(me, ball.owner) >= 95;
			items = [ [ P ? "X" : "A", close ? "Shoulder tackle" : far ? "Hold: close him down" : "Slide tackle" ], [ P ? "A" : "S", "Switch player" ], [ P ? "RT" : "E", "Sprint" ] ];
		}
		ctx.font = "600 12px Barlow, Arial, sans-serif";
		ctx.textBaseline = "middle";
		ctx.textAlign = "left";
		let x = 12;
		const y = SH - 22 - tickerUp(), maxX = radarShown() ? (SW - RADAR_W) / 2 - 16 : SW - 12;   // stay clear of the minimap when it's shown
		let under = false;
		if (proj && hintsBox) {
			for (const q of players) { const s = proj(q.x, q.y); if (s && s.x > -10 && s.x < hintsBox.x1 + 10 && s.y > hintsBox.y0 - 4 && s.y < SH + 60) { under = true; break; } }
		}
		hintsFade += ((under ? 0.28 : 1) - hintsFade) * (reduceMotion ? 1 : 0.2);
		ctx.save(); ctx.globalAlpha = hintsFade;
		for (const [ key, label ] of items) {
			ctx.font = "800 11px Barlow, Arial, sans-serif";
			const kw = ctx.measureText(key).width + 10;
			ctx.font = "600 12px Barlow, Arial, sans-serif";
			const lw = ctx.measureText(label).width;
			if (x + kw + lw + 10 > maxX) { break; }
			ctx.fillStyle = "rgba(7, 12, 10, 0.66)";
			ctx.fillRect(x - 3, y - 11, kw + lw + 12, 22);
			ctx.fillStyle = "#eef6ea";
			ctx.fillRect(x, y - 8, kw, 16);
			ctx.fillStyle = "#13211a";
			ctx.font = "800 11px Barlow, Arial, sans-serif";
			ctx.fillText(key, x + 5, y + 0.5);
			ctx.fillStyle = "rgba(238, 246, 234, 0.92)";
			ctx.font = "600 12px Barlow, Arial, sans-serif";
			ctx.fillText(label, x + kw + 5, y + 0.5);
			x += kw + lw + 20;
		}
		ctx.restore();
		hintsBox = { x1: x - 8, y0: y - 11 };
	}

	// Shot power, big enough to read from any camera: a bar along the bottom while you hold Shoot.
	let meterRect = null;
	function drawPowerMeter () {
		const me = human();
		if (!charging || state !== "play" || !me || ball.owner !== me) { meterRect = null; return; }
		const power = clamp((frame - chargeStart) / 50, 0, 1);
		const w = Math.min(RADAR_W, SW - 40), h = 8, x = (SW - w) / 2, y = radarShown() ? SH - 12 - tickerUp() - FH * RADAR_W / FW - 26 : SH - (coarse || !hintsOn ? 30 : 56) - tickerUp();
		meterRect = { x, y, w, h, power };
		ctx.save();
		ctx.fillStyle = "rgba(10, 16, 14, 0.62)";
		ctx.fillRect(x - 6, y - 20, w + 12, h + 26);
		ctx.fillStyle = "rgba(238, 246, 234, 0.14)";
		ctx.fillRect(x, y, w, h);
		// Green into amber, then red at full power, where a poor finisher can blaze it over.
		ctx.fillStyle = power < 0.5 ? `rgb(${Math.round(127 + (242 - 127) * power * 2)}, ${Math.round(212 + (181 - 212) * power * 2)}, ${Math.round(155 + (46 - 155) * power * 2)})`
			: power < 0.8 ? "#f2b52e" : "#e2594a";
		ctx.fillRect(x, y, w * power, h);
		ctx.fillStyle = "rgba(238, 246, 234, 0.7)";
		ctx.fillRect(x + w * 0.8 - 1, y - 3, 2, h + 6);   // the mark where the ball starts to rise
		ctx.font = "800 11px Barlow, Arial, sans-serif";
		ctx.textBaseline = "middle";
		ctx.textAlign = "left";
		ctx.fillStyle = "#eef6ea";
		ctx.fillText("POWER", x, y - 11);
		ctx.textAlign = "right";
		ctx.fillStyle = "rgba(238, 246, 234, 0.8)";
		ctx.font = "600 11px Barlow, Arial, sans-serif";
		ctx.fillText(padOn ? "Release B to shoot" : coarse ? "Let go to shoot" : "Release D to shoot", x + w, y - 11);
		ctx.restore();
	}

	// Match-wide messages, drawn on the screen rather than the pitch.
	// A broadcast strip at the top centre, one per message, stacked: dark backing, the message's colour
	// as an accent bar and the text. Out of the way of play rather than written across the stands.
	function drawToasts () {
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.font = "800 19px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
		let row = 0;
		for (const f of fx) {
			if (!f.toast) { continue; }
			const txt = f.label.toUpperCase(), tw = ctx.measureText(txt).width, w = tw + 30, h = 28;
			const k = Math.min(1, (1 - f.t / f.life) * 2.5), slide = reduceMotion ? 0 : Math.max(0, 1 - f.t / 10) * 8;
			const x = SW / 2 - w / 2, y = 64 + row * 34 - slide;
			ctx.globalAlpha = k;
			ctx.fillStyle = "rgba(9, 13, 16, 0.82)";
			if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); } else { ctx.fillRect(x, y, w, h); }
			ctx.fillStyle = f.color; ctx.fillRect(x, y, 4, h);
			ctx.fillText(txt, x + 18, y + h / 2 + 1);
			row++;
		}
		ctx.globalAlpha = 1;
	}

	// The radar, FIFA style: the whole pitch in a small dark panel at the bottom centre, both sides as
	// dots in their kit colours, the ball in white and your man ringed. On unless you turn it off.
	let minimapOn = true;
	const RADAR_W = 168;
	const radarShown = () => minimapOn && state !== "intro" && (camMode !== "top" || WW > VW || WH > VH);
	function drawMinimap () {
		if (!radarShown()) { return; }
		const w = RADAR_W, k = w / FW, h = FH * k, x0 = (SW - w) / 2, y0 = SH - h - 12 - tickerUp();
		ctx.save();
		ctx.fillStyle = "rgba(10, 16, 14, 0.42)";
		ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - 6, y0 - 6, w + 12, h + 12, 6) : ctx.rect(x0 - 6, y0 - 6, w + 12, h + 12); ctx.fill();
		ctx.fillStyle = "rgba(60, 120, 70, 0.16)"; ctx.fillRect(x0, y0, w, h);
		ctx.strokeStyle = "rgba(238, 246, 234, 0.38)"; ctx.lineWidth = 1;
		const bd = FW * 0.157 * k, bw = FH * 0.593 * k, gd = FW * 0.052 * k, gw = FH * 0.27 * k;
		ctx.beginPath();
		ctx.rect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
		ctx.moveTo(x0 + w / 2, y0); ctx.lineTo(x0 + w / 2, y0 + h);
		ctx.rect(x0 + 0.5, y0 + (h - bw) / 2, bd, bw); ctx.rect(x0 + w - 0.5 - bd, y0 + (h - bw) / 2, bd, bw);
		ctx.rect(x0 + 0.5, y0 + (h - gw) / 2, gd, gw); ctx.rect(x0 + w - 0.5 - gd, y0 + (h - gw) / 2, gd, gw);
		ctx.moveTo(x0 + w / 2 + h * 0.135, y0 + h / 2); ctx.arc(x0 + w / 2, y0 + h / 2, h * 0.135, 0, Math.PI * 2);
		ctx.stroke();
		const sw = endsSwapped(), mx = x => (sw ? FW - x : x);
		if (camMode === "top") {
			ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
			ctx.strokeRect(x0 + (sw ? FW - (camX - MX) - VW : camX - MX) * k, y0 + (camY - MY) * k, VW * k, VH * k);
		}
		const me = human();
		ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
		for (const p of players) {
			if (p === me) { continue; }
			const kit = KITS[p.team];
			ctx.fillStyle = p.role === "gk" ? kit.gk : kit.outfield;
			ctx.beginPath(); ctx.arc(x0 + mx(p.x) * k, y0 + p.y * k, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		}
		if (me) {
			const px = x0 + mx(me.x) * k, py = y0 + me.y * k;
			ctx.fillStyle = KITS[0].outfield;
			ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.6;
			ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
		}
		ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(0, 0, 0, 0.7)"; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.arc(x0 + mx(ball.x) * k, y0 + ball.y * k, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.restore();
	}

	// Arrow at the screen edge when the player you control is out of view.
	function drawOffscreenMarker () {
		const me = human();
		if (!me || state === "intro") { return; }
		const sx0 = MX + me.x - camX;
		let sx = endsSwapped() ? VW - sx0 : sx0, sy = MY + me.y - camY;
		if (rotTop) { [ sx, sy ] = [ SW - sy, sx ]; }
		const pad = 26;
		if (sx > 0 && sx < SW && sy > 0 && sy < SH) { return; }
		const ex = clamp(sx, pad, SW - pad), ey = clamp(sy, pad, SH - pad);
		const a = Math.atan2(sy - ey, sx - ex);
		ctx.save();
		ctx.translate(ex, ey);
		ctx.rotate(a);
		ctx.fillStyle = "#ffffff";
		ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
		ctx.restore();
	}

	// 3-2-1 before each kickoff, then a brief "Go".
	function drawCountdown () {
		if (state !== "play") { return; }
		let text = null, alpha = 1;
		if (freeze > 0 && freezeKind === "kickoff") {
			text = String(Math.ceil(freeze / 30));
			alpha = 0.55 + 0.45 * ((freeze % 30) / 30);
		} else if (goFlash > 0) {
			text = "Go";
			alpha = goFlash / 30;
		}
		if (!text) { return; }
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "900 120px 'Big Shoulders Display', 'Arial Narrow', Arial, sans-serif";
		// Under the kick-off line-ups card while it is up (it sits over the canvas), not hidden behind it.
		let cy = 174;
		const lu = $("bcLineups");
		if (lu && !lu.hidden) { const r = lu.getBoundingClientRect(), c = ctx.canvas.getBoundingClientRect(); if (r.height && c.height) { cy = clamp(Math.max(cy, (r.bottom - c.top) * SH / c.height + 66), 174, SH - 64); } }
		ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
		ctx.fillText(text.toUpperCase(), SW / 2 + 3, cy + 5);
		ctx.fillStyle = "#eef6ea";
		ctx.fillText(text.toUpperCase(), SW / 2, cy);
		ctx.restore();
	}

