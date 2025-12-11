'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

type ConfirmExitButtonProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerAriaLabel?: string;
  onConfirm: () => void;
};

export function ConfirmExitButton({
  title,
  description,
  confirmLabel = 'Leave and clear cart',
  cancelLabel = 'Cancel',
  triggerAriaLabel = 'Close',
  onConfirm,
}: ConfirmExitButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 p-2 text-gray-800 bg-transparent hover:bg-gray-100 rounded-full transition-colors"
          aria-label={triggerAriaLabel}
        >
          <X className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="w-full gap-2 flex-row justify-between sm:flex-row sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline" className="text-foreground hover:text-foreground">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


