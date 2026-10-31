<script>
import { CdxButton, CdxDialog } from "@wikimedia/codex";
import { api } from "../../shared.js";

export default {
  name: "PreviewDialog",

  components: { CdxButton, CdxDialog },

  props: {
    open: { type: Boolean, default: false },
    wikitext: { type: String, default: "" },
    title: { type: String, default: "" },
  },

  emits: ["update:open"],

  data() {
    return {
      loading: false,
      html: "",
    };
  },

  watch: {
    // fetch a fresh preview every time the dialog opens
    open(is_open) {
      if (is_open) this.load_preview();
    },
  },

  methods: {
    async load_preview() {
      this.loading = true;
      this.html = "";
      try {
        const res = await api.post({
          action: "parse",
          text: this.wikitext,
          title: this.title,
          pst: true,
          prop: "text",
        });
        this.html = res.parse?.text?.["*"] || "Could not generate preview.";
      } catch (err) {
        console.error("Preview error:", err);
        this.html = `Preview error: ${err?.message ?? String(err)}`;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <cdx-dialog
    :open="open"
    title="Preview"
    :use-close-button="true"
    class="ainb-preview-dialog"
    @update:open="$emit('update:open', $event)"
  >
    <div v-if="loading" class="ainb-loading">Loading preview...</div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="ainb-preview-content" v-html="html"></div>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div></div>
        <cdx-button @click="$emit('update:open', false)">Close</cdx-button>
      </div>
    </template>
  </cdx-dialog>
</template>
