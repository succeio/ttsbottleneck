import "dotenv/config";
import fs from "node:fs";

import { translate } from "./llm.js";
import { synthesize } from "./tts.js";


const translated = await translate(
  "Всем привет, как ваши дела?"
);

console.log("TRANSLATION:");
console.log(translated);


const audio = await synthesize(
  translated
);


fs.writeFileSync(
  "test.pcm",
  audio
);


console.log(
  "Saved:",
  audio.length,
  "bytes"
);
