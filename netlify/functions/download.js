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
    // ----------------------------------------------------
    // 1. TIKTOK
    // ----------------------------------------------------
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
            audioUrl: data.data.music || data.data.play,
            author: data.data.author?.nickname || "TikTok User"
          })
        };
      }
    }

    // ----------------------------------------------------
    // 2. TWITTER / X
    // ----------------------------------------------------
    if (cleanUrl.includes("twitter.com") || cleanUrl.includes("x.com")) {
      // Extrai o ID do tweet
      const tweetIdMatch = cleanUrl.match(/status\/(\d+)/);
      if (tweetIdMatch) {
        const tweetId = tweetIdMatch[1];
        const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`);
        const data = await res.json();

        if (data && data.mediaURLs && data.mediaURLs.length > 0) {
          const video = data.mediaURLs.find(u => u.includes('.mp4') || u.includes('video')) || data.mediaURLs[0];
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              platform: "Twitter / X",
              title: data.text ? data.text.slice(0, 40) : "twitter_video",
              cover: data.media_extended?.[0]?.thumbnail_url || "https://abs.twimg.com/icons/apple-touch-icon-192x192.png",
              videoUrl: video,
              audioUrl: video,
              author: data.user_screen_name || "Twitter User"
            })
          };
        }
      }
    }

    // ----------------------------------------------------
    // 3. YOUTUBE (Shorts / Vídeos)
    // ----------------------------------------------------
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
      // Converte shorts URL para watch padrão se necessário
      const standardUrl = cleanUrl.replace("/shorts/", "/watch?v=");
      
      const res = await fetch(`https://api.invidious.io/api/v1/videos/${extractYouTubeID(standardUrl)}`);
      
      if (res.ok) {
        const data = await res.json();
        const videoStreams = data.formatStreams || [];
        const audioStreams = data.adaptiveFormats?.filter(f => f.type?.includes("audio")) || [];

        const bestVideo = videoStreams[0]?.url || (data.adaptiveFormats && data.adaptiveFormats[0]?.url);
        const bestAudio = audioStreams[0]?.url || bestVideo;

        if (bestVideo) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              platform: "YouTube",
              title: data.title || "youtube_video",
              cover: data.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${extractYouTubeID(standardUrl)}/hqdefault.jpg`,
              videoUrl: bestVideo,
              audioUrl: bestAudio,
              author: data.author || "YouTube Creator"
            })
          };
        }
      }
    }

    // ----------------------------------------------------
    // 4. INSTAGRAM / MULTIPLATAFORMA (Fallback Cobalt v10)
    // ----------------------------------------------------
    const cobaltInstances = [
      "https://cobalt-api.kwiatekm.tokyo",
      "https://api.cobalt.tools"
    ];

    for (const instance of cobaltInstances) {
      try {
        const cobaltRes = await fetch(`${instance}/`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: cleanUrl,
            videoQuality: "720",
            audioFormat: "mp3",
            downloadMode: "auto"
          })
        });

        const cobaltData = await cobaltRes.json();

        if (cobaltData.url || cobaltData.status === "tunnel" || cobaltData.status === "redirect") {
          const streamUrl = cobaltData.url;
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              platform: "Mídia Online",
              title: cobaltData.filename || "midia_download",
              cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop",
              videoUrl: streamUrl,
              audioUrl: streamUrl,
              author: "Criador"
            })
          };
        }
      } catch (e) {
        // Tenta a próxima instância se houver falha de rede
        continue;
      }
    }

    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: "Não foi possível extrair a mídia. Verifique se o link é público." })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno ao processar o vídeo: " + error.message })
    };
  }
};

// Função auxiliar para extrair o ID do YouTube
function extractYouTubeID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : "";
}
