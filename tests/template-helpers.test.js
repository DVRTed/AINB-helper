import assert from "node:assert/strict";
import test from "node:test";

import {
  find_article_rows,
  replace_article_rows,
} from "../src/template-helpers.js";

globalThis.mw = {
  util: {
    escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },
  },
};

test("basic AIC row args", () => {
  const notes =
    "24 edits: [[Special:Diff/768763|(+70)]] [[Special:Diff/768500|(+314)]] [[Special:Diff/765391|(+5)]] [[Special:Diff/762815|(+330)]] [[Special:Diff/762814|(-2679)]] [[Special:Diff/762811|(+88)]] [[Special:Diff/762776|(+331)]] [[Special:Diff/762774|(+90)]] [[Special:Diff/762772|(+283)]] [[Special:Diff/762716|(+88)]] [[Special:Diff/762713|(+88)]] [[Special:Diff/762710|(+88)]] [[Special:Diff/762707|(+318)]] [[Special:Diff/762691|(+318)]] [[Special:Diff/762688|(+88)]] [[Special:Diff/762686|(+318)]] [[Special:Diff/762684|(+88)]] [[Special:Diff/762682|(+88)]] [[Special:Diff/762681|(+88)]] [[Special:Diff/762678|(+318)]] [[Special:Diff/762677|(-88)]] [[Special:Diff/762676|(+88)]] [[Special:Diff/759773|(-85)]] [[Special:Diff/759772|(+85)]]";
  const rows = find_article_rows(
    `{{AIC article row|article=BS Nymph|status=requested|notes=${notes}}}`,
    "BS Nymph",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], "BS Nymph");
  assert.equal(rows[0][2], "requested");
  assert.equal(rows[0][3], notes);
});

test("positional AIC row args", () => {
  const rows = find_article_rows(
    "{{AIC article row|Example|completed|This is notes!}}",
    "Example",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], "Example");
  assert.equal(rows[0][2], "completed");
  assert.equal(rows[0][3], "This is notes!");
});

test("case sensitivity", () => {
  const wikitext = "{{AIC article row|Example|completed}}";

  assert.equal(find_article_rows(wikitext, "Example").length, 1);
  assert.equal(find_article_rows(wikitext, "example").length, 0);
});

test("treats punctuations literally", () => {
  const rows = find_article_rows(
    "{{AIC article row|Far/Boo (test)|completed}}",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], "Far/Boo (test)");
  assert.equal(rows[0][2], "completed");
});

test("handles nested templates in notes", () => {
  const notes =
    "{{cite|title=Example|url=https://example.test}} {{slink|WP:ANI}}";
  const rows = find_article_rows(
    `Before {{AIC article row|Example|completed|${notes}}} After`,
    "Example",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0][3], notes);
});

// updating rows
test("replaces a matching AIC row", () => {
  const wikitext =
    "Before {{AIC article row|article=Bob Morley|status=completed|notes=2 edits: [[Special:Diff/782418|(+314)]] [[Special:Diff/762028|(+342)]]}} After";

  assert.equal(
    replace_article_rows(
      wikitext,
      "Bob Morley",
      "{{AIC article row|Example|new}}",
    ),
    "Before {{AIC article row|Example|new}} After",
  );
});

test("leaves non-matching article rows unchanged", () => {
  const wikitext = "{{AIC article row|completed|old}}";

  assert.equal(
    replace_article_rows(
      wikitext,
      "Example",
      "{{AIC article row|completed|new}}",
    ),
    wikitext,
  );
});

test("replaces multiple matches w/out shifting surrounding text", () => {
  const wikitext =
    "Start {{AIC article row|Example|first}} Middle {{AIC article row|Example|second}} End";

  assert.equal(
    replace_article_rows(
      wikitext,
      "Example",
      "{{AIC article row|Example|new}}",
    ),
    "Start {{AIC article row|Example|new}} Middle {{AIC article row|Example|new}} End",
  );
});
