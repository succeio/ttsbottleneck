import "dotenv/config";

import express from "express";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { translate } from "./llm.js";
import { synthesize } from "./tts.js";
import { createDeepgram } from "./deepgram.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();


app.use(
  express.static(
    path.join(__dirname, "../public")
  )
);


const PORT = Number(
  process.env.PORT ?? 3000
);


const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `HTTP server started: ${PORT}`
    );
  }
);



class TaskQueue {
  private queue: Promise<any> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task);
    this.queue = next.catch(() => {});
    return next;
  }
}



function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9а-яё]/g, "");
}



const wss = new WebSocketServer({
  server,
});



wss.on(
  "connection",
  (client) => {

    console.log(
      "Browser connected"
    );


    const deepgram =
      createDeepgram();

    const queue = new TaskQueue();
    let latestTranscript = "";
    let debounceTimer: NodeJS.Timeout | null = null;
    let processedText = "";



    deepgram.on(
      "open",
      () => {

        console.log(
          "Deepgram socket opened"
        );

      }
    );



    deepgram.on(
      "message",
      async (raw) => {

        try {

          const msg =
            JSON.parse(
              raw.toString()
            );


          const transcript =
            msg.channel
              ?.alternatives?.[0]
              ?.transcript?.trim();


          if (!transcript) {
            return;
          }

          if (transcript === processedText) {
            if (msg.is_final) {
              processedText = "";
            }
            return;
          }

          latestTranscript = transcript;

          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }

          const triggerTranslation = () => {
            const textToTranslate = latestTranscript;
            if (!textToTranslate || textToTranslate === processedText) {
              return;
            }

            processedText = textToTranslate;
            latestTranscript = "";

            queue.enqueue(async () => {
              try {
                console.log("STT segment:", textToTranslate);
                const translated = await translate(textToTranslate);
                console.log("TRANSLATION:", translated);
                const audio = await synthesize(translated);
                console.log("TTS bytes:", audio.length);

                if (client.readyState === 1) {
                  client.send(audio, { binary: true });
                  console.log("Sending audio:", audio.length);
                }
              } catch (err) {
                console.error("Queue task error:", err);
              }
            });
          };

          if (msg.is_final) {
            triggerTranslation();
            processedText = "";
          } else {
            debounceTimer = setTimeout(() => {
              triggerTranslation();
            }, 1500); // 1.5 seconds debounce
          }

        } catch(error) {

          console.error(
            "Deepgram message error:",
            error
          );

        }

      }
    );



    deepgram.on(
      "error",
      (err) => {

        console.error(
          "Deepgram error:",
          err
        );

      }
    );



    let audioCounter = 0;


    client.on(
      "message",
      (data, isBinary) => {

        if (!isBinary) {
          return;
        }


        audioCounter++;


        if (audioCounter % 50 === 0) {
          console.log(
            "PCM chunks:",
            audioCounter,
            "bytes:",
            data.length
          );
        }


        if (
          deepgram.readyState === 1
        ) {
          deepgram.send(data);
        }

      }
    );



    client.on(
      "close",
      () => {

        console.log(
          "Browser disconnected"
        );


        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }


        if (
          deepgram.readyState === 1
        ) {

          deepgram.close();

        }

      }
    );


  }
);
