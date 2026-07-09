exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const { message, context, history } = JSON.parse(event.body);

    const systemPrompt = `Eres FinAI, un asistente financiero personal inteligente.
Responde en español, de forma concisa y práctica.
Usa los datos financieros del usuario para dar consejos personalizados.
Si no tienes suficiente información, pide más datos.
Nunca inventes datos financieros del usuario.

Datos financieros del usuario:
${context}`;

    const contents = [];
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Entendido. Soy FinAI, tu asistente financiero. ¿En qué puedo ayudarte?' }] });

    if (history && history.length > 0) {
      history.forEach(h => {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        });
      });
    }

    if (!history || history.length === 0 || history[history.length - 1].content !== message) {
      contents.push({ role: 'user', parts: [{ text: message }] });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';

    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
