import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "form"]

  toggle() {
    this.displayTarget.classList.toggle("d-none")
    this.formTarget.classList.toggle("d-none")
    if (!this.formTarget.classList.contains("d-none")) {
      this.focusFirstInput();
    }
  }

  focusFirstInput() {
    const input = this.formTarget.querySelector("input, textarea, select")
    if (input) input.focus()
  }
}
