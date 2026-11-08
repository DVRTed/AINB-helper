export function find_template_ranges(text, template_name) {
  const opening = new RegExp(`\\{\\{\\s*${template_name}\\s*\\|`, "gi");
  const ranges = [];
  let match;

  while ((match = opening.exec(text))) {
    let depth = 0;
    let cursor = match.index;
    while (cursor < text.length) {
      if (text.startsWith("{{", cursor)) {
        depth++;
        cursor += 2;
      } else if (text.startsWith("}}", cursor)) {
        depth--;
        cursor += 2;
        if (depth === 0) break;
      } else {
        cursor++;
      }
    }

    if (depth === 0) ranges.push({ start: match.index, end: cursor });
    opening.lastIndex = cursor;
  }

  return ranges;
}

export function splice(text, { start, end }, replacement) {
  return text.slice(0, start) + replacement + text.slice(end);
}

export function find_article_rows(wikitext, raw_article = false) {
  const match_any_article = !raw_article;

  const article = match_any_article
    ? "([^|}]+?)"
    : mw.util.escapeRegExp(raw_article);

  const row_regex = new RegExp(
    `^\\{\\{[aA]IC article row\\s*\\|\\s*(?:article=)?\\s*${article}\\s*` +
      `(?:\\|\\s*(?:status=)?\\s*([^|]*))?` +
      `(?:\\|\\s*(?:notes=)?\\s*([\\s\\S]*))?\\}\\}$`,
  );

  const aic_rows = find_template_ranges(wikitext, "AIC article row");

  return aic_rows.flatMap(({ start, end }) => {
    const template_wikitext = wikitext.slice(start, end);
    const match = row_regex.exec(template_wikitext);

    if (!match) return [];

    match.index = start;
    match.end = end;
    return [match];
  });
}

export function replace_article_rows(wikitext, article, new_row) {
  const rows = find_article_rows(wikitext, article);

  // reverse to retain position
  for (const row of rows.reverse()) {
    wikitext = wikitext.slice(0, row.index) + new_row + wikitext.slice(row.end);
  }
  return wikitext;
}
