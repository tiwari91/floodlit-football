	/* ---------- boot ---------- */
	function start (saved) {
		const d = store.get("ff-diff"), l = store.get("ff-len"), s = store.get("ff-sound"), f = store.get("ff-fmt");
		if (f && FORMATS[f]) { fmtSel.value = f; }
		for (const fk of Object.keys(SHAPES)) { const v = store.get("ff-shape-" + fk); if (v && (SHAPES[fk][v] || v === "auto")) { shapePref[fk] = v; } }
		if (d && DIFF[d]) { diffSel.value = d; diff = DIFF[d]; }
		const sw = store.get("ff-weather"), sg = store.get("ff-ground"), ss = store.get("ff-style"), spr = store.get("ff-press");
		if (ss && STYLES[ss]) { styleSel.value = ss; }
		if (spr && PRESSES[spr]) { pressSel.value = spr; }
		{ const ln = store.get("ff-line"), tk = store.get("ff-tackling"); if (ln && LINES[ln]) { $("line").value = ln; } if (tk && TACKLING[tk]) { $("tackling").value = tk; } }
		const asw = store.get("ff-autoswitch");
		if (asw && AUTO_SWITCH[asw]) { autoSwitchSel.value = asw; autoSwitchMode = asw; }
		if (sw && WEATHER[sw]) { weatherSel.value = sw; }
		if (sg && SURFACES[sg]) { groundSel.value = sg; }
		if (l && [ ...lenSel.options ].some(o => o.value === l)) { lenSel.value = l; }
		if (s === "0") { soundOn = false; soundBtn.textContent = "Sound off"; soundBtn.setAttribute("aria-pressed", "false"); }
		if (store.get("ff-offside") === "0") { offsideRule = false; $("offsideBtn").textContent = "Offside off"; $("offsideBtn").setAttribute("aria-pressed", "false"); }
		minimapOn = store.get("ff-map") !== "0"; $("mapBtn").textContent = minimapOn ? "Minimap on" : "Minimap off"; $("mapBtn").setAttribute("aria-pressed", String(minimapOn));
		if (store.get("ff-hints") === "0") { hintsOn = false; $("hintsBtn").textContent = "Hints off"; $("hintsBtn").setAttribute("aria-pressed", "false"); }
		if (store.get("ff-music") === "0") { musicOn = false; $("musicBtn").textContent = "Music off"; $("musicBtn").setAttribute("aria-pressed", "false"); }
		{ const g = store.get("ff-gfx"); if (g && GFX3[g]) { setGfx(g); } }
		if (store.get("ff-contrast") === "1") { highContrast = true; $("contrastBtn").textContent = "Kit contrast on"; $("contrastBtn").setAttribute("aria-pressed", "true"); }

		try {
			const saved = JSON.parse(store.get("ff-league") || "null");
			if (validLeague(saved)) { league = ensureClub(saved); }
			// A save from the old eight-club league: bring your squad into the new division.
			else if (saved && saved.club) { league = null; newSeason(saved.fmt || fmtSel.value, saved.club); }
		} catch (e) { league = null; }
		mode = store.get("ff-mode") === "friendly" ? "friendly" : "league";
		applyLevel();
		$("modeLeague").setAttribute("aria-pressed", String(mode === "league"));
		$("modeFriendly").setAttribute("aria-pressed", String(mode === "friendly"));
		diffSel.disabled = weatherSel.disabled = groundSel.disabled = mode === "league";
		if (mode === "league" && !league) { newSeason(fmtSel.value); }

		newMatch();
		showIntro();
		renderLeague();
		freeze = 0;
		if (saved && Array.isArray(saved.score) && typeof saved.timeLeft === "number" && saved.timeLeft > 0) {
			score = saved.score.slice(0, 2).map(Number);
			timeLeft = saved.timeLeft;
			freeze = KICKOFF_FREEZE;
			state = "paused";
			showOverlay("Paused", "Your match is where you left it.", "Resume");
			pauseBtn.textContent = "Resume";
		} else {
			restoreLive();
		}
		resize();
		renderHud();
		requestAnimationFrame(t => { last = t; loop(t); });
		renderModeBadge();
		renderShapes();
		connectLeagueStore();
	}

	// Test hook (only with ?test in the URL): lets a headless harness step the sim and read it.
	if (/[?&]test\b/.test(location.search)) {
		window.__ff = {
			get state () { return state; }, get frame () { return frame; }, get ctrl () { return ctrl; }, get players () { return players; },
			get ball () { return ball; }, get score () { return score; }, get possFrames () { return possFrames; }, get possTeam () { return possTeam; },
			get goalTimer () { return goalTimer; }, get timeLeft () { return timeLeft; }, get freeze () { return freeze; }, get FW () { return FW; }, get FH () { return FH; },
			get manualLock () { return manualLock; }, get celeb () { return typeof celeb === "undefined" ? null : celeb; },
			get autoSwitchMode () { return autoSwitchMode; }, set autoSwitchMode (v) { autoSwitchMode = v; autoSwitchSel.value = v; },
			get assistMode () { return assistMode; }, setAssist, assistRun, get lastDeal () { return lastDeal; }, valueOf, ovrNow, windowOpen,
			offerJobs, takeJob, declineJob, get YOU () { return YOU; }, get TEAMS () { return TEAMS; },
			agentApproaches, agreeApproach, moveAbroad, takeOffer, assistShortlist, assistBuy, scoutShortlist, bestOffer, inheritSetup, keyContracts, contractAlerts, roleOf, slotsFor, renderAssistNote, assistRenewAnyway, retireVeterans, renewDeal, benchReact, get tlc () { return tlc; }, set tlcLast (v) { tlcLast = v; }, divisionName, applyForeignLeague, commitFoul, get setPiece () { return setPiece; }, simulateMineTest () { simulateMine(); }, ensureClub, validLeague: typeof validLeague === "function" ? validLeague : null, get mode () { return mode; }, finishTutorialTest () { if (!tut) { return false; } tut.step = TUT.length - 1; nextTutStep(); return true; },
			get autoHold () { return autoHold; }, set autoHold (v) { autoHold = v; },
			get charging () { return charging; }, get passCharge () { return passCharge; }, get meterRect () { return meterRect; }, get drawMs () { return drawMs; }, get drawn () { return drawn; }, frameDue, get scale () { return scale; }, get kits () { return KITS; }, get stats () { return stats; }, get oppStats () { return oppStats; }, get steerAt () { return steerAt; }, set steerAt (v) { steerAt = v; }, set possTeam (v) { possTeam = v; },
			set steerSwitchDone (v) { steerSwitchDone = !!v; },
			get lastSwitchKind () { return lastSwitchKind; }, get line () { return line; }, get tackling () { return tackling; }, setLine (t, v) { line[t] = v; }, setTackling (t, v) { tackling[t] = v; }, set lastSwitchKind (v) { lastSwitchKind = v; }, get setPiece () { return setPiece; },
			get G3 () { return G3; }, get matchLog () { return matchLog; }, get league () { return league; }, simSeasonTest () { simulateSeason(); }, balanceTest () { const sl = slotsFor(league.fmt), avg = a => a.reduce((t, v) => t + v, 0) / a.length; const you = avg(sl.map(i => ovrOf(league.club.squad[i]))); const all = [], per = league.members.filter(id => id !== 0).map(id => { const sq = cpuSquad(id, getStr(id)); all.push(...sq.map(ovrOf)); return avg(sl.map(i => ovrOf(sq[i]))); }); all.sort((a, b) => b - a); return { season: league.season, you, lg: avg(per), max: all[0], top5: all.slice(0, 5).join("/") }; }, nextSeasonTest () { if (seasonDone()) { newSeason(league.fmt); newMatch(); renderLeague(); } }, renderLeagueTest () { renderLeague(); }, get crowdHush () { return crowdHush; }, get crowdHeat () { return crowdHeat; }, renderLineupTest () { renderLineup(); }, crowdReactTest (k, t) { crowdReactImpl(k, t); }, get shoot () { return shoot; }, cornerTest (att, top = true) { if (state !== "play") { return; } freeze = 0; awardCorner(att, att === 1, top); }, get cornerPlan () { return cornerPlan; },
			fkTest (t, x, y, indirect = false) { if (state !== "play") { return; } freeze = 0; const v = outfield(t).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; v.x = x; v.y = y; awardFreeKick(t, v, { indirect }); },
			penTest (t) { if (state !== "play") { return; } freeze = 0; awardPenalty(t, outfield(t)[0]); },
			throwTest (t, x, top) { if (state !== "play") { return; } freeze = 0; awardThrow(t, x, top); },
			goalKickTest (def) { if (state !== "play") { return; } freeze = 0; awardGoalKick(def, def === 0); },
			liftTest () { const p = ball.owner; if (p) { liftShot(p); } },
			offsideTest (d, t = 1) {
				if (state !== "play") { return; }
				freeze = 0; setPiece = null;
				const c = outfield(t).find(p => p.role === "mid"), f = outfield(t).find(p => p.role === "fwd");
				c.x = t === 1 ? FW * 0.62 : FW * 0.38; c.y = FH / 2; c.vx = c.vy = 0; c.kickCd = 0; ball.owner = c; syncOwnedBall();
				for (const q of outfield(1 - t)) { q.vx = q.vy = 0; }
				const line = offsideLine(t);
				f.x = t === 0 ? line + d : FW - (line + d); f.y = clamp(FH / 2 + 90, 20, FH - 20); f.vx = f.vy = 0;
				for (const q of outfield(1 - t)) { if (Math.hypot(q.x - f.x, q.y - f.y) < 60 || Math.hypot(q.x - c.x, q.y - c.y) < 60) { q.y = clamp(q.y + (q.y < FH / 2 ? -140 : 140), 20, FH - 20); } }
				passTo(c, f);
				return f;
			},
			get restartWalk () { return restartWalk; }, get review () { return review; }, get cpuSubs () { return cpuSubs; }, get surge () { return surge; }, get pressI () { return press; }, formBonus, get lastRatings () { return lastRatings; }, get stretcher () { return stretcher; }, injureTest (t, serious) { const v = outfield(t).find(p => !p.injured); const o = outfield(1 - t)[0]; if (v && o) { tackling[1 - t] = "hard"; const r = Math.random; Math.random = () => 0.01; try { commitFoul(o, v, true); } finally { Math.random = r; } } return v; }, staOf, get offside () { return offside; }, get deadBall () { return deadBall; }, get tally () { return tally; }, get freezeKind () { return freezeKind; }, fkDist () { return fkDist(); }, simExtra () { return { tally, poss: possFrames.slice() }; }, get setPieceKind () { return setPiece ? setPiece.kind : null; }, get gfxLevel () { return gfxLevel; }, setGfx, get musicBar () { return music ? music.bar : -1; }, get audioState () { return audio ? audio.state : "none"; }, get replayOn () { return replayOn(); }, get replay () { return replay; }, get recFrames () { return rec.n; }, REPLAY_AT, REPLAY_FR, GOAL_CELEB, get lastCaption () { return lastCaption; }, caption, get camMode () { return camMode; }, get crowdMood () { return crowdMood; }, get frameDt () { return frameDt; }, get crowdBed () { return crowd; }, get soundOn () { return soundOn; },
			human, switchScore, outfield, dist, get cond () { return cond; }, clubSong, isDerby, celebrateTrophy, get fireworks () { return fireworks; }, goalSongTest (id) { const s = goalSong(id); playGoalSong(id); return s; }, chantTest (away) { ensureAudio(); chant(1, !!away); }, stepBallTest () { stepBall(); }, rematchTest () { clearLive(); state = "intro"; newMatch(); showIntro(); renderLeague(); },
			get officials () { return officials3; }, get flagCall () { return flagCall; }, refKit, deltaE,
			proj (x, y, z) { return G3.cam ? proj3D(x, y, z) : null; }, get viewScale () { return scale; },
			groundTest (o) { if (gstyle) { Object.assign(gstyle, o); } },
			olaTest () { crowdMood.olaT = 15; crowdMood.olaLast = performance.now(); },
			raiseFlagTest (kind) { raiseFlag(ball.x, kind === "offside" ? "off" : "out"); flagCall.t = 600; },
			step (n = 1) { for (let i = 0; i < n; i++) { snapshotPrev(); update(); } },
			key (code, on) { if (on) { keys.add(code); } else { keys.delete(code); } },
			press (code) { window.dispatchEvent(new KeyboardEvent("keydown", { code })); },
			release (code) { window.dispatchEvent(new KeyboardEvent("keyup", { code })); },
			set autoPilot (v) { autoPilot = !!v; }, set dribbleTest (v) { dribbleTest = !!v; }, get autoPilot () { return autoPilot; },
			set timeLeft (v) { timeLeft = v; }, set freeze (v) { freeze = v; }, set ctrl (v) { ctrl = v; }, set manualLock (v) { manualLock = v; }, set switchCd (v) { switchCd = v; },
			forceGoal (t) {
				if (state !== "play" || !ball) { return; }
				const o = outfield(t), sc = o[o.length - 1], gk = team(1 - t).find(p => p.role === "gk");
				if (gk) { gk.y = FH / 2 + 90; gk.vx = gk.vy = 0; }   // the keeper is out of it
				ball.lastBy = sc; ball.owner = null; ball.headed = false; ball.x = t === 0 ? FW - 14 : 14; ball.y = FH / 2 - 40; ball.z = 0; ball.vx = t === 0 ? 12 : -12; ball.vy = 0;
				sc.x = ball.x - (t === 0 ? 40 : -40); sc.y = ball.y + 10; freeze = 0;
			}
		};
	}

	const hot = window.claude && window.claude.hot;
	if (hot && typeof hot.snapshot === "function") {
		hot.snapshot(() => (state === "play" || state === "paused" || state === "goal"
			? { score: score.slice(), timeLeft }
			: {}));
	}
	if (hot && typeof hot.ready === "function") { hot.ready(start); } else { start((hot && hot.data) || {}); }
