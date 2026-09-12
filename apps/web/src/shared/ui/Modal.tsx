import type { ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { DialogPortal, DialogOverlay, DialogTitle } from "./dialog";
import { Button } from "./button";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onEscapeKeyDown={onClose}
          className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto border border-hairline-strong bg-canvas p-6 text-body shadow-[0_0.75rem_2rem_rgba(16,42,58,0.14)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:right-5 sm:top-5 sm:left-auto sm:bottom-5 sm:h-[calc(100dvh-2.5rem)] sm:w-[min(29.375rem,calc(100%-1.875rem))]"
        >
          <div className="flex items-center justify-between">
            <span className="font-title text-[0.6875rem] font-semibold tracking-[0.12em] text-body-subtle uppercase">
              Resilia · Explora una posibilidad
            </span>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar panel"
                onClick={onClose}
              >
                <X size={20} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogTitle className="text-[1.5rem] tracking-[-0.06em]">
            {title}
          </DialogTitle>
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
