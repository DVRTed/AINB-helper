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
  rm_underscores,
} from "./shared.js";

const LAST_THREAD_KEY = "ainb-llm-tag-last-thread";
const LAST_THREAD_TTL_MS = 3 * 60 * 60 * 1000;
const LOG_TO_USERPAGE_OPTION = "userjs-ainb-log-userpage";
const HELP_OFF_OPTION = "userjs-ainb-help-off";
const WATCH_PAGE_OPTION = "userjs-ainb-watch-page";
const LOG_PAGE_SUFFIX = "LLMPROD log";
const TRACKER_PREFIX = "Wikipedia:AI noticeboard/";

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

      // prod
      username: mw.config.get("wgUserName"),
      page_name: rm_underscores(mw.config.get("wgPageName")),
      logging_page: `User:${mw.config.get("wgUserName")}/${LOG_PAGE_SUFFIX}`,
      selected_option: "llm_prod",

      subpage: "",
      subpage_options: [],

      // adv options
      log_to_userpage: mw.user.options.get(LOG_TO_USERPAGE_OPTION) === "1",
      help_off: mw.user.options.get(HELP_OFF_OPTION) === "1",
      watch_page: mw.user.options.get(WATCH_PAGE_OPTION) === "1",

      // output
      editable_wikitext: "",
      editable_summary: "",
      step1_error: "",
      checking_page: false,
      show_preview: false,
      preview_html: "",
      preview_loading: false,
      show_advanced: false,
      tracking_subpage: "",
      tracking_subpage_locked: false,
      update_tracker: true,
      save_steps: [],
    };
  },

  computed: {
    filtered_subpage_options() {
      const query = (this.subpage || "").trim().toLowerCase();
      if (!query) return this.subpage_options;
      return this.subpage_options.filter((item) =>
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
  },

  mounted() {
    const saved = mw.storage.getObject(LAST_THREAD_KEY);
    if (saved && saved.subpage && Date.now() - saved.ts < LAST_THREAD_TTL_MS) {
      this.subpage = saved.subpage;
      this.selected_option = saved.selected_option || this.selected_option;
      this.tracking_subpage = saved.tracking_subpage || "";
      this.tracking_subpage_locked = !!saved.tracking_subpage_locked;

      this.go_to_step2().then(() => {
        this.update_tracker =
          saved.update_tracker !== false && this.tracking_subpage !== "";
        if (saved.editable_wikitext !== undefined) {
          this.editable_wikitext = saved.editable_wikitext;
        }
        if (saved.editable_summary !== undefined) {
          this.editable_summary = saved.editable_summary;
        }
      });
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

  methods: {
    close_app() {
      close_app();
    },

    reload_page() {
      location.reload();
    },

    async go_to_step2() {
      const raw_subpage = this.subpage.trim();
      this.step1_error = "";
      this.save_steps = [];

      if (!this.tracking_subpage_locked) {
        this.tracking_subpage = "";
      }

      if (raw_subpage) {
        this.checking_page = true;
        const [page_title, ...section_parts] = raw_subpage.split("#");
        const page = page_title.trim();
        const section = section_parts.join("#").trim();

        try {
          const res = await api.get({
            action: "parse",
            page,
            prop: "sections",
            redirects: true,
          });

          let section_index = null;
          if (section) {
            const sections = res.parse?.sections || [];
            const matched = sections.find(
              (s) =>
                s.anchor === section ||
                rm_underscores(s.line) === rm_underscores(section),
            );
            if (!matched) {
              this.step1_error = `Section "${section}" does not exist on "${page}"`;
              return;
            }
            section_index = matched.index;
          }

          if (section_index !== null && !this.tracking_subpage_locked) {
            await this.infer_tracking_subpage(page, section_index);
          }
        } catch (err) {
          this.step1_error = `Error checking the page: ${
            err?.message ?? String(err)
          }`;
          return;
        } finally {
          this.checking_page = false;
        }
      }

      const target_link = raw_subpage;
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

      this.persist_last_thread();
      this.show_preview = false;
      this.current_step = 2;
    },

    persist_last_thread() {
      mw.storage.setObject(LAST_THREAD_KEY, {
        subpage: this.subpage.trim(),
        selected_option: this.selected_option,
        tracking_subpage: this.tracking_subpage,
        tracking_subpage_locked: this.tracking_subpage_locked,
        update_tracker: this.update_tracker,
        editable_wikitext: this.editable_wikitext,
        editable_summary: this.editable_summary,
        ts: Date.now(),
      });
    },

    go_back_to_step1() {
      mw.storage.remove(LAST_THREAD_KEY);
      this.step1_error = "";
      this.show_advanced = false;
      this.tracking_subpage = "";
      this.tracking_subpage_locked = false;
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

      const thread = this.subpage.trim();
      const thread_clause = thread ? ` (relevant page: [[${thread}]])` : "";

      await api.postWithEditToken({
        action: "edit",
        title: this.logging_page,
        appendtext: `\n# [[:${page}]]: Added {{tl|${template_name}}} with [[special:diff/${revid}|this edit]]${thread_clause}, ~~~~~`,
        summary: `Logging ${template_text} on [[${page}]] ${APP_AD}`,
      });
    },

    async infer_tracking_subpage(page, section_index) {
      try {
        const res = await api.get({
          action: "parse",
          page,
          section: section_index,
          prop: "wikitext",
        });
        const wikitext = res.parse?.wikitext?.["*"] || "";
        let match = wikitext.match(
          /\{\{\s*AIC status.*(?:tracking_)?subpage\s*=\s*([^|}]+)/i,
        );

        if (!match) {
          match = wikitext.match(
            /\{\{\s*AIC status\s*\|\s*[^|}=]+\|\s*([^|}=]+)/i,
          );
        }

        if (!match) return;

        const raw_value = rm_underscores(match[1].trim());
        if (!raw_value) return;

        this.tracking_subpage = raw_value.startsWith("Wikipedia:")
          ? raw_value
          : `${TRACKER_PREFIX}${raw_value}`;
      } catch (err) {
        console.error("Tracker inference failed:", err);
      }
    },

    change_tracking_subpage() {
      const input = prompt(
        "Tracker subpage:",
        this.tracking_subpage || TRACKER_PREFIX,
      );
      if (input === null) return;
      this.tracking_subpage = input.trim();
      this.tracking_subpage_locked = true;
      this.update_tracker = !!this.tracking_subpage;
    },

    on_update_tracker_toggle(value) {
      this.update_tracker = value;
    },

    async update_tracker_status(new_status, revid) {
      if (!revid) return { ok: true, message: "" };
      if (!this.tracking_subpage) {
        return { ok: false, message: "no tracker page set" };
      }
      try {
        const res = await api.get({
          action: "query",
          prop: "revisions",
          titles: this.tracking_subpage,
          rvprop: "content",
          rvslots: "main",
          formatversion: 2,
        });
        const page = res.query?.pages?.[0];
        if (!page || page.missing) {
          return {
            ok: false,
            message: `tracker page "${this.tracking_subpage}" not found`,
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
          title: this.tracking_subpage,
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

      this.persist_last_thread();

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

      if (this.update_tracker && this.tracking_subpage) {
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
        <div v-if="step1_error" class="ainb-error">{{ step1_error }}</div>
        <cdx-field>
          <cdx-radio
            v-model="selected_option"
            input-value="llm_prod"
            :inline="true"
            :disabled="checking_page"
          >
            Prod LLM
          </cdx-radio>
          <cdx-radio
            v-model="selected_option"
            input-value="ai_tag"
            :inline="true"
            :disabled="checking_page"
          >
            Add &#123;&#123;AI-generated&#125;&#125; tag
          </cdx-radio>
        </cdx-field>

        <cdx-field>
          <template #description
            >Tip: Type the username to autocomplete from Wikipedia:AI
            noticeboard. You can leave this blank to proceed anyway.</template
          >
          <cdx-combobox
            v-model:selected="subpage"
            :menu-items="filtered_subpage_options"
            placeholder="Relevant thread or subpage (optional)"
            :disabled="checking_page"
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
              :disabled="checking_page"
            >
              Set help to off (will suppress the notification instructions; see
              <a
                href="https://en.wikipedia.org/wiki/Template:Prod_llm#Usage"
                target="_blank"
                rel="noopener"
                >docs</a
              >)
            </cdx-checkbox>
            <cdx-checkbox v-model="watch_page" :disabled="checking_page">
              Watch this page
            </cdx-checkbox>
          </cdx-field>
        </div>
      </div>

      <div v-if="current_step === 2">
        <div v-if="!saving" class="ainb-thread-context">
          <span
            >Thread: <strong>{{ subpage }}</strong></span
          >
          <a href="#" @click.prevent="go_back_to_step1">Change</a>
        </div>

        <div v-if="!saving" class="ainb-tracker-row">
          <cdx-checkbox
            :model-value="update_tracker"
            @update:model-value="on_update_tracker_toggle"
            :disabled="saving || !tracking_subpage"
          >
            Mark as
            {{ selected_option === "llm_prod" ? "ongoing" : "tagged" }} on the
            tracker
          </cdx-checkbox>
          <span
            v-if="tracking_subpage && update_tracker"
            class="ainb-tracker-target"
          >
            <strong>{{ tracking_subpage }}</strong> (<a
              href="#"
              @click.prevent="change_tracking_subpage"
              >change</a
            >)
          </span>
          <div
            v-else-if="!tracking_subpage"
            class="ainb-tracker-target ainb-tracker-missing"
          >
            Couldn't infer tracking page.
            <a href="#" @click.prevent="change_tracking_subpage">Set</a>
          </div>
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
              @click="go_to_step2"
              :disabled="checking_page"
            >
              {{ checking_page ? "Checking..." : "Next" }}
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
