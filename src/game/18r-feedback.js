	/* ---------- feedback: "how was that match?" at some full times, and when people leave mid-match ----------
	   Sent anonymously to the same GoatCounter account as the play counts (no cookies, no names), and only
	   from the live site (see track, 13). Asked after the first match and then every fourth, never more,
	   and "Don't ask again" means never. */
	function askFeedback (kind) {
		const box = $("ovFeedback");
		if (!box) { return; }
		box.hidden = true;
		const n = (Number(store.get("ff-fb-n")) || 0) + 1;
		store.set("ff-fb-n", String(n));
		if (store.get("ff-fb-off") === "1" || !(n === 1 || n % 4 === 0)) { return; }
		box.replaceChildren();
		const btn = (label, cls) => { const b = el("button", cls || "", label); b.type = "button"; return b; };
		const q = el("span", "fb-q", "How was that match?");
		const good = btn("Good"), bad = btn("Not great"), off = btn("Don't ask again", "fb-off");
		box.append(q, good, bad, off);
		const pick = verdict => {
			track(`feedback-${verdict}`, kind);
			box.replaceChildren();
			const ta = el("textarea");
			ta.rows = 2; ta.maxLength = 300; ta.setAttribute("aria-label", "What would make it better?");
			ta.placeholder = verdict === "good" ? "What did you like? (optional)" : "What went wrong, or what would make it better? (optional)";
			const send = btn("Send", "primary"), skip = btn("Skip");
			const done = msg => { box.replaceChildren(el("span", "fb-q", msg)); };
			send.addEventListener("click", () => {
				const text = ta.value.replace(/\s+/g, " ").trim().slice(0, 300);
				if (text) { track(`feedback-note-${verdict}: ${text}`, text); }
				done("Thanks, that helps.");
			});
			skip.addEventListener("click", () => done("Thanks."));
			ta.addEventListener("keydown", e => e.stopPropagation());   // typing here never moves a player or pauses the match
			box.append(ta, el("div", "fb-row"));
			box.lastChild.append(send, skip);
			ta.focus();
		};
		good.addEventListener("click", () => pick("good"));
		bad.addEventListener("click", () => pick("bad"));
		off.addEventListener("click", () => { store.set("ff-fb-off", "1"); box.replaceChildren(el("span", "fb-q", "Okay, we won't ask again.")); });
		box.hidden = false;
	}
	// Leaving with a match on: the minute, so the counts show where people give up.
	window.addEventListener("pagehide", () => {
		if (state === "play" || state === "paused" || state === "half" || state === "goal") {
			const minute = Math.round(90 * (1 - timeLeft / Math.max(1, matchLen)));
			track("left-mid-match", `minute ${Math.min(90, Math.max(0, minute))}`);
		}
	});
