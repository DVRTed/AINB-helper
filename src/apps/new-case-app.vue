<script>
import {
  CdxButton,
  CdxDialog,
  CdxField,
  CdxMessage,
  CdxSelect,
  CdxTextInput,
} from "@wikimedia/codex";
import {
  APP_AD,
  DEBUG_MODE,
  api,
  close_app,
  create_app,
  get_page_info,
} from "../shared.js";
import Main, { NOTICEBOARD_PREFIX } from "./main-app.vue";

// freeze rev of Wikipedia:AI noticeboard/AINB/Blank report
// note that the current rev is fetched instead of this when DEBUG_MODE is enabled
const BLANK_REPORT_REVISION = DEBUG_MODE ? null : 1381727967;

export default {
  components: {
    CdxButton,
    CdxDialog,
    CdxField,
    CdxMessage,
    CdxSelect,
    CdxTextInput,
  },

  props: {
    initial_case_name: { type: String, default: "" },
  },

  data() {
    return {
      app_open: true,
      app_loading: false,

      current_step: this.initial_case_name ? 3 : 1,

      available_case_types: [
        { value: "article", label: "Article" },
        { value: "user", label: "User" },
        { value: "group", label: "Group" },
      ],

      case_already_exists: !!this.initial_case_name,
      case_name_input: this.initial_case_name,
      case_type: "user",
      case_discussion_wikitext: "",
    };
  },

  computed: {
    dialog_title() {
      if (this.current_step === 2 || this.current_step === 3) {
        if (this.case_already_exists) return "Add to the discussion";
        return "File a new case";
      }

      if (this.current_step === 4) return "Case filed";
      return "AINB-helper";
    },

    case_name() {
      return this.case_name_input.trim();
    },

    target_page_title() {
      return NOTICEBOARD_PREFIX + this.case_name;
    },

    target_page_url() {
      return mw.util.getUrl(this.target_page_title);
    },
  },

  created() {
    if (this.initial_case_name) {
      this.case_discussion_wikitext = this.generate_case_discussion(true);
    }
  },

  methods: {
    handle_dialog_close(open) {
      if (open !== true) close_app();
    },

    open_main_app() {
      create_app(Main);
    },

    get_utc_date_string() {
      // e.g., "27 October 2026"
      return new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    },

    async get_case_preload() {
      const blank_report = await get_page_info(
        // this is only applicable in debug mode
        "Wikipedia:AI noticeboard/AINB/Blank report",
        BLANK_REPORT_REVISION,
      );

      const text = blank_report?.text;
      if (!text) throw new Error("Could not fetch case preload");

      return text;
    },

    set_values_to_preload(preload) {
      const replacements = {
        1: "analysis",
        2: "review",
        3: "undetermined",
        4: this.case_name,
        5: this.case_discussion_wikitext.trim(),
        6: this.case_type,
      };

      const new_wikitext = preload
        .replace(/\$(\d)/g, (match, number) => {
          const placeholder = Object.hasOwn(replacements, number);
          if (!placeholder) {
            throw new Error(
              `Invalid index "${match}" on the preload; fix either the preload or this script.`,
            );
          }

          return replacements[number];
        })
        .replaceAll("<noinclude/>", "")
        .replace(/<noinclude>.*?<\/noinclude>/gs, "");

      return new_wikitext;
    },

    generate_case_discussion(no_link = false) {
      let link = "";

      if (!no_link) {
        if (this.case_type === "article") {
          link = `{{Pagelinks|1=${this.case_name}}}`;
        }
        if (this.case_type === "user") {
          link = `{{User-ainb|1=${this.case_name}}}`;
        }
        // link is blank for "group" type so
        // don't add newlines
        if (link) link += "\n\n";
      }

      const discussion =
        link +
        `=== ${this.get_utc_date_string()} ===\n` +
        "[ Replace this line with your new filing ] ~~~~";

      return discussion;
    },

    add_discussion_above_cleanup(case_text, new_discussion) {
      // add to the page content that's fetched while saving,
      // because the case page could have been modified
      // while somebody stares at the textarea for an eternity.

      const cleanup_heading_re = /^==\s*Cleanup\s*==/m;
      if (!case_text.match(cleanup_heading_re)) {
        throw new Error("Could not find the Cleanup section");
      }

      const new_text = case_text.replace(cleanup_heading_re, () => {
        return `${new_discussion}\n\n== Cleanup ==`;
      });

      // todo: maybe update the existing case's 'type'
      return new_text;
    },

    async process_case_page() {
      if (!this.case_name || this.app_loading) return;

      this.app_loading = true;

      try {
        const page = await get_page_info(this.target_page_title);

        if (page) {
          this.case_already_exists = true;
          this.case_discussion_wikitext = this.generate_case_discussion(true);
          this.current_step = 3;
        }

        if (!page) {
          this.case_already_exists = false;
          this.case_discussion_wikitext = this.generate_case_discussion();
          this.current_step = 3;
        }
      } catch (e) {
        mw.notify(e.message ?? e);
        console.error(e);
      } finally {
        this.app_loading = false;
      }
    },

    async create_case_page() {
      if (!this.case_name || this.app_loading) return;

      this.app_loading = true;
      try {
        if (this.case_already_exists) {
          const page = await get_page_info(this.target_page_title);
          if (!page) throw new Error("The case page no longer exists");

          const new_page_text = this.add_discussion_above_cleanup(
            page.text,
            this.case_discussion_wikitext,
          );
          await api.postWithEditToken({
            action: "edit",
            title: this.target_page_title,
            text: new_page_text,
            baserevid: page.revid,
            summary: `Adding a new discussion subsection ${APP_AD}`,
          });
        } else {
          const preload = await this.get_case_preload();
          const new_page_text = this.set_values_to_preload(preload);

          await api.postWithEditToken({
            action: "edit",
            title: this.target_page_title,
            text: new_page_text,
            summary: `Filing a new case ${APP_AD}`,
            createonly: true,
          });
        }
        this.current_step = 4;
      } catch (e) {
        mw.notify(e.message ?? e);
        console.error(e);
      } finally {
        this.app_loading = false;
      }
    },
  },
};
</script>

<template>
  <cdx-dialog
    v-model:open="app_open"
    class="ainb-helper ainb-new-case"
    :title="dialog_title"
    :use-close-button="true"
    @update:open="handle_dialog_close"
  >
    <!-- two options: one to create a new case and another to add tracking table
   to an existing case. the second option semi-half-literally kills this app and
   launches the main-app. -->
    <div v-if="current_step === 1">
      <div class="ainb-intro-choices">
        <cdx-button
          class="ainb-intro-choice"
          action="progressive"
          @click="current_step = 2"
        >
          <svg
            class="ainb-intro-choice-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>File a new case</span>
        </cdx-button>
        <cdx-button class="ainb-intro-choice" @click="open_main_app">
          <svg
            class="ainb-intro-choice-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 5h16v14H4zM4 10h16M9 10v9m6-9v9" />
          </svg>
          <span>Add tracking table to an existing case</span>
        </cdx-button>
      </div>
    </div>

    <div v-if="current_step === 2" class="ainb-step ainb-new-case-step">
      <cdx-field>
        <template #label>Case name</template>
        <cdx-text-input
          v-model="case_name_input"
          placeholder="Typically a username without the User: prefix"
          maxlength="150"
          @keydown.enter="process_case_page"
        />
      </cdx-field>

      <cdx-field>
        <template #label>Case type</template>
        <cdx-select
          v-model:selected="case_type"
          :menu-items="available_case_types"
        />
      </cdx-field>
    </div>

    <div v-if="current_step === 3" class="ainb-step ainb-new-case-step">
      <cdx-message v-if="case_already_exists" type="notice">
        The following will be added to the Discussion section of the existing
        case page for
        <b>
          <a :href="target_page_url" target="_blank">{{ case_name }}</a></b>.
      </cdx-message>

      <cdx-field>
        <template #label>Discussion subsection</template>
        <textarea
          v-model="case_discussion_wikitext"
          :disabled="app_loading"
          class="ainb-new-case-discussion"
          rows="12"
        ></textarea>
      </cdx-field>
    </div>

    <template v-if="current_step === 4">
      <p v-if="case_already_exists">
        Successfully added a new discussion subsection.
      </p>
      <p v-else>Successfully filed a new case.</p>
      <p>
        <a :href="target_page_url" target="_blank">{{ target_page_title }}</a>
      </p>
    </template>

    <!-- the footers -->
    <template #footer>
      <div class="ainb-dialog-footer">
        <template v-if="current_step === 2">
          <div></div>
          <div>
            <cdx-button @click="current_step = 1">Back</cdx-button>
            <cdx-button
              action="progressive"
              weight="primary"
              :disabled="!case_name || app_loading"
              @click="process_case_page"
            >
              {{ app_loading ? "Processing..." : "Continue" }}
            </cdx-button>
          </div>
        </template>

        <template v-if="current_step === 3">
          <div class="ainb-subpage-info">
            Target: <strong>{{ target_page_title }}</strong>
          </div>
          <div>
            <cdx-button
              v-if="!initial_case_name"
              :disabled="app_loading"
              @click="current_step = 2"
            >
              Back
            </cdx-button>
            <cdx-button
              action="progressive"
              weight="primary"
              :disabled="
                app_loading ||
                  !case_discussion_wikitext.trim() ||
                  case_discussion_wikitext.includes('[ Replace this line')
              "
              @click="create_case_page"
            >
              {{
                app_loading
                  ? "Writing..."
                  : case_already_exists
                    ? "Add discussion"
                    : "File case"
              }}
            </cdx-button>
          </div>
        </template>

        <template v-if="current_step === 4">
          <div></div>
          <div>
            <cdx-button @click="handle_dialog_close(false)">Close</cdx-button>
          </div>
        </template>
      </div>
    </template>
  </cdx-dialog>
</template>
