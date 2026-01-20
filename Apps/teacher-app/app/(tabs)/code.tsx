import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// TOTP-like code generator - same algorithm as web
function generateGameCode(): { code: string; expiresIn: number; progress: number } {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);

    // Generate 4-digit code from minute using simple hash
    const hash = ((currentMinute * 9301 + 49297) % 10000);
    const code = hash.toString().padStart(4, '0');

    // Calculate seconds remaining in current minute
    const secondsIntoMinute = Math.floor((now / 1000) % 60);
    const expiresIn = 60 - secondsIntoMinute;

    // Progress as percentage (0-100)
    const progress = (secondsIntoMinute / 60) * 100;

    return { code, expiresIn, progress };
}

export default function GameCodeScreen() {
    const [code, setCode] = useState('----');
    const [expiresIn, setExpiresIn] = useState(60);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const updateCode = () => {
            const result = generateGameCode();
            setCode(result.code);
            setExpiresIn(result.expiresIn);
            setProgress(result.progress);
        };

        // Update immediately
        updateCode();

        // Update every second
        const interval = setInterval(updateCode, 1000);
        return () => clearInterval(interval);
    }, []);

    // SVG circle properties - smaller size to fit better
    const size = Math.min(width * 0.55, 220);
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Color based on time remaining
    const getColor = () => {
        if (expiresIn <= 10) return '#ef4444'; // red
        if (expiresIn <= 30) return '#f59e0b'; // amber
        return '#22c55e'; // green
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
                </View>
                <Text style={styles.headerTitle}>Game Access Code</Text>
            </View>

            <Text style={styles.subtitle}>
                Enter this code to start the quiz game
            </Text>

            {/* Circular Progress with Code */}
            <View style={styles.codeContainer}>
                <Svg width={size} height={size}>
                    {/* Background circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#374151"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    {/* Progress circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={getColor()}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        origin={`${size / 2}, ${size / 2}`}
                    />
                </Svg>

                {/* Code Display - centered over the circle */}
                <View style={[styles.codeInner, { width: size, height: size }]}>
                    <Text style={[styles.codeText, { color: getColor() }]}>
                        {code}
                    </Text>
                    <Text style={styles.expiresText}>
                        Expires in {expiresIn}s
                    </Text>
                </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#60a5fa" />
                <Text style={styles.infoText}>
                    This code changes every minute.{'\n'}
                    All teachers see the same code.
                </Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
                <View style={styles.instructionItem}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>
                        Click "Start Quiz Game" on the classroom screen
                    </Text>
                </View>
                <View style={styles.instructionItem}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepText}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>
                        Enter this 4-digit code when prompted
                    </Text>
                </View>
                <View style={styles.instructionItem}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepText}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>
                        Game will start once code is verified
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    contentContainer: {
        padding: 20,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        marginBottom: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: '#9ca3af',
        marginBottom: 24,
        textAlign: 'center',
    },
    codeContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    codeInner: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeText: {
        fontSize: 48,
        fontWeight: '800',
        letterSpacing: 6,
        fontFamily: 'monospace',
    },
    expiresText: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 6,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
        width: '100%',
    },
    infoText: {
        color: '#60a5fa',
        fontSize: 13,
        flex: 1,
        lineHeight: 20,
    },
    instructions: {
        width: '100%',
        gap: 14,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    stepBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    instructionText: {
        color: '#d1d5db',
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
});
