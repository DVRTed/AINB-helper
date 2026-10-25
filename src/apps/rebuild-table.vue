<script>
import {
  CdxButton,
  CdxCheckbox,
  CdxDialog,
  CdxMessage,
} from "@wikimedia/codex";
import MainApp, { build_table_text } from "./main-app.vue";
import {
  APP_AD,
  api,
  close_app,
  get_all_article_row_regex,
  get_page_info,
  find_template_ranges,
  normalize_title,
  splice,
} from "../shared.js";

export default {
  components: { CdxButton, CdxCheckbox, CdxDialog, CdxMessage, MainApp },

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

    // data = { infocard: { user, start_date, end_date }, notes, rows: [{ article, status, notes }] }
    async handle_table_generated(data) {
      try {
        const page = await get_page_info(this.target_page_title);
        if (!page) throw new Error("The case page no longer exists.");

        // get ranges of the EXISTING {{AIC article list}} template
        const template_ranges = find_template_ranges(
          page.text,
          "AIC article list",
        );

        // find the relevant one, i.e., the table we're rebuilding, if multiple
        const old_range = template_ranges[this.target_table_index];
        if (!old_range) {
          throw new Error("The selected tracking table could not be found.");
        }

        // entire wikitext in that range excl. comments
        const range_text = page.text
          .slice(old_range.start, old_range.end)
          .replace(/<!--[\s\S]*?-->/g, "");

        // existing rows keyed by article
        const existing_rows = {};
        for (const match of range_text.matchAll(get_all_article_row_regex())) {
          const article = match[1].trim();
          const article_key = normalize_title(article);
          if (article_key in existing_rows) continue; // article is repeated in the same table... why?

          existing_rows[article_key] = {
            article,
            status: match[2]?.trim() ?? "",
            notes: match[3]?.trim() ?? "",
          };
        }

        let rows = data.rows;

        // restore older statuses
        if (this.retain_existing_statuses) {
          rows = rows.map((row) => {
            const old_status =
              existing_rows[normalize_title(row.article)]?.status;
            return old_status ? { ...row, status: old_status } : row;
          });
        }

        // restore old rows that the new generation doesn't include
        if (!this.delete_missing_entries) {
          const generated_articles = new Set(
            rows.map((row) => normalize_title(row.article)),
          );
          const missing_rows = Object.entries(existing_rows)
            .filter(([article_key]) => !generated_articles.has(article_key))
            .map(([, row]) => row);
          rows = [...rows, ...missing_rows];
        }

        // after the previous table (if any) and before this table
        const previous_table_end =
          template_ranges[this.target_table_index - 1]?.end ?? 0;
        const old_infocard_range = find_template_ranges(page.text, "InfoCard")
          .filter(
            (r) => r.start >= previous_table_end && r.end <= old_range.start,
          )
          .pop();

        if (!old_infocard_range) {
          // this app doesn't run unless there's an infocard,
          // so this shouldn't happen
          throw new Error("InfoCard range not found.");
        }

        const new_text = splice(
          page.text,
          { start: old_infocard_range.start, end: old_range.end },
          build_table_text({ ...data, rows }).trimEnd(),
        );

        await api.postWithEditToken({
          action: "edit",
          title: this.target_page_title,
          text: new_text,
          summary: `Rebuilding tracking table ${APP_AD}`,
          baserevid: page.revid,
          starttimestamp: page.starttimestamp,
          nocreate: true,
        });

        mw.notify("Tracking table rebuilt.", { type: "success" });
        close_app();
        location.reload();
      } catch (error) {
        console.error(error);
        mw.notify(
          "Error rebuilding tracking table: " +
            (error?.message ?? String(error)),
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
      title="Rebuild tracking table"
      :use-close-button="true"
      @update:open="handle_options_dialog"
    >
      <div class="ainb-update-options">
        <cdx-message type="warning">
          This will replace the notes parameter of each entry with the latest
          edits, removing any existing custom notes.
        </cdx-message>

        <cdx-checkbox v-model="retain_existing_statuses">
          Retain statuses of existing entries
          <template #description>
            Keep the statuses (e.g., Completed, Ongoing) of existing entries
            unchanged.
          </template>
        </cdx-checkbox>

        <cdx-checkbox v-model="delete_missing_entries">
          Delete entries not found in the rebuilt list
          <template #description>
            Delete entries that are in the current table but weren't produced by
            the rebuild.
          </template>
        </cdx-checkbox>
        <cdx-message type="warning">
          Rebuilding a tracking list can remove entries or reset their statuses,
          which may not be desirable in every situation; review the options
          carefully before continuing.
        </cdx-message>
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

    <MainApp
      v-if="app_started"
      :initial_username="initial_username"
      :initial_anchor_date="initial_anchor_date"
      :initial_end_date="initial_end_date"
      :on_table_generated="handle_table_generated"
    />
  </div>
</template>
