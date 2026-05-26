import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OfflineNotice() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-lg border border-[#F3E3D3] bg-white p-3 text-[#3A2B27] shadow-[0_18px_45px_rgba(92,64,51,0.14)]">
        <span className="mt-0.5 rounded-lg bg-[#F3E3D3] p-2 text-[#D8948B]">
          <WifiOff size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold">Você está offline</p>
          <p className="mt-0.5 text-xs leading-snug text-[#7A6F6B]">Algumas informações podem não estar disponíveis até a conexão voltar.</p>
        </div>
      </div>
    </div>
  );
}
