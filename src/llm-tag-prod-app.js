function create_llm_tag_prod_app() {
  const LAST_THREAD_KEY = "ainb-llm-tag-last-thread";
  const LAST_THREAD_TTL_MS = 3 * 60 * 60 * 1000;
  const LOG_TO_USERPAGE_OPTION = "userjs-ainb-log-userpage";
  const HELP_OFF_OPTION = "userjs-ainb-help-off";
  const WATCH_PAGE_OPTION = "userjs-ainb-watch-page";
  const LOG_PAGE_SUFFIX = "LLMPROD log";

  create_app({
    template: generate_llm_tag_prod_template(),

    data() {
      const initial_log_to_userpage =
        mw.user.options.get(LOG_TO_USERPAGE_OPTION) === "1";
      const initial_help_off = mw.user.options.get(HELP_OFF_OPTION) === "1";
      const initial_watch_page = mw.user.options.get(WATCH_PAGE_OPTION) === "1";

      return {
        is_open: true,
        step: 1,
        username: mw.config.get("wgUserName"),
        page_name: mw.config.get("wgPageName"),
        logging_page: `User:${mw.config.get("wgUserName")}/${LOG_PAGE_SUFFIX}`,
        selected_option: "llm_prod",
        subpage: "",
        subpage_options: [],
        log_to_userpage: initial_log_to_userpage,
        help_off: initial_help_off,
        editable_wikitext: "",
        editable_summary: "",
        saving: false,
        save_error: "",
        step1_error: "",
        checking_page: false,
        show_preview: false,
        preview_html: "",
        preview_loading: false,
        show_advanced: false,
        watch_page: initial_watch_page,
      };
    },

    watch: {
      log_to_userpage(new_val) {
        const val_str = new_val ? "1" : "0";
        mw.user.options.set(LOG_TO_USERPAGE_OPTION, val_str);
        api.saveOption(LOG_TO_USERPAGE_OPTION, val_str);
      },
      help_off(new_val) {
        const val_str = new_val ? "1" : "0";
        mw.user.options.set(HELP_OFF_OPTION, val_str);
        api.saveOption(HELP_OFF_OPTION, val_str);
      },
      watch_page(new_val) {
        const val_str = new_val ? "1" : "0";
        mw.user.options.set(WATCH_PAGE_OPTION, val_str);
        api.saveOption(WATCH_PAGE_OPTION, val_str);
      },
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
      async go_to_step2() {
        let raw_subpage = this.subpage.trim();
        this.step1_error = "";

        if (raw_subpage) {
          this.checking_page = true;
          const [page_title, ...section_parts] = raw_subpage.split("#");
          const page = page_title.trim();
          const section = section_parts.join("#").trim();

          try {
            const res = await api.get({
              action: "parse",
              page: page,
              prop: "sections",
              redirects: true,
            });

            if (section) {
              const sections = res.parse?.sections || [];
              const normalize = (s) => s.replace(/_/g, " ");
              const section_exists = sections.some(
                (s) =>
                  s.anchor === section ||
                  normalize(s.line) === normalize(section),
              );
              if (!section_exists) {
                this.step1_error = `Section "${section}" does not exist on "${page}"`;
                return;
              }
            }
          } catch (err) {
            this.step1_error = `Page does not exist: "${err}"`;
            return;
          } finally {
            this.checking_page = false;
          }
        }

        const target_link = raw_subpage;

        mw.storage.setObject(LAST_THREAD_KEY, {
          subpage: raw_subpage,
          selected_option: this.selected_option,
          ts: Date.now(),
        });

        const see_clause = target_link ? `, see [[${target_link}]]` : "";
        const ai_reason = target_link ? ` |reason= [[${target_link}]]` : "";

        if (this.selected_option === "llm_prod") {
          const help_off_clause = this.help_off ? "|help=off\n" : "";
          this.editable_wikitext = `{{subst:Prod llm\n${help_off_clause}|reason=[[WP:LLMPRV|Presumptive removal of LLM-generated content]]${see_clause}. Feel free to reinstate by following [[WP:LLMPRVOBJ|the procedures for disputing presumptive removal of LLM-generated content]].}}`;
          this.editable_summary = `[[WP:LLMPRV|Presumptive removal of LLM-generated content]]${see_clause}. Feel free to reinstate by following [[WP:LLMPRVOBJ|the procedures for disputing presumptive removal of LLM-generated content]].`;
        } else {
          this.editable_wikitext = `{{AI-generated${ai_reason} |{{subst:DATE}}}}`;
          this.editable_summary = `Added AI tag${see_clause}`;
        }

        this.show_preview = false;
        this.step = 2;
      },
      go_back_to_step1() {
        mw.storage.remove(LAST_THREAD_KEY);
        this.step1_error = "";
        this.show_advanced = false;
        this.step = 1;
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
            title: this.page_name,
            pst: true,
            prop: "text",
          });
          if (res.parse?.text?.["*"]) {
            this.preview_html = res.parse.text["*"];
          } else {
            this.preview_html = "Could not generate preview.";
          }
        } catch (err) {
          console.error("Preview error:", err);
          this.preview_html = `Preview error: ${err.message}`;
        } finally {
          this.preview_loading = false;
        }
      },
      async log_to_userpage_action(revid) {
        if (!revid) return;
        const page = this.page_name;
        const template_name =
          this.selected_option === "llm_prod" ? "Prod llm" : "AI-generated";
        const template_text =
          this.selected_option === "llm_prod" ? "LLMPROD" : "AI tag addition";

        const thread = this.subpage.trim();
        const thread_clause = thread ? ` (relevant page: [[${thread}]])` : "";

        await api.postWithEditToken({
          action: "edit",
          title: this.logging_page,
          appendtext: `\n# [[:${page}]]: Added {{tl|${template_name}}} with [[special:diff/${revid}|this edit]]${thread_clause}, ~~~~~`,
          summary: `Logging ${template_text} on [[${page}]] ${APP_AD}`,
        });
      },
      async save_edit() {
        this.saving = true;
        this.save_error = "";
        try {
          const prepended_text = this.editable_wikitext.trim() + "\n";
          const edit_summary = `${this.editable_summary.trim()} ${APP_AD}`;

          const edit_res = await api.postWithEditToken({
            action: "edit",
            title: this.page_name,
            prependtext: prepended_text,
            summary: edit_summary,
            watchlist: this.watch_page ? "watch" : "nochange",
          });

          if (this.log_to_userpage) {
            await this.log_to_userpage_action(edit_res.edit?.newrevid);
          }

          mw.notify("Edit submitted successfully!", { type: "success" });
          location.reload();
          this.handle_dialog_close();
        } catch (e) {
          this.save_error = "Error submitting edit: " + e;
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
            redirects: true,
          });

          if (parse_res.parse?.sections) {
            parse_res.parse.sections.forEach((section) => {
              suggestions.push(`Wikipedia:AI noticeboard#${section.line}`);
            });
          }
        } catch (err) {
          console.error("Error fetching AINB suggestions:", err);
        }
        return suggestions;
      },
    },

    mounted() {
      const saved = mw.storage.getObject(LAST_THREAD_KEY);
      if (
        saved &&
        saved.subpage &&
        Date.now() - saved.ts < LAST_THREAD_TTL_MS
      ) {
        this.subpage = saved.subpage;
        this.selected_option = saved.selected_option || this.selected_option;
        this.go_to_step2();
      }

      this.fetch_ainb_suggestions().then((suggestions) => {
        if (suggestions.length > 0) {
          this.subpage_options = suggestions.map((sp) => ({
            value: sp,
            label: sp,
          }));
        }
      });
    },
  });
}

function generate_llm_tag_prod_template() {
  return `
<div>
  <cdx-dialog class="ainb-llm-dialog" v-model:open="is_open" 
    title="LLM tag / prod" :use-close-button="true"
    @update:open="handle_dialog_close">
    
    <div class="ainb-llm-top-options">
      <span v-if="log_to_userpage" class="ainb-log-target-hint">
        (will be logged to {{ logging_page }})
      </span>
      <cdx-checkbox v-model="log_to_userpage" :disabled="saving">
        Log to your userpage
      </cdx-checkbox>
    </div>

    <div v-if="step === 1">
      <div v-if="step1_error" class="ainb-error">{{ step1_error }}</div>
      <cdx-field>
        <cdx-radio v-model="selected_option" input-value="llm_prod" :inline="true" :disabled="checking_page">
          Prod LLM
        </cdx-radio>
        <cdx-radio v-model="selected_option" input-value="ai_tag" :inline="true" :disabled="checking_page">
          Add &#123;&#123;AI-generated&#125;&#125; tag
        </cdx-radio>
      </cdx-field>

      <cdx-field>
        <template #description>Tip: Type the username to autocomplete from Wikipedia:AI noticeboard. You can leave this blank to proceed anyway.</template>
        <cdx-combobox v-model:selected="subpage" :menu-items="filtered_subpage_options" placeholder="Relevant thread or subpage (optional)" :disabled="checking_page"></cdx-combobox>
      </cdx-field>

      <div class="ainb-advanced-wrap">
        <a href="#" class="ainb-advanced-toggle" @click.prevent="show_advanced = !show_advanced">
          {{ show_advanced ? '▾' : '▸' }} Advanced options
        </a>
        <cdx-field v-if="show_advanced">
          <cdx-checkbox v-if="selected_option === 'llm_prod'" v-model="help_off" :disabled="checking_page">
            Set help to off (will suppress the notification instructions; see
            <a href="https://en.wikipedia.org/wiki/Template:Prod_llm#Usage" target="_blank" rel="noopener">docs</a>)
          </cdx-checkbox>
          <cdx-checkbox v-model="watch_page" :disabled="checking_page">
            Watch this page
          </cdx-checkbox>
        </cdx-field>
      </div>
    </div>

    <div v-if="step === 2">
      <div class="ainb-thread-context">
        <span>Thread: <strong>{{ subpage }}</strong></span>
        <a href="#" @click.prevent="go_back_to_step1">Change</a>
      </div>
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
          <cdx-button action="progressive" weight="primary" @click="go_to_step2" :disabled="checking_page">
            {{ checking_page ? 'Checking...' : 'Next' }}
          </cdx-button>
        </div>

        <div v-if="step === 2">
          <cdx-button @click="go_back_to_step1" :disabled="saving">Back</cdx-button>
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
