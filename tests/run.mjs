// Runs every check: the build is current, then the browser suites, several at once.
// FF_JOBS sets how many run side by side (default 3; 1 runs them in turn, as before). Each runs on
// its own ports (FF_PORT_SHIFT) and its output is printed whole when it finishes, with its time,
// so the slow ones stand out.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [ "switch", "phone", "move", "club", "intro", "look", "drama", "happy", "ceremony", "continental", "buyanyclub", "edit", "leaguefile", "kits", "matchinfo", "hub", "styles", "attrs", "offside", "corners", "intl", "worldcup", "euro", "summer" ];
const JOBS = Math.max(1, Number(process.env.FF_JOBS || 3));
const t0 = Date.now();
let failed = 0;
console.log("\n=== tools/build.mjs --check");
if (spawnSync("node", [ path.join(here, "..", "tools/build.mjs"), "--check" ], { stdio: "inherit" }).status !== 0) { failed++; }
const queue = SUITES.slice(), times = [];
const worker = slot => new Promise(done => {
	const next = () => {
		const name = queue.shift();
		if (!name) { done(); return; }
		const start = Date.now(), out = [];
		// Ports 300 apart per slot, clear of the 97-port steps a suite takes past a busy port.
		const env = { ...process.env, FF_PORT_SHIFT: String(Number(process.env.FF_PORT_SHIFT || 0) + slot * 300) };
		const child = spawn("node", [ path.join(here, `${name}.mjs`) ], { env });
		child.stdout.on("data", d => out.push(d)); child.stderr.on("data", d => out.push(d));
		child.on("close", code => {
			const s = Math.round((Date.now() - start) / 1000);
			times.push([ name, s ]);
			console.log(`\n=== tests/${name}.mjs (${s} s)`); process.stdout.write(Buffer.concat(out));
			if (code !== 0) { failed++; }
			next();
		});
	};
	next();
});
await Promise.all(Array.from({ length: Math.min(JOBS, SUITES.length) }, (_, i) => worker(i)));
times.sort((a, b) => b[1] - a[1]);
console.log(`\nslowest: ${times.slice(0, 5).map(([ n, s ]) => `${n} ${s} s`).join(", ")}; all in ${Math.round((Date.now() - t0) / 1000)} s with ${JOBS} at once`);
console.log(failed ? `\n${failed} step(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
