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
    let processedWordsHistory: string[] = [];
    let debounceTimer: NodeJS.Timeout | null = null;



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
              ?.transcript;


          if (!transcript) {
            return;
          }

          const words = transcript.trim().split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            return;
          }

          // Align history to find rollback point in case interim hypothesis changed
          let commonPrefixLength = 0;
          const maxCheck = Math.min(processedWordsHistory.length, words.length);
          for (let i = 0; i < maxCheck; i++) {
            if (cleanWord(processedWordsHistory[i]) === cleanWord(words[i])) {
              commonPrefixLength++;
            } else {
              break;
            }
          }

          processedWordsHistory = processedWordsHistory.slice(0, commonPrefixLength);

          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }

          let currentSegmentWords: string[] = [];

          const triggerTranslation = (segmentText: string) => {
            if (debounceTimer) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }
            queue.enqueue(async () => {
              try {
                console.log("STT segment:", segmentText);
                const translated = await translate(segmentText);
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

          for (let i = processedWordsHistory.length; i < words.length; i++) {
            const word = words[i];
            currentSegmentWords.push(word);

            // Only split on punctuation if it is NOT the last word of the interim transcript
            const isPunctuation = /[.?!,;:]$/.test(word) && (i < words.length - 1);
            const isMaxLength = currentSegmentWords.length >= 18;

            if (isPunctuation || isMaxLength) {
              const segmentText = currentSegmentWords.join(" ");
              processedWordsHistory.push(...currentSegmentWords);
              currentSegmentWords = [];
              triggerTranslation(segmentText);
            }
          }

          if (currentSegmentWords.length > 0) {
            const segmentText = currentSegmentWords.join(" ");
            if (msg.is_final) {
              processedWordsHistory.push(...currentSegmentWords);
              currentSegmentWords = [];
              triggerTranslation(segmentText);
            } else {
              debounceTimer = setTimeout(() => {
                processedWordsHistory.push(...currentSegmentWords);
                triggerTranslation(segmentText);
                currentSegmentWords = [];
              }, 1000); // 1.0 second pause debounce
            }
          }

          if (msg.is_final) {
            processedWordsHistory = [];
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
