import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createExperience } from './createExperience.js';
import { KINETI_GLYPH_SVG } from './premiumSymbols.js';
import './kineti.css';

const PHASES = [
  { name: 'Despertar', progress: 0 },
  { name: 'Descubrir', progress: 0.23 },
  { name: 'Conectar', progress: 0.40 },
  { name: 'Multiplicar', progress: 0.56 },
  { name: 'Coordinar', progress: 0.74 },
  { name: 'Integrar', progress: 1 },
];
const BOUNDARIES = [0, 0.15, 0.35, 0.45, 0.65, 0.85, 1];
// Single source of truth for the 1-based phase number shown in kickers,
// mosaic cards, the footer counter and the phase navigation labels.
const phaseLabel = (index) => String(index + 1).padStart(2, '0');
const MOTION_KEY = 'kineti-reduced-motion';
// Optional film grain overlay, disabled unless requested with ?grain=1.
const GRAIN_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('grain') === '1';
const CAPABILITIES = [
  { name: 'Datos verificables', icon: 'data' },
  { name: 'Código', icon: 'code' },
  { name: 'Agentes IA', icon: 'agent' },
  { name: 'Automatización', icon: 'automation' },
  { name: 'Flujos de datos', icon: 'integration' },
  { name: 'Decisiones', icon: 'decisions' },
];

function phaseAt(progress) {
  const nextBoundary = BOUNDARIES.findIndex((boundary) => boundary > progress);
  return nextBoundary === -1 ? 5 : Math.max(0, nextBoundary - 1);
}

function Arrow({ diagonal = false, down = false, className = '' }) {
  return (
    <svg className={`kineti-icon ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : down ? <path d="M12 4v16m-6-6 6 6 6-6" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
    </svg>
  );
}

function KinetiMark({ className = '' }) {
  return (
    <svg className={`kineti-mark ${className}`} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 5h5v22H6zM26 5h-6L12 16l8 11h6L18 16z" fill="currentColor" />
    </svg>
  );
}

function CapabilityIcon({ kind }) {
  const symbol = KINETI_GLYPH_SVG.find((item) => item.id === (kind === 'agent' ? 'agents' : kind));
  return <svg className="kineti-icon kineti-capability-icon" viewBox={symbol.viewBox} aria-hidden="true">
    {symbol.paths.map((d, index) => <path key={index} d={d} fill="currentColor" fillRule={symbol.fillRule} stroke="none" />)}
  </svg>;
}

function readMotionPreference() {
  try {
    const stored = window.localStorage.getItem(MOTION_KEY);
    if (stored !== null) return stored === 'true';
  } catch { /* System preference remains available without storage. */ }
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function buildBrief({ name, email, context }) {
  return [
    'KINETI — UN PUNTO DE PARTIDA',
    '',
    `Nombre: ${name.trim() || 'Por definir'}`,
    `Correo: ${email.trim() || 'Por definir'}`,
    '',
    '¿Qué quieres poner en movimiento?',
    context.trim() || 'Por definir.',
    '',
    'Brief preparado localmente. No se ha enviado ningún dato.',
  ].join('\n');
}

function ContactDialog({ dialogRef, onClose }) {
  const [brief, setBrief] = useState({ name: '', email: '', context: '' });
  const [feedback, setFeedback] = useState('');
  const [copyFallback, setCopyFallback] = useState(false);
  const previewRef = useRef(null);
  const downloadURLRef = useRef(null);
  const downloadTimerRef = useRef(null);

  useEffect(() => () => {
    if (downloadURLRef.current) URL.revokeObjectURL(downloadURLRef.current);
    window.clearTimeout(downloadTimerRef.current);
  }, []);

  useEffect(() => {
    if (copyFallback) {
      previewRef.current?.focus();
      previewRef.current?.select();
    }
  }, [copyFallback]);

  const update = (event) => {
    setBrief((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFeedback('');
  };

  const copyBrief = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(buildBrief(brief));
      setCopyFallback(false);
      setFeedback('Brief copiado. Ya puedes compartirlo donde prefieras.');
    } catch {
      setCopyFallback(true);
      setFeedback('Tu navegador no permitió copiar. El texto está seleccionado para que lo copies.');
      requestAnimationFrame(() => {
        previewRef.current?.focus();
        previewRef.current?.select();
      });
    }
  };

  const downloadBrief = () => {
    if (downloadURLRef.current) URL.revokeObjectURL(downloadURLRef.current);
    window.clearTimeout(downloadTimerRef.current);
    const url = URL.createObjectURL(new Blob([buildBrief(brief)], { type: 'text/plain;charset=utf-8' }));
    downloadURLRef.current = url;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kineti-mi-punto-de-partida.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    downloadTimerRef.current = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      if (downloadURLRef.current === url) downloadURLRef.current = null;
    }, 10_000);
    setFeedback('Brief preparado para descargar. Tus datos siguen en tu navegador.');
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button, input, textarea, a[href], [tabindex="0"]')]
      .filter((element) => !element.disabled && element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="kineti-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kineti-contact-title"
      aria-describedby="kineti-contact-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
      onKeyDown={trapFocus}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="kineti-dialog-topline">
        <span className="kineti-eyebrow"><span className="kineti-dot" /> Un punto de partida</span>
        <button className="kineti-icon-button" type="button" data-testid="contact-close" onClick={onClose} aria-label="Cerrar conversación">
          <svg className="kineti-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <h2 id="kineti-contact-title">Las buenas ideas<br />empiezan hablando.</h2>
      <p id="kineti-contact-description" className="kineti-dialog-description">Dale forma a tu siguiente paso. Prepara un brief que puedas guardar o compartir con tu equipo.</p>
      <form className="kineti-brief-form" onSubmit={(event) => event.preventDefault()}>
        <div className="kineti-form-row">
          <label htmlFor="kineti-name">Tu nombre <span>opcional</span>
            <input id="kineti-name" name="name" value={brief.name} onChange={update} autoComplete="name" placeholder="¿Cómo te llamas?" maxLength={120} />
          </label>
          <label htmlFor="kineti-email">Tu correo <span>opcional</span>
            <input id="kineti-email" name="email" type="email" value={brief.email} onChange={update} autoComplete="email" placeholder="tu@empresa.com" maxLength={200} />
          </label>
        </div>
        <label htmlFor="kineti-context">¿Qué quieres poner en movimiento?
          <textarea id="kineti-context" name="context" value={brief.context} onChange={update} rows={4} maxLength={6000} placeholder="Un reto, una oportunidad o algo que hoy podría funcionar mejor…" />
        </label>
        {copyFallback && <label className="kineti-copy-preview" htmlFor="kineti-brief-preview">Tu brief, listo para copiar
          <textarea id="kineti-brief-preview" ref={previewRef} value={buildBrief(brief)} readOnly rows={5} />
        </label>}
        <div className="kineti-dialog-actions">
          <button type="button" className="kineti-button kineti-button-lime" data-testid="contact-download" onClick={downloadBrief}>Guardar mi brief <Arrow down /></button>
          <button type="button" className="kineti-button kineti-button-outline" data-testid="contact-copy" onClick={copyBrief}>Copiar texto <svg className="kineti-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 8V4H4v11h4" /></svg></button>
        </div>
      </form>
      <p className="kineti-local-note">Solo en tu navegador. No se envía ni se guarda información en un servidor.</p>
      <div className="kineti-form-feedback" role="status" aria-live="polite">{feedback}</div>
    </dialog>
  );
}

export default function KinetiExperience() {
  const canvasRef = useRef(null);
  const experienceRef = useRef(null);
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const bodyOverflowRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(readMotionPreference);
  const reducedMotionRef = useRef(reducedMotion);
  const [sceneStatus, setSceneStatus] = useState('loading');
  const [journey, setJourney] = useState({ progress: 0, phase: 0, phaseProgress: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let currentExperience = null;
    const updateProgress = ({ progress = 0, phase, phaseProgress = 0 }) => {
      if (cancelled) return;
      const clampedProgress = Math.min(1, Math.max(0, progress));
      const currentPhase = Number.isFinite(phase) ? Math.min(5, Math.max(0, phase)) : phaseAt(clampedProgress);
      setJourney({ progress: clampedProgress, phase: Math.max(0, currentPhase), phaseProgress });
    };
    const init = async () => {
      try {
        currentExperience = await createExperience({
          canvas: canvasRef.current,
          onProgress: updateProgress,
          onReady: () => { if (!cancelled) setSceneStatus('ready'); },
          onError: () => { if (!cancelled) setSceneStatus('error'); },
          reducedMotion: reducedMotionRef.current,
        });
        if (cancelled) {
          currentExperience?.destroy();
          return;
        }
        experienceRef.current = currentExperience;
        currentExperience?.setReducedMotion(reducedMotionRef.current);
      } catch {
        if (!cancelled) setSceneStatus('error');
      }
    };
    init();
    return () => {
      cancelled = true;
      if (experienceRef.current === currentExperience) experienceRef.current = null;
      currentExperience?.destroy();
    };
  }, []);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    experienceRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      let stored = null;
      try { stored = window.localStorage.getItem(MOTION_KEY); } catch { /* Use the OS preference. */ }
      if (stored === null) setReducedMotion(query.matches);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // The story remains navigable while graphics load, and if they cannot start.
  useEffect(() => {
    if (sceneStatus === 'ready') return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
        setJourney({ progress, phase: phaseAt(progress), phaseProgress: 0 });
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [sceneStatus]);

  useEffect(() => () => {
    if (bodyOverflowRef.current !== null) document.body.style.overflow = bodyOverflowRef.current;
  }, []);

  const goTo = useCallback((progress) => {
    if (experienceRef.current && sceneStatus !== 'error') {
      experienceRef.current.goTo(progress);
    } else {
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, distance * progress), behavior: reducedMotionRef.current ? 'instant' : 'smooth' });
    }
  }, [sceneStatus]);

  const toggleMotion = () => {
    setReducedMotion((current) => {
      const next = !current;
      try { window.localStorage.setItem(MOTION_KEY, String(next)); } catch { /* Preference still applies for this visit. */ }
      return next;
    });
  };

  const openContact = () => {
    if (!dialogRef.current || dialogRef.current.open) return;
    lastFocusedRef.current = document.activeElement;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.showModal();
    setDialogOpen(true);
  };

  const closeContact = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
    if (bodyOverflowRef.current !== null) {
      document.body.style.overflow = bodyOverflowRef.current;
      bodyOverflowRef.current = null;
    }
    setDialogOpen(false);
    lastFocusedRef.current?.focus({ preventScroll: true });
  }, []);

  const phase = PHASES[journey.phase] || PHASES[0];
  const activeCapability = Math.min(5, Math.max(0, Math.floor((journey.progress - 0.17) / 0.15 * CAPABILITIES.length)));
  const phaseProps = (index) => ({
    'data-active': journey.phase === index,
    'aria-hidden': journey.phase !== index,
    inert: journey.phase !== index ? true : undefined,
  });

  return (
    <main className="kineti" data-motion={reducedMotion ? 'reduced' : 'full'} data-phase={journey.phase} data-scene={sceneStatus} aria-label="Kineti, Business Advantage">
      <button type="button" className="kineti-skip-link" onClick={() => goTo(0.23)}>Saltar a las capacidades</button>
      <div className="kineti-runway" aria-hidden="true" />
      <div className="kineti-stage" aria-hidden="true">
        <canvas ref={canvasRef} className="kineti-canvas" aria-hidden="true" data-testid="experience-canvas" />
        <div className="kineti-stage-vignette" />
        {sceneStatus === 'error' && <div className="kineti-scene-fallback">
          <div className="kineti-fallback-grid">{Array.from({ length: 9 }, (_, index) => <span key={index}>{index === 4 && <KinetiMark />}</span>)}</div>
          <span>Una idea. Muchas posibilidades.</span>
        </div>}
      </div>
      {GRAIN_ENABLED && <div className="kineti-film-grain" aria-hidden="true" />}

      <header className="kineti-header">
        <a className="kineti-wordmark" href="#vision" aria-label="Kineti, volver al inicio" onClick={(event) => { event.preventDefault(); goTo(0); }}>
          <KinetiMark /><span>kineti<span className="kineti-wordmark-period">.</span></span>
        </a>
        <nav className="kineti-main-nav" aria-label="Navegación principal">
          <a href="#vision" onClick={(event) => { event.preventDefault(); goTo(0); }}>Visión</a>
          <a href="#capacidades" onClick={(event) => { event.preventDefault(); goTo(0.23); }}>Capacidades</a>
          <button type="button" className="kineti-contact-link" onClick={openContact} data-testid="contact-open" aria-haspopup="dialog" aria-expanded={dialogOpen}>Hablemos <Arrow diagonal /></button>
        </nav>
      </header>

      <div className="kineti-story">
        <section className="kineti-panel kineti-panel-hero" id="vision" {...phaseProps(0)}>
          <div className="kineti-hero-title">
          <div className="kineti-eyebrow"><span className="kineti-dot" /> Business Advantage <span className="kineti-eyebrow-line" /></div>
          <h1>Tu información.<br /><span className="kineti-hero-last">En movimiento<span className="kineti-lime">.</span></span></h1>
          </div>
          <div className="kineti-hero-context">
          <p className="kineti-lead">Transformamos datos verificables en decisiones y acciones coordinadas. Agentes de IA sobre una base determinista.</p>
          <button type="button" className="kineti-text-link" onClick={() => goTo(0.23)}>Descubre tu siguiente ventaja <span className="kineti-arrow-circle"><Arrow diagonal /></span></button>
          <div className="kineti-hero-footnote"><span>DATOS</span><span className="kineti-small-cross">+</span><span>AGENTES</span><span className="kineti-small-cross">+</span><span>ACCIÓN</span></div>
          </div>
        </section>

        <section className="kineti-panel kineti-panel-side" id="capacidades" {...phaseProps(1)}>
          <div className="kineti-eyebrow"><span className="kineti-phase-number">{phaseLabel(1)}</span> Descubrir</div>
          <h2>Toda decisión<br />empieza en <em>el dato.</em></h2>
          <p className="kineti-body-copy">Fuentes conectadas, cálculos reproducibles y contexto para convertir información en una ventaja.</p>
          <div className="kineti-capability-list" role="list" aria-label="Capacidades de Kineti">
            {CAPABILITIES.map((item, index) => <div role="listitem" key={item.name} data-active={activeCapability === index}><CapabilityIcon kind={item.icon} /><span>{item.name}</span><span className="kineti-list-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div>)}
          </div>
        </section>

        <section className="kineti-panel kineti-panel-connect" {...phaseProps(2)}>
          <div className="kineti-eyebrow"><span className="kineti-phase-number">{phaseLabel(2)}</span> Conectar</div>
          <h2>Tuberías de datos.<br /><em>Criterios claros.</em></h2>
          <p className="kineti-body-copy">Conecta tus fuentes y transforma la información con validaciones y reglas explícitas. Mismos datos y mismas reglas: cálculos reproducibles.</p>
          <div className="kineti-connected-label"><span /> Origen → validación → contexto <Arrow /></div>
        </section>

        <section className="kineti-panel kineti-panel-mosaic" {...phaseProps(3)}>
          <div className="kineti-mosaic-card">
            <span className="kineti-mosaic-index">{phaseLabel(3)} /</span>
            <div><div className="kineti-eyebrow">Inteligencia agéntica</div><h2>Pregunta en contexto.<br /><em>Decide con evidencia.</em></h2><p>IA conectada a métricas, herramientas y reglas verificables para entender qué está pasando.</p></div>
            <svg className="kineti-mosaic-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 4v40M4 24h40M10 10l28 28M10 38l28-28" /></svg>
          </div>
        </section>

        <section className="kineti-panel kineti-panel-mosaic" {...phaseProps(4)}>
          <div className="kineti-mosaic-card kineti-coordinate-card">
            <span className="kineti-mosaic-index">{phaseLabel(4)} /</span>
            <div><div className="kineti-eyebrow">Coordinar con evidencia</div><h2>Una base determinista.<br /><em>Decisiones compartidas.</em></h2><p>El origen de tus datos y reglas explícitas como punto de partida para coordinar personas, agentes y automatizaciones.</p></div>
            <svg className="kineti-mosaic-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M5 12h38M5 24h38M5 36h38" /><circle cx="16" cy="12" r="4" /><circle cx="32" cy="24" r="4" /><circle cx="23" cy="36" r="4" /></svg>
          </div>
        </section>

        <section className="kineti-panel kineti-panel-finale" {...phaseProps(5)}>
          <div className="kineti-eyebrow"><span className="kineti-dot" /> Integrar para avanzar</div>
          <h2>Todo conectado.<br />Todo en<br /><em>movimiento.</em></h2>
          <p className="kineti-body-copy">Del dato a la decisión. De la decisión a la acción. Diseñemos tu siguiente ventaja.</p>
          <button type="button" className="kineti-button kineti-button-lime kineti-finale-cta" onClick={openContact} aria-haspopup="dialog">Hagamos que suceda <Arrow diagonal /></button>
          <span className="kineti-finale-signature">kineti — Business Advantage</span>
        </section>
      </div>

      <div className={`kineti-scene-status kineti-scene-status-${sceneStatus}`} role="status" aria-live="polite">
        {sceneStatus === 'loading' && <><span className="kineti-loading-indicator" /> Dando forma a las ideas</>}
        {sceneStatus === 'error' && 'La experiencia visual no está disponible. Puedes seguir explorando el contenido.'}
      </div>

      <div className="kineti-scroll-hint" data-visible={journey.phase === 0 && sceneStatus === 'ready'} aria-hidden="true"><span>Desplázate para descubrir</span><Arrow down /></div>

      <footer className="kineti-footer">
        <div className="kineti-progress-track" role="progressbar" aria-label="Progreso de la experiencia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(journey.progress * 100)}><span style={{ transform: `scaleX(${journey.progress})` }} /></div>
        <div className="kineti-current-phase"><span className="kineti-current-index">{phaseLabel(journey.phase)}<span> / 06</span></span><span className="kineti-current-name">{phase.name}</span></div>
        <nav className="kineti-phase-nav" aria-label="Fases de la experiencia" data-testid="phase-nav">
          {PHASES.map((item, index) => <button key={item.name} type="button" data-phase={index} data-progress={item.progress} aria-label={`${phaseLabel(index)}. ${item.name}`} aria-current={journey.phase === index ? 'step' : undefined} onClick={(event) => { goTo(item.progress); event.currentTarget.classList.add('kineti-tooltip-muted'); }} onPointerLeave={(event) => event.currentTarget.classList.remove('kineti-tooltip-muted')}><span className="kineti-phase-tick" /><span className="kineti-phase-tooltip">{item.name}</span></button>)}
        </nav>
        <button className="kineti-motion-toggle" type="button" data-testid="motion-toggle" aria-pressed={reducedMotion} aria-label="Reducir animación" onClick={toggleMotion} title={reducedMotion ? 'Activar movimiento' : 'Reducir movimiento'}><svg className="kineti-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{reducedMotion ? <path d="m9 5 10 7-10 7z" /> : <path d="M9 5v14M15 5v14" />}</svg><span>Movimiento<span className="kineti-motion-state">: {reducedMotion ? 'reducido' : 'activo'}</span></span></button>
      </footer>
      <ContactDialog dialogRef={dialogRef} onClose={closeContact} />
    </main>
  );
}
