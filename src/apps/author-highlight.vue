<script>
import { CdxButton, CdxDialog, CdxMessage } from "@wikimedia/codex";
import { api, get_case_origin } from "../shared.js";
import { get_authorship_data } from "../page-actions/WikiWhoActions.js";
import ConfirmDialog from "./components/confirm_dialog.vue";

const EDIT_TEXT_KEY = "ainb-author-highlight-edit-text";

export default {
  components: { CdxButton, CdxDialog, ConfirmDialog, CdxMessage },
  props: {
    article: { type: String, required: true },
    username: { type: String, required: true },
  },
  data() {
    return {
      open: false,
      confirm_open: false,
      loading: false,
      status: "",
      status_error: false,
      segments: [],
      user_tokens_size: 0,
      selected_username: "",
      loaded_username: "",
      current_region: 0,
    };
  },
  computed: {
    has_highlighted_text() {
      return this.segments.some((segment) => segment.mine && segment.text);
    },

    // marked segments less than 200 chars apart count as one region.
    regions() {
      const regions = [];
      let current = null;
      let gap = 0;
      this.segments.forEach((seg, i) => {
        if (seg.mine) {
          if (current && gap < 200) current.end = i;
          else regions.push((current = { start: i, end: i }));
          gap = 0;
        } else {
          gap += seg.text.length;
        }
      });
      return regions;
    },
  },

  mounted() {
    this.show(this.username);
  },

  methods: {
    open_edit() {
      const updated_wikitext = this.segments
        .filter((segment) => !segment.mine)
        .map((segment) => segment.text)
        .join("");
      const case_name = get_case_origin(this.article);
      const summary = `[[WP:LLMPRV|Presumptive removal of LLM-generated content]]${
        case_name ? `, see [[${case_name}]]` : ""
      }`;

      sessionStorage.setItem(
        EDIT_TEXT_KEY,
        JSON.stringify({
          title: this.article,
          text: updated_wikitext,
          username: this.selected_username,
          summary,
        }),
      );
      window.open(mw.util.getUrl(this.article, { action: "edit" }), "_blank");
      this.confirm_open = false;
    },

    async show(username) {
      this.selected_username = username;
      this.open = true;
      this.status_error = false;
      if (this.loaded_username !== username) {
        this.segments = [];
        this.current_region = 0;
        this.loading = true;
        this.status = "loading...";
        try {
          await this.load();
          this.loaded_username = username;
        } catch (err) {
          this.status = err.message || "lookup failed";
          this.status_error = true;
        } finally {
          this.loading = false;
        }
      }
      if (!this.status_error) this.go_to_region(this.current_region);
    },

    go_to_region(index) {
      const n = this.regions.length;
      if (!n) return;
      this.current_region = ((index % n) + n) % n; // wraps around
      this.$nextTick(() => {
        const start = this.regions[this.current_region].start;
        this.$refs.content
          ?.querySelector(`mark[data-seg="${start}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      });
    },

    async load() {
      const data = await get_authorship_data(
        this.article,
        this.selected_username,
      );
      if (data.error) throw new Error(data.error);

      const r = await api.get({
        action: "query",
        prop: "revisions",
        revids: data.rev_id,
        rvprop: "content",
        rvslots: "main",
        formatversion: 2,
      });
      const text = r.query.pages[0].revisions[0].slots.main.content;

      // asked a clanker for help here
      const lower = text.toLowerCase();
      const segs = [];
      const add = (t, mine) => {
        const last = segs[segs.length - 1];
        if (last && last.mine === mine) last.text += t;
        else if (t) segs.push({ text: t, mine });
      };
      let pos = 0;
      for (const t of data.total_tokens) {
        const idx = lower.indexOf(t.str.toLowerCase(), pos);
        if (idx === -1 || idx - pos > 300) continue; // can't place token
        const isMine = t.editor === data.userid;
        const gap = text.slice(pos, idx);
        const last = segs[segs.length - 1];
        add(gap, isMine && !gap.trim() && !!last?.mine);
        add(text.slice(idx, idx + t.str.length), isMine);
        pos = idx + t.str.length;
      }
      add(text.slice(pos), false);

      this.segments = segs;
      this.status = `${data.user_chars_percentage}% (${data.user_chars_size}/${data.total_chars_size} characters) · ${data.user_tokens_size}/${data.total_tokens_size} tokens`;
      this.user_tokens_size = data.user_tokens_size;
    },
  },
};
</script>

<template>
  <div>
    <cdx-dialog
      v-model:open="open"
      :title="article"
      :subtitle="`Highlighting content authored by User:${selected_username} · ${status}`"
      close-button-label="Close"
      style="max-width: none"
    >
      <div v-if="loading || status_error" class="ainb-loading">
        {{ status }}
      </div>
      <div v-else-if="!user_tokens_size">
        <cdx-message type="success">
          No content authored by User:{{ selected_username }} was found in the
          current revision.
        </cdx-message>
      </div>
      <div v-else-if="!has_highlighted_text">
        <cdx-message type="warning">
          WikiWho attributes {{ user_tokens_size }} tokens to User:{{
            selected_username
          }}, but they could not be highlighted.
        </cdx-message>
      </div>
      <div
        v-else
        ref="content"
        style="white-space: pre-wrap; font-family: monospace; font-size: 0.8em"
      >
        <template v-for="(seg, i) in segments">
          <mark
            v-if="seg.mine"
            :key="i"
            :data-seg="i"
            style="background: #ffe066"
          >{{ seg.text }}</mark>
          <span v-else :key="'else' + i">{{ seg.text }}</span>
        </template>
      </div>
      <template #footer>
        <div class="ainb-footer">
          <div class="ainb-nav">
            <template v-if="regions.length">
              <cdx-button
                aria-label="Previous highlighted region"
                @click="go_to_region(current_region - 1)"
              >
                ◀
              </cdx-button>
              <span>{{ current_region + 1 }} / {{ regions.length }} regions</span>
              <cdx-button
                aria-label="Next highlighted region"
                @click="go_to_region(current_region + 1)"
              >
                ▶
              </cdx-button>
            </template>
          </div>
          <cdx-button
            action="destructive"
            :disabled="!has_highlighted_text"
            @click="confirm_open = true"
          >
            Remove all content authored by this user
          </cdx-button>
        </div>
      </template>
    </cdx-dialog>

    <ConfirmDialog
      v-model:open="confirm_open"
      title="Are you sure you want to remove this content?"
      @confirm="open_edit"
    >
      <!-- another hack to avoid cdx styling first child -->
      <div></div>
      <cdx-message type="error">
        Blanket removal of a user's content is almost never appropriate because
        it is likely to break sentences and template syntax.
      </cdx-message>

      <p>
        Where possible, you should instead try
        <strong>reverting to an older revision</strong> of the article from
        before the user's edits. Ideally, you'd then re-apply any worthwhile
        edits made in between.
      </p>
      <p>Do you still want to continue to the edit page?</p>
    </ConfirmDialog>
  </div>
</template>

<style>
.ainb-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.ainb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ainb-nav span {
  min-width: 8em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
