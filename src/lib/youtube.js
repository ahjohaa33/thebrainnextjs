/**
 * Legacy YouTube channel/playlist fallback intentionally disabled.
 *
 * Homepage media is sourced only from the Laravel `/home.video_sections`
 * payload. Keeping this compatibility export avoids breaking any unknown
 * import outside this partial source tree while removing API keys, channel
 * handles, playlist IDs, random sampling and YouTube Data API requests.
 */
export async function getFallbackChannelVideos() {
  return [];
}
