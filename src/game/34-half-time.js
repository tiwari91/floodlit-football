	/* ---------- half time ---------- */
	let halfDone = false;
	// The teams change ends at half time. The match itself is always played with your side
	// kicking towards x = FW; for the second half the picture (and your controls) are
	// mirrored, so on screen you attack the other goal, like a real second half.
	const endsSwapped = () => halfDone && mode !== "tutorial";
	// In a mirrored picture, text still has to read the right way round.
	if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.__ffMirror) {
		const P = CanvasRenderingContext2D.prototype;
		P.__ffMirror = true;
		for (const fn of [ "fillText", "strokeText" ]) {
			const orig = P[fn];
			P[fn] = function (t, x, y, ...rest) {
				const m = typeof this.getTransform === "function" ? this.getTransform() : null;
				if (!m || m.a * m.d - m.b * m.c >= 0) { return orig.call(this, t, x, y, ...rest); }
				this.save();
				this.translate(x, y); this.scale(-1, 1);
				const al = this.textAlign;
				if (al === "left" || al === "start") { this.textAlign = "right"; } else if (al === "right" || al === "end") { this.textAlign = "left"; }
				orig.call(this, t, 0, 0, ...rest);
				this.restore();
			};
		}
	}
	function halfTime () {
		halfDone = true;
		endSurge();
		for (const p of players) { p.sta = Math.min(1, staOf(p) + 0.08); }
		state = "half";
		charging = false;
		banner.hidden = true;
		sfx("half");
		const [ h, a ] = leftIsYou ? score : [ score[1], score[0] ];
		const tot = possFrames[0] + possFrames[1], poss = tot ? Math.round(100 * possFrames[0] / tot) : 50;
		$("announce").textContent = `Half time. ${h} to ${a}. The teams change ends.`;
		showOverlay("Half time", `${leftIsYou ? "You" : opp.name} ${h}–${a} ${leftIsYou ? opp.name : "you"}. Change your tactic, formation or style now if you want to, then start the second half. The teams change ends, so you attack the other goal. ${opp.short === "CPU" ? "The CPU" : opp.name} kick off.`, "Start second half", matchStats(poss));
		pauseBtn.textContent = "Pause";
		if (!tut) { $("ovSubs").hidden = false; renderQuick(); }
		kickoff(1);   // the other side kicks off the second half
		saveLive();
	}

