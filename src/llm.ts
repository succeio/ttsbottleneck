import OpenAI from "openai";


const client = new OpenAI({

  apiKey: "ollama",

  baseURL:
    process.env.OLLAMA_URL,

});


export async function translate(
  text:string
){

 const result =
 await client.chat.completions.create({

   model:"qwen3:0.6b",

   temperature:0,

   messages:[

    {
      role:"system",
      content:
      `
Translate Russian to English.

Rules:
- only translation
- no explanations
- no markdown
      `
    },

    {
      role:"user",
      content:text
    }

   ]

 });


 return (
   result.choices[0]
   .message
   .content
   ?.trim()
   || ""
 );

}
