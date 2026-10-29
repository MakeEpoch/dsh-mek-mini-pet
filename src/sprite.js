export class SpritePlayer {
  #element; #onError; #timer; #signature; #frame = 0;
  constructor(element, onError) { this.#element = element; this.#onError = onError; }
  play({ row = 0, frames = 1, speed = 1, paused = false, column = 0 }) {
    const signature = `${row}:${frames}:${speed}:${paused}:${column}`;
    if (signature === this.#signature) return;
    this.stop(); this.#signature = signature; this.#frame = column;
    const draw = () => {
      this.#element.style.backgroundPosition = `${this.#frame / 7 * 100}% ${row / 10 * 100}%`;
      this.#element.dataset.frame = String(this.#frame);
      this.#element.dataset.row = String(row);
    };
    draw();
    if (paused || frames === 1) return;
    const tick = () => {
      try { this.#frame = (this.#frame + 1) % frames; draw(); this.#timer = setTimeout(tick, 120 / speed); }
      catch (error) { this.stop(); this.#onError?.(error); }
    };
    this.#timer = setTimeout(tick, 120 / speed);
  }
  stop() { clearTimeout(this.#timer); this.#signature = undefined; }
}
