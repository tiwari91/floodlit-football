	/* ---------- the commentator's voice ----------
	   Optional, using the browser's own speech (speechSynthesis). Only the key moments are spoken:
	   goals, big chances, saves, cards and flare-ups, half-time and full-time, and the odd short
	   build-up line. Never more than one line waiting; a line that has gone stale is dropped; big
	   moments come out higher and quicker; the voice drops back under the crowd's roar. Off in the
	   test mode and wherever speech or an English voice is missing, without a word. */
	const VOICE_TEST = /[?&]test\b/.test(location.search);
	const SPOKEN = { near: 1, over: 0, save: 1, tackle: 0.3, woodwork: 1, bar: 1, lateWin: 2, lateEq: 2, hattrick: 2, rocket: 0.4, equaliser: 2, ahead: 2, comeback: 2, own: 2, red: 1, red2: 1, flare: 1, attack: 0.6, offside: 0.7 };
	const BIG = { lateWin: 1, lateEq: 1, hattrick: 1, equaliser: 1, ahead: 1, comeback: 1, own: 1, red: 1, red2: 1, goal: 1 };
	const speech = () => (!VOICE_TEST && typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null);
	let voicePick = null, voiceWaiting = 0, voiceLastState = "", voiceGap = 0;
	// The best English voice there is: British first, then any English; the fuller voices over the
	// "compact" and novelty ones. null when there's no English voice at all.
	function pickVoice () {
		const s = speech();
		if (!s) { return null; }
		let list = [];
		try { list = s.getVoices() || []; } catch (e) { list = []; }
		const en = list.filter(v => v && /^en[-_]/i.test(v.lang || ""));
		if (!en.length) { return null; }
		const score = v => (/^en[-_]GB/i.test(v.lang) ? 100 : /^en[-_](IE|AU)/i.test(v.lang) ? 60 : 40) + (/compact|whisper|bells|bubbles|zarvox|trinoids|bad news|good news|organ|jester|superstar|wobble|cellos/i.test(v.name) ? -80 : 0) + (/premium|enhanced|natural|neural|google uk|daniel|arthur|serena/i.test(v.name) ? 25 : 0) + (v.localService ? 5 : 0);
		return en.sort((a, b) => score(b) - score(a))[0];
	}
	// The co-commentator's voice: the best English voice that isn't the lead's (a different speaker
	// where the system has one, a female one preferred for contrast); the lead's own voice, pitched
	// down, when there is only one.
	let voicePick2 = null;
	function pickVoice2 (lead) {
		const s = speech();
		if (!s || !lead) { return lead; }
		let list = [];
		try { list = s.getVoices() || []; } catch (e) { list = []; }
		const en = list.filter(v => v && v !== lead && v.name !== lead.name && /^en[-_]/i.test(v.lang || "") && !/compact|whisper|bells|bubbles|zarvox|trinoids|bad news|good news|organ|jester|superstar|wobble|cellos|albert|fred|junior|ralph/i.test(v.name));
		if (!en.length) { return lead; }
		const score = v => (/^en[-_]GB/i.test(v.lang) ? 30 : /^en[-_](IE|AU)/i.test(v.lang) ? 25 : 10) + (/serena|kate|stephanie|female|karen|moira|tessa|samantha|fiona|martha|google uk english female/i.test(v.name) ? 40 : 0) + (/premium|enhanced|natural|neural/i.test(v.name) ? 15 : 0);
		return en.sort((a, b) => score(b) - score(a))[0];
	}
	const phoneLike = () => (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) || innerWidth < 700;
	// Phones default to off unless a good British voice is there; the choice, once made, is kept.
	function voiceDefault () {
		const v = pickVoice();
		if (!v) { return false; }
		return !phoneLike() || (/^en[-_]GB/i.test(v.lang) && !/compact/i.test(v.name));
	}
	let voiceOn = false;
	const voiceAvailable = () => !!speech() && !!pickVoice();
	function setVoice (on, save = true) {
		voiceOn = !!on && voiceAvailable();
		if (save) { store.set("ff-voice", on ? "1" : "0"); }
		const b = $("voiceBtn");
		if (b) { b.textContent = voiceOn ? "Commentary voice on" : "Commentary voice off"; b.setAttribute("aria-pressed", String(voiceOn)); }
		if (!voiceOn) { const s = speech(); if (s) { try { s.cancel(); } catch (e) { /* nothing to stop */ } } voiceWaiting = 0; }
	}
	function initVoice () {
		const s = speech();
		const apply = () => { voicePick = pickVoice(); voicePick2 = pickVoice2(voicePick); const saved = store.get("ff-voice"); setVoice(saved === "1" ? true : saved === "0" ? false : voiceDefault(), false); };
		if (s && !$("voiceBtn") && $("musicBtn")) {
			const b = document.createElement("button");
			b.id = "voiceBtn"; b.type = "button"; b.title = "A commentator's voice for the big moments (uses your browser's speech)";
			b.addEventListener("click", () => setVoice(!voiceOn));
			$("musicBtn").after(b);
		}
		apply();
		if (s) { try { s.addEventListener("voiceschanged", apply); } catch (e) { /* older browsers: the first list is all there is */ } }
	}
	// Say one line, by the lead (who 0) or the co-commentator (1). Big moments push out whatever was
	// being said; anything else waits its turn, and only if nothing is waiting already. A line that
	// hasn't started within three seconds is dropped. The co-commentator only speaks into a gap after
	// the lead, never over him. Excitement lifts the pitch and the pace.
	function speakLine (text, kind, who = 0) {
		const s = speech();
		if (!voiceOn || !s || !text || bulkSim || (typeof replayOn === "function" && replayOn())) { return false; }
		const big = !!BIG[kind] && who === 0, odds = SPOKEN[kind] === undefined ? (kind === "half" || kind === "full" ? 1 : 0) : SPOKEN[kind];
		if (!big && Math.random() >= (who === 1 ? Math.min(1, odds + 0.3) : odds)) { return false; }
		if (!voicePick) { voicePick = pickVoice(); voicePick2 = pickVoice2(voicePick); }
		const v = who === 1 ? voicePick2 || voicePick : voicePick;
		if (!v) { return false; }
		try {
			if (big && (s.speaking || s.pending)) { s.cancel(); voiceWaiting = 0; }
			else if (voiceWaiting >= 1 || (!big && who === 0 && performance.now() < voiceGap) || (who === 1 && (s.pending || performance.now() < voiceGap - 1800))) { return false; }
			const u = new SpeechSynthesisUtterance(text.replace(/!+/g, "!"));
			u.voice = v; u.lang = v.lang;
			const ex = typeof EXCITE !== "undefined" ? (EXCITE[kind] || 0.3) : (big ? 1 : 0.3), same = who === 1 && v === voicePick;
			// The lead: up and quicker with the moment, shouting at a goal. The co-commentator: lower and
			// steadier, but still lifted by it (a shade lower again when she shares the lead's voice).
			u.pitch = clamp(who === 0 ? 1 + 0.4 * ex : (same ? 0.78 : 1) + 0.18 * ex, 0.5, 1.6);
			u.rate = clamp(who === 0 ? 1 + 0.22 * ex : 0.97 + 0.1 * ex, 0.8, 1.3);
			const roar = typeof crowdMood !== "undefined" ? clamp(crowdMood.excite || 0, 0, 1) : 0;
			u.volume = clamp(0.95 - roar * 0.35, 0.4, 1);   // under the crowd when it roars
			const queued = performance.now();
			voiceWaiting++;
			u.onstart = () => { voiceWaiting = Math.max(0, voiceWaiting - 1); if (performance.now() - queued > 3000) { try { s.cancel(); } catch (e) { /* gone */ } } };
			u.onend = u.onerror = () => { voiceGap = performance.now() + 2500; if (voiceWaiting > 0 && !s.pending) { voiceWaiting = 0; } };
			s.speak(u);
			return true;
		} catch (e) { voiceOn = false; return false; }
	}
	// Each frame (from the commentary tick): the whistle at half-time and full-time gets a line (the goals
	// are called by the commentary tick, goalShout).
	function voiceTick () {
		if (!voiceOn) { return; }
		if (state !== voiceLastState) {
			const sc = Array.isArray(score) ? `${score[0]}, ${score[1]}` : "";
			if (state === "half") { speakLine(`That's half-time. ${sc}.`, "half"); }
			if (state === "full") { speakLine(score[0] === score[1] ? `It's all over, and it ends all square. ${sc}.` : `It's all over! ${sc}.`, "full"); }
			voiceLastState = state;
		}
	}
