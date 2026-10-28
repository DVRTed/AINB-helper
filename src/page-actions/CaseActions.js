import {
  create_app,
  get_case_page_name,
  get_case_username,
} from "../shared.js";
import EditBanner from "../apps/edit-banner.vue";
import Main from "../apps/main-app.vue";
import NewCaseApp from "../apps/new-case-app.vue";
import Table_indexer from "../apps/components/table_indexer.vue";
import Menu_selector from "../apps/components/menu_selector.vue";

const wgPageName = mw.config.get("wgPageName");

export function init_banner_edit() {
  if ($(".ainb-page-actions").length) return;
  const $banner = $(".ainb-b-top").first();
  const $case_button = $(
    '<button type="button" class="cdx-button cdx-button--action-progressive">',
  )
    .text("Edit case banner")
    .on("click", (e) => {
      e.preventDefault();
      create_app(EditBanner);
    });

  const initial_case_page = get_case_page_name(wgPageName);
  const handle_case_action = async (action) => {
    if (action === "tracking") {
      const initial_username = await get_case_username(null, true);
      if (!initial_username) return;

      const initial_is_custom_case_page =
        initial_case_page !== initial_username;

      create_app(Main, {
        initial_username,
        initial_is_custom_case_page,
        initial_case_page,
      });
    } else if (action === "discussion") {
      create_app(NewCaseApp, { initial_case_name: initial_case_page });
    } else if (action === "reindex") {
      create_app(Table_indexer);
    }
  };

  const menu_mount = document.createElement("div");
  create_app(Menu_selector, {
    label: "Manage case",
    items: [
      { value: "tracking", label: "Add tracking table" },
      { value: "discussion", label: "Add discussion subsection" },
      { value: "reindex", label: "Reindex tables" },
    ],
    onSelect: handle_case_action,
    mount_target: menu_mount,
  });

  const $actions = $('<div class="ainb-page-actions">').append(
    $case_button,
    menu_mount,
  );
  if ($banner.length) $banner.after($actions);
}
