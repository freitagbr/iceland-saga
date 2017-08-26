/* eslint-disable consistent-return */

import { isNumber, isObject } from './utils';

const objNum = (op, obj, num) => Object.assign({},
  ...Object.keys(obj).map((i) => {
    const r = {};
    r[i] = op(obj[i], num);
    return r;
  })
);

const objObj = (op, objA, objB) => Object.assign({},
  ...Object.keys(objA).map((i) => {
    const r = {};
    r[i] = op(objA[i], objB[i]);
    return r;
  })
);

const opAdd = (a, b) => a + b;
const opSub = (a, b) => a - b;
const opMult = (a, b) => a * b;
const opDiv = (a, b) => a / b;

const doOpOn = (op, a, b) => {
  if (typeof a === typeof b) {
    if (isNumber(a)) return op(a, b);
    if (isObject(a)) return objObj(op, a, b);
  } else if (isObject(a)) return objNum(op, a, b);
};

export const mult = (a, b) => doOpOn(opMult, a, b);
export const sub = (a, b) => doOpOn(opSub, a, b);
export const add = (a, b) => doOpOn(opAdd, a, b);
export const div = (a, b) => doOpOn(opDiv, a, b);
