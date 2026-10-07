// Runs every check: the build is current, then the three browser suites in turn.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const step of [ [ "tools/build.mjs", "--check" ], [ "tests/switch.mjs" ], [ "tests/phone.mjs" ], [ "tests/move.mjs" ], [ "tests/club.mjs" ], [ "tests/intro.mjs" ] ]) {
	console.log(`\n=== ${step[0]}`);
	const r = spawnSync("node", step.map((a, i) => (i === 0 ? path.join(here, "..", a) : a)), { stdio: "inherit" });
	if (r.status !== 0) { failed++; }
}
console.log(failed ? `\n${failed} step(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
