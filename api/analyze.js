export default async function handler(req, res) {
  // 👇 ADICIONA ISSO AQUI
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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Erro na OpenAI API" });
    }

    return res.status(200).json({
      answer: data.output?.[0]?.content?.[0]?.text || "Sem resposta"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
