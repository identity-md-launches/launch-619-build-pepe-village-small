import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type InteractId } from './game/Game';
import { NPC_NAMES } from './game/npcs';
import { demoRemainingMs, formatRemaining, isDemoActive } from './state/progress';
import { resetProgress, useProgress } from './state/store';
import { FishingPanel } from './ui/FishingPanel';
import { CallerDialog, GreeterDialog, HelpDialog, PrizeDialog, ReaderDialog } from './ui/InfoDialogs';
import { Joystick } from './ui/Joystick';
import { WheelPanel } from './ui/WheelPanel';

type Panel = InteractId | 'help' | null;

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener('change', onChange);
    const onTouch = () => setCoarse(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('touchstart', onTouch);
    };
  }, []);
  return coarse;
}

export default function App() {
  const progress = useProgress();
  const touch = useCoarsePointer();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [nearest, setNearest] = useState<InteractId | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [status, setStatus] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [webglError, setWebglError] = useState<string | null>(null);
  const panelRef = useRef<Panel>(null);
  panelRef.current = panel;

  const promptText = touch ? 'Tap Interact' : 'Press E to interact';

  const openPanel = useCallback((id: Panel) => {
    if (panelRef.current) return; // one overlay at a time
    setPanel(id);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;
    let game: Game;
    try {
      game = new Game({
        container,
        overlay,
        promptText,
        onNearestChange: setNearest,
        onInteract: openPanel,
      });
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : String(err));
      return;
    }
    gameRef.current = game;
    // `?debug` exposes a small hook so interaction checks can teleport the player.
    const debug = new URLSearchParams(window.location.search).has('debug');
    const w = window as Window & { pepeVillage?: unknown };
    if (debug) {
      w.pepeVillage = {
        teleport: (x: number, z: number, heading?: number) => game.teleport(x, z, heading),
        state: () => game.getPlayerState(),
        hitTest: (clientX: number, clientY: number) => game.hitTest(clientX, clientY),
        game,
      };
    }
    return () => {
      game.dispose();
      gameRef.current = null;
      if (debug) delete w.pepeVillage;
    };
    // The game is created once; prompt text updates go through setPromptText.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  useEffect(() => {
    gameRef.current?.setPromptText(promptText);
  }, [promptText]);

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.setPaused(panel !== null);
    g.setFocus(panel === 'operator' ? 'wheel' : panel === 'fisher' ? 'fishing' : null);
  }, [panel]);

  // Countdown on the HUD and the 3D sign, refreshed each minute.
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      gameRef.current?.setCountdown(formatRemaining(demoRemainingMs(progress, t)));
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [progress]);

  const announce = useCallback((text: string) => {
    setStatus('');
    window.setTimeout(() => setStatus(text), 30);
  }, []);

  const close = useCallback(() => {
    setPanel(null);
    // Return keyboard focus to the scene so WASD/E work immediately.
    window.setTimeout(() => containerRef.current?.focus(), 0);
  }, []);

  const active = isDemoActive(progress, now);
  const remaining = formatRemaining(demoRemainingMs(progress, now));
  const nearestName = nearest ? NPC_NAMES[nearest] : null;

  return (
    <div className="app">
      <div ref={containerRef} className="scene" tabIndex={-1} aria-label="Game scene" />
      <div ref={overlayRef} className="overlay" aria-hidden="true" />

      <header className="hud hud--top">
        <div className="hud-brand">
          <span className="tag tag--demo" title="Free visual and gameplay test">
            DEMO
          </span>
          <h1 className="hud-title">Pepe Village</h1>
        </div>
        <dl className="hud-stats" aria-label="Progress">
          <div>
            <dt>Points</dt>
            <dd className="tabular">{progress.points}</dd>
          </div>
          <div>
            <dt>Spins</dt>
            <dd className="tabular">{progress.spins}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd className="tabular">{progress.streak > 0 ? `Day ${progress.streak}` : '–'}</dd>
          </div>
          <div>
            <dt>Demo</dt>
            <dd className="tabular">{active ? remaining : 'Ended'}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--surface" onClick={() => openPanel('help')} aria-haspopup="dialog">
          Help
        </button>
      </header>

      {webglError ? (
        <main className="fallback" role="alert">
          <h2>Unable to start the 3D scene</h2>
          <p>Your browser could not create a WebGL context. Enable hardware acceleration or try a current version of Chrome, Firefox, Safari or Edge.</p>
          <pre>{webglError}</pre>
        </main>
      ) : null}

      {!active ? (
        <p className="banner" role="status">
          Demo ended · Final score <strong className="tabular">{progress.points} points</strong>. Claims and spins are closed; exploring and fishing stay open.
        </p>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <div className="hud hud--bottom">
        {touch ? <Joystick /> : <p className="hint">WASD / arrows to walk · E to interact · click the sign to read it</p>}
        <button
          type="button"
          className="btn btn--primary btn--interact"
          onClick={() => gameRef.current?.interact()}
          disabled={!nearest || panel !== null}
          aria-disabled={!nearest}
          hidden={!touch && !nearest}
        >
          {nearestName ? `Interact · ${nearestName}` : 'Interact'}
        </button>
      </div>

      <WheelPanel
        open={panel === 'operator'}
        onClose={close}
        spinTo={(s) => gameRef.current?.spinTo(s) ?? Promise.resolve()}
        isSpinning={() => gameRef.current?.isSpinning() ?? false}
        announce={announce}
      />
      <FishingPanel
        open={panel === 'fisher'}
        onClose={close}
        onCast={() => gameRef.current?.cast()}
        onSplash={(s) => gameRef.current?.splash(s)}
        announce={announce}
      />
      <ReaderDialog open={panel === 'reader'} onClose={close} />
      <CallerDialog open={panel === 'caller'} onClose={close} />
      <GreeterDialog open={panel === 'greeters'} onClose={close} touch={touch} />
      <PrizeDialog open={panel === 'sign'} onClose={close} />
      <HelpDialog
        open={panel === 'help'}
        onClose={close}
        touch={touch}
        onReset={() => {
          resetProgress();
          announce('Progress reset. A new 30-day demo has started.');
          close();
        }}
      />
    </div>
  );
}
