/**
 * Focused check for keyboard target lock. The real Input class is instantiated with
 * minimal browser stubs so this stays a pure input test, with no running match.
 */
(globalThis as unknown as { window: unknown }).window = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
(globalThis as unknown as { document: unknown }).document = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
(globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};

const { Input } = await import('../src/game/input');
const { ACTION } = await import('../src/game/types');

const canvas = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
const input = new Input(canvas as unknown as HTMLCanvasElement);
const key = (): KeyboardEvent => ({
  code: 'KeyQ',
  repeat: false,
  target: null,
  preventDefault: () => undefined,
}) as unknown as KeyboardEvent;
const press = (): void => {
  (input as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown(key());
};
const release = (): void => {
  (input as unknown as { onKeyUp: (e: KeyboardEvent) => void }).onKeyUp(key());
};
const heldLock = (): boolean => (input.sample().held & ACTION.LOCK) !== 0;

let failures = 0;
const check = (ok: boolean, label: string): void => {
  if (ok) {
    console.log(`  ok  ${label}`);
    return;
  }
  failures++;
  console.error(`FAIL  ${label}`);
};

check(!heldLock(), 'lock starts off');
press();
check(heldLock(), 'Q press turns lock on');
release();
check(heldLock(), 'Q release leaves the toggle on');
press();
check(!heldLock(), 'the next Q press turns lock off');
release();
check(!heldLock(), 'releasing Q after the second press stays off');

if (failures > 0) process.exit(1);
console.log('lock-toggle-check: 5/5 passed');
