import { redirect } from "next/navigation";

/** The settings now live on one page; this keeps old links working. */
export default function Page() {
  redirect("/settings?tab=policies");
}
