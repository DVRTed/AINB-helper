function create_main_app() {
  const { nextTick } = Vue;
  const {
    CdxButton,
    CdxTextInput,
    CdxDialog,
    CdxCheckbox,
    CdxProgressBar,
    CdxMenuButton,
  } = require("@wikimedia/codex");

  create_app({
    template: generate_main_template(),
    components: {
      CdxButton,
      CdxTextInput,
      CdxDialog,
      CdxCheckbox,
      CdxProgressBar,
      CdxMenuButton,
    },

    data() {
      return {
        is_open: true,
        step: 1,
        username: "",
        normalized_username: "",
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
        if (this.step === 1) return "Generate tracking subpage for AINB";
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
    },
    methods: {
      handle_dialog_close() {
        close_app();
      },

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

        try {
          const edits = [];
          let continuation = null;

          // check for users w/ too many edits
          const user_info = await api.get({
            action: "query",
            list: "users",
            ususers: this.username,
            usprop: "editcount",
          });
          const edit_count = user_info.query.users[0].editcount;

          if (edit_count > 20000) {
            if (
              !confirm(
                `User has over 20k edits (${edit_count}). Are you sure you want to continue?`,
              )
            ) {
              this.error = "Manually cancelled: User has too many edits.";
              return;
            }
          } else if (!edit_count) {
            this.error =
              "No edits found in the timeframe. Note: the username is case-sensitive.";
            return;
          }

          this.normalized_username = user_info.query.users[0].name;

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
              ucuser: this.normalized_username,
              ...(ucend_timestamp ? { ucend: ucend_timestamp } : {}),
              ...(ucstart_timestamp ? { ucstart: ucstart_timestamp } : {}),
              uclimit: "max",
              ucprop: "ids|title|timestamp|comment|sizediff|tags|flags",
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
        const edit = this.selected_group.edits.find(
          (e) => String(e.revid) === String(revid),
        );
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

        let wikitext = `{{NOINDEX|visible=yes}}\nRelevant report and discussion may be viewable on the talk page.\n\n`;

        wikitext += `== Tracking list ==\n`;
        if (this.extra_notes.trim()) {
          wikitext += `{{Notice |heading=Notes |\n${this.extra_notes.trim()}\n}}\n\n`;
        }
        wikitext += `{{AIC article list|\n`;

        selected_groups.forEach((group) => {
          const links = group.edits
            .map((edit) => {
              const edit_size = this.format_bytes(edit.sizediff);
              const edit_link = `[[Special:Diff/${edit.revid}|(${edit_size})]]`;

              const creation_note =
                edit.new !== undefined ? " (page created)" : "";

              return `${edit_link}${creation_note}`;
            })
            .join(" ");
          const edit_count = group.edits.length;
          const edit_str = edit_count > 1 ? "edits" : "edit";
          wikitext += `{{AIC article row|article=${group.title}|status=requested|notes=${edit_count} ${edit_str}: ${links}}}\n`;
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
        <a :href="get_user_url(normalized_username)" target="_blank">User:{{ normalized_username }}</a>
        &middot; <a :href="get_contribs_url(normalized_username)" target="_blank">(contrib)</a>
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
                            {{ selected_group.edits.length }} edit(s) by {{normalized_username}}
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
                @change="jump_to_diff($event.target.value)">
                <option v-for="(e, idx) in selected_group.edits" :key="e.revid" :value="e.revid">
                    {{ idx + 1 }} / {{ selected_group.edits.length }} — {{ format_date(e.timestamp) }} ({{
                    format_bytes(e.sizediff) }})
                </option>
            </select>
            <span :class="['ainb-diff-meta-size', get_size_class(viewing_diff_edit.sizediff)]">{{
                format_bytes(viewing_diff_edit.sizediff) }}</span>
            <a :href="get_diff_url(viewing_diff_edit.revid)" target="_blank" class="ainb-diff-meta-link">Open in new tab
                &#8599;</a>
        </div>
        <div class="ainb-diff-meta-include">
            <cdx-checkbox v-model="viewing_diff_edit.selected"
                @update:model-value="update_group_selection(selected_group)">Include</cdx-checkbox>
        </div>
        <div class="ainb-diff-meta-comment" :title="viewing_diff_edit.comment"><span
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
