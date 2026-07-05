/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { addLocalComponent } from "@/core/components/local-components";

/**
 * Compact form for saving a cell's code as a reusable local component.
 */
export const SaveComponentModal: React.FC<{
  initialName: string;
  code: string;
  onClose: () => void;
}> = ({ initialName, code, onClose }) => {
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    addLocalComponent({ name, description, code });
    toast({ description: "Component saved" });
    onClose();
  };

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Save as component</DialogTitle>
          <DialogDescription>
            Save this cell's code as a reusable component. Components are
            stored in your browser and can be inserted into any notebook from
            the Components panel or the add-cell toolbar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="component-name">Name</Label>
            <Input
              id="component-name"
              data-testid="component-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My component"
              required={true}
              autoFocus={true}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-description">Description</Label>
            <Input
              id="component-description"
              data-testid="component-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="component-code">Code</Label>
            <pre
              id="component-code"
              className="font-code text-xs bg-muted rounded-[3px] border p-2 max-h-40 overflow-auto whitespace-pre"
            >
              {code}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            Save component
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
