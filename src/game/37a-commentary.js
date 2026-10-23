	/* ---------- the big moments ----------
	   A near miss, the woodwork, a save, a big tackle or a shot from distance: one call, moment(kind, p, o), and
	   everything that should react does. The commentator gets a line (bottom centre, one at a time,
	   never over a goal, card or substitution caption), the player reacts (hands on his head after
	   a near miss, a fist pumped after a big tackle) and the home end lifts or groans. */
	const COMM = {
		near: [ "{n} drags it just wide!", "Inches wide from {n}!", "So close! {n} will be kicking himself", "Whistles past the post! {n} so nearly had it", "Off target, but only just, from {n}" ],
		over: [ "{n} gets under it and it flies over", "Just over the bar from {n}!", "{n} leans back and it clears the crossbar", "High and handsome from {n}, but over" ],
		save: [ "What a save from {k}!", "{k} gets down well to keep out {n}", "{k} stands tall and denies {n}", "Strong hands from {k}", "{n} thought that was in, but {k} says no" ],
		tackle: [ "Superb tackle from {n}!", "{n} slides in and takes the ball clean", "Timed to perfection by {n}", "Brilliant defending from {n}", "{n} wins it back, and the crowd loves it" ],
		woodwork: [ "Off the post! {n} so nearly had it", "{n} hits the woodwork!", "Oh, the frame of the goal! {n} denied by the post", "Clang! {n} strikes the upright" ],
		bar: [ "{n} rattles the crossbar!", "Off the bar! {n} was inches away", "Crossbar! {n} can't believe it" ],
		lateWin: [ "Late, late drama! That could be the winner from {n}!", "{n} at the death! Surely that's the winner", "Late, late drama! {n} has broken their hearts" ],
		lateEq: [ "Late, late drama! {n} levels it!", "{n} pulls them level at the death!", "Never say never! {n} with the late equaliser" ],
		hattrick: [ "A hat-trick for {n}! He'll want the match ball", "That's three for {n}! What a performance" ],
		rocket: [ "{n} lets fly from distance!", "Have a go! {n} tries his luck from range", "{n} unleashes one from way out" ],
		equaliser: [ "And they're level! {n} with the equaliser", "{n} brings them back into it, all square", "Game on! {n} levels it", "That's the equaliser, and {n} has done it" ],
		ahead: [ "{n} puts them in front!", "The lead, and it's {n} who takes it", "{n} breaks the deadlock at last", "Now they're ahead, through {n}" ],
		comeback: [ "What a comeback! {n} completes the turnaround", "From two down to this! {n} has done it", "They were dead and buried, and {n} has brought them back" ],
		own: [ "Oh no, {n} turns it into his own net", "An own goal! {n} won't want to see that again", "Disaster for {n}, into his own net" ],
		red: [ "{n} is off! Straight red, and no complaints", "Red card! {n} has let his side down there", "Off he goes, {n} sent off" ],
		flare: [ "Tempers flare! {n} and {m} go nose to nose", "{n} isn't having that. He's straight in the face of {m}", "Handbags! {n} and {m} have to be pulled apart", "It's all kicking off. {n} squares up to {m}" ],
		red2: [ "Second yellow for {n}, and he's off", "{n} walks: a second booking, and a red", "That's two yellows, so {n} has to go" ]
	};
	let commAt = -1e9, commRecent = [], commTimer = 0, lastCommentary = null, commKindAt = {};
	const shortName = p => (p && (p.name || `No. ${p.num}`)) || "";
	function commentary (kind, vars, t, priority = false) {
		if (bulkSim || mode === "tutorial" || shoot || replayOn() || (state !== "play" && state !== "goal")) { return false; }
		const pool = COMM[kind], el = $("commLine"), lt = $("lowerThird"), now = performance.now();
		if (!pool || !el || (now - commAt < 6500 && !priority) || (lt && !lt.hidden)) { return false; }   // one at a time; captions come first
		if (commAt === -1e9) { commKindAt = {}; }   // a fresh match (or the test hook's reset)
		if (!priority && now - (commKindAt[kind] || -1e9) < 25000) { return false; }   // the same sort of line at most every 25 seconds
		commKindAt[kind] = now;
		const fresh = pool.filter(s => !commRecent.includes(s)), line = fresh[Math.floor(Math.random() * fresh.length)] || pool[0];
		commRecent = [ line, ...commRecent ].slice(0, 6);
		const text = line.replace(/\{(\w)\}/g, (_, k) => vars[k] || "");
		$("commText").textContent = text;
		el.style.setProperty("--comm-kit", (KITS[t] || KITS[0]).outfield);
		el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
		commAt = now; lastCommentary = { kind, text, at: now };
		if (typeof speakLine === "function") { speakLine(text, kind); }
		clearTimeout(commTimer);
		commTimer = setTimeout(() => { el.hidden = true; }, 4200);
		return true;
	}
	const hideCommentary = () => { const el = $("commLine"); if (el) { el.hidden = true; } clearTimeout(commTimer); };
	function moment (kind, p, o = {}) {
		if (bulkSim || !p) { return false; }
		const said = commentary(kind === "woodwork" && o.bar ? "bar" : kind, { n: shortName(p), k: shortName(o.keeper) }, p.team, !!o.priority);
		// The player's own reaction, played out by the 3D figure (and decayed in the player tick).
		if (kind === "near" || kind === "over" || kind === "woodwork") { p.headHands = 90; }
		if (kind === "woodwork" || kind === "save") { gasp(kind === "save" && o.shooter ? o.shooter.team : p.team); }
		if (kind === "save" && o.shooter === p) { p.headHands = 70; }
		if (kind === "tackle" && typeof flareTackle === "function") { flareTackle(p); }
		if (kind === "tackle") { p.fistPump = 50; crowdMood.excite = Math.min(1, crowdMood.excite + 0.2); if (p.team === homeSide) { crowdMood.home = Math.max(crowdMood.home, 0.6); } }
		return said;
	}

	// The match log as the commentator follows it: a goal that levels it, puts a side in front late on
	// or finishes a comeback from two down, an own goal and a sending-off each get a line once the
	// caption has gone. The late winner and equaliser and the hat-trick are called by the celebration.
	let commSeen = 0, commWait = null;
	function goalCall (log, i) {
		const e = log[i], g = [ 0, 0 ];
		let worst = 0;
		for (let k = 0; k < i; k++) { if (log[k].kind === "goal") { g[log[k].team]++; worst = Math.min(worst, g[e.team] - g[1 - e.team]); } }
		const before = g[e.team] - g[1 - e.team], after = before + 1;
		const own = / \(own goal\)$/.test(e.text), name = e.text.replace(/ \((header|own goal)\)$/, "");
		const goals = log.slice(0, i + 1).filter(x => x.kind === "goal" && x.team === e.team && x.text.replace(/ \(header\)$/, "") === name).length;
		if (own) { return { kind: "own", name }; }
		if (e.min >= 80 && (before === 0 || before === -1)) { return null; }   // the celebration has it
		if (goals === 3) { return null; }
		if (worst <= -2 && after >= 0) { return { kind: "comeback", name }; }
		if (before === -1) { return { kind: "equaliser", name }; }
		if (before === 0 && e.min >= 60) { return { kind: "ahead", name }; }
		return null;
	}
	function commTick () {
		if (typeof flareTick === "function") { flareTick(); }
		if (typeof voiceTick === "function") { voiceTick(); }
		const log = typeof matchLog !== "undefined" && Array.isArray(matchLog) ? matchLog : null;
		if (!log) { return; }
		if (log.length < commSeen) { commSeen = 0; commWait = null; }   // a new match
		for (; commSeen < log.length; commSeen++) {
			const e = log[commSeen];
			if (e.kind === "goal") { const g = goalCall(log, commSeen); if (g) { commWait = { kind: g.kind, n: g.name, team: e.kind === "goal" && g.kind === "own" ? 1 - e.team : e.team, until: performance.now() + 14000 }; } }
			else if (e.kind === "red") { commWait = { kind: /second yellow/.test(e.text) ? "red2" : "red", n: e.text.replace(/ \(.*\)$/, ""), team: e.team, until: performance.now() + 12000 }; }
		}
		if (commWait) {
			if (performance.now() > commWait.until) { commWait = null; return; }
			if (commentary(commWait.kind, { n: commWait.n, m: commWait.m }, commWait.team, true)) { commWait = null; }
		}
	}
