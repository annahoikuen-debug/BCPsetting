'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/EmptyState';
import { BookOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../hooks/useSSE';
import { useAutoSave } from '../hooks/useAutoSave';
import { WebtoonViewer } from '../components/WebtoonViewer';
import { CanvasEditor } from '../components/CanvasEditor';
import { ScenarioWizard } from '../components/ScenarioWizard';
import { ProgressPanel, PanelStatus } from '../components/ProgressPanel';
import { Button } from '../components/ui/button';
import { useAPIKey } from '@/context/APIKeyContext';
import { useToast } from '@/components/ui/toast-context';
import { APIKeyModal } from '@/components/ui/APIKeyModal';
import apiClient from '@/lib/api-client';

const getAbsoluteUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBaseUrl}${cleanUrl}`;
};

interface WebtoonPanel {
    panel: number;
    image_url?: string;
    effect?: string;
    emotion?: string;
    dialogue: string;
    audio_url?: string;
    bgm_url?: string;
    evaluation_reason?: string;
}



export default function Home() {
    const { apiKey, isApiKeySet, setApiKey } = useAPIKey();
    const { addToast } = useToast();
    const [showApiKeyModal, setShowApiKeyModal] = useState(!isApiKeySet);
    const queryClient = useQueryClient();
    const [plot, setPlot] = useState('');
    const [style, setStyle] = useState('webtoon');
    const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
    interface CharacterConfig {
        name: string;
        description: string;
    }
    const [characters, setCharacters] = useState<CharacterConfig[]>([{ name: '', description: '' }]);
    const [webtoon, setWebtoon] = useState<WebtoonPanel[]>([]);
    const [loading, setLoading] = useState(false);
    const [panelStatuses, setPanelStatuses] = useState<Record<number, PanelStatus>>({});
    const [error, setError] = useState('');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [canResume, setCanResume] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showWizard, setShowWizard] = useState(true);
    const [activePanelIndex, setActivePanelIndex] = useState<number | null>(null);

    useAutoSave(taskId, webtoon, isEditMode);

    // --- Undo/Redo State ---
    const [history, setHistory] = useState<WebtoonPanel[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const saveToHistory = useCallback((newWebtoon: WebtoonPanel[]) => {
        setHistory(prev => {
            const nextHistory = prev.slice(0, historyIndex + 1);
            return [...nextHistory, JSON.parse(JSON.stringify(newWebtoon))];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setWebtoon(history[prevIndex]);
            setHistoryIndex(prevIndex);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setWebtoon(history[nextIndex]);
            setHistoryIndex(nextIndex);
        }
    }, [history, historyIndex]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!loading) generateMutation.mutate();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                setIsEditMode(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, loading]);

    const { progress, currentStep } = useSSE(taskId, {
        onPanelComplete: (panelIndex, result) => {
            setWebtoon((prev) => {
                const filtered = prev.filter((p) => p.panel !== result.panel);
                const updated = [...filtered, result].sort((a, b) => a.panel - b.panel);
                return updated;
            });
            setPanelStatuses(prev => ({
                ...prev,
                [result.panel]: {
                    status: 'completed',
                    step: 'composite',
                    message: '完了'
                }
            }));
        },
        onPanelFailed: (panelIndex, panelError) => {
            console.error(`コマ ${panelIndex + 1} の生成に失敗しました:`, panelError);
            setPanelStatuses(prev => ({
                ...prev,
                [panelIndex + 1]: {
                    status: 'failed',
                    step: 'composite',
                    message: 'エラー発生',
                    error: panelError
                }
            }));
        },
        onComplete: () => {
            setLoading(false);
            setTaskId(null);
            setCanResume(false);
        },
        onError: (errMessage) => {
            setError(`エラーが発生しました: ${errMessage}`);
            setLoading(false);
            setCanResume(true);
        },
        onStepUpdate: (event) => {
            if (event.panel) {
                setPanelStatuses(prev => ({
                    ...prev,
                    [event.panel]: {
                        status: event.status || 'processing',
                        step: event.step || 'idle',
                        message: event.message || '処理中...'
                    }
                }));
            }
        }
    });

    // Mutations using React Query
    const generateMutation = useMutation({
        mutationFn: async () => {
            if (!plot) throw new Error('あらすじを入力してください');
            
            const response = await apiClient.post('/generate-webtoon', {
                plot: plot,
                style: style,
                characters: characters.filter(c => c.name),
            });
            return response;
        },
        onMutate: () => {
            setLoading(true);
            setError('');
            setWebtoon([]);
            setCanResume(false);
            setShowWizard(false);
        },
        onSuccess: (data) => {
            setTaskId((data as any)?.task_id);
        },
        onError: (err: any) => {
            if (err.response?.status === 429) {
                addToast('生成が集中しています。しばらく待ってから再試行してください。', 'error');
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                setShowApiKeyModal(true);
            }
            
            const serverError = err.response?.data;
            if (serverError && serverError.detail) {
                setError(serverError.detail);
            } else {
                setError(err.message || 'リクエストの送信に失敗しました。');
            }
            
            setLoading(false);
            setShowWizard(true);
        }
    });

    const resumeMutation = useMutation({
        mutationFn: async () => {
            if (!taskId) throw new Error('タスクIDが見つかりません');
            await apiClient.post(`/resume/${taskId}`, {});
        },
        onMutate: () => {
            setLoading(true);
            setError('');
            setCanResume(false);
        },
        onSuccess: () => {
            const currentId = taskId;
            setTaskId(null);
            setTimeout(() => setTaskId(currentId), 100);
        },
        onError: () => {
            setError('再開処理の送信に失敗しました。');
            setLoading(false);
            setCanResume(true);
        }
    });

    const handleGenerate = () => generateMutation.mutate();
    const handleResume = () => resumeMutation.mutate();

    const handleRegeneratePanel = async (index: number, customPrompt: string, regenType: string = 'all') => {
        if (!taskId) return;
        try {
            const response = await apiClient.post('/regenerate-panel', {
                task_id: taskId,
                panel_index: index,
                custom_prompt: customPrompt,
                regen_type: regenType
            });
            addToast(`${regenType === 'director' ? 'AI Directorによる再選定' : '再生成'}リクエストを送信しました。`, 'success');
        } catch (err) {
            console.error('Regeneration error:', err);
            setError('再生成に失敗しました');
        }
    };

    const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});

    const handleUpdateDialogue = (index: number, dialogue: string) => {
        if (!taskId) return;
        setActivePanelIndex(index);

        setWebtoon(prev => {
            const next = prev.map((p, i) => i === index ? { ...p, dialogue } : p);
            return next;
        });

        if (debounceTimers.current[index]) {
            clearTimeout(debounceTimers.current[index]);
        }

        debounceTimers.current[index] = setTimeout(async () => {
            try {
                const response = await apiClient.patch('/update-dialogue', {
                    task_id: taskId,
                    panel_index: index,
                    new_dialogue: dialogue
                });
                saveToHistory(webtoon.map((p, i) => i === index ? { ...p, dialogue } : p));
            } catch (err) {
                console.error('Dialogue auto-save failed:', err);
            }
        }, 800);
    };

    const handleUpdateEffect = async (index: number, effect: string, emotion?: string) => {
        if (!taskId) return;
        setActivePanelIndex(index);
        try {
            const response = await apiClient.patch('/update-panel-effect', {
                task_id: taskId,
                panel_index: index,
                effect,
                emotion
            });

            const nextWebtoon = webtoon.map((p, i) => i === index ? { ...p, effect, emotion: emotion || p.emotion } : p);
            setWebtoon(nextWebtoon);
            saveToHistory(nextWebtoon);
        } catch (err) {
            setError('演出の更新に失敗しました');
        }
    };

    return (
        <>
        <motion.main 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-background text-foreground transition-colors duration-300"
        >
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
                {isEditMode && webtoon.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="flex flex-col gap-2 glass-card p-3 rounded-2xl shadow-2xl border border-white/10"
                    >
                        <div className="text-[10px] font-bold text-primary px-2 mb-1 uppercase tracking-wider text-center">Quick Actions</div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="text-xs h-10 px-4 rounded-xl hover:bg-white/10 transition-colors"
                                onClick={undo}
                                disabled={historyIndex <= 0}
                            >
                                ↩️ Undo
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-xs h-10 px-4 rounded-xl hover:bg-white/10 transition-colors"
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                            >
                                ↪️ Redo
                            </Button>
                        </div>
                        <div className="h-px bg-white/10 my-1" />
                        <Button
                            variant="outline"
                            className="text-xs h-10 px-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg text-white font-bold"
                            onClick={() => { if(!loading) handleGenerate(); }}
                            disabled={loading}
                        >
                            ✨ 再生成 (Ctrl+S)
                        </Button>
                    </motion.div>
                )}

                <div className="flex items-center gap-3 glass-card p-2 rounded-full shadow-2xl border border-white/10">
                    <div className="flex bg-black/20 p-1 rounded-full border border-white/5">
                        <button
                            onClick={() => setMode('easy')}
                            className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-300 ${mode === 'easy' ? 'bg-primary text-white shadow-lg scale-105' : 'text-muted-foreground hover:text-white'}`}
                        >
                            🔰 簡単
                        </button>
                        <button
                            onClick={() => setMode('advanced')}
                            className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-300 ${mode === 'advanced' ? 'bg-primary text-white shadow-lg scale-105' : 'text-muted-foreground hover:text-white'}`}
                        >
                            ⚙️ 詳細
                        </button>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mr-2">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isEditMode}
                            onChange={() => setIsEditMode(!isEditMode)}
                        />
                        <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                        <span className="ml-2 text-sm font-bold text-white">編集モード</span>
                    </label>
                </div>
            </div>

            <div className="w-full max-w-2xl mt-8 md:mt-16">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12 shadow-card p-6 rounded-lg bg-card"
                >
                    <h1 className="text-4xl font-black mb-4 text-gray-900 dark:text-zinc-100 tracking-tight">Rich Webtoon Generator</h1>
                    <p className="text-lg text-gray-600 dark:text-zinc-400">あらすじから没入型のWebtoonを自動生成</p>
                </motion.div>

                {loading ? (
                    <ProgressPanel
                        progress={progress}
                        currentStep={currentStep}
                        panelStatuses={panelStatuses}
                        canResume={canResume}
                        onResume={handleResume}
                    />
                ) : (
                    <ScenarioWizard
                        plot={plot} setPlot={setPlot}
                        style={style} setStyle={setStyle}
                        characters={characters} setCharacters={setCharacters}
                        onComplete={handleGenerate}
                        mode={mode}
                    />
                )}

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex flex-col items-center gap-2"
                    >
                        <div className="flex items-center gap-2 text-destructive font-bold">
                            <span>⚠️</span>
                            <span>エラーが発生しました</span>
                        </div>
                        <p className="text-sm text-destructive/80 text-center leading-relaxed">
                            {error}
                        </p>
                        {canResume && (
                            <button
                                onClick={handleResume}
                                className="mt-2 px-4 py-2 bg-destructive text-white rounded-lg text-xs font-bold hover:bg-destructive/90 transition-all"
                            >
                                再試行して復旧する
                            </button>
                        )}
                    </motion.div>
                )}

                {webtoon.length === 0 && !loading && (
                    <EmptyState 
                        title="まだ作品がありません" 
                        description="あらすじを入力して、新しいWebtoonの生成を始めましょう！" 
                        icon={<BookOpen className="h-8 w-8" />}
                    />
                )}
                {webtoon.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-12"
                    >
                        {isEditMode ? (
                            <CanvasEditor 
                                panels={webtoon} 
                                onReorder={(newPanels) => setWebtoon(newPanels)} 
                                onRegenerate={(index) => {
                                    const promptText = prompt(`コマ ${webtoon[index].panel} の再生成用プロンプトを入力してください:`);
                                    handleRegeneratePanel(index, promptText || "");
                                }}
                            />
                        ) : (
                            <WebtoonViewer
                                panels={webtoon}
                                panelStatuses={panelStatuses}
                                activePanelIndex={activePanelIndex}
                                isEditMode={isEditMode}
                                onRegeneratePanel={handleRegeneratePanel}
                                onUpdateDialogue={handleUpdateDialogue}
                                onUpdateEffect={handleUpdateEffect}
                                getAbsoluteUrl={getAbsoluteUrl}
                            />
                        )}
                    </motion.div>
                )}
            </div>
        </motion.main>
        <APIKeyModal
            isOpen={showApiKeyModal}
            onClose={() => setShowApiKeyModal(false)}
        />
        </>
    );
}
