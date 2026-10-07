<script>
import {
  CdxButton,
  CdxCheckbox,
  CdxCombobox,
  CdxDialog,
  CdxField,
  CdxRadio,
  CdxTextArea,
  CdxTextInput,
} from "@wikimedia/codex";

import {
  APP_AD,
  api,
  close_app,
  get_article_row_regex,
  get_case_origin,
  normalize_title,
  rm_underscores,
} from "./shared.js";

const LAST_CASE_KEY = "ainb-llm-tag-last-case";
const LAST_CASE_TTL_MS = 3 * 60 * 60 * 1000;
const LOG_TO_USERPAGE_OPTION = "userjs-ainb-log-userpage";
const HELP_OFF_OPTION = "userjs-ainb-help-off";
const WATCH_PAGE_OPTION = "userjs-ainb-watch-page";
const LOG_PAGE_SUFFIX = "LLMPROD log";

function save_userpref(option_name, value) {
  const val_str = value ? "1" : "0";
  mw.user.options.set(option_name, val_str);
  api.saveOption(option_name, val_str);
}

export default {
  name: "LLMtagprod",

  components: {
    CdxButton,
    CdxCheckbox,
    CdxCombobox,
    CdxDialog,
    CdxField,
    CdxRadio,
    CdxTextArea,
    CdxTextInput,
  },

  data() {
    return {
      // meta
      app_open: true,
      current_step: 1,
      saving: false,
      save_done: false,
      restored: false,

      // prod
      username: mw.config.get("wgUserName"),
      page_name: rm_underscores(mw.config.get("wgPageName")),
      logging_page: `User:${mw.config.get("wgUserName")}/${LOG_PAGE_SUFFIX}`,
      selected_option: "llm_prod",

      case_name: "",
      case_options: [],

      // adv options
      log_to_userpage: mw.user.options.get(LOG_TO_USERPAGE_OPTION) === "1",
      help_off: mw.user.options.get(HELP_OFF_OPTION) === "1",
      watch_page: mw.user.options.get(WATCH_PAGE_OPTION) === "1",

      // output
      editable_wikitext: "",
      editable_summary: "",
      show_preview: false,
      preview_html: "",
      preview_loading: false,
      show_advanced: false,
      update_tracker: true,
      save_steps: [],
    };
  },

  computed: {
    filtered_case_options() {
      const query = (this.case_name || "").trim().toLowerCase();
      if (!query) return this.case_options;
      return this.case_options.filter((item) =>
        item.value.toLowerCase().includes(query),
      );
    },
  },

  watch: {
    log_to_userpage(new_val) {
      save_userpref(LOG_TO_USERPAGE_OPTION, new_val);
    },
    help_off(new_val) {
      save_userpref(HELP_OFF_OPTION, new_val);
    },
    watch_page(new_val) {
      save_userpref(WATCH_PAGE_OPTION, new_val);
    },

    // persist edits as they happen
    editable_wikitext() {
      if (this.current_step === 2) this.persist_last_case();
    },
    editable_summary() {
      if (this.current_step === 2) this.persist_last_case();
    },
    update_tracker() {
      if (this.current_step === 2) this.persist_last_case();
    },
  },

  mounted() {
    const saved = mw.storage.getObject(LAST_CASE_KEY);
    const saved_fresh =
      saved && saved.case_name && Date.now() - saved.ts < LAST_CASE_TTL_MS;
    const origin = get_case_origin(this.page_name);

    if (origin) {
      if (saved_fresh && normalize_title(saved.case_name) === origin) {
        this.restore_saved(saved);
      } else {
        if (saved_fresh) {
          this.selected_option = saved.selected_option || this.selected_option;
        }
        this.case_name = origin;
      }
    } else if (saved_fresh) {
      this.restore_saved(saved);
    }

    this.fetch_ainb_suggestions().then((suggestions) => {
      if (suggestions.length > 0) {
        this.case_options = suggestions.map((sp) => ({
          value: sp,
          label: sp,
        }));
      }
    });
  },

  methods: {
    close_app() {
      close_app();
    },

    reload_page() {
      location.reload();
    },

    generate_defaults() {
      const target_link = (this.case_name || "").trim();
      const see_clause = target_link ? `, see [[${target_link}]]` : "";
      const ai_reason = target_link ? ` |reason= [[${target_link}]]` : "";

      if (this.selected_option === "llm_prod") {
        const help_off_clause = this.help_off ? "|help=off\n" : "";
        const llm_reason = `[[WP:LLMPRV|Presumptive removal of LLM-generated content]]${see_clause}. Please do not remove this tag without following [[WP:LLMPRVOBJ|the procedures for disputing presumptive removal of LLM-generated content]].`;
        this.editable_wikitext = `{{subst:Prod llm\n${help_off_clause}|reason=${llm_reason}}}`;
        this.editable_summary = llm_reason;
      } else {
        this.editable_wikitext = `{{AI-generated${ai_reason} |{{subst:DATE}}}}`;
        this.editable_summary = `Added AI tag${see_clause}`;
      }
    },

    restore_saved(saved) {
      this.case_name = saved.case_name;
      this.selected_option = saved.selected_option || this.selected_option;
      this.update_tracker = saved.update_tracker !== false;

      this.save_steps = [];
      this.generate_defaults();
      if (saved.editable_wikitext !== undefined) {
        this.editable_wikitext = saved.editable_wikitext;
      }
      if (saved.editable_summary !== undefined) {
        this.editable_summary = saved.editable_summary;
      }

      this.restored = true;
      this.show_preview = false;
      this.current_step = 2;
    },

    next_from_step1() {
      this.update_tracker = !!(this.case_name || "").trim();
      this.go_to_step2();
    },

    go_to_step2() {
      this.save_steps = [];
      this.restored = false;
      this.generate_defaults();
      this.persist_last_case();
      this.show_preview = false;
      this.current_step = 2;
    },

    persist_last_case() {
      mw.storage.setObject(LAST_CASE_KEY, {
        case_name: (this.case_name || "").trim(),
        selected_option: this.selected_option,
        update_tracker: this.update_tracker,
        editable_wikitext: this.editable_wikitext,
        editable_summary: this.editable_summary,
        ts: Date.now(),
      });
    },

    go_back_to_step1() {
      mw.storage.remove(LAST_CASE_KEY);
      this.restored = false;
      this.current_step = 1;
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
        this.preview_html = `Preview error: ${err?.message ?? String(err)}`;
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

      const case_page = (this.case_name || "").trim();
      const case_clause = case_page ? ` (relevant page: [[${case_page}]])` : "";

      await api.postWithEditToken({
        action: "edit",
        title: this.logging_page,
        appendtext: `\n# [[:${page}]]: Added {{tl|${template_name}}} with [[special:diff/${revid}|this edit]]${case_clause}, ~~~~~`,
        summary: `Logging ${template_text} on [[${page}]] ${APP_AD}`,
      });
    },

    async update_tracker_status(new_status, revid) {
      if (!revid) return { ok: true, message: "" };
      if (!this.case_name) {
        return { ok: false, message: "no case set" };
      }
      try {
        const res = await api.get({
          action: "query",
          prop: "revisions",
          titles: this.case_name,
          rvprop: "content",
          rvslots: "main",
          formatversion: 2,
        });
        const page = res.query?.pages?.[0];
        if (!page || page.missing) {
          return {
            ok: false,
            message: `case page "${this.case_name}" not found`,
          };
        }
        const wikitext = page.revisions[0].slots.main.content;

        const row_re = get_article_row_regex(this.page_name, true);
        const matches = [...wikitext.matchAll(row_re)];
        if (matches.length === 0) {
          return { ok: false, message: "row not found" };
        }

        const new_text = wikitext.replace(
          row_re,
          (full_match, status_group, notes_group) => {
            const notes = (notes_group || "").trim();
            const note_text =
              this.selected_option === "llm_prod" ? "prodded" : "AI tagged";
            const diff_link = `[[special:diff/${revid}|${note_text}]]`;
            const new_notes = `${notes} ${diff_link}`;
            return `{{AIC article row|article=${this.page_name}|status=${new_status}|notes=${new_notes}}}`;
          },
        );

        if (new_text === wikitext) {
          return { ok: false, message: "row not changed" };
        }

        await api.postWithEditToken({
          action: "edit",
          title: this.case_name,
          text: new_text,
          summary: `Updated status for [[${this.page_name}]] to ${new_status} ${APP_AD}`,
        });
        return { ok: true, message: "" };
      } catch (err) {
        console.error("Tracker update failed:", err);
        return { ok: false, message: err?.message || String(err) };
      }
    },

    async run_step(label, fn) {
      this.save_steps.push({ label, status: "pending", detail: "" });
      const step_item = this.save_steps[this.save_steps.length - 1];
      try {
        await fn();
        step_item.status = "success";
      } catch (err) {
        step_item.status = "error";
        step_item.detail = err?.message || String(err);
      }
      return step_item;
    },

    async save_edit() {
      this.saving = true;
      this.save_done = false;
      this.save_steps = [];

      this.persist_last_case();

      const edit_label =
        this.selected_option === "llm_prod"
          ? "Prodding article"
          : "Adding AI-generated tag";

      let edit_res;
      const edit_step = await this.run_step(edit_label, async () => {
        edit_res = await api.postWithEditToken({
          action: "edit",
          title: this.page_name,
          prependtext: this.editable_wikitext.trim() + "\n",
          summary: `${this.editable_summary.trim()} ${APP_AD}`,
          watchlist: this.watch_page ? "watch" : "nochange",
          nocreate: true,
        });
      });

      if (edit_step.status !== "success") {
        this.saving = false;
        return;
      }

      if (this.log_to_userpage) {
        await this.run_step("Logging to your userpage", () =>
          this.log_to_userpage_action(edit_res.edit?.newrevid),
        );
      }

      if (this.update_tracker && this.case_name) {
        await this.run_step("Updating tracking table", async () => {
          const result = await this.update_tracker_status(
            this.selected_option === "llm_prod" ? "ongoing" : "tagged",
            edit_res.edit?.newrevid,
          );
          if (!result.ok) {
            throw new Error(result.message);
          }
        });
      }

      this.save_done = true;
    },

    async fetch_ainb_suggestions() {
      const suggestions = [];
      try {
        const res = await api.get({
          action: "query",
          list: "allpages",
          apnamespace: 4,
          apprefix: "AI noticeboard/",
          apfilterredir: "nonredirects",
          aplimit: "max",
          formatversion: 2,
        });

        (res.query?.allpages || []).forEach((page) => {
          suggestions.push(page.title);
        });
      } catch (err) {
        console.error("Error fetching AINB suggestions:", err);
      }
      return suggestions;
    },
  },
};
</script>

<template>
  <div>
    <cdx-dialog
      class="ainb-llm-dialog"
      v-model:open="app_open"
      title="LLM tag / prod"
      :use-close-button="true"
      @update:open="close_app"
    >
      <div class="ainb-llm-top-options">
        <span v-if="log_to_userpage" class="ainb-log-target-hint">
          (will be logged to {{ logging_page }})
        </span>
        <cdx-checkbox v-model="log_to_userpage" :disabled="saving">
          Log to your userpage
        </cdx-checkbox>
      </div>

      <div v-if="current_step === 1">
        <cdx-field>
          <cdx-radio
            v-model="selected_option"
            input-value="llm_prod"
            :inline="true"
          >
            Prod LLM
          </cdx-radio>
          <cdx-radio
            v-model="selected_option"
            input-value="ai_tag"
            :inline="true"
          >
            Add &#123;&#123;AI-generated&#125;&#125; tag
          </cdx-radio>
        </cdx-field>

        <cdx-field>
          <template #description
            >Tip: Start typing to autocomplete from subpages of Wikipedia:AI
            noticeboard. You can leave this blank to proceed anyway.</template
          >
          <cdx-combobox
            v-model:selected="case_name"
            :menu-items="filtered_case_options"
            placeholder="Case (optional)"
          ></cdx-combobox>
        </cdx-field>

        <div class="ainb-advanced-wrap">
          <a
            href="#"
            class="ainb-advanced-toggle"
            @click.prevent="show_advanced = !show_advanced"
          >
            {{ show_advanced ? "▾" : "▸" }} Advanced options
          </a>
          <cdx-field v-if="show_advanced">
            <cdx-checkbox
              v-if="selected_option === 'llm_prod'"
              v-model="help_off"
            >
              Set help to off (will suppress the notification instructions; see
              <a
                href="https://en.wikipedia.org/wiki/Template:Prod_llm#Usage"
                target="_blank"
                rel="noopener"
                >docs</a
              >)
            </cdx-checkbox>
            <cdx-checkbox v-model="watch_page"> Watch this page </cdx-checkbox>
          </cdx-field>
        </div>
      </div>

      <div v-if="current_step === 2">
        <div v-if="restored && !saving" class="ainb-restore-note">
          Resumed from your last session.
          <a href="#" @click.prevent="go_back_to_step1">Start over</a>
        </div>

        <div v-if="!saving" class="ainb-thread-context">
          <span
            >Case: <strong>{{ case_name || "none" }}</strong></span
          >
          <a href="#" @click.prevent="go_back_to_step1">Change</a>
        </div>

        <div v-if="!saving" class="ainb-tracker-row">
          <cdx-checkbox
            :model-value="update_tracker && !!(case_name || '').trim()"
            @update:model-value="update_tracker = $event"
            :disabled="saving || !(case_name || '').trim()"
          >
            Mark as
            {{ selected_option === "llm_prod" ? "ongoing" : "tagged" }} on the
            case page
          </cdx-checkbox>
        </div>

        <div v-if="save_steps.length" class="ainb-save-status">
          <div
            v-for="s in save_steps"
            :key="s.label"
            class="ainb-save-status-line"
            :class="'ainb-save-status-' + s.status"
          >
            <span class="ainb-save-status-icon">
              <template v-if="s.status === 'pending'">&#8230;</template>
              <template v-else-if="s.status === 'success'">&#10003;</template>
              <template v-else>&#10007;</template>
            </span>
            <span
              >{{ s.label
              }}<template v-if="s.status === 'success'">... succeeded</template
              ><template v-else-if="s.status === 'error'"
                >... failed: {{ s.detail }}</template
              ><template v-else>...</template></span
            >
          </div>
        </div>

        <cdx-field v-if="!saving">
          <template #label>Resulting wikitext:</template>
          <cdx-text-area
            v-model="editable_wikitext"
            rows="5"
            :disabled="saving"
          ></cdx-text-area>
        </cdx-field>

        <div v-if="!saving" class="ainb-preview-link-wrap">
          <a href="#" @click.prevent="toggle_preview">
            {{ show_preview ? "Hide preview" : "Show preview" }}
          </a>
        </div>

        <div v-if="!saving && show_preview" class="ainb-preview-box">
          <div v-if="preview_loading" class="ainb-loading">
            Loading preview...
          </div>
          <div v-else class="ainb-preview-content" v-html="preview_html"></div>
        </div>

        <cdx-field v-if="!saving">
          <template #label>Edit summary:</template>
          <cdx-text-input v-model="editable_summary" :disabled="saving" />
        </cdx-field>
      </div>

      <template #footer>
        <div class="ainb-dialog-footer">
          <div v-if="current_step === 1">
            <cdx-button @click="close_app">Cancel</cdx-button>
          </div>
          <div v-if="current_step === 1">
            <cdx-button
              action="progressive"
              weight="primary"
              @click="next_from_step1"
            >
              Next
            </cdx-button>
          </div>

          <div v-if="current_step === 2">
            <cdx-button @click="go_back_to_step1" :disabled="saving"
              >Back</cdx-button
            >
          </div>
          <div v-if="current_step === 2">
            <cdx-button
              v-if="save_done"
              action="progressive"
              weight="primary"
              @click="reload_page"
            >
              Reload page
            </cdx-button>
            <cdx-button
              v-else
              action="progressive"
              weight="primary"
              @click="save_edit"
              :disabled="saving || !editable_wikitext"
            >
              {{ saving ? "Saving..." : "Submit edit" }}
            </cdx-button>
          </div>
        </div>
      </template>
    </cdx-dialog>
  </div>
</template>
