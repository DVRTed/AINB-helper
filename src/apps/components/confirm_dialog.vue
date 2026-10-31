<script>
import { CdxDialog } from "@wikimedia/codex";

export default {
  name: "ConfirmDialog",
  components: { CdxDialog },
  props: {
    open: Boolean,
    title: { type: String, required: true },
  },
  emits: ["update:open", "confirm"],
  methods: {
    confirm() {
      this.$emit("update:open", false);
      this.$emit("confirm");
    },
  },
};
</script>

<template>
  <cdx-dialog
    :open="open"
    :title="title"
    close-button-label="Close"
    :primary-action="{ label: 'Proceed', actionType: 'destructive' }"
    :default-action="{ label: 'Cancel' }"
    @update:open="$emit('update:open', $event)"
    @primary="confirm"
    @default="$emit('update:open', false)"
  >
    <slot></slot>
  </cdx-dialog>
</template>
