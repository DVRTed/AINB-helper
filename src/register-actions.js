import { init_banner_edit } from "./page-actions/CaseActions.js";
import {
  init_infocard_updates,
  init_progress_bar,
  init_row_editing,
} from "./page-actions/TableActions.js";
import { init_check_affected } from "./page-actions/WikiWhoActions.js";

// "register" all the page-(actions|features) scripts here
export function add_page_buttons() {
  init_progress_bar();
  init_row_editing();
  init_check_affected();
  init_banner_edit();
  init_infocard_updates();
}
