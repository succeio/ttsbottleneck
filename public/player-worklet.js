class PlayerProcessor extends AudioWorkletProcessor {

  constructor() {
    super();

    this.queue = [];
    this.position = 0;

    this.port.onmessage = (event) => {

      const pcm24 = new Int16Array(
        event.data
      );

      // Kokoro outputs mono PCM at 24000Hz, but our AudioContext runs at 16000Hz.
      // We resample 24kHz to 16kHz using linear interpolation (ratio 1.5).
      const length24 = pcm24.length;
      const length16 = Math.floor(length24 / 1.5);
      const pcm16 = new Int16Array(length16);

      for (let i = 0; i < length16; i++) {
        const srcIndex = i * 1.5;
        const index1 = Math.floor(srcIndex);
        const index2 = Math.min(index1 + 1, length24 - 1);
        const weight = srcIndex - index1;

        pcm16[i] = pcm24[index1] * (1 - weight) + pcm24[index2] * weight;
      }

      this.queue.push(pcm16);

    };
  }


  process(inputs, outputs) {

    const output = outputs[0];

    if (!output || !output[0]) {
      return true;
    }


    const channel = output[0];


    for (
      let i = 0;
      i < channel.length;
      i++
    ) {

      if (
        this.queue.length === 0
      ) {

        channel[i] = 0;
        continue;

      }


      const current =
        this.queue[0];


      if (
        this.position >= current.length
      ) {

        this.queue.shift();
        this.position = 0;
        i--;
        continue;

      }


      channel[i] =
        current[this.position++] /
        32768;

    }


    return true;
  }

}


registerProcessor(
  "player-processor",
  PlayerProcessor
);
