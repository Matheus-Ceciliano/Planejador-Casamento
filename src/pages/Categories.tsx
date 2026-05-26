import { Edit2, Plus, Tags, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { BudgetCategory, BudgetItem, Vendor } from '../types';
import { budgetCategories } from '../utils/constants';
import { toPrimaryCategory } from '../utils/finance';

const blank = { name: '', sort_order: 0 };

export default function Categories() {
  const categories = useWeddingTable<BudgetCategory>('budget_categories', 'sort_order');
  const budgetItems = useWeddingTable<BudgetItem>('budget_items', 'name');
  const vendors = useWeddingTable<Vendor>('vendors', 'name');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [deleting, setDeleting] = useState<BudgetCategory | null>(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');

  const defaultCategories = useMemo(() => budgetCategories, []);
  const visibleCustomCategories = useMemo(
    () => categories.rows.filter((category) => !defaultCategories.includes(toPrimaryCategory(category.name))),
    [categories.rows, defaultCategories]
  );

  function start(row?: BudgetCategory) {
    setEditing(row ?? null);
    setForm(row ? { name: row.name, sort_order: row.sort_order } : { ...blank, sort_order: categories.rows.length + 1 });
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = toPrimaryCategory(form.name.trim());
    if (!name) return;
    if (editing) await categories.update(editing.id, { name, sort_order: Number(form.sort_order) } as Partial<BudgetCategory>);
    else await categories.create({ name, sort_order: Number(form.sort_order) } as Partial<BudgetCategory>);
    setOpen(false);
    setMessage('Categoria salva.');
  }

  async function confirmDelete() {
    if (!deleting) return;
    await categories.remove(deleting.id);
    setDeleting(null);
    setMessage('Categoria removida. Itens existentes não foram alterados.');
  }

  function usageCount(name: string) {
    return budgetItems.rows.filter((item) => toPrimaryCategory(item.category) === name).length + vendors.rows.filter((vendor) => toPrimaryCategory(vendor.category) === name).length;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#FFF8F6] text-[#2F2926]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-[#2F2926]">Categorias</h1>
          <p className="mt-1 text-sm text-[#7A6F6B]">Crie categorias personalizadas para usar em fornecedores e orçamento.</p>
        </div>
        <button className="btn-primary bg-[#3A2B27]" onClick={() => start()}>
          <Plus size={16} /> Nova categoria
        </button>
      </div>

      {message && <div className="rounded-lg border border-[#8FA87A]/25 bg-[#8FA87A]/12 p-3 text-sm text-[#5f7f4d]">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg border border-[#F3E3D3] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <h2 className="text-sm font-semibold text-[#2F2926]">Categorias padrão</h2>
          <p className="mt-1 text-sm text-[#7A6F6B]">Estas já ficam disponíveis automaticamente.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {defaultCategories.map((name) => (
              <span key={name} className="rounded-full bg-[#F3E3D3] px-3 py-1 text-xs font-semibold text-[#7A6F6B]">{name}</span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#F3E3D3] bg-white p-4 shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
          <h2 className="text-sm font-semibold text-[#2F2926]">Categorias personalizadas</h2>
          <p className="mt-1 text-sm text-[#7A6F6B]">Aparecem nos formulários de fornecedor e orçamento.</p>
          <div className="mt-4 space-y-3">
            {visibleCustomCategories.length ? (
              visibleCustomCategories.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F3E3D3] bg-[#FFF8F6] p-3">
                  <div>
                    <p className="font-semibold text-[#2F2926]">{row.name}</p>
                    <p className="text-xs text-[#7A6F6B]">Ordem {row.sort_order} · {usageCount(row.name)} usos</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary px-3" onClick={() => start(row)} title="Editar categoria"><Edit2 size={15} /></button>
                    <button className="btn-secondary px-3" onClick={() => setDeleting(row)} title="Excluir categoria"><Trash2 size={15} className="text-[#C97C7C]" /></button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Tags} title="Nenhuma categoria personalizada" text="Crie categorias extras para adaptar o planejamento ao seu casamento." />
            )}
          </div>
        </div>
      </section>

      <Modal open={open} title={editing ? 'Editar categoria' : 'Nova categoria'} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Nome da categoria" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <FormInput label="Ordem" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary bg-[#3A2B27]">Salvar categoria</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir categoria"
        message={`Excluir a categoria ${deleting?.name ?? ''}? Os fornecedores e gastos já cadastrados não serão apagados.`}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
