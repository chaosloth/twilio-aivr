# AI(IVR)

A multi-modal AI bot that generates images based on spoken or written input. This is a Twilio serverless project that exposes functions to generate images and wait for a processing callback. Using the example Studio flow you can call in to a Twilio number and ask for the image to be generated, an MMS will be sent to you with the result. The same can be done by starting the conversation via SMS.

![Crab holding a light saber](src/assets/crab.png)

This project uses some cool tools such as:
- [Supabase](https://supabase.com) for storing media objects and a simple log of requests
- [Upstash](https://upstash.com) for offloading long running operations
- [JIMP](https://github.com/jimp-dev/jimp) for image compositing
- [OpenAI](https://openai.com) for image generation


## Long running operations
Due to the 10 second limit imposed on serverless function run time, this project uses Upstash > QStash for dispatching long operations with callbacks. The Twilio serverless project has its logic split across two functions, one for generation, the other for images compositing. When a new request is made to generate an image from a prompt, the `/api/image/generate` function is invoked, which inserts the authentication credentials and invokes QStash and stores a record of the request in Supabase.

Once QStash completes it invokes a callback function, in this case `/api/image/composite` is called. After performing additional operations the request is updated in Supbase using the message ID as a correlation ID.

## Upstash > QStash
QStash is a great utility from Upstash that's the prefect companion to short lived serverless / edge functions. Basically it's a way to 'offload' operations that take a long time and get notified of the outcome in a distributed and scalable manner.

Invoking QStash requires a `Authorization` token to be provided, if like in the case of OpenAI the target API also requires the token in the HTTP header, prefixing the token with `upstash-forward-Authorization` will cause the downstream request to include the bearer token.

A callback URI can be passed in using the `Upstash-Callback` HTTP header, in this case it's the Twilio serverless project's `https://$context.DOMAIN_NAME}/api/image/composite` function that will be called. Note that this can be overridden using an environment variable.

## JIMP
JIMP is a image processing library written in javascript! It's super useful as we want all our logic to be within our Typescript serverless project. A few cool things I like about JIMP are that it has built-in fetch functions that take buffers and/or URIs as inputs, making it easy to pull external resources or to load them from Twilio Serverless Assets at runtime. 

For example, loading a serverless asset can be done with:
```ts
const mask_image = await Jimp.read(Runtime.getAssets()["/mask.png"].path)
```

It also converts between file formats with ease, even mixing and matching file formats using the filters. For example (like in this project) we use a JPG with a PNG mask, and then output to PNG. 

## Supabase
Supbase has become my swiss army knife for storage of files and goto platform for database storage, not only because it's ORM syntax is great but also because database procedures can be exposed as functions with little to no glue logic, just SQL... Amazing.  For this project the Twilio API I chose to use requires that media resources are passed in as URLs, I could have used the Twilio Conversations API to store the media and cut this part out, but I also wanted to store a record of request along with the prompt in the database along with the generated image so it made more sense to stick it in supabase.

In this project Supabase is used to both store files and keep a record of the entire interaction.

The `/api/image/generate` function inserts a new record each time a submission is made to OpenAI (via QStash). We store the message ID in the database entry so we can correlate it later. Once the image is generated in Open AI, the data is returned via QStash and includes the source message ID from the original request, this enables us to do an update on the record in the database with the generated file pointer, that just so happens to be stored in Supabase.


## Twilio Studio
In the `src/assets` folder of this project is an example flow that makes use of the serverless functions. Once you import the follow, make sure you update the API endpoints (Run Function) widgets to point to your previously deployed serverless functions.