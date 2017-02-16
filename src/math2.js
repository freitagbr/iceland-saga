export function clamp(v, _min = null, _max = null) {
  let min = _min;
  let max = _max;
  if (min == null) {
    min = 0;
    max = 1;
  } else if (max == null) {
    max = min;
    min = 0;
  }
  return Math.min(max, Math.max(min, v));
}

export function interpolate(_v, min, max, f = null) {
  let v = _v;
  let op = f;
  if (f == null) {
    op = x => x;
  }
  v = op(v);
  const delta = max - min;
  return min + (v * delta);
}

export const easing = {
  quad: {
    in: v => v * v,
    out: v => -1 * v * (v - 2),
    inOut: (_v) => {
      let v = _v;
      v /= 0.5;
      if (v < 1) return 0.5 * v * v;
      v -= 1;
      return -0.5 * (v * (v - 2) - 1);
    },
  },
  cubic: {
    inOut: (_v) => {
      let v = _v;
      v /= 0.5;
      if (v < 1) return 0.5 * v * v * v;
      v -= 2;
      return 0.5 * (v * v * v + 2);
    },
  },
  sine: {
    inOut: v => -0.5 * (Math.cos(Math.PI * v) - 1),
  },
};
