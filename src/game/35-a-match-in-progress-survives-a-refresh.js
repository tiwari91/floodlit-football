	/* ---------- a match in progress survives a refresh ----------
	   Every couple of seconds (and when you leave the page) the score, clock and match
	   state are kept in this browser. Reopen the page and the same fixture comes back
	   paused where you left it. The season itself is saved separately after every result. */
	const liveKey = () => (mode === "league" && league ? `L${league.season}-${league.round}-${league.fmt}` : `F-${fmtKey}`);
	function saveLive () {
		if (tut || shoot || mode === "tutorial" || mode === "corners" || !(state === "play" || state === "paused" || state === "goal" || state === "half") || !(timeLeft > 0)) { return; }
		store.set("ff-live", JSON.stringify({
			v: 1, key: liveKey(), score, timeLeft, momentum, possFrames, stats, ostats: oppStats, best: bestStreak, ment: mentality[0], lastConceded, half: halfDone, at: Date.now(),
			off: dismissed, cards: matchCards, hurt: matchInjuries, hurtInfo: matchInjInfo, subs: subLog, log: matchLog, goals: matchGoals,
			marks: players.filter(p => p.yellow || p.injured).map(p => [ p.team, p.idx, p.yellow || 0, p.injured ? 1 : 0 ]),
			sta: players.map(p => [ p.team, p.idx, Math.round(staOf(p) * 100) ]), cpuWin: cpuSubWin
		}));
	}
	const clearLive = () => store.del("ff-live");
	function restoreLive () {
		let v = null;
		try { v = JSON.parse(store.get("ff-live") || "null"); } catch (e) { v = null; }
		if (!v || v.v !== 1 || v.key !== liveKey() || !(v.timeLeft > 0) || !Array.isArray(v.score) || Date.now() - v.at > 14 * 864e5) { return false; }
		score = v.score.slice(0, 2).map(n => Math.max(0, Number(n) || 0));
		timeLeft = Math.min(Number(v.timeLeft), matchLen);
		momentum = clamp(Number(v.momentum) || 0, -1, 1);
		if (Array.isArray(v.possFrames)) { possFrames = v.possFrames.slice(0, 2).map(n => Number(n) || 0); }
		if (v.stats && typeof v.stats === "object") { stats = { ...stats, ...v.stats }; }
		if (v.ostats && typeof v.ostats === "object") { oppStats = { ...oppStats, ...v.ostats }; }
		if (Array.isArray(v.best)) { bestStreak = v.best.slice(0, 2).map(n => Number(n) || 0); }
		mentality[0] = clamp(Number(v.ment) || 0, -1, 2);
		lastConceded = v.lastConceded === 1 ? 1 : 0;
		halfDone = !!v.half || timeLeft <= matchLen / 2;
		const find = (t, i) => players.find(p => p.team === t && p.idx === i);
		if (Array.isArray(v.marks)) { for (const [ t, i, y, h ] of v.marks) { const p = find(t, i); if (p) { p.yellow = Number(y) || 0; p.injured = !!h; } } }
		if (Array.isArray(v.off)) { for (const [ t, i ] of v.off) { const p = find(t, i); if (p) { sendOff(p); } } }
		if (Array.isArray(v.sta)) { for (const [ t, i, s ] of v.sta) { const p = find(t, i); if (p && Number.isFinite(s)) { p.sta = clamp(s / 100, 0.25, 1); } } }
		cpuSubWin = clamp(Number(v.cpuWin) || 0, 0, 3);
		if (Array.isArray(v.cards)) { matchCards = v.cards.filter(c => c && typeof c.name === "string"); }
		if (Array.isArray(v.hurt)) { matchInjuries = v.hurt.filter(n => typeof n === "string"); }
		if (v.hurtInfo && typeof v.hurtInfo === "object") { for (const [ n, i ] of Object.entries(v.hurtInfo)) { if (i && typeof i.type === "string" && Number.isFinite(i.games)) { matchInjInfo[n] = { type: i.type, games: clamp(i.games, 1, 12), serious: !!i.serious }; } } }
		if (Array.isArray(v.log)) { matchLog = v.log.filter(e => e && typeof e.text === "string").slice(0, 200); }
		if (Array.isArray(v.goals)) { matchGoals = v.goals.filter(n => typeof n === "string"); }
		if (Array.isArray(v.subs)) { for (const [ i, n ] of v.subs) { const p = find(0, i), pl = subPool().find(q => q.name === n); if (p && pl) { makeSub(p, pl, true); } } }
		kickoff(lastConceded);
		state = "paused";
		const t = Math.ceil(timeLeft);
		showOverlay("Welcome back", `Your match is where you left it: ${leftIsYou ? score[0] : score[1]}–${leftIsYou ? score[1] : score[0]}, ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} to play.`, "Resume");
		pauseBtn.textContent = "Resume";
		lastHud = "";
		return true;
	}

	function startPlay () {
		ensureAudio();
		if (audio && audio.state === "suspended") { audio.resume(); }
		overlay.hidden = true;
		// A finished tutorial goes back where it was started from: the league's first matchday when the
		// welcome card sent the player there, otherwise a friendly to practise in.
		if (tutDone) { tutDone = false; const back = store.get("ff-tut-return") === "league"; store.set("ff-tut-return", ""); setMode(back ? "league" : "friendly"); return; }
		if (state === "intro" || state === "full") {
			if (mode === "league" && seasonDone()) { newSeason(league.fmt); renderLeague(); renderShapes(); }
			clearLive();
			newMatch();
			freeze = KICKOFF_FREEZE;
			if (mode === "corners") { startShootout(); return; }
			showLineups();
			if (mode !== "tutorial") { store.set("ff-played", String(playedCount() + 1)); }
		}
		if (state === "half") { toast("Second half: teams change ends", "#eef6ea"); }
		if ((state === "intro" || state === "full" || state === "half") && mode !== "tutorial") { introSweep = { on: true }; }
		state = "play";
		pauseBtn.textContent = "Pause";
		if (mode === "tutorial" && !tut) { tut = { step: 0 }; freeze = 0; setupTutStep(); }
		canvas.focus?.();
	}

	function pause () {
		if (state !== "play") { return; }
		state = "paused";
		charging = false;
		hideLineups();
		const tiredNow = team(0).filter(p => p.role !== "gk" && (p.injured || staOf(p) < TIRED_STA)).sort((a, b) => staOf(a) - staOf(b));
		const subTip = tiredNow.length && subsLeft > 0 ? ` ⚠ ${tiredNow.slice(0, 3).map(p => `${p.name || "Player"} (${p.injured ? "injured" : `${Math.round(staOf(p) * 100)}% legs`})`).join(", ")} ${tiredNow.length === 1 ? "is" : "are"} struggling: a substitution would help.` : "";
		showOverlay("Paused", mode === "tutorial" ? "Take a breather." : `Take a breather. The clock is stopped. Or simulate the rest: the score so far stands and the time left is played out.${subTip}`, "Resume");
		if (mode !== "tutorial") { $("ovSim").textContent = "Simulate the rest"; $("ovSim").hidden = false; $("ovSubs").hidden = false; }
		$("ovHelp").hidden = false;
		renderQuick();
		pauseBtn.textContent = "Resume";
	}

	// Your players' ratings for the match: goals, tackles, cards, the result, clean sheets.
	function rateMatch (h, a) {
		const out = {}, res = h > a ? 0.6 : h < a ? -0.6 : 0, byName = tally.byName || {};
		const names = new Set([ ...team(0).map(p => p.name), ...wentOff ]);
		for (const n of names) {
			if (!n) { continue; }
			const p = team(0).find(q => q.name === n), role = p ? p.role : "mid", st = byName[n] || {};
			let r = 6.6 + res + (Math.random() * 2 - 1) * 0.45;
			r += 1.1 * matchGoals.filter(g => g === n).length + 0.12 * Math.min(8, st.tackle || 0) + 0.15 * Math.min(4, st.air || 0);
			if ((role === "gk" || role === "def") && a === 0) { r += 0.6; }
			if (role === "gk" || role === "def") { r -= 0.25 * Math.max(0, a - 1); }
			for (const c of matchCards) { if (c.name === n) { r -= c.kind === "y" ? 0.4 : 1.6; } }
			if (wentOff.includes(n) || cameOn.includes(n)) { r = 6.6 + (r - 6.6) * 0.7; }
			out[n] = Math.round(clamp(r, 3.5, 9.8) * 10) / 10;
		}
		return out;
	}
	let lastRatings = {};
	function endMatch () {
		clearLive();
		lastRatings = leagueMatch ? rateMatch(score[0], score[1]) : {};
		if (!simulated) { matchSta = {}; for (const p of team(0)) { if (p.name) { matchSta[p.name] = staOf(p); } } }
		state = "full";
		banner.hidden = true;
		charging = false;
		sfx("final");
		const [ h, a ] = score;
		const line = h > a ? `You beat ${opp.name} ${h} to ${a}.` : h < a ? `${cap(opp.name)} beat you ${a} to ${h}.` : `A ${h} to ${a} draw with ${opp.name}.`;
		let nudge = h > a ? "Try a tougher opponent next." : h < a ? "Try keeping the ball: pass when a defender closes in." : "Level at the whistle.";
		let btn = "Play again";
		if (leagueMatch) {
			recordLeagueResult(leagueMatch, h, a);
			const rows = standings(), pos = rows.findIndex(r => r.id === 0) + 1, pts = rows[pos - 1].pts;
			if (seasonDone()) {
				nudge = (rows[0].id === 0 ? `You are champions with ${pts} points!` : `Season over: ${TEAMS[rows[0].id].name} are champions. You finished ${ordinal(pos)}.`) +
					` Prize money: ${money(league.prize || 0)}. The transfer window is open below the pitch.`;
				btn = `Start season ${league.season + 1}`;
			} else {
				nudge = `You are ${ordinal(pos)} on ${pts} point${pts === 1 ? "" : "s"}.`;
				const tired = tiredStarters();
				if (league.rotated && league.rotated.length) { nudge += ` Auto-rotate rested ${league.rotated.join(", ")}.`; }
				if (league.recovered && league.recovered.length) { nudge += ` Available again: ${league.recovered.join(", ")}.`; }
				if (league.banned && league.banned.length) { nudge += ` Suspended: ${league.banned.join(", ")}.`; }
				if (league.injured && league.injured.length) { nudge += ` Injured and out: ${league.injured.join(", ")}; they've been taken off the team sheet.`; }
				if (league.physio && league.physio.length) { nudge += ` Your fitness coach has ${league.physio.join(", ")} back a week early.`; }
				if (tired.length) { nudge += ` ⚠ Before the next match: ${tiredText(tired)} Press "Rotate now", or turn on Auto-rotate in the squad panel.`; }
				const rep2 = league.club.report;
				if (rep2 && rep2.round === league.round && rep2.gains.length) { nudge += ` Training: ${rep2.gains.slice(0, 4).join(", ")}${rep2.gains.length > 4 ? ` and ${rep2.gains.length - 4 + (rep2.more || 0)} more` : ""}.`; }
				btn = `Play matchday ${league.round + 1}`;
			}
		}
		if (!simulated) { nudge += ` ${coachReview()}`; }
		updateNextNote();
		$("announce").textContent = `Full time. ${line}`;
		const wasSim = simulated;
		simulated = false;
		showOverlay(wasSim ? (leagueMatch ? "Simulated result" : "Simulated friendly") : "Full time", `${line} ${nudge}`, btn,
			wasSim ? null : matchStats(Math.round(100 * possFrames[0] / Math.max(1, possFrames[0] + possFrames[1]))));
		if (leagueMatch && !seasonDone() && tiredStarters().length) { $("ovFix").textContent = "Rotate now"; $("ovFix").hidden = false; }
		if (leagueMatch && seasonDone() && standings()[0].id === 0) { celebrateTrophy("league trophy"); }
		$("ovHelp").hidden = false;
		renderReport();
		if (leagueMatch) { offerSeasonSim(); }
		pauseBtn.textContent = "Pause";
		renderHud();
	}

	// Both sides' numbers, you against them, for the half-time and full-time cards.
	function matchStats (poss) {
		const pct = (c, n) => (n ? `${Math.round(100 * c / n)}%` : "–");
		const rows = [
			[ "Possession", `${poss}%`, `${100 - poss}%`, poss, 100 - poss, "poss" ],
			[ "Shots", stats.shots, oppStats.shots ],
			[ "Passes", `${stats.completed}/${stats.passes}`, `${oppStats.completed}/${oppStats.passes}`, stats.completed, oppStats.completed ],
			[ "Pass accuracy", pct(stats.completed, stats.passes), pct(oppStats.completed, oppStats.passes), stats.passes ? stats.completed / stats.passes : 0, oppStats.passes ? oppStats.completed / oppStats.passes : 0 ],
			[ "Tackles won", stats.tackles + (stats.aiTackles || 0), oppStats.tackles ],
			[ "Corners", stats.corners || 0, oppStats.corners ],
			[ "Fouls", stats.fouls || 0, oppStats.fouls, -(stats.fouls || 0), -oppStats.fouls ],
			[ "Best pass run", bestStreak[0], bestStreak[1] ]
		];
		if ((stats.cards || 0) + oppStats.cards > 0) { rows.push([ "Cards", stats.cards || 0, oppStats.cards, -(stats.cards || 0), -oppStats.cards ]); }
		return { you: "You", them: opp.short, rows };
	}

	function showOverlay (title, text, btn, statRows) {
		ovTitle.textContent = title;
		ovText.textContent = text;
		ovText.classList.remove("lines");
		ovButton.textContent = btn;
		$("ovSim").hidden = true;
		$("ovFix").hidden = true;
		$("ovSubs").hidden = true;
		$("ovSeason").hidden = true;
		$("ovSeasonAll").hidden = true;
		$("ovReport").hidden = true;
		$("ovTrophy").hidden = true;
		$("subPanel").hidden = true;
		$("ovKeys").hidden = true;
		$("ovQuick").hidden = true;
		$("ovHelp").hidden = true;
		$("ovLearn").hidden = true;
		ovCard()?.classList.toggle("wide", false);
		ovStats.replaceChildren();
		ovStats.hidden = !statRows;
		ovStats.classList.toggle("cmp", !!(statRows && statRows.rows));
		if (statRows && statRows.rows) {
			const head = el("div", "cmp-head");
			head.append(el("span", "you", statRows.you), el("span", "", "Match stats"), el("span", "them", statRows.them));
			ovStats.append(head);
			for (const [ label, a, b, na, nb, kind ] of statRows.rows) {
				const row = el("div", "cmp-row" + (kind ? " " + kind : ""));
				const va = Number.isFinite(na) ? na : Number(a), vb = Number.isFinite(nb) ? nb : Number(b);
				const A = el("b", "", String(a)), B = el("b", "them", String(b));
				if (Number.isFinite(va) && Number.isFinite(vb) && va !== vb) { (va > vb ? A : B).classList.add("lead"); }
				row.append(A, el("span", "", label), B);
				if (kind === "poss") { const bar = el("i", "cmp-bar"); const fill = el("em"); fill.style.width = `${clamp(va, 0, 100)}%`; bar.append(fill); row.append(bar); }
				ovStats.append(row);
			}
			statRows = [];
		}
		for (const [ value, label ] of statRows || []) {
			const cell = document.createElement("div");
			const v = document.createElement("b");
			const l = document.createElement("span");
			v.textContent = value;
			l.textContent = label;
			cell.append(v, l);
			ovStats.append(cell);
		}
		overlay.hidden = false;
	}

	// Silverware: the captain lifts the trophy on the card while fireworks go up over the ground.
	let fireworks = null;
	function captainName () {
		if (!league || !league.club) { return "Your captain"; }
		const c = league.club, xi = slotsFor(league.fmt).map(i => c.squad[i]).filter(Boolean);
		const k = xi.find(pl => pl.role === "key") || xi.slice().sort((a, b) => (b.age || 0) - (a.age || 0) + (ovrOf(b) - ovrOf(a)) * 0.2)[0];
		return k ? k.name : "Your captain";
	}
	function celebrateTrophy (what) {
		const tr = $("ovTrophy");
		tr.style.setProperty("--tr-kit", KITS[0].outfield || "#f2b52e");
		$("ovTrophyText").textContent = `${captainName()} lifts the ${what}`;
		tr.hidden = false;
		startFireworks();
	}
	function startFireworks () {
		const cv = $("fireworks"), wrap = $("pitchwrap");
		if (!cv || !cv.getContext || reduceMotion) { return; }
		const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = wrap.clientWidth, H = wrap.clientHeight;
		cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.hidden = false;
		const g = cv.getContext("2d");
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		const cols = [ KITS[0].outfield || "#f2b52e", KITS[0].trim || "#ffffff", "#ffd36a", "#ffffff", "#ff6b5a", "#7fd3ff" ];
		const fw = { rockets: [], sparks: [], t0: performance.now(), next: 0, W, H, g, cv };
		if (fireworks) { cancelAnimationFrame(fireworks.raf); }
		fireworks = fw;
		const bang = (x, loud) => {
			if (!soundOn || !audio) { return; }
			const at = audio.currentTime + 0.02, pan = clamp(x / W * 2 - 1, -0.9, 0.9) * 0.7;
			noiseBurst("brown", at, 0.5, 0.18 * loud, "lowpass", 900, 120, 0.7, pan);
			for (let k = 0; k < 9; k++) { noiseBurst("white", at + 0.25 + Math.random() * 0.7, 0.05, 0.03 * loud, "highpass", 3500, 5000, 0.7, pan); }
		};
		const tick = now => {
			const el2 = now - fw.t0;
			if (el2 < 9000 && now > fw.next) {
				fw.next = now + (el2 < 400 ? 60 : 240 + Math.random() * 340);
				const x = W * (0.1 + Math.random() * 0.8);
				fw.rockets.push({ x, y: H, vx: (Math.random() - 0.5) * 1.2, vy: -(H * 0.012 + Math.random() * H * 0.006), top: H * (0.12 + Math.random() * 0.32), c: cols[Math.floor(Math.random() * cols.length)] });
				if (soundOn && audio) { const at = audio.currentTime, o = audio.createOscillator(), gg = audio.createGain(); o.type = "sine"; o.frequency.setValueAtTime(900, at); o.frequency.exponentialRampToValueAtTime(2400, at + 0.6); gg.gain.setValueAtTime(0.012, at); gg.gain.exponentialRampToValueAtTime(0.0001, at + 0.65); o.connect(gg); connectPan(gg, 0); o.start(at); o.stop(at + 0.7); }
			}
			g.globalCompositeOperation = "source-over";
			g.clearRect(0, 0, W, H);
			g.globalCompositeOperation = "lighter";
			for (const r of fw.rockets) {
				r.x += r.vx; r.y += r.vy; r.vy *= 0.985;
				g.fillStyle = "#fff3c4"; g.fillRect(r.x - 1, r.y - 1, 2.5, 6);
				if (r.y <= r.top) {
					r.dead = true;
					const n = 46 + Math.floor(Math.random() * 30), sp = 1.6 + Math.random() * 1.8;
					for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, v = sp * (0.6 + Math.random() * 0.5); fw.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.2 ? "#ffffff" : r.c }); }
					bang(r.x, 1);
				}
			}
			fw.rockets = fw.rockets.filter(r => !r.dead);
			for (const p of fw.sparks) {
				p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.vx *= 0.986; p.vy *= 0.986; p.life -= 0.009;
				g.globalAlpha = Math.max(0, p.life);
				g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, Math.PI * 2); g.fill();
			}
			g.globalAlpha = 1;
			fw.sparks = fw.sparks.filter(p => p.life > 0);
			if (el2 < 9000 || fw.sparks.length || fw.rockets.length) { fw.raf = requestAnimationFrame(tick); } else { cv.hidden = true; fireworks = null; }
		};
		fw.raf = requestAnimationFrame(tick);
	}

	let lastHud = "", lastCooling = false, lastMood = "";
	function renderMomentum () {
		const pct = Math.round(Math.abs(momentum) * 50);   // half the bar is full
		const run = passStreak[0] >= 5 ? passStreak[0] : passStreak[1] >= 5 ? -passStreak[1] : 0;
		const label = run ? `Olé · ${Math.abs(run)} passes${run > 0 ? "" : ` (${opp.short})`}`
			: surge ? (surge.team === 0 ? `${opp.short} wobbling` : "You're wobbling")
			: momentum > 0.6 ? `${opp.short} rattled`
			: momentum < -0.6 ? "You're rattled"
				: momentum > 0.25 ? "Your momentum"
					: momentum < -0.25 ? `${opp.short} momentum` : "Momentum even";
		// While a pass run is shown, the strip belongs to the side on the run, so its colour
		// and its label never disagree; a run against the tide shows as a sliver on their side.
		const youSide = run ? run > 0 : momentum >= 0;
		const w = run && (run > 0) !== (momentum >= 0) ? 4 : pct;
		const tone = run ? (run > 0 ? " home" : " away") : momentum > 0.25 ? " home" : momentum < -0.25 ? " away" : "";
		const key = `${youSide}|${w}|${label}`;
		if (key === lastMood) { return; }
		lastMood = key;
		const fill = $("mFill"), lab = $("mLabel");
		// The fill grows toward whichever side of the scoreboard is on top.
		fill.classList.toggle("cpu", !youSide);
		fill.style.width = w + "%";
		fill.style.left = (youSide === leftIsYou ? 50 - w : 50) + "%";
		lab.textContent = label;
		lab.className = "mlabel" + tone;
		const bf = $("bugFill"), bm = $("bugMood");
		if (bf && bm) {
			bf.classList.toggle("cpu", !youSide);
			bf.style.width = w + "%";
			bf.style.left = fill.style.left;
			bm.hidden = !(run || Math.abs(momentum) > 0.25);
			bm.textContent = label;
			bm.className = "bugmood" + tone;
		}
	}

	function renderModeBadge () {
		const b = $("modeBadge");
		if (mode === "tutorial") { b.textContent = "Tutorial · practice"; b.className = "modebadge tutorial"; }
		else if (mode === "corners") { b.textContent = shoot ? `Corner shootout · corner ${Math.min(shoot.n + 1, shoot.total)} of ${shoot.total}` : "Corner shootout · practice"; b.className = "modebadge practice"; }
		else if (mode === "league" && league && leagueMatch) { b.textContent = `${divisionName()} · Matchday ${leagueMatch.round + 1}`; b.className = "modebadge"; }
		else if (mode === "league") { b.textContent = divisionName(); b.className = "modebadge"; }
		else { b.textContent = "Friendly · practice (doesn't count)"; b.className = "modebadge practice"; }
	}

	// Keep the bar's Simulate button in step with the match.
	let lastSimLabel = "";
	function renderSimBtn () {
		const b = $("simBtn");
		const show = mode !== "tutorial" && mode !== "corners" && (state === "intro" || state === "play" || state === "paused" || state === "half");
		const label = !show ? "" : state === "intro" ? "Simulate match" : "Simulate rest";
		if (label === lastSimLabel) { return; }
		lastSimLabel = label;
		b.hidden = !show;
		if (show) { b.textContent = label; }
	}

	// Lower-third captions, like a broadcast: a goal, a card or a substitution, for four and a half seconds.
	let ltTimer = 0, lastCaption = null;
	function caption (tag, kind, name, sub, t) {
		if (bulkSim || mode === "tutorial") { return; }
		const el = $("lowerThird");
		if (!el) { return; }
		$("ltTag").textContent = tag; $("ltTag").className = "lt-tag " + kind;
		$("ltName").textContent = name; $("ltSub").textContent = sub;
		el.style.setProperty("--lt-kit", (KITS[t] || KITS[0]).outfield);
		el.hidden = false;
		el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
		lastCaption = { tag, kind, name, sub, at: performance.now() };
		clearTimeout(ltTimer);
		ltTimer = setTimeout(() => { el.hidden = true; }, 4500);
	}
	function renderHud () {
		renderMomentum();
		renderSimBtn();
		const p = players[ctrl];
		const cooling = !!p && p.lungeCd > 0;
		if (cooling !== lastCooling) { lastCooling = cooling; padTackle.classList.toggle("cooling", cooling); }

		const t = Math.ceil(timeLeft);
		const clock = shoot ? `C ${Math.min(shoot.n + 1, shoot.total)}/${shoot.total}` : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
		const narrow = window.innerWidth <= 640;
		const key = `${score[0]}|${score[1]}|${clock}|${narrow}`;
		if (key === lastHud) { return; }
		lastHud = key;
		scoreHomeEl.textContent = leftIsYou ? score[0] : score[1];
		scoreAwayEl.textContent = leftIsYou ? score[1] : score[0];
		clockEl.textContent = clock;
		// Broadcast codes on a narrow screen: the first three letters of each side.
		const code = n => (narrow ? (n.replace(/[^A-Za-z]/g, "").slice(0, 3) || n) : n);
		$("bugHome").textContent = code($("homeName").textContent);
		$("bugAway").textContent = code($("awayName").textContent);
		const bugScore = `${scoreHomeEl.textContent} – ${scoreAwayEl.textContent}`, bs = $("bugScore");
		if (bs.textContent !== bugScore && state === "goal") { bs.classList.remove("flash"); void bs.offsetWidth; bs.classList.add("flash"); }
		bs.textContent = bugScore;
		$("bugClock").textContent = clock;
		const tot = possFrames[0] + possFrames[1];
		const mine = tot ? Math.round(100 * possFrames[0] / tot) : 50;
		$("possLabel").textContent = leftIsYou ? `Possession ${mine}% : ${100 - mine}%` : `Possession ${100 - mine}% : ${mine}%`;
	}

