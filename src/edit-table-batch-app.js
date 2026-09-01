function create_batch_edit_table_app(articles) {
  const {
    CdxButton,
    CdxDialog,
    CdxSelect,
    CdxTextArea,
    CdxProgressBar,
  } = require("@wikimedia/codex");

  create_app({
    template: generate_batch_edit_table_template(),
    components: {
      CdxButton,
      CdxDialog,
      CdxSelect,
      CdxTextArea,
      CdxProgressBar,
    },

    data() {
      return {
        is_open: true,
        rows: [],
        original_rows: [],
        loading: false,
        saving: false,
        error: "",
        wikitext: "",
        status_options: [
          { value: "completed", label: "Completed" },
          { value: "ongoing", label: "Ongoing" },
          { value: "unnecessary", label: "Unnecessary" },
          { value: "requested", label: "Requested/To-do" },
        ],
      };
    },

    computed: {
      can_save() {
        return !this.saving && !this.loading && this.rows.length > 0;
      },
    },

    methods: {
      handle_dialog_close() {
        close_app();
      },

      get_article_url(title) {
        return mw.util.getUrl(title);
      },

      normalize_status(value) {
        const status = this.status_options.find(
          (option) => option.value === (value || "").toLowerCase(),
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
          for (const article of articles) {
            const regex = get_article_row_regex(article);
            const match = wikitext.match(regex);

            if (match) {
              rows.push({
                article,
                status: this.normalize_status(match[1]?.trim() || "requested"),
                notes: match[2]?.trim() || "",
              });
            }
          }

          if (rows.length === 0) {
            this.error = "Could not find row data for these articles.";
          } else {
            this.rows = rows;
            this.original_rows = structuredClone(rows);
          }
        } catch (e) {
          this.error = "Error loading row data: " + e.message;
          console.error(e);
        } finally {
          this.loading = false;
        }
      },

      async save_changes() {
        this.saving = true;
        this.error = "";

        try {
          const page_name = mw.config.get("wgPageName");
          let new_wikitext = this.wikitext;

          for (const row of this.rows) {
            const regex = get_article_row_regex(row.article);
            const new_row = `{{AIC article row|article=${row.article}|status=${row.status}|notes=${row.notes || ""}}}`;
            new_wikitext = new_wikitext.replace(regex, new_row);
          }

          const changed_rows = this.original_rows.filter(row => {
            const current_row = this.rows.find(e => e.article === row.article)

            return row.status !== current_row.status || row.notes !== current_row.notes
          })

          const summary = `Batch edited ${changed_rows.length} ${changed_rows.length > 1 ? 'rows' : 'row'} ${APP_AD}`;

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

function generate_batch_edit_table_template() {
  return `
<div>
  <cdx-dialog class="ainb-batch-edit-table" v-model:open="is_open" title="Batch edit" :use-close-button="true">
    <div v-if="loading" class="ainb-loading">
      <p>Loading row data...</p>
      <cdx-progress-bar inline></cdx-progress-bar>
    </div>

    <div v-else-if="error" class="ainb-error">{{ error }}</div>

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
            <a :href="get_article_url(row.article)" target="_blank" rel="noopener noreferrer">
              {{ row.article }}
            </a>
          </td>
          <td>
            <cdx-select v-model:selected="row.status" :menu-items="status_options" :disabled="saving"></cdx-select>
          </td>
          <td>
            <cdx-text-area v-model="row.notes" rows="2" :disabled="saving"></cdx-text-area>
          </td>
        </tr>
      </tbody>
    </table>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div></div>
        <div>
          <cdx-button @click="handle_dialog_close">Cancel</cdx-button>
          <cdx-button action="progressive" weight="primary" @click="save_changes" :disabled="!can_save">
            {{ saving ? 'Saving...' : 'Save' }}
          </cdx-button>
        </div>
      </div>
    </template>
  </cdx-dialog>
</div>
  `;
}
