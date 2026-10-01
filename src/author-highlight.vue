<template>
  <cdx-card style="margin-bottom: 1em">
    <template #title
      ><a :href="script_url" target="_blank">AINB-helper</a></template
    >
    <template #description>
      <div style="margin: 0.5em 0">
        Highlight content authored by <b>User:{{ username }}</b> (using WikiWho
        API)
      </div>
      <div if="status" style="margin: 0.5em 0; font-size: 0.9em">
        {{ status }}
      </div>
      <cdx-button action="progressive" :disabled="loading" @click="show">
        Show highlighted wikitext
      </cdx-button>
    </template>
    <template #supporting-text
      >This feature is in beta; please report if you encounter any
      issues.</template
    >
  </cdx-card>

  <cdx-dialog
    v-model:open="open"
    :title="`Highlighting content authored by User:${username}`"
    :subtitle="status"
    close-button-label="Close"
    style="max-width: none"
  >
    <div
      style="white-space: pre-wrap; font-family: monospace; font-size: 0.8em"
    >
      <template v-for="(seg, i) in segments" :key="i">
        <mark v-if="seg.mine" style="background: #ffe066">{{ seg.text }}</mark>
        <template v-else>{{ seg.text }}</template>
      </template>
    </div>
  </cdx-dialog>
</template>

<script>
import { CdxButton, CdxCard, CdxDialog } from "@wikimedia/codex";
import { api, script_url } from "./shared.js";

const WIKIWHO =
  "https://wikiwho.wmcloud.org/en/api/v1.0.0-beta/latest_rev_content/";

export default {
  components: { CdxButton, CdxCard, CdxDialog },
  props: {
    article: { type: String, required: true },
    username: { type: String, required: true },
  },
  data() {
    return { open: false, loading: false, status: "", segments: [] };
  },
  methods: {
    async show() {
      if (!this.segments.length) {
        this.loading = true;
        this.status = "loading...";
        try {
          await this.load();
        } catch (err) {
          this.status = err.message || "lookup failed";
          return;
        } finally {
          this.loading = false;
        }
      }
      this.open = true;
    },

    async load() {
      // user id
      const u = await api.get({
        action: "query",
        list: "users",
        ususers: this.username,
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
