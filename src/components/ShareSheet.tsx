import { Check, Copy, Download, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { groceryText, type SharedGrocery } from "../lib/grocery";
import { journeyText, planText, type JourneyStats, type SharedPlan } from "../lib/share";
import { groceryStory, journeyStory, planStory } from "../lib/shareImage";
import { Sheet, Switch } from "./ui";

export type ShareWhat =
  | { kind: "plan"; plan: SharedPlan }
  | { kind: "journey"; stats: JourneyStats }
  | { kind: "grocery"; grocery: SharedGrocery; checked: string[] };

function textFor(w: ShareWhat, showWeight: boolean) {
  if (w.kind === "plan") return planText(w.plan, siteLink());
  if (w.kind === "grocery") return groceryText(w.grocery, w.checked, siteLink());
  return journeyText(w.stats, showWeight, siteLink());
}

function imageFor(w: ShareWhat, showWeight: boolean) {
  if (w.kind === "plan") return planStory(w.plan, siteLink());
  if (w.kind === "grocery") return groceryStory(w.grocery, w.checked, siteLink());
  return journeyStory(w.stats, showWeight, siteLink());
}

const siteLink = () => window.location.origin;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Share a week's meal plan or a health-journey summary: as text on WhatsApp, as a story image for Instagram
 * (through the phone's share menu), as a download, or (with an account) to another Kalorax member via `friend`.
 */
export function ShareSheet({ what, title, friend, onClose }: { what: ShareWhat; title: string; friend?: ReactNode; onClose: () => void }) {
  const [showWeight, setShowWeight] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const text = textFor(what, showWeight);
  const filename = `kalorax-${what.kind === "plan" ? "meal-plan" : what.kind === "grocery" ? "grocery-list" : "journey"}.png`;

  // Callers build `what` on each render, so redraw only when its contents change.
  const key = JSON.stringify(what);
  useEffect(() => {
    const w = JSON.parse(key) as ShareWhat;
    let url: string | null = null;
    let cancelled = false;
    setImage(null);
    imageFor(w, showWeight)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => setStatus("Couldn't make the image on this device. You can still share the text."));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, showWeight]);

  const shareImage = async () => {
    if (!image) return;
    const file = new File([image.blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        setStatus("Shared.");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("Sharing didn't work. Download the image and post it from Instagram.");
      }
    } else {
      download(image.blob, filename);
      setStatus("Image saved. Open Instagram on your phone and add it to your story or a post.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied. Paste it anywhere.");
    } catch {
      setStatus("Couldn't copy on this browser.");
    }
  };

  const empty = (what.kind === "plan" && what.plan.items.length === 0) || (what.kind === "grocery" && what.grocery.items.length === 0);

  return (
    <Sheet title={title} onClose={onClose}>
      {empty ? (
        <p className="small muted">{what.kind === "grocery" ? "This week's grocery list is empty. Plan some meals and it fills itself." : "There's nothing planned this week yet. Add some dishes, then share your plan."}</p>
      ) : (
        <>
          {what.kind === "journey" && (
            <div className="row share-toggle">
              <span className="grow small">
                <strong>Include my weight change</strong>
                <span className="muted" style={{ display: "block" }}>Off by default: your weight is yours to share.</span>
              </span>
              <Switch checked={showWeight} onChange={setShowWeight} label="Include my weight change" disabled={what.stats.weightChangeKg === null} />
            </div>
          )}
          <div className="share-preview">
            {image ? <img src={image.url} alt="Preview of the image you'll share" /> : <span className="muted small">Making your image…</span>}
          </div>
          {friend}
          <div className="share-actions">
            <a className="btn btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> WhatsApp
            </a>
            <button className="btn btn-instagram" onClick={shareImage} disabled={!image}>
              <Share2 size={18} /> Instagram & more
            </button>
            <button className="btn btn-secondary" onClick={() => image && download(image.blob, filename)} disabled={!image}>
              <Download size={18} /> Save image
            </button>
            <button className="btn btn-secondary" onClick={copy}>
              <Copy size={18} /> Copy text
            </button>
          </div>
          {status && <p className="small muted share-status" role="status"><Check size={14} aria-hidden /> {status}</p>}
          <p className="small muted">
            On your phone, <strong>Instagram & more</strong> opens your share menu: pick Instagram to add the image to your story or feed, or
            WhatsApp to post it to your status.
          </p>
        </>
      )}
    </Sheet>
  );
}
