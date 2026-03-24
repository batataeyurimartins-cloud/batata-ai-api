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
    const { snapshot, mode, instruction } = req.body || {};

    if (!snapshot || !snapshot.text) {
      return res.status(400).json({ error: "snapshot com texto é obrigatório" });
    }

    const modeText = {
      scan: "Faça uma leitura rápida e útil da página, destacando o que realmente importa.",
      answers: "Se houver perguntas, exercícios, alternativas ou atividades, diga somente as respostas de forma organizada.",
      explain: "Explique o conteúdo da página de forma clara, didática e fácil de entender."
    }[mode] || "Analise a página com clareza.";

    const prompt = `
Responda em português do Brasil.

Você é um assistente para estudo, produtividade e entendimento de páginas.
Use apenas o conteúdo enviado no snapshot.
Não invente informações que não estejam na página.
Se não houver dados suficientes, diga isso claramente.

Modo:
${modeText}

Instrução extra:
${instruction || "nenhuma"}

Título:
${snapshot.title || "sem título"}

URL:
${snapshot.url || "sem URL"}

Tópicos detectados:
${Array.isArray(snapshot.headings) ? snapshot.headings.join(" | ") : "nenhum"}

Possíveis perguntas detectadas:
${Array.isArray(snapshot.possibleQuestions) ? snapshot.possibleQuestions.join(" | ") : "nenhuma"}

Texto da página:
${snapshot.text}
`;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada na Vercel" });
    }

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
            temperature: mode === "answers" ? 0.2 : 0.5,
            topP: 0.95,
            maxOutputTokens: 1400
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status || 500).json({
        error: data?.error?.message || "Erro na Gemini API"
      });
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return res.status(200).json({
      answer: answer || "Sem resposta gerada."
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Erro interno"
    });
  }
}
