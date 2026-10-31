<script>
import { nextTick } from "vue";
import { CdxButton, CdxCheckbox, CdxDialog } from "@wikimedia/codex";
import { api } from "../../shared.js";

export default {
  name: "DiffView",

  components: { CdxButton, CdxCheckbox, CdxDialog },

  props: {
    // the edit currently being viewed
    edit: { type: Object, default: null },
    // all edits (for prev/next/jump)
    edits: { type: Array, default: () => [] },
  },

  emits: ["update:edit", "set-selected"],

  data() {
    return {
      //  { [revid]: { loading: boolean, content: string } }
      diffs: {},
    };
  },

  computed: {
    is_open() {
      return !!this.edit;
    },

    current_diff() {
      return this.edit ? this.diffs[this.edit.revid] : null;
    },

    edit_index() {
      if (!this.edit) return -1;
      return this.edits.findIndex((e) => e.revid === this.edit.revid);
    },

    has_prev() {
      return this.edit_index > 0;
    },

    has_next() {
      return this.edit_index >= 0 && this.edit_index < this.edits.length - 1;
    },
  },

  watch: {
    edit: {
      immediate: true,
      handler(edit) {
        if (edit) this.load_diff(edit);
      },
    },
  },

  methods: {
    handle_open_update(open) {
      if (!open) this.close();
    },

    close() {
      this.$emit("update:edit", null);
    },

    go_to(offset) {
      if (this.edit_index < 0) return;
      const next = this.edits[this.edit_index + offset];
      if (next) this.$emit("update:edit", next);
    },

    jump_to(revid) {
      const target = this.edits.find((e) => e.revid == revid);
      if (target) this.$emit("update:edit", target);
    },

    build_compare_params(edit) {
      const base = {
        action: "compare",
        prop: "diff|ids|timestamp",
        formatversion: 2,
      };
      if (edit.new !== undefined) {
        return {
          ...base,
          fromslots: "main",
          "fromtext-main": "",
          "fromcontentmodel-main": "wikitext",
          torev: edit.revid,
        };
      }
      return { ...base, fromrev: edit.revid, torelative: "prev" };
    },

    async load_diff(edit) {
      const id = edit.revid;
      if (this.diffs[id]) return;

      this.diffs[id] = { loading: true, content: "" };
      let content;
      try {
        const response = await api.get(this.build_compare_params(edit));

        const compare = response.compare;
        if (!compare) {
          content = "<p>Could not load diff.</p>";
        } else if (!compare.body) {
          content = "<p>No changes</p>";
        } else {
          content = this.build_table(compare);
        }
        nextTick(() => {
          const $content = $(this.$refs.diff_content);
          if ($content.length) mw.hook("wikipage.content").fire($content);
        });
      } catch (error) {
        console.error("Error loading diff:", error);
        content = `<p>Error loading diff</p>`;
      }
      this.diffs[id] = { loading: false, content };
    },

    build_table(compare) {
      const side = (revid, timestamp, fallback) => {
        if (!revid) return fallback;
        const link = `<a href="
          ${mw.util.getUrl(`Special:PermanentLink/${revid}`)}" target="_blank">Revision ${revid}</a>`;
        const when = timestamp
          ? ` &middot; ${this.format_date(timestamp)}`
          : "";
        return link + when;
      };

      const before = side(
        compare.fromrevid,
        compare.fromtimestamp,
        "(no previous revision)",
      );
      const after = side(compare.torevid, compare.totimestamp, "");

      return (
        `<table class="diff diff-contentalign-left">` +
        `<colgroup>` +
        `<col class="diff-marker"><col class="diff-content">` +
        `<col class="diff-marker"><col class="diff-content">` +
        `</colgroup>` +
        `<tbody>` +
        `<tr class="diff-title">` +
        `<td colspan="2" class="diff-otitle">${before}</td>` +
        `<td colspan="2" class="diff-ntitle">${after}</td>` +
        `</tr>` +
        compare.body +
        `</tbody></table>`
      );
    },

    get_diff_url(revid) {
      return mw.util.getUrl(`Special:Diff/${revid}`);
    },

    format_bytes(bytes) {
      return (bytes > 0 ? "+" : "") + (bytes || 0);
    },

    format_date(timestamp) {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      });
    },

    get_size_class(bytes) {
      return bytes > 0 ? "ainb-pos" : bytes < 0 ? "ainb-neg" : "ainb-neu";
    },
  },
};
</script>

<template>
  <cdx-dialog
    :open="is_open"
    :title="edit ? 'Diff for ' + edit.title : ''"
    :use-close-button="true"
    class="ainb-diff-dialog"
    @update:open="handle_open_update"
    @keyup.left="go_to(-1)"
    @keyup.right="go_to(1)"
  >
    <div v-if="edit" class="ainb-diff-dialog-body">
      <div class="ainb-diff-meta">
        <select
          v-if="edits.length > 1"
          class="ainb-diff-select"
          :value="edit.revid"
          @change="jump_to($event.target.value)"
        >
          <option v-for="(e, idx) in edits" :key="e.revid" :value="e.revid">
            {{ idx + 1 }} / {{ edits.length }} —
            {{ format_date(e.timestamp) }} ({{ format_bytes(e.sizediff) }})
          </option>
        </select>
        <a
          :href="get_diff_url(edit.revid)"
          target="_blank"
          class="ainb-diff-meta-link"
        >
          Open in new tab &#8599;
        </a>
      </div>

      <div class="ainb-diff-meta-include">
        <cdx-checkbox
          :model-value="edit.selected"
          @update:model-value="$emit('set-selected', edit, $event)"
        >
          Include
        </cdx-checkbox>
      </div>

      <div class="ainb-diff-meta-comment" :title="edit.comment">
        <span :class="['ainb-diff-meta-size', get_size_class(edit.sizediff)]">
          {{ format_bytes(edit.sizediff) }} bytes
        </span>
        &middot; <span class="ainb-diff-meta-comment-label">Summary:</span>
        {{ edit.comment || "No edit summary" }}
      </div>

      <div v-if="current_diff?.loading" class="ainb-diff-loading">
        Loading diff...
      </div>
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-else-if="current_diff?.content"
        ref="diff_content"
        class="ainb-diff-content"
        v-html="current_diff.content"
      ></div>
      <!-- eslint-enable vue/no-v-html -->
      <div v-else class="ainb-diff-loading">No content loaded.</div>
    </div>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div class="ainb-diff-nav">
          <cdx-button :disabled="!has_prev" @click="go_to(-1)">
            &larr; Prev
          </cdx-button>
          <cdx-button :disabled="!has_next" @click="go_to(1)">
            Next &rarr;
          </cdx-button>
        </div>
        <cdx-button @click="close">Close</cdx-button>
      </div>
    </template>
  </cdx-dialog>
</template>

<style>
.ainb-diff-content {
  overflow-x: auto;
}

.ainb-diff-content table.diff {
  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
}

.ainb-diff-content table.diff td.diff-otitle,
.ainb-diff-content table.diff td.diff-ntitle {
  padding: 0.25rem 0.5rem;
  font-size: 0.85em;
  text-align: left;
  border-bottom: 1px solid var(--ainb-border-color-subtle);
}

.ainb-diff-content table.diff td.diff-lineno {
  font-weight: bold;
}

.ainb-diff-content table.diff td div {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
