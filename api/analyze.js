export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  try {
    const { snapshot, mode = "answers", instruction = "", question = "", messages = [] } = req.body || {};

    if (!snapshot || !snapshot.text) {
      return res.status(400).json({ error: "snapshot.text é obrigatório." });
    }

    const modeMap = {
      answers: "Se houver questões com alternativas, escolha a alternativa correta e explique em no máximo 1 linha por item. Se houver várias, numere.",
      summary: "Faça um resumo curto, claro e útil do conteúdo principal da página.",
      simple: "Explique o conteúdo de forma simples, direta e fácil de entender.",
      insights: "Liste os pontos mais importantes, dicas, pegadinhas ou aprendizados principais do conteúdo."
    };

    const safeHistory = Array.isArray(messages)
      ? messages
          .filter((m) => m && typeof m.content === "string" && typeof m.role === "string")
          .slice(-8)
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.slice(0, 1800) }))
      : [];

    const systemPrompt = [
      "Responda em português do Brasil.",
      "Você é um assistente útil para leitura, estudo e produtividade.",
      "Use principalmente o conteúdo visível enviado no snapshot.",
      "Quando o usuário pedir respostas de questões, você pode inferir a alternativa correta com base no conteúdo visível e no conhecimento geral do modelo.",
      "Se a página tiver múltiplas questões, organize por número.",
      "Se não houver informação suficiente, diga isso com clareza em uma frase curta."
    ].join(" ");

    const userPrompt = [
      `Modo: ${mode}`,
      `Objetivo do modo: ${modeMap[mode] || modeMap.answers}`,
      instruction ? `Instrução extra do usuário: ${instruction}` : "",
      question ? `Pergunta do usuário sobre a página: ${question}` : "",
      "Dados da página:",
      JSON.stringify({
        title: snapshot.title || "",
        url: snapshot.url || "",
        headings: snapshot.headings || [],
        selection: snapshot.selection || "",
        text: snapshot.text || ""
      })
    ].filter(Boolean).join("\n\n");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeHistory,
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro ao consultar a API da Groq."
      });
    }

    return res.status(200).json({
      answer: data?.choices?.[0]?.message?.content || "Sem resposta.",
      model: data?.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Erro interno." });
  }
}
