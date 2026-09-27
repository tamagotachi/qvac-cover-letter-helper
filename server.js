// Cover Letter Helper - paste the job ad and your real experience, and an AI on YOUR machine (QVAC) drafts a
// tailored cover letter. It only uses the experience you give it. Open http://localhost:3072 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3072;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI letter writer ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

const TONES = { confident: "confident and energetic", friendly: "warm and friendly", formal: "polite and formal" };
const LENGTHS = { short: "about 150 words, 3 short paragraphs", standard: "about 250 words, 4 paragraphs" };
const prompt = (tone, length) => `You write honest, tailored cover letters. Tone: ${TONES[tone]}. Length: ${LENGTHS[length]}.
Start with "Dear Hiring Manager," unless a name is given, and end with "Sincerely," and the applicant's name.
Connect the applicant's REAL experience to what the job ad asks for, using the ad's own key words where they are true.
NEVER invent experience, skills, degrees, numbers or employers that are not in the applicant's notes. If something important is missing, don't make it up.
No placeholders in square brackets except [phone] or [email] if contact details are needed. Reply with the letter only.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/letter") {
      if (!status.ready) { res.writeHead(503); return res.end("The AI letter writer is not ready yet."); }
      const b = JSON.parse(await readBody(req, 40000));
      const ad = String(b.ad || "").trim().slice(0, 3000), exp = String(b.exp || "").trim().slice(0, 2000);
      const name = clean(b.name, 60) || "the applicant", job = clean(b.job, 80), company = clean(b.company, 80);
      const tone = TONES[b.tone] ? b.tone : "friendly", length = LENGTHS[b.length] ? b.length : "standard";
      if (ad.length < 30 || exp.length < 15) { res.writeHead(400); return res.end("Paste the job ad and your experience first."); }
      const ask = `Applicant's name: ${name}\nJob: ${job || "(see ad)"}${company ? " at " + company : ""}\n\nJOB AD:\n"""\n${ad}\n"""\n\nAPPLICANT'S REAL EXPERIENCE (use only this):\n"""\n${exp}\n"""`;
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      await enqueue(async () => {
        // This is the QVAC call that runs the AI on-device
        const run = completion({ modelId, stream: true, history: [{ role: "system", content: prompt(tone, length) }, { role: "user", content: ask }] });
        for await (const token of run.tokenStream) res.write(token);
      });
      return res.end();
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); if (!res.headersSent) res.writeHead(500); res.end(""); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
