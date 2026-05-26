import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wedding } from '../types';
import { useAuth } from './useAuth';

type WeddingContextValue = {
  wedding: Wedding | null;
  weddings: Wedding[];
  loading: boolean;
  refresh: () => Promise<void>;
  selectWedding: (id: string) => void;
  saveWedding: (payload: Partial<Wedding>) => Promise<Wedding>;
};

const WeddingContext = createContext<WeddingContextValue | null>(null);

export function WeddingProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth();
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('wedding_members')
      .select('wedding:weddings(*)')
      .eq('user_id', user.id);

    if (error) throw error;
    const list = (data ?? []).map((row: any) => row.wedding).filter(Boolean) as Wedding[];
    setWeddings(list);
    const storedId = localStorage.getItem('active_wedding_id');
    const active = list.find((item) => item.id === storedId) ?? list[0] ?? null;
    setWedding(active);
    if (active) localStorage.setItem('active_wedding_id', active.id);
    setLoading(false);
  }, [configured, user]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<WeddingContextValue>(
    () => ({
      wedding,
      weddings,
      loading,
      refresh,
      selectWedding(id) {
        const next = weddings.find((item) => item.id === id) ?? null;
        setWedding(next);
        if (next) localStorage.setItem('active_wedding_id', next.id);
      },
      async saveWedding(payload) {
        if (!user) throw new Error('Usuário não autenticado');
        const record = {
          name: payload.name || `${payload.groom_name ?? 'Noivo'} & ${payload.bride_name ?? 'Noiva'}`,
          created_by: user.id,
          groom_name: payload.groom_name ?? null,
          bride_name: payload.bride_name ?? null,
          wedding_date: payload.wedding_date ?? null,
          ceremony_time: payload.ceremony_time ?? null,
          ceremony_place: payload.ceremony_place ?? null,
          party_place: payload.party_place ?? null,
          planned_budget: Number(payload.planned_budget ?? 0),
          cover_url: payload.cover_url ?? null,
          color_palette: payload.color_palette ?? null,
          notes: payload.notes ?? null
        };

        if (wedding?.id) {
          const { data, error } = await supabase.from('weddings').update(record).eq('id', wedding.id).select().single();
          if (error) throw error;
          setWedding(data);
          await refresh();
          return data;
        }

        const { data, error } = await supabase.from('weddings').insert(record).select().single();
        if (error) throw error;
        const { error: memberError } = await supabase.from('wedding_members').insert({
          wedding_id: data.id,
          user_id: user.id,
          name: user.user_metadata.full_name ?? user.email,
          email: user.email,
          role: 'noivo',
          can_edit: true
        });
        if (memberError) throw memberError;
        setWedding(data);
        localStorage.setItem('active_wedding_id', data.id);
        await refresh();
        return data;
      }
    }),
    [refresh, user, wedding, weddings]
  );

  return <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>;
}

export function useWedding() {
  const context = useContext(WeddingContext);
  if (!context) throw new Error('useWedding must be used inside WeddingProvider');
  return context;
}
