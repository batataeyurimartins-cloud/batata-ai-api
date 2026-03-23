export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { snapshot, mode, instruction, question, history } = req.body || {};

    if (!snapshot || !snapshot.text) {
      return res.status(400).json({ error: "snapshot com texto é obrigatório" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor" });
    }

    const modeTextMap = {
      smart: `Detecte automaticamente o melhor tipo de resposta para esta página.
- Se houver perguntas ou exercícios, responda objetivamente.
- Se for artigo ou texto explicativo, resuma.
- Se for conteúdo técnico, explique de forma clara.
- Se houver texto selecionado, foque primeiro nele.`,
      summary: "Diga as respostas da página de forma direta. Se houver perguntas, responda cada uma claramente.",
      explain: "Explique o conteúdo da página em português do Brasil, de forma organizada e clara.",
      important: "Liste os pontos, trechos, ideias e informações mais importantes da página.",
      chat: "Responda à pergunta do usuário usando somente o conteúdo enviado da página e o histórico recente."
    };

    const baseInstruction = modeTextMap[mode] || modeTextMap.smart;
    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    const systemPrompt = [
      "Responda sempre em português do Brasil.",
      "Você é o Batata AI Hub, um assistente que analisa páginas.",
      "Use somente o conteúdo enviado.",
      "Não invente fatos que não estiverem na página.",
      "Quando não encontrar a resposta na página, diga claramente que a informação não apareceu no conteúdo enviado."
    ].join("\n");

    const userPrompt = `Tarefa principal:\n${baseInstruction}\n\nInstrução extra do usuário:\n${instruction || "nenhuma"}\n\nPergunta atual do usuário:\n${question || "nenhuma"}\n\nHistórico recente:\n${safeHistory.map((m, i) => `${i + 1}. ${m.role}: ${m.content}`).join("\n") || "nenhum"}\n\nDados da página:\n${JSON.stringify(snapshot, null, 2)}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        max_completion_tokens: 1200,
        top_p: 0.9,
        stream: false
      })
    });

    const data = await groqResponse.json().catch(() => ({}));

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json({
        error: data?.error?.message || data?.message || "Erro na Groq API"
      });
    }

    const answer = data?.choices?.[0]?.message?.content || "Sem resposta";
    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}
