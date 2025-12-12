import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["progressBar", "text", "rate", "rateLabel", "playPauseIcon", "voiceSelect"]

  connect() {
    this.text = this.textTarget.textContent.trim()
    this.chunks = this.splitIntoChunks(this.text)
    this.index = 0
    this.rate = 1.0
    this.isPaused = false
    this.isPlaying = false
    this.voice = null
    this.lang = 'en-US' // Explicit language setting

    this.loadVoices()
  }

  loadVoices() {
    const populateVoices = () => {
      const voices = speechSynthesis.getVoices()

      if (this.hasVoiceSelectTarget && voices.length > 0) {
        // Filter to show English voices first, then others
        const englishVoices = voices.filter(v => v.lang.startsWith('en'))
        const otherVoices = voices.filter(v => !v.lang.startsWith('en'))
        const sortedVoices = [...englishVoices, ...otherVoices]

        this.voiceSelectTarget.innerHTML = sortedVoices
          .map((voice) => {
            const originalIndex = voices.indexOf(voice)
            return `<option value="${originalIndex}">${voice.name} (${voice.lang})</option>`
          })
          .join('')

        // Auto-select first English voice if available
        if (englishVoices.length > 0) {
          const firstEnglishIndex = voices.indexOf(englishVoices[0])
          this.voiceSelectTarget.value = firstEnglishIndex
          this.voice = englishVoices[0]
          this.lang = this.voice.lang
        }
      }
    }

    if (speechSynthesis.getVoices().length > 0) {
      populateVoices()
    }
    speechSynthesis.onvoiceschanged = populateVoices
  }

  changeVoice() {
    const voices = speechSynthesis.getVoices()
    const index = parseInt(this.voiceSelectTarget.value)
    this.voice = voices[index]
    this.lang = this.voice.lang
    console.log("Voice changed to:", this.voice.name, this.voice.lang)

    if (this.isPlaying && !this.isPaused) {
      speechSynthesis.cancel()
      this.speak()
    }
  }

  disconnect() {
    this.stop()
  }

  splitIntoChunks(text) {
    if (!text) return []

    // Split on sentence endings
    let sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
    sentences = sentences.map(s => s.trim()).filter(s => s.length > 0)

    // Further split any sentences that are too long (over 200 chars)
    // This helps avoid the "synthesis-failed" error on mobile
    const chunks = []
    for (const sentence of sentences) {
      if (sentence.length > 200) {
        // Split on commas, semicolons, or mid-sentence
        const parts = sentence.match(/[^,;]+[,;]?\s*/g) || [sentence]
        for (const part of parts) {
          if (part.trim()) chunks.push(part.trim())
        }
      } else {
        chunks.push(sentence)
      }
    }

    return chunks
  }

  playPause() {
    if (!this.isPlaying) {
      this.start()
    } else if (this.isPaused) {
      this.resume()
    } else {
      this.pause()
    }
  }

  start() {
    if (!window.speechSynthesis) {
      alert("Speech synthesis not supported in this browser")
      return
    }

    speechSynthesis.cancel()

    this.index = 0
    this.isPlaying = true
    this.isPaused = false
    this.updateIcon()
    this.updateProgress()
    this.speak()
  }

  pause() {
    this.isPaused = true
    speechSynthesis.cancel()
    this.updateIcon()
  }

  resume() {
    this.isPaused = false
    this.updateIcon()
    this.speak()
  }

  stop() {
    speechSynthesis.cancel()
    this.isPlaying = false
    this.isPaused = false
    this.index = 0
    if (this.hasProgressBarTarget) {
      this.progressBarTarget.style.width = "0%"
    }
    this.updateIcon()
  }

  rewind() {
    this.index = Math.max(0, this.index - 1)
    this.updateProgress()
    if (this.isPlaying && !this.isPaused) {
      speechSynthesis.cancel()
      this.speak()
    }
  }

  forward() {
    this.index = Math.min(this.chunks.length - 1, this.index + 1)
    this.updateProgress()
    if (this.isPlaying && !this.isPaused) {
      speechSynthesis.cancel()
      this.speak()
    }
  }

  speak() {
    if (this.isPaused || !this.isPlaying) {
      return
    }

    if (this.index >= this.chunks.length) {
      this.stop()
      return
    }

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel()
    }

    const chunk = this.chunks[this.index]
    const utter = new SpeechSynthesisUtterance(chunk)

    // Always set language explicitly - this is key!
    utter.lang = this.lang
    utter.rate = this.rate
    utter.volume = 1
    utter.pitch = 1

    // Set voice if one is selected
    if (this.voice) {
      utter.voice = this.voice
    }

    utter.onstart = () => {
      this.updateProgress()
    }

    utter.onend = () => {
      if (!this.isPaused && this.isPlaying) {
        this.index++
        this.updateProgress()
        if (this.index < this.chunks.length) {
          requestAnimationFrame(() => {
            if (!this.isPaused && this.isPlaying) {
              this.speak()
            }
          })
        } else {
          this.stop()
        }
      }
    }

    utter.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error("Speech error:", event.error)

        // Try to recover by skipping to next chunk
        if (this.isPlaying && !this.isPaused) {
          console.log("Attempting to recover by skipping to next chunk...")
          this.index++
          if (this.index < this.chunks.length) {
            requestAnimationFrame(() => this.speak())
          } else {
            this.stop()
          }
        }
      }
    }

    speechSynthesis.speak(utter)
  }

  updateProgress() {
    if (!this.hasProgressBarTarget) return
    const progress = this.chunks.length > 0
      ? (this.index / this.chunks.length) * 100
      : 0
    this.progressBarTarget.style.width = `${progress}%`
  }

  changeRate() {
    const value = parseFloat(this.rateTarget.value)
    this.rate = value
    if (this.hasRateLabelTarget) {
      this.rateLabelTarget.textContent = `${value.toFixed(2)}x`
    }

    if (this.isPlaying && !this.isPaused) {
      speechSynthesis.cancel()
      this.speak()
    }
  }

  updateIcon() {
    if (!this.hasPlayPauseIconTarget) return

    if (!this.isPlaying || this.isPaused) {
      this.playPauseIconTarget.className = "fa-solid fa-play"
    } else {
      this.playPauseIconTarget.className = "fa-solid fa-pause"
    }
  }
}
