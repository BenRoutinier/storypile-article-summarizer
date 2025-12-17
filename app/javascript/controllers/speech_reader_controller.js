import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["progressBar", "text", "rate", "rateLabel", "playPauseIcon", "voiceSelect", "engineSelect"]

  // Lingva public instances (fallbacks if one is down)
  static lingvaInstances = [
    "https://lingva.ml",
    "https://translate.plausibility.cloud",
    "https://lingva.lunar.icu",
    "https://translate.projectsegfau.lt"
  ]

  // Languages supported by Google TTS via Lingva
  static lingvaLanguages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "nl", name: "Dutch" },
    { code: "ru", name: "Russian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "pl", name: "Polish" },
    { code: "tr", name: "Turkish" },
    { code: "vi", name: "Vietnamese" },
    { code: "th", name: "Thai" },
    { code: "sv", name: "Swedish" },
    { code: "da", name: "Danish" },
    { code: "fi", name: "Finnish" },
    { code: "no", name: "Norwegian" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "cs", name: "Czech" },
    { code: "ro", name: "Romanian" },
    { code: "hu", name: "Hungarian" },
    { code: "uk", name: "Ukrainian" },
    { code: "id", name: "Indonesian" }
  ]

  connect() {
    this.text = this.textTarget.textContent.trim()
    this.chunks = this.splitIntoChunks(this.text)
    this.index = 0
    this.rate = 1.0
    this.isPaused = false
    this.isPlaying = false
    this.voice = null
    this.lang = 'en'
    this.browserLang = 'en-US'
    this.engine = 'browser'
    this.currentAudio = null
    this.lingvaInstance = this.constructor.lingvaInstances[0]

    this.loadVoices()
  }

  loadVoices() {
    const populateVoices = () => {
      this.browserVoices = speechSynthesis.getVoices()

      if (this.browserVoices.length > 0) {
        this.populateBrowserVoices()
      } else {
        // No browser voices - default to Google
        console.log('No browser voices available, defaulting to Google TTS')
        if (this.hasEngineSelectTarget) {
          this.engineSelectTarget.value = 'google'
          this.engine = 'google'
        }
        this.populateLingvaLanguages()
      }
    }

    if (speechSynthesis.getVoices().length > 0) {
      populateVoices()
    }
    speechSynthesis.onvoiceschanged = populateVoices
  }

  populateBrowserVoices() {
    if (!this.hasVoiceSelectTarget || !this.browserVoices) return

    const voices = this.browserVoices
    const englishVoices = voices.filter(v => v.lang.startsWith('en'))
    const otherVoices = voices.filter(v => !v.lang.startsWith('en'))
    const sortedVoices = [...englishVoices, ...otherVoices]

    this.voiceSelectTarget.innerHTML = sortedVoices
      .map((voice) => {
        const originalIndex = voices.indexOf(voice)
        return `<option value="${originalIndex}">${voice.name} (${voice.lang})</option>`
      })
      .join('')

    this.voiceSelectTarget.disabled = false

    if (englishVoices.length > 0) {
      const firstEnglishIndex = voices.indexOf(englishVoices[0])
      this.voiceSelectTarget.value = firstEnglishIndex
      this.voice = englishVoices[0]
      this.browserLang = this.voice.lang
    }
  }

  populateLingvaLanguages() {
    if (!this.hasVoiceSelectTarget) return

    const languages = this.constructor.lingvaLanguages
    this.voiceSelectTarget.innerHTML = languages
      .map(lang => `<option value="${lang.code}">${lang.name}</option>`)
      .join('')

    this.voiceSelectTarget.disabled = false
    this.voiceSelectTarget.value = this.lang
  }

  changeEngine() {
    this.pause()
    if (!this.hasEngineSelectTarget) return

    this.engine = this.engineSelectTarget.value
    console.log('Engine changed to:', this.engine)

    // Swap dropdown contents based on engine
    if (this.engine === 'google') {
      this.populateLingvaLanguages()
    } else {
      this.populateBrowserVoices()
    }

  }

  changeVoice() {
    this.pause()
    if (this.engine === 'google') {
      // For Lingva, the value is a language code
      this.lang = this.voiceSelectTarget.value
      console.log("Language changed to:", this.lang)
    } else {
      // For browser, the value is a voice index
      const voices = this.browserVoices || speechSynthesis.getVoices()
      const index = parseInt(this.voiceSelectTarget.value)
      this.voice = voices[index]
      this.browserLang = this.voice.lang
      console.log("Voice changed to:", this.voice.name, this.voice.lang)
    }

  }

  disconnect() {
    this.stop()
  }

  splitIntoChunks(text) {
    if (!text) return []

    let sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
    sentences = sentences.map(s => s.trim()).filter(s => s.length > 0)

    const maxLen = 180
    const chunks = []

    for (const sentence of sentences) {
      if (sentence.length > maxLen) {
        const parts = sentence.match(/[^,;:]+[,;:]?\s*/g) || [sentence]
        let current = ''

        for (const part of parts) {
          if ((current + part).length > maxLen) {
            if (current.trim()) chunks.push(current.trim())
            current = part
          } else {
            current += part
          }
        }
        if (current.trim()) chunks.push(current.trim())
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
    this.stopCurrentPlayback()
    this.index = 0
    this.isPlaying = true
    this.isPaused = false
    this.updateIcon()
    this.updateProgress()
    this.speak()
  }

  pause() {
    this.isPaused = true
    this.stopCurrentPlayback()
    this.updateIcon()
  }

  resume() {
    this.isPaused = false
    this.updateIcon()
    this.speak()
  }

  stop() {
    this.stopCurrentPlayback()
    this.isPlaying = false
    this.isPaused = false
    this.index = 0
    if (this.hasProgressBarTarget) {
      this.progressBarTarget.style.width = "0%"
    }
    this.updateIcon()
  }

  stopCurrentPlayback() {
    speechSynthesis.cancel()
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
  }

  rewind() {
    this.index = Math.max(0, this.index - 1)
    this.updateProgress()
    if (this.isPlaying && !this.isPaused) {
      this.stopCurrentPlayback()
      this.speak()
    }
  }

  forward() {
    this.index = Math.min(this.chunks.length - 1, this.index + 1)
    this.updateProgress()
    if (this.isPlaying && !this.isPaused) {
      this.stopCurrentPlayback()
      this.speak()
    }
  }

  speak() {
    if (this.isPaused || !this.isPlaying) return
    if (this.index >= this.chunks.length) {
      this.stop()
      return
    }

    if (this.engine === 'google') {
      this.speakWithLingva()
    } else {
      this.speakWithBrowser()
    }
  }

  speakWithBrowser() {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel()
    }

    const chunk = this.chunks[this.index]
    const utter = new SpeechSynthesisUtterance(chunk)

    utter.lang = this.browserLang
    utter.rate = this.rate
    utter.volume = 1
    utter.pitch = 1

    if (this.voice) {
      utter.voice = this.voice
    }

    utter.onstart = () => this.updateProgress()

    utter.onend = () => {
      if (!this.isPaused && this.isPlaying) {
        this.index++
        this.updateProgress()
        if (this.index < this.chunks.length) {
          requestAnimationFrame(() => {
            if (!this.isPaused && this.isPlaying) this.speak()
          })
        } else {
          this.stop()
        }
      }
    }

    utter.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error("Speech error:", event.error)
        if (this.isPlaying && !this.isPaused) {
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

  async speakWithLingva(instanceIndex = 0) {
    const chunk = this.chunks[this.index]
    const instances = this.constructor.lingvaInstances

    if (instanceIndex >= instances.length) {
      console.error("All Lingva instances failed, falling back to browser")
      this.engine = 'browser'
      if (this.hasEngineSelectTarget) this.engineSelectTarget.value = 'browser'
      if (this.hasVoiceSelectTarget) this.voiceSelectTarget.disabled = false
      this.speakWithBrowser()
      return
    }

    const instance = instances[instanceIndex]
    const encodedText = encodeURIComponent(chunk)
    const url = `${instance}/api/v1/audio/${this.lang}/${encodedText}`

    this.updateProgress()

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.audio || !Array.isArray(data.audio)) {
        throw new Error("Invalid audio data")
      }

      // Convert the byte array to audio
      const audioBytes = new Uint8Array(data.audio)
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(blob)

      const audio = new Audio(audioUrl)
      this.currentAudio = audio
      audio.playbackRate = this.rate

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        if (!this.isPaused && this.isPlaying) {
          this.index++
          this.updateProgress()
          if (this.index < this.chunks.length) {
            setTimeout(() => {
              if (!this.isPaused && this.isPlaying) this.speak()
            }, 25)
          } else {
            this.stop()
          }
        }
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        // Only try fallback if we're still supposed to be playing
         if (this.currentAudio === audio && this.isPlaying && !this.isPaused) {
          console.error(`Audio playback failed from ${instance}`)
        }
      }

      await audio.play()
      this.lingvaInstance = instance // Remember working instance

    } catch (err) {
      // Only try fallback if we're still supposed to be playing
      if (this.isPlaying && !this.isPaused) {
        console.error(`Lingva instance ${instance} failed:`, err.message)
        this.speakWithLingva(instanceIndex + 1)
      }
    }
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

    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.rate
    }

    if (this.isPlaying && !this.isPaused && this.engine === 'browser') {
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
