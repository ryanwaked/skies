/* Copyright 2026 Marimo. All rights reserved. */
import { useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUpCircleIcon,
  BoxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { useOpenSettingsToTab } from "@/components/app-config/state";
import { Spinner } from "@/components/icons/spinner";
import { SearchInput } from "@/components/ui/input";
import {
  PANEL_SEARCH_ACTION,
  PANEL_SEARCH_INPUT,
  PANEL_SEARCH_INPUT_ROOT,
  PANEL_SEARCH_ROW,
  PANEL_SEGMENTED_ITEM,
  PANEL_SEGMENTED_ITEM_ACTIVE,
  PANEL_SEGMENTED_ITEM_INACTIVE,
  PANEL_TOOLBAR_ROW,
} from "./panel-styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { useResolvedMarimoConfig } from "@/core/config/config";
import { useRequestClient } from "@/core/network/requests";
import type { DependencyTreeNode } from "@/core/network/types";
import { stripPackageManagerPrefix } from "@/core/packages/package-input-utils";
import {
  showRemovePackageToast,
  showUpgradePackageToast,
} from "@/core/packages/toast-components";
import { useInstallPackages } from "@/core/packages/useInstallPackage";
import { isWasm } from "@/core/wasm/utils";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { Events } from "@/utils/events";
import { PanelEmptyState } from "./empty-state";
import { PACKAGES_INPUT_ID, packagesToInstallAtom } from "./packages-utils";

type ViewMode = "tree" | "list";

/** Compact icon action (upgrade/remove) revealed on row hover. */
const PackageActionButton: React.FC<{
  onClick: () => void;
  loading: boolean;
  label: string;
  icon: React.ReactNode;
}> = ({ onClick, loading, label, icon }) => {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "flex items-center justify-center h-6 w-6 shrink-0 rounded-[3px]",
          "text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)]",
        )}
        onClick={Events.stopPropagation(onClick)}
      >
        {loading ? (
          <Spinner size="small" className="h-3.5 w-3.5 opacity-50" />
        ) : (
          icon
        )}
      </button>
    </Tooltip>
  );
};

const PackagesPanel: React.FC = () => {
  const [config] = useResolvedMarimoConfig();
  const packageManager = config.package_management.manager;
  const { getDependencyTree, getPackageList } = useRequestClient();

  const [userViewMode, setUserViewMode] = React.useState<ViewMode | null>(null);
  const {
    data: dependencies,
    error,
    refetch,
    isPending,
  } = useAsyncData(async () => {
    const [listPackagesResponse, dependencyTreeResponse] = await Promise.all([
      getPackageList(),
      getDependencyTree(),
    ]);
    return {
      list: listPackagesResponse.packages,
      tree: dependencyTreeResponse.tree,
    };
  }, [packageManager]);

  // Only show on the first load
  if (isPending) {
    return <Spinner size="medium" centered={true} />;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  const isTreeSupported = dependencies.tree != null;
  const viewMode = resolveViewMode(userViewMode, isTreeSupported);
  const name = dependencies.tree?.name;
  const version = dependencies?.tree?.version;
  const isSandbox = name === "<root>"; // name is the project name otherwise

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <InstallPackageForm packageManager={packageManager} onSuccess={refetch} />
      {isTreeSupported && (
        <div className={cn(PANEL_TOOLBAR_ROW, "justify-between gap-2")}>
          <div className="flex gap-0.5 shrink-0">
            <button
              type="button"
              className={cn(
                PANEL_SEGMENTED_ITEM,
                viewMode === "list"
                  ? PANEL_SEGMENTED_ITEM_ACTIVE
                  : PANEL_SEGMENTED_ITEM_INACTIVE,
              )}
              onClick={() => setUserViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={cn(
                PANEL_SEGMENTED_ITEM,
                viewMode === "tree"
                  ? PANEL_SEGMENTED_ITEM_ACTIVE
                  : PANEL_SEGMENTED_ITEM_INACTIVE,
              )}
              onClick={() => setUserViewMode("tree")}
            >
              Tree
            </button>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="shrink-0 border border-border px-1.5 py-0 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground rounded-[3px]"
              title={isSandbox ? "sandbox" : "project"}
            >
              {isSandbox ? "sandbox" : "project"}
            </span>
            {name && !isSandbox && (
              <span
                className="text-xs text-muted-foreground truncate min-w-0"
                title={version ? `${name} v${version}` : name}
              >
                {name}
                {version && <span className="font-code"> v{version}</span>}
              </span>
            )}
          </div>
        </div>
      )}
      {viewMode === "list" ? (
        <PackagesList packages={dependencies.list} onSuccess={refetch} />
      ) : (
        <DependencyTree
          tree={dependencies.tree}
          error={error}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

export default PackagesPanel;

const InstallPackageForm: React.FC<{
  packageManager: string;
  onSuccess: () => void;
}> = ({ onSuccess, packageManager }) => {
  const [input, setInput] = React.useState("");
  const { handleClick: openSettings } = useOpenSettingsToTab();

  // Get the packages to install from the atom
  const packagesToInstall = useAtomValue(packagesToInstallAtom);
  const setPackagesToInstall = useSetAtom(packagesToInstallAtom);

  // Set the input value when packagesToInstall changes
  React.useEffect(() => {
    if (packagesToInstall) {
      setInput(packagesToInstall);
      // Clear the atom after setting the input
      setPackagesToInstall(null);
    }
  }, [packagesToInstall, setPackagesToInstall]);

  const { loading, handleInstallPackages } = useInstallPackages();
  const onSuccessInstallPackages = () => {
    onSuccess();
    setInput("");
  };

  const installPackages = () => {
    const cleanedInput = stripPackageManagerPrefix(input);
    handleInstallPackages(
      [cleanedInput], // the backend will handle splitting the packages
      onSuccessInstallPackages,
    );
  };

  return (
    <div className={PANEL_SEARCH_ROW}>
      <SearchInput
        placeholder={`Install packages with ${packageManager}...`}
        id={PACKAGES_INPUT_ID}
        icon={
          loading ? (
            <Spinner
              size="small"
              className="mr-2 h-4 w-4 shrink-0 opacity-50"
            />
          ) : (
            <Tooltip content="Change package manager">
              <BoxIcon
                strokeWidth={1.5}
                onClick={() => openSettings("packageManagementAndData")}
                className="mr-2 h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              />
            </Tooltip>
          )
        }
        rootClassName={PANEL_SEARCH_INPUT_ROOT}
        className={PANEL_SEARCH_INPUT}
        value={input}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            installPackages();
          }
        }}
        onChange={(e) => setInput(e.target.value)}
      />
      <Tooltip
        delayDuration={300}
        side="left"
        align="start"
        content={
          <div className="text-[13px] flex flex-col w-full max-w-[360px]">
            Packages are installed using the package manager specified in your
            user configuration. Depending on your package manager, you can
            install packages with various formats:
            <div className="flex flex-col gap-2 mt-2">
              <div>
                <span className="font-bold tracking-wide">Package name:</span> A
                package name; this will install the latest version.
                <div className="text-muted-foreground">Example: httpx</div>
              </div>
              <div>
                <span className="font-bold tracking-wide">
                  Package and version:
                </span>{" "}
                A package with a specific version or version range.
                <div className="text-muted-foreground">
                  {"Examples: httpx==0.27.0, httpx>=0.27.0"}
                </div>
              </div>
              <div>
                <span className="font-bold tracking-wide">Git:</span> A Git
                repository
                <div className="text-muted-foreground">
                  Example: git+https://github.com/encode/httpx
                </div>
              </div>
              <div>
                <span className="font-bold tracking-wide">URL:</span> A remote
                wheel or source distribution.
                <div className="text-muted-foreground">
                  Example: https://example.com/httpx-0.27.0.tar.gz
                </div>
              </div>
              <div>
                <span className="font-bold tracking-wide">Path:</span> A local
                wheel, source distribution, or project directory.
                <div className="text-muted-foreground">
                  Example: /example/foo-0.1.0-py3-none-any.whl
                </div>
              </div>
            </div>
          </div>
        }
      >
        <button
          type="button"
          aria-label="Package format help"
          className={cn(PANEL_SEARCH_ACTION, "cursor-help")}
        >
          <HelpCircleIcon strokeWidth={1.5} className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip content="Install">
        <button
          type="button"
          aria-label="Install packages"
          className={cn(
            PANEL_SEARCH_ACTION,
            input && PANEL_SEGMENTED_ITEM_ACTIVE,
          )}
          onClick={installPackages}
          disabled={!input}
        >
          <PlusIcon strokeWidth={1.5} className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
};

const PackagesList: React.FC<{
  onSuccess: () => void;
  packages: { name: string; version: string }[];
}> = ({ onSuccess, packages }) => {
  // Sort case-insensitively so packages are strictly alphabetical
  // regardless of capitalization (package managers sort inconsistently).
  const sortedPackages = React.useMemo(
    () =>
      packages.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [packages],
  );

  if (packages.length === 0) {
    return (
      <PanelEmptyState
        title="No packages"
        description="No packages are installed in this environment."
        icon={<BoxIcon />}
      />
    );
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 px-2 text-[10px] font-mono font-medium uppercase tracking-[0.12em]">
            Name
          </TableHead>
          <TableHead className="h-8 w-22 px-2 text-right text-[10px] font-mono font-medium uppercase tracking-[0.12em]">
            Version
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedPackages.map((item) => (
          <TableRow
            key={item.name}
            className="group cursor-pointer hover:bg-[var(--hover-wash)]"
            onClick={async () => {
              await copyToClipboard(`${item.name}==${item.version}`);
              toast({
                title: "Copied to clipboard",
              });
            }}
          >
            <TableCell
              className="px-2 py-1.5 text-[13px] truncate"
              title={item.name}
            >
              {item.name}
            </TableCell>
            {/* Version and the hover-revealed actions share one right-aligned
                column, so there's no empty gutter reserved for the actions. */}
            <TableCell className="w-22 px-2 py-1.5 text-right align-middle">
              <span
                className="block truncate font-code text-xs text-muted-foreground group-hover:hidden"
                title={item.version}
              >
                {item.version}
              </span>
              <span className="hidden items-center justify-end group-hover:flex">
                <UpgradeButton packageName={item.name} onSuccess={onSuccess} />
                <RemoveButton packageName={item.name} onSuccess={onSuccess} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const UpgradeButton: React.FC<{
  packageName: string;
  tags?: { kind: string; value: string }[];
  onSuccess: () => void;
}> = ({ packageName, tags, onSuccess }) => {
  const [loading, setLoading] = React.useState(false);
  const { addPackage } = useRequestClient();

  // Hide upgrade button in WASM
  if (isWasm()) {
    return null;
  }

  const handleUpgradePackage = async () => {
    try {
      setLoading(true);
      const group = tags?.find((tag) => tag.kind === "group")?.value;
      const response = await addPackage({
        package: packageName,
        upgrade: true,
        group,
      });
      if (response.success) {
        onSuccess();
        showUpgradePackageToast(packageName);
      } else {
        showUpgradePackageToast(packageName, response.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PackageActionButton
      onClick={handleUpgradePackage}
      loading={loading}
      label="Upgrade"
      icon={<ArrowUpCircleIcon strokeWidth={1.5} className="h-3.5 w-3.5" />}
    />
  );
};

const RemoveButton: React.FC<{
  packageName: string;
  tags?: { kind: string; value: string }[];
  onSuccess: () => void;
}> = ({ packageName, tags, onSuccess }) => {
  const [loading, setLoading] = React.useState(false);
  const { removePackage } = useRequestClient();

  const handleRemovePackage = async () => {
    try {
      setLoading(true);
      const group = tags?.find((tag) => tag.kind === "group")?.value;
      const response = await removePackage({
        package: packageName,
        group,
      });
      if (response.success) {
        onSuccess();
        showRemovePackageToast(packageName);
      } else {
        showRemovePackageToast(packageName, response.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PackageActionButton
      onClick={handleRemovePackage}
      loading={loading}
      label="Remove"
      icon={<Trash2Icon strokeWidth={1.5} className="h-3.5 w-3.5" />}
    />
  );
};

const DependencyTree: React.FC<{
  tree: DependencyTreeNode | null;
  error?: Error | null;
  onSuccess: () => void;
}> = ({ tree, error, onSuccess }) => {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    new Set(),
  );

  // Node ids are name paths (e.g. "root-pandas-numpy"), so expansion state
  // survives refetches. When tree data changes, prune only the ids that no
  // longer exist instead of collapsing everything.
  React.useEffect(() => {
    setExpandedNodes((prev) => {
      if (prev.size === 0 || !tree) {
        return prev;
      }
      const valid = new Set<string>();
      const walk = (nodes: DependencyTreeNode[], prefix: string) => {
        for (const node of nodes) {
          const id = `${prefix}-${node.name}`;
          valid.add(id);
          walk(node.dependencies, id);
        }
      };
      walk(tree.dependencies, "root");
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tree]);

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (!tree) {
    return <Spinner size="medium" centered={true} />;
  }

  if (tree.dependencies.length === 0) {
    return (
      <PanelEmptyState
        title="No dependencies"
        description="No package dependencies found in this environment."
        icon={<BoxIcon />}
      />
    );
  }

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div>
        {tree.dependencies.map((dep, index) => (
          <div key={`${dep.name}-${index}`} className="border-b">
            <DependencyTreeNode
              nodeId={`root-${dep.name}`}
              node={dep}
              level={0}
              isTopLevel={true}
              expandedNodes={expandedNodes}
              onToggle={toggleNode}
              onSuccess={onSuccess}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const DependencyTreeNode: React.FC<{
  nodeId: string;
  node: DependencyTreeNode;
  level: number;
  isTopLevel?: boolean;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onSuccess: () => void;
}> = ({
  nodeId,
  node,
  level,
  isTopLevel = false,
  expandedNodes,
  onToggle,
  onSuccess,
}) => {
  const hasChildren = node.dependencies.length > 0;
  const isExpanded = expandedNodes.has(nodeId);
  const indent = isTopLevel ? 0 : 16 + level * 16; // Top-level uses CSS padding, children use calculated indent

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (hasChildren) {
        onToggle(nodeId);
      }
    }
    // Allow arrow keys to bubble up for tree navigation
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(nodeId);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 group cursor-pointer text-[13px] whitespace-nowrap min-h-7 rounded-[3px]",
          "hover:bg-[var(--hover-wash)] focus:bg-[var(--hover-wash)] focus:outline-hidden",
          hasChildren && "select-none",
          isTopLevel ? "px-2" : "pr-2",
        )}
        style={isTopLevel ? {} : { paddingLeft: `${indent}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-selected={false}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDownIcon
              strokeWidth={1.5}
              className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
            />
          ) : (
            <ChevronRightIcon
              strokeWidth={1.5}
              className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
            />
          )
        ) : (
          <div className="w-3.5 shrink-0" />
        )}

        {/* Package info: the name claims all free space and truncates;
            everything after it is intrinsic-width and never shrinks. */}
        <span className="font-medium truncate flex-1 min-w-0" title={node.name}>
          {node.name}
        </span>
        {node.version && (
          <span className="font-code text-xs text-muted-foreground shrink-0">
            v{node.version}
          </span>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {node.tags.map((tag, index) => {
              const tagClassName =
                "shrink-0 border px-1.5 py-0 text-[10px] font-medium rounded-[3px] truncate max-w-[72px]";
              if (tag.kind === "cycle") {
                return (
                  <div
                    key={index}
                    className={cn(
                      tagClassName,
                      "border-action-foreground/40 text-action-foreground",
                    )}
                    title="cycle"
                  >
                    cycle
                  </div>
                );
              }
              if (tag.kind === "extra") {
                return (
                  <div
                    key={index}
                    className={cn(tagClassName, "border-link/40 text-link")}
                    title={tag.value}
                  >
                    {tag.value}
                  </div>
                );
              }
              if (tag.kind === "group") {
                return (
                  <div
                    key={index}
                    className={cn(tagClassName, "border-success/40 text-success")}
                    title={tag.value}
                  >
                    {tag.value}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Actions for top-level packages; hidden (not just invisible) so
            they never steal width from the package name. */}
        {isTopLevel && (
          <div className="hidden items-center group-hover:flex shrink-0">
            <UpgradeButton
              packageName={node.name}
              tags={node.tags}
              onSuccess={onSuccess}
            />

            <RemoveButton
              packageName={node.name}
              tags={node.tags}
              onSuccess={onSuccess}
            />
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.dependencies.map((child, index) => (
            <DependencyTreeNode
              key={`${child.name}-${index}`}
              nodeId={`${nodeId}-${child.name}`}
              node={child}
              level={level + 1}
              isTopLevel={false}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSuccess={onSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function resolveViewMode(
  userViewMode: ViewMode | null,
  isTreeSupported: boolean,
): ViewMode {
  if (userViewMode === "list") {
    return "list";
  }
  if (isTreeSupported) {
    return userViewMode || "tree";
  }
  return "list";
}
