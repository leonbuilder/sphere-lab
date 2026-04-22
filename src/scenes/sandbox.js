/** Empty walled arena. The default scene. */

import { W, addBox } from '../core/world.js';
import { PHYS } from '../core/config.js';

export default function sandbox() {
  const pad = 40;
  addBox(pad, pad, W.cw - pad * 2, W.ch - pad * 2);
  W.bgColor1 = '#0b1324';
  W.bgColor2 = '#02040b';
  PHYS.gravityOn = true;
}
