import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Loader2, ChevronDown, Check, AlertCircle } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const INTERVIEW_TYPES = [
    { id: 'behavioral', label: 'Behavioral' },
    { id: 'technical', label: 'Technical' },
    { id: 'hr', label: 'HR / Culture Fit' },
    { id: 'comprehensive', label: 'Comprehensive' },
];

const STT_LANGUAGES = [
    { code: 'auto', label: 'Auto Detect' },
    { code: 'english', label: 'English' },
    { code: 'chinese', label: 'Chinese (Simplified)' },
    { code: 'japanese', label: 'Japanese' },
    { code: 'korean', label: 'Korean' },
    { code: 'french', label: 'French' },
    { code: 'german', label: 'German' },
    { code: 'spanish', label: 'Spanish' },
];

const HINT_LANGUAGES = [
    { code: 'Chinese', label: '中文 (Chinese)' },
    { code: 'English', label: 'English' },
    { code: 'Japanese', label: 'Japanese' },
    { code: 'Korean', label: 'Korean' },
    { code: 'French', label: 'French' },
    { code: 'German', label: 'German' },
    { code: 'Spanish', label: 'Spanish' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const SimpleSelect: React.FC<{
    value: string;
    options: { code: string; label: string }[];
    onChange: (code: string) => void;
    className?: string;
}> = ({ value, options, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.code === value);

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
            >
                <span>{selected?.label ?? value}</span>
                <ChevronDown size={14} className={`text-text-secondary shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
                    >
                        <div className="p-1 space-y-0.5">
                            {options.map(opt => (
                                <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() => { onChange(opt.code); setOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center justify-between transition-colors ${value === opt.code ? 'bg-bg-input text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                >
                                    {opt.label}
                                    {value === opt.code && <Check size={13} className="text-accent-primary shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface PreInterviewSetupPanelProps {
    onDone: () => void;   // called after successful parse; caller then starts the meeting
    onCancel: () => void;
}

const PreInterviewSetupPanel: React.FC<PreInterviewSetupPanelProps> = ({ onDone, onCancel }) => {
    const [resumeFilePath, setResumeFilePath] = useState<string | null>(null);
    const [resumeFilename, setResumeFilename] = useState<string | null>(null);
    const [jdText, setJdText] = useState('');
    const [interviewType, setInterviewType] = useState('behavioral');
    const [sttLanguage, setSttLanguage] = useState('auto');
    const [hintLanguage, setHintLanguage] = useState('Chinese');
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = !!resumeFilePath && jdText.trim().length > 0 && !isParsing;

    const handleSelectResume = async () => {
        setError(null);
        const result = await window.electronAPI.interviewSelectResume();
        if (result.cancelled) return;
        if (result.error) { setError(result.error); return; }
        setResumeFilePath(result.filePath!);
        setResumeFilename(result.filename!);
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsParsing(true);
        setError(null);
        try {
            const result = await window.electronAPI.interviewParseResume({
                filePath: resumeFilePath!,
                jdText,
                interviewType,
                sttLanguage,
                hintLanguage,
            });
            if (!result.success) {
                setError(result.error ?? 'Failed to parse resume. Please try again.');
                return;
            }
            onDone();
        } catch (e: any) {
            setError(e.message ?? 'Unexpected error during parsing.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf' && ext !== 'docx') {
            setError('Only PDF and DOCX files are supported.');
            return;
        }
        // Drag-drop gives us a File object; we need the file path (Electron exposes it via .path)
        const filePath = (file as any).path as string | undefined;
        if (!filePath) { setError('Could not read file path. Use the file picker instead.'); return; }
        setResumeFilePath(filePath);
        setResumeFilename(file.name);
        setError(null);
    }, []);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <motion.div
                className="relative bg-bg-base border border-border-subtle rounded-2xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto p-6 space-y-5"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary">Interview Setup</h2>
                        <p className="text-xs text-text-secondary mt-0.5">Upload your resume + JD to prepare AI hints</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Resume upload */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Resume *</label>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={handleSelectResume}
                        className="border-2 border-dashed border-border-subtle rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-colors"
                    >
                        {resumeFilename ? (
                            <div className="flex items-center gap-2 text-text-primary">
                                <FileText size={18} className="text-accent-primary shrink-0" />
                                <span className="text-sm font-medium truncate max-w-xs">{resumeFilename}</span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setResumeFilePath(null); setResumeFilename(null); }}
                                    className="p-0.5 rounded text-text-secondary hover:text-red-400 transition-colors shrink-0"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload size={22} className="text-text-secondary" />
                                <p className="text-sm text-text-secondary text-center">
                                    <span className="text-accent-primary font-medium">Click to upload</span> or drag & drop
                                </p>
                                <p className="text-xs text-text-secondary">PDF or DOCX</p>
                            </>
                        )}
                    </div>
                </div>

                {/* JD text */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Job Description *</label>
                    <textarea
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        placeholder="Paste the full job description here…"
                        rows={5}
                        className="w-full bg-bg-input border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary resize-none focus:outline-none focus:border-accent-primary transition-colors"
                    />
                </div>

                {/* Interview type */}
                <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Interview Type</label>
                    <div className="grid grid-cols-4 gap-2">
                        {INTERVIEW_TYPES.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setInterviewType(t.id)}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${interviewType === t.id ? 'bg-accent-primary/15 border-accent-primary text-accent-primary' : 'border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language selectors */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Interviewer Language</label>
                        <SimpleSelect value={sttLanguage} options={STT_LANGUAGES} onChange={setSttLanguage} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Hint Language</label>
                        <SimpleSelect value={hintLanguage} options={HINT_LANGUAGES} onChange={setHintLanguage} />
                    </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                        >
                            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-item-active/50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isParsing ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Parsing…
                            </>
                        ) : (
                            'Parse & Start'
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PreInterviewSetupPanel;
