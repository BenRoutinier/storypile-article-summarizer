// Import and register all your controllers from the importmap via controllers/**/*_controller
import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
eagerLoadControllersFrom("controllers", application)
import ScrollController from "controllers/scroll_controller"
application.register("scroll", ScrollController)
import SubmitOnEnterController from "controllers/submit_on_enter_controller"
application.register("submit-on-enter", SubmitOnEnterController)
import ToggleFormController from "controllers/toggle_form_controller"
application.register("toggle-form", ToggleFormController)
import MobileDropdownController from "controllers/mobile_dropdown_controller"
application.register("mobile-dropdown", MobileDropdownController)
import SpeechReaderController from "controllers/speech_reader_controller"
application.register("speech-reader", SpeechReaderController)
import SyncController from "controllers/sync_controller"
application.register("sync", SyncController)
import OfflineIndicatorController from "controllers/offline_indicator_controller"
application.register("offline-indicator", OfflineIndicatorController)
