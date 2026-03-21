export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { snapshot, mode, instruction } = req.body || {};

    if (!snapshot) {
      return res.status(400).json({ error: "snapshot é obrigatório" });
    }

    const prompt = `
Responda em português do Brasil.

Modo: ${mode || "summary"}
Instrução: ${instruction || "nenhuma"}

Conteúdo da página:
${JSON.stringify(snapshot, null, 2)}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || "Erro na Gemini API"
      });
    }

    return res.status(200).json({
      answer:
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
