export default src => new Promise((resolve) => {
  const img = new Image();
  img.addEventListener('load', () => {
    resolve(img);
  });
  img.src = src;
});
