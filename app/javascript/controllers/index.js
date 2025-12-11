// Import and register all your controllers from the importmap via controllers/**/*_controller
import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
eagerLoadControllersFrom("controllers", application)
import ScrollController from "controllers/scroll_controller"
application.register("scroll", ScrollController)
import SubmitOnEnterController from "controllers/submit_on_enter_controller"
application.register("submit-on-enter", SubmitOnEnterController)
import InlineEditController from "./inline_edit_controller"
application.register("inline-edit", InlineEditController)
import ToggleFormController from "controllers/toggle_form_controller"
application.register("toggle-form", ToggleFormController)