/* Copyright 2026 Marimo. All rights reserved. */
/* oxlint-disable react/jsx-no-comment-textnodes */
/* oxlint-disable react/jsx-no-target-blank */

import { useAtomValue } from "jotai";
import { CopyIcon, DownloadIcon } from "lucide-react";
import type React from "react";
import { codeAtom } from "@/core/saving/file-state";
import { useFilename } from "@/core/saving/filename";
import { isStaticNotebook } from "@/core/static/static-state";
import { copyToClipboard } from "@/utils/copy";
import { downloadBlob } from "@/utils/download";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { toast } from "../ui/use-toast";

export const StaticBanner: React.FC = () => {
  const code = useAtomValue(codeAtom);

  if (!isStaticNotebook()) {
    return null;
  }

  if (!code) {
    return null;
  }

  return (
    <div
      className="px-4 py-2 bg-popover border-b border-border text-muted-foreground flex justify-between items-center gap-4 print:hidden text-sm"
      data-testid="static-notebook-banner"
    >
      <span>Static notebook — run or edit for full interactivity</span>
      <span className="shrink-0">
        <StaticBannerDialog code={code} />
      </span>
    </div>
  );
};

const StaticBannerDialog = ({ code }: { code: string }) => {
  let filename = useFilename() || "notebook.py";
  // Trim the path
  const lastSlash = filename.lastIndexOf("/");
  if (lastSlash !== -1) {
    filename = filename.slice(lastSlash + 1);
  }

  const href = window.location.href;

  return (
    <Dialog>
      <DialogTrigger asChild={true}>
        <Button
          data-testid="static-notebook-dialog-trigger"
          variant="outline"
          size="xs"
        >
          Run or Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{filename}</DialogTitle>
          <DialogDescription className="pt-3 text-left space-y-3">
            <p>This is a static notebook export. To run interactively:</p>

            <div className="rounded-lg p-3 border bg-muted border-border">
              <div className="font-mono text-foreground leading-relaxed">
                pip install marimo
                <br />
                marimo edit {filename}
              </div>
            </div>

            {!href.endsWith(".html") && (
              <div className="rounded-lg p-3 border bg-muted border-border">
                <div className="text-sm text-muted-foreground mb-1">
                  Or run directly from URL:
                </div>
                <div className="font-mono text-foreground break-all">
                  marimo edit {window.location.href}
                </div>
              </div>
            )}

          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button
            data-testid="copy-static-notebook-dialog-button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await copyToClipboard(code);
              toast({ title: "Copied to clipboard" });
            }}
          >
            <CopyIcon className="w-3 h-3 mr-2" />
            Copy code
          </Button>
          <Button
            data-testid="download-static-notebook-dialog-button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadBlob(new Blob([code], { type: "text/plain" }), filename);
            }}
          >
            <DownloadIcon className="w-3 h-3 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
