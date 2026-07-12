/* Copyright 2026 Marimo. All rights reserved. */

import { CopyIcon } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Constants } from "@/core/constants";
import { useRequestClient } from "@/core/network/requests";
import { VirtualFileTracker } from "@/core/static/virtual-file-tracker";
import { copyToClipboard } from "@/utils/copy";
import { Events } from "@/utils/events";
import { Input } from "../ui/input";
import { Tooltip } from "../ui/tooltip";

/* Publish a static notebook to the host configured on the marimo server
   (MARIMO_SHARE_ENDPOINT). The notebook HTML is generated and uploaded by the
   server, which holds the shared secret — nothing sensitive lives here. The
   canonical URL is returned by the host, not fabricated client-side. */
export const ShareStaticNotebookModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [slug, setSlug] = useState("");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const { publishNotebook } = useRequestClient();
  // 4 character random string, so re-using a slug still yields a unique path
  const randomHash = useMemo(() => Math.random().toString(36).slice(2, 6), []);

  // Globally unique path
  const path = `${slug}-${randomHash}`;

  const publish = async () => {
    const prevToast = toast({
      title: "Publishing notebook…",
      description: "Please wait.",
    });

    try {
      const { url } = await publishNotebook({
        path,
        includeCode: true,
        files: VirtualFileTracker.INSTANCE.filenames(),
      });
      prevToast.dismiss();

      if (url) {
        await copyToClipboard(url);
        setPublishedUrl(url);
      }
      toast({
        title: "Notebook published!",
        description: (
          <div>
            {url ? (
              <>
                The URL has been copied to your clipboard. You can share it with
                anyone.
              </>
            ) : (
              <>Your notebook was published.</>
            )}
          </div>
        ),
      });
    } catch {
      prevToast.dismiss();
      toast({
        variant: "danger",
        title: "Error publishing notebook",
        description: (
          <div>
            Please try again later. If the problem persists, please file a bug
            report on{" "}
            <a href={Constants.issuesPage} target="_blank" className="underline">
              GitHub
            </a>
            .
          </div>
        ),
      });
    }
  };

  return (
    <DialogContent className="w-fit">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          // keep the dialog open on success so the live URL is shown
          await publish();
        }}
      >
        <DialogHeader>
          <DialogTitle>Publish notebook</DialogTitle>
          <DialogDescription>
            Publish a static, non-interactive version of this notebook to the
            web. We&apos;ll create a shareable link for you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4">
          <Input
            data-testid="slug-input"
            id="slug"
            autoFocus={true}
            value={slug}
            placeholder="Notebook slug"
            onChange={(e) => {
              const newSlug = e.target.value
                .toLowerCase()
                .replaceAll(/\s/g, "-")
                .replaceAll(/[^\da-z-]/g, "");
              setSlug(newSlug);
            }}
            required={true}
            autoComplete="off"
          />

          {publishedUrl && (
            <div className="font-semibold text-sm text-muted-foreground gap-2 flex flex-col">
              Your notebook is live at:
              <div className="flex items-center gap-2">
                <CopyButton text={publishedUrl} />
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  {publishedUrl}
                </a>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            data-testid="cancel-share-static-notebook-button"
            variant="secondary"
            onClick={onClose}
          >
            {publishedUrl ? "Close" : "Cancel"}
          </Button>
          <Button
            data-testid="share-static-notebook-button"
            aria-label="Publish"
            variant="default"
            type="submit"
          >
            Publish
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

const CopyButton = (props: { text: string }) => {
  const [copied, setCopied] = React.useState(false);

  const copy = Events.stopPropagation(async (e) => {
    e.preventDefault();
    await copyToClipboard(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });

  return (
    <Tooltip content="Copied!" open={copied}>
      <Button
        data-testid="copy-static-notebook-url-button"
        onClick={copy}
        size="xs"
        variant="secondary"
      >
        <CopyIcon size={14} strokeWidth={1.5} />
      </Button>
    </Tooltip>
  );
};
