	/* ---------- pitch geometry (logical units) ---------- */
	const MX = 60, MY = 80;             // the stands around the pitch (goals sit in MX; dugouts below)
	// What the camera shows. A wider screen shows more of the ground side to side
	// (fitView), rather than the same view blown up.
	let VW = 1072, VH = 648;
	const NET = 30;                     // goal depth
	const BASE_SPD = 2.5;
	const KICKOFF_FREEZE = 90;          // 3-2-1 countdown, 30 frames per number
	const MANUAL_LOCK = 150;            // frames a manual switch (S) overrides auto-switch: 2.5 s, or until possession changes
	const AUTO_HOLD = 30;               // least frames between auto-switches (0.5 s)
	const AUTO_HOLD_TURNOVER = 75;      // frames the turnover switch is kept (1.25 s)
	const HANDBACK_GUARD = 75;          // frames before auto-switch may return to the man it just left (1.25 s)
	const NEAR_BALL = 12;               // frames: a teammate this close to the ball is on it, and control goes to him
	const NEAR_GUARD = 30;              // frames before a near-ball switch may hand back to the man it just left
	const STEER_RECENT = 24;            // frames since the last direction input that still count as steering (0.4 s)
	const GOAL_CELEB = 420;             // frames of goal celebration (7 s); any key or tap skips it
	const FALL_T = 55, DIVE_T = 26, THROW_T = 20;   // frames: a fouled player down and up, a keeper's dive, a throw-in's arms
	const ASSIST_ANGLE = 0.62;          // ~35 degrees either side of the goal
	const LUNGE_CD = 45;
	const GRAV = 0.35;                  // ball height: gravity per frame
	const AIR_DRAG = 0.995;             // a ball in the air slows less than one rolling on grass
	const KITS = [
		{ outfield: "#f2b52e", second: "#1f2a36", gk: "#7ec8e3", ink: "#1d1604", pattern: "plain" },
		{ outfield: "#de4f5a", gk: "#b394ee", ink: "#ffffff" }
	];
	// Team 0 attacks +x. Positions are team 0's; team 1 mirrors them.
	const FORMATS = {
		"11": { label: "Eleven", fw: 1700, fh: 1100, goal: 190, circle: 115, box: 190, spot: 150, nums: [ 1, 2, 5, 6, 3, 7, 8, 4, 11, 9, 10 ] },
		"6": { label: "Six", fw: 1250, fh: 750, goal: 150, circle: 90, box: 150, spot: 110 },
		"5": { label: "Five", fw: 1000, fh: 600, goal: 120, circle: 72, box: 120, spot: 90 }
	};
	// Formations. Each position is [ squad slot, role, x, y ] with x and y as fractions of the
	// pitch (x from your own goal). Squad slots follow the 4-4-2 squad: 0 keeper, 1-4 back four,
	// 5-8 midfield four, 9-10 strikers; a formation can play a slot in another role (a full-back
	// as a wing-back, a striker as an attacking midfielder), at a small cost to that player.
	// cam: the slot that plays as attacking midfielder.
	const F = (label, cam, pos) => ({ label, cam, pos, slots: pos.map(q => q[0]), roles: pos.map(q => q[1]) });
	const GK = [ 0, "gk", 0.03, 0.5 ];
	const SHAPES = {
		"11": {
			"442": F("4-4-2", null, [ GK, [ 1, "def", 0.18, 0.17 ], [ 2, "def", 0.15, 0.39 ], [ 3, "def", 0.15, 0.61 ], [ 4, "def", 0.18, 0.83 ],
				[ 5, "mid", 0.38, 0.17 ], [ 6, "mid", 0.35, 0.39 ], [ 7, "mid", 0.35, 0.61 ], [ 8, "mid", 0.38, 0.83 ], [ 9, "fwd", 0.54, 0.41 ], [ 10, "fwd", 0.54, 0.59 ] ]),
			"433": F("4-3-3 attacking", null, [ GK, [ 1, "def", 0.18, 0.17 ], [ 2, "def", 0.15, 0.39 ], [ 3, "def", 0.15, 0.61 ], [ 4, "def", 0.18, 0.83 ],
				[ 5, "mid", 0.33, 0.3 ], [ 6, "mid", 0.3, 0.5 ], [ 7, "mid", 0.33, 0.7 ], [ 8, "fwd", 0.55, 0.15 ], [ 9, "fwd", 0.56, 0.5 ], [ 10, "fwd", 0.55, 0.85 ] ]),
			"4231": F("4-2-3-1 possession", 10, [ GK, [ 1, "def", 0.18, 0.17 ], [ 2, "def", 0.15, 0.39 ], [ 3, "def", 0.15, 0.61 ], [ 4, "def", 0.18, 0.83 ],
				[ 6, "mid", 0.28, 0.4 ], [ 7, "mid", 0.28, 0.6 ], [ 5, "mid", 0.42, 0.18 ], [ 10, "mid", 0.45, 0.5 ], [ 8, "mid", 0.42, 0.82 ], [ 9, "fwd", 0.58, 0.5 ] ]),
			"352": F("3-5-2", null, [ GK, [ 1, "def", 0.16, 0.27 ], [ 2, "def", 0.14, 0.5 ], [ 3, "def", 0.16, 0.73 ], [ 5, "mid", 0.33, 0.12 ], [ 4, "mid", 0.33, 0.88 ],
				[ 6, "mid", 0.3, 0.36 ], [ 7, "mid", 0.27, 0.5 ], [ 8, "mid", 0.3, 0.64 ], [ 9, "fwd", 0.54, 0.42 ], [ 10, "fwd", 0.54, 0.58 ] ]),
			"532": F("5-3-2 defensive", null, [ GK, [ 5, "def", 0.2, 0.1 ], [ 1, "def", 0.16, 0.3 ], [ 2, "def", 0.14, 0.5 ], [ 3, "def", 0.16, 0.7 ], [ 4, "def", 0.2, 0.9 ],
				[ 6, "mid", 0.33, 0.3 ], [ 7, "mid", 0.31, 0.5 ], [ 8, "mid", 0.33, 0.7 ], [ 9, "fwd", 0.53, 0.42 ], [ 10, "fwd", 0.53, 0.58 ] ]),
			"451": F("4-5-1 defensive", 10, [ GK, [ 1, "def", 0.18, 0.17 ], [ 2, "def", 0.15, 0.39 ], [ 3, "def", 0.15, 0.61 ], [ 4, "def", 0.18, 0.83 ],
				[ 5, "mid", 0.36, 0.15 ], [ 6, "mid", 0.33, 0.38 ], [ 7, "mid", 0.33, 0.62 ], [ 8, "mid", 0.36, 0.85 ], [ 10, "mid", 0.44, 0.5 ], [ 9, "fwd", 0.58, 0.5 ] ])
		},
		"6": {
			"221": F("2-2-1", 7, [ GK, [ 2, "def", 0.21, 0.31 ], [ 3, "def", 0.21, 0.69 ], [ 6, "mid", 0.34, 0.5 ], [ 7, "mid", 0.45, 0.5 ], [ 9, "fwd", 0.62, 0.5 ] ]),
			"212": F("2-1-2 attacking", null, [ GK, [ 2, "def", 0.21, 0.31 ], [ 3, "def", 0.21, 0.69 ], [ 6, "mid", 0.36, 0.5 ], [ 9, "fwd", 0.61, 0.35 ], [ 10, "fwd", 0.61, 0.65 ] ]),
			"311": F("3-1-1 defensive", 7, [ GK, [ 1, "def", 0.2, 0.22 ], [ 2, "def", 0.18, 0.5 ], [ 3, "def", 0.2, 0.78 ], [ 7, "mid", 0.38, 0.5 ], [ 9, "fwd", 0.6, 0.5 ] ]),
			"131": F("1-3-1 possession", 7, [ GK, [ 2, "def", 0.18, 0.5 ], [ 5, "mid", 0.36, 0.2 ], [ 7, "mid", 0.42, 0.5 ], [ 8, "mid", 0.36, 0.8 ], [ 9, "fwd", 0.62, 0.5 ] ]),
			"122": F("1-2-2 all-out", null, [ GK, [ 2, "def", 0.18, 0.5 ], [ 6, "mid", 0.36, 0.33 ], [ 7, "mid", 0.36, 0.67 ], [ 9, "fwd", 0.6, 0.35 ], [ 10, "fwd", 0.6, 0.65 ] ])
		},
		"5": {
			"211": F("2-1-1", 7, [ GK, [ 2, "def", 0.23, 0.29 ], [ 3, "def", 0.23, 0.71 ], [ 7, "mid", 0.41, 0.5 ], [ 9, "fwd", 0.6, 0.5 ] ]),
			"121": F("1-2-1 diamond", null, [ GK, [ 2, "def", 0.2, 0.5 ], [ 5, "mid", 0.38, 0.25 ], [ 8, "mid", 0.38, 0.75 ], [ 9, "fwd", 0.6, 0.5 ] ]),
			"22": F("2-2 attacking", null, [ GK, [ 2, "def", 0.23, 0.29 ], [ 3, "def", 0.23, 0.71 ], [ 9, "fwd", 0.52, 0.34 ], [ 10, "fwd", 0.52, 0.66 ] ]),
			"31": F("3-1 defensive", null, [ GK, [ 1, "def", 0.22, 0.2 ], [ 2, "def", 0.2, 0.5 ], [ 3, "def", 0.22, 0.8 ], [ 9, "fwd", 0.55, 0.5 ] ]),
			"112": F("1-1-2 all-out", 7, [ GK, [ 2, "def", 0.2, 0.5 ], [ 7, "mid", 0.4, 0.5 ], [ 9, "fwd", 0.58, 0.35 ], [ 10, "fwd", 0.58, 0.65 ] ])
		}
	};
	const DEFAULT_SHAPE = { "11": "442", "6": "221", "5": "211" };
	// "Auto" follows your tactic: Defensive, Balanced, Attacking, All-out attack.
	const AUTO_SHAPE = { "11": [ "532", "442", "4231", "433" ], "6": [ "311", "221", "212", "122" ], "5": [ "31", "211", "22", "112" ] };
	const shapePref = { "11": "442", "6": "221", "5": "211" };
	const shapeKeyOf = (fmt, ment = 0) => {
		const k = shapePref[fmt];
		if (k === "auto") { return AUTO_SHAPE[fmt][clamp(ment, -1, 2) + 1]; }
		return SHAPES[fmt] && SHAPES[fmt][k] ? k : DEFAULT_SHAPE[fmt];
	};
	const shapeOf = (fmt, ment = 0) => (SHAPES[fmt] ? SHAPES[fmt][shapeKeyOf(fmt, ment)] : null);
	// Squad slots follow the 4-4-2: keeper, four defenders, four midfielders, two forwards.
	const POS_OF_SLOT = [ "gk", "def", "def", "def", "def", "mid", "mid", "mid", "mid", "fwd", "fwd" ];
	// FW/FH: playing surface. S: pitch scale vs five-a-side. GH: goal scale. WW/WH: whole world.
	let FMT, fmtKey, FW, FH, GOAL_T, GOAL_B, N, KICKER, S, GH, WW, WH;
	function applyFormat (key) {
		fmtKey = FORMATS[key] ? key : "11";
		FMT = FORMATS[fmtKey];
		const sh = shapeOf(fmtKey);
		// Positions, roles and numbers come from the chosen formation.
		FMT = { ...FMT, base: sh.pos.map(q => [ q[2] * FMT.fw, q[3] * FMT.fh ]), roles: sh.roles.slice(), nums: sh.slots.map(i => FORMATS["11"].nums[i]), shape: sh };
		FW = FMT.fw; FH = FMT.fh; S = FW / 1000;
		GOAL_T = (FH - FMT.goal) / 2; GOAL_B = GOAL_T + FMT.goal;
		GH = FMT.goal / 120;
		N = FMT.base.length; KICKER = FMT.roles.indexOf("fwd");
		WW = FW + MX * 2; WH = FH + MY * 2;
	}
	applyFormat("11");
	const DIFF = {
		easy: { spd: 0.86, tackle: 0.011, spread: 80, save: 0.18, think: 12 },
		normal: { spd: 1.0, tackle: 0.02, spread: 50, save: 0.3, think: 8 },
		hard: { spd: 1.1, tackle: 0.034, spread: 30, save: 0.42, think: 5 }
	};

	// Difficulty: how sharp the computer side is, on top of its club's rating. Normal changes nothing.
	// think: extra frames before it acts on the ball; pass / passAdd: its pass error; shot: its shot
	// spread; press: how far out it closes you down; chase: its pressing sprint; gk: its keeper's reach.
	const LEVELS = {
		easy: { name: "Easy", think: 4, pass: 1.4, passAdd: 10, shot: 1.35, press: 0.75, chase: 0.95, gk: 0.86 },
		normal: { name: "Normal", think: 0, pass: 1, passAdd: 0, shot: 1, press: 1, chase: 1, gk: 1 },
		hard: { name: "Hard", think: -3, pass: 0.7, passAdd: 0, shot: 0.75, press: 1.25, chase: 1.04, gk: 1.1 }
	};
	let lv = LEVELS.normal;

