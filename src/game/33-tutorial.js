	/* ---------- tutorial ---------- */
	let tut = null;   // { step, flags, base, marker } while the tutorial runs
	const k = t => `<kbd>${t}</kbd>`;
	function giveBall (p) { ball.owner = p; ctrl = players.indexOf(p); p.kickCd = 0; receiver = null; manualLock = 90; }
	const TUT = [
		{ title: "Move", text: `Use the ${k("←")} ${k("↑")} ${k("→")} ${k("↓")} arrow keys to run to the amber marker.`,
			setup () { const h = human(); tut.marker = { x: clamp(h.x + 200 * S, 60, FW - 60), y: clamp(h.y - 90 * S, 60, FH - 60) }; },
			check: () => dist(human(), tut.marker) < 35 },
		{ title: "Sprint", text: `Hold ${k("E")} (or ${k("Shift")}) while you move to sprint. Sprint to the next marker.`,
			setup () { const h = human(); tut.marker = { x: clamp(h.x + 320 * S, 60, FW - 60), y: clamp(h.y + 140 * S, 60, FH - 60) }; },
			check: () => { if ((human().sprintAmt || 0) > 0.6) { tut.flags.sprint = true; } return tut.flags.sprint && dist(human(), tut.marker) < 35; } },
		{ title: "Pass", text: `You have the ball. Face a teammate (the dashed ring shows who) and press ${k("S")} to pass.`,
			setup () { giveBall(human()); },
			check: () => stats.completed > tut.base.completed },
		{ title: "Through ball", text: `Press ${k("W")} to play the ball into the space ahead of a teammate. They run on to it.`,
			setup () { giveBall(human()); },
			check: () => !!tut.flags.through },
		{ title: "Shoot", text: `Near goal, hold ${k("D")} to power up. While holding, ${k("↑")} ${k("↓")} move the crosshair in the goal. Let go to shoot.`,
			setup () { const h = human(); h.x = FW - 380 * Math.sqrt(S); h.y = FH / 2 + 40; h.vx = h.vy = 0; h.dir = 0; giveBall(h); },
			check: () => stats.shots > tut.base.shots },
		{ title: "Long ball", text: `Press ${k("Q")} to hit a long ball to your striker (the amber Q marks who). From out wide it's a cross.`,
			setup () { const h = human(); h.x = FW * 0.3; h.vx = h.vy = 0; giveBall(h); },
			check: () => !!tut.flags.long },
		{ title: "Tackle", text: `A red player is dribbling at you. Get close and press ${k("A")}: right alongside it's a shoulder tackle, from further out a slide.`,
			setup () {
				const h = human(), c = outfield(1).reduce((a, b) => (dist(a, h) < dist(b, h) ? a : b));
				c.x = clamp(h.x + 120 * S, 40, FW - 40); c.y = h.y; c.vx = c.vy = 0; c.kickCd = 0;
				ball.owner = c; tut.carrier = c;
			},
			check: () => stats.tackles > tut.base.tackles || (ball.owner && ball.owner.team === 0 && ball.owner.role !== "gk") },
		{ title: "Switch player", text: `When you don't have the ball, press ${k("S")} to switch to the teammate under the S marker.`,
			setup () { const c = outfield(1)[0]; ball.owner = c; receiver = null; manualLock = 0; },
			check: () => !!tut.flags.switched },
		{ title: "Tactics", text: `Change your tactic at any time: ${k("1")} Defensive, ${k("2")} Balanced, ${k("3")} Attacking, ${k("4")} All-out attack. Try one now.`,
			check: () => mentality[0] !== tut.base.ment }
	];
	function renderCoach () {
		const st = TUT[tut.step];
		$("coach").hidden = false;
		$("coachStep").textContent = `Step ${tut.step + 1} of ${TUT.length} · ${st.title}`;
		$("coachText").innerHTML = st.text;   // static copy with key caps; no user data
	}
	function setupTutStep () {
		tut.flags = {};
		tut.marker = null;
		tut.base = { completed: stats.completed, shots: stats.shots, tackles: stats.tackles, ment: mentality[0] };
		const st = TUT[tut.step];
		if (st.setup) { st.setup(); }
		snapshotPrev();
		renderCoach();
	}
	function nextTutStep () {
		tut.step++;
		if (tut.step >= TUT.length) {
			tut = null;
			$("coach").hidden = true;
			store.set("ff-tut-done", "1");
			state = "full";
			showOverlay("Tutorial complete", "You know the controls. Play a friendly to practise (it doesn't count), or switch to League to start your season. The Controls list below the pitch has everything, including formations and team instructions.", "Play a friendly");
			tutDone = true;
			return;
		}
		setupTutStep();
	}
	let tutDone = false;
	function tutTick () {
		if (!tut || state !== "play" || freeze > 0) { return; }
		if (TUT[tut.step].check()) { toast("Nice!", "#f2b52e"); nextTutStep(); }
	}

