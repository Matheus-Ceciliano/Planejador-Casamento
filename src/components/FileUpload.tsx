import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadWeddingFile } from '../services/storage';
import { useWedding } from '../hooks/useWedding';

export default function FileUpload({ folder, onUploaded, compact = false, label }: { folder?: string; onUploaded: (url: string) => void; compact?: boolean; label?: string }) {
  const { wedding } = useWedding();
  const [loading, setLoading] = useState(false);
  const uploadingRef = useRef(false);

  async function handleFile(file?: File) {
    if (!file || !wedding || uploadingRef.current) return;
    uploadingRef.current = true;
    setLoading(true);
    try {
      onUploaded(await uploadWeddingFile(wedding.id, file, folder));
    } finally {
      uploadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <label aria-busy={loading} className={`${loading ? 'pointer-events-none cursor-wait opacity-60' : ''} ${compact ? 'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E7E0D8] bg-white px-2.5 text-xs font-medium text-[#2D2A26] transition hover:border-[#B76E79] hover:bg-[#FAF8F5]' : 'btn-secondary cursor-pointer'}`}>
      <Upload size={16} />
      {loading ? 'Enviando...' : label ?? 'Anexar arquivo'}
      <input className="hidden" type="file" disabled={loading} onChange={(event) => handleFile(event.target.files?.[0])} />
    </label>
  );
}
