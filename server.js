import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM = `
أنت سولا، مساعد عربي ودود يفهم العربية الفصحى واللهجة العراقية.
افهم كلام المستخدم من المعنى والسياق، وليس من كلمات مفتاحية فقط.

إذا طلب المستخدم إنشاء صورة، أعد JSON فقط بهذا الشكل:
{"type":"image","prompt":"وصف الصورة بالإنجليزية","reply":"رد قصير بالعربية"}

إذا لم يطلب صورة، أعد JSON فقط بهذا الشكل:
{"type":"chat","reply":"الرد بالعربية"}

كن مختصرة ومفيدة وودودة.
لا تدّعي أنك تملك وعياً أو ذاكرة دائمة خارج التطبيق.
`;

app.post("/api/sola", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.json({
        type: "chat",
        reply: "اكتب لي شيئاً 😊"
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: SYSTEM,
      input: message
    });

    const raw = response.output_text || "";

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        type: "chat",
        reply: raw
      };
    }

    if (data.type === "image") {
      const image = await client.images.generate({
        model: "gpt-image-2",
        prompt: data.prompt,
        size: "1024x1024"
      });

      data.url =
        "data:image/png;base64," +
        image.data[0].b64_json;
    }

    if (data.reply) {
      try {
        const speech = await client.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice: "coral",
          input: data.reply,
          response_format: "mp3"
        });

        data.audio = Buffer.from(
          await speech.arrayBuffer()
        ).toString("base64");
      } catch (voiceError) {
        console.error("Voice error:", voiceError.message);
      }
    }

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      type: "chat",
      reply: "صار خطأ بسيط. حاول مرة ثانية."
    });
  }
});

app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Sola is running on port ${PORT}`);
});
