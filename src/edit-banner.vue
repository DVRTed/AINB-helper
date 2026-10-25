<script>
import { CdxButton, CdxDialog, CdxSelect, CdxField } from "@wikimedia/codex";
import { APP_AD, api, close_app, get_page_info } from "./shared.js";

// todo: move to shared.js if anything else uses it
const BANNER_RE = /\{\{\s*AINB case banner\s*([|\s\S]*?)\}\}/;

/**
 * creates map_option object for a select field;
 * @param {"cleanup"|"conduct"|"llmprod"|"case_type"} value
 * @param {"open"|"closed"} state
 * @param description
 */
const map_opt = (value, state, description) => ({
  value,
  label: `${value} (${state})`,
  description,
});

const FIELDS = [
  {
    key: "cleanup",
    label: "Cleanup",
    map_options: [
      map_opt("analysis", "open", "Analysis is needed for cleanup."),
      map_opt("ongoing", "open", "Cleanup efforts are ongoing."),
      map_opt("completed", "closed", "Cleanup has been completed."),
      map_opt("unnecessary", "closed", "No cleanup needed."),
    ],
  },
  {
    key: "llmprod",
    label: "LLMPROD",
    map_options: [
      map_opt(
        "undetermined",
        "open",
        "Applicability of LLMPROD not established yet.",
      ),
      map_opt("ongoing", "open", "LLMPROD is ongoing."),
      map_opt(
        "waiting",
        "open",
        "LLMPRODs are needed, waiting to meet the eligibility criteria.",
      ),
      map_opt(
        "requested",
        "open",
        "All LLMPROD tags have been applied, awaiting administrative action.",
      ),
      map_opt("completed", "closed", "All pages have been deleted or cleaned."),
      map_opt(
        "unnecessary",
        "closed",
        "LLMPROD is unnecessary or unapplicable.",
      ),
    ],
  },
  {
    key: "conduct",
    label: "Conduct",
    map_options: [
      map_opt("review", "open", "AI editing behavior is under investigation."),
      map_opt("admin", "open", "Admin needed to deal with editing behavior."),
      map_opt("hold", "open", "Case ongoing but put on hold (e.g. SPI)."),
      map_opt("inactive", "closed", "No active editing from user."),
      map_opt("pblock", "closed", "Partially blocked."),
      map_opt("siteblock", "closed", "Fully blocked."),
      map_opt("resolved", "closed", "No further action needed."),
    ],
  },
  {
    key: "case_type",
    label: "Case type",
    map_options: [
      { value: "article", label: "article", description: "Single article." },
      { value: "user", label: "user", description: "A user's contributions." },
      {
        value: "group",
        label: "group",
        description: "A group of related users.",
      },
    ],
  },
];

export default {
  name: "EditBanner",
  components: { CdxButton, CdxDialog, CdxSelect, CdxField },

  data() {
    // meta
    return {
      app_open: true,
      app_saving: false,
      app_loading: false,
      app_error: "",

      fields: FIELDS,
      page_name: mw.config.get("wgPageName"),
      current_params: [],
      values: {},
      wikitext: "",
      base_revid: null,
    };
  },

  async mounted() {
    this.app_loading = true;

    try {
      const info = await get_page_info(this.page_name);
      this.wikitext = info.text;
      this.base_revid = info.revid;
      const match = this.wikitext.match(BANNER_RE);
      if (!match) {
        this.app_error = "No AINB case banner found on this page.";
        return;
      }

      const banner_params = match[1].split("|");

      banner_params.forEach((piece) => {
        const equal_index = piece.indexOf("=");
        if (equal_index === -1) {
          // we don't handle positional args because the template doesn't
          return;
        }
        const key = piece.slice(0, equal_index).trim();
        const value = piece.slice(equal_index + 1).trim();
        this.current_params.push([key, value]);
      });

      for (const f of FIELDS) {
        // to save new state of non-existent params on the banner
        if (!this.current_params.some(([key]) => key === f.key)) {
          this.current_params.push([f.key, ""]);
        }
      }

      this.values = Object.fromEntries(this.current_params);
    } catch (e) {
      this.app_error = "Error loading page: " + (e?.message ?? e);
    } finally {
      this.app_loading = false;
    }
  },

  methods: {
    close_app,

    async save() {
      this.app_saving = true;
      this.app_error = "";

      try {
        const new_params = this.current_params
          .map(([key]) => `${key}=${this.values[key] ?? ""}`)

          .join(" |");

        const text = this.wikitext.replace(
          BANNER_RE,
          () => `{{AINB case banner |${new_params}}}`,
        );

        await api.postWithEditToken({
          action: "edit",
          title: this.page_name,
          text,
          baserevid: this.base_revid,
          summary: `Updated case banner ${APP_AD}`,
        });
        location.reload();
      } catch (e) {
        this.app_error = "Error saving: " + (e?.message ?? e);
        this.app_saving = false;
      }
    },
  },
};
</script>

<template>
  <cdx-dialog
    v-model:open="app_open"
    title="Update case banner"
    :use-close-button="true"
    @update:open="close_app"
  >
    <div v-if="app_error" class="ainb-error">{{ app_error }}</div>
    <div v-else-if="app_loading" class="ainb-loading">Loading...</div>

    <template v-else-if="current_params.length">
      <cdx-field v-for="f in fields" :key="f.key">
        <template #label>{{ f.label }}</template>
        <cdx-select
          v-model:selected="values[f.key]"
          :menu-items="f.map_options"
          :disabled="app_saving"
        />
      </cdx-field>
    </template>

    <template #footer>
      <div class="ainb-dialog-footer">
        <cdx-button :disabled="app_saving" @click="close_app">
          Cancel
        </cdx-button>
        <cdx-button
          :disabled="app_saving || !current_params.length"
          action="progressive"
          weight="primary"
          @click="save"
        >
          {{ app_saving ? "Saving..." : "Save" }}
        </cdx-button>
      </div>
    </template>
  </cdx-dialog>
</template>
