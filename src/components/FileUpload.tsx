import { Upload } from 'lucide-react';
import { useState } from 'react';
import { uploadWeddingFile } from '../services/storage';
import { useWedding } from '../hooks/useWedding';

export default function FileUpload({ folder, onUploaded, compact = false, label }: { folder?: string; onUploaded: (url: string) => void; compact?: boolean; label?: string }) {
  const { wedding } = useWedding();
  const [loading, setLoading] = useState(false);

  async function handleFile(file?: File) {
    if (!file || !wedding) return;
    setLoading(true);
    try {
      onUploaded(await uploadWeddingFile(wedding.id, file, folder));
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className={`${compact ? 'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#F3E3D3] bg-white px-2.5 text-xs font-medium text-[#3A2B27] transition hover:border-[#D8A7A0] hover:bg-[#FFF8F6]' : 'btn-secondary cursor-pointer'}`}>
      <Upload size={16} />
      {loading ? 'Enviando...' : label ?? 'Anexar arquivo'}
      <input className="hidden" type="file" onChange={(event) => handleFile(event.target.files?.[0])} />
    </label>
  );
}
