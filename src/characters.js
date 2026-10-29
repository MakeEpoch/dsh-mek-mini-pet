import { xiaoyinSheet } from './xiaoyin-data.js';
export const CHARACTERS = Object.freeze({
  xiaoyin: Object.freeze({ id: 'xiaoyin', name: '小音', description: '温柔沉稳的小伙伴', sheet: xiaoyinSheet }),
  dousha: Object.freeze({ id: 'dousha', name: '豆沙', description: '安静陪伴的原创豆沙兔', sheet: null })
});
export const DEFAULTS = Object.freeze({ character: 'dousha', theme: 'mint', size: 'medium', hidden: false, still: false, speed: 1, interactions: true, showBubble: true, locked: false });
export const SIZES = Object.freeze({ mini: 56, tiny: 80, small: 112, medium: 150, large: 186 });
/**
 * Square crop of the sprite used while the pet rests on a host brand slot.
 * Pet cells are 192x208 and the artwork spans y 5..202, so a full-width square
 * keeps the whole figure; vector characters simply fill the square.
 */
export const LOGO_CROP = Object.freeze({ left: 0, top: 5, size: 192 });
export const SPRITE_ROWS = Object.freeze({ idle: [0, 6], working: [7, 6], waiting: [6, 6], success: [4, 5], error: [5, 8], review: [8, 6], sleeping: [0, 1], waving: [3, 4], right: [1, 8], left: [2, 8] });

export function validateOptions(options) {
  const choices = { character: Object.keys(CHARACTERS), theme: ['mint', 'peach', 'lilac'], size: Object.keys(SIZES), speed: [0.75, 1, 1.25] };
  for (const [key, values] of Object.entries(choices)) if (options[key] !== undefined && !values.includes(options[key])) throw new TypeError(`Unknown ${key}`);
  for (const key of ['hidden', 'still', 'interactions', 'showBubble', 'locked']) if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
}
