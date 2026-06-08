import { FormEvent, useEffect, useState } from 'react';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormTextarea from '../components/FormTextarea';
import { useWedding } from '../hooks/useWedding';

type Props = { firstRun?: boolean };

export default function Settings({ firstRun }: Props) {
  const { wedding, saveWedding } = useWedding();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    groom_name: '',
    bride_name: '',
    wedding_date: '',
    ceremony_time: '',
    ceremony_place: '',
    party_place: '',
    planned_budget: 0,
    cover_url: '',
    color_palette: 'Rosé, champagne e off-white',
    notes: ''
  });

  useEffect(() => {
    if (wedding) {
      setForm({
        name: wedding.name ?? '',
        groom_name: wedding.groom_name ?? '',
        bride_name: wedding.bride_name ?? '',
        wedding_date: wedding.wedding_date ?? '',
        ceremony_time: wedding.ceremony_time ?? '',
        ceremony_place: wedding.ceremony_place ?? '',
        party_place: wedding.party_place ?? '',
        planned_budget: Number(wedding.planned_budget ?? 0),
        cover_url: wedding.cover_url ?? '',
        color_palette: wedding.color_palette ?? '',
        notes: wedding.notes ?? ''
      });
    }
  }, [wedding]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveWedding(form);
    setMessage('Configurações salvas.');
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title">{firstRun ? 'Cadastre o casamento' : 'Configurações'}</h1>
        <p className="mt-1 text-sm text-stone-500">Dados do planejamento do casamento.</p>
      </div>

      <form className="panel space-y-5 p-4 sm:p-5" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormInput label="Nome do casamento" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <FormInput label="Data do casamento" type="date" value={form.wedding_date} onChange={(event) => setForm({ ...form, wedding_date: event.target.value })} />
          <FormInput label="Nome do noivo" value={form.groom_name} onChange={(event) => setForm({ ...form, groom_name: event.target.value })} />
          <FormInput label="Nome da noiva" value={form.bride_name} onChange={(event) => setForm({ ...form, bride_name: event.target.value })} />
          <FormInput label="Horário da cerimônia" type="time" value={form.ceremony_time} onChange={(event) => setForm({ ...form, ceremony_time: event.target.value })} />
          <CurrencyInput label="Orçamento total planejado" value={form.planned_budget} onValueChange={(value) => setForm({ ...form, planned_budget: value })} />
          <FormInput label="Local da cerimônia" value={form.ceremony_place} onChange={(event) => setForm({ ...form, ceremony_place: event.target.value })} />
          <FormInput label="Local da festa" value={form.party_place} onChange={(event) => setForm({ ...form, party_place: event.target.value })} />
          <FormInput label="Paleta de cores" value={form.color_palette} onChange={(event) => setForm({ ...form, color_palette: event.target.value })} />
          <div>
            <span className="label">Foto/capa</span>
            <div className="flex flex-wrap items-center gap-3">
              <FileUpload folder="capas" onUploaded={(url) => setForm({ ...form, cover_url: url })} />
              {form.cover_url && <a className="text-sm font-medium text-event-rose hover:underline" href={form.cover_url} target="_blank" rel="noreferrer">Ver capa</a>}
            </div>
          </div>
        </div>
        <FormTextarea label="Observações gerais" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        {message && <p className="text-sm text-event-success">{message}</p>}
        <button className="btn-primary w-full sm:w-auto">Salvar configurações</button>
      </form>
    </div>
  );
}
