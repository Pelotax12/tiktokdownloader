exports.handler = async function (event, context) {
  // Configuração de cabeçalhos CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Trata requisições preflight do navegador
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // Pega o link enviado via query string (?url=...)
  const url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "URL do TikTok não informada." })
    };
  }

  try {
    // Consulta a API de extração sem marca d'água
    const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          title: data.data.title || "tiktok_video",
          cover: data.data.cover,
          videoUrl: data.data.play, // Link direto MP4 limpo
          author: data.data.author?.nickname || "TikTok User"
        })
      };
    } else {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({ error: data.msg || "Não foi possível processar o vídeo." })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno no servidor." })
    };
  }
};