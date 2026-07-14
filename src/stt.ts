import WebSocket from "ws";

export function createSTT() {

  return new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova-3&language=ru&encoding=linear16&sample_rate=16000",
    {
      headers: {
        Authorization:
          `Token ${process.env.DEEPGRAM_API_KEY}`
      }
    }
  );

}
