import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    const dropdownToggle = this.element.querySelector('[data-bs-toggle="dropdown"]')
    if (dropdownToggle) {
      dropdownToggle.addEventListener('shown.bs.dropdown', this.positionDropdown.bind(this))
    }
  }

  positionDropdown(event) {
    const dropdown = this.element.querySelector('.mobile-nav-dropdown')
    if (dropdown) {
      const navbar = document.querySelector('.navbar-lewagon.d-md-none')
      if (navbar) {
        const navbarRect = navbar.getBoundingClientRect()
        const navbarBottom = navbarRect.bottom

        // Position dropdown directly below navbar, full width, no gap
        dropdown.style.position = 'fixed'
        dropdown.style.top = `${navbarBottom}px`
        dropdown.style.left = '0'
        dropdown.style.right = '0'
        dropdown.style.width = '100vw'
        dropdown.style.transform = 'none'
        dropdown.style.marginTop = '0'
        dropdown.style.marginBottom = '0'
      }
    }
  }
}
