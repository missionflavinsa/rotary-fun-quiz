import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type GameSession = {
    id: string;
    started_at: string;
    ended_at: string | null;
    total_questions: number;
    status: string;
    classes?: { name: string; section: string } | null;
    subjects?: { name: string } | null;
    profiles?: { full_name: string } | null;
};

type GameResult = {
    id: string;
    is_correct: boolean;
    points_earned: number;
    student_answer?: string | null;
    students?: { full_name: string } | null;
    questions?: { content: string } | null;
};

export default function HistoryScreen() {
    const [games, setGames] = useState<GameSession[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedGame, setExpandedGame] = useState<string | null>(null);
    const [gameResults, setGameResults] = useState<GameResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    const fetchGames = async () => {
        const { data } = await supabase
            .from('game_sessions')
            .select('id, started_at, ended_at, total_questions, status, classes(name, section), subjects(name), profiles(full_name)')
            .order('started_at', { ascending: false })
            .limit(50);
        if (data) setGames(data as unknown as GameSession[]);
    };

    const fetchResults = async (sessionId: string) => {
        setLoadingResults(true);
        const { data } = await supabase
            .from('game_results')
            .select('id, is_correct, points_earned, student_answer, students(full_name), questions(content)')
            .eq('session_id', sessionId)
            .order('answered_at', { ascending: true });
        if (data) setGameResults(data as unknown as GameResult[]);
        setLoadingResults(false);
    };

    useEffect(() => { fetchGames(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchGames();
        setRefreshing(false);
    };

    const toggleGame = (gameId: string) => {
        if (expandedGame === gameId) {
            setExpandedGame(null);
            setGameResults([]);
        } else {
            setExpandedGame(gameId);
            fetchResults(gameId);
        }
    };

    const getStatusColor = (status: string) => {
        if (status === 'completed') return { bg: '#d1fae5', text: '#059669' };
        if (status === 'active') return { bg: '#fef3c7', text: '#d97706' };
        return { bg: '#e5e7eb', text: '#6b7280' };
    };

    const getTotalScore = (results: GameResult[]) => results.reduce((sum, r) => sum + (r.points_earned || 0), 0);
    const getCorrectCount = (results: GameResult[]) => results.filter(r => r.is_correct).length;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
        >
            {games.length > 0 ? games.map(game => {
                const isExpanded = expandedGame === game.id;
                const statusColors = getStatusColor(game.status);

                return (
                    <View key={game.id} style={styles.gameCard}>
                        <TouchableOpacity onPress={() => toggleGame(game.id)} style={styles.gameHeader}>
                            <View style={styles.gameInfo}>
                                <View style={styles.gameTitleRow}>
                                    <Ionicons name="game-controller" size={18} color="#818cf8" />
                                    <Text style={styles.gameTitle}>
                                        {game.classes?.name || 'Unknown'} {game.classes?.section ? `- ${game.classes.section}` : ''}
                                    </Text>
                                </View>
                                <Text style={styles.gameSubtitle}>
                                    {game.subjects?.name || 'General Quiz'}
                                    {game.profiles?.full_name && ` • ${game.profiles.full_name}`}
                                </Text>
                                <View style={styles.gameDateRow}>
                                    <View style={styles.dateItem}>
                                        <Ionicons name="calendar" size={12} color="#6b7280" />
                                        <Text style={styles.dateText}>{new Date(game.started_at).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={styles.dateItem}>
                                        <Ionicons name="time" size={12} color="#6b7280" />
                                        <Text style={styles.dateText}>{new Date(game.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.gameRight}>
                                <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                                    <Text style={[styles.statusText, { color: statusColors.text }]}>{game.status || 'active'}</Text>
                                </View>
                                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
                            </View>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View style={styles.resultsContainer}>
                                {loadingResults ? (
                                    <ActivityIndicator color="#818cf8" style={styles.loader} />
                                ) : gameResults.length > 0 ? (
                                    <>
                                        <View style={styles.statsRow}>
                                            <View style={[styles.statBox, styles.statBoxFirst]}>
                                                <Text style={styles.statValue}>{gameResults.length}</Text>
                                                <Text style={styles.statLabel}>Questions</Text>
                                            </View>
                                            <View style={styles.statBox}>
                                                <Text style={[styles.statValue, { color: '#34d399' }]}>{getCorrectCount(gameResults)}</Text>
                                                <Text style={styles.statLabel}>Correct</Text>
                                            </View>
                                            <View style={[styles.statBox, styles.statBoxLast]}>
                                                <Text style={[styles.statValue, { color: '#facc15' }]}>{getTotalScore(gameResults)}</Text>
                                                <Text style={styles.statLabel}>Points</Text>
                                            </View>
                                        </View>
                                        {gameResults.map(result => (
                                            <View key={result.id} style={[styles.resultItem, { backgroundColor: result.is_correct ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                                                <View style={[styles.resultIcon, { backgroundColor: result.is_correct ? '#34d399' : '#ef4444' }]}>
                                                    <Ionicons name={result.is_correct ? 'checkmark' : 'close'} size={14} color="#fff" />
                                                </View>
                                                <View style={styles.resultInfo}>
                                                    <Text style={styles.resultName}>{result.students?.full_name || 'Unknown'}</Text>
                                                    <Text style={styles.resultQuestion} numberOfLines={1}>
                                                        {result.questions?.content?.slice(0, 50) || (() => {
                                                            try {
                                                                const parsed = JSON.parse(result.student_answer || '');
                                                                return parsed.question_content?.slice(0, 50) || 'AI Question';
                                                            } catch { return 'AI Question'; }
                                                        })()}...
                                                    </Text>
                                                </View>
                                                <Text style={[styles.resultPoints, { color: result.is_correct ? '#34d399' : '#6b7280' }]}>
                                                    {result.is_correct ? `+${result.points_earned}` : '0'}
                                                </Text>
                                            </View>
                                        ))}
                                    </>
                                ) : (
                                    <Text style={styles.noResults}>No results recorded</Text>
                                )}
                            </View>
                        )}
                    </View>
                );
            }) : (
                <View style={styles.emptyState}>
                    <Ionicons name="game-controller-outline" size={64} color="#374151" />
                    <Text style={styles.emptyTitle}>No games yet</Text>
                    <Text style={styles.emptySubtitle}>Start a quiz to see history here</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0d24' },
    contentContainer: { padding: 16 },
    gameCard: { backgroundColor: '#1e1b4b', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
    gameHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    gameInfo: { flex: 1 },
    gameTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    gameTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
    gameSubtitle: { color: '#6b7280', fontSize: 13, marginBottom: 8 },
    gameDateRow: { flexDirection: 'row' },
    dateItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
    dateText: { color: '#6b7280', fontSize: 12, marginLeft: 4 },
    gameRight: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
    statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    resultsContainer: { borderTopWidth: 1, borderTopColor: '#312e81', padding: 16, backgroundColor: '#15132b' },
    loader: { padding: 20 },
    statsRow: { flexDirection: 'row', marginBottom: 16 },
    statBox: { flex: 1, backgroundColor: '#1e1b4b', borderRadius: 8, padding: 12, alignItems: 'center', marginHorizontal: 4 },
    statBoxFirst: { marginLeft: 0 },
    statBoxLast: { marginRight: 0 },
    statValue: { color: '#818cf8', fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: '#6b7280', fontSize: 11 },
    resultItem: { borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
    resultIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    resultInfo: { flex: 1 },
    resultName: { color: '#fff', fontWeight: '500', marginBottom: 2 },
    resultQuestion: { color: '#6b7280', fontSize: 12 },
    resultPoints: { fontWeight: 'bold' },
    noResults: { color: '#6b7280', textAlign: 'center', padding: 20 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
    emptySubtitle: { color: '#6b7280', marginTop: 4 },
});
