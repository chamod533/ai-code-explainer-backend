// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

// ✅ Allow your Firebase hosted frontend + localhost
app.use(
  cors({
    origin: [
      "https://ai-code-explainer-716e6.web.app",
      "http://localhost:3000"
    ],
  })
);

app.use(express.json());

const port = process.env.PORT || 5000;
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// health check
app.get("/", (req, res) => {
  res.send("AI Code Explainer backend is running");
});

// helper: get a good model name dynamically
async function getValidModel() {
  try {
    const modelsResp = await client.models.list();
    const names = modelsResp.data.map(m => m.id);
    console.log("Available models from Groq:", names);

    const preferred = [
      "groq/llama-3.1-8b-instant",
      "groq/mixtral-8x7b-32768",
      "groq/qwen/qwen3-32b",
      "groq/gemma2-9b-it"
    ];
    for (const p of preferred) {
      if (names.includes(p)) return p;
    }

    return names[0]; // fallback
  } catch (e) {
    console.error("Error fetching model list:", e);
    return null;
  }
}

app.post("/explain", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.trim() === "") {
      return res.status(400).json({ error: "No code provided" });
    }

    const modelName = await getValidModel();
    if (!modelName) {
      return res.status(500).json({ error: "Could not get valid model from Groq" });
    }

    console.log("Using model:", modelName);

    const systemPrompt = {
      role: "system",
      content:
        "You are a friendly teacher and programming assistant. Explain code clearly and simply, find likely errors, and suggest improvements.",
    };

    const userPrompt = {
      role: "user",
      content: `Please:
1) Explain the following code in simple terms (line by line or high-level).
2) Point out any obvious bugs or errors.
3) Suggest improvements or better practices.

Code:
\`\`\`
${code}
\`\`\``,
    };

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [systemPrompt, userPrompt],
      max_tokens: 1200,
      temperature: 0.2,
    });

    const explanation = response.choices?.[0]?.message?.content ?? "No response";
    return res.json({ explanation });
  } catch (err) {
    console.error("Error /explain:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
