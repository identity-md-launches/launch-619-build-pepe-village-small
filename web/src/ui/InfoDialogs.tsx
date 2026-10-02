import { useState } from 'react';
import { DEMO_DAYS, demoRemainingMs, formatRemaining } from '../state/progress';
import { useProgress } from '../state/store';
import { Dialog } from './Dialog';
import { ANNOUNCEMENTS, BOOK_PAGES, CAMPAIGN_NOTE, STORIES } from './content';

interface Base {
  open: boolean;
  onClose(): void;
}

export function ReaderDialog({ open, onClose }: Base) {
  const [page, setPage] = useState(0);
  const p = BOOK_PAGES[page]!;
  return (
    <Dialog open={open} onClose={onClose} title={p.title} eyebrow={`Professor Lily · page ${page + 1} of ${BOOK_PAGES.length}`}>
      <p>{p.body}</p>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={() => setPage((page + BOOK_PAGES.length - 1) % BOOK_PAGES.length)}>
          Previous page
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setPage((page + 1) % BOOK_PAGES.length)}>
          Next page
        </button>
      </div>
      <p className="fine">{CAMPAIGN_NOTE}</p>
    </Dialog>
  );
}

export function CallerDialog({ open, onClose }: Base) {
  const [story, setStory] = useState(0);
  const s = STORIES[story]!;
  return (
    <Dialog open={open} onClose={onClose} title="On the line with Newsy Ned" eyebrow="Scripted dialogue · no live AI">
      <h3 className="section-title">Demo announcements</h3>
      <ul className="list">
        {ANNOUNCEMENTS.map((a) => (
          <li key={a.title}>
            <strong>{a.title}.</strong> {a.body}
          </li>
        ))}
      </ul>
      <h3 className="section-title">Village story</h3>
      <p>
        <strong>{s.title}.</strong> {s.body}
      </p>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={() => setStory((story + 1) % STORIES.length)}>
          Next story
        </button>
        <span className="muted tabular">
          {story + 1} / {STORIES.length}
        </span>
      </div>
    </Dialog>
  );
}

export function GreeterDialog({ open, onClose, touch }: Base & { touch: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title="Welcome to Pepe Village" eyebrow="Gigi & Gus">
      <p>Feels good to have you here. This is a free demo: wander the square, spin the prize wheel once a day and try the fishing game at the pond.</p>
      <ul className="list">
        <li>
          <strong>Move:</strong> {touch ? 'drag the joystick in the lower-left corner.' : 'WASD or the arrow keys.'}
        </li>
        <li>
          <strong>Interact:</strong> {touch ? 'walk up to a character and tap Interact.' : 'walk up to a character and press E.'}
        </li>
        <li>
          <strong>Prize sign:</strong> {touch ? 'tap' : 'click'} the sign or the prize card to read about the target prize.
        </li>
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Start exploring
        </button>
      </div>
    </Dialog>
  );
}

export function PrizeDialog({ open, onClose }: Base) {
  const progress = useProgress();
  const remaining = formatRemaining(demoRemainingMs(progress, Date.now()));
  return (
    <Dialog open={open} onClose={onClose} title="Grand prize" eyebrow="Target prize: 1 IMD NFT">
      <div className="prize-layout">
        <figure className="prize-card" aria-label="Placeholder prize card">
          <div className="prize-card-art" aria-hidden="true">
            <span className="prize-face">
              <span className="prize-eye" />
              <span className="prize-eye" />
              <span className="prize-mouth" />
            </span>
          </div>
          <figcaption>
            <strong>IMD NFT</strong>
            <span className="tag tag--warn">Illustrative image</span>
          </figcaption>
        </figure>
        <div>
          <p>
            The target prize for a future campaign is <strong>1 IMD NFT</strong>. No real prize image has been provided yet, so this card is an original placeholder.
          </p>
          <p>
            <strong>Campaign concept.</strong> Token holdings and holding duration would generate raffle tickets. Creator fees would fund an NFT prize treasury. Wheel and fishing points are separate game points and do not create raffle tickets.
          </p>
          <p className="notice" role="note">
            {CAMPAIGN_NOTE} No wallet connection, purchases, payments, smart contracts or raffle run in this demo. Treasury balances, token balances, ticket counts and participants are not shown because none exist yet.
          </p>
          <p className="muted tabular">
            Your {DEMO_DAYS}-day demo: {remaining === 'Ended' ? 'ended' : `${remaining} left`}.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

export function HelpDialog({ open, onClose, touch, onReset }: Base & { touch: boolean; onReset(): void }) {
  const [confirm, setConfirm] = useState(false);
  const progress = useProgress();
  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title="How to play"
      eyebrow="Pepe Village demo"
    >
      <ul className="list">
        <li>
          <strong>Move:</strong> {touch ? 'drag the joystick.' : 'WASD or arrow keys.'}
        </li>
        <li>
          <strong>Interact:</strong> {touch ? 'tap Interact near a character.' : 'press E near a character.'}
        </li>
        <li>
          <strong>Prize wheel:</strong> claim one free spin per UTC day. Consecutive days build a streak; a missed day restarts it at Day 1.
        </li>
        <li>
          <strong>Fishing:</strong> hook the fish while the marker is inside the green target.
        </li>
        <li>
          <strong>Demo:</strong> your personal {DEMO_DAYS}-day demo started on your first visit. Progress is saved in this browser only. Game points have no monetary value.
        </li>
      </ul>
      <h3 className="section-title">Saved progress</h3>
      <p className="muted tabular">
        {progress.points} points · {progress.spins} spins · {progress.totalSpins} wheel spins · {progress.fishCaught} fish · best streak {progress.bestStreak}
      </p>
      {confirm ? (
        <div className="notice" role="group" aria-label="Confirm reset">
          <p>Reset progress? Points, spins, streak and the demo timer in this browser will be erased.</p>
          <div className="actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onReset();
                setConfirm(false);
              }}
            >
              Reset progress
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn btn--secondary" onClick={() => setConfirm(true)}>
            Reset progress…
          </button>
        </div>
      )}
    </Dialog>
  );
}
