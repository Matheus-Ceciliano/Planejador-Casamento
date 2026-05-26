import Modal from './Modal';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ open, title = 'Confirmar exclusão', message, onCancel, onConfirm }: Props) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-stone-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={onConfirm}>Excluir</button>
      </div>
    </Modal>
  );
}
