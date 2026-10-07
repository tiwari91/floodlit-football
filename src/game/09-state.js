	/* ---------- state ---------- */
	let players = [], ball, score = [ 0, 0 ], matchLen = 180, timeLeft = 180;
	let state = "intro";  // intro | play | goal | paused | full
	let ctrl = 3;          // index of the human-controlled player in team 0
	let frame = 0, freeze = 0, goalTimer = 0, switchCd = 0, manualLock = 0, goFlash = 0;
	let autoPilot = false, dribbleTest = false, lastCarrier = null;   // test harness: the computer drives your player too (batch sims)
	let pressHeld = false, touchPress = false, padPressBtn = false;   // A / Tackle button / X held: the press assist
	let possLostAt = -1000;  // frame your side last lost the ball
	let autoSwitchMode = "assisted";   // assisted | manual | aggressive (the Auto switch setting)
	let steerAt = -1000;      // frame of the last direction input from you
	let autoHold = 0;         // frames before the next auto-switch may happen
	let turnoverPending = false;   // the other side has just won the ball: one switch to the best defender is due
	let steerSwitchDone = false;   // the one out-of-the-play switch allowed while you steer has been used this spell
	let lastSwitchKind = "";       // why control last moved by itself (for the test harness)
	let possTeam = -1;
	let receiver = null, receiveTimer = 0;  // teammate a pass is travelling to
	let stats = { passes: 0, completed: 0, shots: 0, tackles: 0, aiTackles: 0, corners: 0, fouls: 0, cards: 0 };
	let oppStats = { passes: 0, completed: 0, shots: 0, tackles: 0, corners: 0, fouls: 0, cards: 0 }, oppPending = false;   // the other side's, for the half-time and full-time comparison
	const notePass = p => { if (p.team === 1) { oppStats.passes++; oppPending = true; } };
	let matchInjuries = [];   // squad slots of your players hurt this match (they miss games after it)
	let matchInjInfo = {};    // name -> { type, games, serious } for each of them
