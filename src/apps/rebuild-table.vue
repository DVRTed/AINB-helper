<script>
import {
  CdxButton,
  CdxCheckbox,
  CdxDialog,
  CdxMessage,
  CdxRadio,
} from "@wikimedia/codex";
import MainApp, { build_table_text } from "./main-app.vue";
import { normalize_status } from "./edit-table.vue";
import {
  APP_AD,
  api,
  close_app,
  get_all_article_row_regex,
  get_page_info,
  normalize_title,
} from "../shared.js";
import { find_template_ranges, splice } from "../template-helpers.js";

export default {
  components: {
    CdxButton,
    CdxCheckbox,
    CdxDialog,
    CdxMessage,
    CdxRadio,
    MainApp,
  },

  props: {
    initial_username: { type: String, default: "" },
    initial_case_page: { type: String, default: "" },
    initial_is_custom_case_page: { type: Boolean, default: false },

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
      delete_missing_mode: "todo",
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

    // determine if an existing row that the rebuild
    // didn't generate should stay in the table
    should_keep_missing_row(row) {
      // "delete missing entries" isn't checked, so keep this (and all) row(s)
      if (!this.delete_missing_entries) return true;

      // suboption "delete all rows" is selected, so we don't keep this row
      if (this.delete_missing_mode === "all") return false;

      // suboption "only delete to-do rows" is selected,
      //  so we check if it's todo
      // if todo delete, else keep
      const is_todo = normalize_status(row.status) === "requested";
      return !is_todo;
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

        // re-add existing rows the rebuild didn't produce... based on the option
        const generated_keys = new Set(
          rows.map((row) => normalize_title(row.article)),
        );
        const kept_missing_rows = Object.entries(existing_rows)
          .filter(([article_key]) => !generated_keys.has(article_key))
          .map(([, row]) => row)
          .filter((row) => this.should_keep_missing_row(row));

        rows = [...rows, ...kept_missing_rows];

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

        const edit_summary_details = [];

        if (this.retain_existing_statuses) {
          edit_summary_details.push("retain statuses");
        } else {
          edit_summary_details.push("reset statuses");
        }

        if (this.delete_missing_entries) {
          if (this.delete_missing_mode === "todo") {
            edit_summary_details.push("delete missing to-dos");
          } else {
            edit_summary_details.push("delete all missing entries");
          }
        } else {
          edit_summary_details.push("keep missing entries");
        }

        const edit_summary = `Rebuilding tracking table: ${edit_summary_details.join(", ")}`;

        await api.postWithEditToken({
          action: "edit",
          title: this.target_page_title,
          text: new_text,
          summary: `${edit_summary} ${APP_AD}`,
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

        <div class="ainb-rebuild-suboptions">
          <cdx-radio
            v-model="delete_missing_mode"
            input-value="todo"
            name="delete-missing-mode"
            :disabled="!delete_missing_entries"
          >
            Delete only to-do entries
            <template #description>
              Only delete missing entries that are marked as "To-do".
            </template>
          </cdx-radio>

          <cdx-radio
            v-model="delete_missing_mode"
            input-value="all"
            name="delete-missing-mode"
            :disabled="!delete_missing_entries"
          >
            Delete all missing entries
          </cdx-radio>
        </div>
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
      :initial_case_page="initial_case_page"
      :initial_is_custom_case_page="initial_is_custom_case_page"
      :initial_anchor_date="initial_anchor_date"
      :initial_end_date="initial_end_date"
      :on_table_generated="handle_table_generated"
    />
  </div>
</template>

<style>
.ainb-rebuild-suboptions {
  margin-left: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
