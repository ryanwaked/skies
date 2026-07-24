/* Copyright 2026 Marimo. All rights reserved. */

import {
  ChevronDownIcon,
  ExternalLinkIcon,
  InfoIcon,
  PowerOffIcon,
  ZapIcon,
  ZapOffIcon,
} from "lucide-react";
import type React from "react";
import { DisableIfOverridden } from "@/components/app-config/is-overridden";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink } from "@/components/ui/links";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useResolvedMarimoConfig } from "@/core/config/config";
import { useRequestClient } from "@/core/network/requests";
import { isWasm } from "@/core/wasm/utils";
import { cn } from "@/utils/cn";
import { FooterItem } from "../footer-item";

interface RuntimeSettingsProps {
  className?: string;
  /** "footer" = the status-bar item; "rail" = a 36×36 icon button. */
  variant?: "footer" | "rail";
}

export const RuntimeSettings: React.FC<RuntimeSettingsProps> = ({
  className,
  variant = "footer",
}) => {
  const { saveUserConfig } = useRequestClient();
  const [config, setUserConfig] = useResolvedMarimoConfig();

  const handleStartupToggle = async (checked: boolean) => {
    // Send only the changed portion to avoid overwriting other config values
    await saveUserConfig({
      config: { runtime: { auto_instantiate: checked } },
    }).then(() => {
      // Update local state with merged config
      setUserConfig((prev) => ({
        ...prev,
        runtime: { ...prev.runtime, auto_instantiate: checked },
      }));
    });
  };

  const handleCellChangeToggle = async (checked: boolean) => {
    const onCellChange = checked ? "autorun" : "lazy";
    // Send only the changed portion to avoid overwriting other config values
    await saveUserConfig({
      config: { runtime: { on_cell_change: onCellChange } },
    }).then(() => {
      // Update local state with merged config
      setUserConfig((prev) => ({
        ...prev,
        runtime: { ...prev.runtime, on_cell_change: onCellChange },
      }));
    });
  };

  const handleModuleReloadChange = async (
    option: "off" | "lazy" | "autorun",
  ) => {
    // Send only the changed portion to avoid overwriting other config values
    await saveUserConfig({
      config: { runtime: { auto_reload: option } },
    }).then(() => {
      // Update local state with merged config
      setUserConfig((prev) => ({
        ...prev,
        runtime: { ...prev.runtime, auto_reload: option },
      }));
    });
  };

  // Check if all reactivity is disabled
  const allReactivityDisabled =
    !config.runtime.auto_instantiate &&
    config.runtime.on_cell_change === "lazy" &&
    (isWasm() || config.runtime.auto_reload !== "autorun");

  const zapIcon = allReactivityDisabled ? (
    <ZapOffIcon
      size={variant === "rail" ? 16 : 14}
      strokeWidth={1.5}
      className="text-muted-foreground"
    />
  ) : (
    <ZapIcon
      size={variant === "rail" ? 16 : 14}
      strokeWidth={1.5}
      // In the rail, match the neutral icon treatment; in the footer keep the
      // action color so reactivity-on reads as a status.
      className={
        variant === "rail" ? "text-foreground" : "text-action-foreground"
      }
    />
  );

  return (
    <DropdownMenu>
      {/* Tooltip must wrap the trigger (not the reverse): DropdownMenuTrigger's
          `asChild` merges its click/ref onto its direct child, so the button
          has to be that direct child or the menu never opens. */}
      {variant === "rail" ? (
        <Tooltip content="Runtime reactivity" side="right" delayDuration={200}>
          <DropdownMenuTrigger asChild={true}>
            <button
              type="button"
              aria-label="Runtime reactivity"
              data-testid="rail-runtime-settings"
              className={cn(
                "flex h-[36px] w-[36px] items-center justify-center rounded-[3px] text-foreground hover:bg-[var(--hover-wash)]",
                className,
              )}
            >
              {zapIcon}
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild={true}>
          <FooterItem
            tooltip="Runtime reactivity"
            selected={false}
            data-testid="footer-runtime-settings"
            className={className}
          >
            <div className="flex items-center gap-1">
              {zapIcon}
              <ChevronDownIcon size={12} strokeWidth={1.5} />
            </div>
          </FooterItem>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align="start"
        side={variant === "rail" ? "right" : undefined}
        className="w-64"
      >
        <DropdownMenuLabel>
          <div className="flex items-center justify-between w-full">
            <span>Runtime reactivity</span>
            <ExternalLink href="https://links.marimo.app/runtime-configuration">
              <span className="text-xs font-normal flex items-center gap-1">
                Docs
                <ExternalLinkIcon className="w-3 h-3" />
              </span>
            </ExternalLink>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <TooltipProvider>
          {/* On startup toggle */}
          <DisableIfOverridden name="runtime.auto_instantiate">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center space-x-2">
                {config.runtime.auto_instantiate ? (
                  <ZapIcon
                    size={14}
                    strokeWidth={1.5}
                    className="text-action-foreground"
                  />
                ) : (
                  <ZapOffIcon
                    size={14}
                    strokeWidth={1.5}
                    className="text-muted-foreground"
                  />
                )}
                <div>
                  <div className="text-[13px] font-medium flex items-center gap-1">
                    On startup
                    <Tooltip
                      content={
                        <div className="max-w-[200px]">
                          Whether to automatically run the notebook on startup
                        </div>
                      }
                    >
                      <InfoIcon className="w-3 h-3" />
                    </Tooltip>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.runtime.auto_instantiate ? "autorun" : "lazy"}
                  </div>
                </div>
              </div>
              <Switch
                checked={config.runtime.auto_instantiate}
                onCheckedChange={handleStartupToggle}
                size="sm"
              />
            </div>
          </DisableIfOverridden>

          <DropdownMenuSeparator />

          {/* On cell change toggle */}
          <DisableIfOverridden name="runtime.on_cell_change">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center space-x-2">
                {config.runtime.on_cell_change === "autorun" ? (
                  <ZapIcon
                    size={14}
                    strokeWidth={1.5}
                    className="text-action-foreground"
                  />
                ) : (
                  <ZapOffIcon
                    size={14}
                    strokeWidth={1.5}
                    className="text-muted-foreground"
                  />
                )}
                <div>
                  <div className="text-[13px] font-medium flex items-center gap-1">
                    On cell change
                    <Tooltip
                      content={
                        <div className="max-w-[300px]">
                          Whether to automatically run dependent cells after
                          running a cell
                        </div>
                      }
                    >
                      <InfoIcon className="w-3 h-3" />
                    </Tooltip>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.runtime.on_cell_change}
                  </div>
                </div>
              </div>
              <Switch
                checked={config.runtime.on_cell_change === "autorun"}
                onCheckedChange={handleCellChangeToggle}
                size="sm"
              />
            </div>
          </DisableIfOverridden>

          {!isWasm() && (
            <>
              <DropdownMenuSeparator />

              {/* On module change dropdown */}
              <DisableIfOverridden name="runtime.auto_reload">
                <div className="px-2 py-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {config.runtime.auto_reload === "off" && (
                      <PowerOffIcon
                        size={14}
                        strokeWidth={1.5}
                        className="text-muted-foreground"
                      />
                    )}
                    {config.runtime.auto_reload === "lazy" && (
                      <ZapOffIcon
                        size={14}
                        strokeWidth={1.5}
                        className="text-muted-foreground"
                      />
                    )}
                    {config.runtime.auto_reload === "autorun" && (
                      <ZapIcon
                        size={14}
                        strokeWidth={1.5}
                        className="text-action-foreground"
                      />
                    )}
                    <div>
                      <div className="text-[13px] font-medium flex items-center gap-1">
                        On module change
                        <Tooltip
                          content={
                            <div className="max-w-[300px]">
                              Whether to run affected cells, mark them as stale,
                              or do nothing when an external module is updated
                            </div>
                          }
                        >
                          <InfoIcon className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {config.runtime.auto_reload}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {["off", "lazy", "autorun"].map((option) => (
                      <button
                        key={option}
                        onClick={() =>
                          handleModuleReloadChange(
                            option as "off" | "lazy" | "autorun",
                          )
                        }
                        className={cn(
                          "w-full flex items-center px-2 py-1 text-[13px] rounded-sm hover:bg-[var(--hover-wash)]",
                          option === config.runtime.auto_reload &&
                            "bg-primary/[0.07] text-primary hover:bg-primary/[0.07]",
                        )}
                      >
                        {option === "off" && (
                          <PowerOffIcon
                            size={12}
                            strokeWidth={1.5}
                            className="mr-2"
                          />
                        )}
                        {option === "lazy" && (
                          <ZapOffIcon
                            size={12}
                            strokeWidth={1.5}
                            className="mr-2"
                          />
                        )}
                        {option === "autorun" && (
                          <ZapIcon
                            size={12}
                            strokeWidth={1.5}
                            className="mr-2"
                          />
                        )}
                        <span className="capitalize">{option}</span>
                        {option === config.runtime.auto_reload && (
                          <span className="ml-auto">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </DisableIfOverridden>
            </>
          )}
        </TooltipProvider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
