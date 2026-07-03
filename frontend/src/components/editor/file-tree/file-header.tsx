/* Copyright 2026 Marimo. All rights reserved. */

import { ArrowLeftIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

interface FilePreviewHeaderProps {
  filename?: string;
  filenameIcon?: React.ReactNode;
  onBack?: () => void;
  onRefresh?: () => void;
  onDownload?: () => void;
  /** Extra action buttons placed before the download button. */
  actions?: React.ReactNode;
}

export const FilePreviewHeader: React.FC<FilePreviewHeaderProps> = ({
  filename,
  filenameIcon,
  onBack,
  onRefresh,
  onDownload,
  actions,
}) => {
  const ghostIconButton = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center h-[30px] shrink-0 border-b border-border px-1 gap-1">
      {onBack && (
        <Tooltip content="Back to file list">
          <Button
            variant="text"
            size="xs"
            className={ghostIconButton}
            onClick={onBack}
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </Tooltip>
      )}
      {filename ? (
        <span className="flex items-center gap-1.5 flex-1 min-w-0 text-[13px] font-medium text-foreground truncate">
          {filenameIcon}
          {filename}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        {onRefresh && (
          <Tooltip content="Refresh">
            <Button
              variant="text"
              size="xs"
              className={ghostIconButton}
              onClick={onRefresh}
            >
              <RefreshCwIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
          </Tooltip>
        )}
        {actions}
        {onDownload && (
          <Tooltip content="Download">
            <Button
              variant="text"
              size="xs"
              className={ghostIconButton}
              onClick={onDownload}
            >
              <DownloadIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
