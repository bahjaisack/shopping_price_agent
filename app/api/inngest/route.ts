
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { shoppingWorkflow } from "@/lib/workflow";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [shoppingWorkflow],
});
