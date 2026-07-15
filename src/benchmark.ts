import "dotenv/config";
import { translate } from "./llm.js";
import { synthesize } from "./tts.js";

async function runBenchmark() {
  console.log("Starting benchmark...\n");

  // 1. Measure LLM translation latency
  const text = "Привет, как твои дела сегодня?";
  console.log(`1. Testing LLM translation on: "${text}"`);
  const t0 = Date.now();
  const translated = await translate(text);
  const t1 = Date.now();
  console.log(`   Result: "${translated}"`);
  console.log(`   LLM Latency: ${t1 - t0} ms\n`);

  // 2. Measure Kokoro TTS latency
  console.log(`2. Testing Kokoro TTS on: "${translated}"`);
  const t2 = Date.now();
  const audio = await synthesize(translated);
  const t3 = Date.now();
  console.log(`   Result audio size: ${audio.length} bytes`);
  console.log(`   Kokoro Latency: ${t3 - t2} ms\n`);

  console.log(`Total Latency: ${(t1 - t0) + (t3 - t2)} ms`);
}

runBenchmark().catch(console.error);
