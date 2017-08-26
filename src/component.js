import { likeNull, isString } from './utils';

const isFunction = v => typeof v === 'function';
const callIfFunction = (thisObj, f, ifNot = undefined) => {
  if (isFunction(f)) return f.call(thisObj);
  else if (isFunction(ifNot)) return ifNot.call(thisObj);
  return ifNot;
};

export default (props = null) => {
  const object = {
    _state: null,
    _props: null,
    _setProps: null,
    _hasToRender: false,
    _container: null,

    get hasToRender() {
      return this._hasToRender;
    },

    set hasToRender(value) {
      if (value === this._hasToRender) return;
      this._hasToRender = value;

      if (value) requestAnimationFrame(this.startRendering.bind(this));
    },

    get state() {
      if (likeNull(this._state)) this._state = callIfFunction(this, this.initialState, {});
      return this._state;
    },

    set state(value) {
      // TODO: diff to test if it should render
      const newState = Object.assign({}, this.state, value);
      this._state = newState;
      this.hasToRender = true;
      Object.keys(value).forEach(key =>
        callIfFunction(this, `onState${key.substr(0, 1).toUpperCase()}${key.substr(1)}`)
      );
    },

    get props() {
      if (likeNull(this._props)) this._props = callIfFunction(this, this.defaultProps, {});
      if (this._setProps != null) this._props = Object.assign({}, this._props, this._setProps);
      return this._props;
    },

    set props(value) {
      // TODO: diff to test if it should render
      const newProps = Object.assign({}, this.props, value);
      this._props = newProps;
      this.hasToRender = true;
    },

    get container() {
      return this._container;
    },

    appendTo(element) {
      let el;
      if (isString(element)) el = document.querySelector(element);

      this._container = el;

      callIfFunction(this, this.init);

      return this;
    },

    startRendering() {
      if (!this.hasToRender) return;
      callIfFunction(this, this.render);
      this.hasToRender = false;
    },

  };

  object._setProps = props; // eslint-disable-line

  return object;
};
