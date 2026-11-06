"use client";

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  side?: 'left' | 'right';
}

export function DrawerWrapper({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  side = 'right',
}: DrawerWrapperProps) {
  const isRight = side === 'right';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Background Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" />

        {/* Drawer Slide-in frame */}
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex h-full w-3/4 flex-col gap-4 border bg-card p-6 shadow-lg transition-transform duration-300 sm:max-w-md",
            isRight
              ? "right-0 border-l animate-in slide-in-from-right"
              : "left-0 border-r animate-in slide-in-from-left",
            className
          )}
        >
          <div className="flex flex-col space-y-1.5 text-left border-b pb-4">
            <Dialog.Title className="text-base font-bold text-foreground">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-xs text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto py-2 pr-1">{children}</div>

          <Dialog.Close asChild>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 hover:bg-muted p-1 transition outline-none cursor-pointer"
              aria-label="Close side drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
