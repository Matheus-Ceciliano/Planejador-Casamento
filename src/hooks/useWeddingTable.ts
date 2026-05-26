import { useCallback, useEffect, useMemo, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useWedding } from './useWedding';

export function useWeddingTable<T extends { id: string; wedding_id: string }>(table: string, order = 'created_at') {
  const { wedding } = useWedding();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const weddingId = wedding?.id;

  const sortRows = useCallback(
    (items: T[]) =>
      [...items].sort((a, b) => {
        const left = (a as Record<string, unknown>)[order];
        const right = (b as Record<string, unknown>)[order];

        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;

        return String(left).localeCompare(String(right), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }),
    [order]
  );

  const refresh = useCallback(async () => {
    if (!weddingId) {
      setRows([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from(table).select('*').eq('wedding_id', weddingId).order(order, { ascending: true });
    setLoading(false);
    if (error) throw error;
    setRows((data ?? []) as T[]);
  }, [order, table, weddingId]);

  const realtimeChannelName = useMemo(() => (weddingId ? `public:${table}:wedding:${weddingId}` : null), [table, weddingId]);

  const applyRealtimePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      setRows((current) => {
        if (payload.eventType === 'INSERT') {
          const next = payload.new;
          if (!next?.id || next.wedding_id !== weddingId) return current;
          const exists = current.some((item) => item.id === next.id);
          return sortRows(exists ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next]);
        }

        if (payload.eventType === 'UPDATE') {
          const next = payload.new;
          if (!next?.id || next.wedding_id !== weddingId) return current;
          const exists = current.some((item) => item.id === next.id);
          return sortRows(exists ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next]);
        }

        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (!oldId) return current;
          return current.filter((item) => item.id !== oldId);
        }

        return current;
      });
    },
    [sortRows, weddingId]
  );

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  useEffect(() => {
    if (!weddingId || !realtimeChannelName) return;

    const channel = supabase
      .channel(realtimeChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `wedding_id=eq.${weddingId}`
        },
        (payload) => applyRealtimePayload(payload as RealtimePostgresChangesPayload<T>)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `wedding_id=eq.${weddingId}`
        },
        (payload) => applyRealtimePayload(payload as RealtimePostgresChangesPayload<T>)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table
        },
        (payload) => applyRealtimePayload(payload as RealtimePostgresChangesPayload<T>)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyRealtimePayload, realtimeChannelName, table, weddingId]);

  async function create(payload: Partial<T>) {
    if (!weddingId) throw new Error('Cadastre ou selecione um casamento primeiro.');
    const { data, error } = await supabase.from(table).insert({ ...payload, wedding_id: weddingId } as any).select().single();
    if (error) throw error;
    const created = data as T;
    setRows((current) => sortRows(current.some((item) => item.id === created.id) ? current : [...current, created]));
    return created;
  }

  async function update(id: string, payload: Partial<T>) {
    const { data, error } = await supabase.from(table).update(payload as any).eq('id', id).select().single();
    if (error) throw error;
    const updated = data as T;
    setRows((current) => sortRows(current.map((item) => (item.id === id ? updated : item))));
    return updated;
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    setRows((current) => current.filter((item) => item.id !== id));
  }

  return { rows, loading, refresh, create, update, remove };
}
