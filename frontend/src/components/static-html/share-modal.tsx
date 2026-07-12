/* Copyright 2026 Marimo. All rights reserved. */

import { CopyIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { API } from "@/core/network/api";
import { Constants } from "@/core/constants";
import { useRequestClient } from "@/core/network/requests";
import { VirtualFileTracker } from "@/core/static/virtual-file-tracker";
import { copyToClipboard } from "@/utils/copy";
import { Events } from "@/utils/events";
import { NotebookScopedLocalStorage } from "@/utils/storage/typed";
import { Input } from "../ui/input";
import { Tooltip } from "../ui/tooltip";

/* The last publish for a notebook, remembered per-notebook so re-opening the
   dialog shows the existing link (and can update it in place) instead of always
   asking for a fresh slug. `path` is the host path (`<slug>-<hash>`), reused on
   update so the same URL is overwritten. */
const SHARE_STORAGE_KEY = "marimo:sharedNotebook";
const shareSchema = z
  .object({ path: z.string(), url: z.string() })
  .nullable();
type Share = z.infer<typeof shareSchema>;

/* Publish a static notebook to the host configured on the marimo server
   (MARIMO_SHARE_ENDPOINT). The notebook HTML is generated and uploaded by the
   server, which holds the shared secret — nothing sensitive lives here. The
   canonical URL is returned by the host, not fabricated client-side. */
export const ShareStaticNotebookModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { publishNotebook } = useRequestClient();

  const storage = useMemo(
    () =>
      new NotebookScopedLocalStorage<Share>(
        SHARE_STORAGE_KEY,
        shareSchema,
        () => null,
      ),
    [],
  );
  useEffect(() => () => storage.dispose(), [storage]);

  // the existing (or just-published) share for this notebook
  const [share, setShare] = useState<Share>(() => storage.get(SHARE_STORAGE_KEY));
  // whether we're entering a slug for a brand-new link (vs. showing the existing one)
  const [creatingNew, setCreatingNew] = useState(() => share == null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  // 4 character random suffix so re-using a slug still yields a unique path
  const randomHash = useMemo(() => Math.random().toString(36).slice(2, 6), []);

  const publish = async (path: string) => {
    setBusy(true);
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
        const next: Share = { path, url };
        setShare(next);
        storage.set(SHARE_STORAGE_KEY, next);
        setCreatingNew(false);
      }
      toast({
        title: "Notebook published!",
        description: url ? (
          <div>
            The link has been copied to your clipboard. You can share it with
            anyone.
          </div>
        ) : (
          <div>Your notebook was published.</div>
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
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!share) {
      return;
    }
    setBusy(true);
    const prevToast = toast({ title: "Deleting share…" });
    try {
      await API.post("/export/unpublish", { path: share.path });
      storage.remove(SHARE_STORAGE_KEY);
      setShare(null);
      setCreatingNew(true);
      setSlug("");
      prevToast.dismiss();
      toast({ title: "Share deleted" });
    } catch {
      prevToast.dismiss();
      toast({ variant: "danger", title: "Failed to delete share" });
    } finally {
      setBusy(false);
    }
  };

  // ---- View: this notebook already has a link ----
  if (share && !creatingNew) {
    return (
      <DialogContent className="w-fit">
        <DialogHeader>
          <DialogTitle>Share notebook</DialogTitle>
          <DialogDescription>
            This notebook is published. Anyone with the link can view a static,
            non-interactive copy.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-4 font-semibold text-sm text-muted-foreground">
          Your notebook is live at:
          <div className="flex items-center gap-2">
            <CopyButton text={share.url} />
            <a
              href={share.url}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              {share.url}
            </a>
          </div>
        </div>
        <DialogFooter>
          <Button
            data-testid="delete-static-notebook-button"
            variant="destructive"
            className="mr-auto"
            disabled={busy}
            onClick={unpublish}
          >
            Delete share
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setSlug("");
              setCreatingNew(true);
            }}
          >
            Create new link
          </Button>
          <Button
            data-testid="update-static-notebook-button"
            variant="default"
            disabled={busy}
            // republish to the same path so the existing link is updated in place
            onClick={() => publish(share.path)}
          >
            Update link
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  // ---- Create: ask for a slug and publish a new link ----
  return (
    <DialogContent className="w-fit">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await publish(`${slug}-${randomHash}`);
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
        </div>
        <DialogFooter>
          <Button
            data-testid="cancel-share-static-notebook-button"
            variant="secondary"
            type="button"
            onClick={() => (share ? setCreatingNew(false) : onClose())}
          >
            {share ? "Back" : "Cancel"}
          </Button>
          <Button
            data-testid="share-static-notebook-button"
            aria-label="Publish"
            variant="default"
            type="submit"
            disabled={busy}
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
