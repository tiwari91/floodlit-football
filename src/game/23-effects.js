	/* ---------- effects ---------- */
	function burst (x, y, label) {
		fx.push({ x, y, t: 0, label, color: "#f2b52e" });
	}

	function splash (x, y) {
		fx.push({ x, y, t: 0, life: 26, label: null, color: "rgba(205, 225, 255, 0.8)" });
	}

	function toast (label, color) {
		fx = fx.filter(f => !f.toast);
		fx.push({ x: FW / 2, y: 90, t: 0, life: 110, label, color, toast: true });
	}

	// White pulse that follows a player, so your eye finds who you now control.
	function flashPlayer (p) {
		fx.push({ p, x: p.x, y: p.y, t: 0, label: null, color: "#ffffff" });
	}

