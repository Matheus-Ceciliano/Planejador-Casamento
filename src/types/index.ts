export type MemberRole = 'owner' | 'bride' | 'groom' | 'planner' | 'viewer';

export type WeddingMember = {
  id: string;
  wedding_id: string;
  user_id: string;
  name: string;
  email: string;
  role: MemberRole;
  can_edit: boolean;
  permissions?: Record<string, boolean> | null;
  created_at?: string;
  updated_at?: string;
};

export type WeddingInvite = {
  id: string;
  wedding_id: string;
  token: string;
  role: Exclude<MemberRole, 'owner'>;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
};

export type Wedding = {
  id: string;
  created_by?: string | null;
  name: string;
  groom_name: string | null;
  bride_name: string | null;
  wedding_date: string | null;
  ceremony_time: string | null;
  ceremony_place: string | null;
  party_place: string | null;
  planned_budget: number | null;
  cover_url: string | null;
  color_palette: string | null;
  notes: string | null;
};

export type Guest = {
  id: string;
  wedding_id: string;
  full_name: string;
  phone: string | null;
  group_id: string | null;
  origin_group?: string | null;
  guest_type: string;
  invite_status: string;
  companions: number;
  food_restriction: string | null;
  notes: string | null;
  gift_received: boolean;
  // WhatsApp invite field (added via whatsapp-invite.sql)
  rsvp_token: string | null;
  invite_sent_at: string | null;
};

export type GuestGroup = {
  id: string;
  wedding_id: string;
  name: string;
  side: string;
  responsible_name: string | null;
  responsible_phone: string | null;
  notes: string | null;
  // WhatsApp invite fields (added via whatsapp-invite.sql)
  rsvp_token: string | null;
  invite_sent_at: string | null;
  last_invite_sent_at: string | null;
};

export type BudgetItem = {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  description: string | null;
  estimated_value: number;
  contracted_value: number;
  paid_value: number;
  payment_status: string;
  due_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  vendor_id: string | null;
  receipt_url: string | null;
  notes: string | null;
};

export type BudgetCategory = {
  id: string;
  wedding_id: string;
  name: string;
  sort_order: number;
};

export type PaymentInstallment = {
  id: string;
  wedding_id: string;
  vendor_id: string | null;
  budget_item_id: string | null;
  number: number;
  amount: number;
  due_date: string | null;
  paid_amount: number;
  paid_at: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  status: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PaymentRecord = {
  id: string;
  wedding_id: string;
  ap_number: string;
  vendor_id: string | null;
  budget_item_id: string | null;
  payment_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  receipt_file_url: string | null;
  status: 'confirmed' | 'canceled';
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Vendor = {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  site: string | null;
  contracted_value: number;
  paid_value: number;
  due_date: string | null;
  status: string;
  contract_url: string | null;
  notes: string | null;
};

export type Task = {
  id: string;
  wedding_id: string;
  created_at?: string;
  title: string;
  description: string | null;
  category: string;
  responsible: string;
  due_date: string | null;
  priority: string;
  status: string;
  vendor_id: string | null;
  budget_item_id: string | null;
};

export type TaskChecklistItem = {
  id: string;
  wedding_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FileRecord = {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  vendor_id: string | null;
  budget_item_id: string | null;
  file_url: string;
  notes: string | null;
  uploaded_by: string | null;
};
