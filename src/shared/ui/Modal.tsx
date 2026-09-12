import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(470px,calc(100%-30px))] max-h-[90dvh] rounded-[18px] border border-[#e3e9f1] bg-white p-0 text-[#233b5a] shadow-[0_28px_100px_#172c4933] backdrop:bg-[#253b5866] backdrop:backdrop-blur-sm max-[700px]:m-[auto_0_0] max-[700px]:w-full max-[700px]:max-w-none max-[700px]:rounded-[20px_20px_0_0] max-[700px]:border-b-0 min-[701px]:m-[20px_20px_20px_auto] min-[701px]:h-[calc(100dvh-40px)] min-[701px]:max-h-none min-[701px]:rounded-2xl"
    >
      <div className="p-[28px] max-[700px]:p-[23px] min-[701px]:p-[30px]">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[1.4px] text-[#8a9aae] max-[700px]:text-[10px]">
            RESILIA · EXPLORA UNA POSIBILIDAD
          </span>
          <button
            className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#dce4ed] bg-[#ffffffad] text-[#73849a] max-[700px]:min-h-[42px] max-[700px]:min-w-[42px]"
            aria-label="Cerrar panel"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 className="text-[25px] font-semibold tracking-[-0.8px] max-[700px]:text-[23px]">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
