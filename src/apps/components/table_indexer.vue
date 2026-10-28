<script>
import {
  CdxButton,
  CdxDialog,
  CdxMessage,
  CdxProgressBar,
} from "@wikimedia/codex";
import {
  APP_AD,
  api,
  close_app,
  find_template_ranges,
  get_page_info,
  splice,
  wgPageName,
} from "../../shared.js";

export default {
  components: { CdxButton, CdxDialog, CdxMessage, CdxProgressBar },

  data() {
    return {
      open: true,
      state: "ready",
      table_count: 0,
      error: "",
      success_text: "",
    };
  },

  methods: {
    close_app,

    async reindex_tables() {
      this.state = "indexing";
      this.error = "";

      try {
        const page = await get_page_info(wgPageName);
        if (!page) throw new Error("This page could not be found.");

        const ranges = find_template_ranges(page.text, "AIC article list");
        if (!ranges.length) {
          throw new Error("No tracking tables were found on this page.");
        }

        let new_text = page.text;
        for (let index = ranges.length - 1; index >= 0; index--) {
          const range = ranges[index];
          const template = new_text.slice(range.start, range.end);
          const without_indexes = template.replace(
            /\|\s*index\s*=[^|}]*/gi,
            "",
          );
          const indexed_template = without_indexes.replace(
            /^(\{\{\s*AIC article list\s*)\|/i,
            `$1|index=${index + 1}|`,
          );

          if (indexed_template === without_indexes) {
            throw new Error("A tracking table could not be reindexed.");
          }

          new_text = splice(new_text, range, indexed_template);
        }

        this.table_count = ranges.length;
        if (new_text !== page.text) {
          await api.postWithEditToken({
            action: "edit",
            title: wgPageName,
            text: new_text,
            summary: `Reindexed ${ranges.length} tracking table(s) ${APP_AD}`,
            baserevid: page.revid,
            starttimestamp: page.starttimestamp,
            nocreate: true,
          });
          this.success_text = `Reindexed ${this.table_count} tracking table(s). Reload the page for the
      updated indexes to take effect.`;
        } else {
          this.success_text = `No table needed to be reindexed. No changes made.`;
        }

        this.state = "complete";
      } catch (error) {
        this.error = error?.message ?? String(error);
        this.state = "ready";
      }
    },

    reload_page() {
      location.reload();
    },
  },
};
</script>

<template>
  <cdx-dialog
    v-model:open="open"
    title="Reindex tracking tables"
    :use-close-button="state !== 'indexing'"
    @update:open="close_app"
  >
    <template v-if="state === 'ready'">
      <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
      <p>
        This assigns each tracking table on this page a unique index. Indexes
        are used to resolve conflicts when multiple tables contain the same
        articles.
      </p>
    </template>

    <div v-else-if="state === 'indexing'" class="ainb-loading">
      <p>Reindexing tracking tables...</p>
      <cdx-progress-bar inline />
    </div>

    <cdx-message v-else type="success">
      {{ success_text }}
    </cdx-message>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div>
          <cdx-button v-if="state === 'ready'" @click="close_app">
            Cancel
          </cdx-button>
        </div>
        <div>
          <cdx-button
            v-if="state === 'ready'"
            action="progressive"
            weight="primary"
            @click="reindex_tables"
          >
            Reindex tables
          </cdx-button>
          <template v-else-if="state === 'complete'">
            <cdx-button @click="close_app">Close</cdx-button>
            <cdx-button
              action="progressive"
              weight="primary"
              @click="reload_page"
            >
              Reload page
            </cdx-button>
          </template>
        </div>
      </div>
    </template>
  </cdx-dialog>
</template>
