import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Target, Zap, GitBranch } from 'lucide-react';

// ── Types (mirror DebriefGenerator.ts, no import across Electron boundary) ──

interface QuestionDebriefScore {
    star: number;
    jdAlignment: number;
    specificity: number;
    careerPivot?: number;
}

interface QuestionDebrief {
    question: string;
    hintSummary: string;
    scores: QuestionDebriefScore;
    improvements: string[];
}

export interface DebriefReport {
    sessionDate: string;
    interviewType: string;
    questions: QuestionDebrief[];
}

interface DebriefReportPanelProps {
    report: DebriefReport;
    onClose: () => void;
}

// ── Score badge ───────────────────────────────────────────────────────────────

const ScoreBadge: React.FC<{ label: string; score: number; icon: React.ReactNode }> = ({ label, score, icon }) => {
    const color =
        score >= 4 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
        score === 3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                     'bg-red-500/15 text-red-400 border-red-500/30';

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${color}`}>
            <span className="opacity-80">{icon}</span>
            <span>{label}</span>
            <span className="font-bold">{score}/5</span>
        </div>
    );
};

// ── Average calculation ───────────────────────────────────────────────────────

function avg(scores: number[]): string {
    if (scores.length === 0) return '—';
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function computeAverages(questions: QuestionDebrief[]) {
    const star = questions.map(q => q.scores.star);
    const jd = questions.map(q => q.scores.jdAlignment);
    const spec = questions.map(q => q.scores.specificity);
    const pivot = questions.filter(q => q.scores.careerPivot != null).map(q => q.scores.careerPivot!);
    return { star: avg(star), jdAlignment: avg(jd), specificity: avg(spec), careerPivot: pivot.length > 0 ? avg(pivot) : null };
}

// ── Main component ────────────────────────────────────────────────────────────

const DebriefReportPanel: React.FC<DebriefReportPanelProps> = ({ report, onClose }) => {
    const averages = computeAverages(report.questions);
    const date = new Date(report.sessionDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const interviewTypeLabel = report.interviewType.charAt(0).toUpperCase() + report.interviewType.slice(1);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                className="relative bg-bg-base border border-border-subtle rounded-2xl shadow-2xl w-[640px] max-h-[88vh] flex flex-col"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border-subtle shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary">Interview Debrief</h2>
                        <p className="text-xs text-text-secondary mt-0.5">{date} · {interviewTypeLabel} · {report.questions.length} question{report.questions.length !== 1 ? 's' : ''}</p>
                        {/* Average score chips */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-subtle text-[11px] text-text-secondary">
                                <TrendingUp size={11} /> STAR avg: <strong className="text-text-primary ml-0.5">{averages.star}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-subtle text-[11px] text-text-secondary">
                                <Target size={11} /> JD avg: <strong className="text-text-primary ml-0.5">{averages.jdAlignment}</strong>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-subtle text-[11px] text-text-secondary">
                                <Zap size={11} /> Specificity avg: <strong className="text-text-primary ml-0.5">{averages.specificity}</strong>
                            </div>
                            {averages.careerPivot && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-subtle text-[11px] text-text-secondary">
                                    <GitBranch size={11} /> Pivot avg: <strong className="text-text-primary ml-0.5">{averages.careerPivot}</strong>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors shrink-0 mt-1"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Question list */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {report.questions.length === 0 && (
                        <p className="text-sm text-text-secondary text-center py-8">No questions recorded this session.</p>
                    )}
                    {report.questions.map((q, i) => (
                        <div key={i} className="bg-bg-item-surface rounded-xl border border-border-subtle p-4 space-y-3">
                            {/* Question */}
                            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Q{i + 1}</div>
                            <p className="text-sm font-medium text-text-primary leading-snug">{q.question}</p>

                            {/* Hint summary */}
                            <p className="text-xs text-text-secondary leading-relaxed">{q.hintSummary}</p>

                            {/* Score badges */}
                            <div className="flex flex-wrap gap-2">
                                <ScoreBadge label="STAR" score={q.scores.star} icon={<TrendingUp size={10} />} />
                                <ScoreBadge label="JD Alignment" score={q.scores.jdAlignment} icon={<Target size={10} />} />
                                <ScoreBadge label="Specificity" score={q.scores.specificity} icon={<Zap size={10} />} />
                                {q.scores.careerPivot != null && (
                                    <ScoreBadge label="Career Pivot" score={q.scores.careerPivot} icon={<GitBranch size={10} />} />
                                )}
                            </div>

                            {/* Improvements */}
                            {q.improvements.length > 0 && (
                                <div className="space-y-1.5 border-t border-border-subtle pt-3">
                                    <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">To improve</p>
                                    {q.improvements.map((imp, j) => (
                                        <div key={j} className="flex items-start gap-2 text-xs text-text-secondary">
                                            <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
                                            <span>{imp}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-subtle shrink-0 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors"
                    >
                        Done
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default DebriefReportPanel;
