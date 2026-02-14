import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Alert, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

type Question = {
    id: string;
    content: string;
    type: string;
    options: string[] | null;
    correct_answer: string;
    points: number;
    difficulty: string;
    solution_text?: string | null;
    solution_image_url?: string | null;
    assigned_classes?: string[];
};

type ClassItem = { id: string; name: string; section: string };
type Subject = { id: string; name: string; class_id: string };
type Topic = { id: string; name: string; subject_id: string };
type Subtopic = { id: string; name: string; topic_id: string };

export default function QuestionsScreen() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    const [formContent, setFormContent] = useState('');
    const [formType, setFormType] = useState('mcq');
    const [formDifficulty, setFormDifficulty] = useState('medium');
    const [formPoints, setFormPoints] = useState('10');
    const [formCorrectAnswer, setFormCorrectAnswer] = useState('');
    const [formOptions, setFormOptions] = useState(['', '', '', '']);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [formSolutionText, setFormSolutionText] = useState('');
    const [solutionImageUri, setSolutionImageUri] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // AI Generation State
    const [generatingAI, setGeneratingAI] = useState(false);
    const [aiModel, setAiModel] = useState('gemini');

    // Category data for AI generation
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
    const [formSubject, setFormSubject] = useState('');
    const [formTopic, setFormTopic] = useState('');
    const [formSubtopic, setFormSubtopic] = useState('');

    const fetchData = async () => {
        const [questionsRes, classesRes, linksRes, subjectsRes, topicsRes, subtopicsRes] = await Promise.all([
            supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(50),
            supabase.from('classes').select('id, name, section'),
            supabase.from('question_class_links').select('question_id, class_id'),
            supabase.from('subjects').select('id, name, class_id'),
            supabase.from('topics').select('id, name, subject_id'),
            supabase.from('subtopics').select('id, name, topic_id')
        ]);

        if (classesRes.data) setClasses(classesRes.data);
        if (subjectsRes.data) setSubjects(subjectsRes.data);
        if (topicsRes.data) setTopics(topicsRes.data);
        if (subtopicsRes.data) setSubtopics(subtopicsRes.data);

        if (questionsRes.data && linksRes.data) {
            const linksMap: Record<string, string[]> = {};
            linksRes.data.forEach((link: { question_id: string; class_id: string }) => {
                if (!linksMap[link.question_id]) linksMap[link.question_id] = [];
                linksMap[link.question_id].push(link.class_id);
            });
            setQuestions(questionsRes.data.map(q => ({ ...q, assigned_classes: linksMap[q.id] || [] })));
        } else if (questionsRes.data) {
            setQuestions(questionsRes.data);
        }
    };

    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel('questions-realtime-app')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'question_class_links' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleDelete = async (questionId: string) => {
        Alert.alert(
            'Delete Question',
            'Are you sure you want to delete this question?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Delete class links first
                            await supabase
                                .from('question_class_links')
                                .delete()
                                .eq('question_id', questionId);

                            // Delete the question
                            const { error } = await supabase
                                .from('questions')
                                .delete()
                                .eq('id', questionId);

                            if (error) {
                                Alert.alert('Error', 'Failed to delete question');
                                console.error('Delete error:', error);
                            } else {
                                // Refresh list
                                fetchData();
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete question');
                            console.error('Delete error:', err);
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setFormContent('');
        setFormType('mcq');
        setFormDifficulty('medium');
        setFormPoints('10');
        setFormCorrectAnswer('');
        setFormOptions(['', '', '', '']);
        setSelectedClasses([]);
        setFormSolutionText('');
        setSolutionImageUri(null);
        setEditingQuestion(null);
        // Reset category selections
        setFormSubject('');
        setFormTopic('');
        setFormSubtopic('');
    };

    const openAddModal = () => { resetForm(); setModalVisible(true); };

    const openEditModal = (q: Question) => {
        setEditingQuestion(q);
        setFormContent(q.content);
        setFormType(q.type);
        setFormDifficulty(q.difficulty || 'medium');
        setFormPoints(String(q.points || 10));
        setFormCorrectAnswer(q.correct_answer);
        setFormOptions(q.options || ['', '', '', '']);
        setSelectedClasses(q.assigned_classes || []);
        setFormSolutionText(q.solution_text || '');
        setSolutionImageUri(q.solution_image_url || null);
        setModalVisible(true);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSolutionImageUri(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string): Promise<string | null> => {
        try {
            if (uri.startsWith('http')) return uri; // Already a URL

            const response = await fetch(uri);
            const blob = await response.blob();
            const fileExt = uri.split('.').pop();
            const fileName = `solution_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('question-images')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('question-images').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error) {
            console.error('Upload failed:', error);
            Alert.alert('Upload Failed', 'Could not upload image');
            return null;
        }
    };

    const handleSubmit = async () => {
        if (!formContent || !formCorrectAnswer) {
            Alert.alert('Error', 'Please fill in question and correct answer');
            return;
        }

        setUploading(true);
        try {
            let finalImageUrl = solutionImageUri;
            if (solutionImageUri && !solutionImageUri.startsWith('http')) {
                finalImageUrl = await uploadImage(solutionImageUri);
            }

            const questionData = {
                content: formContent,
                type: formType,
                difficulty: formDifficulty,
                points: parseInt(formPoints) || 10,
                correct_answer: formCorrectAnswer,
                options: formType === 'mcq' ? formOptions.filter(Boolean) : null,
                subtopic_id: formSubtopic || null,
                solution_text: formSolutionText || null,
                solution_image_url: finalImageUrl || null
            };

            let questionId = editingQuestion?.id;

            if (editingQuestion) {
                const { error } = await supabase.from('questions').update(questionData).eq('id', editingQuestion.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('questions').insert(questionData).select('id').single();
                if (error) throw error;
                questionId = data.id;
            }

            // Update class links
            if (questionId) {
                // Delete existing
                await supabase.from('question_class_links').delete().eq('question_id', questionId);

                // Insert new
                if (selectedClasses.length > 0) {
                    const links = selectedClasses.map(classId => ({
                        question_id: questionId,
                        class_id: classId
                    }));
                    await supabase.from('question_class_links').insert(links);
                }
            }

            setModalVisible(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    const toggleClass = (id: string) => {
        setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    // AI Generation Handler
    const handleGenerateAI = async () => {
        setGeneratingAI(true);
        try {
            // Get selected category names
            const selectedSubjectObj = subjects.find(s => s.id === formSubject);
            const selectedTopicObj = topics.find(t => t.id === formTopic);
            const selectedSubtopicObj = subtopics.find(st => st.id === formSubtopic);

            const subjectName = selectedSubjectObj?.name || 'General Knowledge';
            const topicName = selectedTopicObj?.name || 'General';
            const subtopicName = selectedSubtopicObj?.name || '';

            // Get the API base URL from environment
            const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.100:3000';

            const res = await fetch(`${apiUrl}/api/generate-question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subjectName,
                    topic: topicName,
                    subtopic: subtopicName,
                    difficulty: formDifficulty,
                    model: aiModel,
                    usePythonBackend: true
                })
            });

            if (res.ok) {
                const data = await res.json();
                const q = data.question;

                if (q) {
                    setFormContent(q.question || q.content || '');
                    if (q.options && Array.isArray(q.options)) {
                        setFormOptions(q.options.slice(0, 4));
                    }
                    setFormCorrectAnswer(q.correct_answer || q.answer || '');

                    if (q.is_duplicate) {
                        Alert.alert('Warning', `Similar question detected (${Math.round(q.similarity_score * 100)}% match). Please review.`);
                    }
                }
            } else {
                Alert.alert('Error', 'AI generation failed. Please try again.');
            }
        } catch (err) {
            console.error('AI generation failed:', err);
            Alert.alert('Error', 'AI generation failed. Check your network connection.');
        }
        setGeneratingAI(false);
    };

    // Filtered topics/subtopics based on selection
    const filteredTopics = formSubject ? topics.filter(t => t.subject_id === formSubject) : topics;
    const filteredSubtopics = formTopic ? subtopics.filter(st => st.topic_id === formTopic) : subtopics;

    const filteredQuestions = questions.filter(q => !searchQuery || q.content.toLowerCase().includes(searchQuery.toLowerCase()));

    const getDifficultyColor = (d: string) => {
        if (d === 'easy') return { bg: '#d1fae5', text: '#059669' };
        if (d === 'hard') return { bg: '#fee2e2', text: '#dc2626' };
        return { bg: '#fef3c7', text: '#d97706' };
    };

    // Difficulty label mapping to match web app
    const DIFFICULTY_LABELS: Record<string, string> = { easy: 'NCERT', medium: 'Foundation', hard: 'Advance' };
    const getDifficultyLabel = (d: string) => DIFFICULTY_LABELS[d] || 'Foundation';

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#6b7280" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search questions..."
                        placeholderTextColor="#6b7280"
                        style={styles.searchInput}
                    />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
            >
                {filteredQuestions.length > 0 ? filteredQuestions.map(q => {
                    const colors = getDifficultyColor(q.difficulty);
                    return (
                        <View key={q.id} style={styles.questionCard}>
                            <View style={styles.actions}>
                                <TouchableOpacity onPress={() => openEditModal(q)} style={styles.actionButton}>
                                    <Ionicons name="create-outline" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(q.id)} style={styles.actionButton}>
                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.questionText}>{q.content}</Text>
                            <View style={styles.badges}>
                                <View style={[styles.badge, { backgroundColor: q.type === 'mcq' ? '#dbeafe' : q.type === 'integer' ? '#fef3c7' : '#dcfce7' }]}>
                                    <Text style={[styles.badgeText, { color: q.type === 'mcq' ? '#2563eb' : q.type === 'integer' ? '#d97706' : '#16a34a' }]}>{q.type?.toUpperCase()}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                                    <Text style={[styles.badgeText, { color: colors.text }]}>{getDifficultyLabel(q.difficulty)}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: '#ede9fe' }]}>
                                    <Text style={[styles.badgeText, { color: '#7c3aed' }]}>{q.points} pts</Text>
                                </View>
                                {q.assigned_classes && q.assigned_classes.length > 0 && (
                                    <View style={[styles.badge, { backgroundColor: '#e0e7ff' }]}>
                                        <Text style={[styles.badgeText, { color: '#4338ca' }]}>{q.assigned_classes.length} Classes</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                }) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="help-circle-outline" size={48} color="#4b5563" />
                        <Text style={styles.emptyText}>No questions found</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity onPress={openAddModal} style={styles.fab}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingQuestion ? 'Edit Question' : 'Add Question'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {/* AI Generation Section */}
                            <View style={styles.aiSection}>
                                <View style={styles.aiRow}>
                                    {/* Model Selector */}
                                    <View style={styles.aiModelPicker}>
                                        {['gemini', 'openai', 'deepseek'].map((model) => (
                                            <TouchableOpacity
                                                key={model}
                                                onPress={() => setAiModel(model)}
                                                style={[styles.aiModelButton, aiModel === model && styles.aiModelButtonActive]}
                                            >
                                                <Text style={[styles.aiModelText, aiModel === model && styles.aiModelTextActive]}>
                                                    {model === 'gemini' ? 'Gemini' : model === 'openai' ? 'OpenAI' : 'DeepSeek'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {/* Generate Button */}
                                    <TouchableOpacity
                                        onPress={handleGenerateAI}
                                        disabled={generatingAI}
                                        style={[styles.aiButton, generatingAI && { opacity: 0.6 }]}
                                    >
                                        {generatingAI ? (
                                            <>
                                                <ActivityIndicator size="small" color="#fff" />
                                                <Text style={styles.aiButtonText}>Generating...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Ionicons name="sparkles" size={16} color="#fff" />
                                                <Text style={styles.aiButtonText}>Generate</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Category Selectors for AI */}
                            <View style={styles.categorySection}>
                                <Text style={styles.label}>Category (for AI)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                                    {subjects.slice(0, 8).map(sub => (
                                        <TouchableOpacity
                                            key={sub.id}
                                            onPress={() => { setFormSubject(sub.id); setFormTopic(''); setFormSubtopic(''); }}
                                            style={[styles.categoryChip, formSubject === sub.id && styles.categoryChipActive]}
                                        >
                                            <Text style={[styles.categoryChipText, formSubject === sub.id && styles.categoryChipTextActive]} numberOfLines={1}>
                                                {sub.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                {formSubject && filteredTopics.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.categoryScroll, { marginTop: 8 }]}>
                                        {filteredTopics.slice(0, 8).map(top => (
                                            <TouchableOpacity
                                                key={top.id}
                                                onPress={() => { setFormTopic(top.id); setFormSubtopic(''); }}
                                                style={[styles.categoryChip, formTopic === top.id && styles.categoryChipActive]}
                                            >
                                                <Text style={[styles.categoryChipText, formTopic === top.id && styles.categoryChipTextActive]} numberOfLines={1}>
                                                    {top.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                {formTopic && filteredSubtopics.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.categoryScroll, { marginTop: 8 }]}>
                                        {filteredSubtopics.slice(0, 8).map(st => (
                                            <TouchableOpacity
                                                key={st.id}
                                                onPress={() => setFormSubtopic(st.id)}
                                                style={[styles.categoryChip, formSubtopic === st.id && styles.categoryChipActive]}
                                            >
                                                <Text style={[styles.categoryChipText, formSubtopic === st.id && styles.categoryChipTextActive]} numberOfLines={1}>
                                                    {st.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            <Text style={styles.label}>Question</Text>
                            <TextInput value={formContent} onChangeText={setFormContent} placeholder="Enter question..." placeholderTextColor="#6b7280" multiline style={styles.textArea} />

                            <View style={styles.row}>
                                <View style={styles.halfColumn}>
                                    <Text style={styles.label}>Type</Text>
                                    <View style={styles.buttonGroup}>
                                        {['mcq', 'integer', 'subjective'].map((t, i) => (
                                            <TouchableOpacity key={t} onPress={() => setFormType(t)} style={[styles.groupButton, formType === t && styles.groupButtonActive, i === 0 && styles.groupButtonFirst]}>
                                                <Text style={[styles.groupButtonText, { fontSize: 10 }]}>{t.toUpperCase()}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.halfColumn}>
                                    <Text style={styles.label}>Points</Text>
                                    <TextInput value={formPoints} onChangeText={setFormPoints} keyboardType="numeric" style={styles.smallInput} />
                                </View>
                            </View>

                            <Text style={styles.label}>Difficulty</Text>
                            <View style={styles.difficultyPicker}>
                                {[
                                    { value: 'easy', label: 'NCERT', color: '#22c55e' },
                                    { value: 'medium', label: 'Foundation', color: '#f59e0b' },
                                    { value: 'hard', label: 'Advance', color: '#ef4444' }
                                ].map((d) => (
                                    <TouchableOpacity
                                        key={d.value}
                                        onPress={() => setFormDifficulty(d.value)}
                                        style={[styles.difficultyOption, formDifficulty === d.value && { backgroundColor: d.color + '30', borderColor: d.color }]}
                                    >
                                        <View style={[styles.difficultyDot, { backgroundColor: d.color }]} />
                                        <Text style={[styles.difficultyText, formDifficulty === d.value && { color: d.color, fontWeight: '600' }]}>{d.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Assign to Classes</Text>
                            <View style={[styles.buttonGroup, { flexWrap: 'wrap' }]}>
                                {classes.map(cls => (
                                    <TouchableOpacity
                                        key={cls.id}
                                        onPress={() => toggleClass(cls.id)}
                                        style={[styles.chip, selectedClasses.includes(cls.id) && styles.chipActive]}
                                    >
                                        <Text style={[styles.chipText, selectedClasses.includes(cls.id) && styles.chipTextActive]}>
                                            {cls.name} {cls.section}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Correct Answer</Text>
                            <TextInput value={formCorrectAnswer} onChangeText={setFormCorrectAnswer} placeholder="Enter correct answer..." placeholderTextColor="#6b7280" style={styles.input} />

                            {formType === 'mcq' && (
                                <>
                                    <Text style={styles.label}>Options (tap to set as correct)</Text>
                                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                                        <View key={letter} style={styles.optionRow}>
                                            <TouchableOpacity
                                                onPress={() => setFormCorrectAnswer(formOptions[i])}
                                                style={[styles.optionLetter, formCorrectAnswer === formOptions[i] && formOptions[i] && styles.optionLetterActive]}
                                            >
                                                <Text style={[styles.optionLetterText, formCorrectAnswer === formOptions[i] && formOptions[i] && styles.optionLetterTextActive]}>
                                                    {formCorrectAnswer === formOptions[i] && formOptions[i] ? '✓' : letter}
                                                </Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                value={formOptions[i]}
                                                onChangeText={(text) => { const newOptions = [...formOptions]; newOptions[i] = text; setFormOptions(newOptions); }}
                                                placeholder={`Option ${letter}`}
                                                placeholderTextColor="#6b7280"
                                                style={[styles.optionInput, formCorrectAnswer === formOptions[i] && formOptions[i] && styles.optionInputActive]}
                                            />
                                        </View>
                                    ))}
                                </>
                            )}

                            {/* Solution Section - for all question types */}
                            <View style={styles.solutionSection}>
                                <Text style={styles.label}>Solution (Optional)</Text>
                                <TextInput
                                    value={formSolutionText}
                                    onChangeText={setFormSolutionText}
                                    placeholder="Enter solution explanation..."
                                    placeholderTextColor="#6b7280"
                                    multiline
                                    style={[styles.textArea, { minHeight: 60 }]}
                                />

                                <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
                                    <Ionicons name="image-outline" size={20} color="#fff" />
                                    <Text style={styles.uploadButtonText}>{solutionImageUri ? 'Change Image' : 'Upload Solution Image'}</Text>
                                </TouchableOpacity>

                                {solutionImageUri && (
                                    <View style={styles.previewContainer}>
                                        <Image source={{ uri: solutionImageUri }} style={styles.previewImage} />
                                        <TouchableOpacity onPress={() => setSolutionImageUri(null)} style={styles.removeImageButton}>
                                            <Ionicons name="close-circle" size={24} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity onPress={handleSubmit} disabled={uploading} style={[styles.submitButton, uploading && { opacity: 0.7 }]}>
                                <Text style={styles.submitButtonText}>{uploading ? 'Saving...' : (editingQuestion ? 'Update Question' : 'Add Question')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0d24' },
    searchContainer: { padding: 16 },
    searchBox: { backgroundColor: '#1e1b4b', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    searchInput: { flex: 1, color: '#fff', paddingVertical: 14, paddingHorizontal: 12 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
    questionCard: { backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16, marginBottom: 12, position: 'relative' },
    questionText: { color: '#fff', fontSize: 15, marginBottom: 12, lineHeight: 22, paddingRight: 60 },
    questionFooter: { marginTop: 4 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#312e81' },
    badgeText: { fontSize: 11, fontWeight: '600' },
    actions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
    actionButton: { padding: 4 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#6b7280', marginTop: 12 },
    fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', elevation: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#312e81' },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    modalBody: { padding: 16 },
    label: { color: '#a5b4fc', marginBottom: 8 },
    textArea: { backgroundColor: '#312e81', color: '#fff', borderRadius: 8, padding: 12, minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
    input: { backgroundColor: '#312e81', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12 },
    smallInput: { backgroundColor: '#312e81', color: '#fff', borderRadius: 8, padding: 10, textAlign: 'center' },
    row: { flexDirection: 'row', marginBottom: 16 },
    halfColumn: { flex: 1, marginRight: 6 },
    buttonGroup: { flexDirection: 'row', marginBottom: 16 },
    groupButton: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#312e81', alignItems: 'center', marginLeft: 8 },
    groupButtonFirst: { marginLeft: 0 },
    groupButtonActive: { backgroundColor: '#4f46e5' },
    groupButtonText: { color: '#fff', fontSize: 12 },
    submitButton: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 32 },
    submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#312e81', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#4338ca' },
    chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    chipText: { color: '#a5b4fc', fontSize: 13 },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#312e81', padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#6366f1', marginTop: 8 },
    uploadButtonText: { color: '#fff', marginLeft: 8, fontSize: 14 },
    previewContainer: { marginTop: 16, position: 'relative', alignSelf: 'flex-start' },
    previewImage: { width: 200, height: 150, borderRadius: 12 },
    removeImageButton: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 12 },
    aiSection: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#312e81' },
    aiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    aiModelPicker: { flexDirection: 'row', flex: 1, gap: 4 },
    aiModelButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#312e81' },
    aiModelButtonActive: { backgroundColor: '#4f46e5' },
    aiModelText: { color: '#a5b4fc', fontSize: 11, fontWeight: '500' },
    aiModelTextActive: { color: '#fff' },
    aiButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7c3aed', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    aiButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    optionLetter: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' },
    optionLetterActive: { backgroundColor: '#22c55e' },
    optionLetterText: { color: '#a5b4fc', fontWeight: '700', fontSize: 14 },
    optionLetterTextActive: { color: '#fff' },
    optionInput: { flex: 1, backgroundColor: '#312e81', color: '#fff', borderRadius: 8, padding: 12 },
    optionInputActive: { borderWidth: 1, borderColor: '#22c55e' },
    solutionSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#312e81' },
    // Category selector styles
    categorySection: { marginBottom: 16 },
    categoryScroll: { flexDirection: 'row', marginBottom: 4 },
    categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#312e81', marginRight: 8, borderWidth: 1, borderColor: '#4338ca' },
    categoryChipActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
    categoryChipText: { color: '#a5b4fc', fontSize: 12 },
    categoryChipTextActive: { color: '#fff', fontWeight: '600' },
    // Difficulty picker styles
    difficultyPicker: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    difficultyOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#312e81', borderWidth: 1, borderColor: '#312e81' },
    difficultyDot: { width: 8, height: 8, borderRadius: 4 },
    difficultyText: { color: '#a5b4fc', fontSize: 12, fontWeight: '500' }
});
