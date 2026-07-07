/* Copyright 2026 Marimo. All rights reserved. */

import { PowerIcon } from "lucide-react";
import { useRequestClient } from "@/core/network/requests";
import { isWasm } from "@/core/wasm/utils";
import { cn } from "@/utils/cn";
import { useImperativeModal } from "../../modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "../../ui/alert-dialog";
import { Tooltip } from "../../ui/tooltip";

interface Props {
  description: string;
  disabled?: boolean;
  tooltip?: string;
}

export const ShutdownButton: React.FC<Props> = ({
  description,
  disabled = false,
  tooltip = "Shutdown",
}) => {
  const { openConfirm, closeModal } = useImperativeModal();
  const { sendShutdown } = useRequestClient();
  const handleShutdown = () => {
    sendShutdown();
    // Let the shutdown process start before closing the window.
    setTimeout(() => {
      window.close();
    }, 200);
  };

  if (isWasm()) {
    return null;
  }

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        aria-label="Shutdown"
        data-testid="shutdown-button"
        disabled={disabled}
        className={cn(
          "skies-cta skies-cta--icon skies-cta--danger h-[28px] w-[28px] rounded-[3px]",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={(e) => {
          e.stopPropagation();
          openConfirm({
            title: "Shutdown",
            description: description,
            variant: "destructive",
            confirmAction: (
              <AlertDialogDestructiveAction
                onClick={() => {
                  handleShutdown();
                  closeModal();
                }}
                aria-label="Confirm Shutdown"
              >
                Shutdown
              </AlertDialogDestructiveAction>
            ),
          });
        }}
      >
        <PowerIcon className="h-[15px] w-[15px]" strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
};
