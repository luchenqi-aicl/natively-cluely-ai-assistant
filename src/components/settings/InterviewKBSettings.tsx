import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Upload, Trash2, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface KBDoc {
    id: string;
    filename: string;
    ingestedAt: string;
    chunkCount: number;
}

const InterviewKBSettings: React.FC = () => {
    const [docs, setDocs] = useState<KBDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadDocs = useCallback(async () => {
        try {
            const res = await window.electronAPI?.interviewKbList?.();
            setDocs(res?.docs ?? []);
        } catch {
            setDocs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDocs(); }, [loadDocs]);

    const handleUpload = async () => {
        setUploadStatus(null);
        try {
            const sel = await window.electronAPI?.interviewKbSelectFiles?.();
            if (!sel || sel.filePaths.length === 0) return;
            setUploading(true);
            const res = await window.electronAPI?.interviewKbUpload?.(sel.filePaths);
            const results = res?.results ?? [];
            const failed = results.filter(r => !r.success);
            const succeeded = results.filter(r => r.success);
            if (failed.length > 0) {
                setUploadStatus({ type: 'error', message: `${failed.length} file(s) failed: ${failed.map(f => f.filename).join(', ')}` });
            } else {
                setUploadStatus({ type: 'success', message: `Indexed ${succeeded.length} file(s) successfully.` });
            }
            await loadDocs();
        } catch (e: any) {
            setUploadStatus({ type: 'error', message: e?.message ?? 'Upload failed.' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId: string) => {
        setDeletingId(docId);
        try {
            await window.electronAPI?.interviewKbDelete?.(docId);
            setDocs(prev => prev.filter(d => d.id !== docId));
        } catch { /* ignore */ }
        setDeletingId(null);
    };

    const totalChunks = docs.reduce((sum, d) => sum + d.chunkCount, 0);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold text-text-primary">Interview Knowledge Base</h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Upload interview experience documents (PDF, TXT, MD). During interviews, the AI will
                    retrieve relevant passages to enrich its hints.
                </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                    <BookOpen size={12} />
                    <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <FileText size={12} />
                    <span>{totalChunks} chunk{totalChunks !== 1 ? 's' : ''} indexed</span>
                </div>
            </div>

            {/* Upload button */}
            <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Indexing…' : 'Upload Documents'}
            </button>

            {/* Upload status */}
            {uploadStatus && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${uploadStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {uploadStatus.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                    {uploadStatus.message}
                </div>
            )}

            {/* Document list */}
            {loading ? (
                <div className="flex items-center gap-2 text-xs text-text-secondary py-4">
                    <Loader2 size={12} className="animate-spin" />
                    Loading…
                </div>
            ) : docs.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-secondary border border-dashed border-border-subtle rounded-xl">
                    No documents indexed yet. Upload PDF, TXT, or MD files to get started.
                </div>
            ) : (
                <div className="space-y-2">
                    {docs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-item-surface border border-border-subtle">
                            <FileText size={14} className="text-text-secondary shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary truncate">{doc.filename}</p>
                                <p className="text-[10px] text-text-secondary">
                                    {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''} · {new Date(doc.ingestedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 disabled:opacity-40"
                                title="Remove document"
                            >
                                {deletingId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InterviewKBSettings;
