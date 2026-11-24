// Vercel Serverless Function: forwards website leads to the n8n webhook.
// Environment variables (Vercel > Settings > Environment Variables):
//   N8N_WEBHOOK_URL     = your n8n Production URL (…/webhook/lumagrid-lead-intake)
//   N8N_WEBHOOK_SECRET  = optional shared secret, checked by the Webhook node (Header Auth)
const FIELDS = ["name", "email", "phone", "customerType", "location", "budget",
  "monthlyEnergySpend", "solutionNeed", "timeline", "energyChallenge", "website"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ success: false, message: "Lead service is not configured." });
  }

  // Forward only the expected fields, as trimmed strings
  const body = req.body || {};
  const lead = {};
  for (const f of FIELDS) lead[f] = typeof body[f] === "string" ? body[f].trim().slice(0, 2000) : "";

  // Honeypot: bots fill the hidden "website" field. Pretend success, send nothing.
  if (lead.website) {
    return res.status(200).json({ success: true, message: "Thank you. We have received your request." });
  }

  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (process.env.N8N_WEBHOOK_SECRET) headers["x-lumagrid-key"] = process.env.N8N_WEBHOOK_SECRET;

  try {
    const upstream = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(lead) });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    console.error("n8n request failed:", err);
    return res.status(502).json({ success: false, message: "Our lead service is temporarily unavailable." });
  }
}
