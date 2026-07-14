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


          if (
            transcript &&
            msg.is_final
          ) {

            console.log(
              "STT:",
              transcript
            );


            const translated =
              await translate(
                transcript
              );


            console.log(
              "TRANSLATION:",
              translated
            );


            const audio =
              await synthesize(
                translated
              );

            console.log(
              "TTS bytes:",
              audio.length
            );

            if (
              client.readyState === 1
            ) {

              client.send(
                audio,
                {
                  binary: true
                }
              );

              console.log(
                "Sending audio:",
                audio.length
              );

            }

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


        if (
          deepgram.readyState === 1
        ) {

          deepgram.close();

        }

      }
    );


  }
);
