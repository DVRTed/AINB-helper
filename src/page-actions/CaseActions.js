import {
  create_app,
  get_case_page_name,
  get_case_username,
} from "../shared.js";
import EditBanner from "../apps/edit-banner.vue";
import Main from "../apps/main-app.vue";
import NewCaseApp from "../apps/new-case-app.vue";

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
  const $tracking_button = $('<button type="button" class="cdx-button">')
    .text("Add tracking table")
    .on("click", async (e) => {
      e.preventDefault();
      const initial_username = await get_case_username();
      if (!initial_username) return;

      const initial_is_custom_case_page =
        initial_case_page !== initial_username;

      create_app(Main, {
        initial_username,
        initial_is_custom_case_page,
        initial_case_page,
      });
    });

  const $discussion_button = $('<button type="button" class="cdx-button">')
    .text("Add discussion subsection")
    .on("click", (e) => {
      e.preventDefault();
      create_app(NewCaseApp, { initial_case_name: initial_case_page });
    });

  const $actions = $('<div class="ainb-page-actions">').append(
    $case_button,
    $tracking_button,
    $discussion_button,
  );
  if ($banner.length) $banner.after($actions);
}
