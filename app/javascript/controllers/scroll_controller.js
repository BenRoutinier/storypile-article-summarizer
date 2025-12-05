import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.scrollToBottom()

    document.addEventListener("turbo:submit-end", () => {
      setTimeout(() => this.scrollToBottom(), 30)
    })

    document.addEventListener("turbo:after-stream-render", () => {
      setTimeout(() => this.scrollToBottom(), 30)
    })
  }

  scrollToBottom() {
    this.element.scrollTop = this.element.scrollHeight
  }
}
