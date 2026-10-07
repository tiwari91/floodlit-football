	/* ---------- how to play ----------
	   One screen with every control, for the keyboard, touch or a controller, and what the
	   markers on the pitch mean. H opens it any time (and pauses the match). */
	const HOWTO = {
		keys: { move: "← ↑ → ↓", sprint: "E", pass: "S", through: "W", long: "Q", shoot: "D", tackle: "A", switch: "S / Tab", tactic: "1 – 4", pause: "P", cam: "C", big: "F", help: "H" },
		touch: { move: "Joystick", sprint: "Sprint", pass: "Pass", through: "Through", long: "Long", shoot: "Shoot", tackle: "Tackle", switch: "Pass", tactic: "Tactic", pause: "Pause", cam: "Camera", big: "Big pitch", help: "How to play" },
		pad: { move: "Left stick", sprint: "RT / LT", pass: "A / ✕", through: "Y / △", long: "RB / R1", shoot: "B / ○", tackle: "X / □", switch: "A / ✕", tactic: "D-pad ↑ ↓", pause: "Start", cam: "Camera", big: "F", help: "H" }
	};
	let howScheme = coarse ? "touch" : "keys", howtoReturn = null;
	function renderHowto () {
		const K = HOWTO[howScheme], hold = howScheme === "touch" ? "hold the pad" : "hold it";
		const row = (key, title, text) => `<div class="how-row"><kbd>${key}</kbd><div><b>${title}</b><span>${text}</span></div></div>`;
		const sec = (title, rows) => `<section><h3>${title}</h3>${rows.join("")}</section>`;
		$("howtoBody").innerHTML = [   // static copy; no user data
			sec("With the ball", [
				row(K.move, "Move", "Run with the ball. Your player is the one in the amber ring, with his name above him."),
				row(K.pass, "Pass", "To the teammate in the dashed amber ring. It avoids opponents in the way, and the receiver runs onto it."),
				row(K.through, "Through ball", "Into the space ahead of a runner, toward goal."),
				row(K.long, "Long ball", "To the striker marked Q, lofted over anyone in the way. From out wide it becomes a bending cross into the box; central and in range of goal it chips the keeper."),
				row(K.shoot, "Shoot", `Tap for a quick shot; ${hold} for power. While holding, ${howScheme === "keys" ? "↑ ↓ move" : howScheme === "pad" ? "the stick moves" : "the joystick moves"} the crosshair along the goal; the amber band shows how far it could stray.`),
				row(`${K.pass} / ${K.through} / ${K.long}`, "Charged passes", `${cap(hold)} to charge a pass: an arrow points where it is going and a power bar fills under your player. A tap rolls it softly to feet; a full charge drives it, and a through ball goes further into space. It is played when you let go.`),
				row(K.sprint, "Sprint", "Hold while moving. The bar under your player is what is left; run it dry and he jogs until it refills.")
			]),
			sec("Without the ball", [
				row(K.tackle, "Tackle", `Alongside the carrier: a shoulder challenge. From further out: a slide. ${cap(hold)} from further away and your man closes him down and jockeys him for you.`),
				row(K.switch, "Switch player", `To the teammate under the S marker (the defender best placed to win it). Press again for the next best.${howScheme === "keys" ? " Tab does the same at any moment; with the ball in the air it picks whoever is nearest where it will land." : ""}`),
				row(K.sprint, "Sprint", "Close the carrier down faster; the same bar drains."),
				row(`${K.shoot} / ${K.pass} / ${K.long}`, "A ball in the air", "Coming down to your man: head it at goal, nod it on to a teammate, or head it clear.")
			]),
			sec("Line-up", [
				row(howScheme === "touch" ? "Drag" : "Drag / click", "Pick your side", "The squad panel draws your line-up on a pitch. Drag a player onto another position, or between the pitch and the bench, to swap them; or tap one and then another."),
				row("4-4-2 …", "Formation presets", "The buttons above the pitch move everyone into that shape at once. A player in the wrong position is marked, and a warning counts how many are out of position.")
			]),
			sec("Corners", [
				row(K.pass, "Near post", "An in-swinger whipped at the near post; your runners attack their zones as it is struck."),
				row(K.long, "Far post", "An out-swinger floated to the back post."),
				row(K.through, "Penalty spot", "Dropped on the spot for a runner arriving late. Corner shootout (the fourth mode button) is five corners each, a goal a point.")
			]),
			sec("Free kicks and penalties", [
				row(K.through, "Curl it over the wall", "In range of goal the wall stands 9.15 m off. The ball rises over it, bends round its end towards the corner you lean to and dips under the bar."),
				row(K.shoot, "Drive it low", "A hard shot instead; the wall may block it."),
				row(K.pass, "Lay it off", "A teammate stands beside the ball: roll it to him for a shot. An indirect free kick (after offside or obstruction) must touch someone else before it can go in."),
				row(K.move, "Penalties", "Lean up or down to pick a side (the crosshair shows it), then shoot. On theirs, hold up or down as it's struck to send your keeper that way. A save can be pushed back out, so follow it in.")
			]),
			sec("Any time", [
				row(K.tactic, "Tactic", `${howScheme === "keys" ? "1 Defensive, 2 Balanced, 3 Attacking, 4 All-out attack (T cycles)" : "Cycle Defensive, Balanced, Attacking, All-out attack"}. The tag at the top left of the pitch shows the current one.`),
				row(K.pause, "Pause", "The clock stops. The pause card has the camera, sound and switching settings, your line and tackling instructions, substitutions, and Simulate the rest."),
				row(K.cam, "Camera", "Overhead, TV or 3D. The one you pick is remembered. Graphics (Low, Medium, High) under the pitch or on the pause card sets how much the 3D view draws. After a goal in 3D there is a replay; any key or tap skips it."),
				row(howScheme === "touch" ? "Replay" : howScheme === "pad" ? "Back / Share" : "R", "Replay", "The last six seconds again, a little slower, with the clock stopped. Any key or tap ends it. Goals, parries and clearances off the line also go into slow motion for a moment."),
				row(K.big, "Big pitch", "The ground fills the screen with a small score bug; Show menu brings the page back."),
				row(K.help, "How to play", "This screen.")
			]),
			`<section><h3>Reading the pitch</h3><ul class="how-legend">
				<li><i style="border-color:#f2b52e;background:rgba(242,181,46,0.25)"></i>Amber ring, arrow and name: the player you control</li>
				<li><i style="border-color:#f2b52e;border-style:dashed"></i>Dashed amber ring: who your pass will reach</li>
				<li><i style="border-color:#fff;border-style:dashed"></i>White dashed ring with an S: who Switch will give you</li>
				<li><i style="border-color:#f2b52e;border-width:3px"></i>Amber arc round your player: shot power while you hold Shoot (also the bar at the bottom)</li>
				<li><i style="border-color:rgba(255,255,255,0.4);border-width:3px"></i>Grey arc: tackle recharging</li>
				<li><i style="border-color:#de4f5a;border-radius:2px;height:4px;border-width:2px 0 0"></i>Red dashed line: the offside line while you have the ball; OFF marks anyone beyond it</li>
			</ul></section>`
		].join("");
		for (const [ id, s ] of [ [ "howKeys", "keys" ], [ "howTouch", "touch" ], [ "howPad", "pad" ] ]) { $(id).setAttribute("aria-pressed", String(howScheme === s)); }
	}
	function openHowto () {
		if (!$("howto").hidden) { return; }
		if (padOn) { howScheme = "pad"; } else if (coarse) { howScheme = "touch"; }
		howtoReturn = document.activeElement;
		if (state === "play") { pause(); }
		renderHowto();
		$("howto").hidden = false;
		$("howtoClose").focus();
		store.set("ff-howto", "1");
	}
	function closeHowto () {
		if ($("howto").hidden) { return; }
		$("howto").hidden = true;
		if (howtoReturn && typeof howtoReturn.focus === "function" && document.contains(howtoReturn)) { howtoReturn.focus(); }
		howtoReturn = null;
	}
	$("howtoBtn").addEventListener("click", e => { e.currentTarget.blur(); openHowto(); });
	$("ovHelp").addEventListener("click", () => openHowto());
	$("howtoClose").addEventListener("click", closeHowto);
	$("howtoDone").addEventListener("click", closeHowto);
	$("howto").addEventListener("click", e => { if (e.target === e.currentTarget) { closeHowto(); } });
	for (const [ id, s ] of [ [ "howKeys", "keys" ], [ "howTouch", "touch" ], [ "howPad", "pad" ] ]) { $(id).addEventListener("click", () => { howScheme = s; renderHowto(); }); }

	// The keys on the kick-off card, for a player's first three matches.
	const playedCount = () => Number(store.get("ff-played") || 0) || 0;
	function renderKeyStrip () {
		const el = $("ovKeys");
		if (playedCount() >= 3 || mode === "tutorial") { el.hidden = true; return; }
		const items = padOn
			? [ [ "Stick", "Move" ], [ "A", "Pass" ], [ "Y", "Through" ], [ "B", "Shoot, hold" ], [ "RB", "Long" ], [ "X", "Tackle" ], [ "RT", "Sprint" ] ]
			: coarse
				? [ [ "Joystick", "Move" ], [ "Pass", "to the ringed teammate" ], [ "Shoot", "hold for power" ], [ "Tackle", "tap or hold" ], [ "Through", "runner" ], [ "Long", "striker" ], [ "Sprint", "hold" ] ]
				: [ [ "← ↑ → ↓", "Move" ], [ "S", "Pass" ], [ "W", "Through" ], [ "D", "Shoot, hold" ], [ "Q", "Long" ], [ "A", "Tackle" ], [ "E", "Sprint" ], [ "H", "How to play" ] ];
		el.replaceChildren(...items.map(([ key, label ]) => {
			const s = document.createElement("span"), kb = document.createElement("kbd");
			kb.textContent = key; s.append(kb, document.createTextNode(label));
			return s;
		}));
		el.hidden = false;
	}

	// Quick settings on the pause and half-time cards: each one is the bar's own button,
	// so there is one source of truth for every setting.
	function renderQuick () {
		const q = $("ovQuick");
		const items = [
			[ `Tactic: ${MENTALITY[mentality[0] + 1]}`, false, () => setMentality(0, mentality[0] >= 2 ? -1 : mentality[0] + 1, false) ],
			[ LINES[line[0]], false, () => { const ks = Object.keys(LINES), sel = $("line"); sel.value = ks[(ks.indexOf(line[0]) + 1) % ks.length]; sel.dispatchEvent(new Event("change")); } ],
			[ TACKLING[tackling[0]], false, () => { const ks = Object.keys(TACKLING), sel = $("tackling"); sel.value = ks[(ks.indexOf(tackling[0]) + 1) % ks.length]; sel.dispatchEvent(new Event("change")); } ],
			[ $("camBtn").textContent, false, () => $("camBtn").click() ],
			[ AUTO_SWITCH[autoSwitchMode], false, () => { const keys = Object.keys(AUTO_SWITCH); autoSwitchSel.value = keys[(keys.indexOf(autoSwitchMode) + 1) % keys.length]; autoSwitchSel.dispatchEvent(new Event("change")); } ],
			[ soundOn ? "Sound on" : "Sound off", soundOn, () => soundBtn.click() ],
			[ musicOn ? "Music on" : "Music off", musicOn, () => $("musicBtn").click() ],
			[ hintsOn ? "Hints on" : "Hints off", hintsOn, () => $("hintsBtn").click() ],
			[ highContrast ? "Kit contrast on" : "Kit contrast off", highContrast, () => $("contrastBtn").click() ],
			[ `Graphics: ${GFX_NAME[gfxLevel]}`, false, () => { const ks = Object.keys(GFX3); setGfx(ks[(ks.indexOf(gfxLevel) + 1) % ks.length], true); } ]
		];
		q.replaceChildren(...items.map(([ label, on, act ]) => {
			const b = document.createElement("button");
			b.type = "button"; b.textContent = label; b.className = on ? "on" : "";
			b.addEventListener("click", () => { act(); fx = fx.filter(f => !f.toast); renderQuick(); });
			return b;
		}));
		q.hidden = false;
	}

	$("musicBtn").addEventListener("click", e => {
		musicOn = !musicOn;
		e.currentTarget.textContent = musicOn ? "Music on" : "Music off";
		e.currentTarget.setAttribute("aria-pressed", String(musicOn));
		e.currentTarget.blur();
		store.set("ff-music", musicOn ? "1" : "0");
	});
	soundBtn.addEventListener("click", () => {
		soundOn = !soundOn;
		soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
		soundBtn.setAttribute("aria-pressed", String(soundOn));
		store.set("ff-sound", soundOn ? "1" : "0");
	});
	for (const [ sel, key ] of [ [ weatherSel, "ff-weather" ], [ groundSel, "ff-ground" ] ]) {
		sel.addEventListener("change", () => {
			store.set(key, sel.value);
			if (state === "intro" || state === "full") { newMatch(); if (state === "intro") { showIntro(); } }
			updateNextNote();
			sel.blur();
		});
	}
	// Difficulty: kept with the season in the league, and remembered for friendlies and new leagues.
	function applyLevel () {
		const k = mode === "league" && league ? (LEVELS[league.level] ? league.level : "normal") : (LEVELS[store.get("ff-level")] ? store.get("ff-level") : "normal");
		levelSel.value = k;
		lv = LEVELS[k];
	}
	levelSel.addEventListener("change", () => {
		const k = LEVELS[levelSel.value] ? levelSel.value : "normal";
		store.set("ff-level", k);
		if (mode === "league" && league) { league.level = k; saveLeague(); }
		lv = LEVELS[k];
		if (state === "intro") { showIntro(); }
		levelSel.blur();
	});
	diffSel.addEventListener("change", () => {
		diff = DIFF[diffSel.value] || DIFF.normal;
		store.set("ff-diff", diffSel.value);
		diffSel.blur();
	});
	lenSel.addEventListener("change", () => {
		store.set("ff-len", lenSel.value);
		if (state === "intro" || state === "full") { matchLen = timeLeft = Number(lenSel.value); lastHud = ""; renderHud(); }
		updateNextNote();
		lenSel.blur();
	});
	// Team instructions take effect at once, even mid-match.
	for (const [ sel, key ] of [ [ styleSel, "ff-style" ], [ pressSel, "ff-press" ], [ $("line"), "ff-line" ], [ $("tackling"), "ff-tackling" ] ]) {
		sel.addEventListener("change", () => {
			store.set(key, sel.value);
			readInstructions();
			if (state === "play" || state === "goal") { toast(sel.id === "line" ? LINES[line[0]] : sel.id === "tackling" ? TACKLING[tackling[0]] : `${STYLES[style[0]]} · ${PRESSES[press[0]]}`, "#f2b52e"); }
			sel.blur();
		});
	}
	autoSwitchSel.addEventListener("change", () => {
		autoSwitchMode = AUTO_SWITCH[autoSwitchSel.value] ? autoSwitchSel.value : "assisted";
		store.set("ff-autoswitch", autoSwitchMode);
		if (state === "play" || state === "goal" || state === "paused") { toast(AUTO_SWITCH[autoSwitchMode], "#f2b52e"); }
		autoSwitchSel.blur();
	});
	shapeSel.addEventListener("change", () => {
		const fmt = currentFmt();
		if (SHAPES[fmt] && (SHAPES[fmt][shapeSel.value] || shapeSel.value === "auto")) { shapePref[fmt] = shapeSel.value; store.set("ff-shape-" + fmt, shapeSel.value); }
		if ((state === "play" || state === "paused" || state === "goal") && fmt === fmtKey) {
			const key = shapeKeyOf(fmt, mentality[0]);
			if (key !== teamShape[0]) { reshape(0, key); toast(`Formation: ${SHAPES[fmt][key].label.split(" ")[0]}`, "#f2b52e"); }
		}
		if (state === "intro" || state === "full") { newMatch(); if (state === "intro") { showIntro(); } }
		if (league) { renderLeague(); }
		updateNextNote();
		shapeSel.blur();
	});
	fmtSel.addEventListener("change", () => {
		store.set("ff-fmt", fmtSel.value);
		// In the league the season switches format now; results so far stand, and the
		// next fixture is played in the new format (a match in progress finishes in the old one).
		if (mode === "league" && league && FORMATS[fmtSel.value]) {
			league.fmt = fmtSel.value;
			saveLeague();
			renderLeague();
		}
		if (state === "intro" || state === "full") { newMatch(); if (state === "intro") { showIntro(); } }
		renderShapes();
		updateNextNote();
		fmtSel.blur();
	});

	// A clicked button keeps focus, and Space (pass) would then press it again.
	for (const b of [ ovButton, pauseBtn, restartBtn, soundBtn ]) {
		b.addEventListener("click", () => b.blur());
	}

	// Browsers only allow sound after the viewer does something: start it on the first touch or key.
	const unlockAudio = () => { ensureAudio(); if (audio && audio.state === "suspended") { audio.resume(); } };
	document.addEventListener("pointerdown", unlockAudio, { once: true });
	document.addEventListener("keydown", unlockAudio, { once: true });

	window.addEventListener("resize", resize);
	document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); saveLive(); } });
	window.addEventListener("pagehide", saveLive);

