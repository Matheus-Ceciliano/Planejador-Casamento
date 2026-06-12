import { Upload, X, File as FileIcon } from 'lucide-react';
import { DragEvent, useRef, useState } from 'react';
import { uploadWeddingFile } from '../../services/storage';
import { useWedding } from '../../hooks/useWedding';

export type AppFileUploadProps = {
  label?: string;
  hint?: string;
  error?: string;
  folder?: string;
  accept?: string;
  onUploaded: (url: string) => void;
  compact?: boolean;
};

export default function AppFileUpload({
  label,
  hint,
  error,
  folder,
  accept,
  onUploaded,
  compact = false,
}: AppFileUploadProps) {
  const { wedding } = useWedding();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const hasError = Boolean(error);

  async function handleFile(file?: File) {
    if (!file || !wedding || uploadingRef.current) return;
    uploadingRef.current = true;
    setLoading(true);
    setFileName(file.name);
    try {
      onUploaded(await uploadWeddingFile(wedding.id, file, folder));
    } finally {
      uploadingRef.current = false;
      setLoading(false);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  // Compact mode: simple button (for backwards compat with FileUpload)
  if (compact) {
    return (
      <label aria-busy={loading} className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#1F2937] transition ${loading ? 'pointer-events-none cursor-wait opacity-60' : 'cursor-pointer hover:border-[#E11D48] hover:text-[#E11D48]'}`}>
        <Upload size={15} />
        {loading ? 'Enviando...' : 'Anexar arquivo'}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          disabled={loading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
    );
  }

  return (
    <div className="block w-full">
      {label && <p className="field-label">{label}</p>}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={[
          'relative flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed',
          'transition-all duration-150',
          dragging
            ? 'border-[#E11D48] bg-[#FFF1F5] scale-[1.01]'
            : hasError
              ? 'border-[#EF4444] bg-white hover:border-[#EF4444]/70'
              : 'border-[#E5E7EB] bg-white hover:border-[#E11D48] hover:bg-[#FFF1F5]/50',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          disabled={loading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {loading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E11D48] border-t-transparent" />
            <p className="text-sm font-medium text-[#6B7280]">Enviando {fileName}…</p>
          </>
        ) : fileName ? (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E11D48]/10 text-[#E11D48]">
              <FileIcon size={20} />
            </span>
            <p className="max-w-[200px] truncate text-sm font-semibold text-[#1F2937]">{fileName}</p>
            <p className="text-xs text-[#22C55E] font-medium">Arquivo enviado ✓</p>
          </>
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9FAFB] text-[#9CA3AF] transition-colors group-hover:bg-[#E11D48]/10 group-hover:text-[#E11D48]">
              <Upload size={20} />
            </span>
            <p className="text-sm font-medium text-[#6B7280]">
              Arraste o arquivo ou <span className="font-semibold text-[#E11D48]">clique para selecionar</span>
            </p>
            {hint && <p className="text-xs text-[#9CA3AF]">{hint}</p>}
          </>
        )}
      </div>
      {hasError && (
        <p className="field-error-text">{error}</p>
      )}
    </div>
  );
}
