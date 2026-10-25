<template>
  <cdx-dialog
    v-model:open="open"
    :title="`Highlighting content authored by User:${selected_username}`"
    :subtitle="status"
    close-button-label="Close"
    style="max-width: none"
  >
    <div v-if="loading || status_error" class="ainb-loading">
      {{ status }}
    </div>
    <div
      v-else
      style="white-space: pre-wrap; font-family: monospace; font-size: 0.8em"
    >
      <template v-for="(seg, i) in segments" :key="i">
        <mark v-if="seg.mine" style="background: #ffe066">{{ seg.text }}</mark>
        <template v-else>{{ seg.text }}</template>
      </template>
    </div>
    <template #footer>
      <cdx-button
        action="destructive"
        :disabled="!has_highlighted_text"
        @click="open_edit"
      >
        Remove all content authored by this user
      </cdx-button>
    </template>
  </cdx-dialog>
</template>

<script>
import { CdxButton, CdxDialog } from "@wikimedia/codex";
import { api, get_case_origin } from "../shared.js";

const WIKIWHO =
  "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";
const EDIT_TEXT_KEY = "ainb-author-highlight-edit-text";

export default {
  components: { CdxButton, CdxDialog },
  props: {
    article: { type: String, required: true },
    username: { type: String, required: true },
  },
  data() {
    return {
      open: false,
      loading: false,
      status: "",
      status_error: false,
      segments: [],
      selected_username: "",
      loaded_username: "",
    };
  },
  computed: {
    has_highlighted_text() {
      return this.segments.some((segment) => segment.mine && segment.text);
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
      window.location.assign(mw.util.getUrl(this.article, { action: "edit" }));
    },

    async show(username) {
      this.selected_username = username;
      this.open = true;
      this.status_error = false;
      if (this.loaded_username !== username) {
        this.segments = [];
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
    },

    async load() {
      // user id
      const u = await api.get({
        action: "query",
        list: "users",
        ususers: this.selected_username,
        formatversion: 2,
      });
      const userid = String(u.query.users[0]?.userid || "");
      if (!userid) throw new Error("user not found");

      // WikiWho tokens for the latest revision
      const q = new URLSearchParams({ editor: true, str: true });
      const res = await fetch(
        `${WIKIWHO}${encodeURIComponent(this.article)}/?${q}`,
      );
      const data = await res.json();
      if (!data.success) throw new Error("WikiWho API error");
      const [revid, rev] = Object.entries(data.revisions[0])[0];

      const r = await api.get({
        action: "query",
        prop: "revisions",
        revids: revid,
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
      let mine = 0;
      for (const t of rev.tokens) {
        const idx = lower.indexOf(t.str.toLowerCase(), pos);
        if (idx === -1 || idx - pos > 300) continue; // can't place token
        const isMine = t.editor === userid;
        const gap = text.slice(pos, idx);
        const last = segs[segs.length - 1];
        add(gap, isMine && !gap.trim() && !!last?.mine);
        add(text.slice(idx, idx + t.str.length), isMine);
        pos = idx + t.str.length;
        if (isMine) mine++;
      }
      add(text.slice(pos), false);

      const total = rev.tokens.length;
      this.segments = segs;
      this.status = `${((mine / total) * 100).toFixed(
        1,
      )}% (${mine}/${total} tokens)`;
    },
  },
};
</script>
