/* Copyright 2026 Marimo. All rights reserved. */

import {
  CheckCircle2Icon,
  PlusIcon,
  ServerIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type {
  RemoteComputeTargetConfig,
  UserConfig,
} from "@/core/config/config-schema";
import { useRequestClient } from "@/core/network/requests";
import { SettingGroup } from "./common";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ExternalLink } from "../ui/links";

interface Props {
  form: UseFormReturn<UserConfig>;
  config: UserConfig;
  onSubmit: (values: UserConfig) => void;
}

type VerifyStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "connected" }
  | { state: "error"; message: string };

const EMPTY_TARGET: RemoteComputeTargetConfig = {
  name: "",
  ssh_destination: "",
  remote_python: "python3",
};

/**
 * App-level configuration of remote-compute targets: named SSH destinations
 * a notebook's kernel can be launched on. Targets configured here appear in
 * the per-notebook "Run on" menu; selecting one there tunnels the kernel's
 * ZeroMQ protocol over `ssh -R` to that machine.
 */
export const RemoteComputeConfig: React.FC<Props> = ({
  form,
  config,
  onSubmit,
}) => {
  const { verifyRemoteComputeTarget } = useRequestClient();
  const targets = config.remote_compute?.targets ?? [];

  const commit = (next: RemoteComputeTargetConfig[]) => {
    form.setValue("remote_compute.targets", next, { shouldDirty: true });
    onSubmit(form.getValues());
  };

  const updateTarget = (
    index: number,
    patch: Partial<RemoteComputeTargetConfig>,
  ) => {
    commit(
      targets.map((target, i) =>
        i === index ? { ...target, ...patch } : target,
      ),
    );
  };

  const addTarget = () => {
    commit([...targets, { ...EMPTY_TARGET }]);
  };

  const removeTarget = (index: number) => {
    commit(targets.filter((_, i) => i !== index));
  };

  return (
    <SettingGroup title="Remote compute (SSH)">
      <p className="text-sm text-muted-secondary">
        Run a notebook's kernel on another machine over SSH. marimo shells out
        to your system <code>ssh</code>/<code>scp</code>, so your existing SSH
        config — keys, agent forwarding, <code>ProxyJump</code>, 2FA, and{" "}
        <code>Host</code> aliases — is used automatically. Each target's
        interpreter must already have <code>marimo</code> and <code>pyzmq</code>{" "}
        installed. Pick a target per notebook from the{" "}
        <span className="font-medium">Run on</span> menu.{" "}
        <ExternalLink href="https://docs.marimo.io/guides/editor_features/remote_compute/">
          Learn more
        </ExternalLink>
        .
      </p>

      {targets.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No remote targets configured yet.
        </p>
      )}

      {targets.map((target, index) => (
        <TargetRow
          // biome-ignore lint/suspicious/noArrayIndexKey: targets have no stable id; order is user-controlled
          key={index}
          target={target}
          verify={verifyRemoteComputeTarget}
          onChange={(patch) => updateTarget(index, patch)}
          onRemove={() => removeTarget(index)}
        />
      ))}

      <div>
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={addTarget}
          data-testid="remote-compute-add-target"
        >
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          Add target
        </Button>
      </div>
    </SettingGroup>
  );
};

interface TargetRowProps {
  target: RemoteComputeTargetConfig;
  verify: ReturnType<typeof useRequestClient>["verifyRemoteComputeTarget"];
  onChange: (patch: Partial<RemoteComputeTargetConfig>) => void;
  onRemove: () => void;
}

const TargetRow: React.FC<TargetRowProps> = ({
  target,
  verify,
  onChange,
  onRemove,
}) => {
  const [status, setStatus] = useState<VerifyStatus>({ state: "idle" });
  const destinationId = useId();
  const pythonId = useId();
  const workdirId = useId();

  const handleVerify = async () => {
    setStatus({ state: "checking" });
    const result = await verify({ sshDestination: target.ssh_destination });
    if (result.success) {
      setStatus({ state: "connected" });
    } else {
      setStatus({
        state: "error",
        message: result.message ?? "Could not connect over SSH.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <ServerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          data-testid="remote-compute-target-name"
          className="h-8"
          placeholder="Name (e.g. GPU box)"
          value={target.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Button
          size="icon"
          variant="ghost"
          type="button"
          className="shrink-0"
          aria-label="Remove target"
          data-testid="remote-compute-remove-target"
          onClick={onRemove}
        >
          <Trash2Icon className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label
          htmlFor={destinationId}
          className="flex flex-col gap-1 text-xs text-muted-foreground"
        >
          SSH destination
          <Input
            id={destinationId}
            data-testid="remote-compute-target-destination"
            className="h-8"
            placeholder="user@host"
            value={target.ssh_destination}
            onChange={(e) => {
              onChange({ ssh_destination: e.target.value });
              setStatus({ state: "idle" });
            }}
          />
        </label>
        <label
          htmlFor={pythonId}
          className="flex flex-col gap-1 text-xs text-muted-foreground"
        >
          Remote Python
          <Input
            id={pythonId}
            data-testid="remote-compute-target-python"
            className="h-8"
            placeholder="python3"
            value={target.remote_python}
            onChange={(e) => onChange({ remote_python: e.target.value })}
          />
        </label>
        <label
          htmlFor={workdirId}
          className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2"
        >
          Remote working directory (optional)
          <Input
            id={workdirId}
            data-testid="remote-compute-target-workdir"
            className="h-8"
            placeholder="~/.marimo/remote_compute/<notebook>"
            value={target.remote_workdir ?? ""}
            onChange={(e) =>
              onChange({ remote_workdir: e.target.value || undefined })
            }
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={!target.ssh_destination || status.state === "checking"}
          onClick={handleVerify}
          data-testid="remote-compute-verify"
        >
          {status.state === "checking" ? "Checking…" : "Verify connection"}
        </Button>
        {status.state === "connected" && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2Icon className="h-4 w-4" />
            Reachable
          </span>
        )}
        {status.state === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircleIcon className="h-4 w-4" />
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
};
