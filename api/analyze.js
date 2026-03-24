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

    const modeTextMap = {
      smart: `Detecte automaticamente o melhor tipo de resposta para esta página.
- Se houver perguntas/exercícios, responda objetivamente.
- Se for artigo ou texto explicativo, resuma.
- Se for conteúdo técnico, explique de forma clara.
- Se houver texto selecionado, foque primeiro nele.`,
      summary: "Diga as respostas da página de forma direta. Se houver perguntas, responda cada uma claramente.",
      explain: "Explique o conteúdo da página em português do Brasil, de forma organizada e clara.",
      important: "Liste os pontos, trechos, ideias e informações mais importantes da página.",
      chat: "Responda à pergunta do usuário usando somente o conteúdo enviado da página e o histórico recente.",
    };

    const baseInstruction = modeTextMap[mode] || modeTextMap.smart;
    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    const prompt = `
Responda sempre em português do Brasil.
Você é o Batata AI Hub, um assistente que analisa páginas.
Use somente o conteúdo enviado.
Não invente fatos que não estiverem na página.
Quando não encontrar a resposta na página, diga claramente que a informação não apareceu no conteúdo enviado.

Tarefa principal:
${baseInstruction}

Instrução extra do usuário:
${instruction || "nenhuma"}

Pergunta atual do usuário:
${question || "nenhuma"}

Histórico recente:
${safeHistory.map((m, i) => `${i + 1}. ${m.role}: ${m.content}`).join("\n") || "nenhum"}

Dados da página:
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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            topP: 0.9,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || "Erro na Gemini API"
      });
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta";
    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}
