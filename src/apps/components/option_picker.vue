<script>
import { CdxDialog, CdxMenu } from "@wikimedia/codex";

export default {
  components: { CdxDialog, CdxMenu },
  props: {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    //               [{ value, label, description? }]
    options: { type: Array, required: true },
  },
  emits: ["select", "cancel"],
  data() {
    return {
      open: true,
      selected: null,
      menu_style: {
        position: "static",
        boxShadow: "none",
      },
      wrapper_style: { outline: "none" },
    };
  },
  methods: {
    on_select(value) {
      this.open = false;
      this.$emit(
        "select",
        this.options.find((option) => option.value === value),
      );
    },
    cancel() {
      this.open = false;
      this.$emit("cancel");
    },
    handle_open_update(open) {
      if (!open) this.cancel();
    },
    on_keydown(e) {
      // forward keys to menu
      this.$refs.menu?.delegateKeyNavigation(e);
    },
  },
};
</script>

<template>
  <cdx-dialog
    :open="open"
    :title="title"
    use-close-button
    close-button-label="Cancel"
    :style="{ maxWidth: '40rem' }"
    @update:open="handle_open_update"
  >
    <p v-if="description">{{ description }}</p>
    <div tabindex="0" :style="wrapper_style" @keydown="on_keydown">
      <cdx-menu
        ref="menu"
        v-model:selected="selected"
        :expanded="true"
        :menu-items="options"
        :style="menu_style"
        @update:selected="on_select"
      />
    </div>
  </cdx-dialog>
</template>
