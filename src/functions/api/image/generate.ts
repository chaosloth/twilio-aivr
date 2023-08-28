/**
 * @file generate.ts
 * @author Chris Connolly <cconnolly@twilio.com>
 * @version 1.0.0
 */

// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ***********************************************************
// Environment Vars
// ***********************************************************
export type MyFunctionContext = {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  OPENAI_MODEL: string;
  OPENAI_API_KEY: string;
  OPENAI_IMAGE_GEN_URL: string;
  QSTASH_TOKEN: string;
  DOMAIN_URL_OVERRIDE?: string;
  QSTASH_URL: string;
  SUPABASE_PROJECT_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
};

// ***********************************************************
// Event Properties
// ***********************************************************
export type EventProperties = {
  prompt: string;
  to: string;
  mssid?: string;
  from?: string;
};

// ***********************************************************
//
// SERVERLESS HANDLER ENTRY POINT
//
// ***********************************************************
export const handler: ServerlessFunctionSignature<
  MyFunctionContext,
  EventProperties
> = async function (
  context: Context<MyFunctionContext>,
  event: EventProperties,
  callback: ServerlessCallback
) {
  console.log("AI Image Generation", event);

  const response = new Twilio.Response();

  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.appendHeader("Content-Type", "application/json");

  if (!event.prompt || !event.to) {
    response.setStatusCode(400);
    response.setBody({ status: "missing required params" });
    return callback(null, response);
  }

  if (!event.mssid && !event.from) {
    response.setStatusCode(400);
    response.setBody({ status: "missing required params" });
    return callback(null, response);
  }

  try {
    // Store log
    const supabase = createClient(
      context.SUPABASE_PROJECT_URL,
      context.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false } }
    );

    // Generate request and send to QStash
    const qstash_request_url = `${
      context.QSTASH_URL + context.OPENAI_IMAGE_GEN_URL
    }`;

    console.log(`QStash Request URL: ${qstash_request_url}`);

    let qstash_callback_url = `${
      context.DOMAIN_URL_OVERRIDE || "https://" + context.DOMAIN_NAME
    }/api/image/composite?to=${encodeURIComponent(event.to)}`;

    if (event.mssid)
      qstash_callback_url += `&mssid=${encodeURIComponent(event.mssid)}`;
    if (event.from)
      qstash_callback_url += `&from=${encodeURIComponent(event.from)}`;

    console.log(`QStash Callback URL: ${qstash_callback_url}`);

    const res = await fetch(qstash_request_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.QSTASH_TOKEN}`,
        // Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "upstash-forward-Authorization": `Bearer ${context.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "Upstash-Callback": qstash_callback_url,
      },
      body: JSON.stringify({
        prompt: event.prompt,
        n: 1,
        size: "512x512",
      }),
    });

    const qstash_response = await res.json();
    console.log("QStask response", qstash_response);

    await supabase.from("AI_LOG").insert({
      prompt: event.prompt,
      to: event.to,
      from: event.from || event.mssid,
      correlation: qstash_response.messageId,
    });

    response.setBody(qstash_response);
    response.setStatusCode(res.status);

    return callback(null, response);
  } catch (err) {
    console.log("Error generating AI image", err);
    response.setStatusCode(500);
    response.setBody({ status: "error" });
    return callback(null, response);
  }
};
