// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { createClient } from "@supabase/supabase-js";
import Jimp from "jimp";
import { v4 as uuidv4 } from "uuid";

// ***********************************************************
// Environment Vars
// ***********************************************************
export type MyFunctionContext = {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  OPENAI_MODEL: string;
  OPENAI_API_KEY: string;
  SUPABASE_PROJECT_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
};

// ***********************************************************
// Event Properties
// ***********************************************************
export type EventProperties = {
  body: string;
  to: string;
  mssid?: string;
  from?: string;
  sourceMessageId: string;
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
  const start = new Date().getTime();
  console.log("AI Image Compositing");

  const response = new Twilio.Response();

  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.appendHeader("Content-Type", "application/json");

  try {
    if (!event.body || !event.to) {
      response.setStatusCode(400);
      response.setBody({ status: "missing required params" });
      return callback(null, response);
    }

    if (!event.mssid && !event.from) {
      response.setStatusCode(400);
      response.setBody({ status: "missing required params" });
      return callback(null, response);
    }

    //
    // DECODE RESPONSE FROM QSTASH
    //
    console.log("Response event:", event);

    console.log("Decoding response");
    const decoded = atob(event.body);
    const decoded_json = JSON.parse(decoded);

    console.log("Decoded JSON:", decoded_json);
    const generated_image_url = decoded_json.data[0].url;

    //
    // COMPOSITE IMAGE
    //
    console.log("Storing image");
    const image_target = await Jimp.read(generated_image_url);
    const image_mask = await Jimp.read(Runtime.getAssets()["/mask.png"].path);

    image_target.blit(image_mask, 0, 0);

    const composited_image = await image_target.getBufferAsync(Jimp.MIME_PNG);

    //
    // UPLOAD IMAGE
    //
    const supabase = createClient(
      context.SUPABASE_PROJECT_URL,
      context.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase.storage
      .from(context.SUPABASE_STORAGE_BUCKET)
      .upload(`public/${uuidv4()}.png`, composited_image.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: Jimp.MIME_PNG,
      });

    if (error) {
      console.log("Error uploading file", error);
      return;
    }

    //
    // CREATE URL
    //
    console.log("Upload result", data);
    const end_image_url = `${
      process.env.SUPABASE_PROJECT_URL
    }/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${
      data.path
    }?rand=${uuidv4()}`;
    console.log(`Uploaded URL is ${end_image_url}`);

    //
    // SEND MESSAGE
    //
    const client = context.getTwilioClient();

    // Use Message Service or From number
    if (event.mssid) {
      await client.messages.create({
        messagingServiceSid: event.mssid,
        to: decodeURIComponent(event.to),
        mediaUrl: [end_image_url],
      });
    } else {
      await client.messages.create({
        from: event.from,
        to: decodeURIComponent(event.to),
        mediaUrl: [end_image_url],
      });
    }

    //
    // LOG MESSAGE
    //
    await supabase
      .from("AI_LOG")
      .update({ url: end_image_url })
      .eq("correlation", event.sourceMessageId);

    let elapsed = new Date().getTime() - start;
    console.log(`Function run time ${elapsed}`);
    return callback(null, { message: "ok" });
  } catch (err) {
    console.log("Error masking file", err);
    response.setStatusCode(500);
    response.setBody({ status: "error" });
  }
  return callback(null, response);
};
