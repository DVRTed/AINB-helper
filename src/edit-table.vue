<script>
import {
  CdxButton,
  CdxDialog,
  CdxProgressBar,
  CdxSelect,
  CdxTextArea,
  CdxTextInput,
} from "@wikimedia/codex";

import {
  APP_AD,
  api,
  close_app,
  get_article_row_regex,
  get_article_url,
  get_history_url,
  get_page_info,
} from "./shared.js";
import { add_page_buttons } from "./register-actions.js";
import { build_article_row } from "./main.vue";

export default {
  name: "EditRow",

  components: {
    CdxButton,
    CdxDialog,
    CdxProgressBar,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
  },

  props: {
    articles_input: {
      type: [Array, Object],
      required: true,
    },
  },

  data() {
    return {
      // meta
      app_open: true,
      app_loading: false,
      app_error: "",

      status_options: [
        {
          value: "completed",
          label: "Completed",
          description: "Cleanup completed.",
          aliases: ["c"],
        },
        {
          value: "ongoing",
          label: "Ongoing",
          description:
            "Cleanup is ongoing, or the article is tagged with {{LLMprod}}.",
          aliases: ["o"],
        },
        {
          value: "unnecessary",
          label: "Unnecessary",
          description: "Cleanup is not necessary.",
          aliases: ["u", "unneeded"],
        },
        {
          value: "tagged",
          label: "Tagged",
          description: "The article is tagged with {{AI-generated}}.",
          aliases: ["tg", "tag"],
        },
        {
          value: "requested",
          label: "Requested/To-do",
          description: "Cleanup requested.",
          aliases: ["r", "td", "todo", "to do", "t"],
        },
      ],

      hide_resolved: false,
      articles: Array.isArray(this.articles_input)
        ? this.articles_input
        : [this.articles_input],
      rows: [],
      original_rows: [],

      custom_summary: "",
      wikitext: "",
      basetimestamp: null,
      starttimestamp: null,
    };
  },

  computed: {
    is_single() {
      return this.articles.length === 1;
    },
    dialog_title() {
      return this.is_single ? "Editing row" : "Batch edit";
    },
    dialog_class() {
      return this.is_single ? "ainb-edit-table" : "ainb-batch-edit-table";
    },
    duplicate_error() {
      const link = `<a href="${mw.util.getUrl(
        "User:DVRTed/AINB-helper#Known_issues",
      )}" target="_blank" rel="noopener noreferrer">User:DVRTed/AINB-helper#Known_issues</a>`;
      return `This entry is duplicated, so it cannot be edited with the script; see ${link}.`;
    },
    changed_rows() {
      return this.original_rows.filter((row) => {
        const current_row = this.rows.find((e) => e.article === row.article);
        if (!current_row || row.multiple_matches) return false;
        return (
          row.status !== current_row.status ||
          (row.notes || "") !== (current_row.notes || "")
        );
      });
    },
    can_save() {
      return !this.app_loading && this.changed_rows.length > 0;
    },
    has_red_links() {
      return this.rows.some(
        (row) =>
          row.is_new &&
          !row.multiple_matches &&
          row.status !== "completed" &&
          row.status !== "unnecessary",
      );
    },
    filtered_rows() {
      if (!this.hide_resolved) return this.rows;
      return this.rows.filter(
        (row) =>
          row.status !== "completed" &&
          row.status !== "unnecessary" &&
          row.status !== "tagged",
      );
    },
  },

  mounted() {
    this.load_row_data();
  },

  methods: {
    get_article_url,
    get_history_url,
    close_app() {
      close_app();
    },

    normalize_status(value) {
      const trimmed = value?.trim().toLowerCase() || "";
      const status = this.status_options.find(
        (option) =>
          option.value === trimmed || option.aliases?.includes(trimmed),
      );
      return status ? status.value : "requested";
    },

    async load_row_data() {
      this.app_loading = true;
      this.app_error = "";

      try {
        const page_name = mw.config.get("wgPageName");
        const page_info = await get_page_info(page_name);
        if (!page_info) throw new Error("Page not found");

        const wikitext = page_info.text;
        this.wikitext = wikitext;
        this.basetimestamp = page_info.timestamp;
        this.starttimestamp = page_info.starttimestamp;

        const loaded_rows = [];
        for (const { article, is_new } of this.articles) {
          const global_matches = [
            ...wikitext.matchAll(get_article_row_regex(article, true)),
          ];

          if (global_matches.length > 0) {
            const match = global_matches[0];
            loaded_rows.push({
              article,
              status: this.normalize_status(match[1]?.trim()),
              notes: match[2]?.trim() || "",
              multiple_matches: global_matches.length > 1,
              is_new,
            });
          }
        }

        if (loaded_rows.length === 0) {
          this.app_error = "Could not find row data";
        } else {
          this.rows = loaded_rows;
          this.original_rows = structuredClone(loaded_rows);
          if (this.is_single && loaded_rows[0].multiple_matches) {
            this.app_error = this.duplicate_error;
          }
        }
      } catch (e) {
        this.app_error = "Error loading row data: " + e.message;
        console.error(e);
      } finally {
        this.app_loading = false;
      }
    },

    mark_all_deleted_as_completed() {
      for (const row of this.rows) {
        if (row.is_new && !row.multiple_matches) {
          row.status = "completed";
        }
      }
    },

    async save_changes() {
      this.app_error = "";

      const page_name = mw.config.get("wgPageName");
      let new_wikitext = this.wikitext;

      for (const row of this.rows) {
        if (!row.multiple_matches) {
          const new_row = build_article_row(row.article, row.status, row.notes);
          new_wikitext = new_wikitext.replace(
            get_article_row_regex(row.article),
            () => new_row,
          );
        }
      }

      // rm one or more ./,/; punctuation marks at the end
      const custom = this.custom_summary.trim().replace(/[.,;]+$/, "");
      let auto_summary =
        this.rows.length === 1
          ? `Updated row for [[${this.rows[0].article}]]`
          : `Batch edited ${this.changed_rows.length} ${
              this.changed_rows.length === 1 ? "row" : "rows"
            }`;

      if (custom) {
        // if there's custom summary, lowercase the first letter
        auto_summary = auto_summary.replace(/^./, (c) => c.toLowerCase());
      }

      const summary = custom
        ? `${custom}; ${auto_summary} ${APP_AD}`
        : `${auto_summary} ${APP_AD}`;

      const article_names = this.changed_rows.map((r) => r.article);
      $('tr[class*="aic-row-"]')
        .filter(function () {
          return article_names.includes(
            $(this).find("a").first().text().trim(),
          );
        })
        .each(function () {
          $(this).find("td").eq(2).text("updating...");
          $(this).find("td").eq(3).text("updating...");
        });
      const before_unload = (event) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", before_unload);
      this.close_app();

      // save and refresh w/out full reload
      try {
        await api.postWithEditToken({
          action: "edit",
          title: page_name,
          text: new_wikitext,
          summary,
          basetimestamp: this.basetimestamp,
          starttimestamp: this.starttimestamp,
        });

        await this.refresh_page_content(page_name);
        mw.notify("Row(s) saved successfully.", { type: "success" });
      } catch (e) {
        mw.notify("Error saving changes: " + e.message, {
          type: "error",
          autoHide: false,
        });
        console.error(e);
      } finally {
        window.removeEventListener("beforeunload", before_unload);
      }
    },
    async refresh_page_content(page_name) {
      // could re-use this for banners too
      const result = await api.get({
        action: "parse",
        page: page_name,
        prop: "text",
      });
      const content = document.querySelector(
        "#mw-content-text .mw-parser-output",
      );
      if (content) {
        content.innerHTML = result.parse.text["*"];
        add_page_buttons();
      }
    },
  },
};
</script>

<template>
  <div>
    <cdx-dialog
      :class="dialog_class"
      v-model:open="app_open"
      :title="dialog_title"
      :use-close-button="true"
      @update:open="close_app"
    >
      <div v-if="app_loading" class="ainb-loading">
        <p>Loading row data...</p>
        <cdx-progress-bar inline></cdx-progress-bar>
      </div>

      <div v-else-if="app_error" class="ainb-error" v-html="app_error"></div>

      <div v-else-if="is_single && rows.length === 1" class="ainb-edit-step">
        <div class="ainb-form-field">
          Article:
          <strong>
            <a
              :href="get_article_url(rows[0].article)"
              :class="{ new: rows[0].is_new }"
              rel="mw:WikiLink"
              target="_blank"
              >{{ rows[0].article }}</a
            >
          </strong>
          <a
            :href="get_history_url(rows[0].article)"
            class="ainb-history-link"
            target="_blank"
            rel="noopener noreferrer"
            >(hist)</a
          >
        </div>

        <div class="ainb-form-field">
          <div class="ainb-form-label">Status:</div>
          <div>
            <cdx-select
              v-model:selected="rows[0].status"
              :menu-items="status_options"
            ></cdx-select>
          </div>
        </div>

        <div class="ainb-form-field">
          <div class="ainb-form-label">Notes:</div>
          <cdx-text-area v-model="rows[0].notes" rows="4"></cdx-text-area>
        </div>
      </div>

      <div v-else>
        <label class="ainb-hide-resolved-label">
          <input type="checkbox" v-model="hide_resolved" />
          Hide resolved entries
        </label>

        <div class="ainb-batch-edit-table-scroll">
          <table class="ainb-batch-edit-table-grid">
            <thead>
              <tr>
                <th>Article</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered_rows" :key="row.article">
                <td>
                  <a
                    :href="get_article_url(row.article)"
                    :class="{ new: row.is_new }"
                    rel="mw:WikiLink"
                    target="_blank"
                  >
                    {{ row.article }}
                  </a>
                  <a
                    :href="get_history_url(row.article)"
                    class="ainb-history-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    >(hist)</a
                  >
                </td>
                <template v-if="row.multiple_matches">
                  <td
                    colspan="2"
                    class="ainb-error"
                    v-html="duplicate_error"
                  ></td>
                </template>
                <template v-else>
                  <td>
                    <cdx-select
                      v-model:selected="row.status"
                      :menu-items="status_options"
                    ></cdx-select>
                  </td>
                  <td>
                    <cdx-text-area v-model="row.notes" rows="1"></cdx-text-area>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <div class="ainb-dialog-edit-summary">
          <cdx-text-input
            name="ainb_custom_summary"
            id="ainb_custom_summary"
            v-model="custom_summary"
            placeholder="Edit summary (optional)"
            maxlength="200"
            aria-label="Custom edit summary"
            v-if="!app_loading"
          ></cdx-text-input>
        </div>
        <div class="ainb-dialog-footer">
          <div>
            <cdx-button
              v-if="!is_single && has_red_links"
              @click="mark_all_deleted_as_completed"
            >
              Mark all deleted articles as completed
            </cdx-button>
          </div>
          <div>
            <cdx-button @click="close_app">Cancel</cdx-button>
            <cdx-button
              action="progressive"
              weight="primary"
              @click="save_changes"
              :disabled="!can_save"
            >
              Save
            </cdx-button>
          </div>
        </div>
      </template>
    </cdx-dialog>
  </div>
</template>
