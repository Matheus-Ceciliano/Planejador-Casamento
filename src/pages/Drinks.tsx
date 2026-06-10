import { Edit2, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import CurrencyInput from '../components/CurrencyInput';
import DataTable from '../components/DataTable';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { formatMoney } from '../utils/format';

type Drink = { id: string; wedding_id: string; name: string; drink_type: string; liters: number; units: number; unit_value: number; notes: string | null };
const blank = { name: '', drink_type: 'Refrigerante', liters: 0, units: 0, unit_value: 0, notes: '' };
export default function Drinks() {
  const drinks = useWeddingTable<Drink>('drink_items', 'name');
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Drink|null>(null); const [form,setForm]=useState(blank);
  const [deleting,setDeleting]=useState<Drink|null>(null);
  const total = useMemo(()=>drinks.rows.reduce((sum,row)=>sum+row.units*row.unit_value,0),[drinks.rows]);
  function start(row?:Drink){setEditing(row??null);setForm(row?{...blank,...row,notes:row.notes??''}:blank);setOpen(true)}
  async function submit(e:FormEvent){e.preventDefault();editing?await drinks.update(editing.id,form):await drinks.create(form as Partial<Drink>);setOpen(false)}
  return <div className="space-y-6"><div className="flex justify-between"><div><h1 className="page-title">Bebidas</h1><p className="mt-1 text-sm text-stone-500">Quantidade, unidades e custos por tipo.</p></div><button className="btn-primary" onClick={()=>start()}><Plus size={16}/>Bebida</button></div><div className="panel p-4">Total geral: <strong>{formatMoney(total)}</strong></div><DataTable rows={drinks.rows} columns={[{header:'Bebida',render:r=>r.name},{header:'Tipo',render:r=>r.drink_type},{header:'Litros',render:r=>r.liters},{header:'Unidades',render:r=>r.units},{header:'Total',render:r=>formatMoney(r.units*r.unit_value)},{header:'Ações',render:r=><div className="flex gap-2"><button className="btn-secondary px-3" onClick={()=>start(r)}><Edit2 size={15}/></button><button className="btn-secondary px-3" onClick={()=>setDeleting(r)}><Trash2 size={15}/></button></div>}]} /><Modal open={open} title="Bebida" onClose={()=>setOpen(false)}><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><FormInput label="Nome" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><FormSelect label="Tipo" value={form.drink_type} onChange={e=>setForm({...form,drink_type:e.target.value})} options={['Refrigerante','Suco','Água com gás','Água sem gás','Café','Energético','Outros'].map(v=>({label:v,value:v}))}/><FormInput label="Quantidade em litros" type="number" value={form.liters} onChange={e=>setForm({...form,liters:Number(e.target.value)})}/><FormInput label="Quantidade de unidades" type="number" value={form.units} onChange={e=>setForm({...form,units:Number(e.target.value)})}/><CurrencyInput label="Valor unitário" value={form.unit_value} onValueChange={v=>setForm({...form,unit_value:v})}/></div><div className="panel p-3 text-sm">Total: <strong>{formatMoney(form.units*form.unit_value)}</strong></div><FormTextarea label="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary">Salvar</button></form></Modal><ConfirmDialog open={Boolean(deleting)} title="Excluir item?" description="Esta acao pode remover informacoes importantes. Tem certeza que deseja continuar?" confirmLabel="Sim, excluir" variant="danger" details={deleting?[{label:'Bebida',value:deleting.name},{label:'Total',value:formatMoney(deleting.units*deleting.unit_value)}]:undefined} onCancel={()=>setDeleting(null)} onConfirm={async()=>{if(!deleting)return;await drinks.remove(deleting.id);setDeleting(null)}} /></div>;
}
