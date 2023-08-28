// /**
//  * @file generate.ts
//  * @author Chris Connolly <cconnolly@twilio.com>
//  * @version 1.0.0
//  */

// // Imports global types
// import "@twilio-labs/serverless-runtime-types";
// // Fetches specific types
// import {
//   Context,
//   ServerlessCallback,
//   ServerlessFunctionSignature,
// } from "@twilio-labs/serverless-runtime-types/types";

// import fs from "fs";
// import path from "path";
// import { createJsonTranslator, createOpenAILanguageModel } from "typechat";
// import { IVRAction } from "../../../assets/ivr_schema";

// // ***********************************************************
// // Environment Vars
// // ***********************************************************
// export type MyFunctionContext = {
//   DEFAULT_STUDIO_FLOW: string;
//   ACCOUNT_SID: string;
//   AUTH_TOKEN: string;
//   TWILIO_API_KEY: string;
//   TWILIO_API_SECRET: string;
//   OPENAI_MODEL: string;
//   OPENAI_API_KEY: string;
// };

// // ***********************************************************
// // Event Properties
// // ***********************************************************
// export type EventProperties = {
//   prompt: string;
// };

// // ***********************************************************
// //
// // SERVERLESS HANDLER ENTRY POINT
// //
// // ***********************************************************
// export const handler: ServerlessFunctionSignature<
//   MyFunctionContext,
//   EventProperties
// > = async function (
//   context: Context<MyFunctionContext>,
//   event: EventProperties,
//   callback: ServerlessCallback
// ) {
//   console.log("TypeChat Proto");

//   const response = new Twilio.Response();

//   response.appendHeader("Access-Control-Allow-Origin", "*");
//   response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
//   response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
//   response.appendHeader("Content-Type", "application/json");

//   const model = createOpenAILanguageModel(
//     context.OPENAI_API_KEY,
//     context.OPENAI_MODEL
//   );
//   const schema = fs.readFileSync(
//     path.join(__dirname + "../../../assets/", "ivr_schema.ts"),
//     "utf8"
//   );

//   const translator = createJsonTranslator<IVRAction>(model, schema, "Action");

//   const ai_response = await translator.translate(event.prompt);
//   if (!ai_response.success) {
//     console.log(ai_response.message);
//     return;
//   }
//   console.log(`Response is`, ai_response);
//   response.setBody(ai_response);
//   return callback(null, response);
// };
