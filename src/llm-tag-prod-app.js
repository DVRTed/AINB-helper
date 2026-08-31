function create_llm_tag_prod_app() {
  const {
    CdxButton,
    CdxTextInput,
    CdxTextArea,
    CdxDialog,
    CdxRadio,
    CdxField,
    CdxCombobox,
  } = require("@wikimedia/codex");

  const subpage_options = [];

  create_app({
    template: generate_llm_tag_prod_template(),
    components: {
      CdxButton,
      CdxTextInput,
      CdxTextArea,
      CdxDialog,
      CdxRadio,
      CdxField,
      CdxCombobox,
    },

    data() {
      return {
        is_open: true,
        step: 1,
        selected_option: "llm_prod",
        subpage: "",
        subpage_options: subpage_options,
        editable_wikitext: "",
        editable_summary: "",
        saving: false,
        save_error: "",
        show_preview: false,
        preview_html: "",
        preview_loading: false,
      };
    },

    computed: {
      filtered_subpage_options() {
        const query = (this.subpage || "").trim().toLowerCase();
        if (!query) {
          return this.subpage_options;
        }
        return this.subpage_options.filter((item) =>
          item.value.toLowerCase().includes(query),
        );
      },
    },

    methods: {
      handle_dialog_close() {
        close_app();
      },
      go_to_step2() {
        let raw_subpage = this.subpage.trim();
        let target_link = raw_subpage;

        if (this.selected_option === "llm_prod") {
          this.editable_wikitext = `{{subst:Prod llm\n|reason=[[WP:LLMPRV|Presumptive removal of LLM-generated content]], see [[${target_link}]]. Feel free to reinstate by following [[WP:LLMPRVOBJ|the procedures for disputing presumptive removal of LLM-generated content]].}}`;
          this.editable_summary = `[[WP:LLMPRV|Presumptive removal of LLM-generated content]], see [[${target_link}]]. Feel free to reinstate by following [[WP:LLMPRVOBJ|the procedures for disputing presumptive removal of LLM-generated content]].`;
        } else {
          this.editable_wikitext = `{{AI-generated |reason= [[${target_link}]] ([[WP:WWT]] is useful) |{{subst:DATE}}}}`;
          this.editable_summary = `Added AI tag, see [[${target_link}]]`;
        }

        this.show_preview = false;
        this.step = 2;
      },
      async toggle_preview() {
        if (this.show_preview) {
          this.show_preview = false;
          return;
        }

        this.preview_loading = true;
        this.show_preview = true;
        try {
          const res = await api.post({
            action: "parse",
            text: this.editable_wikitext,
            title: mw.config.get("wgPageName"),
            pst: true,
            prop: "text",
          });
          if (res.parse?.text?.["*"]) {
            this.preview_html = res.parse.text["*"];
          } else {
            this.preview_html = "<em>Could not generate preview.</em>";
          }
        } catch (err) {
          console.error("Preview error:", err);
          this.preview_html = `<div class="ainb-error">Preview error: ${err.message}</div>`;
        } finally {
          this.preview_loading = false;
        }
      },
      async save_edit() {
        this.saving = true;
        this.save_error = "";
        try {
          const page_name = mw.config.get("wgPageName");
          const prepended_text = this.editable_wikitext.trim() + "\n";
          const edit_summary = `${this.editable_summary.trim()} ${APP_AD}`;

          await api.postWithEditToken({
            action: "edit",
            title: page_name,
            prependtext: prepended_text,
            summary: edit_summary,
          });

          mw.notify("Edit submitted successfully!", { type: "success" });
          location.reload();
          this.handle_dialog_close();
        } catch (e) {
          this.save_error = "Error submitting edit: " + e.message;
          console.error(e);
        } finally {
          this.saving = false;
        }
      },

      async fetch_ainb_suggestions() {
        const suggestions = [];
        try {
          const parse_res = await api.get({
            action: "parse",
            page: "Wikipedia:AI noticeboard",
            prop: "sections",
          });

          if (parse_res.parse?.sections) {
            parse_res.parse.sections.forEach((sec) => {
              if (sec.line) {
                const clean_line = sec.line.replace(/<[^>]+>/g, "").trim();
                if (clean_line) {
                  suggestions.push(`Wikipedia:AI noticeboard#${clean_line}`);
                }
              }
            });
          }

          const subpages_res = await api.get({
            action: "query",
            list: "prefixsearch",
            pssearch: "Wikipedia:AI noticeboard/",
            pslimit: 100,
          });

          if (subpages_res.query?.prefixsearch) {
            subpages_res.query.prefixsearch.forEach((item) => {
              suggestions.push(item.title);
            });
          }
        } catch (err) {
          console.error("Error fetching AINB suggestions:", err);
        }
        return suggestions;
      },
    },

    async mounted() {
      const suggestions = await this.fetch_ainb_suggestions();
      if (suggestions.length > 0) {
        this.subpage_options = suggestions.map((sp) => ({
          value: sp,
          label: sp,
        }));
      }
    },
  });
}

function generate_llm_tag_prod_template() {
  return `
<div>
  <cdx-dialog class="ainb-llm-dialog" v-model:open="is_open" 
    title="LLM tag / prod" :use-close-button="true"
    @update:open="handle_dialog_close">
    
    <div v-if="step === 1">
      <cdx-field>
        <cdx-radio v-model="selected_option" input-value="llm_prod" :inline="true">
          Prod LLM
        </cdx-radio>
        <cdx-radio v-model="selected_option" input-value="ai_tag" :inline="true">
          Add &#123;&#123;AI-generated&#125;&#125; tag
        </cdx-radio>
      </cdx-field>

      <cdx-field>
        <template #description>Tip: Type the username to autocomplete from Wikipedia:AI noticeboard</template>
        <cdx-combobox v-model:selected="subpage" :menu-items="filtered_subpage_options" placeholder="Relevant thread or subpage"></cdx-combobox>
      </cdx-field>
    </div>

    <div v-if="step === 2">
      <div v-if="save_error" class="ainb-error">{{ save_error }}</div>

      <cdx-field>
        <template #label>Resulting wikitext:</template>
        <cdx-text-area v-model="editable_wikitext" rows="5" :disabled="saving"></cdx-text-area>
      </cdx-field>

      <div class="ainb-preview-link-wrap">
        <a href="#" @click.prevent="toggle_preview">
          {{ show_preview ? 'Hide preview' : 'Show preview' }}
        </a>
      </div>

      <div v-if="show_preview" class="ainb-preview-box">
        <div v-if="preview_loading" class="ainb-loading">Loading preview...</div>
        <div v-else class="ainb-preview-content" v-html="preview_html"></div>
      </div>

      <cdx-field>
        <template #label>Edit summary:</template>
        <cdx-text-input v-model="editable_summary" :disabled="saving" />
      </cdx-field>
    </div>

    <template #footer>
      <div class="ainb-dialog-footer">
        <div v-if="step === 1">
          <cdx-button @click="handle_dialog_close">Cancel</cdx-button>
        </div>
        <div v-if="step === 1">
          <cdx-button action="progressive" weight="primary" @click="go_to_step2">Next</cdx-button>
        </div>

        <div v-if="step === 2">
          <cdx-button @click="step = 1" :disabled="saving">Back</cdx-button>
        </div>
        <div v-if="step === 2">
          <cdx-button action="progressive" weight="primary" @click="save_edit" :disabled="saving || !editable_wikitext">
            {{ saving ? 'Saving...' : 'Submit edit' }}
          </cdx-button>
        </div>
      </div>
    </template>
  </cdx-dialog>
</div>
    `;
}
