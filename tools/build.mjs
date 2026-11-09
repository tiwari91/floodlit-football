// Builds index.html (the one file GitHub Pages serves) from the parts in src/.
//   node tools/build.mjs          write index.html
//   node tools/build.mjs --check  exit 1 if index.html is not what src/ builds
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
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
// The 3D body and running clips are fetched by the page: each address carries a fingerprint of the file, so a browser
// that cached the old one (GitHub Pages lets it keep a copy ten minutes) fetches the new one as soon as it changes.
const stamped = out.replace(/"assets\/(body|anims)\.bin"/g, (m, n) => {
	const f = path.join(root, "assets", `${n}.bin`);
	return fs.existsSync(f) ? `"assets/${n}.bin?v=${crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8)}"` : m;
});
const target = path.join(root, "index.html");
if (process.argv.includes("--check")) {
	const cur = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
	if (cur !== stamped) { console.error("index.html is out of date: run node tools/build.mjs"); process.exit(1); }
	console.log("index.html matches src/");
} else {
	fs.writeFileSync(target, stamped);
	console.log(`wrote index.html (${stamped.length} bytes, ${order.length} game sections)`);
}
