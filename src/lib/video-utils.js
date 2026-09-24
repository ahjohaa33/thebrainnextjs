export function normalizeDate(value) {
  if (!value) return { iso: "", label: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { iso: String(value), label: String(value) };
  }
  return {
    iso: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
  };
}

export function toYoutubeEmbed(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) {
    return `https://www.youtube-nocookie.com/embed/${raw}?rel=0&modestbranding=1&playsinline=1`;
  }

  try {
    const url = new URL(raw);
    let videoId = "";
    if (url.hostname === "youtu.be") {
      videoId = url.pathname.replace(/^\//, "").split("/")[0];
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/embed/")[1]?.split("/")[0] || "";
    } else {
      videoId = url.searchParams.get("v") || "";
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
    }
  } catch {
    // fall through
  }
  return raw;
}

export function normalizeVideos(value, fallback) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source
    .map((item, index) => {
      const embedUrl = toYoutubeEmbed(
        item?.youtube_id ||
          item?.video_id ||
          item?.embed_url ||
          item?.youtube_url ||
          item?.url
      );
      return {
        id: item?.id || `video-${index}`,
        title: item?.title || item?.name || `Video ${index + 1}`,
        embedUrl,
        publishedAt: item?.published_at || item?.date || "",
        category: item?.category || "latest",
        categoryLabel: item?.category_label || item?.category || "Latest",
      };
    })
    .filter((item) => item.embedUrl);
}