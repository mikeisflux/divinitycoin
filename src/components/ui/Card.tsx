// components/ui/Card.tsx

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-neutral-200 p-6',
        hover && 'transition-shadow hover:shadow-lg hover:border-neutral-300',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardSectionProps) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className = '' }: CardSectionProps) {
  return (
    <h3 className={cn('text-xl font-semibold text-neutral-900', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: CardSectionProps) {
  return (
    <p className={cn('text-neutral-600 mt-1', className)}>{children}</p>
  );
}

export function CardContent({ children, className = '' }: CardSectionProps) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }: CardSectionProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-neutral-100', className)}>
      {children}
    </div>
  );
}
