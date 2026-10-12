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
		rocket: [ "{n} lets fly from distance!", "Have a go! {n} tries his luck from range", "{n} unleashes one from way out" ]
	};
	let commAt = -1e9, commRecent = [], commTimer = 0, lastCommentary = null;
	const shortName = p => (p && (p.name || `No. ${p.num}`)) || "";
	function commentary (kind, vars, t) {
		if (bulkSim || mode === "tutorial" || shoot || replayOn() || (state !== "play" && state !== "goal")) { return false; }
		const pool = COMM[kind], el = $("commLine"), lt = $("lowerThird"), now = performance.now();
		if (!pool || !el || now - commAt < 6500 || (lt && !lt.hidden)) { return false; }   // one at a time; captions come first
		const fresh = pool.filter(s => !commRecent.includes(s)), line = fresh[Math.floor(Math.random() * fresh.length)] || pool[0];
		commRecent = [ line, ...commRecent ].slice(0, 6);
		const text = line.replace(/\{(\w)\}/g, (_, k) => vars[k] || "");
		$("commText").textContent = text;
		el.style.setProperty("--comm-kit", (KITS[t] || KITS[0]).outfield);
		el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
		commAt = now; lastCommentary = { kind, text, at: now };
		clearTimeout(commTimer);
		commTimer = setTimeout(() => { el.hidden = true; }, 4200);
		return true;
	}
	const hideCommentary = () => { const el = $("commLine"); if (el) { el.hidden = true; } clearTimeout(commTimer); };
	function moment (kind, p, o = {}) {
		if (bulkSim || !p) { return; }
		commentary(kind === "woodwork" && o.bar ? "bar" : kind, { n: shortName(p), k: shortName(o.keeper) }, p.team);
		// The player's own reaction, played out by the 3D figure (and decayed in the player tick).
		if (kind === "near" || kind === "over" || kind === "woodwork") { p.headHands = 90; }
		if (kind === "save" && o.shooter === p) { p.headHands = 70; }
		if (kind === "tackle") { p.fistPump = 50; crowdMood.excite = Math.min(1, crowdMood.excite + 0.2); if (p.team === homeSide) { crowdMood.home = Math.max(crowdMood.home, 0.6); } }
	}
