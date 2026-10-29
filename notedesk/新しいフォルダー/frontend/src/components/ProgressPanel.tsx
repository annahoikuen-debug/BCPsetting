'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export interface PanelStatus {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    step: 'scenario' | 'image' | 'bgm' | 'voice' | 'composite' | 'idle';
    message: string;
    error?: string;
}

interface ProgressPanelProps {
    progress: number;
    currentStep: string;
    panelStatuses: Record<number, PanelStatus>;
    canResume: boolean;
    onResume: () => void;
}

export const ProgressPanel = ({
    progress,
    currentStep,
    panelStatuses,
    canResume,
    onResume,
}: ProgressPanelProps) => {
    return (
        <div className="glass-card p-8 rounded-3xl border border-white/10 w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <div className="flex flex-col items-center justify-center mb-6">
                <div className="flex items-center mb-3">
                    <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 text-2xl tracking-tight">AI処理中... ({progress}%)</span>
                </div>
                <p className="text-sm text-muted-foreground text-center">最高のアートワークを作成しています。少々お待ちください...</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((pNum) => {
                    const status = panelStatuses[pNum] || { status: 'pending', step: 'idle', message: '待機中' };
                    return (
                        <div key={pNum} className={`p-4 rounded-2xl border transition-all duration-500 ${status.status === 'completed' ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]' :
                            status.status === 'processing' ? 'glass border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse' :
                                status.status === 'failed' ? 'bg-red-500/10 border-red-500/30' : 'bg-black/20 border-white/5'
                            }`}>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Panel {pNum}</div>
                            <div className={`text-xs font-bold ${status.status === 'completed' ? 'text-green-400' :
                                status.status === 'processing' ? 'text-blue-400' :
                                    status.status === 'failed' ? 'text-red-400' : 'text-muted-foreground'
                                }`}>
                                {status.status === 'processing' ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {status.step === 'scenario' ? '脚本策定中' :
                                         status.step === 'image' ? '画像生成中' :
                                         (status.step as string) === 'image' ? 'AI評価中' :
                                         `${status.step}...`}
                                    </span>
                                ) : status.message || status.step}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-center text-sm text-primary font-medium italic mb-4">{currentStep}</p>
            <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden relative shadow-inner">
                <motion.div
                    className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-full relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{
                        type: "spring",
                        stiffness: 100,
                        damping: 15,
                        duration: 0.8
                    }}
                >
                    <motion.div
                        className="absolute top-0 right-0 w-8 h-full bg-white/50 blur-[4px]"
                        animate={{ x: [0, 40, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                </motion.div>
            </div>

            {canResume && (
                <button
                    onClick={onResume}
                    className="mt-3 w-full py-3 rounded-xl font-bold text-md transition-all shadow-md bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.98]"
                >
                    ⚡ 失敗した部分から再開する
                </button>
            )}
        </div>
    );
};
