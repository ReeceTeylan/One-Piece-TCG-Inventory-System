import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
    <DialogPrimitive.Content ref={ref}
      className={cn('fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border bg-card p-5 shadow-xl focus:outline-none max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:max-h-[calc(100dvh-1rem)] max-sm:w-[calc(100vw-1rem)] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:p-3', className)}
      {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-2 top-2 grid size-9 place-items-center rounded-sm text-muted-foreground hover:text-foreground sm:right-4 sm:top-4 sm:size-auto">
        <X className="size-4" /><span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';
export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('mb-4 space-y-1', className)} {...p} />;
export const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...p }, ref) => <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold', className)} {...p} />);
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm text-muted-foreground', className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('mt-5 flex justify-end gap-2 max-sm:sticky max-sm:bottom-0 max-sm:z-20 max-sm:flex-wrap max-sm:border-t max-sm:bg-card max-sm:py-3', className)} {...p} />;
