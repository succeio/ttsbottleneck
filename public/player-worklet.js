class PlayerProcessor extends AudioWorkletProcessor {

  constructor() {
    super();

    this.queue = [];
    this.position = 0;

    this.port.onmessage = (event) => {

      const pcm = new Int16Array(
        event.data
      );

      this.queue.push(pcm);

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
