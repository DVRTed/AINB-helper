import { create_app, get_case_username } from "../shared.js";
import EditBanner from "../edit-banner.vue";
import Main from "../main.vue";

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

  const $tracking_button = $('<button type="button" class="cdx-button">')
    .text("Add tracking table")
    .on("click", (e) => {
      e.preventDefault();
      create_app(Main, {
        initial_username: get_case_username(wgPageName),
      });
    });

  const $actions = $('<div class="ainb-page-actions">').append(
    $case_button,
    $tracking_button,
  );
  if ($banner.length) $banner.after($actions);
}
