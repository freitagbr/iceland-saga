export default url => new Promise((resolve, reject) => {
  const ajax = new XMLHttpRequest();
  ajax.open('GET', url);
  ajax.onload = () => {
    if (ajax.status === 200) {
      resolve(ajax.response);
    } else {
      reject(ajax);
    }
  };
  ajax.send();
});
