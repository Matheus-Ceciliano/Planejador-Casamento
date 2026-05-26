import { FormEvent, useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { MemberRole, WeddingMember } from '../types';

type Props = { firstRun?: boolean };

const roleOptions: { label: string; value: MemberRole }[] = [
  { label: 'Noivo', value: 'noivo' },
  { label: 'Noiva', value: 'noiva' },
  { label: 'Cerimonialista', value: 'cerimonialista' }
];

export default function Settings({ firstRun }: Props) {
  const { user } = useAuth();
  const { wedding, saveWedding } = useWedding();
  const members = useWeddingTable<WeddingMember>('wedding_members', 'name');
  const [message, setMessage] = useState('');
  const [memberMessage, setMemberMessage] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    role: 'noiva' as MemberRole
  });
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
    color_palette: 'rose, champagne, branco, dourado claro, verde oliva',
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

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!wedding) return;

    setAddingMember(true);
    setMemberMessage('');

    const { error } = await supabase.rpc('add_wedding_member_by_email', {
      member_email: memberForm.email.trim(),
      member_name: memberForm.name.trim() || null,
      member_role: memberForm.role,
      target_wedding_id: wedding.id
    });

    setAddingMember(false);

    if (error) {
      setMemberMessage(error.message);
      return;
    }

    setMemberForm({ name: '', email: '', role: 'noiva' });
    setMemberMessage('Acesso adicionado.');
    await members.refresh();
  }

  async function removeMember(id: string) {
    await members.remove(id);
    setMemberMessage('Acesso removido.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{firstRun ? 'Cadastre o casamento' : 'Configurações'}</h1>
        <p className="mt-1 text-sm text-stone-500">Dados principais usados no planejamento e no dashboard.</p>
      </div>
      <form className="panel space-y-5 p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
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
              {form.cover_url && <a className="text-sm text-rosew-500 hover:underline" href={form.cover_url} target="_blank">Ver capa</a>}
            </div>
          </div>
        </div>
        <FormTextarea label="Observações gerais" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        {message && <p className="text-sm text-olivew">{message}</p>}
        <button className="btn-primary">Salvar configurações</button>
      </form>

      {wedding && (
        <section className="panel space-y-5 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Acessos ao site</h2>
            <p className="mt-1 text-sm text-stone-500">Adicione a noiva e a cerimonialista pelo e-mail usado no cadastro delas.</p>
          </div>

          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]" onSubmit={addMember}>
            <FormInput
              label="Nome"
              value={memberForm.name}
              onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
              placeholder="Nome que aparecera no acesso"
            />
            <FormInput
              label="E-mail"
              type="email"
              required
              value={memberForm.email}
              onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
              placeholder="email@exemplo.com"
            />
            <FormSelect
              label="Papel"
              value={memberForm.role}
              onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as MemberRole })}
              options={roleOptions}
            />
            <div className="flex items-end">
              <button className="btn-primary w-full" disabled={addingMember}>
                <UserPlus size={18} />
                Adicionar
              </button>
            </div>
          </form>

          {memberMessage && <p className="text-sm text-stone-600">{memberMessage}</p>}

          <div className="overflow-hidden rounded-lg border border-rosew-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-rosew-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rosew-100 bg-white">
                {members.rows.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 font-medium text-ink">{member.name}</td>
                    <td className="px-4 py-3 text-stone-600">{member.email}</td>
                    <td className="px-4 py-3"><StatusBadge status={member.role} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => removeMember(member.id)}
                        disabled={member.user_id === user?.id}
                        title={member.user_id === user?.id ? 'Voce nao pode remover seu proprio acesso' : 'Remover acesso'}
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!members.rows.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-stone-500" colSpan={4}>Nenhum acesso cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
