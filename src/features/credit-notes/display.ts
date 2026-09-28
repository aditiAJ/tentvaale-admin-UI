import type { CreditNoteStatus } from "@/features/credit-notes/types";

/** How each status is shown, kept beside the list and the detail that both use it. */
export const CREDIT_NOTE_STATUS_VARIANT: Record<
  CreditNoteStatus,
  "default" | "success" | "warning" | "destructive"
> = {
  ISSUED: "success",
  APPLIED: "default",
  REVERSED: "warning",
  CANCELLED: "destructive",
};

/** The status descriptions from CreditNoteStatus, for a badge's tooltip. */
export const CREDIT_NOTE_STATUS_MEANING: Record<CreditNoteStatus, string> = {
  ISSUED: "Live credit. Stays issued while it is partly applied.",
  APPLIED: "Fully applied; nothing remains.",
  CANCELLED: "Voided before anything was applied from it.",
  REVERSED: "Whatever remained was voided; what was already applied stays applied.",
};
