<script>
const link = String.raw`\[\[Special:Diff/(\d+)\|\(([+-]\d+|0)\)\]\]`;
const link_run_regex = new RegExp(`${link}(?:\\s+${link})*`, "gi");
const link_regex = new RegExp(link, "gi");

export default {
  name: "NoteEditor",

  props: {
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: "Notes" },
  },

  emits: ["update:modelValue"],

  data() {
    return { last_emitted_value: null };
  },

  watch: {
    modelValue(value) {
      if (value !== this.last_emitted_value) this.render_value(value);
    },
  },

  mounted() {
    this.render_value(this.modelValue);
  },

  methods: {
    render_value(value) {
      const editor = this.$refs.editor;
      editor.replaceChildren();
      let cursor = 0;

      for (const match of value.matchAll(link_run_regex)) {
        editor.append(value.slice(cursor, match.index));
        editor.append(this.make_placeholder(match[0]));
        cursor = match.index + match[0].length;
      }
      editor.append(value.slice(cursor));
    },

    make_placeholder(wikitext) {
      const span = document.createElement("span");
      span.className = "ainb-note-diff-placeholder";
      span.contentEditable = "false";
      span.dataset.wikitext = wikitext;

      const diff_count = [...wikitext.matchAll(link_regex)].length;

      const links = document.createElement("span");
      links.hidden = diff_count >= 10;

      for (const [, id, change] of wikitext.matchAll(link_regex)) {
        const a = document.createElement("a");
        a.href = `/wiki/Special:Diff/${id}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = id;

        const change_node = document.createElement("span");
        change_node.className =
          change[0] === "+"
            ? "ainb-note-diff-sign-added"
            : change[0] === "-"
              ? "ainb-note-diff-sign-removed"
              : "";
        change_node.textContent = ` (${change})`;

        links.append(" ", a, change_node);
      }

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ainb-note-diff-toggle";
      toggle.textContent = links.hidden ? "show diffs" : "hide diffs";
      toggle.addEventListener("click", () => {
        links.hidden = !links.hidden;
        toggle.textContent = links.hidden ? "show diffs" : "hide diffs";
      });

      const wrapper = document.createElement("span");
      wrapper.className = "ainb-note-diff-wrapper";
      wrapper.append(toggle, links);
      span.append(wrapper, " ");
      return span;
    },

    node_to_text(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
      if (node.dataset?.wikitext) return node.dataset.wikitext;
      if (node.tagName === "BR") return "\n";

      return [...node.childNodes]
        .map((child, i, all) => {
          const text = this.node_to_text(child);
          return i < all.length - 1 && child.tagName === "DIV"
            ? `${text}\n`
            : text;
        })
        .join("");
    },

    on_input() {
      const value = this.node_to_text(this.$refs.editor);
      this.last_emitted_value = value;
      this.$emit("update:modelValue", value);
    },
  },
};
</script>

<template>
  <div
    ref="editor"
    class="ainb-notes-editor"
    :contenteditable="!disabled"
    :aria-disabled="disabled"
    :aria-label="label"
    role="textbox"
    aria-multiline="true"
    @input="on_input"
  ></div>
</template>

<style>
.ainb-notes-editor {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--ainb-border-color-base);
  border-radius: 2px;
  background: var(--ainb-background-color-base);
  color: var(--ainb-color-base);
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ainb-note-diff-wrapper {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--ainb-border-color-muted);
  border-radius: 2px;
  background: var(--ainb-background-color-interactive-subtle);
  color: var(--ainb-color-subtle);
}

.ainb-note-diff-wrapper:has(.ainb-note-diff-toggle:hover) {
  background: var(--ainb-background-color-progressive-subtle);
  button {
    color: var(--ainb-color-progressive);
  }
}

.ainb-note-diff-toggle {
  border: none;
  padding: 0;
  background: transparent;
  font-size: 0.85em;
  cursor: pointer;
  white-space: nowrap;
}

.ainb-note-diff-sign-added {
  color: var(--ainb-color-success);
}

.ainb-note-diff-sign-removed {
  color: var(--ainb-color-destructive);
}
</style>
