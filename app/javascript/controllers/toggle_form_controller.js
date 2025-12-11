import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "form"]

  show(event) {
    event.preventDefault()
    this.displayTarget.classList.add("d-none")
    this.formTarget.classList.remove("d-none")
    this.focusFirstInput()
  }

  hide(event) {
    event.preventDefault()
    this.formTarget.classList.add("d-none")
    this.displayTarget.classList.remove("d-none")
  }

  focusFirstInput() {
    const input = this.formTarget.querySelector("input, textarea, select")
    if (input) input.focus()
  }
}
