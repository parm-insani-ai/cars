import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  postCallFollowup,
  followUpDispatcher,
  noShowDetection,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [postCallFollowup, followUpDispatcher, noShowDetection],
});
