import { Download, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import ResponsiveFilters from '../components/ResponsiveFilters';
import { useAuth } from '../hooks/useAuth';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { FileRecord } from '../types';

const blank = { name: '', category: 'Contratos', file_url: '', notes: '' };
const fileCategories = ['Contratos', 'Orçamentos', 'Comprovantes', 'Cardápios', 'Documentos', 'Inspirações'];

export default function Files() {
  const files = useWeddingTable<FileRecord>('files', 'created_at');
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [category, setCategory] = useState('');

  const rows = useMemo(() => files.rows.filter((file) => !category || file.category === category), [category, files.rows]);
  const activeFilterCount = category ? 1 : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    await files.create({ ...form, uploaded_by: user?.id } as Partial<FileRecord>);
    setOpen(false);
    setForm(blank);
  }

  function clearFilters() {
    setCategory('');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="page-title">Arquivos</h1>
          <p className="mt-1 text-sm text-stone-500">Contratos, orçamentos, comprovantes, cardápios e inspirações.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Arquivo</button>
      </div>

      <ResponsiveFilters activeFiltersCount={activeFilterCount} onClearFilters={clearFilters} gridClassName="md:grid-cols-[minmax(220px,320px)_auto]">
        <FormSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} options={[{ label: 'Todas', value: '' }, ...fileCategories.map((value) => ({ label: value, value }))]} />
      </ResponsiveFilters>

      <DataTable rows={rows} columns={[
        { header: 'Nome', render: (row) => row.name },
        { header: 'Categoria', render: (row) => row.category },
        { header: 'URL', render: (row) => <a className="text-rosew-500 hover:underline" href={row.file_url} target="_blank">Abrir</a> },
        { header: 'Ações', render: (row) => <div className="flex gap-2"><a className="btn-secondary px-3" href={row.file_url} target="_blank"><Download size={15} /></a><button className="btn-secondary px-3" onClick={() => files.remove(row.id)}><Trash2 size={15} /></button></div> }
      ]} />

      <Modal open={open} title="Novo arquivo" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Nome do arquivo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <FormSelect label="Categoria" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={fileCategories.map((value) => ({ label: value, value }))} />
          </div>
          <FileUpload folder="arquivos" onUploaded={(url) => setForm({ ...form, file_url: url })} />
          {form.file_url && <a className="text-sm text-rosew-500" href={form.file_url} target="_blank">Arquivo enviado</a>}
          <FormTextarea label="Observações" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <button className="btn-primary" disabled={!form.file_url}>Salvar</button>
        </form>
      </Modal>
    </div>
  );
}
