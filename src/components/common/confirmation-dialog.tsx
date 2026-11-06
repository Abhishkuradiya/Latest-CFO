"use client";

import React from 'react';
import { ModalWrapper } from './modal-wrapper';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: ConfirmationDialogProps) {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-3 mt-4 border-t pt-4">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="rounded border px-4 py-2 text-xs font-semibold hover:bg-muted outline-none cursor-pointer transition disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            "rounded px-4 py-2 text-xs font-semibold text-white outline-none cursor-pointer transition disabled:opacity-50",
            isDestructive
              ? "bg-destructive hover:bg-destructive/95"
              : "bg-primary hover:bg-primary/95"
          )}
        >
          {isLoading ? 'Confirming...' : confirmLabel}
        </button>
      </div>
    </ModalWrapper>
  );
}
