import { useState } from "react";
import { cardUrl, profileUrl } from "./api";

/** Shareable profile card: preview, copy link, native share, and PNG download (rendered client-side from the SVG). */
export function ShareCard({ handle, displayName }: { handle: string; displayName: string }) {
  const [status, setStatus] = useState<string>("");
  const link = `${window.location.origin}${profileUrl(handle)}`;
  const svgSrc = cardUrl(handle);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 2500);
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      flash("Link copied");
    } catch {
      flash(link);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: `${displayName} on FaZe HQ`, text: `Check out my CS2 portfolio`, url: link });
    } catch {
      /* user cancelled */
    }
  }

  async function downloadPng() {
    try {
      const svgText = await (await fetch(svgSrc)).text();
      const img = new Image();
      const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("render failed"));
        img.src = blobUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(blobUrl);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${handle}-faze-hq-card.png`;
      a.click();
      flash("Card downloaded");
    } catch {
      window.open(svgSrc, "_blank", "noopener");
    }
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section className="pf-card pf-share" aria-labelledby="pf-share-h">
      <h2 id="pf-share-h" className="pf-h2">Share your card</h2>
      <img className="pf-share__img" src={svgSrc} alt={`Profile card for ${displayName}`} loading="lazy" />
      <div className="pf-share__actions">
        <button type="button" className="pf-btn pf-btn--primary" onClick={downloadPng}>Download PNG</button>
        <button type="button" className="pf-btn" onClick={copyLink}>Copy link</button>
        {canShare && <button type="button" className="pf-btn" onClick={nativeShare}>Share…</button>}
      </div>
      <p className="pf-muted pf-share__status" aria-live="polite">{status}</p>
    </section>
  );
}
