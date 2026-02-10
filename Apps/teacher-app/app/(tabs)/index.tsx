import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Linking, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type GameSession = {
  id: string;
  started_at: string;
  total_questions: number;
  game_score: number;
  classes?: { name: string; section: string } | { name: string; section: string }[];
  subjects?: { name: string } | { name: string }[];
  topScorer?: { name: string; points: number } | null;
};

type TopStudent = {
  id: string;
  full_name: string;
  total_points: number;
  current_level: number;
};

export default function DashboardScreen() {
  const [recentGames, setRecentGames] = useState<GameSession[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [stats, setStats] = useState({ totalGames: 0, totalStudents: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('');

  const fetchData = async () => {
    // Get current user's name
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (profile?.full_name) setUserName(profile.full_name);
    }

    const fetchTime = new Date();
    fetchTime.setDate(fetchTime.getDate() - 7); // Last 7 days

    // Build query with teacher filter - include section and subject
    let gamesQuery = supabase
      .from('game_sessions')
      .select('id, started_at, total_questions, game_score, classes(name, section), subjects(name)')
      .gte('started_at', fetchTime.toISOString())
      .order('started_at', { ascending: false })
      .limit(10);

    // Filter by teacher_id if user is logged in
    if (user?.id) {
      gamesQuery = gamesQuery.eq('teacher_id', user.id);
    }

    const { data: games, error: gamesError } = await gamesQuery;

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
    }

    // Fetch top scorer for each game
    let gamesWithScorers: GameSession[] = [];
    if (games && games.length > 0) {
      const gameIds = games.map(g => g.id);

      // Get top scorers from game_results grouped by session
      const { data: results } = await supabase
        .from('game_results')
        .select('session_id, points_earned, students(full_name)')
        .in('session_id', gameIds)
        .order('points_earned', { ascending: false });

      // Build a map of session_id -> top scorer
      const topScorerMap: Record<string, { name: string; points: number }> = {};
      if (results) {
        for (const r of results) {
          const sid = r.session_id;
          const studentName = Array.isArray(r.students) ? r.students[0]?.full_name : (r.students as any)?.full_name;
          const pts = r.points_earned || 0;
          if (!topScorerMap[sid] || pts > topScorerMap[sid].points) {
            topScorerMap[sid] = { name: studentName || 'Unknown', points: pts };
          }
        }
      }

      gamesWithScorers = (games as unknown as GameSession[]).map(g => ({
        ...g,
        topScorer: topScorerMap[g.id] || null,
      }));
    }

    setRecentGames(gamesWithScorers);

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, total_points, current_level')
      .order('total_points', { ascending: false })
      .limit(5);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
    }

    if (students) setTopStudents(students);

    const { count: gameCount } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true });

    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalGames: gameCount || 0,
      totalStudents: studentCount || 0,
    });
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes on game_sessions for live updates
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openGame = () => {
    Linking.openURL('https://your-domain.com/game');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
    >
      {/* Welcome Header */}
      <View style={styles.welcomeHeader}>
        <Text style={styles.welcomeTitle}>Welcome{userName ? `, ${userName}` : ''}!</Text>
        <Text style={styles.welcomeSubtitle}>Ready to start a quiz?</Text>
      </View>

      {/* Start Game Card */}
      <TouchableOpacity onPress={openGame} style={styles.startGameCard}>
        <View>
          <Text style={styles.startGameTitle}>Start New Quiz</Text>
          <Text style={styles.startGameSubtitle}>Launch from your browser</Text>
        </View>
        <View style={styles.startGameIcons}>
          <Ionicons name="game-controller" size={28} color="#fff" />
          <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.6)" style={styles.iconMargin} />
        </View>
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardLeft]}>
          <View style={[styles.statIconBox, { backgroundColor: '#312e81' }]}>
            <Ionicons name="game-controller" size={20} color="#818cf8" />
          </View>
          <Text style={styles.statLabel}>Games</Text>
          <Text style={styles.statValue}>{stats.totalGames}</Text>
        </View>

        <View style={[styles.statCard, styles.statCardRight]}>
          <View style={[styles.statIconBox, { backgroundColor: '#064e3b' }]}>
            <Ionicons name="people" size={20} color="#34d399" />
          </View>
          <Text style={styles.statLabel}>Students</Text>
          <Text style={styles.statValue}>{stats.totalStudents}</Text>
        </View>
      </View>

      {/* Recent Games */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={18} color="#6b7280" />
          <Text style={styles.sectionTitle}>Recent Games</Text>
        </View>
        {recentGames.length > 0 ? recentGames.map(game => {
          // Handle Supabase join returning array or object
          const classData = Array.isArray(game.classes)
            ? game.classes[0]
            : game.classes;
          const className = classData?.name || 'Unknown Class';
          const classSection = classData?.section ? ` - ${classData.section}` : '';
          const subjectName = Array.isArray(game.subjects)
            ? game.subjects[0]?.name
            : game.subjects?.name;
          const gameDate = new Date(game.started_at);
          const formattedDate = gameDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const formattedTime = gameDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          return (
            <View key={game.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{className}{classSection}</Text>
                {subjectName && (
                  <Text style={styles.subjectText}>{subjectName}</Text>
                )}
                <Text style={styles.itemSubtitle}>{formattedDate} • {formattedTime}</Text>
                {game.topScorer && (
                  <View style={styles.topScorerRow}>
                    <Ionicons name="trophy" size={12} color="#facc15" />
                    <Text style={styles.topScorerText}>{game.topScorer.name} ({game.topScorer.points} pts)</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemScore}>{game.game_score || 0} pts</Text>
                <Text style={styles.itemSubtitle}>{game.total_questions || 0} questions</Text>
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <Ionicons name="game-controller-outline" size={32} color="#4b5563" />
            <Text style={styles.emptyText}>No games yet</Text>
          </View>
        )}
      </View>

      {/* Top Students */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy" size={18} color="#facc15" />
          <Text style={styles.sectionTitle}>Top Performers</Text>
        </View>
        {topStudents.length > 0 ? topStudents.map((student, idx) => (
          <View key={student.id} style={styles.studentItem}>
            <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? '#fef3c7' : idx === 1 ? '#e5e7eb' : idx === 2 ? '#fed7aa' : '#374151' }]}>
              <Text style={[styles.rankText, { color: idx === 0 ? '#b45309' : idx === 1 ? '#4b5563' : idx === 2 ? '#c2410c' : '#9ca3af' }]}>{idx + 1}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.full_name}</Text>
              <View style={styles.levelRow}>
                <Ionicons name="star" size={12} color="#facc15" />
                <Text style={styles.levelText}>Level {student.current_level || 1}</Text>
              </View>
            </View>
            <Text style={styles.pointsText}>{student.total_points || 0} pts</Text>
          </View>
        )) : (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={32} color="#4b5563" />
            <Text style={styles.emptyText}>No student data</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d24' },
  contentContainer: { padding: 16 },
  welcomeHeader: { marginBottom: 20 },
  welcomeTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  welcomeSubtitle: { color: '#818cf8', fontSize: 14, marginTop: 4 },
  startGameCard: { backgroundColor: '#059669', borderRadius: 16, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startGameTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  startGameSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  startGameIcons: { flexDirection: 'row', alignItems: 'center' },
  iconMargin: { marginLeft: 8 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16 },
  statCardLeft: { marginRight: 6 },
  statCardRight: { marginLeft: 6 },
  statIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statLabel: { color: '#6b7280', fontSize: 12 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sectionCard: { backgroundColor: '#1e1b4b', borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#312e81' },
  sectionTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  listItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#312e81', flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { color: '#fff', fontWeight: '500' },
  itemSubtitle: { color: '#6b7280', fontSize: 12 },
  itemRight: { alignItems: 'flex-end' },
  itemScore: { color: '#818cf8', fontWeight: 'bold' },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#6b7280', marginTop: 8 },
  studentItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#312e81', flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { fontWeight: 'bold', fontSize: 12 },
  studentInfo: { flex: 1 },
  studentName: { color: '#fff', fontWeight: '500' },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  levelText: { color: '#6b7280', fontSize: 12, marginLeft: 4 },
  pointsText: { color: '#34d399', fontWeight: 'bold' },
  subjectText: { color: '#818cf8', fontSize: 12, marginTop: 2 },
  topScorerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  topScorerText: { color: '#facc15', fontSize: 11, marginLeft: 4 },
});
