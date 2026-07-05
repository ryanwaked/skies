/* Copyright 2026 Marimo. All rights reserved. */

import { EditorView } from "@codemirror/view";
import {
  BetweenHorizontalStartIcon,
  CopyIcon,
  EllipsisIcon,
  KeyIcon,
  PlusIcon,
} from "lucide-react";
import React, { Suspense, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Spinner } from "@/components/icons/spinner";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { SECRETS_REGISTRY } from "@/core/secrets/request-registry";
import { useAsyncData } from "@/hooks/useAsyncData";
import { LazyAnyLanguageCodeMirror } from "@/plugins/impl/code/LazyAnyLanguageCodeMirror";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { useTheme } from "@/theme/useTheme";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { useInsertCode } from "../../connections/components";
import { HideInKioskMode } from "../../kiosk-mode";
import { PanelEmptyState } from "./empty-state";
import { sortProviders, WriteSecretModal } from "./write-secret-modal";

interface SecretRow {
  key: string;
  provider: string;
  providerName: string;
}

function accessorFor(key: string): string {
  return `os.environ["${key}"]`;
}

const codeExtensions = [EditorView.lineWrapping];

const SecretsPanel: React.FC = () => {
  const { openModal, closeModal } = useImperativeModal();
  const [selected, setSelected] = useState<SecretRow>();
  const {
    data: secretKeyProviders,
    isPending,
    error,
    refetch,
  } = useAsyncData(async () => {
    const result = await SECRETS_REGISTRY.request({});
    return sortProviders(result.secrets);
  }, []);

  // Only show on the first load
  if (isPending) {
    return <Spinner size="medium" centered={true} />;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  // Provider names without 'env' provider
  const providerNames = secretKeyProviders
    .filter((provider) => provider.provider !== "env")
    .map((provider) => provider.name);

  const rows: SecretRow[] = secretKeyProviders.flatMap((provider) =>
    provider.keys.map((key) => ({
      key,
      provider: provider.provider,
      providerName: provider.name,
    })),
  );

  if (rows.length === 0) {
    return (
      <PanelEmptyState
        title="No environment variables"
        description="No environment variables are available in this notebook."
        icon={<KeyIcon />}
        action={
          <HideInKioskMode>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openModal(
                  <WriteSecretModal
                    providerNames={providerNames}
                    onSuccess={() => {
                      refetch();
                      closeModal();
                    }}
                    onClose={closeModal}
                  />,
                )
              }
            >
              <PlusIcon strokeWidth={1.5} className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </HideInKioskMode>
        }
      />
    );
  }

  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={55} minSize={30} maxSize={80}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 h-8 shrink-0 border-b border-border">
            <span className="skies-kicker">secrets</span>
            <HideInKioskMode>
              <button
                type="button"
                className="flex items-center gap-1 px-2 h-6 rounded-[3px] text-xs text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground"
                onClick={() =>
                  openModal(
                    <WriteSecretModal
                      providerNames={providerNames}
                      onSuccess={() => {
                        refetch();
                        closeModal();
                      }}
                      onClose={closeModal}
                    />,
                  )
                }
              >
                <PlusIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
                Add
              </button>
            </HideInKioskMode>
          </div>
          <Table className="table-fixed overflow-y-auto overflow-x-hidden flex-1">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[34%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <TableCell className="h-8 py-0 bg-card border-b font-medium">
                  Name
                </TableCell>
                <TableCell className="h-8 py-0 bg-card border-b font-medium">
                  Source
                </TableCell>
                <TableCell className="h-8 py-0 bg-card border-b" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.provider}-${row.key}`}
                  className={cn(
                    "group cursor-pointer",
                    selected?.key === row.key &&
                      selected.provider === row.provider
                      ? "bg-primary/[0.07]"
                      : "hover:bg-[var(--hover-wash)]",
                  )}
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="py-1.5 overflow-hidden">
                    <span
                      className="font-code text-[11.5px] inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] border border-transparent bg-accent px-1.5 py-0.5 text-accent-foreground"
                      title={row.key}
                    >
                      {row.key}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 overflow-hidden">
                    {row.provider !== "env" && (
                      <Badge
                        variant="outline"
                        className="select-none max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {row.providerName}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <SecretRowActions row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
      <Panel defaultSize={45}>
        <div className="h-full flex flex-col overflow-hidden">
          {selected ? (
            <SecretDetail key={selected.key} row={selected} />
          ) : (
            <PanelEmptyState
              title=""
              description="Click on an environment variable to view how to access it."
            />
          )}
        </div>
      </Panel>
    </PanelGroup>
  );
};

export default SecretsPanel;

const SecretRowActions: React.FC<{ row: SecretRow }> = ({ row }) => {
  const insertCode = useInsertCode();
  const snippet = accessorFor(row.key);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <button
          type="button"
          aria-label={`Actions for ${row.key}`}
          className="invisible group-hover:visible flex items-center justify-center h-6 w-6 rounded-[3px] text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={async () => {
            await copyToClipboard(snippet);
            toast({
              title: "Copied to clipboard",
              description: `${snippet} has been copied to your clipboard.`,
            });
          }}
        >
          <CopyIcon className="mr-2 size-3.5" strokeWidth={1.5} />
          Copy accessor
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => insertCode(snippet)}>
          <BetweenHorizontalStartIcon className="mr-2 size-3.5" strokeWidth={1.5} />
          Insert into cell
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SecretDetail: React.FC<{ row: SecretRow }> = ({ row }) => {
  const { theme } = useTheme();
  const insertCode = useInsertCode();
  const snippet = accessorFor(row.key);

  return (
    <>
      <div className="text-[13px] font-medium text-foreground border-b px-3 py-1.5 flex items-center gap-2 min-w-0">
        <span
          className="font-code text-[11.5px] truncate rounded-[3px] bg-accent px-1.5 py-0.5 text-accent-foreground"
          title={row.key}
        >
          {row.key}
        </span>
        {row.provider !== "env" && (
          <Badge variant="outline" className="shrink-0 select-none">
            {row.providerName}
          </Badge>
        )}
      </div>
      <div className="px-3 py-3 flex flex-col gap-3 overflow-y-auto overflow-x-hidden flex-1">
        <div>
          <div className="skies-kicker mb-1.5">access in code</div>
          <Suspense>
            <LazyAnyLanguageCodeMirror
              theme={theme === "dark" ? "dark" : "light"}
              language="python"
              className="cm border rounded overflow-hidden"
              extensions={codeExtensions}
              value={snippet}
              readOnly={true}
            />
          </Suspense>
        </div>
        <HideInKioskMode>
          <div className="flex justify-end">
            <Button
              size="xs"
              variant="outline"
              onClick={() => insertCode(snippet)}
            >
              Insert into cell
              <BetweenHorizontalStartIcon
                strokeWidth={1.5}
                className="ml-2 h-4 w-4"
              />
            </Button>
          </div>
        </HideInKioskMode>
      </div>
    </>
  );
};
