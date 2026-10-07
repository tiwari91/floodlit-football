	/* ---------- league save: your own account when the page can, this browser always ---------- */
	let dbRef = null, writeChain = Promise.resolve();
	function setSync (text) { $("lgSync").textContent = text; }

	let bulkSim = false;   // simulating a run of matches: save and make noise once, at the end
	function saveLeague () {
		if (bulkSim) { return; }
		league.updated = Date.now();
		store.set("ff-league", JSON.stringify(league));
		if (!dbRef) { return; }
		const body = { json: JSON.stringify(league) };   // one string field: no nested arrays in the store
		writeChain = writeChain.then(() => dbRef.set(body)).then(
			() => setSync("Saved to your account"),
			e => { if (e && e.code === "invalid_argument") { dbRef = null; } setSync("Saved in this browser"); }
		);
	}

	async function connectLeagueStore () {
		try {
			if (!window.claude || typeof window.claude.use !== "function") { return; }
			const [ db, user ] = await Promise.all([ window.claude.use("db"), window.claude.use("user") ]);
			if (!db || !user) { return; }
			const uid = await user.id();
			if (!uid) { return; }
			const ref = db.doc("data/users/" + uid + "/league");
			const snap = await ref.get();
			dbRef = ref;
			let remote = null;
			try { remote = snap.exists ? JSON.parse(snap.data().json) : null; } catch (e) { remote = null; }
			const idle = state === "intro" || state === "full";
			if (validLeague(remote) && (!league || remote.updated > league.updated) && idle) {
				// Your account has a newer season (another device): pick it up.
				league = ensureClub(remote);
				store.set("ff-league", JSON.stringify(league));
				newMatch();
				showIntro();
				renderLeague();
				setSync("Saved to your account");
			} else if (league) {
				saveLeague();
			}
		} catch (e) {
			setSync("Saved in this browser");
		}
	}

