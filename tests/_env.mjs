// Shared plumbing for the browser checks. Playwright and Chrome are not dependencies of the game:
// point FF_PLAYWRIGHT_FROM at a package.json whose node_modules has playwright (default: a local
// install next to the repo) and FF_CHROME at a Chrome binary (default: the Mac app path).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = path.join(root, "tests", "out");
fs.mkdirSync(OUT, { recursive: true });
const from = process.env.FF_PLAYWRIGHT_FROM || path.join(root, "package.json");
export const { chromium, devices } = createRequire(from)("playwright");
export const CHROME = process.env.FF_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function serve (port) {
	const server = spawn("python3", [ "-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", root ], { stdio: "ignore" });
	return { url: `http://127.0.0.1:${port}/index.html?test`, stop: () => server.kill() };
}
export function launch () {
	return chromium.launch({ executablePath: CHROME, headless: true, args: [ "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required" ] });
}
export function tally () {
	let pass = 0, fail = 0;
	const check = (name, ok, detail = "") => { if (ok) { pass++; } else { fail++; } console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
	const done = () => { console.log(`\n${pass} passed, ${fail} failed`); return fail; };
	return { check, done };
}
