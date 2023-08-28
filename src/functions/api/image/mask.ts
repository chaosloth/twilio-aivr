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

import fs from "fs";
import OpenAI from "openai";
import Jimp from "jimp";

// ***********************************************************
// Environment Vars
// ***********************************************************
export type MyFunctionContext = {
  DEFAULT_STUDIO_FLOW: string;
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  TWILIO_API_KEY: string;
  TWILIO_API_SECRET: string;
  OPENAI_MODEL: string;
  OPENAI_API_KEY: string;
};

// ***********************************************************
// Event Properties
// ***********************************************************
export type EventProperties = {
  prompt: string;
  url: string;
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
  console.log("AI Image Generation");

  const response = new Twilio.Response();

  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  // response.appendHeader("Content-Type", "application/json");

  console.log("Assets", Runtime.getAssets());

  try {
    // Mask it with OpenAI
    const openai = new OpenAI();
    const mask_file_path = Runtime.getAssets()["/mask.png"].path;
    const example_file_path = Runtime.getAssets()["/example.jpeg"].path;

    if (!event.prompt || !event.url) {
      response.setStatusCode(400);
      response.setBody({ status: "missing required params" });
      return callback(null, response);
    }

    // const ai_image = await fetch(event.url);
    const image_mask = await Jimp.read(mask_file_path);
    const image_target = await Jimp.read(example_file_path);

    image_target.mask(image_mask, 0, 0);

    console.log("Masked", image_target.getBuffer);

    image_target.getBuffer(Jimp.MIME_PNG, (err, buf) => {
      if (err) {
        console.log("Error getting image", err);
        response.setStatusCode(500);
        response.setBody({ status: "error" });
        return callback(null, response);
      } else {
        response.appendHeader("Content-Type", Jimp.MIME_PNG);
        response.appendHeader("Content-Length", `${buf.length}`);
        response.setBody(buf.toString("base64url"));
        console.log(buf.toString("binary"));
        // return callback(null, response);
        return callback(null, response);
      }
    });
  } catch (err) {
    console.log("Error masking file", err);
    response.setStatusCode(500);
    response.setBody({ status: "error" });
  }
  // return callback(null, response);
};
