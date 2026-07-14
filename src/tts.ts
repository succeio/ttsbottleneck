export async function synthesize(
  text: string
): Promise<Buffer> {

  const response = await fetch(
    `${process.env.KOKORO_URL}/audio/speech`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "tts-1",
        voice: "af_alloy",
        input: text,
        response_format: "pcm",
      }),
    }
  );


  if (!response.ok) {
    throw new Error(
      `Kokoro error ${response.status}: ${
        await response.text()
      }`
    );
  }


  return Buffer.from(
    await response.arrayBuffer()
  );
}
