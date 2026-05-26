import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ModelOption {
    id: string;
    name: string;
    desc: string;
}

const REALTIME_MODELS: ModelOption[] = [
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', desc: 'Fastest • Low latency' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Balanced quality' },
];

const NON_REALTIME_MODELS: ModelOption[] = [
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', desc: 'Highest quality' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Balanced quality' },
];

const ModelSelect: React.FC<{
    value: string;
    options: ModelOption[];
    onChange: (id: string) => void;
}> = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-52 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
            >
                <span className="truncate">{selected ? selected.name : 'Select model'}</span>
                <ChevronDown size={14} className={`text-text-secondary transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 animated fadeIn">
                    <div className="p-1 space-y-0.5">
                        {options.map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => { onChange(opt.id); setOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-md flex items-start justify-between gap-2 transition-colors ${value === opt.id ? 'bg-bg-input text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                            >
                                <div>
                                    <div className="text-sm font-medium">{opt.name}</div>
                                    <div className="text-xs text-text-secondary mt-0.5">{opt.desc}</div>
                                </div>
                                {value === opt.id && <Check size={14} className="text-accent-primary shrink-0 mt-1" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const InterviewCopilotSettings: React.FC = () => {
    const [realtimeModel, setRealtimeModel] = useState('claude-haiku-4-5-20251001');
    const [nonRealtimeModel, setNonRealtimeModel] = useState('claude-opus-4-7');

    useEffect(() => {
        window.electronAPI?.interviewGetModels?.().then(({ realtimeModel: rt, nonRealtimeModel: nrt }) => {
            setRealtimeModel(rt);
            setNonRealtimeModel(nrt);
        }).catch(() => {});
    }, []);

    const handleRealtimeChange = (model: string) => {
        setRealtimeModel(model);
        window.electronAPI?.interviewSetRealtimeModel?.(model).catch(() => {});
    };

    const handleNonRealtimeChange = (model: string) => {
        setNonRealtimeModel(model);
        window.electronAPI?.interviewSetNonRealtimeModel?.(model).catch(() => {});
    };

    return (
        <div className="space-y-6 animated fadeIn">
            <div className="space-y-3.5">
                {/* Realtime hint model */}
                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 mr-4">
                            <h3 className="text-sm font-semibold text-text-primary">Realtime Hint Model</h3>
                            <p className="text-xs text-text-secondary">
                                Used by AnswerLLM during the interview. Prioritise low latency.
                            </p>
                        </div>
                        <ModelSelect
                            value={realtimeModel}
                            options={REALTIME_MODELS}
                            onChange={handleRealtimeChange}
                        />
                    </div>
                </div>

                {/* Non-realtime model */}
                <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 mr-4">
                            <h3 className="text-sm font-semibold text-text-primary">Non-Realtime Model</h3>
                            <p className="text-xs text-text-secondary">
                                Used by ResumeJDParser and DebriefGenerator. Higher quality, called once per session.
                            </p>
                        </div>
                        <ModelSelect
                            value={nonRealtimeModel}
                            options={NON_REALTIME_MODELS}
                            onChange={handleNonRealtimeChange}
                        />
                    </div>
                </div>

                <p className="text-xs text-text-secondary px-1">
                    Both models use your Claude API key from AI Providers. Changes take effect on the next trigger.
                </p>
            </div>
        </div>
    );
};

export default InterviewCopilotSettings;
