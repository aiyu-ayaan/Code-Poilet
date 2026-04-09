import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Info } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

export default function Toast({ id, type, message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [id, onClose, duration]);

  const icons = {
    success: <CheckCircle size={20} className="text-[var(--success)]" />,
    error: <XCircle size={20} className="text-[var(--error)]" />,
    warning: <AlertCircle size={20} className="text-[var(--warning)]" />,
    info: <Info size={20} className="text-[var(--accent-primary)]" />,
  };

  const borders = {
    success: 'border-l-[var(--success)]',
    error: 'border-l-[var(--error)]',
    warning: 'border-l-[var(--warning)]',
    info: 'border-l-[var(--accent-primary)]',
  };

  return (
    <div className={`flex items-start gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] border-l-4 ${borders[type]} rounded-lg shadow-lg min-w-[320px] animate-in slide-in-from-right duration-300`}>
      {icons[type]}
      <div className="flex-1">
        <p className="text-sm text-[var(--text-primary)]">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
