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
