/* Copyright 2026 Marimo. All rights reserved. */

interface DisconnectedProps {
  reason: string;
}

export const Disconnected = ({ reason }: DisconnectedProps) => {
  return (
    <div className="font-mono text-center text-base text-error">
      <p>{reason}</p>
    </div>
  );
};
