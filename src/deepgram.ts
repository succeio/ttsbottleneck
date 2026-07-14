import WebSocket from "ws";


export function createDeepgram() {

  const ws = new WebSocket(
    "wss://api.deepgram.com/v1/listen" +
    "?model=nova-3" +
    "&language=ru" +
    "&encoding=linear16" +
    "&sample_rate=16000" +
    "&channels=1" +
    "&interim_results=true" +
    "&punctuate=true",
    {
      headers:{
        Authorization:
          `Token ${process.env.DEEPGRAM_API_KEY}`
      }
    }
  );


  ws.on(
    "open",
    ()=>{
      console.log(
        "Deepgram connected"
      );
    }
  );


  ws.on(
    "error",
    err=>{
      console.error(
        "Deepgram error",
        err
      );
    }
  );


  return ws;
}
