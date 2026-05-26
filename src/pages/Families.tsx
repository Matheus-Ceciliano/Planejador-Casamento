import { Edit2, Plus, Trash2, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { Guest, GuestGroup } from '../types';
import { useWeddingTable } from '../hooks/useWeddingTable';

const blank = { name: '', side: 'noiva', responsible_name: '', responsible_phone: '', notes: '' };

export default function Families() {
  const groups = useWeddingTable<GuestGroup>('guest_groups', 'name');
  const guests = useWeddingTable<Guest>('guests');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GuestGroup | null>(null);
  const [form, setForm] = useState(blank);
  const counts = useMemo(() => Object.fromEntries(groups.rows.map((group) => [group.id, guests.rows.filter((guest) => guest.group_id === group.id)])), [groups.rows, guests.rows]);

  function start(row?: GuestGroup) {
    setEditing(row ?? null);
    setForm(row ? { name: row.name, side: row.side, responsible_name: row.responsible_name ?? '', responsible_phone: row.responsible_phone ?? '', notes: row.notes ?? '' } : blank);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) await groups.update(editing.id, form as Partial<GuestGroup>);
    else await groups.create(form as Partial<GuestGroup>);
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Famílias e grupos</h1><p className="mt-1 text-sm text-stone-500">Organize convidados por lado, família ou círculo social.</p></div>
        <button className="btn-primary" onClick={() => start()}><Plus size={16} />Nova família</button>
      </div>
      {groups.rows.length ? (
        <DataTable rows={groups.rows} columns={[
          { header: 'Nome', render: (row) => row.name },
          { header: 'Lado', render: (row) => row.side },
          { header: 'Responsável', render: (row) => row.responsible_name || '-' },
          { header: 'Total', render: (row) => counts[row.id]?.length ?? 0 },
          { header: 'Confirmados', render: (row) => counts[row.id]?.filter((guest) => guest.invite_status === 'confirmado').length ?? 0 },
          { header: 'Ações', render: (row) => <div className="flex gap-2"><button className="btn-secondary px-3" onClick={() => start(row)}><Edit2 size={15} /></button><button className="btn-secondary px-3" onClick={() => groups.remove(row.id)}><Trash2 size={15} /></button></div> }
        ]} />
      ) : <EmptyState icon={Users} title="Nenhuma família cadastrada" text="Crie grupos para filtrar convidados e acompanhar confirmações por família." />}
      <Modal open={open} title={editing ? 'Editar família' : 'Nova família'} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Nome da família/grupo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormSelect label="Lado" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} options={['noivo','noiva','ambos','amigos','trabalho','igreja','outros'].map((v) => ({ label: v, value: v }))} />
            <FormInput label="Responsável" value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} />
            <FormInput label="Telefone do responsável" value={form.responsible_phone} onChange={(e) => setForm({ ...form, responsible_phone: e.target.value })} />
          </div>
          <FormTextarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="btn-primary">Salvar</button>
        </form>
      </Modal>
    </div>
  );
}
