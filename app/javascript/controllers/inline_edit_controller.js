import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "edit"]

  toggle() {
    this.displayTarget.classList.toggle("d-none")
    this.editTarget.classList.toggle("d-none")
  }
}
