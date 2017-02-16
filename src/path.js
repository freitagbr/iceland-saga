import { sub, } from './vector';
import { clamp, } from './math';

export const getPointAtLength = (path, length) => {
  const p = path.getPointAtLength(length);
  return { x: p.x, y: p.y, };
};

export const getLength = path => path.getTotalLength();

export const getPointAtPercent = (path, percent) => (
  Array.isArray(path)
    ? path[Math.round(clamp(percent) * (path.length - 1))]
    : getPointAtLength(path, percent * getLength(path))
);

const distance = (pointA, pointB) => {
  const d = sub(pointA, pointB);
  return Math.sqrt((d.x * d.x) + (d.y * d.y));
};

export const getLengthAtPoint = (path, point, subdivisionsPerIteration = 10, _iterations = 5) => {
  const pathLength = getLength(path);
  let iterations = _iterations;
  return (function iterate(lower, upper) {
    const delta = upper - lower;
    const step = delta / (subdivisionsPerIteration - 1);

    const subdivisions = Array.from(Array(subdivisionsPerIteration))
      .map((v, i) => {
        const subLength = lower + (step * i);
        const subPoint = getPointAtLength(path, subLength);
        const subDistance = distance(point, subPoint);
        return {
          length: subLength,
          point: subPoint,
          distance: subDistance,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .map(v => v.length)
      .slice(0, 2);

    iterations -= 1;
    if (!iterations) return subdivisions[0];

    return iterate(...subdivisions.sort((a, b) => a - b));
  }(0, pathLength));
};

export const subdividePath = (path, _subdivisions, subdivideByDistance = false) => {
  const length = getLength(path);
  let subdivisions = _subdivisions;

  if (subdivideByDistance) subdivisions = length / subdivisions;

  const subdivisionLength = length / subdivisions;
  return Array.from(Array(Math.floor(subdivisions)))
    .map((cur, i) => getPointAtLength(path, i * subdivisionLength));
};
