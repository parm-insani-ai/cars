import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  leadCadence,
  missedCallRecovery,
  serviceOppOnROCreated,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [leadCadence, missedCallRecovery, serviceOppOnROCreated],
});
