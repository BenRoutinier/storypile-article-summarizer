// Import and register all your controllers from the importmap via controllers/**/*_controller
import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
eagerLoadControllersFrom("controllers", application)
import ScrollController from "./scroll_controller.js"
application.register("scroll", ScrollController)
import SubmitOnEnterController from "./submit_on_enter_controller.js"
application.register("submit-on-enter", SubmitOnEnterController)
