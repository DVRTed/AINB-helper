<script>
import { CdxMenuButton } from "@wikimedia/codex";

export default {
  components: { CdxMenuButton },
  props: {
    label: { type: String, required: true },
    items: { type: Array, required: true },
  },
  emits: ["select"],

  data() {
    return { selected: null };
  },

  methods: {
    select_item(value) {
      this.selected = null;
      this.$emit("select", value);
    },
  },
};
</script>

<template>
  <cdx-menu-button
    v-model:selected="selected"
    weight="normal"
    :menu-items="items"
    @update:selected="select_item"
  >
    {{ label }}
  </cdx-menu-button>
</template>
