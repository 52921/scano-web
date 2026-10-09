import { useRef, useState } from 'react';
import { applyImageFilters, detectDocumentCorners, rectifyPerspective, rotateCanvas } from './utils/cvEngine';
import type { FilterType } from './types';

const filters: FilterType[] = ['original', 'magic_color', 'bw_photocopy', 'grayscale', 'brighten'];

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('original');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState('Upload a document image to start scanning.');
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setStatus('Processing document...');

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const corners = detectDocumentCorners(img);
          const rectified = rectifyPerspective(img, corners, 'custom');
          const rotated = rotateCanvas(rectified, rotation);
          const filtered = applyImageFilters(rotated, filter, brightness, contrast);
          setImageUrl(url);
          setPreviewUrl(filtered.toDataURL('image/png'));
          setStatus('Document processed successfully.');
        } catch (error) {
          console.error(error);
          setStatus('Unable to process the document. Please try another image.');
        } finally {
          setLoading(false);
        }
      };
      img.onerror = () => {
        setStatus('Image could not be loaded.');
        setLoading(false);
      };
      img.src = url;
    } catch (error) {
      console.error(error);
      setStatus('Could not read the selected file.');
      setLoading(false);
    }
  };

  const handleApplyAdjustments = () => {
    if (!imageUrl) return;

    setLoading(true);
    setStatus('Updating preview...');

    const img = new Image();
    img.onload = () => {
      try {
        const corners = detectDocumentCorners(img);
        const rectified = rectifyPerspective(img, corners, 'custom');
        const rotated = rotateCanvas(rectified, rotation);
        const filtered = applyImageFilters(rotated, filter, brightness, contrast);
        setPreviewUrl(filtered.toDataURL('image/png'));
        setStatus('Adjusted preview ready.');
      } catch (error) {
        console.error(error);
        setStatus('Preview update failed.');
      } finally {
        setLoading(false);
      }
    };
    img.src = imageUrl;
  };

  const hasPreview = Boolean(previewUrl);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Scano Web</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Document Scanner & A4 Print Studio</h1>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            {hasPreview ? 'Upload another file' : 'Select document'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live Preview</h2>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                {loading ? 'Processing' : 'Ready'}
              </span>
            </div>

            <div className="flex min-h-[480px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-slate-950/70">
              {previewUrl ? (
                <img src={previewUrl} alt="Scanned preview" className="max-h-[70vh] max-w-full object-contain" />
              ) : (
                <div className="text-center text-slate-400">
                  <div className="mb-4 text-5xl">📄</div>
                  <p className="text-lg font-medium">No document uploaded yet</p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
              <p className="text-sm text-slate-200">{status}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">Filter</label>
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold capitalize transition ${
                      filter === item
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {item.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">Brightness: {brightness}</label>
              <input
                type="range"
                min={-100}
                max={100}
                value={brightness}
                onChange={(event) => setBrightness(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />

              <label className="block text-sm font-medium text-slate-300">Contrast: {contrast}</label>
              <input
                type="range"
                min={-100}
                max={100}
                value={contrast}
                onChange={(event) => setContrast(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />

              <label className="block text-sm font-medium text-slate-300">Rotation: {rotation}°</label>
              <input
                type="range"
                min={0}
                max={360}
                step={90}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleApplyAdjustments}
                className="flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-white"
              >
                Apply changes
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 rounded-full border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-100 transition hover:border-slate-500"
              >
                Print A4
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default App;
