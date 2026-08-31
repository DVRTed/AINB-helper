function create_edit_table_app(article) {
  const {
    CdxButton,
    CdxDialog,
    CdxSelect,
    CdxTextArea,
    CdxProgressBar,
  } = require("@wikimedia/codex");

  create_app({
    template: generate_edit_table_template(),
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
        article: article,
        status: "",
        raw_status: "",
        notes: "",
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
      can_save() {
        return !this.saving && !this.loading && this.status;
      },
    },

    methods: {
      handle_dialog_close() {
        close_app();
      },

      map_params(value) {
        if (!value) return "";
        const status = this.status_options.find(
          (option) =>
            option.value === value ||
            option.aliases?.includes(value.toLowerCase()),
        );
        return status?.value || "";
      },

      get_article_row_regex(escaped_article) {
        return new RegExp(
          `\\{\\{AIC article row\\s*\\|\\s*(?:article=)?\\s*${escaped_article}\\s*(?:\\|\\s*(?:status=)?\\s*([^|}]*))?(?:\\s*\\|\\s*(?:notes=)?\\s*([^}]*))?\\s*\\}\\}`,
          "i",
        );
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
          const escaped_article = mw.util.escapeRegExp(this.article);
          const regex = this.get_article_row_regex(escaped_article);

          const match = wikitext.match(regex);

          if (match) {
            this.raw_status = match[1]?.trim() || "requested";
            this.notes = match[2]?.trim() || "";
            this.wikitext = wikitext;
          } else {
            this.error = "Could not find row data for this article.";
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
          const escaped_article = mw.util.escapeRegExp(this.article);
          const regex = this.get_article_row_regex(escaped_article);

          const new_row = `{{AIC article row|article=${this.article}|status=${this.status}|notes=${this.notes}}}`;
          const new_wikitext = this.wikitext.replace(regex, new_row);

          await api.postWithEditToken({
            action: "edit",
            title: page_name,
            text: new_wikitext,
            summary: `Updated row for [[${this.article}]] ${APP_AD}`,
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
      this.status = this.map_params(this.raw_status);
    },
  });
}

function generate_edit_table_template() {
  const footer = `    
    <template #footer>
      <div class="ainb-dialog-footer">
        <div></div>
        <div>
          <cdx-button @click="handle_dialog_close">Cancel</cdx-button>
          <cdx-button action="progressive" weight="primary" 
            @click="save_changes" :disabled="!can_save">
            {{ saving ? 'Saving...' : 'Save' }}
          </cdx-button>
        </div>
      </div>
    </template>`;

  return `
<div>
  <cdx-dialog class="ainb-edit-table" v-model:open="is_open" 
    title="Editing row" :use-close-button="true"
    @update:open="handle_dialog_close">
    
    <div class="ainb-edit-step">
      <div v-if="loading" class="ainb-loading">
        <p>Loading row data...</p>
        <cdx-progress-bar inline></cdx-progress-bar>
      </div>
      
      <div v-else-if="error" class="ainb-error">{{ error }}</div>
      
      <div v-else>
        <div class="ainb-form-field">
          Article: <strong>{{ article }}</strong>
        </div>
        
        <div class="ainb-form-field">
          <div class="ainb-form-label">Status:</div>
          <div><cdx-select v-model:selected="status" :menu-items="status_options"></cdx-select></div>
        </div>
        
        <div class="ainb-form-field">
          <div class="ainb-form-label">Notes:</div>
          <cdx-text-area v-model="notes" rows="4"></cdx-text-area>
        </div>
      </div>
    </div>
    ${footer}
  </cdx-dialog>
</div>
    `;
}
