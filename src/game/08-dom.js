	/* ---------- DOM ---------- */
	const canvas = document.getElementById("pitch");
	let ctx = canvas.getContext("2d");   // swapped for an offscreen one while painting the TV camera's pitch
	const $ = id => document.getElementById(id);
	const overlay = $("overlay"), ovTitle = $("ovTitle"), ovText = $("ovText"), ovButton = $("ovButton");
	const banner = $("banner");
	const scoreHomeEl = $("scoreHome"), scoreAwayEl = $("scoreAway"), clockEl = $("clock");
	const weatherSel = $("weather"), groundSel = $("ground"), shapeSel = $("shape"), styleSel = $("style"), pressSel = $("press"), autoSwitchSel = $("autoswitch");
	const levelSel = $("level"), diffSel = $("difficulty"), lenSel = $("length"), fmtSel = $("format"), nextNote = $("nextNote");
	const pauseBtn = $("pauseBtn"), restartBtn = $("restartBtn"), soundBtn = $("soundBtn");
	const padTackle = $("padTackle"), ovStats = $("ovStats");

