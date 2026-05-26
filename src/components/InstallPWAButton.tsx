import { Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function InstallPWAButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isIos = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosTip(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowIosTip((current) => !current);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (installed || (typeof window !== 'undefined' && isRunningStandalone())) return null;
  if (!installPrompt && !isIos) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#F3E3D3] bg-[#FFF8F6] px-2.5 text-xs font-semibold text-[#3A2B27] transition hover:border-[#D8A7A0] hover:bg-white"
        onClick={installApp}
      >
        {isIos && !installPrompt ? <Share2 size={15} /> : <Download size={15} />}
        <span className="hidden sm:inline">Instalar app</span>
      </button>
      {isIos && showIosTip && (
        <div className="absolute right-0 top-11 z-30 w-64 rounded-lg border border-[#F3E3D3] bg-white p-3 text-xs leading-snug text-[#7A6F6B] shadow-[0_18px_45px_rgba(92,64,51,0.12)]">
          Para instalar no iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.
        </div>
      )}
    </div>
  );
}
