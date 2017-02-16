export default (n, f) => {
  for (let i = 0; i < n; i += 1) {
    f.call(this, i);
  }
};
