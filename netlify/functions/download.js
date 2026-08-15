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
    // 3. YOUTUBE (Shorts & Vídeos)
    // ----------------------------------------------------
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
      const videoId = extractYouTubeID(cleanUrl);
      
      if (!videoId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Link do YouTube inválido ou ID não encontrado." })
        };
      }

      // Endpoint dedicado para stream direto de YouTube
      const ytApiUrl = `https://ytstream-download-y2mate.koyeb.app/api/json?id=${videoId}`;
      
      try {
        const res = await fetch(ytApiUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        
        const text = await res.text();
        // Verifica se a resposta é um JSON válido antes de parsear
        if (text.startsWith("{")) {
          const data = JSON.parse(text);
          if (data && (data.video || data.url || data.link)) {
            const videoLink = data.video || data.url || data.link;
            const audioLink = data.audio || videoLink;
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                platform: "YouTube",
                title: data.title || "youtube_video",
                cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                videoUrl: videoLink,
                audioUrl: audioLink,
                author: data.author || "YouTube Creator"
              })
            };
          }
        }
      } catch (e) {
        console.warn("Fallback YouTube primário falhou, tentando secundário...");
      }

      // Fallback secundário direto para YouTube
      const fallbackUrl = `https://api.vevioz.com/api/button/mp4/${videoId}`;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          platform: "YouTube",
          title: "YouTube Video",
          cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          videoUrl: fallbackUrl,
          audioUrl: `https://api.vevioz.com/api/button/mp3/${videoId}`,
          author: "YouTube"
        })
      };
    }

    // ----------------------------------------------------
    // 4. INSTAGRAM (Reels / Posts)
    // ----------------------------------------------------
    if (cleanUrl.includes("instagram.com")) {
      const res = await fetch(`https://api.vkrdown.com/api/insta?url=${encodeURIComponent(cleanUrl)}`);
      const text = await res.text();
      
      if (text.startsWith("{")) {
        const data = JSON.parse(text);
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
              audioUrl: data.data[0].url,
              author: "Instagram"
            })
          };
        }
      }
    }

    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: "Plataforma não suportada ou vídeo privado/indisponível." })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro ao processar requisição: " + error.message })
    };
  }
};

// Extrator seguro do ID do YouTube (compatível com shorts, links encurtados e parâmetros extras como &pp=ug)
function extractYouTubeID(url) {
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}
