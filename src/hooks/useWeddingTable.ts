import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWedding } from './useWedding';

export function useWeddingTable<T extends { id: string; wedding_id: string }>(table: string, order = 'created_at') {
  const { wedding } = useWedding();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wedding) return;
    setLoading(true);
    const { data, error } = await supabase.from(table).select('*').eq('wedding_id', wedding.id).order(order, { ascending: true });
    setLoading(false);
    if (error) throw error;
    setRows((data ?? []) as T[]);
  }, [order, table, wedding]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  async function create(payload: Partial<T>) {
    if (!wedding) throw new Error('Cadastre ou selecione um casamento primeiro.');
    const { data, error } = await supabase.from(table).insert({ ...payload, wedding_id: wedding.id } as any).select().single();
    if (error) throw error;
    await refresh();
    return data as T;
  }

  async function update(id: string, payload: Partial<T>) {
    const { error } = await supabase.from(table).update(payload as any).eq('id', id);
    if (error) throw error;
    await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    await refresh();
  }

  return { rows, loading, refresh, create, update, remove };
}
