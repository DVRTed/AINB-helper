<script>
import {
  CdxButton,
  CdxCheckbox,
  CdxDialog,
  CdxMessage,
} from "@wikimedia/codex";
import Main, { build_article_row } from "./main.vue";
import {
  APP_AD,
  api,
  close_app,
  get_all_article_row_regex,
  get_page_info,
  find_template_ranges,
  normalize_title,
} from "./shared.js";

export default {
  components: { CdxButton, CdxCheckbox, CdxDialog, CdxMessage, Main },

  props: {
    initial_username: { type: String, default: "" },
    initial_anchor_date: { type: String, default: "" },
    initial_end_date: { type: String, default: "" },
    target_page_title: { type: String, required: true },
    target_table_index: { type: Number, required: true },
  },

  data() {
    return {
      app_started: false,

      options_open: true,
      retain_existing_statuses: true,
      delete_missing_entries: true,
    };
  },

  methods: {
    close_app() {
      close_app();
    },

    continue_to_main() {
      this.app_started = true;
      this.options_open = false;
    },

    handle_options_dialog(open) {
      if (!open && !this.app_started) close_app();
    },

    async handle_wikitext_generated(new_generated_wikitext) {
      try {
        const page = await get_page_info(this.target_page_title);
        if (!page) throw new Error("The case page no longer exists.");

        // get ranges of the EXISTING {{AIC article list}} template
        const template_ranges = find_template_ranges(
          page.text,
          "AIC article list",
        );

        // find the relevant one, i.e., the table we're updating, if multiple
        const old_range = template_ranges[this.target_table_index];
        if (!old_range) {
          throw new Error("The selected tracking table could not be found.");
        }

        // entire wikitext in that range excl. comments
        const range_text = page.text
          .slice(old_range.start, old_range.end)
          .replace(/<!--[\s\S]*?-->/g, "");
        const existing_rows = {};
        const existing_statuses = {};

        // collect all rows and statuses
        const rows_match = range_text.matchAll(get_all_article_row_regex());
        for (const match of rows_match) {
          const entry = match[0];
          const article = match[1].trim();
          const article_key = normalize_title(article);
          const status = match[2]?.trim();

          if (article_key in existing_rows) {
            // article is repeated in the same table... why?
            continue;
          }

          existing_rows[article_key] = entry;
          if (status) existing_statuses[article_key] = status;
        }

        // get ranges of the NEW {{AIC article list}} template
        const new_template_range = find_template_ranges(
          new_generated_wikitext,
          "AIC article list",
        )[0]; // doesn't generate more than one table/template

        if (!new_template_range) throw new Error("Corrupted new wikitext.");
        let replacement = new_generated_wikitext.slice(
          new_template_range.start,
          new_template_range.end,
        );

        const new_rows_match = replacement.matchAll(
          get_all_article_row_regex(),
        );

        const generated_articles = new Set(
          [...new_rows_match].map((m) => normalize_title(m[1].trim())), // that's article name, Set dedupes it
        );

        // restore older statuses
        if (this.retain_existing_statuses) {
          replacement = replacement.replace(
            get_all_article_row_regex(),
            (row, article, _status, notes) => {
              const old_status =
                existing_statuses[normalize_title(article.trim())];
              if (!old_status) return row;
              return build_article_row(article, old_status, notes);
            },
          );
        }

        // restore old rows that the new generation doesn't include
        if (!this.delete_missing_entries) {
          const missing_rows = Object.entries(existing_rows)
            .filter(([article_key]) => !generated_articles.has(article_key))
            .map(([, row]) => row);

          if (missing_rows.length) {
            const closing_braces = replacement.lastIndexOf("}}");
            replacement =
              replacement.slice(0, closing_braces) +
              `\n${missing_rows.join("\n")}\n` +
              replacement.slice(closing_braces);
          }
        }

        const new_text =
          page.text.slice(0, old_range.start) +
          replacement +
          page.text.slice(old_range.end);

        await api.postWithEditToken({
          action: "edit",
          title: this.target_page_title,
          text: new_text,
          summary: `Updating tracking table ${APP_AD}`,
          baserevid: page.revid,
          starttimestamp: page.starttimestamp,
          nocreate: true,
        });

        mw.notify("Tracking table updated.", { type: "success" });
        close_app();
        location.reload();
      } catch (error) {
        console.error(error);
        mw.notify(
          "Error updating tracking table: " + (error?.message ?? String(error)),
          { type: "error" },
        );
      }
    },
  },
};
</script>

<template>
  <div>
    <cdx-dialog
      v-model:open="options_open"
      title="Update tracking table"
      :use-close-button="true"
      @update:open="handle_options_dialog"
    >
      <div class="ainb-update-options">
        <cdx-message type="warning">
          Disclaimer: Updating a tracking list can remove entries or reset their
          statuses. Review the options carefully before continuing.
        </cdx-message>
        <cdx-checkbox v-model="retain_existing_statuses">
          Retain statuses of existing entries
          <template #description>
            Keep the statuses (e.g., Completed, Ongoing) of existing entries
            unchanged.
          </template>
        </cdx-checkbox>

        <cdx-checkbox v-model="delete_missing_entries">
          Delete entries not found in the new generation
          <template #description>
            Delete rows that are in the current table but weren't produced by
            the new generation.
          </template>
        </cdx-checkbox>
      </div>

      <template #footer>
        <div class="ainb-dialog-footer">
          <cdx-button @click="close_app">Cancel</cdx-button>
          <cdx-button
            action="progressive"
            weight="primary"
            @click="continue_to_main"
          >
            Continue
          </cdx-button>
        </div>
      </template>
    </cdx-dialog>

    <Main
      v-if="app_started"
      :initial_username="initial_username"
      :initial_anchor_date="initial_anchor_date"
      :initial_end_date="initial_end_date"
      :on_wikitext_generated="handle_wikitext_generated"
    />
  </div>
</template>

<style lang="scss">
.ainb-update-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
