$(async () => {
const APP_ID = "ainb-helper";
const APP_AD = "(using [[User:DVRTed/AINB-helper|AINB-helper]])";
const DEBUG_MODE = true;
const DEBUG_PAGE = "User:DVRTed/sandbox2";

const require = mw.loader.require;
await mw.loader.using([
  "vue",
  "@wikimedia/codex",
  "mediawiki.api",
  "mediawiki.util",
]);
const api = new mw.Api();
const Vue = require("vue");

let current_app = null;

function close_app() {
  if (current_app) {
    current_app.unmount();
    current_app = null;
  }
  document.getElementById(APP_ID)?.remove();
}

// reuseable function to create and mount the app
// that registers a bunch of components and handles dups
function create_app(App) {
  const { createMwApp } = Vue;
  const codex = require("@wikimedia/codex");

  close_app();

  const mount_point = document.createElement("div");
  mount_point.id = APP_ID;
  document.body.appendChild(mount_point);

  const app = createMwApp({
    ...App,
    mixins: [
      {
        methods: {
          handle_dialog_close() {
            close_app();
          },
        },
      },
      ...(App.mixins || []),
    ],
  });

  const {
    CdxButton,
    CdxCheckbox,
    CdxCombobox,
    CdxDialog,
    CdxField,
    CdxMenuButton,
    CdxProgressBar,
    CdxRadio,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
  } = codex;
  Object.entries({
    CdxButton,
    CdxCheckbox,
    CdxCombobox,
    CdxDialog,
    CdxField,
    CdxMenuButton,
    CdxProgressBar,
    CdxRadio,
    CdxSelect,
    CdxTextArea,
    CdxTextInput,
  }).forEach(([name, c]) => app.component(name, c));

  app.mount(mount_point);
  current_app = app;
}

function create_main_app() {
  const { nextTick } = Vue;

  create_app({
    template: generate_main_template(),

    data() {
      return {
        is_open: true,
        step: 1,
        username: mw.config.get("wgRelevantUserName") || "",
        normalized_username: "",
        normalized_usernames: [],
        anchor_date: "2022-12-01",
        end_date: "",
        loading: false,
        progress: 0,
        edit_count: 0,
        error: "",
        article_groups: [],
        article_search: "",
        sort_mode: "recent",
        selected_article_title: "",
        creating: false,
        create_error: "",
        generated_wikitext: "",
        target_page_title: "",
        target_page_url: "",
        viewing_diff_edit: null,
        filter_menu_selected: null,
        available_tags: [],
        selected_tags_map: {},
        tag_dialog_open: false,
        tag_counts: {},
        extra_notes: "",
        notes_visible: false,
      };
    },

    computed: {
      dialog_title() {
        if (this.step === 1) return "Generate a tracking subpage for AINB";
        if (this.step === 2) return "Select diffs to include";
        return "Page Created";
      },
      total_selected_diffs() {
        return this.article_groups.reduce(
          (sum, group) => sum + group.selected_count,
          0,
        );
      },
      total_selected() {
        return this.article_groups.filter((group) => group.selected_count > 0)
          .length;
      },
      total_groups() {
        return this.article_groups.length;
      },
      all_selected() {
        return (
          this.article_groups.length > 0 &&
          this.article_groups.every((group) => group.all_selected)
        );
      },
      some_selected() {
        return this.article_groups.some(
          (group) => group.some_selected || group.all_selected,
        );
      },
      current_date() {
        return new Date().toISOString().split("T")[0];
      },
      diff_dialog_open: {
        get() {
          return !!this.viewing_diff_edit;
        },
        set(val) {
          if (!val) this.viewing_diff_edit = null;
        },
      },
      diff_edit_index() {
        if (!this.selected_group || !this.viewing_diff_edit) return -1;
        return this.selected_group.edits.findIndex(
          (edit) => edit.revid === this.viewing_diff_edit.revid,
        );
      },
      has_prev_diff() {
        return this.diff_edit_index > 0;
      },
      has_next_diff() {
        return (
          this.diff_edit_index >= 0 &&
          this.selected_group &&
          this.diff_edit_index < this.selected_group.edits.length - 1
        );
      },
      filtered_sorted_groups() {
        let groups = this.article_groups;
        const query = this.article_search.trim().toLowerCase();

        if (query) {
          groups = groups.filter((g) => g.title.toLowerCase().includes(query));
        }

        groups = [...groups];

        if (this.sort_mode === "edits") {
          groups.sort((a, b) => b.edits.length - a.edits.length);
        } else if (this.sort_mode === "alpha") {
          groups.sort((a, b) => a.title.localeCompare(b.title));
        } else if (this.sort_mode === "recent") {
          groups.sort(
            (a, b) =>
              new Date(b.edits[0].timestamp) - new Date(a.edits[0].timestamp),
          );
        }

        return groups;
      },
      selected_group() {
        return (
          this.article_groups.find(
            (g) => g.title === this.selected_article_title,
          ) || null
        );
      },
      filter_menu_items() {
        return [
          { value: "smaller", label: "Unselect smaller edits" },
          { value: "tag", label: "Unselect edits by tag" },
          { value: "non_creations", label: "Unselect non-creations" },
        ];
      },
      selected_tag_list() {
        return this.available_tags.filter((tag) => this.selected_tags_map[tag]);
      },
      tags_in_selection() {
        return this.available_tags.filter(
          (tag) => (this.tag_counts[tag] || 0) > 0,
        );
      },
      is_multiple_users() {
        return this.normalized_usernames.length > 1;
      },
    },
    methods: {
      fire_hook(selector) {
        nextTick(() => {
          const $content = $(selector);
          if ($content.length) {
            mw.hook("wikipage.content").fire($content);
          }
        });
      },

      select_article(title) {
        this.selected_article_title = title;
        this.fire_hook(".ainb-revisions-table");
      },

      update_group_selection(group) {
        const selected = group.edits.filter((edit) => edit.selected).length;
        group.selected_count = selected;
        group.all_selected = selected === group.edits.length;
        group.some_selected = selected > 0 && selected < group.edits.length;
      },
      toggle_article(group) {
        const new_value = !group.all_selected;
        group.edits.forEach((edit) => (edit.selected = new_value));
        this.update_group_selection(group);
      },
      toggle_all() {
        const new_value = !this.all_selected;
        this.article_groups.forEach((group) => {
          group.edits.forEach((edit) => (edit.selected = new_value));
          this.update_group_selection(group);
        });
      },
      append_filter_note(text) {
        const line = `* ${text}`;
        this.extra_notes = this.extra_notes
          ? `${this.extra_notes}\n${line}`
          : line;
        this.notes_visible = true;
      },
      unselect_smaller_edits() {
        const input = prompt("Unselect edits smaller than (bytes):", "35");
        if (input === null) return;
        const threshold = parseInt(input, 10);
        if (isNaN(threshold)) return;

        this.article_groups.forEach((group) => {
          group.edits.forEach((edit) => {
            if (edit.selected && Math.abs(edit.sizediff) < threshold) {
              edit.selected = false;
            }
          });
          this.update_group_selection(group);
        });

        this.append_filter_note(
          `Edits smaller than +/- ${threshold} bytes were excluded.`,
        );
      },
      handle_filter_menu_select(value) {
        this.filter_menu_selected = null;
        if (value === "smaller") {
          this.unselect_smaller_edits();
        } else if (value === "tag") {
          this.open_tag_dialog();
        } else if (value === "non_creations") {
          this.unselect_non_creations();
        }
      },
      unselect_non_creations() {
        this.article_groups.forEach((group) => {
          group.edits.forEach((edit) => {
            const is_creation = edit.new !== undefined;
            if (edit.selected && !is_creation) {
              edit.selected = false;
            }
          });
          this.update_group_selection(group);
        });

        this.append_filter_note("Non-creation edits were excluded.");
      },
      open_tag_dialog() {
        this.selected_tags_map = Object.fromEntries(
          this.available_tags.map((tag) => [tag, false]),
        );

        const counts = {};
        this.article_groups.forEach((group) => {
          group.edits.forEach((edit) => {
            if (!edit.selected) return;
            (edit.tags || []).forEach((tag) => {
              counts[tag] = (counts[tag] || 0) + 1;
            });
          });
        });
        this.tag_counts = counts;

        this.tag_dialog_open = true;
      },
      unselect_by_tag() {
        const tags_to_unselect = new Set(this.selected_tag_list);

        this.article_groups.forEach((group) => {
          group.edits.forEach((edit) => {
            if (
              edit.selected &&
              edit.tags?.some((tag) => tags_to_unselect.has(tag))
            ) {
              edit.selected = false;
            }
          });
          this.update_group_selection(group);
        });

        this.append_filter_note(
          `Edits tagged "${[...tags_to_unselect].join('", "')}" were excluded.`,
        );

        this.tag_dialog_open = false;
      },
      async fetch_contributions() {
        this.loading = true;
        this.error = "";
        this.progress = 0;
        this.extra_notes = "";
        this.notes_visible = false;

        try {
          const edits = [];
          let continuation = null;

          const is_ip_address = (u) =>
            mw.util.isIPv4Address(u) || mw.util.isIPv6Address(u);

          const raw_users = this.username
            .split("|")
            .map((u) => u.trim().replace(/^user:/i, ""))
            .filter(Boolean);

          if (raw_users.length === 0) {
            this.error = "Please enter a username.";
            return;
          }

          const ip_users = raw_users.filter(is_ip_address);
          const registered_raw = raw_users.filter((u) => !is_ip_address(u));

          let normalized_registered_users = [];
          let registered_edit_count = 0;

          // check for users w/ too many edits
          if (registered_raw.length > 0) {
            const user_info = await api.get({
              action: "query",
              list: "users",
              ususers: registered_raw.join("|"),
              usprop: "editcount",
            });
            const users = user_info.query?.users || [];

            registered_edit_count = users.reduce(
              (sum, u) => sum + (u.editcount || 0),
              0,
            );

            normalized_registered_users = users
              .filter((u) => u.name && !u.missing && !u.invalid)
              .map((u) => u.name);
          }

          const normalized_users = [
            ...new Set([...normalized_registered_users, ...ip_users]),
          ];

          if (
            normalized_users.length === 0 ||
            (registered_raw.length > 0 &&
              ip_users.length === 0 &&
              !registered_edit_count)
          ) {
            this.error = "No edits found. Note: usernames are case-sensitive.";
            return;
          }

          if (registered_edit_count > 20000) {
            if (
              !confirm(
                `User has over 20k edits (${registered_edit_count}). Are you sure you want to continue?`,
              )
            ) {
              this.error = "Manually cancelled: User has too many edits.";
              return;
            }
          }

          this.normalized_usernames = normalized_users;
          this.normalized_username = normalized_users[0] || "";

          if (normalized_users.length > 1) {
            const user_list = normalized_users
              .map((u) => `[[User:${u}]]`)
              .join(", ");
            this.extra_notes = `* Includes contributions from multiple accounts: ${user_list}`;
            this.notes_visible = true;
          }

          const ucend_timestamp = this.anchor_date
            ? `${this.anchor_date}T00:00:00Z`
            : undefined;
          const ucstart_timestamp = this.end_date
            ? `${this.end_date}T00:00:00Z`
            : undefined;

          do {
            const params = {
              action: "query",
              list: "usercontribs",
              ucnamespace: 0,
              ucuser: normalized_users.join("|"),
              ...(ucend_timestamp ? { ucend: ucend_timestamp } : {}),
              ...(ucstart_timestamp ? { ucstart: ucstart_timestamp } : {}),
              uclimit: "max",
              ucprop: "ids|title|timestamp|comment|sizediff|tags|flags|user",
              ucdir: "older",
              ...continuation,
            };

            const response = await api.get(params);
            if (response.error) throw new Error(response.error.info);

            edits.push(...response.query.usercontribs);
            this.progress = edits.length;
            continuation = response.continue;
          } while (continuation);

          const valid_edits = edits.filter(
            (edit) => !edit.tags?.includes("mw-reverted"),
          );
          const groups = {};

          valid_edits.forEach((edit) => {
            if (!groups[edit.title]) {
              groups[edit.title] = {
                title: edit.title,
                edits: [],
                all_selected: false,
                some_selected: false,
                selected_count: 0,
              };
            }
            groups[edit.title].edits.push({
              ...edit,
              selected: false,
              diff_loading: false,
              diff_content: "",
            });
          });

          this.edit_count = valid_edits.length;

          const tag_set = new Set();
          valid_edits.forEach((edit) => {
            (edit.tags || []).forEach((tag) => tag_set.add(tag));
          });
          this.available_tags = Array.from(tag_set).sort();

          this.article_groups = Object.values(groups);

          this.article_groups.forEach((group) =>
            this.update_group_selection(group),
          );

          if (this.article_groups.length === 0) {
            this.error = "No contributions found in the specified period.";
          } else {
            this.step = 2;
            const top_article = this.filtered_sorted_groups[0];
            if (top_article) this.select_article(top_article.title);

            const page_title = DEBUG_MODE
              ? DEBUG_PAGE
              : `Wikipedia:AI noticeboard/${this.current_date} ${this.normalized_username}`;
            this.target_page_title = page_title;
            this.target_page_url = mw.util.getUrl(page_title);
          }
        } catch (error) {
          this.error = "Error fetching contributions: " + error.message;
          console.error(error);
        } finally {
          this.loading = false;
        }
      },
      show_diff_popup(edit) {
        this.viewing_diff_edit = edit;
        this.load_diff(edit);
      },
      close_diff_popup() {
        this.viewing_diff_edit = null;
      },
      go_to_diff(offset) {
        if (!this.selected_group || this.diff_edit_index < 0) return;
        const next_edit =
          this.selected_group.edits[this.diff_edit_index + offset];
        if (next_edit) this.show_diff_popup(next_edit);
      },
      jump_to_diff(revid) {
        if (!this.selected_group) return;
        const edit = this.selected_group.edits.find((e) => e.revid == revid);
        if (edit) this.show_diff_popup(edit);
      },
      async load_diff(edit) {
        if (edit.diff_content || edit.diff_loading) return;

        edit.diff_loading = true;
        try {
          const response = await api.get({
            action: "compare",
            fromrev: edit.revid,
            torelative: "prev",
            prop: "diff",
          });
          if (response.compare?.["*"]) {
            edit.diff_content = `<table class="diff">${response.compare["*"]}</table>`;
          } else {
            edit.diff_content = "<p>Could not load diff.</p>";
          }
        } catch (error) {
          console.error("Error loading diff:", error);
          edit.diff_content =
            "<p>Error loading diff: " + error.message + "</p>";
        } finally {
          edit.diff_loading = false;
        }
      },
      async generate_report() {
        const wikitext = this.build_wikitext();
        this.generated_wikitext = wikitext;
        this.creating = true;
        this.create_error = "";
        this.step = 3;

        try {
          await api.postWithEditToken({
            action: "edit",
            title: this.target_page_title,
            text: wikitext,
            summary: `Creating tracking subpage ${APP_AD}`,
          });
        } catch (error) {
          this.create_error = "Error creating page: " + error.message;
          console.error(error);
        } finally {
          this.creating = false;
        }
      },
      build_wikitext() {
        const selected_groups = this.article_groups
          .map((group) => ({
            ...group,
            edits: group.edits.filter((edit) => edit.selected),
          }))
          .filter((group) => group.edits.length > 0);

        const infocard_user = this.is_multiple_users
          ? "multiple users; see notes below."
          : `{{Userlinks|1=${this.normalized_username}}}`;

        const infocard = `{{InfoCard|content='''Tracker detail'''
* User: ${infocard_user}
* Start date: ${this.anchor_date || "unset"} 
* End date: ${this.end_date || this.current_date}
}}`;

        let wikitext = `{{NOINDEX|visible=yes}}\nRelevant report and discussion may be viewable on the talk page.\n\n${infocard}\n\n`;

        wikitext += `== Tracking list ==\n`;
        if (this.extra_notes.trim()) {
          wikitext += `{{Notice |heading=Notes |\n${this.extra_notes.trim()}\n}}\n\n`;
        }
        wikitext += `{{AIC article list|\n`;

        selected_groups.forEach((group) => {
          const format_edit = (edit) => {
            const edit_size = this.format_bytes(edit.sizediff);
            const edit_link = `[[Special:Diff/${edit.revid}|(${edit_size})]]`;
            const creation_note =
              edit.new !== undefined ? " (page created)" : "";
            return `${edit_link}${creation_note}`;
          };

          let links_text = "";
          if (this.is_multiple_users) {
            const user_groups = {};
            group.edits.forEach((edit) => {
              const u = edit.user;
              if (!user_groups[u]) user_groups[u] = [];
              user_groups[u].push(format_edit(edit));
            });
            links_text = Object.entries(user_groups)
              .map(
                ([user, links]) =>
                  `[[Special:Contributions/${user}|${user}]]: ${links.join(
                    " ",
                  )}`,
              )
              .join("\n");
          } else {
            links_text = group.edits.map(format_edit).join(" ");
          }

          const edit_count = group.edits.length;
          const edit_str = edit_count > 1 ? "edits" : "edit";
          const separator = this.is_multiple_users ? "\n" : " ";
          wikitext += `{{AIC article row|article=${group.title}|status=requested|notes=${edit_count} ${edit_str}:${separator}${links_text}}}\n`;
        });

        wikitext += `}}\n`;
        return wikitext;
      },
      async copy_wikitext() {
        try {
          await navigator.clipboard.writeText(this.build_wikitext());
          mw.notify("Wikitext copied to clipboard.", { type: "success" });
        } catch (err) {
          mw.notify("Failed to copy to clipboard.", { type: "error" });
        }
      },
      get_diff_url(revid) {
        return mw.util.getUrl(`Special:Diff/${revid}`);
      },
      get_article_url(title) {
        return mw.util.getUrl(title);
      },
      get_history_url(title) {
        return mw.util.getUrl(title, { action: "history" });
      },
      get_user_url(username) {
        return mw.util.getUrl(`User:${username}`);
      },
      get_contribs_url(username) {
        return mw.util.getUrl(`Special:Contributions/${username}`);
      },
      get_group_users(group) {
        if (!group?.edits) return "";
        const users = [
          ...new Set(group.edits.map((e) => e.user).filter(Boolean)),
        ];
        return users.length ? users.join(", ") : this.normalized_username;
      },
      format_bytes(bytes) {
        return (bytes > 0 ? "+" : "") + (bytes || 0);
      },
      format_date(timestamp) {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        return date.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
      get_size_class(bytes) {
        return bytes > 0 ? "ainb-pos" : bytes < 0 ? "ainb-neg" : "ainb-neu";
      },
      truncate(string, max_length) {
        return string?.length > max_length
          ? string.slice(0, max_length - 1) + "..."
          : string || "";
      },
    },
  });
}

function generate_main_template() {
  const step1 = `
<div v-if="step === 1" class="ainb-step">
    <div v-if="!loading">
        <p>Enter the username</p>
        <cdx-text-input v-model="username" autocomplete="off" data-bwignore="true" data-lpignore="true" data-1p-ignore
            placeholder="User:ExampleUser or ExampleUser" @keydown.enter="fetch_contributions" />

        <div class="ainb-date-field">
            <label for="ainb-anchor-date">Only fetch edits made after:</label>
            <input id="ainb-anchor-date" type="date" v-model="anchor_date" class="ainb-date-input" />
            <p class="ainb-date-hint">Defaults to December 2022, the public release date of ChatGPT.</p>
        </div>

        <div class="ainb-date-field">
            <label for="ainb-end-date">Only fetch edits made before:</label>
            <input id="ainb-end-date" type="date" v-model="end_date" class="ainb-date-input" />
            <p class="ainb-date-hint">Leave blank to fetch up to the most recent edit.</p>
        </div>
    </div>

    <div v-if="error" class="ainb-error">{{ error }}</div>

    <div v-if="loading" class="ainb-loading">
        <p>Fetching contributions... {{ progress > 0 ? progress + ' found' : '' }}</p>
        <cdx-progress-bar inline></cdx-progress-bar>
    </div>
</div>
  `;

  const step2 = `
<div v-if="step === 2" class="ainb-step2">
    <div class="ainb-step2-subtitle">
        <template v-if="is_multiple_users">Multiple users</template>
        <template v-else>
            <a :href="get_user_url(normalized_username)" target="_blank">User:{{ normalized_username }}</a>
            &middot; <a :href="get_contribs_url(normalized_username)" target="_blank">(contrib)</a>
        </template>
        &middot; {{ edit_count }} edit(s) across {{ article_groups.length }} article(s)
    </div>
    <div class="ainb-step2-toolbar">
        <cdx-checkbox :model-value="all_selected" :indeterminate="some_selected && !all_selected"
            @update:model-value="toggle_all">Select all</cdx-checkbox>
        <cdx-menu-button v-model:selected="filter_menu_selected" weight="normal" :menu-items="filter_menu_items"
            :disabled="!some_selected" @update:selected="handle_filter_menu_select">Filter selected</cdx-menu-button>
        <span class="ainb-total-badge"><b>{{ total_selected }}</b> of {{ total_groups }} articles selected</span>
    </div>

    <div v-if="notes_visible" class="ainb-notes-field">
        <label for="ainb-extra-notes">Notes for tracking page (e.g., applied filters)</label>
        <textarea id="ainb-extra-notes" v-model="extra_notes" rows="3"
            placeholder="Text to be added above the tracker..."></textarea>
    </div>
    <cdx-button v-else weight="quiet" class="ainb-add-note-btn" @click="notes_visible = true">+ Add a note</cdx-button>

    <div class="ainb-step2-layout">
        <div class="ainb-article-list">
            <div class="ainb-article-list-controls">
                <cdx-text-input v-model="article_search" placeholder="Filter articles..."
                    class="ainb-article-search"></cdx-text-input>
                <div class="ainb-sort-toggle">
                    <button type="button" :class="{ active: sort_mode === 'edits' }" @click="sort_mode = 'edits'">Most
                        edits</button>
                    <button type="button" :class="{ active: sort_mode === 'alpha' }"
                        @click="sort_mode = 'alpha'">A-Z</button>
                    <button type="button" :class="{ active: sort_mode === 'recent' }"
                        @click="sort_mode = 'recent'">Recent</button>
                </div>
            </div>

            <ul class="ainb-article-items">
                <li v-for="group in filtered_sorted_groups" :key="group.title" class="ainb-article-item"
                    :class="{ 'ainb-article-item-active': group.title === selected_article_title, 'ainb-article-item-picked': group.selected_count > 0 }"
                    @click="select_article(group.title)">
                    <cdx-checkbox :model-value="group.all_selected"
                        :indeterminate="group.some_selected && !group.all_selected"
                        @update:model-value="toggle_article(group)" @click.stop></cdx-checkbox>
                    <div class="ainb-article-item-info">
                        <div class="ainb-article-item-title">{{ group.title }}</div>
                        <div class="ainb-article-item-meta">
                            <span>{{ group.edits.length }} edit(s)</span>
                            <span v-if="group.selected_count > 0" class="ainb-article-item-badge">&middot; selected {{
                                group.selected_count }}/{{ group.edits.length }}</span>
                        </div>
                    </div>
                </li>
                <li v-if="filtered_sorted_groups.length === 0" class="ainb-article-empty">No articles match "{{
                    article_search }}"</li>
            </ul>
        </div>

        <div class="ainb-revisions-panel">
            <template v-if="selected_group">
                <div class="ainb-revisions-header">
                    <div>
                        <div class="ainb-revisions-title">
                            <a :href="get_article_url(selected_group.title)" target="_blank">{{ selected_group.title
                                }}</a>
                            <a :href="get_history_url(selected_group.title)" target="_blank"
                                class="ainb-history-link">(hist)</a>
                        </div>

                        <div class="ainb-revisions-subtitle">
                            {{ selected_group.edits.length }} edit(s) by {{ get_group_users(selected_group) }}
                        </div>
                    </div>
                </div>

                <table class="ainb-revisions-table">
                    <thead>
                        <tr>
                            <th class="ainb-col-cb"></th>
                            <th class="ainb-col-actions">Diff</th>
                            <th class="ainb-col-time">Date</th>
                            <th class="ainb-col-size">Size</th>
                            <th class="ainb-col-summary">Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="edit in selected_group.edits" :key="edit.revid" class="ainb-diff-row"
                            :class="{ 'ainb-diff-row-selected': edit.selected }">
                            <td class="ainb-col-cb">
                                <cdx-checkbox v-model="edit.selected"
                                    @update:model-value="update_group_selection(selected_group)"></cdx-checkbox>
                            </td>
                            <td class="ainb-col-actions">
                                <button type="button" class="ainb-diff-toggle" @click="show_diff_popup(edit)">View
                                    diff</button>
                                <a :href="get_diff_url(edit.revid)" target="_blank" class="ainb-diff-extlink"
                                    title="Open in new tab">&#8599;</a>
                            </td>
                            <td class="ainb-col-time" :title="edit.timestamp">{{ format_date(edit.timestamp) }}</td>
                            <td :class="['ainb-col-size', get_size_class(edit.sizediff)]">{{ format_bytes(edit.sizediff)
                                }}</td>
                            <td class="ainb-col-summary" :title="edit.comment">{{ edit.comment ? truncate(edit.comment,
                                80) : 'No edit summary' }}</td>
                        </tr>
                    </tbody>
                </table>
            </template>
            <div v-else class="ainb-revisions-empty">Select an article on the left to view its revisions.</div>
        </div>
    </div>
</div>
  `;

  const diff_dialog = `
<cdx-dialog v-model:open="diff_dialog_open" :title="viewing_diff_edit ? 'Diff for ' + viewing_diff_edit.title : ''"
    :use-close-button="true" class="ainb-diff-dialog" @keyup.left="go_to_diff(-1)" @keyup.right="go_to_diff(1)">
    <div v-if="viewing_diff_edit" class="ainb-diff-dialog-body">
        <div class="ainb-diff-meta">
            <select class="ainb-diff-select" :value="viewing_diff_edit.revid"
                @change="jump_to_diff($event.target.value)" v-if="selected_group.edits.length > 1">
                <option v-for="(e, idx) in selected_group.edits" :key="e.revid" :value="e.revid">
                    {{ idx + 1 }} / {{ selected_group.edits.length }} — {{ format_date(e.timestamp) }} ({{
                    format_bytes(e.sizediff) }})
                </option>
            </select>
            <a :href="get_diff_url(viewing_diff_edit.revid)" target="_blank" class="ainb-diff-meta-link">Open in new tab
                &#8599;</a>
        </div>
        <div class="ainb-diff-meta-include">
            <cdx-checkbox v-model="viewing_diff_edit.selected"
                @update:model-value="update_group_selection(selected_group)">Include</cdx-checkbox>
        </div>
        <div class="ainb-diff-meta-comment" :title="viewing_diff_edit.comment"><span :class="['ainb-diff-meta-size', get_size_class(viewing_diff_edit.sizediff)]">{{
                format_bytes(viewing_diff_edit.sizediff) }} bytes</span> &middot; <span
                class="ainb-diff-meta-comment-label">Summary:</span> {{ viewing_diff_edit.comment || 'No edit summary'
            }}</div>

        <div v-if="viewing_diff_edit.diff_loading" class="ainb-diff-loading">Loading diff...</div>
        <div v-else-if="viewing_diff_edit.diff_content" class="ainb-diff-content"
            v-html="viewing_diff_edit.diff_content"></div>
        <div v-else class="ainb-diff-loading">No content loaded.</div>
    </div>
    <template #footer>
        <div class="ainb-dialog-footer">
            <div class="ainb-diff-nav">
                <cdx-button @click="go_to_diff(-1)" :disabled="!has_prev_diff">&larr; Prev</cdx-button>
                <cdx-button @click="go_to_diff(1)" :disabled="!has_next_diff">Next &rarr;</cdx-button>
            </div>
            <cdx-button @click="close_diff_popup">Close</cdx-button>
        </div>
    </template>
</cdx-dialog>
    `;

  const tag_dialog = `
<cdx-dialog v-model:open="tag_dialog_open" title="Unselect edits by tag" :use-close-button="true"
    class="ainb-tag-dialog">
    <p v-if="tags_in_selection.length === 0">No tags found on the selected edits.</p>
    <div v-else>
        <cdx-checkbox v-for="tag in tags_in_selection" :key="tag" v-model="selected_tags_map[tag]">
            {{ tag }} ({{ tag_counts[tag] }} edit{{ tag_counts[tag] === 1 ? '' : 's' }})
        </cdx-checkbox>
    </div>
    <template #footer>
        <div class="ainb-dialog-footer">
            <div></div>
            <div>
                <cdx-button @click="tag_dialog_open = false">Cancel</cdx-button>
                <cdx-button action="progressive" weight="primary" @click="unselect_by_tag"
                    :disabled="selected_tag_list.length === 0">
                    Unselect
                </cdx-button>
            </div>
        </div>
    </template>
</cdx-dialog>
    `;

  const step3 = `
<div v-if="step === 3" class="ainb-step">
    <div v-if="creating" class="ainb-loading">
        <p>Creating page...</p>
        <cdx-progress-bar inline></cdx-progress-bar>
    </div>

    <div v-else-if="create_error" class="ainb-error">{{ create_error }}</div>

    <div v-else>
        <p>Page created successfully!</p>
        <p><a :href="target_page_url" target="_blank">{{ target_page_title }}</a></p>
    </div>
</div>
  `;

  const footer = `
<template #footer>
    <div class="ainb-dialog-footer">
        <div v-if="step === 1"></div>

        <cdx-button v-if="step === 1" action="progressive" weight="primary" @click="fetch_contributions"
            :disabled="loading || !username">
            {{ loading ? 'Fetching...' : 'Fetch contributions' }}</cdx-button>

        <template v-if="step === 2">
            <div class="ainb-subpage-info">Target: <strong>{{ target_page_title }}</strong></div>
            <div class="ainb-footer-buttons">
                <cdx-button @click="step = 1">Back</cdx-button>
                <cdx-button @click="copy_wikitext" :disabled="total_selected_diffs === 0">Copy wikitext
                </cdx-button>
                <cdx-button action="progressive" weight="primary" @click="generate_report"
                    :disabled="total_selected_diffs === 0">Create Page
                </cdx-button>
            </div>
        </template>

        <template v-if="step === 3">
            <div></div>
            <div>
                <cdx-button @click="handle_dialog_close">Close</cdx-button>
            </div>
        </template>
    </div>
</template>
  `;

  return `
<div>
<cdx-dialog class="ainb-helper" v-model:open="is_open" 
:title="dialog_title" :use-close-button="true"
@update:open="handle_dialog_close">
  ${step1}
  ${step2}
  ${step3}
  ${footer}
</cdx-dialog>
${diff_dialog}
${tag_dialog}
</div>
  `;
}

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
            value: "tagged",
            label: "Tagged",
            aliases: ["tg", "tag"],
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
            row.is_new &&
            !row.multiple_matches &&
            row.status !== "completed" &&
            row.status !== "unnecessary",
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

function create_llm_tag_prod_app() {
  const LAST_THREAD_KEY = "ainb-llm-tag-last-thread";
  const LAST_THREAD_TTL_MS = 3 * 60 * 60 * 1000;
  const LOG_TO_USERPAGE_OPTION = "userjs-ainb-log-userpage";
  const HELP_OFF_OPTION = "userjs-ainb-help-off";
  const WATCH_PAGE_OPTION = "userjs-ainb-watch-page";
  const LOG_PAGE_SUFFIX = "LLMPROD log";
  const TRACKER_PREFIX = "Wikipedia:AI noticeboard/";

  // todo: move this and other commonly used helpers to the shared file
  const rm_underscores = (s) => s.replace(/_/g, " ");

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
        page_name: rm_underscores(mw.config.get("wgPageName")),
        logging_page: `User:${mw.config.get("wgUserName")}/${LOG_PAGE_SUFFIX}`,
        selected_option: "llm_prod",
        subpage: "",
        subpage_options: [],
        log_to_userpage: initial_log_to_userpage,
        help_off: initial_help_off,
        editable_wikitext: "",
        editable_summary: "",
        saving: false,
        step1_error: "",
        checking_page: false,
        show_preview: false,
        preview_html: "",
        preview_loading: false,
        show_advanced: false,
        watch_page: initial_watch_page,
        tracking_subpage: "",
        tracking_subpage_locked: false,
        update_tracker: true,
        save_steps: [],
        reload_seconds: null,
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
              page: page,
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
            this.step1_error = `Page does not exist: "${err}"`;
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
        this.step = 2;
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

      async infer_tracking_subpage(page, section_index) {
        try {
          const res = await api.get({
            action: "parse",
            page: page,
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

          // global so we replace status of all instances of the article
          // across all the tables
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
          return { ok: false, message: err.message || String(err) };
        }
      },

      async run_step(label, fn) {
        const step = { label, status: "pending", detail: "" };
        this.save_steps.push(step);
        try {
          await fn();
          step.status = "success";
        } catch (err) {
          step.status = "error";
          step.detail = err?.message || String(err);
        }
        return step;
      },

      async save_edit() {
        this.saving = true;
        this.save_steps = [];
        this.reload_seconds = null;

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

        this.reload_seconds = 4;
        setTimeout(() => location.reload(), 4000);
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
  });
}

function generate_llm_tag_prod_template() {
  return `
<div>
  <cdx-dialog class="ainb-llm-dialog" v-model:open="is_open" 
    title="LLM tag / prod" :use-close-button="true">
    
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
      <div v-if="!saving" class="ainb-thread-context">
        <span>Thread: <strong>{{ subpage }}</strong></span>
        <a href="#" @click.prevent="go_back_to_step1">Change</a>
      </div>

      <div v-if="!saving" class="ainb-tracker-row">
        <cdx-checkbox :model-value="update_tracker" @update:model-value="on_update_tracker_toggle" :disabled="saving || !tracking_subpage">
          Mark as {{ selected_option === 'llm_prod' ? 'ongoing' : 'tagged' }} on the tracker
        </cdx-checkbox>
        <span v-if="tracking_subpage && update_tracker" class="ainb-tracker-target">
          <strong>{{ tracking_subpage }}</strong> (<a href="#" @click.prevent="change_tracking_subpage">change</a>)
        </span>
        <div v-else-if="!tracking_subpage" class="ainb-tracker-target ainb-tracker-missing">
          Couldn't infer tracking page. <a href="#" @click.prevent="change_tracking_subpage">Set</a>
        </div>
      </div>

      <div v-if="save_steps.length" class="ainb-save-status">
        <div v-for="s in save_steps" :key="s.label"
          class="ainb-save-status-line" :class="'ainb-save-status-' + s.status">
          <span class="ainb-save-status-icon">
            <template v-if="s.status === 'pending'">&#8230;</template>
            <template v-else-if="s.status === 'success'">&#10003;</template>
            <template v-else>&#10007;</template>
          </span>
          <span>{{ s.label }}<template v-if="s.status === 'success'">... succeeded</template><template v-else-if="s.status === 'error'">... failed: {{ s.detail }}</template><template v-else>...</template></span>
        </div>
        <div v-if="reload_seconds !== null" class="ainb-save-status-line ainb-save-status-reload">
          Reloading in {{ reload_seconds }}s&#8230;
        </div>
      </div>

      <cdx-field v-if="!saving">
        <template #label>Resulting wikitext:</template>
        <cdx-text-area v-model="editable_wikitext" rows="5" :disabled="saving"></cdx-text-area>
      </cdx-field>

      <div v-if="!saving" class="ainb-preview-link-wrap">
        <a href="#" @click.prevent="toggle_preview">
          {{ show_preview ? 'Hide preview' : 'Show preview' }}
        </a>
      </div>

      <div v-if="!saving && show_preview" class="ainb-preview-box">
        <div v-if="preview_loading" class="ainb-loading">Loading preview...</div>
        <div v-else class="ainb-preview-content" v-html="preview_html"></div>
      </div>

      <cdx-field v-if="!saving">
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
            {{ reload_seconds !== null ? 'Done' : (saving ? 'Saving...' : 'Submit edit') }}
          </cdx-button>
        </div>
      </div>
    </template>
  </cdx-dialog>
</div>
    `;
}

const CATEGORY_PAGE_NAME = "Category:AI_noticeboard_open_cleanup_cases";
const CATEGORY_STATS_PAGE = "User:DVRTed bot/AINB-stats.json";

function init_category_stats_app() {
  if (mw.config.get("wgPageName") !== CATEGORY_PAGE_NAME) return;

  const $target = $("#mw-content-text").first();
  if (!$target.length) return;

  const $wrap = $(`
    <div class="ainb-category-stats ainb-progress-wrap">
      <div class="ainb-progress-top">
        <span class="ainb-progress-percent">...</span>
        <div class="ainb-progress-top-text">
          <div class="ainb-progress-title">AI noticeboard cleanup</div>
          <div class="ainb-progress-stats">Loading...</div>
        </div>
      </div>
      <div class="ainb-progress-bar"></div>
      <div class="ainb-progress-legend"></div>
      <div class="ainb-category-mini"></div>
      <div class="ainb-category-meta"><span>Last updated: </span><span>Generated by <a href="${mw.util.getUrl("User:DVRTed/AINB-helper")}">AINB-helper</a></span></div>
    </div>
  `);

  $target.prepend($wrap);

  api
    .get({
      action: "query",
      prop: "revisions",
      titles: CATEGORY_STATS_PAGE,
      rvslots: "main",
      rvprop: "timestamp|content",
      format: "json",
      formatversion: "2",
    })
    .then((result) => {
      const rev = result.query.pages[0].revisions[0];
      const {
        active_cases,
        total_todo,
        total_in_progress,
        total_completed,
        total_unnecessary,
        total_tagged = 0,
      } = JSON.parse(rev.slots.main.content);

      const total_pages = total_todo + total_in_progress + total_completed + total_unnecessary + total_tagged;
      const resolved = total_completed + total_unnecessary + total_tagged;
      const pct = Math.round((resolved / total_pages) * 100);

      $wrap.find(".ainb-category-meta span").first().text(
        `Last updated: ${new Date(rev.timestamp).toLocaleString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: "short",
        })}`
      );

      const items = [
        { key: "todo", count: total_todo },
        { key: "completed", count: total_completed },
        { key: "unnecessary", count: total_unnecessary },
        { key: "ongoing", count: total_in_progress },
        { key: "tagged", count: total_tagged },
      ].filter(({ count }) => count > 0);

      const segments = items
        .map(
          ({ key, count }) =>
            `<div class="ainb-seg ainb-seg-${key}" style="width:${(count / total_pages) * 100}%" title="${key}: ${count.toLocaleString()}"></div>`
        )
        .join("");

      const legend = items
        .map(
          ({ key, count }) =>
            `<span><i class="ainb-dot ainb-seg-${key}"></i>${key} (${count.toLocaleString()})</span>`
        )
        .join("");

      $wrap.find(".ainb-progress-bar").html(segments);
      $wrap.find(".ainb-progress-percent").text(`${pct}%`);
      $wrap.find(".ainb-progress-stats").text(
        `${resolved.toLocaleString()} / ${total_pages.toLocaleString()} resolved`
      );
      $wrap.find(".ainb-progress-legend").html(legend);

      $wrap.find(".ainb-category-mini").html(
        `There are <strong>${active_cases.toLocaleString()}</strong> active cases with <strong>${total_todo.toLocaleString()}</strong> pages marked as to-do, ` +
        `<strong>${total_in_progress.toLocaleString()}</strong> in progress, <strong>${total_tagged.toLocaleString()}</strong> tagged, <strong>${total_completed.toLocaleString()}</strong> done, ` +
        `and <strong>${total_unnecessary.toLocaleString()}</strong> unnecessary.`
      );
    })
    .catch(() => {
      $wrap.find(".ainb-progress-stats").text("Could not load AINB stats");
    });
}

init_category_stats_app();

// for nicely formatted CSS, see [[User:DVRTed/AINB-helper.css]]
mw.loader.load(
  "http://localhost:1212/AINB-helper/dist/AINB-helper.css",
  "text/css",
);
// workaround to fix flash of unstyled content on progress bar
mw.util.addCSS(`
    .ainb-progress-wrap { margin-bottom: 1em; padding: 8px 12px; border: 1px solid var(--border-color-base, #a2a9b1); border-radius: 4px; }
    .ainb-progress-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .ainb-progress-percent { font-size: 1.8em; font-weight: 700; line-height: 1; color: var(--color-base, #202122); }
    .ainb-progress-top-text { display: flex; flex-direction: column; }
    .ainb-progress-title { font-weight: 600; font-size: 0.9em; }
    .ainb-progress-stats { font-size: 0.85em; color: var(--color-subtle, #54595d); }
    .ainb-progress-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: #eaecf0; }
    .ainb-seg { height: 100%; }
    .ainb-progress-legend { display: flex; gap: 10px; margin-top: 6px; font-size: 0.8em; color: var(--color-subtle, #54595d); text-transform: capitalize; }
    .ainb-progress-legend i.ainb-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px; }
    .ainb-progress-credit { font-size: 0.75em; color: var(--color-subtle, #54595d); font-weight: normal; text-align: right; }
    .ainb-progress-hide-row { margin-top: 6px; font-size: 0.85em; }
    .ainb-hide-resolved .ainb-row-resolved { display: none; }
  `);

function init_row_editing() {
  $("table")
    .has('tr[class*="aic-row-"]')
    .each(function () {
      const $table = $(this);
      const $thead = $table.find("thead");
      $thead.find("tr").prepend('<th class="ainb-action-header">Action</th>');

      // batch edit button; populate array of { article, is_new } objects.
      const articles = $table
        .find('tr[class*="aic-row-"]')
        .map(function () {
          const $link = $(this).find("a").first();
          const title = $link.text().trim();
          if (!title) return null;
          return { article: title, is_new: $link.hasClass("new") };
        })
        .get()
        .filter(Boolean);

      if (articles.length) {
        const $button = $(
          '<button type="button" class="cdx-button cdx-button--action-progressive">',
        )
          .text("Batch edit")
          .on("click", (e) => {
            e.preventDefault();
            create_edit_table_app(articles);
          });
        $table.before($button);
      }

      // single-row edit buttons
      $table.find('tr[class*="aic-row-"]').each(function () {
        const $row = $(this);
        const $first_cell = $row.find("td").first();
        const $link = $first_cell.find("a").first();
        if (!$link.length) return;

        const $edit_td = $("<td>").addClass("ainb-action-cell");
        $first_cell.before($edit_td);

        const $edit_button = $("<button>")
          .addClass("ainb-edit-btn")
          .text("✎")
          .attr("title", "Edit this row")
          .on("click", (e) => {
            e.preventDefault();
            create_edit_table_app({
              article: $link.text().trim(),
              is_new: $link.hasClass("new"),
            });
          });

        $edit_td.append($edit_button);
      });
    });
}

function get_row_status($row) {
  const match = $row.attr("class")?.match(/\baic-row-(\S+)/);
  return match ? match[1] : "unknown";
}

function init_progress_bar() {
  const STATUS_KEYS = [
    "completed",
    "unnecessary",
    "ongoing",
    "tagged",
    "todo",
    "unknown",
  ];

  $("table")
    .has('tr[class*="aic-row-"]')
    .each(function () {
      const $table = $(this);
      const stats = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));

      const $rows = $table.find('tr[class*="aic-row-"]');

      $rows.each(function () {
        const status = get_row_status($(this));
        const key = status in stats ? status : "unknown";
        stats[key]++;
        if (key === "completed" || key === "unnecessary" || key === "tagged") {
          $(this).addClass("ainb-row-resolved");
        }
      });

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      if (!total) return;

      const resolved = stats.completed + stats.unnecessary + stats.tagged;
      const percent = Math.round((resolved / total) * 100);
      const active = STATUS_KEYS.filter((key) => stats[key] > 0);

      const segments = active
        .map(
          (key) =>
            `<div class="ainb-seg ainb-seg-${key}" style="width:${(stats[key] / total) * 100}%" title="${stats[key]} ${key}"></div>`,
        )
        .join("");

      const legend = active
        .map(
          (key) =>
            `<span><i class="ainb-dot ainb-seg-${key}"></i>${key} (${stats[key]})</span>`,
        )
        .join("");

      const $bar = $(`
      <div class="ainb-progress-wrap">
        <div class="ainb-progress-top">
          <span class="ainb-progress-percent">${percent}%</span>
          <div class="ainb-progress-top-text">
            <div class="ainb-progress-title">Progress</div>
            <div class="ainb-progress-stats">${resolved} / ${total} resolved</div>
          </div>
        </div>
        <div class="ainb-progress-bar">${segments}</div>
        <div class="ainb-progress-legend">${legend}</div>
        <div class="ainb-progress-credit">Generated by <a href="${mw.util.getUrl("User:DVRTed/AINB-helper")}">AINB-helper</a></div>
        <div class="ainb-progress-hide-row">
          <label><input type="checkbox" class="ainb-hide-resolved-cb"> Hide resolved entries</label>
        </div>
      </div>
    `);

      $bar.find(".ainb-hide-resolved-cb").on("change", function () {
        $table.toggleClass("ainb-hide-resolved", $(this).is(":checked"));
      });

      $table.before($bar);
    });
}

const portlet_link = mw.util.addPortletLink(
  "p-tb",
  "#",
  "New AINB tracking",
  "t-ainb-tracking",
  "Generate tracking subpage for AINB",
);

$(portlet_link).on("click", function (e) {
  e.preventDefault();
  create_main_app();
});

const wgPageName = mw.config.get("wgPageName");

// if we're on an AINB tracking subpage, or the debug page,
// enable editing rows
if (
  wgPageName.startsWith("Wikipedia:AI_noticeboard/") ||
  wgPageName === DEBUG_PAGE
) {
  init_progress_bar();
  init_row_editing();
}

if ([0, 118].includes(mw.config.get("wgNamespaceNumber")) || DEBUG_MODE) {
  const llm_portlet_link = mw.util.addPortletLink(
    "p-cactions",
    "#",
    "LLM tag/prod",
    "t-llm-tag-prod",
    "LLM tag/prod helper",
  );

  $(llm_portlet_link).on("click", function (e) {
    e.preventDefault();
    create_llm_tag_prod_app();
  });
}

});
// </nowiki>