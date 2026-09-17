"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The edit/remove pair at the end of a master-data row.
 *
 * Shared because five tables need exactly the same thing, and because the part
 * worth getting right once is the accessible name: five rows of anonymous
 * pencil icons are indistinguishable to a screen reader, so each one names the
 * record it acts on.
 */
export function RowActions({
  label,
  onEdit,
  onRemove,
  removeLabel = "Delete",
  removeIcon,
}: {
  /** The record's own name, used to distinguish one row's buttons from another's. */
  label: string;
  onEdit: () => void;
  onRemove: () => void;
  removeLabel?: string;
  removeIcon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
        title="Edit"
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`${removeLabel} ${label}`}
        title={removeLabel}
      >
        {removeIcon ?? <Trash2 />}
      </Button>
    </div>
  );
}
