function get_article_row_regex(article, global = false) {
  const escaped_article = mw.util.escapeRegExp(article);
  return new RegExp(
    `\\{\\{AIC article row\\s*\\|\\s*(?:article=)?\\s*${escaped_article}\\s*(?:\\|\\s*(?:status=)?\\s*([^|}]*))?(?:\\s*\\|\\s*(?:notes=)?\\s*([^}]*))?\\s*\\}\\}`,
    global ? "ig" : "i",
  );
}

function create_edit_table_app(articles_input) {
  const articles = Array.isArray(articles_input)
    ? articles_input
    : [articles_input];

  create_app({
    template: generate_edit_table_template(),

    data() {
      return {
        is_open: true,
        articles,
        rows: [],
        original_rows: [],
        loading: false,
        saving: false,
        error: "",
        wikitext: "",
        status_options: [
          { value: "completed", label: "Completed", aliases: ["c"] },
          { value: "ongoing", label: "Ongoing", aliases: ["o"] },
          {
            value: "unnecessary",
            label: "Unnecessary",
            aliases: ["u", "unneeded"],
          },
          {
            value: "requested",
            label: "Requested/To-do",
            aliases: ["r", "td", "todo", "to do", "t"],
          },
        ],
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
        const link = `<a href="${mw.util.getUrl("User:DVRTed/AINB-helper#Known_issues")}" target="_blank" rel="noopener noreferrer">User:DVRTed/AINB-helper#Known_issues</a>`;
        return `This entry is duplicated, so it cannot be edited with the script; see ${link}.`;
      },
      can_save() {
        if (this.saving || this.loading || this.rows.length === 0) return false;
        return this.rows.some(
          (row) => !row.multiple_matches && Boolean(row.status),
        );
      },
      has_red_links() {
        return this.rows.some(
          (row) =>
            row.is_new && !row.multiple_matches && row.status !== "completed",
        );
      },
    },

    methods: {
      get_article_url(title) {
        return mw.util.getUrl(title);
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
        this.loading = true;
        this.error = "";

        try {
          const page_name = mw.config.get("wgPageName");
          const result = await api.get({
            action: "parse",
            page: page_name,
            prop: "wikitext",
          });

          const wikitext = result.parse.wikitext["*"];
          this.wikitext = wikitext;

          const rows = [];
          for (const { article, is_new } of this.articles) {
            const global_matches = [
              ...wikitext.matchAll(get_article_row_regex(article, true)),
            ];

            if (global_matches.length > 0) {
              const match = global_matches[0];
              rows.push({
                article,
                status: this.normalize_status(match[1]?.trim()),
                notes: match[2]?.trim() || "",
                multiple_matches: global_matches.length > 1,
                is_new,
              });
            }
          }

          if (rows.length === 0) {
            this.error = "Could not find row data";
          } else {
            this.rows = rows;
            this.original_rows = structuredClone(rows);
            if (this.is_single && rows[0].multiple_matches) {
              this.error = this.duplicate_error;
            }
          }
        } catch (e) {
          this.error = "Error loading row data: " + e.message;
          console.error(e);
        } finally {
          this.loading = false;
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
        this.saving = true;
        this.error = "";

        try {
          const page_name = mw.config.get("wgPageName");
          let new_wikitext = this.wikitext;

          for (const row of this.rows) {
            if (!row.multiple_matches) {
              const new_row = `{{AIC article row|article=${row.article}|status=${row.status}|notes=${row.notes || ""}}}`;
              new_wikitext = new_wikitext.replace(
                get_article_row_regex(row.article),
                new_row,
              );
            }
          }

          const changed_rows = this.original_rows.filter((row) => {
            const current_row = this.rows.find(
              (e) => e.article === row.article,
            );
            if (!current_row || row.multiple_matches) return false;
            return (
              row.status !== current_row.status ||
              (row.notes || "") !== (current_row.notes || "")
            );
          });

          const summary =
            this.rows.length === 1
              ? `Updated row for [[${this.rows[0].article}]] ${APP_AD}`
              : `Batch edited ${changed_rows.length} ${changed_rows.length === 1 ? "row" : "rows"} ${APP_AD}`;

          await api.postWithEditToken({
            action: "edit",
            title: page_name,
            text: new_wikitext,
            summary,
          });

          location.reload();
          this.handle_dialog_close();
        } catch (e) {
          this.error = "Error saving changes: " + e.message;
          console.error(e);
        } finally {
          this.saving = false;
        }
      },
    },

    async mounted() {
      await this.load_row_data();
    },
  });
}

function generate_edit_table_template() {
  return `
<div>
  <cdx-dialog :class="dialog_class" v-model:open="is_open" 
    :title="dialog_title" :use-close-button="true"
    @update:open="handle_dialog_close">
    
    <div v-if="loading" class="ainb-loading">
      <p>Loading row data...</p>
      <cdx-progress-bar inline></cdx-progress-bar>
    </div>
    
    <div v-else-if="error" class="ainb-error" v-html="error"></div>
    
    <div v-else-if="is_single && rows.length === 1" class="ainb-edit-step">
      <div class="ainb-form-field">
        Article: <strong><a :href="get_article_url(rows[0].article)" :class="{ new: rows[0].is_new }" rel="mw:WikiLink" target="_blank">{{ rows[0].article }}</a></strong>
      </div>
      
      <div class="ainb-form-field">
        <div class="ainb-form-label">Status:</div>
        <div><cdx-select v-model:selected="rows[0].status" :menu-items="status_options" :disabled="saving"></cdx-select></div>
      </div>
      
      <div class="ainb-form-field">
        <div class="ainb-form-label">Notes:</div>
        <cdx-text-area v-model="rows[0].notes" rows="4" :disabled="saving"></cdx-text-area>
      </div>
    </div>
    
    <table v-else class="ainb-batch-edit-table-grid">
      <thead>
        <tr>
          <th>Article</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.article">
          <td>
            <a :href="get_article_url(row.article)" :class="{ new: row.is_new }" rel="mw:WikiLink" target="_blank">
              {{ row.article }}
            </a>
          </td>
          <template v-if="row.multiple_matches">
            <td colspan="2" class="ainb-error" v-html="duplicate_error"></td>
          </template>
          <template v-else>
            <td>
              <cdx-select v-model:selected="row.status" :menu-items="status_options" :disabled="saving"></cdx-select>
            </td>
            <td>
              <cdx-text-area v-model="row.notes" rows="2" :disabled="saving"></cdx-text-area>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div>
          <cdx-button v-if="!is_single && has_red_links" @click="mark_all_deleted_as_completed" :disabled="saving">
            Mark all deleted articles as completed
          </cdx-button>
        </div>
        <div>
          <cdx-button @click="handle_dialog_close" :disabled="saving">Cancel</cdx-button>
          <cdx-button action="progressive" weight="primary" 
            @click="save_changes" :disabled="!can_save">
            {{ saving ? 'Saving...' : 'Save' }}
          </cdx-button>
        </div>
      </div>
    </template>
  </cdx-dialog>
</div>
  `;
}
