/**
 * Dev-only page (npm run dev, then /dev/landmarks): place a garment's photo
 * landmarks on its cut-out (a top's 13, a pair of pants' 14), see the warp live
 * on the mannequin at two sizes, and save them into seed.json. Not part of the
 * production build.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { estimateBody, type BodyInput } from '../../domain/body';
import { findGarment } from '../../domain/garments';
import type { Garment, GarmentImage, LandmarkName } from '../../domain/garments/types';
import { pantsLandmarks, templateOf, topLandmarks } from '../../domain/garments/categories';
import { validateImage } from '../../domain/garments/validate';
import { bodyGeometry } from '../../ui/components/Mannequin/geometry';
import { Mannequin } from '../../ui/components/Mannequin/Mannequin';
import { foldedPieces, warpPantsPieces, warpPieces } from '../../ui/components/Mannequin/photoWarp';
import { pantsShape } from '../../ui/components/Mannequin/templates/pants';
import { topShape } from '../../ui/components/Mannequin/topShape';
import { STORAGE_KEYS, isStoredBody } from '../../ui/state/stored';
import { PICKER_KITS, foldWarning, kitFor, nextPoint, previewSizes, type PickerKit } from './pickerModel';
import { formatImage } from './seedWrite';
import { alphaMask, insetMask, suggestLandmarks, suggestPantsLandmarks, type XY } from './suggest';
import './picker.css';

type Points = Partial<Record<LandmarkName, XY>>;

interface PhotoEntry {
  id: string;
  file: string;
  exists: boolean;
  inset: number;
}

const DEFAULT_BODY: BodyInput = { heightCm: 176, weightKg: 78, bodyType: 'mens' };

/** The user's own body from the app, if they've entered one. */
function storedBody(): BodyInput {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.body) ?? 'null');
    return v && isStoredBody(v) ? v : DEFAULT_BODY;
  } catch {
    return DEFAULT_BODY;
  }
}

const complete = (p: Points, kit: PickerKit) => kit.order.every((n) => p[n]);

/** Read the PNG's alpha and suggest landmarks from its outline (as a top, or as a pair of pants). */
async function suggestFor(src: string, inset: number, pants: boolean): Promise<{ size: XY; points: Points | null }> {
  // A load event, not img.decode(): the browser may hold decode() back while the tab is hidden.
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('the PNG did not load'));
    img.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = insetMask(alphaMask(data, canvas.width, canvas.height), canvas.width, canvas.height, inset);
  const suggest = pants ? suggestPantsLandmarks : suggestLandmarks;
  return { size: { x: canvas.width, y: canvas.height }, points: suggest(mask, canvas.width, canvas.height) };
}

export function LandmarkPicker() {
  const [photos, setPhotos] = useState<PhotoEntry[] | null>(null);
  const [id, setId] = useState(() => new URLSearchParams(location.search).get('id') ?? '');
  const [points, setPoints] = useState<Points>({});
  const [suggested, setSuggested] = useState<Points | null>(null);
  const [size, setSize] = useState<XY | null>(null);
  const [active, setActive] = useState<LandmarkName>(PICKER_KITS.top.order[0]!);
  const [status, setStatus] = useState<string | null>(null);
  const body = useMemo(() => estimateBody(storedBody()).measurements, []);

  useEffect(() => {
    fetch('/__dev/garment-photos')
      .then((r) => r.json() as Promise<PhotoEntry[]>)
      .then(setPhotos)
      .catch(() => setStatus('Could not list photos: is this the dev server (npm run dev)?'));
  }, []);

  const photo = photos?.find((p) => p.id === id);
  const garment = findGarment(id);
  const kit = garment ? kitFor(garment) : (PICKER_KITS.top as PickerKit);
  const isPants = garment ? templateOf(garment) === 'pants' : false;

  // Load the photo, suggest points, and start from the saved ones when they're for this file.
  useEffect(() => {
    if (!photo?.exists) return;
    let live = true;
    const saved = garment?.image?.file === photo.file ? garment.image.landmarks : null;
    suggestFor(`/${photo.file}?t=${Date.now()}`, photo.inset, isPants)
      .then(({ size, points: s }) => {
        if (!live) return;
        setSize(size);
        setSuggested(s);
        setPoints(saved ?? s ?? {});
        setActive(kit.order[0]!);
        setStatus(saved ? 'Loaded the saved landmarks.' : s ? 'Suggested from the outline: nudge as needed.' : null);
      })
      .catch((e: unknown) => live && setStatus(`Could not load ${photo.file}: ${String(e)}`));
    return () => {
      live = false;
    };
    // Reload only when the photo changes, not on every seed edit.
  }, [photo?.file, photo?.exists, photo?.inset, isPants]);

  const choose = (next: string) => {
    setId(next);
    setPoints({});
    setSuggested(null);
    setSize(null);
    history.replaceState(null, '', `?id=${encodeURIComponent(next)}`);
  };

  // ----- placing and dragging -----
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<LandmarkName | null>(null);
  const toImage = (e: { clientX: number; clientY: number }): XY | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };
  const place = useCallback((name: LandmarkName, at: XY) => setPoints((p) => ({ ...p, [name]: at })), []);

  const onBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current) return;
    const at = toImage(e);
    if (!at) return;
    const placed = { ...points, [active]: at };
    place(active, at);
    setActive(nextPoint<LandmarkName>(active, placed, kit.order));
  };
  const onPointDown = (name: LandmarkName) => (e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    dragging.current = name;
    setActive(name);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const at = toImage(e);
    if (at) place(dragging.current, at);
  };
  const onUp = () => {
    dragging.current = null;
  };

  // Arrow keys nudge the active point (shift: 10 px).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d || !(e.target instanceof HTMLElement) || e.target.closest('select, input, textarea')) return;
      e.preventDefault();
      setPoints((p) => {
        const q = p[active];
        return q ? { ...p, [active]: { x: q.x + d[0]!, y: q.y + d[1]! } } : p;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // ----- result -----
  const image: GarmentImage | null =
    photo && complete(points, kit)
      ? {
          file: photo.file,
          photographedSize: garment?.image?.photographedSize ?? null,
          // Only this template's points (a stray point from another template would fail validation).
          landmarks: Object.fromEntries(kit.order.map((n) => [n, points[n]!])),
        }
      : null;
  const problems = image && garment ? validateImage(image, garment) : [];
  // Mirrored pieces at either preview size: allowed, but worth fixing.
  const fold = useMemo(() => {
    if (!image || !garment) return null;
    const p = previewSizes(garment);
    const g = bodyGeometry(body);
    const folded = p.labels.flatMap((label) => {
      const size = p.garment.sizes.find((s) => s.label === label)!;
      const pants = pantsLandmarks(image);
      if (isPants && pants) {
        const shape = pantsShape(g, body, p.garment, size.measurements);
        return foldedPieces(warpPantsPieces(pants, shape.landmarks, shape.limbEdges));
      }
      const top = topLandmarks(image);
      if (!top) return [];
      const shape = topShape(g, p.garment, size.measurements, body.chestCm);
      return foldedPieces(warpPieces(top, shape.landmarks, shape.sleeveEdges));
    });
    return foldWarning(folded);
  }, [image, garment, body, isPants]);

  const save = async () => {
    if (!image) return;
    setStatus('Saving…');
    const res = await fetch('/__dev/landmarks', {
      method: 'POST',
      body: JSON.stringify({ id, file: image.file, landmarks: image.landmarks }),
    });
    const out = (await res.json()) as { ok?: boolean; error?: string };
    setStatus(out.ok ? `Saved to seed.json (${id}).` : `Not saved: ${out.error}`);
  };
  const copy = async () => {
    if (!image) return;
    await navigator.clipboard.writeText(`"image": ${formatImage(image, '      ')}`);
    setStatus('Copied the "image" entry to the clipboard.');
  };

  // Points and lines are sized in screen px whatever the photo's size.
  const k = size ? size.x / 560 : 1;
  const outline = kit.order.filter((n) => points[n]).map((n) => `${points[n]!.x},${points[n]!.y}`).join(' ');

  return (
    <div className="picker">
      <header className="picker__head">
        <h1>Landmark picker</h1>
        <label>
          Garment{' '}
          <select value={id} onChange={(e) => choose(e.target.value)}>
            <option value="">Choose a photo…</option>
            {photos?.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.exists}>
                {p.id}
                {p.exists ? '' : ' (no PNG yet: npm run photos)'}
              </option>
            ))}
          </select>
        </label>
        {garment && (
          <span className="picker__muted">
            {garment.brand} {garment.name}, {isPants ? 'pants' : `${garment.sleeve ?? 'short'} sleeve`}
          </span>
        )}
        {photos && id && !photo && <span className="picker__bad">{id} isn't in scripts/garment-photos.json.</span>}
        {id && !garment && <span className="picker__bad">No garment "{id}" in the catalogue.</span>}
      </header>

      <main className="picker__body">
        <section className="picker__photo" aria-label="Photo">
          {photo && size ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.x} ${size.y}`}
              onPointerDown={onBackgroundDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <rect width={size.x} height={size.y} className="picker__checker" />
              <image href={`/${photo.file}`} width={size.x} height={size.y} />
              <polygon points={outline} className="picker__outline" style={{ strokeWidth: 1.5 * k }} />
              {kit.order.map((n) =>
                points[n] ? (
                  <g key={n}>
                    <circle
                      cx={points[n]!.x}
                      cy={points[n]!.y}
                      r={(n === active ? 8 : 6) * k}
                      className={n === active ? 'picker__pt is-active' : 'picker__pt'}
                      style={{ strokeWidth: 2 * k }}
                      onPointerDown={onPointDown(n)}
                    >
                      <title>{kit.labels[n]}</title>
                    </circle>
                  </g>
                ) : null,
              )}
            </svg>
          ) : (
            <p className="picker__muted">{id ? 'Loading…' : 'Choose a garment photo to start.'}</p>
          )}
        </section>

        <aside className="picker__side">
          <div className="picker__guide">
            <svg viewBox="0 0 120 100" aria-hidden="true">
              <path className="picker__tee" d={kit.diagramPath} />
              {kit.order.map((n) => (
                <circle
                  key={n}
                  cx={kit.diagram[n].x}
                  cy={kit.diagram[n].y}
                  r={n === active ? 4.5 : 2.8}
                  className={n === active ? 'picker__dot is-active' : points[n] ? 'picker__dot is-placed' : 'picker__dot'}
                />
              ))}
            </svg>
            <p>
              <strong>Next: {kit.labels[active] ?? kit.labels[kit.order[0]!]}</strong>
              <br />
              <span className="picker__muted">
                Click the photo to place it, drag any point to adjust, arrow keys nudge (shift ×10). Left and right
                are as you see the photo.
              </span>
            </p>
          </div>

          <ol className="picker__list">
            {kit.order.map((n) => (
              <li key={n}>
                <button type="button" className={n === active ? 'is-active' : undefined} onClick={() => setActive(n)}>
                  <span>{kit.short[n]}</span>
                  <span className="picker__xy">{points[n] ? `${points[n]!.x}, ${points[n]!.y}` : '—'}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="picker__actions">
            <button type="button" onClick={save} disabled={!image || problems.length > 0}>
              Save to seed.json
            </button>
            <button type="button" onClick={copy} disabled={!image}>
              Copy JSON
            </button>
            <button type="button" onClick={() => suggested && setPoints(suggested)} disabled={!suggested}>
              Use suggestions
            </button>
          </div>
          {problems.length > 0 && (
            <ul className="picker__problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {fold && <p className="picker__warn">{fold}</p>}
          {status && <p className="picker__status">{status}</p>}
        </aside>

        <section className="picker__preview" aria-label="Live preview">
          {garment && image ? <Preview garment={garment} image={image} body={body} /> : null}
        </section>
      </main>
    </div>
  );
}

/** The photo warped onto the mannequin at two sizes, with the points as placed. */
function Preview({
  garment,
  image,
  body,
}: {
  garment: Garment;
  image: GarmentImage;
  body: ReturnType<typeof estimateBody>['measurements'];
}) {
  const p = previewSizes({ ...garment, image });
  return (
    <>
      {p.labels.map((label) => (
        <figure key={label}>
          <div className="picker__frame">
            {templateOf(garment) === 'pants' ? (
              <Mannequin body={body} bottom={{ garment: p.garment, sizeLabel: label }} showFit={false} />
            ) : (
              <Mannequin body={body} top={{ garment: p.garment, sizeLabel: label }} showFit={false} />
            )}
          </div>
          <figcaption>
            {label}
            {p.madeUp && label === p.labels[1] ? ' (made up for this preview)' : ''}
          </figcaption>
        </figure>
      ))}
    </>
  );
}
