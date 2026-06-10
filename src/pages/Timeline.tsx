import { Edit2, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import FormInput from '../components/FormInput';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';

type TimelineItem = { id: string; wedding_id: string; time: string; activity: string; responsible: string | null; place: string | null; notes: string | null };
const blank = { time: '', activity: '', responsible: '', place: '', notes: '' };
export default function Timeline() {
  const items = useWeddingTable<TimelineItem>('timeline_items', 'time');
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<TimelineItem|null>(null); const [form,setForm]=useState(blank);
  const [deleting,setDeleting]=useState<TimelineItem|null>(null);
  function start(row?:TimelineItem){setEditing(row??null);setForm(row?{time:row.time,activity:row.activity,responsible:row.responsible??'',place:row.place??'',notes:row.notes??''}:blank);setOpen(true)}
  async function submit(e:FormEvent){e.preventDefault();editing?await items.update(editing.id,form):await items.create(form as Partial<TimelineItem>);setOpen(false)}
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="page-title">Cronograma</h1><p className="mt-1 text-sm text-stone-500">Linha do tempo do dia do casamento.</p></div><div className="flex gap-2"><button className="btn-primary" onClick={()=>start()}><Plus size={16}/>Item</button></div></div><div className="panel p-5">{items.rows.map(item=><div key={item.id} className="flex gap-4 border-l-2 border-event-border pb-6 pl-4 last:pb-0"><strong className="w-16 text-goldsoft">{item.time}</strong><div><p className="font-semibold">{item.activity}</p><p className="text-sm text-stone-500">{[item.responsible,item.place].filter(Boolean).join(' · ')}</p></div></div>)}</div><DataTable rows={items.rows} columns={[{header:'Horário',render:r=>r.time},{header:'Atividade',render:r=>r.activity},{header:'Responsável',render:r=>r.responsible||'-'},{header:'Local',render:r=>r.place||'-'},{header:'Ações',render:r=><div className="flex gap-2"><button className="btn-secondary px-3" onClick={()=>start(r)}><Edit2 size={15}/></button><button className="btn-secondary px-3" onClick={()=>setDeleting(r)}><Trash2 size={15}/></button></div>}]} /><Modal open={open} title="Item do cronograma" onClose={()=>setOpen(false)}><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><FormInput label="Horário" type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} required/><FormInput label="Atividade" value={form.activity} onChange={e=>setForm({...form,activity:e.target.value})} required/><FormInput label="Responsável" value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/><FormInput label="Local" value={form.place} onChange={e=>setForm({...form,place:e.target.value})}/></div><FormTextarea label="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary">Salvar</button></form></Modal><ConfirmDialog open={Boolean(deleting)} title="Excluir item?" description="Esta acao pode remover informacoes importantes. Tem certeza que deseja continuar?" confirmLabel="Sim, excluir" variant="danger" details={deleting?[{label:'Item',value:deleting.activity},{label:'Horario',value:deleting.time}]:undefined} onCancel={()=>setDeleting(null)} onConfirm={async()=>{if(!deleting)return;await items.remove(deleting.id);setDeleting(null)}} /></div>
}
