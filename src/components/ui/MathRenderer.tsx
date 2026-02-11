'use client'

import { useEffect, useRef, useState } from 'react'

interface MathRendererProps {
    content: string
    className?: string
    style?: React.CSSProperties
}

// Enhanced chemistry detection and conversion
function convertChemistryToDisplay(text: string): string {
    // Convert reaction arrows
    text = text.replace(/<->/g, ' ⇌ ')  // reversible
    text = text.replace(/->/g, ' → ')    // forward
    text = text.replace(/=>/g, ' ⇒ ')   // implies
    text = text.replace(/<-/g, ' ← ')   // backward

    // Handle state symbols (aq), (s), (l), (g)
    text = text.replace(/\(aq\)/gi, '<span class="state">(aq)</span>')
    text = text.replace(/\(s\)/gi, '<span class="state">(s)</span>')
    text = text.replace(/\(l\)/gi, '<span class="state">(l)</span>')
    text = text.replace(/\(g\)/gi, '<span class="state">(g)</span>')

    // Handle heat/delta symbol
    text = text.replace(/\\Delta/g, 'Δ')
    text = text.replace(/\\delta/g, 'δ')

    // Convert chemical formulas with subscript numbers
    // Match patterns like H2O, CO2, O2, Ca(OH)2, etc.
    text = text.replace(/([A-Za-z\)])(\d+)/g, '$1<sub>$2</sub>')

    // Convert coefficients in front (e.g., 2H2O, 3NaCl)
    text = text.replace(/(^|\s|\+)(\d+)([A-Z])/g, '$1<span class="coeff">$2</span>$3')

    // Handle ionic charges like Fe^2+, SO4^2-, Cl^-
    text = text.replace(/\^(\d*)([+\-])/g, '<sup>$1$2</sup>')

    // Handle simple charge notation at end: Fe2+, O2-
    text = text.replace(/([A-Za-z])(\d*)([+\-])(?=\s|$|,)/g, '$1<sup>$2$3</sup>')

    // Handle dot notation for hydrates (CuSO4·5H2O)
    text = text.replace(/·/g, '·')
    text = text.replace(/\./g, '·')

    return text
}

// Convert math exponents (^) to superscript
function convertMathExponentsToDisplay(text: string): string {
    text = text.replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
    text = text.replace(/\^(\d+)/g, '<sup>$1</sup>')
    text = text.replace(/\^([a-zA-Z])/g, '<sup>$1</sup>')

    // Unicode superscripts
    text = text.replace(/<sup>2<\/sup>/g, '²')
    text = text.replace(/<sup>3<\/sup>/g, '³')
    text = text.replace(/<sup>1<\/sup>/g, '¹')
    text = text.replace(/<sup>0<\/sup>/g, '⁰')

    // Subscripts
    text = text.replace(/_{([^}]+)}/g, '<sub>$1</sub>')
    text = text.replace(/_(\d+)/g, '<sub>$1</sub>')

    return text
}

// Check if text contains LaTeX math delimiters
function containsLatex(text: string): boolean {
    return /\$[\s\S]+?\$/.test(text) || /\$\$[\s\S]+?\$\$/.test(text) || /\\ce\{/.test(text)
}

// Check if text looks like a chemistry equation
function looksLikeChemistry(text: string): boolean {
    return /->/.test(text) ||                    // reaction arrow
        /<->/.test(text) ||                      // reversible arrow
        /[A-Z][a-z]?\d/.test(text) ||            // element with subscript
        /\d[A-Z]/.test(text) ||                  // coefficient + element
        /\(aq\)|\(s\)|\(l\)|\(g\)/i.test(text) || // state symbols
        /\^[+-]/.test(text) ||                   // ionic charge
        /[A-Z][a-z]?[+-]/.test(text)             // ion notation
}

// Check if text contains math exponents or subscripts
function containsMathNotation(text: string): boolean {
    return /\^/.test(text) || /_\d/.test(text) || /_{/.test(text)
}

declare global {
    interface Window {
        katex?: {
            renderToString: (tex: string, options?: object) => string
        }
        mhchemLoaded?: boolean
    }
}

let katexLoadPromise: Promise<void> | null = null

const loadKaTeX = (): Promise<void> => {
    if (katexLoadPromise) return katexLoadPromise

    katexLoadPromise = new Promise((resolve, reject) => {
        if (window.katex && window.mhchemLoaded) {
            resolve()
            return
        }

        // Load CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
        document.head.appendChild(link)

        // Load KaTeX JS
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'
        script.onload = () => {
            // Load mhchem extension for chemistry
            const mhchemScript = document.createElement('script')
            mhchemScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/mhchem.min.js'
            mhchemScript.onload = () => {
                window.mhchemLoaded = true
                resolve()
            }
            mhchemScript.onerror = () => {
                // mhchem failed but KaTeX works, continue anyway
                resolve()
            }
            document.head.appendChild(mhchemScript)
        }
        script.onerror = () => reject(new Error('Failed to load KaTeX'))
        document.head.appendChild(script)
    })

    return katexLoadPromise
}

export function MathRenderer({ content, className = '', style }: MathRendererProps) {
    const containerRef = useRef<HTMLSpanElement>(null)
    const [htmlContent, setHtmlContent] = useState<string | null>(null)

    useEffect(() => {
        const renderContent = async () => {
            try {
                // Check for \ce{} chemistry notation (mhchem)
                if (/\\ce\{/.test(content)) {
                    await loadKaTeX()
                    if (!window.katex) {
                        setHtmlContent(null)
                        return
                    }

                    let html = content
                    // Process \ce{...} chemistry expressions
                    html = html.replace(/\\ce\{([^}]+)\}/g, (_, chem) => {
                        try {
                            return window.katex!.renderToString(`\\ce{${chem}}`, {
                                displayMode: false,
                                throwOnError: false
                            })
                        } catch {
                            return convertChemistryToDisplay(chem)
                        }
                    })
                    setHtmlContent(html)
                }
                // Check if we have standard LaTeX content ($...$)
                else if (containsLatex(content)) {
                    await loadKaTeX()

                    if (!window.katex) {
                        setHtmlContent(null)
                        return
                    }

                    let html = content

                    // Convert display math $$...$$
                    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
                        try {
                            return window.katex!.renderToString(tex.trim(), {
                                displayMode: true,
                                throwOnError: false
                            })
                        } catch {
                            return tex
                        }
                    })

                    // Convert inline math $...$
                    html = html.replace(/\$([^\$]+?)\$/g, (_, tex) => {
                        try {
                            return window.katex!.renderToString(tex.trim(), {
                                displayMode: false,
                                throwOnError: false
                            })
                        } catch {
                            return tex
                        }
                    })

                    setHtmlContent(html)
                }
                // Check if it looks like a chemistry equation (plain text)
                else if (looksLikeChemistry(content)) {
                    setHtmlContent(convertChemistryToDisplay(content))
                }
                // Check if it contains math notation (^, _)
                else if (containsMathNotation(content)) {
                    setHtmlContent(convertMathExponentsToDisplay(content))
                }
                // Plain text
                else {
                    setHtmlContent(null)
                }
            } catch (error) {
                console.error('MathRenderer error:', error)
                setHtmlContent(null)
            }
        }

        renderContent()
    }, [content])

    // If we have processed HTML content, use dangerouslySetInnerHTML
    if (htmlContent !== null) {
        return (
            <span
                ref={containerRef}
                className={`math-renderer ${className}`}
                style={{ display: 'inline', ...style }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
        )
    }

    // Otherwise, render as plain text
    return (
        <span
            ref={containerRef}
            className={`math-renderer ${className}`}
            style={{ display: 'inline', ...style }}
        >
            {content}
        </span>
    )
}

// Add CSS for chemistry display
if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = `
        .math-renderer sub {
            font-size: 0.75em;
            vertical-align: sub;
        }
        .math-renderer sup {
            font-size: 0.75em;
            vertical-align: super;
        }
        .math-renderer .coeff {
            font-weight: 600;
            margin-right: 1px;
        }
        .math-renderer .state {
            font-size: 0.85em;
            color: #666;
            margin-left: 1px;
        }
        /* Better arrow styling */
        .math-renderer {
            font-family: 'Times New Roman', serif;
        }
    `
    if (!document.head.querySelector('[data-math-renderer-styles]')) {
        style.setAttribute('data-math-renderer-styles', 'true')
        document.head.appendChild(style)
    }
}
