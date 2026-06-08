let openModalCount = 0;

function emitModalState() {
  const isOpen = openModalCount > 0;
  document.documentElement.dataset.modalOpen = isOpen ? 'true' : 'false';
  document.body.style.overflow = isOpen ? 'hidden' : '';
  window.dispatchEvent(new CustomEvent('app:modal-state', { detail: { isOpen } }));
}

export function retainModalLayer() {
  openModalCount += 1;
  emitModalState();

  return () => {
    openModalCount = Math.max(0, openModalCount - 1);
    emitModalState();
  };
}

export function isAnyModalOpen() {
  return openModalCount > 0;
}
