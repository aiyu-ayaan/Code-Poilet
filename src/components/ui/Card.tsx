import { forwardRef, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  isHoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ isHoverable = false, children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl overflow-hidden card-shadow ${
          isHoverable ? 'hover:border-[color:rgb(56_139_253_/_35%)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 cursor-pointer' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 border-b border-[var(--border-muted)] ${className}`} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 border-t border-[var(--border-muted)] ${className}`} {...props}>
      {children}
    </div>
  )
);
CardFooter.displayName = 'CardFooter';

export default Card;
