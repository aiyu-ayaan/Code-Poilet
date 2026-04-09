import { forwardRef, type HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'running';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
      success: 'bg-[var(--status-success-bg)] text-[var(--success)]',
      error: 'bg-[var(--status-error-bg)] text-[var(--error)]',
      warning: 'bg-[var(--status-warning-bg)] text-[var(--warning)]',
      info: 'bg-[var(--accent-muted)] text-[var(--accent-primary)]',
      running: 'bg-[var(--status-running-bg)] text-[var(--accent-primary)]',
    };
    
    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
        {...props}
      >
        {variant === 'running' && (
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse"></span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
