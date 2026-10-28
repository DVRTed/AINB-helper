import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
const USYNC_BANNER =
  "// {{Wikipedia:USync |repo=https://github.com/DVRTed/AINB-helper |ref=refs/heads/production |path=changelog.js}}\n";

const md = existsSync("CHANGELOG.md")
  ? readFileSync("CHANGELOG.md", "utf8")
  : "";

const wikitext = md
  .split("\n")
  .filter((l) => !/^# Changelog/.test(l))
  .map((l) =>
    l
      .replace(/^## \[([^\]]+)\]\([^)]*\) \((.+)\)/, "== $1 ($2) ==")
      .replace(/^## (\S+) \((.+)\)/, "== $1 ($2) ==")
      .replace(/^### (.+)/, "=== $1 ===")
      .replace(/\*\*(.+?)\*\*/g, "'''$1'''")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[$2 $1]"),
  )
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\*\//g, "* /")
  .replace(/<\/?nowiki>/gi, "")
  .trim();

mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/changelog.js",
  `${USYNC_BANNER}/* <nowiki>\n${wikitext}\n</nowiki> */\n`,
);
