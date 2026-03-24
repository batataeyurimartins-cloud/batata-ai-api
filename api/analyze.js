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
    const { snapshot, mode = "smart", instruction = "", question = "", history = [] } = req.body || {};

    if (!snapshot || typeof snapshot.text !== "string" || !snapshot.text.trim()) {
      return res.status(400).json({ error: "snapshot com texto é obrigatório" });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-8)
          .map((item) => ({
            role: item?.role === "assistant" ? "assistant" : "user",
            content: String(item?.content || "").slice(0, 1000)
          }))
      : [];

    const modeInstructions = {
      smart: `Analise o conteúdo da página e escolha a melhor forma de responder.
- Se houver perguntas, alternativas ou exercícios, responda de forma direta.
- Se for conteúdo explicativo, resuma ou explique.
- Se houver texto selecionado, dê prioridade total a ele.`,
      answers: `Se houver perguntas, exercícios ou alternativas, responda de forma direta e objetiva.
- Quando houver alternativas, diga a melhor opção e explique rapidamente.
- Quando não houver informação suficiente no conteúdo, diga isso com clareza.`,
      summary: `Faça um resumo útil e curto do conteúdo da página em português do Brasil.`,
      explain: `Explique o conteúdo da página de forma simples, clara e organizada.`,
      important: `Liste os pontos, ideias e trechos mais importantes do conteúdo enviado.`,
      chat: `Responda à pergunta do usuário usando primeiro o conteúdo da página.
- Você pode complementar com conhecimento geral quando isso ajudar a explicar ou inferir a melhor resposta.
- Quando a resposta depender de algo que não aparece no conteúdo da página, deixe isso claro.`
    };

    const systemPrompt = `
Você é o Batata AI Hub, um assistente em português do Brasil.
Seja claro, útil e direto.
Evite enrolação.
Quando o conteúdo da página trouxer a resposta, priorize esse conteúdo.
Quando a resposta não estiver explícita na página, você pode inferir com cuidado ou usar conhecimento geral, mas deve deixar isso claro.
Nunca invente detalhes específicos como datas, nomes ou números se eles não aparecerem no conteúdo.
`;

    const pageSnapshot = {
      title: snapshot.title || "",
      url: snapshot.url || "",
      text: String(snapshot.text || "").slice(0, 9000),
      selectedText: String(snapshot.selectedText || "").slice(0, 4500),
      headings: Array.isArray(snapshot.headings) ? snapshot.headings.slice(0, 20) : [],
      capturedAt: snapshot.capturedAt || ""
    };

    const userPrompt = `
Tarefa principal:
${modeInstructions[mode] || modeInstructions.smart}

Instrução extra do usuário:
${instruction || "nenhuma"}

Pergunta atual do usuário:
${question || "nenhuma"}

Conteúdo da página:
${JSON.stringify(pageSnapshot, null, 2)}
`;

    const messages = [
      { role: "system", content: systemPrompt.trim() },
      ...safeHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userPrompt.trim() }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages,
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro na API da Groq"
      });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim() || "Sem resposta";
    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
