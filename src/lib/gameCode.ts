/**
 * Game Code Generator - TOTP-like system
 * 
 * Generates a 4-digit code that changes every minute.
 * Same algorithm everywhere = same code for all teachers at same time.
 * No database storage needed - code is derived from time.
 */

/**
 * Generate the current game code and time until expiry
 */
export function generateGameCode(): { code: string; expiresIn: number; progress: number } {
    const now = Date.now()
    const currentMinute = Math.floor(now / 60000)

    // Generate 4-digit code from minute using simple hash
    // This ensures the same minute = same code everywhere
    const hash = ((currentMinute * 9301 + 49297) % 10000)
    const code = hash.toString().padStart(4, '0')

    // Calculate seconds remaining in current minute
    const secondsIntoMinute = Math.floor((now / 1000) % 60)
    const expiresIn = 60 - secondsIntoMinute

    // Progress as percentage (0-100, 0 = just started, 100 = about to expire)
    const progress = (secondsIntoMinute / 60) * 100

    return { code, expiresIn, progress }
}

/**
 * Verify if a provided code matches the current valid code
 */
export function verifyGameCode(inputCode: string): boolean {
    const { code } = generateGameCode()
    return inputCode === code
}
