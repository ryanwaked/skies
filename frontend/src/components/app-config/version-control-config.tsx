/* Copyright 2026 Marimo. All rights reserved. */

import { CheckCircle2Icon, Github, XCircleIcon } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { UserConfig } from "@/core/config/config-schema";
import { useRequestClient } from "@/core/network/requests";
import { ApiKey } from "./ai-config";
import { SettingGroup } from "./common";
import { Button } from "../ui/button";
import { ExternalLink } from "../ui/links";

interface Props {
  form: UseFormReturn<UserConfig>;
  config: UserConfig;
  onSubmit: (values: UserConfig) => void;
}

type VerifyStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "connected"; username: string }
  | { state: "error"; message: string };

/**
 * App-level "sign in" to a git hosting provider (GitHub today; a
 * self-hosted provider can follow the same shape later). The token is
 * used by the per-notebook Version History panel to create repositories
 * and push saved versions — it's unrelated to `ai.github`, which is for
 * GitHub Copilot completions.
 */
export const VersionControlConfig: React.FC<Props> = ({ form, config }) => {
  const { verifyGitProvider } = useRequestClient();
  const [status, setStatus] = useState<VerifyStatus>({ state: "idle" });

  const hasToken = Boolean(config.version_control?.github?.token);

  const handleVerify = async () => {
    setStatus({ state: "checking" });
    const result = await verifyGitProvider();
    if (result.success) {
      setStatus({ state: "connected", username: result.username ?? "" });
    } else {
      setStatus({
        state: "error",
        message: result.message ?? "Could not verify this token.",
      });
    }
  };

  return (
    <SettingGroup title="Version control">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Github className="h-4 w-4" />
        GitHub
      </div>
      <p className="text-sm text-muted-secondary">
        Connect a GitHub account to create repositories and push notebook
        version history from the Version history panel. Create a personal
        access token with <code>repo</code> scope at{" "}
        <ExternalLink href="https://github.com/settings/tokens">
          github.com/settings/tokens
        </ExternalLink>
        .
      </p>
      <ApiKey
        form={form}
        config={config}
        name="version_control.github.token"
        label="Personal access token"
        placeholder="ghp_..."
        testId="github-token-input"
        onChange={() => setStatus({ state: "idle" })}
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={!hasToken || status.state === "checking"}
          onClick={handleVerify}
          data-testid="github-verify-button"
        >
          {status.state === "checking" ? "Checking…" : "Verify connection"}
        </Button>
        {status.state === "connected" && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2Icon className="h-4 w-4" />
            Connected as {status.username}
          </span>
        )}
        {status.state === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircleIcon className="h-4 w-4" />
            {status.message}
          </span>
        )}
      </div>
    </SettingGroup>
  );
};
