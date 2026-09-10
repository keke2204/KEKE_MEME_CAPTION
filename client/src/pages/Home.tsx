import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";

type Caption = {
  label: "Short" | "Relatable" | "Over-the-top";
  top: string;
  bottom: string;
};

type RetrievedItem = {
  template_name: string;
  humor_style: string;
  when_to_use: string[];
  example_captions: string[];
  tone: string;
  score: number;
};

type CaptionResult = {
  description: string;
  retrieved: RetrievedItem[];
  captions: Caption[];
  memeImageUrl: string;
  usedFallback?: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCaption(context: CanvasRenderingContext2D, text: string, y: number, canvasWidth: number, fontSize: number) {
  context.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = wrapText(context, text.toUpperCase(), canvasWidth - 72);
  const lineHeight = fontSize * 1.08;
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    context.lineWidth = Math.max(6, fontSize * 0.12);
    context.strokeStyle = "#111111";
    context.fillStyle = "#ffffff";
    context.strokeText(line, canvasWidth / 2, lineY);
    context.fillText(line, canvasWidth / 2, lineY);
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [activeCaption, setActiveCaption] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drawMeme = useCallback(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1060;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const caption = result.captions[activeCaption];
      if (!caption) return;
      const fontSize = Math.max(28, Math.round(canvas.width / 15));
      drawCaption(context, caption.top, Math.max(fontSize * 0.8, canvas.height * 0.08), canvas.width, fontSize);
      drawCaption(context, caption.bottom, canvas.height - Math.max(fontSize * 0.8, canvas.height * 0.1), canvas.width, fontSize);
    };
    image.src = result.memeImageUrl;
  }, [activeCaption, result]);

  useEffect(() => {
    drawMeme();
  }, [drawMeme]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = (nextFile: File | undefined) => {
    setError("");
    if (!nextFile) return;
    if (!acceptedTypes.includes(nextFile.type)) {
      setError("That file type is not supported. Try a JPG, PNG, or WEBP.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError("That image is over 10 MB. Pick a smaller file for the live demo.");
      return;
    }
    setFile(nextFile);
    setResult(null);
    setActiveCaption(0);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const generate = async () => {
    if (!file) {
      setError("Add an image first — the punchline needs a setup.");
      return;
    }
    setIsGenerating(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const response = await fetch("/api/caption", { method: "POST", body });
      const payload = (await response.json()) as CaptionResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Caption generation failed.");
      setResult(payload);
      setActiveCaption(0);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Something went wrong. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerate = async () => {
    if (!result) return;
    setIsRegenerating(true);
    setError("");
    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: result.description, retrieved: result.retrieved }),
      });
      const payload = (await response.json()) as { captions?: Caption[]; usedFallback?: boolean; error?: string };
      if (!response.ok || !payload.captions) throw new Error(payload.error || "Remix failed.");
      setResult(current => current ? { ...current, captions: payload.captions!, usedFallback: payload.usedFallback } : current);
      setActiveCaption(0);
    } catch (regenerationError) {
      setError(regenerationError instanceof Error ? regenerationError.message : "Could not remix the captions.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const downloadMeme = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "meme-caption-generator.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const clearAll = () => {
    setFile(null);
    setResult(null);
    setError("");
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={17} strokeWidth={2.4} /></div>
          <span>KEKE_MEME_CAPTION</span>
        </div>
        <div className="topbar-meta">
          <span className="live-pill"><i /> live demo</span>
          <span className="meta-separator">·</span>
          <span>RAG-powered captioning</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> upload → retrieve → laugh</p>
          <h1>Make the photo<br /><em>the punchline.</em></h1>
          <p className="hero-subtitle">A meme co-pilot that sees what’s in your image, finds the right joke pattern, and writes a caption that actually lands.</p>
        </div>
        <div className="hero-note">
          <span className="note-index">01</span>
          <span>For the classroom,<br />not the content farm.</span>
        </div>
      </section>

      <section className="workspace">
        <div className="input-column">
          <div className="section-label"><span>01</span> your image</div>
          <div
            className={`dropzone ${dragActive ? "is-dragging" : ""} ${previewUrl ? "has-preview" : ""}`}
            onDragOver={event => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={event => { event.preventDefault(); setDragActive(false); selectFile(event.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectFile(event.target.files?.[0])} />
            {previewUrl ? (
              <>
                <img className="input-preview" src={previewUrl} alt="Selected upload preview" />
                <div className="preview-scrim" />
                <div className="preview-label"><Check size={14} /> ready to caption</div>
                <button className="clear-button" type="button" aria-label="Remove image" onClick={event => { event.stopPropagation(); clearAll(); }}><X size={16} /></button>
              </>
            ) : (
              <div className="dropzone-empty">
                <div className="upload-icon"><UploadCloud size={25} /></div>
                <strong>Drop a photo here</strong>
                <span>or click to browse</span>
                <small>JPG · PNG · WEBP <b>·</b> max 10 MB</small>
              </div>
            )}
          </div>
          <div className="format-note"><ImagePlus size={14} /> Images stay in this demo session.</div>
          <button className="primary-button" type="button" onClick={generate} disabled={isGenerating || !file}>
            {isGenerating ? <><LoaderCircle className="spin" size={18} /> reading the room…</> : <><WandSparkles size={18} /> generate captions</>}
            <span className="button-arrow">↗</span>
          </button>
          {error && <div className="error-message" role="alert">{error}</div>}

          <div className="how-it-works">
            <div className="section-label"><span>02</span> what’s happening</div>
            <div className="pipeline-card">
              {["Vision reads the scene", "RAG finds the joke pattern", "Three tones, one good laugh"].map((step, index) => (
                <div className="pipeline-step" key={step}>
                  <span className={`pipeline-number ${result || isGenerating ? "is-active" : ""}`}>{index + 1}</span>
                  <span>{step}</span>
                  {index < 2 && <span className="pipeline-connector" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="output-column">
          <div className="section-label output-label"><span>03</span> your meme <span className="output-status">{result ? "ready" : "waiting for an image"}</span></div>
          <div className={`meme-stage ${result ? "has-result" : ""}`}>
            {result ? (
              <canvas ref={canvasRef} className="meme-canvas" aria-label="Generated meme preview" />
            ) : previewUrl ? (
              <img className="waiting-preview" src={previewUrl} alt="Preview waiting for caption" />
            ) : (
              <div className="meme-empty">
                <div className="empty-sticker">?</div>
                <strong>Your punchline<br />will live here.</strong>
                <span>Upload an image to start the bit.</span>
              </div>
            )}
            {isGenerating && <div className="stage-loading"><LoaderCircle className="spin" size={25} /><span>finding the funny…</span></div>}
          </div>

          {result ? (
            <>
              <div className="caption-controls">
                <div className="caption-chips">
                  {result.captions.map((caption, index) => (
                    <button key={caption.label} type="button" className={`caption-chip ${activeCaption === index ? "selected" : ""}`} onClick={() => setActiveCaption(index)}>
                      <span className="chip-dot" /> {caption.label}
                    </button>
                  ))}
                </div>
                <button className="icon-button" type="button" onClick={regenerate} disabled={isRegenerating} title="Generate fresh captions">
                  <RefreshCw className={isRegenerating ? "spin" : ""} size={17} /> <span>{isRegenerating ? "remixing…" : "regenerate"}</span>
                </button>
              </div>
              <div className="caption-raw"><span>{result.captions[activeCaption]?.top}</span><b> / </b><span>{result.captions[activeCaption]?.bottom}</span></div>
              <button className="download-button" type="button" onClick={downloadMeme}><Download size={17} /> download meme <span>PNG</span></button>
            </>
          ) : (
            <div className="tip-line"><Sparkles size={14} /> Pro tip: the more visually specific the image, the better the joke.</div>
          )}
        </div>
      </section>

      <section className="insight-strip">
        <div className="insight-heading"><span className="section-label"><span>04</span> retrieved inspiration</span><span className="rag-status"><i /> local vector store · 100 entries</span></div>
        <div className="insight-content">
          {result ? (
            <>
              <div className="description-block"><span className="mini-label">SCENE READ</span><p>{result.description}</p></div>
              <div className="retrieval-grid">{result.retrieved.slice(0, 3).map((item, index) => <div className="retrieval-card" key={`${item.template_name}-${index}`}><div><strong>{item.template_name}</strong><span>{item.humor_style}</span></div><em>{Math.round(item.score * 100)}% match</em></div>)}</div>
            </>
          ) : (
            <div className="empty-insight"><span>RAG context will show up here after generation.</span><span className="context-tags"><b>campus life</b><b>deadline humor</b><b>faculty-safe</b></span></div>
          )}
        </div>
      </section>

      <footer className="footer"><span>KEKE_MEME_CAPTION / made for the 30-second demo</span><span>PG-13 · no real-person targeting · local-first</span></footer>
    </main>
  );
}
