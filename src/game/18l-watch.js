	/* ---------- watch a match ----------
	   Any other fixture of the coming matchday can be watched live from the League panel: the home side takes
	   your seat (its name, kit, ground and players), the visitors the other, the computer plays both, and nothing
	   is recorded (the league plays that fixture out as it always does). Your own identity is put back at full
	   time, and never saved while it is lent out. */
	// watchFix ({ h, a, you, club, auto, done }) is declared in 09-state: saving reads it at load, before this runs.
	const WATCH_KEYS = [ "name", "short", "color", "color2", "text", "ground", "surface", "pattern", "gk" ];
	function watchLend (on) {   // swap your identity for the home side's (on) or back (off)
		const W = watchFix;
		if (!W) { return; }
		if (on) { const h = TEAMS[W.h]; for (const k of WATCH_KEYS) { if (h[k] === undefined) { delete YOU[k]; } else { YOU[k] = h[k]; } } }
		else { for (const k of WATCH_KEYS) { if (W.you[k] === undefined) { delete YOU[k]; } else { YOU[k] = W.you[k]; } } }
	}
	function startWatch (h, a) {
		if (!league || !TEAMS[h] || !TEAMS[a] || h === 0 || a === 0) { return false; }
		if (state === "play" || state === "paused" || state === "half" || state === "goal") { toast("Finish your match first", "#f2b52e"); return false; }
		const you = {}; for (const k of WATCH_KEYS) { you[k] = YOU[k]; }
		const str = getStr(h), base = cpuOvr(str);
		watchFix = { h, a, you, auto: autoPilot, done: false,
			club: { squad: cpuSquad(h, str), bench: BENCH_POS.map((pos, i) => genPlayer(pos, base - 5 + (i % 3))), upgrades: { training: 0, coaching: 0, defence: 0 }, staff: {}, drill: 30 } };
		autoPilot = true;
		clearLive();
		state = "intro"; newMatch(); showIntro(); renderLeague();
		try { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); }
		return true;
	}
	// At the next match (or a new season), your club is yours again.
	function endWatch () {
		if (!watchFix) { return; }
		watchLend(false);
		autoPilot = watchFix.auto;
		watchFix = null;
	}
	const watching = () => !!watchFix;
	// The other fixtures of the coming matchday, with a Watch button each (in the League panel's next-match card).
	function watchList (box, round) {
		const fx = league && league.fixtures && league.fixtures[round];
		if (!fx) { return; }
		const others = fx.filter(([ x, y ]) => x !== 0 && y !== 0);
		if (!others.length) { return; }
		box.append(el("span", "eyebrow watch-head", "Also this matchday · watch live"));
		const ul = el("ul", "watch-list");
		for (const [ x, y ] of others) {
			const li = el("li"), b = el("button", "", "Watch");
			b.type = "button"; b.addEventListener("click", () => startWatch(x, y));
			const who = el("span", "who"); who.append(dotFor(TEAMS[x]), document.createTextNode(` ${TEAMS[x].name} v ${TEAMS[y].name} `), dotFor(TEAMS[y]));
			li.append(who, b); ul.append(li);
		}
		box.append(ul);
	}
