// import 'babel-polyfill';
import canvasMap from './canvas-map';

canvasMap({
  textContainer: document.querySelector('.text'),
  // mapSrc: 'img/map.svg',
  mapSrc: 'img/map.svg',
  trailVisitedColor: '#47DBB4',
  fontPresentColor: '#5D5C56',
}).appendTo('.container');
