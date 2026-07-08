import * as React from 'react';
import { cn } from '@/lib/utils';
// Lightweight native select styled to match the design system.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref}
      className={cn('h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      {...props}>
      {children}
    </select>
  ));
Select.displayName = 'Select';
