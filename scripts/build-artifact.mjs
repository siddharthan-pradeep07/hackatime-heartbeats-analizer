#!/usr/bin/env node
// Inlines the production build (dist/assets/*.js + *.css, plus the Hack Club
// logo copied verbatim from public/) into a single self-contained HTML file:
// title + style + #root + a module script, with no <!DOCTYPE>/<html>/<head>/
// <body> wrapper. That shape is what Claude's Artifact tool expects when
// publishing a static single-page app as a shareable preview.
//
// The Artifact sandbox's CSP blocks cross-origin font and image fetches, so
// the Phantom Sans @font-face rules and the top-right Hack Club banner are
// rewritten here to embed the actual files (fetched fresh from Hack Club's
// CDN) as base64 data: URIs — the .woff fallback lines are left pointing at
// the CDN, unused by any modern browser.
//
// Run `npm run build` first, then `node scripts/build-artifact.mjs`.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join("dist", "assets");
const files = readdirSync(assetsDir);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));
if (!jsFile || !cssFile) {
  console.error('No built JS/CSS found in dist/assets — run "npm run build" first.');
  process.exit(1);
}

let js = readFileSync(join(assetsDir, jsFile), "utf8");
let css = readFileSync(join(assetsDir, cssFile), "utf8");

// The logo is referenced in the bundle as a root-relative "/hack-club-icon.svg"
// URL, which only resolves on a server that actually has that file — the
// Artifact's own origin doesn't. Inline it as a data: URI instead.
const logoSvg = readFileSync(join("dist", "hack-club-icon.svg"), "utf8");
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;
js = js.split("/hack-club-icon.svg").join(logoDataUri);

// The top-right Hack Club year banner is built from a template literal
// (`https://assets.hackclub.com/banners/${year}.svg`) rather than a fixed
// string, so it can't be inlined with a plain .split().join() the way the
// logo is — fetch this year's banner and replace the whole template literal
// with a quoted data: URI string.
const bannerYear = new Date().getFullYear();
const bannerUrl = `https://assets.hackclub.com/banners/${bannerYear}.svg`;
const bannerRes = await fetch(bannerUrl);
if (bannerRes.ok) {
  const bannerSvg = Buffer.from(await bannerRes.arrayBuffer());
  const bannerDataUri = `data:image/svg+xml;base64,${bannerSvg.toString("base64")}`;
  const bannerTemplatePattern = /`https:\/\/assets\.hackclub\.com\/banners\/\$\{[^}]+\}\.svg`/;
  if (bannerTemplatePattern.test(js)) {
    js = js.replace(bannerTemplatePattern, JSON.stringify(bannerDataUri));
  } else {
    console.error("Could not find the banner template literal in the bundle to inline — check HackClubBanner.tsx still matches this pattern.");
  }
} else {
  console.error(`Could not fetch ${bannerUrl} (${bannerRes.status}) — leaving the banner as an external reference.`);
}

// Same problem for the Phantom Sans webfonts: fetch each woff2 and inline it.
const FONT_BASE = "https://assets.hackclub.com/fonts/Phantom_Sans_0.7/";
for (const weight of ["Regular", "Italic", "Bold"]) {
  const url = `${FONT_BASE}${weight}.woff2`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Could not fetch ${url} (${res.status}) — leaving it as an external reference.`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  css = css.split(url).join(`data:font/woff2;base64,${buf.toString("base64")}`);
  // Drop the now-redundant .woff fallback src (unreachable in the Artifact
  // sandbox, and unnecessary — every modern browser takes the woff2 above).
  css = css.split(`,url(${FONT_BASE}${weight}.woff) format("woff")`).join("");
}

if (js.includes("</script")) {
  console.error("Bundled JS contains a literal `</script` sequence — inlining it would truncate the tag. Aborting.");
  process.exit(1);
}

const out = [
  "<title>Hackatime Heartbeats Visualizer</title>",
  "<style>",
  css,
  "</style>",
  '<div id="root"></div>',
  '<script type="module">',
  js,
  "</script>",
].join("\n");

const outPath = "artifact-build.html";
writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${out.length.toLocaleString()} bytes). Publish this file with the Artifact tool.`);
