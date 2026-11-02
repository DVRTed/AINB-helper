<script>
import {
  CdxButton,
  CdxTextInput,
  CdxToast,
  CdxToastContainer,
} from "@wikimedia/codex";
import { rm_underscores, wgPageName } from "../../shared";

export default {
  name: "EditSummaries",

  components: {
    CdxButton,
    CdxTextInput,
    CdxToast,
    CdxToastContainer,
  },

  data() {
    return {
      summaries: [
        {
          label: "Copy revert summary",
          text: `Restore earlier version per [[WP:LLMPRV]], see [[${rm_underscores(wgPageName)}]]`,
        },
        {
          label: "Copy removal summary",
          text: `[[WP:LLMPRV|Presumptive removal of LLM-generated content]], see [[${rm_underscores(wgPageName)}]]`,
        },
      ],
      copied: null,
      show_toast: false,
    };
  },

  methods: {
    async copy(index, text) {
      try {
        await navigator.clipboard.writeText(text);
        this.copied = index;
        this.show_toast = false;
        this.$nextTick(() => {
          this.show_toast = true;
        });
        setTimeout(() => {
          this.copied = null;
        }, 2000);
      } catch {
        prompt("Copy this edit summary:", text);
      }
    },
  },
};
</script>

<template>
  <div>
    <details>
      <summary>Edit summaries</summary>
      <div class="ainb-cleanup-summaries-body">
        <div v-for="(s, i) in summaries" :key="i">
          <cdx-button
            weight="quiet"
            aria-label="Copy edit summary"
            @click="copy(i, s.text)"
          >
            <svg
              v-if="copied === i"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7.7 15.3 2.7 10.3l1.4-1.4 3.6 3.6 8.6-8.6 1.4 1.4z" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M5 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5zm0 2h8v10H5V4zm-3 3a1 1 0 0 1 1-1h1v12h9v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7z"
              />
            </svg>
          </cdx-button>
          <cdx-text-input :model-value="s.text" readonly />
        </div>
      </div>
    </details>
    <cdx-toast-container />
    <cdx-toast
      v-if="show_toast"
      type="success"
      :auto-dismiss="3000"
      @user-dismissed="show_toast = false"
      @auto-dismissed="show_toast = false"
    >
      Copied edit summary to clipboard.
    </cdx-toast>
  </div>
</template>

<style>
.ainb-cleanup-summaries {
  margin-bottom: 0.6em;
}

.ainb-cleanup-summaries details {
  border: 1px solid var(--ainb-border-color-subtle);
  border-radius: 4px;
  background-color: var(--ainb-background-color-base);
}

.ainb-cleanup-summaries summary {
  cursor: pointer;
  user-select: none;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 0.9em;
  color: var(--ainb-color-base);
  background-color: var(--ainb-background-color-interactive-subtle);
  border-radius: 3px;
  list-style-position: inside;
}

.ainb-cleanup-summaries summary:hover {
  background-color: var(--ainb-background-color-neutral);
  color: var(--ainb-color-progressive);
}

.ainb-cleanup-summaries details[open] summary {
  border-bottom: 1px solid var(--ainb-border-color-subtle);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.ainb-cleanup-summaries-body {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.ainb-cleanup-summaries-body > div {
  display: flex;
  align-items: center;
  gap: 0.4em;
}

.ainb-cleanup-summaries-body .cdx-text-input {
  flex: 1;
}
</style>
