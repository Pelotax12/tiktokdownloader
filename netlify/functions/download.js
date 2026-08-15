exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const rawUrl = event.queryStringParameters?.url;
  if (!rawUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Por favor, informe a URL do vídeo." })
    };
  }

  const cleanUrl = rawUrl.trim();

  try {
    // 1. TIKTOK
    if (cleanUrl.includes("tiktok.com")) {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`);
      const data = await res.json();

      if (data.code === 0 && data.data) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            platform: "TikTok",
            title: data.data.title || "tiktok_video",
            cover: data.data.cover,
            videoUrl: data.data.play,
            author: data.data.author?.nickname || "TikTok User"
          })
        };
      }
    }

    // 2. INSTAGRAM (Reels / Posts)
    else if (cleanUrl.includes("instagram.com")) {
      // Usando endpoint público do snapinsta/igram api bridge
      const res = await fetch(`https://api.vkrdown.com/api/insta?url=${encodeURIComponent(cleanUrl)}`);
      const data = await res.json();

      if (data.status === "success" && data.data?.[0]) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            platform: "Instagram",
            title: "Instagram Reel",
            cover: data.data[0].thumbnail,
            videoUrl: data.data[0].url,
            author: "Instagram"
          })
        };
      }
    }

    // 3. TWITTER / X
    else if (cleanUrl.includes("twitter.com") || cleanUrl.includes("x.com")) {
      const res = await fetch(`https://api.twitsave.com/info?url=${encodeURIComponent(cleanUrl)}`);
      const data = await res.json();

      if (data && data.url) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            platform: "Twitter / X",
            title: data.description || "Twitter Video",
            cover: data.thumbnail,
            videoUrl: data.url,
            author: data.uploader || "Twitter User"
          })
        };
      }
    }

    // 4. MULTIPLATAFORMA / YOUTUBE / OUTROS (Fallback usando Cobalt API pública)
    const cobaltRes = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "UniversalDownloader/1.0"
      },
      body: JSON.stringify({
        url: cleanUrl,
        vCodec: "h264",
        vQuality: "720",
        aFormat: "mp3",
        isNoTTWatermark: true
      })
    });

    const cobaltData = await cobaltRes.json();

    if (cobaltData.url) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          platform: "Vídeo",
          title: "video_download",
          cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop",
          videoUrl: cobaltData.url,
          author: "Universal Downloader"
        })
      };
    }

    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: "Plataforma não suportada ou link indisponível." })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro ao processar a mídia da plataforma." })
    };
  }
};
