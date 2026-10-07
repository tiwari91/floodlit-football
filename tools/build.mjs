// Builds index.html (the one file GitHub Pages serves) from the parts in src/.
//   node tools/build.mjs          write index.html
//   node tools/build.mjs --check  exit 1 if index.html is not what src/ builds
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(root, "src", f), "utf8");
const strip = t => t.replace(/\n$/, "");
const order = read("game/ORDER.txt").trim().split("\n");
const game = order.map(f => strip(read(path.join("game", f)))).join("\n");
const out = [
	strip(read("head.html")),
	strip(read("body-top.html")),
	"<style>", strip(read("styles.css")), "</style>",
	strip(read("markup.html")),
	strip(read("three-loader.html")),
	"<script>", "(() => {", game, "})();", "</script>",
	strip(read("tail.html"))
].join("\n") + "\n";
const target = path.join(root, "index.html");
if (process.argv.includes("--check")) {
	const cur = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
	if (cur !== out) { console.error("index.html is out of date: run node tools/build.mjs"); process.exit(1); }
	console.log("index.html matches src/");
} else {
	fs.writeFileSync(target, out);
	console.log(`wrote index.html (${out.length} bytes, ${order.length} game sections)`);
}
