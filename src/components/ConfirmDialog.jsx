import Modal from './Modal.jsx'

export default function ConfirmDialog({
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Hapus',
  onCancel,
  onConfirm,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="form-actions">
        <button className="btn" type="button" onClick={onCancel}>Batal</button>
        <button className="btn btn-danger" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
