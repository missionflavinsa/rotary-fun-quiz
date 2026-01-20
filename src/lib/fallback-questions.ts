// Subject-specific fallback questions with LaTeX math notation
// Use $...$ for inline math and $$...$$ for display math

export interface FallbackQuestion {
    id: string
    content: string
    type: 'mcq' | 'integer'
    options: string[] | null
    correct_answer: string
    points: number
    difficulty: 'easy' | 'medium' | 'hard'
}

const MATH_QUESTIONS: FallbackQuestion[] = [
    { id: 'math-1', content: 'What is the value of $15 \\times 8$?', type: 'mcq', options: ['100', '120', '130', '110'], correct_answer: '120', points: 10, difficulty: 'easy' },
    { id: 'math-2', content: 'Solve: $\\frac{24}{6} + 7 = ?$', type: 'mcq', options: ['10', '11', '12', '13'], correct_answer: '11', points: 10, difficulty: 'easy' },
    { id: 'math-3', content: 'If $x^2 = 49$, what is $x$?', type: 'mcq', options: ['±5', '±6', '±7', '±8'], correct_answer: '±7', points: 15, difficulty: 'medium' },
    { id: 'math-4', content: 'What is the area of a circle with radius $r = 7$ cm? Use $\\pi = \\frac{22}{7}$', type: 'mcq', options: ['$144$ cm²', '$154$ cm²', '$164$ cm²', '$174$ cm²'], correct_answer: '$154$ cm²', points: 15, difficulty: 'medium' },
    { id: 'math-5', content: 'Simplify: $\\sqrt{144} + \\sqrt{81}$', type: 'mcq', options: ['19', '20', '21', '22'], correct_answer: '21', points: 10, difficulty: 'easy' },
]

const CHEMISTRY_QUESTIONS: FallbackQuestion[] = [
    { id: 'chem-1', content: 'What is the chemical formula for water?', type: 'mcq', options: ['$O_2$', '$CO_2$', '$H_2O$', '$NaCl$'], correct_answer: '$H_2O$', points: 10, difficulty: 'easy' },
    { id: 'chem-2', content: 'What is the atomic number of Carbon?', type: 'mcq', options: ['4', '6', '8', '12'], correct_answer: '6', points: 10, difficulty: 'easy' },
    { id: 'chem-3', content: 'Balance the equation: $H_2 + O_2 \\rightarrow H_2O$', type: 'mcq', options: ['$2H_2 + O_2 \\rightarrow 2H_2O$', '$H_2 + 2O_2 \\rightarrow H_2O$', '$H_2 + O_2 \\rightarrow 2H_2O$', '$2H_2 + 2O_2 \\rightarrow 2H_2O$'], correct_answer: '$2H_2 + O_2 \\rightarrow 2H_2O$', points: 15, difficulty: 'medium' },
    { id: 'chem-4', content: 'What is the pH of pure water at 25°C?', type: 'mcq', options: ['5', '6', '7', '8'], correct_answer: '7', points: 10, difficulty: 'easy' },
    { id: 'chem-5', content: 'Which gas is released when $HCl$ reacts with $Zn$?', type: 'mcq', options: ['$O_2$', '$H_2$', '$Cl_2$', '$N_2$'], correct_answer: '$H_2$', points: 15, difficulty: 'medium' },
]

const PHYSICS_QUESTIONS: FallbackQuestion[] = [
    { id: 'phys-1', content: 'What is the SI unit of force?', type: 'mcq', options: ['Joule', 'Newton', 'Watt', 'Pascal'], correct_answer: 'Newton', points: 10, difficulty: 'easy' },
    { id: 'phys-2', content: 'What is the formula for velocity?', type: 'mcq', options: ['$v = \\frac{d}{t}$', '$v = d \\times t$', '$v = \\frac{t}{d}$', '$v = d + t$'], correct_answer: '$v = \\frac{d}{t}$', points: 10, difficulty: 'easy' },
    { id: 'phys-3', content: 'Calculate kinetic energy: $KE = \\frac{1}{2}mv^2$ where $m = 2$ kg, $v = 3$ m/s', type: 'mcq', options: ['6 J', '9 J', '12 J', '18 J'], correct_answer: '9 J', points: 15, difficulty: 'medium' },
    { id: 'phys-4', content: 'What is the value of acceleration due to gravity on Earth?', type: 'mcq', options: ['$8.9$ m/s²', '$9.8$ m/s²', '$10.8$ m/s²', '$11.8$ m/s²'], correct_answer: '$9.8$ m/s²', points: 10, difficulty: 'easy' },
    { id: 'phys-5', content: 'If $F = ma$ and $F = 20$ N, $m = 4$ kg, find $a$.', type: 'mcq', options: ['$4$ m/s²', '$5$ m/s²', '$6$ m/s²', '$80$ m/s²'], correct_answer: '$5$ m/s²', points: 15, difficulty: 'medium' },
]

const BIOLOGY_QUESTIONS: FallbackQuestion[] = [
    { id: 'bio-1', content: 'What is the powerhouse of the cell?', type: 'mcq', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi Body'], correct_answer: 'Mitochondria', points: 10, difficulty: 'easy' },
    { id: 'bio-2', content: 'What is the process by which plants make their own food?', type: 'mcq', options: ['Respiration', 'Photosynthesis', 'Digestion', 'Fermentation'], correct_answer: 'Photosynthesis', points: 10, difficulty: 'easy' },
    { id: 'bio-3', content: 'The equation for photosynthesis is: $6CO_2 + 6H_2O \\xrightarrow{\\text{light}} C_6H_{12}O_6 + ?$', type: 'mcq', options: ['$6O_2$', '$6H_2$', '$6CO$', '$6N_2$'], correct_answer: '$6O_2$', points: 15, difficulty: 'medium' },
    { id: 'bio-4', content: 'What carries genetic information in cells?', type: 'mcq', options: ['Protein', 'Lipid', 'DNA', 'Carbohydrate'], correct_answer: 'DNA', points: 10, difficulty: 'easy' },
    { id: 'bio-5', content: 'What is the normal human body temperature in Celsius?', type: 'mcq', options: ['35°C', '36°C', '37°C', '38°C'], correct_answer: '37°C', points: 10, difficulty: 'easy' },
]

const GK_QUESTIONS: FallbackQuestion[] = [
    { id: 'gk-1', content: 'Which planet is known as the Red Planet?', type: 'mcq', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct_answer: 'Mars', points: 10, difficulty: 'easy' },
    { id: 'gk-2', content: 'What is the capital of France?', type: 'mcq', options: ['London', 'Berlin', 'Paris', 'Madrid'], correct_answer: 'Paris', points: 10, difficulty: 'easy' },
    { id: 'gk-3', content: 'How many continents are there on Earth?', type: 'mcq', options: ['5', '6', '7', '8'], correct_answer: '7', points: 10, difficulty: 'easy' },
    { id: 'gk-4', content: 'Which is the largest ocean on Earth?', type: 'mcq', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct_answer: 'Pacific', points: 10, difficulty: 'easy' },
    { id: 'gk-5', content: 'In which year did India gain independence?', type: 'mcq', options: ['1945', '1946', '1947', '1948'], correct_answer: '1947', points: 10, difficulty: 'easy' },
]

const HISTORY_QUESTIONS: FallbackQuestion[] = [
    { id: 'hist-1', content: 'Who was the first President of India?', type: 'mcq', options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Dr. Rajendra Prasad', 'Sardar Patel'], correct_answer: 'Dr. Rajendra Prasad', points: 10, difficulty: 'easy' },
    { id: 'hist-2', content: 'In which year did the Quit India Movement start?', type: 'mcq', options: ['1940', '1941', '1942', '1943'], correct_answer: '1942', points: 15, difficulty: 'medium' },
    { id: 'hist-3', content: 'Who built the Taj Mahal?', type: 'mcq', options: ['Akbar', 'Shah Jahan', 'Jahangir', 'Aurangzeb'], correct_answer: 'Shah Jahan', points: 10, difficulty: 'easy' },
    { id: 'hist-4', content: 'The Battle of Plassey was fought in which year?', type: 'mcq', options: ['1757', '1857', '1764', '1947'], correct_answer: '1757', points: 15, difficulty: 'medium' },
    { id: 'hist-5', content: 'Who discovered India by sea route?', type: 'mcq', options: ['Christopher Columbus', 'Vasco da Gama', 'Marco Polo', 'Ferdinand Magellan'], correct_answer: 'Vasco da Gama', points: 10, difficulty: 'easy' },
]

const GEOGRAPHY_QUESTIONS: FallbackQuestion[] = [
    { id: 'geo-1', content: 'What is the longest river in India?', type: 'mcq', options: ['Yamuna', 'Godavari', 'Ganga', 'Brahmaputra'], correct_answer: 'Ganga', points: 10, difficulty: 'easy' },
    { id: 'geo-2', content: 'Which is the largest state in India by area?', type: 'mcq', options: ['Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'Uttar Pradesh'], correct_answer: 'Rajasthan', points: 10, difficulty: 'easy' },
    { id: 'geo-3', content: 'The Tropic of Cancer passes through how many Indian states?', type: 'mcq', options: ['6', '7', '8', '9'], correct_answer: '8', points: 15, difficulty: 'medium' },
    { id: 'geo-4', content: 'Which Indian state has the longest coastline?', type: 'mcq', options: ['Kerala', 'Tamil Nadu', 'Maharashtra', 'Gujarat'], correct_answer: 'Gujarat', points: 15, difficulty: 'medium' },
    { id: 'geo-5', content: 'What is the highest peak in India?', type: 'mcq', options: ['Mount Everest', 'Kangchenjunga', 'K2', 'Nanda Devi'], correct_answer: 'Kangchenjunga', points: 10, difficulty: 'easy' },
]

const ENGLISH_QUESTIONS: FallbackQuestion[] = [
    { id: 'eng-1', content: 'What is the plural of "child"?', type: 'mcq', options: ['Childs', 'Children', 'Childes', 'Childrens'], correct_answer: 'Children', points: 10, difficulty: 'easy' },
    { id: 'eng-2', content: 'Identify the noun in: "The cat sat on the mat."', type: 'mcq', options: ['sat', 'on', 'the', 'cat'], correct_answer: 'cat', points: 10, difficulty: 'easy' },
    { id: 'eng-3', content: 'What is the past tense of "go"?', type: 'mcq', options: ['Goed', 'Gone', 'Went', 'Going'], correct_answer: 'Went', points: 10, difficulty: 'easy' },
    { id: 'eng-4', content: 'Choose the correct spelling:', type: 'mcq', options: ['Accomodate', 'Accommodate', 'Acomodate', 'Acommodate'], correct_answer: 'Accommodate', points: 15, difficulty: 'medium' },
    { id: 'eng-5', content: '"She sings beautifully" - What part of speech is "beautifully"?', type: 'mcq', options: ['Adjective', 'Adverb', 'Noun', 'Verb'], correct_answer: 'Adverb', points: 10, difficulty: 'easy' },
]

// Map subject names to question sets
const SUBJECT_QUESTIONS: Record<string, FallbackQuestion[]> = {
    'mathematics': MATH_QUESTIONS,
    'math': MATH_QUESTIONS,
    'maths': MATH_QUESTIONS,
    'chemistry': CHEMISTRY_QUESTIONS,
    'physics': PHYSICS_QUESTIONS,
    'biology': BIOLOGY_QUESTIONS,
    'science': [...PHYSICS_QUESTIONS.slice(0, 2), ...CHEMISTRY_QUESTIONS.slice(0, 2), ...BIOLOGY_QUESTIONS.slice(0, 1)],
    'history': HISTORY_QUESTIONS,
    'geography': GEOGRAPHY_QUESTIONS,
    'english': ENGLISH_QUESTIONS,
    'general knowledge': GK_QUESTIONS,
    'gk': GK_QUESTIONS,
}

/**
 * Get fallback questions for a specific subject
 * @param subjectName The name of the subject
 * @returns Array of fallback questions for that subject, or GK questions if subject not found
 */
export function getFallbackQuestions(subjectName: string): FallbackQuestion[] {
    const normalizedSubject = subjectName.toLowerCase().trim()

    // Try exact match first
    if (SUBJECT_QUESTIONS[normalizedSubject]) {
        return SUBJECT_QUESTIONS[normalizedSubject]
    }

    // Try partial match
    for (const [key, questions] of Object.entries(SUBJECT_QUESTIONS)) {
        if (normalizedSubject.includes(key) || key.includes(normalizedSubject)) {
            return questions
        }
    }

    // Default to GK questions
    return GK_QUESTIONS
}
