import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Thumb } from "../components/ui";
import { ARTICLES } from "../data/articles";
import { FOODS } from "../data/foods";
import { PHOTOS, photoPage, photoTitle } from "../data/photos";
import { RECIPES } from "../data/recipes";
import { useStore } from "../state/store";

/** What each photo is used for, so people can see which dish it illustrates. */
function usedFor(key: string): string {
  if (key.startsWith("recipe:")) return `Recipe: ${RECIPES.find((r) => `recipe:${r.id}` === key)?.name ?? key}`;
  if (key.startsWith("article:")) return `Article: ${ARTICLES.find((a) => `article:${a.id}` === key)?.title ?? key}`;
  return FOODS.find((f) => f.id === key)?.name ?? key;
}

export function Credits() {
  const { profile } = useStore();
  const entries = Object.entries(PHOTOS);
  return (
    <div className="landing">
      <Link to={profile ? "/me" : "/"} className="btn btn-ghost btn-small"><ArrowLeft size={16} /> Back</Link>
      <h1 style={{ margin: "0.75rem 0 0.5rem" }}>Photo credits</h1>
      <p className="muted">
        Food photos in Kalorax come from <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">Wikimedia Commons</a>,
        shared by their photographers under public-domain or Creative Commons licences. Thank you to every contributor — many
        of the Nigerian dishes were photographed for the Wiki Loves Africa contests. Tap a photo's name to see its full
        licence and author details. Photos are shown resized, cropped to fit and converted to smaller image formats (AVIF or WebP) for faster loading.
      </p>
      <section className="card">
        <ul className="credits">
          {entries.map(([key, p]) => (
            <li key={key}>
              <Thumb emoji="🍽️" size="sm" photo={key} />
              <div className="grow">
                <a href={photoPage(p)} target="_blank" rel="noreferrer">
                  {photoTitle(p)} <ExternalLink size={12} aria-hidden />
                </a>
                <span className="muted small" style={{ display: "block" }}>
                  {usedFor(key)} · {p.author ? `by ${p.author}` : "author on file page"} · {p.license ?? "licence on file page"} · via Wikimedia Commons
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
