"use client";

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ModalWrapper({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalWrapperProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Background Overlay blur */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" />
        
        {/* Modal Main Frame Content */}
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-card p-6 shadow-lg duration-200 animate-in fade-in-50 zoom-in-95 sm:rounded-lg md:w-full",
            className
          )}
        >
          <div className="flex flex-col space-y-1.5 text-left">
            <Dialog.Title className="text-base font-bold leading-none tracking-tight text-foreground">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-xs text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : null}
          </div>

          <div className="my-2">{children}</div>

          <Dialog.Close asChild>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 outline-none cursor-pointer hover:bg-muted p-1"
              aria-label="Close modal dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
