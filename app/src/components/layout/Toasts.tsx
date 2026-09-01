import { useUIStore } from '../../store/uiStore';

export default function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const remove = useUIStore((s) => s.removeToast);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => remove(t.id)}
          role="status"
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
