import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Trash2, Upload, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Document } from '../types';

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    try {
      const data = await api.documents.list();
      setDocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // Poll for status updates every 3s while any doc is processing
    const interval = setInterval(() => {
      if (docs.some((d) => d.status === 'processing')) fetchDocs();
    }, 3000);
    return () => clearInterval(interval);
  }, [docs]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    try {
      await Promise.all(acceptedFiles.map((f) => api.documents.upload(f)));
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: true,
  });

  const handleDelete = async (id: string) => {
    await api.documents.delete(id);
    setDocs((prev) => prev.filter((d) => d._id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="font-semibold text-gray-100">Documents</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload docs to add them to the knowledge base
          </p>
        </div>
        <button
          onClick={fetchDocs}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-brand-500 bg-brand-600/10'
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30',
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-400" />
              <p className="text-sm">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Upload className="w-8 h-8" />
              <div>
                <p className="text-sm font-medium text-gray-300">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-xs mt-1">PDF, DOCX, TXT, MD · up to 20 MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Document list */}
        {loading ? (
          <div className="text-center text-gray-500 text-sm py-8">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-center text-gray-600 text-sm py-8">
            No documents yet — upload one above to get started.
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </h2>
            {docs.map((doc) => (
              <DocumentRow key={doc._id} doc={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentRow({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void }) {
  const statusIcon = {
    ready: <CheckCircle className="w-4 h-4 text-green-400" />,
    processing: <Clock className="w-4 h-4 text-amber-400 animate-pulse" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
  }[doc.status];

  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
      <FileText className="w-5 h-5 text-brand-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{doc.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {doc.fileType.toUpperCase()} · {doc.wordCount.toLocaleString()} words ·{' '}
          {new Date(doc.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span title={doc.status}>{statusIcon}</span>
        <button
          onClick={() => onDelete(doc._id)}
          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          title="Delete document"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
