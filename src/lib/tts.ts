/**
 * Text-to-Speech utility using Web Speech Synthesis API
 * Automatically selects the best Google English voice when available (Chrome).
 * Falls back to the best available English voice on other browsers.
 */

let selectedVoice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

// Load and cache the best voice
function loadVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    voicesLoaded = true

    // Priority: Google English voices (high quality in Chrome)
    const googleVoice = voices.find(
        v => v.name.includes('Google') && v.lang.startsWith('en')
    )
    if (googleVoice) {
        selectedVoice = googleVoice
        return googleVoice
    }

    // Fallback: any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'))
    if (englishVoice) {
        selectedVoice = englishVoice
        return englishVoice
    }

    // Last resort: first available
    selectedVoice = voices[0]
    return voices[0]
}

// Ensure voices are loaded (they load async in some browsers)
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice | null> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            resolve(null)
            return
        }

        if (voicesLoaded && selectedVoice) {
            resolve(selectedVoice)
            return
        }

        const voice = loadVoice()
        if (voice) {
            resolve(voice)
            return
        }

        // Voices not loaded yet — wait for the event
        window.speechSynthesis.onvoiceschanged = () => {
            resolve(loadVoice())
        }

        // Timeout fallback
        setTimeout(() => {
            resolve(loadVoice())
        }, 1000)
    })
}

/**
 * Speak a question and its options aloud.
 * Format: "Question is: {question}" then "For this question, options are: A: ..., B: ..., C: ..., D: ..."
 */
export async function speakQuestion(
    questionContent: string,
    options?: string[] | null
): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    // Stop any ongoing speech
    stopSpeaking()

    const voice = await ensureVoicesLoaded()

    // Build speech text
    let text = `Question is: ${questionContent}`

    if (options && options.length > 0) {
        const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        const optionsText = options
            .map((opt, i) => `${optionLabels[i] || (i + 1)}: ${opt}`)
            .join('. ')
        text += `. For this question, options are: ${optionsText}`
    }

    const utterance = new SpeechSynthesisUtterance(text)
    if (voice) {
        utterance.voice = voice
    }
    utterance.rate = 0.95 // Slightly slower for clarity
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.lang = 'en-US'

    window.speechSynthesis.speak(utterance)
}

/**
 * Stop any ongoing speech synthesis.
 */
export function stopSpeaking(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
}

/**
 * Check if speech synthesis is currently active.
 */
export function isSpeaking(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false
    return window.speechSynthesis.speaking
}
