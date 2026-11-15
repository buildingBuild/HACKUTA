/** Only official player origins are constructed; no caller-supplied iframe URLs. */
export function mediaEmbed(raw: string, parent: string): { embed: string; original: string; provider: 'YouTube' | 'Twitch' } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (['www.youtube.com','youtube.com','youtu.be'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:live|embed)\/([\w-]+)$/.exec(url.pathname)?.[1];
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { embed:`https://www.youtube-nocookie.com/embed/${id}?rel=0`, original:`https://www.youtube.com/watch?v=${id}`,provider:'YouTube' };
    }
    if (['www.twitch.tv','twitch.tv'].includes(url.hostname) && /^[a-z0-9.-]+$/i.test(parent)) {
      const video = /^\/videos\/(\d+)$/.exec(url.pathname)?.[1];
      const channel = /^\/([a-zA-Z0-9_]{3,25})$/.exec(url.pathname)?.[1];
      if (!video && !channel) return null;
      return { embed:`https://player.twitch.tv/?${video ? `video=v${video}` : `channel=${channel}`}&parent=${encodeURIComponent(parent)}&autoplay=false`,original:url.href,provider:'Twitch' };
    }
  } catch { /* Unsupported sources use a placeholder. */ }
  return null;
}
