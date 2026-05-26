import { supabase } from '../lib/supabase';

export async function uploadWeddingFile(weddingId: string, file: File, folder = 'arquivos') {
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-');
  const path = `${weddingId}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('wedding-files').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('wedding-files').getPublicUrl(path);
  return data.publicUrl;
}
