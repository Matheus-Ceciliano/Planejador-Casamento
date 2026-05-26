import { Download, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import DataTable from '../components/DataTable';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import Modal from '../components/Modal';
import { FileRecord } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useWeddingTable } from '../hooks/useWeddingTable';

const blank = { name: '', category: 'Contratos', file_url: '', notes: '' };
export default function Files() {
  const files = useWeddingTable<FileRecord>('files', 'created_at');
  const { user } = useAuth();
  const [open,setOpen]=useState(false); const [form,setForm]=useState(blank); const [category,setCategory]=useState('');
  async function submit(e:FormEvent){e.preventDefault();await files.create({...form,uploaded_by:user?.id} as Partial<FileRecord>);setOpen(false);setForm(blank)}
  const rows=files.rows.filter(file=>!category||file.category===category);
  return <div className="space-y-6"><div className="flex justify-between"><div><h1 className="page-title">Arquivos</h1><p className="mt-1 text-sm text-stone-500">Contratos, orçamentos, comprovantes, cardápios e inspirações.</p></div><button className="btn-primary" onClick={()=>setOpen(true)}><Plus size={16}/>Arquivo</button></div><div className="panel max-w-xs p-4"><FormSelect label="Categoria" value={category} onChange={e=>setCategory(e.target.value)} options={[{label:'Todas',value:''},...['Contratos','Orçamentos','Comprovantes','Cardápios','Documentos','Inspirações'].map(v=>({label:v,value:v}))]}/></div><DataTable rows={rows} columns={[{header:'Nome',render:r=>r.name},{header:'Categoria',render:r=>r.category},{header:'URL',render:r=><a className="text-rosew-500 hover:underline" href={r.file_url} target="_blank">Abrir</a>},{header:'Ações',render:r=><div className="flex gap-2"><a className="btn-secondary px-3" href={r.file_url} target="_blank"><Download size={15}/></a><button className="btn-secondary px-3" onClick={()=>files.remove(r.id)}><Trash2 size={15}/></button></div>}]} /><Modal open={open} title="Novo arquivo" onClose={()=>setOpen(false)}><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2"><FormInput label="Nome do arquivo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><FormSelect label="Categoria" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} options={['Contratos','Orçamentos','Comprovantes','Cardápios','Documentos','Inspirações'].map(v=>({label:v,value:v}))}/></div><FileUpload folder="arquivos" onUploaded={url=>setForm({...form,file_url:url})}/>{form.file_url&&<a className="text-sm text-rosew-500" href={form.file_url} target="_blank">Arquivo enviado</a>}<FormTextarea label="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="btn-primary" disabled={!form.file_url}>Salvar</button></form></Modal></div>
}
