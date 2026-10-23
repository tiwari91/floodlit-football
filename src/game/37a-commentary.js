	/* ---------- the big moments ----------
	   A near miss, the woodwork, a save, a big tackle or a shot from distance: one call, moment(kind, p, o), and
	   everything that should react does. Two commentators call the match (bottom centre, one line at a
	   time, never over a goal, card or substitution caption, the speaker's name beside it): the
	   play-by-play man calls the action, and his co-commentator comes in a beat later with the analysis
	   or a bit of banter after the key moments. The player reacts (hands on his head after a near
	   miss, a fist pumped after a big tackle) and the home end lifts or groans. Fictional names. */
	const CALLERS = [ { name: "Rory Halden", short: "Halden", role: "lead" }, { name: "Tess Marlow", short: "Marlow", role: "colour" } ];
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
		red2: [ "Second yellow for {n}, and he's off", "{n} walks: a second booking, and a red", "That's two yellows, so {n} has to go" ],
		attack: [ "Here they come! {n} on the charge!", "{n} drives forward, this is dangerous!", "Oh, this looks promising! {n} into the final third!", "{n} running at them, the crowd on its feet!", "Space opening up for {n}! Can he make it count?", "Danger here! {n} bearing down!" ],
		offside: [ "Flag's up! {n} was offside", "Offside! {n} just a fraction too early", "The flag goes up against {n}!", "{n} strayed beyond the last man, and it's offside" ]
	};
	// The goal itself, called the moment it goes in (spoken; the caption shows it on screen).
	const GOAL_SHOUT = [ "GOAL! {n}! What a strike!", "It's in! It's in! {n} has scored!", "GOAL! {n} finds the net, and the place erupts!", "{n}! Oh, you beauty! GOAL!", "And {n} scores! Get in!", "GOAL! {n}, cool as you like!" ];
	// The co-commentator's word after the moment: analysis, and a bit of banter.
	const COLOUR = {
		goal: [ "Unstoppable. The keeper had no chance with that one", "Look at the movement before it, that's coaching", "That's what you pay your money for!", "Clinical. He didn't need a second invitation", "The defenders will be having words about that one", "Oh, I'm off my seat here, Rory!" ],
		near: [ "He'll be having nightmares about that one tonight", "The goal was gaping, Rory, gaping!", "Wrong side of the post, but the build-up was lovely", "That should have been the breakthrough" ],
		over: [ "Snatched at it, leaned back far too much", "Row Z is going to be busy tonight", "Head over the ball and that's in the net" ],
		save: [ "Reactions like a cat, that keeper", "Strong wrists, and a great starting position", "That's a save worth a goal, honestly", "He made himself big, and it paid off" ],
		woodwork: [ "You can't get closer than that without scoring", "The woodwork's having a better game than some out there", "The goalkeeper is very happy to see that post" ],
		bar: [ "The crossbar is still shaking!", "A few inches lower and we're talking about a wonder goal" ],
		tackle: [ "That's a defender's goal, that tackle", "Perfectly timed. You can't coach that", "Got all of the ball, and the crowd knows it" ],
		rocket: [ "Why not? Hit the target and things happen", "He fancies himself from there, and why not" ],
		attack: [ "They've got numbers forward here", "The full-back's bombing on as well, look", "This is where it gets interesting" ],
		offside: [ "Mistimed the run, he had all the time in the world", "The defensive line stepped up beautifully there", "Has to stay onside, that's basics", "Good flag. He was clearly off" ],
		red: [ "He's let his team-mates down, no question", "Rash, and he can have no complaints" ],
		red2: [ "Reckless when you're already on a booking", "The manager will not be happy with that" ],
		equaliser: [ "Game on! This has got everything", "They've deserved that, I have to say" ],
		ahead: [ "That's huge. You can feel the relief around the ground", "Now can they hold on to it?" ],
		comeback: [ "Unbelievable! I've seen it all now", "What character from this side!" ],
		lateWin: [ "Scenes! Absolute scenes!", "You simply cannot write this, Rory!" ],
		lateEq: [ "Never, ever give up. What a lesson", "They've stolen a point from the jaws of defeat!" ],
		hattrick: [ "Take a bow, son. Take a bow", "He'll sleep with that match ball tonight" ],
		own: [ "Oh, you feel for him. Nightmare", "Nothing he could do, it just hit him" ],
		flare: [ "Calm down, gents, there's a game going on", "The referee needs to get a grip of this" ]
	};
	// How excited the calls are, 0..1: the voices go up and quicken with it.
	const EXCITE = { goal: 1, lateWin: 1, lateEq: 1, hattrick: 1, equaliser: 0.95, ahead: 0.9, comeback: 1, own: 0.7, woodwork: 0.85, bar: 0.85, near: 0.8, save: 0.75, rocket: 0.7, attack: 0.65, tackle: 0.5, red: 0.6, red2: 0.6, flare: 0.6, offside: 0.4 };
	const pickFresh = (pool, recent) => { const fresh = pool.filter(s => !recent.includes(s)); return fresh[Math.floor(Math.random() * fresh.length)] || pool[Math.floor(Math.random() * pool.length)]; };
	let commAt = -1e9, commRecent = [], commTimer = 0, lastCommentary = null, lastColour = null, commKindAt = {}, colourTimer = 0, colourRecent = [], goalRecent = [];
	const shortName = p => (p && (p.name || `No. ${p.num}`)) || "";
	// Who is speaking: a small name tag ahead of the line (made here, so the markup stays as it was).
	function commWho (who) {
		const el = $("commLine");
		let w = $("commWho");
		if (!w && el) { w = document.createElement("span"); w.id = "commWho"; w.className = "comm-who"; el.insertBefore(w, $("commText")); }
		if (w) { w.textContent = CALLERS[who].short; w.dataset.role = CALLERS[who].role; }
	}
	function showCommLine (text, t, who, ms) {
		const el = $("commLine");
		commWho(who);
		$("commText").textContent = text;
		el.style.setProperty("--comm-kit", (KITS[t] || KITS[0]).outfield);
		el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
		clearTimeout(commTimer);
		commTimer = setTimeout(() => { el.hidden = true; }, ms);
	}
	function commentary (kind, vars, t, priority = false) {
		if (bulkSim || mode === "tutorial" || shoot || replayOn() || (state !== "play" && state !== "goal")) { return false; }
		const pool = COMM[kind], el = $("commLine"), lt = $("lowerThird"), now = performance.now();
		// The build-up call is filler: a real moment a second or more after it talks over it.
		const over = kind !== "attack" && lastCommentary && lastCommentary.kind === "attack" && now - commAt > 1200;
		if (!pool || !el || (now - commAt < 6500 && !priority && !over) || (lt && !lt.hidden)) { return false; }   // one at a time; captions come first
		if (commAt === -1e9) { commKindAt = {}; }   // a fresh match (or the test hook's reset)
		if (!priority && now - (commKindAt[kind] || -1e9) < 25000) { return false; }   // the same sort of line at most every 25 seconds
		commKindAt[kind] = now;
		const line = pickFresh(pool, commRecent);
		commRecent = [ line, ...commRecent ].slice(0, 6);
		const text = line.replace(/\{(\w)\}/g, (_, k) => vars[k] || "");
		showCommLine(text, t, 0, 4200);
		commAt = now; lastCommentary = { kind, text, at: now, who: CALLERS[0].name };
		if (typeof speakLine === "function") { speakLine(text, kind, 0); }
		colourAfter(kind, t, now);
		return true;
	}
	// The co-commentator, a beat after the lead: only if the lead has said nothing newer meanwhile and the
	// match is still live; otherwise the line has gone stale and is dropped.
	function colourAfter (kind, t, at, delay = 2700) {
		clearTimeout(colourTimer);
		const pool = COLOUR[kind];
		if (!pool || Math.random() >= (EXCITE[kind] || 0.4) + 0.25) { return; }
		colourTimer = setTimeout(() => {
			if (commAt !== at || bulkSim || replayOn() || (state !== "play" && state !== "goal")) { return; }
			const lt = $("lowerThird"), line = pickFresh(pool, colourRecent);
			colourRecent = [ line, ...colourRecent ].slice(0, 8);
			if (!lt || lt.hidden) { showCommLine(line, t, 1, 3800); }
			lastColour = { kind, text: line, at: performance.now(), who: CALLERS[1].name };   // kept apart, so lastCommentary stays the lead's call
			if (typeof speakLine === "function") { speakLine(line, kind, 1); }
		}, delay);
	}
	// A goal: the lead's shout the moment it goes in (the caption has the screen), the co-commentator's word after.
	function goalShout (name, t) {
		const line = pickFresh(GOAL_SHOUT, goalRecent);
		goalRecent = [ line, ...goalRecent ].slice(0, 3);
		const text = line.replace(/\{n\}/g, name || "What a goal");
		if (typeof speakLine === "function") { speakLine(text, "goal", 0); }
		colourAfter("goal", t, commAt, 3600);
		return text;
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
	let commSeen = 0, commWait = null, commAttack = -1;
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
		// The build-up: a side carrying the ball into the final third gets a call (once a spell of possession).
		const o = ball && ball.owner;
		if (o && (o.team !== commAttack || rel(o.team, ball.x) < FW * 0.5)) { commAttack = -1; }   // re-armed when the other side has it, or it's back in their own half
		if (o && o.role !== "gk" && state === "play" && freeze <= 0 && commAttack !== o.team && rel(o.team, ball.x) > FW * 0.7 && Math.abs(ball.y - FH / 2) < FH * 0.38) {
			commAttack = o.team;
			commentary("attack", { n: shortName(o) }, o.team);
		}
		const log = typeof matchLog !== "undefined" && Array.isArray(matchLog) ? matchLog : null;
		if (!log) { return; }
		if (log.length < commSeen) { commSeen = 0; commWait = null; }   // a new match
		for (; commSeen < log.length; commSeen++) {
			const e = log[commSeen];
			if (e.kind === "goal" && state === "goal" && commSeen === log.length - 1) { goalShout(String(e.text || "").replace(/ \(.*$/, ""), e.team); }   // only a goal just scored, not a restored log
			if (e.kind === "goal") { const g = goalCall(log, commSeen); if (g) { commWait = { kind: g.kind, n: g.name, team: e.kind === "goal" && g.kind === "own" ? 1 - e.team : e.team, until: performance.now() + 14000 }; } }
			else if (e.kind === "red") { commWait = { kind: /second yellow/.test(e.text) ? "red2" : "red", n: e.text.replace(/ \(.*\)$/, ""), team: e.team, until: performance.now() + 12000 }; }
		}
		if (commWait) {
			if (performance.now() > commWait.until) { commWait = null; return; }
			if (commentary(commWait.kind, { n: commWait.n, m: commWait.m }, commWait.team, true)) { commWait = null; }
		}
	}
