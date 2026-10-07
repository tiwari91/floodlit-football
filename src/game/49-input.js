	/* ---------- input ---------- */
	const GAME_KEYS = new Set([ "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyS", "KeyD", "KeyW", "KeyQ", "KeyE", "KeyT", "Digit1", "Digit2", "Digit3", "Digit4", "Tab" ]);

	window.addEventListener("keydown", e => {
		if (e.target instanceof HTMLSelectElement) { return; }
		if (!$("howto").hidden) {
			if (e.code === "Escape" || e.code === "KeyH" || e.key === "?") { e.preventDefault(); closeHowto(); }
			return;
		}
		if (e.code === "KeyH" || e.key === "?") { if (!e.repeat) { openHowto(); } return; }
		if (odr) { e.preventDefault(); if (!e.repeat) { endOdr(); } return; }   // any key ends a replay
		if (e.code === "KeyR" && state === "play" && !e.repeat) { e.preventDefault(); startOdr(); return; }
		if (e.code === "KeyP" || e.code === "Escape") {
			if (state === "play") { pause(); } else if (state === "paused") { startPlay(); }
			return;
		}
		if ((state === "play" || state === "goal") && GAME_KEYS.has(e.code)) { e.preventDefault(); }
		if (e.repeat) { return; }
		if (e.code === "KeyC") { setCam(nextCam(), true); toast(CAM_NAME[camMode], "#f2b52e"); return; }
		if (e.code === "KeyF") { setBig(!(document.body && document.body.classList.contains("big"))); return; }
		padOn = false;
		keys.add(e.code);
		// Tactics change any time the match is on, even at a set piece.
		if ((state === "play" || state === "goal") && /^Digit[1-4]$/.test(e.code)) { setMentality(0, Number(e.code.slice(5)) - 2); }
		if ((state === "play" || state === "goal") && e.code === "KeyT") { setMentality(0, mentality[0] >= 2 ? -1 : mentality[0] + 1); }
		if (state === "goal" && GAME_KEYS.has(e.code)) { skipCelebration(); }
		if (state !== "play" || freeze > 0) { return; }
		if (e.code === "KeyS" || e.code === "Space") { passPress("pass"); }
		if (e.code === "KeyD") { humanShootPress(); }
		if (e.code === "KeyA") { pressHeld = true; humanTackle(); }
		if (e.code === "KeyW") { passPress("through"); }
		if (e.code === "KeyQ") { passPress("long"); }
		if (e.code === "Tab" && ball.owner !== human()) { switchToNearest(true); }   // switch player: cycles to the next best placed
	});

	window.addEventListener("keyup", e => {
		keys.delete(e.code);
		if (e.code === "KeyD") { humanShootRelease(); }
		if (e.code === "KeyS" || e.code === "Space") { passRelease("pass"); }
		if (e.code === "KeyW") { passRelease("through"); }
		if (e.code === "KeyQ") { passRelease("long"); }
		if (e.code === "KeyA") { pressHeld = false; }
	});

	window.addEventListener("blur", () => { keys.clear(); charging = false; passCharge = null; padSprint = false; pressHeld = false; touchPress = false; });

	// Touch joystick
	const stick = $("stick"), knob = $("knob");
	let stickId = null;
	function stickMove (e) {
		const r = stick.getBoundingClientRect();
		let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
		const max = r.width / 2 - 14, d = Math.hypot(dx, dy);
		if (d > max) { dx = dx / d * max; dy = dy / d * max; }
		knob.style.transform = `translate(${dx}px, ${dy}px)`;
		stickVec.x = dx / max; stickVec.y = dy / max;
	}
	stick.addEventListener("pointerdown", e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
	stick.addEventListener("pointermove", e => { if (e.pointerId === stickId) { stickMove(e); } });
	const stickEnd = e => {
		if (e.pointerId !== stickId) { return; }
		stickId = null; stickVec.x = stickVec.y = 0; knob.style.transform = "";
	};
	stick.addEventListener("pointerup", stickEnd);
	stick.addEventListener("pointercancel", stickEnd);

	// Tackle: a tap slides (or shoulders) as before; holding it is the press assist.
	padTackle.addEventListener("pointerdown", e => { e.preventDefault(); skipCelebration(); touchPress = true; humanTackle(); });
	for (const ev of [ "pointerup", "pointercancel", "pointerleave" ]) { padTackle.addEventListener(ev, () => { touchPress = false; }); }
	for (const [ id, kind ] of [ [ "padPass", "pass" ], [ "padLong", "long" ], [ "padThrough", "through" ] ]) {
		const b = $(id);
		b.addEventListener("pointerdown", e => { e.preventDefault(); skipCelebration(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } if (state === "play" && freeze <= 0) { passPress(kind); } });
		b.addEventListener("pointerup", () => passRelease(kind));
		b.addEventListener("pointercancel", () => { passCharge = null; });
	}
	$("bcLineups").addEventListener("pointerdown", e => { e.stopPropagation(); hideLineups(); });
	$("padReplay").addEventListener("pointerdown", e => { e.preventDefault(); if (odr) { endOdr(); } else { startOdr(); } });
	$("padTactic").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play" || state === "goal") { setMentality(0, mentality[0] >= 2 ? -1 : mentality[0] + 1); } });
	$("padShoot").addEventListener("pointerdown", e => { e.preventDefault(); skipCelebration(); humanShootPress(); });
	$("pitchwrap").addEventListener("pointerdown", e => { if (odr && !(e.target.closest && e.target.closest("#padReplay"))) { endOdr(); } skipCelebration(); });
	$("padShoot").addEventListener("pointerup", () => humanShootRelease());
	$("padShoot").addEventListener("pointercancel", () => { charging = false; });
	$("padSprint").addEventListener("pointerdown", e => { e.preventDefault(); padSprint = true; });
	for (const ev of [ "pointerup", "pointercancel", "pointerleave" ]) {
		$("padSprint").addEventListener(ev, () => { padSprint = false; });
	}

	ovButton.addEventListener("click", startPlay);
	$("autoPick").addEventListener("click", e => { e.currentTarget.blur(); if (league && league.club) { autoPick(); } });
	$("clubsDiv").addEventListener("click", e => { e.currentTarget.blur(); clubsView = "div"; openClub = null; renderClubs(); });
	$("clubsBelow").addEventListener("click", e => { e.currentTarget.blur(); clubsView = "below"; openClub = null; renderClubs(); });
	$("autoRot").addEventListener("click", e => {
		e.currentTarget.blur();
		if (!league || !league.club) { return; }
		league.club.autoRotate = !league.club.autoRotate;
		store.set("ff-autorot", league.club.autoRotate ? "1" : "0");
		if (league.club.autoRotate && tiredStarters().length) { rotateTired(true); }   // rotate the tired ones now too
		toast(league.club.autoRotate ? "Auto-rotate on: tired starters are rested after every match" : "Auto-rotate off", "#f2b52e");
		afterClubChange();
	});
	$("ovSim").addEventListener("click", e => { e.currentTarget.blur(); simulateMine(); });
	$("ovSubs").addEventListener("click", () => openSubs());
	$("ovSeason").addEventListener("click", e => { e.currentTarget.blur(); simulateSeason(); });
	$("ovSeasonAll").addEventListener("click", e => { e.currentTarget.blur(); simulateSeason(true); });
	$("subsBtn").addEventListener("click", e => { e.currentTarget.blur(); openSubs(); });
	// One click: field the fittest, strongest team from the whole squad.
	$("ovFix").addEventListener("click", e => {
		e.currentTarget.blur();
		if (!league || !league.club || !(state === "intro" || state === "full")) { return; }
		const rested = rotateTired();
		toast(rested.length ? `Rested ${rested.join(", ")}` : "No fresher players on the bench", "#f2b52e");
		if (!tiredStarters().length) { e.currentTarget.hidden = true; }
	});
	// The bar's Simulate button: the whole match before kick-off, the rest of it once it's on.
	$("simBtn").addEventListener("click", e => {
		e.currentTarget.blur();
		if (state === "play") { state = "paused"; charging = false; }
		simulateMine();
	});
	pauseBtn.addEventListener("click", () => {
		if (state === "play") { pause(); } else if (state === "paused") { startPlay(); }
	});
	restartBtn.addEventListener("click", () => {
		clearLive();
		state = "intro";
		banner.hidden = true;
		newMatch();
		showIntro();
	});
	$("modeLeague").addEventListener("click", e => { e.currentTarget.blur(); if (mode !== "league") { setMode("league"); } });
	$("modeFriendly").addEventListener("click", e => { e.currentTarget.blur(); if (mode !== "friendly") { setMode("friendly"); } });
	$("modeTutorial").addEventListener("click", e => { e.currentTarget.blur(); setMode("tutorial"); });
	$("modeCorners").addEventListener("click", e => { e.currentTarget.blur(); setMode("corners"); });
	for (const [ id, key ] of [ [ "trFocus", "focus" ], [ "trLoad", "load" ] ]) {
		$(id).addEventListener("change", () => { if (!league || !league.club) { return; } ensureCoaching(league.club, league); league.club.training[key] = $(id).value; saveLeague(); renderCoaching(); });
	}
	$("coachSkip").addEventListener("click", e => { e.currentTarget.blur(); if (tut) { nextTutStep(); } });
	$("coachExit").addEventListener("click", e => { e.currentTarget.blur(); setMode("friendly"); });
	// Starting over wipes the season, so it takes a second press.
	let newArm = 0;
	$("lgNew").addEventListener("click", e => {
		const b = e.currentTarget;
		b.blur();
		if (Date.now() - newArm > 3000) {
			newArm = Date.now();
			b.textContent = "Press again to start over";
			setTimeout(() => { if (Date.now() - newArm >= 3000) { b.textContent = "New season"; } }, 3100);
			return;
		}
		newArm = 0;
		b.textContent = "New season";
		newSeason(fmtSel.value);
		state = "intro";
		banner.hidden = true;
		newMatch();
		showIntro();
		renderLeague();
	});
	// Back up the season to a file, and bring it back in any browser or on any device.
	let downloadsCap = null;
	if (window.claude && typeof window.claude.use === "function") { window.claude.use("downloads").then(d => { downloadsCap = d; }, () => {}); }
	function exportLeague () {
		if (!league) { toast("No season to export yet", "#f2b52e"); return; }
		const data = JSON.stringify({ app: "floodlit-football", v: 1, exported: new Date().toISOString(), league });
		const name = `floodlit-football-season-${league.season}-matchday-${league.round + 1}.json`;
		if (downloadsCap) {
			downloadsCap.save({ filename: name, data }).then(() => toast("Season exported", "#7fd49b"), e => { if (!e || e.code !== "declined") { toast("Couldn't export here", "#e2594a"); } });
			return;
		}
		try {
			const url = URL.createObjectURL(new Blob([ data ], { type: "application/json" }));
			const a = document.createElement("a");
			a.href = url; a.download = name;
			document.body.append(a); a.click(); a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 2000);
			toast("Season exported", "#7fd49b");
		} catch (e) { toast("Couldn't export here", "#e2594a"); }
	}
	// Importing replaces the season you have, so it takes a second press, like New season.
	let pendingImport = null, importArm = 0;
	const resetImport = () => { pendingImport = null; $("lgImport").textContent = "Import league"; };
	function readImport (file) {
		const r = new FileReader();
		r.onload = () => {
			let v = null;
			try { v = JSON.parse(String(r.result)); } catch (e) { v = null; }
			const lg = v && v.league ? v.league : v;
			if (!validLeague(lg)) { toast("That file isn't a Floodlit Football season", "#e2594a"); return; }
			pendingImport = lg;
			importArm = Date.now();
			$("lgImport").textContent = `Press again to load season ${lg.season}, matchday ${lg.round + 1}`;
			setTimeout(() => { if (pendingImport === lg && Date.now() - importArm >= 6000) { resetImport(); } }, 6100);
		};
		r.onerror = () => toast("Couldn't read that file", "#e2594a");
		r.readAsText(file);
	}
	function applyImport () {
		league = ensureClub(pendingImport);
		resetImport();
		clearLive();
		saveLeague();
		state = "intro";
		banner.hidden = true;
		newMatch();
		showIntro();
		renderLeague();
		toast("Season imported", "#7fd49b");
	}
	$("lgExport").addEventListener("click", e => { e.currentTarget.blur(); exportLeague(); });
	$("lgImport").addEventListener("click", e => {
		e.currentTarget.blur();
		if (pendingImport && Date.now() - importArm < 6000) { applyImport(); return; }
		$("lgFile").value = "";
		$("lgFile").click();
	});
	$("lgFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) { readImport(f); } });
	function setBig (on) {
		if (document.body && document.body.classList) { document.body.classList.toggle("big", on); }
		store.set("ff-big", on ? "1" : "0");
		$("bigBtn").textContent = on ? "Big pitch: on" : "Big pitch: off";
		$("bigBtn").setAttribute("aria-pressed", String(on));
		$("menuToggle").textContent = on ? "Show menu" : "Hide menu";
		$("menuToggle").setAttribute("aria-pressed", String(on));
		lastHud = "";
		resize();
		if (on) { $("pitchwrap").scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); }
	}
	$("bigBtn").addEventListener("click", e => { setBig(!(document.body && document.body.classList.contains("big"))); e.currentTarget.blur(); });
	// Phones: the settings, league table and help sit behind More, closed until asked for.
	function setMore (on) {
		document.body.classList.toggle("more", on);
		store.set("ff-more", on ? "1" : "0");
		$("moreBtn").textContent = on ? "Less" : "More…";
		$("moreBtn").setAttribute("aria-expanded", String(on));
	}
	$("moreBtn").addEventListener("click", e => { setMore(!document.body.classList.contains("more")); e.currentTarget.blur(); });
	setMore(store.get("ff-more") === "1");
	$("menuToggle").addEventListener("click", e => { setBig(!(document.body && document.body.classList.contains("big"))); e.currentTarget.blur(); });
	// Big pitch is the default; the menu comes back with the button on the pitch (or F).
	setBig(store.get("ff-big") !== "0");
	// Leave the tab or the window and the match waits for you.
	document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") { pause(); } });
	window.addEventListener("blur", () => { if (state === "play" && document.hasFocus && !document.hasFocus()) { pause(); } });
	$("camBtn").addEventListener("click", e => { setCam(nextCam(), true); e.currentTarget.blur(); toast(CAM_NAME[camMode], "#f2b52e"); });
	setCam(camMode);
	$("offsideBtn").addEventListener("click", e => {
		offsideRule = !offsideRule;
		offside = { team: -1, set: new Set() };
		e.currentTarget.textContent = offsideRule ? "Offside on" : "Offside off";
		e.currentTarget.setAttribute("aria-pressed", String(offsideRule));
		e.currentTarget.blur();
		store.set("ff-offside", offsideRule ? "1" : "0");
		if (state === "play" || state === "goal") { toast(offsideRule ? "Offside on" : "Offside off", "#f2b52e"); }
	});
	$("mapBtn").addEventListener("click", e => {
		minimapOn = !minimapOn;
		e.currentTarget.textContent = minimapOn ? "Minimap on" : "Minimap off";
		e.currentTarget.setAttribute("aria-pressed", String(minimapOn));
		e.currentTarget.blur();
		store.set("ff-map", minimapOn ? "1" : "0");
	});
	$("hintsBtn").addEventListener("click", e => {
		hintsOn = !hintsOn;
		e.currentTarget.textContent = hintsOn ? "Hints on" : "Hints off";
		e.currentTarget.setAttribute("aria-pressed", String(hintsOn));
		e.currentTarget.blur();
		store.set("ff-hints", hintsOn ? "1" : "0");
	});
	$("contrastBtn").addEventListener("click", e => {
		highContrast = !highContrast;
		e.currentTarget.textContent = highContrast ? "Kit contrast on" : "Kit contrast off";
		e.currentTarget.setAttribute("aria-pressed", String(highContrast));
		e.currentTarget.blur();
		store.set("ff-contrast", highContrast ? "1" : "0");
		setOpponent(opp, leftIsYou);   // re-dress the other side for this match
		if (state === "play" || state === "goal" || state === "paused") { toast(highContrast ? "Kit contrast on" : "Kit contrast off", "#f2b52e"); }
	});

	// Graphics: Low, Medium or High. The stadium and crowd are rebuilt at the new level on the next
	// frame; a change of antialiasing needs a new WebGL context, so the 3D view starts afresh on a new
	// canvas. Saved only once chosen, like the camera.
	const gfxSel = $("gfx");
	function setGfx (level, chosen = false) {
		if (!GFX3[level]) { return; }
		const was = gfxLevel;
		gfxLevel = level;
		if (gfxSel) { gfxSel.value = level; }
		if (chosen) { store.set("ff-gfx", level); }
		if (level === was || !G3.renderer) { return; }
		if (G3.aa !== gfx3().aa && canvas3d) {
			try { G3.renderer.dispose(); if (G3.renderer.forceContextLoss) { G3.renderer.forceContextLoss(); } } catch (e) { /* gone already */ }
			const fresh = canvas3d.cloneNode(false);
			canvas3d.replaceWith(fresh); canvas3d = fresh; watchCanvas3D(fresh);
			G3.renderer = null; G3.scene = null; G3.stadium = null; G3.stadiumKey = ""; G3.mats.clear(); G3.fig = null; G3.crowd = null; G3.nets = null; G3.w = 0; G3.shot = ""; G3.lost = false;
			crowdMat3 = null;
			show3D(camMode === "3d");
		} else {
			resize3D();
		}
	}
	if (gfxSel) {
		gfxSel.value = gfxLevel;
		gfxSel.addEventListener("change", () => {
			setGfx(gfxSel.value, true);
			if (state === "play" || state === "goal" || state === "paused") { toast(`Graphics: ${GFX_NAME[gfxLevel]}`, "#f2b52e"); }
			gfxSel.blur();
		});
	}

