import { Edit2, Plus, Printer, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import FormInput from '../components/FormInput';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { Guest, WeddingTable } from '../types';
import { useWeddingTable } from '../hooks/useWeddingTable';

const blank = { name: '', capacity: 8, notes: '' };

export default function Tables() {
  const tables = useWeddingTable<WeddingTable>('tables', 'name');
  const guests = useWeddingTable<Guest>('guests', 'full_name');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeddingTable | null>(null);
  const [form, setForm] = useState(blank);
  const byTable = useMemo(() => Object.fromEntries(tables.rows.map((table) => [table.id, guests.rows.filter((guest) => guest.table_id === table.id)])), [guests.rows, tables.rows]);

  function start(row?: WeddingTable) {
    setEditing(row ?? null);
    setForm(row ? { name: row.name, capacity: row.capacity, notes: row.notes ?? '' } : blank);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) await tables.update(editing.id, form as Partial<WeddingTable>);
    else await tables.create(form as Partial<WeddingTable>);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Mesas</h1><p className="mt-1 text-sm text-stone-500">Acompanhe capacidade, lugares livres e convidados sem mesa.</p></div>
        <div className="flex gap-2"><button className="btn-secondary" onClick={() => window.print()}><Printer size={16} />Imprimir</button><button className="btn-primary" onClick={() => start()}><Plus size={16} />Mesa</button></div>
      </div>
      <div className="panel p-4 text-sm text-stone-600">Convidados sem mesa: <strong>{guests.rows.filter((guest) => !guest.table_id).length}</strong></div>
      <DataTable rows={tables.rows} columns={[
        { header: 'Mesa', render: (row) => row.name },
        { header: 'Capacidade', render: (row) => row.capacity },
        { header: 'Ocupados', render: (row) => byTable[row.id]?.reduce((sum, guest) => sum + 1 + guest.companions, 0) ?? 0 },
        { header: 'Disponíveis', render: (row) => Math.max(0, row.capacity - (byTable[row.id]?.reduce((sum, guest) => sum + 1 + guest.companions, 0) ?? 0)) },
        { header: 'Convidados', render: (row) => <span className="text-xs text-stone-500">{byTable[row.id]?.map((guest) => guest.full_name).join(', ') || '-'}</span> },
        { header: 'Ações', render: (row) => <div className="flex gap-2"><button className="btn-secondary px-3" onClick={() => start(row)}><Edit2 size={15} /></button><button className="btn-secondary px-3" onClick={() => tables.remove(row.id)}><Trash2 size={15} /></button></div> }
      ]} />
      <Modal open={open} title={editing ? 'Editar mesa' : 'Nova mesa'} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Número ou nome da mesa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormInput label="Capacidade" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
          </div>
          <FormTextarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="btn-primary">Salvar</button>
        </form>
      </Modal>
    </div>
  );
}
