import TweenLite from 'gsap';

import get from './ajax';
import Component from './component';
import createCanvas from './create-canvas';
import loadImage from './image-loader';
import * as Path from './path';
import { clamp, interpolate, easing } from './math';
import { likeNull, isUndefined, isObject } from './utils';
import { mult, sub, add } from './vector';

const arrayNum = v => Array.from(Array(v));
const getScroll = () => window.pageYOffset;
const setCompositeOperation = (ctx, mode = 'source-over', fallback = null) => {
  ctx.globalCompositeOperation = mode;
  const worked = (ctx.globalCompositeOperation === mode);
  if (!worked && fallback != null) { ctx.globalCompositeOperation = fallback; }
  return worked;
};
const drawCanvasSlice = (ctx, img, slice, target) => {
  const sliceScale = {
    x: img.width / slice.width,
    y: img.height / slice.height,
  };
  const targetSize = {
    width: target.width * sliceScale.x,
    height: target.height * sliceScale.y,
  };
  const targetScale = {
    x: targetSize.width / img.width,
    y: targetSize.height / img.height,
  };

  ctx.drawImage(
    img,
    Math.round(-slice.x * targetScale.x),
    Math.round(-slice.y * targetScale.y),
    Math.round(targetSize.width),
    Math.round(targetSize.height)
  );
};

const CanvasMap = (props) => {
  const object = {
    ready: false,

    canvas: null,
    ctx: null,

    map: null,
    mapScale: 1,
    mapScales: 2,
    mapMaxScale: 2.5,
    mapCache: null,
    mapBuffer: null,
    mapBufferCtx: null,
    mapBufferScale: 0,
    mapBufferSize: { x: 2048, y: 2048 },
    mapBufferMargin: 400,
    mapBufferOffset: null,
    mapBufferLast: null,
    mapSVG: null,
    mapWidth: null,
    mapHeight: null,

    points: null,
    pointsPos: null,
    cameraPath: null,
    cameraBreakpoints: null,
    cameraSubdivisions: null,
    cameraSubdivisionSize: 1,
    cameraLength: 0,
    trailPath: null,
    trailPathData: null,
    trailBreakpoints: null,
    trailSubdivisions: null,
    trailSubdivisionSize: 1,
    trailLength: 0,

    labels: null,

    sections: null,
    sectionsBounds: null,
    sectionsIcons: null,
    imagesBounds: null,

    lastScroll: 0,
    scrollAnim: null,

    textWidth: 0,

    initialState() {
      return {
        sectionIndex: 0,
        section: null,
        sectionBounds: {
          top: 0,
          bottom: 0,
          height: 0,
        },
        cameraSegment: {
          start: 0,
          end: 0,
          length: 0,
        },
        trailSegment: {
          start: 0,
          end: 0,
          length: 0,
        },
        pos: 0,
        width: 0,
        height: 0,
        zoom: 1,
      };
    },
    defaultProps() {
      return {
        textContainer: null,
        mapSrc: null,

        trailColor: null,
        trailWidth: null,
        trailDash: [2, 4],
        trailVisitedColor: '#8EC641',
        trailVisitedWidth: 4,

        pointColor: null,
        pointRadius: null,

        pointFutureColor: '#ccc',
        pointPresentColor: null,
        pointPastColor: null,

        fontPastColor: '#666',
        fontPresentColor: '#000',
        fontFutureColor: '#aaa',
      };
    },
    get trailColor() {
      if (!isUndefined(this.props) && this.props.trailColor != null) {
        return this.props.trailColor;
      }
      if (likeNull(this.trailPath)) {
        return '#ccc';
      }
      return this.trailPath.getAttribute('stroke');
    },
    get trailWidth() {
      if (!isUndefined(this.props) && this.props.trailWidth != null) {
        return this.props.trailColor;
      }
      if (likeNull(this.trailPath)) {
        return 2;
      }
      return parseFloat(this.trailPath.getAttribute('stroke-width') || 2);
    },
    init() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.state = {
        width,
        height,
      };

      this.canvas = createCanvas(width, height);
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = 0;
      this.canvas.style.left = 0;
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(0, 0, this.state.width, this.state.height);
      this.container.appendChild(this.canvas);

      this.calculateSections();
      Array.from(this.props.textContainer.querySelectorAll('img'))
        .forEach((img) => {
          img.addEventListener('load', (/* event */) => {
            this.calculateSections();
            this.renderMap();
          });
        });

      this.scrollAnim = { value: 0 };

      get(this.props.mapSrc).then((response) => {
        const domParser = new DOMParser()
          .parseFromString(response, 'image/svg+xml')
          .childNodes;
        this.mapSVG = Array.from(domParser).filter((node) => {
          const tag = node.tagName;
          if (isUndefined(tag)) return false;
          return tag.toLowerCase() === 'svg';
        })[0];

        this.cameraPath = this.mapSVG.querySelector('#camera-path path');
        this.trailPath = this.mapSVG.querySelector('#trail-path path');

        this.points = Array.from(this.mapSVG.querySelectorAll('#points circle'))
          .map((point) => {
            const x = parseFloat(point.getAttribute('cx'));
            const y = parseFloat(point.getAttribute('cy'));
            return {
              x,
              y,
              length: Path.getLengthAtPoint(this.trailPath, { x, y }),
              label: (point.getAttribute('id') || '').replace(/_/g, ' '),
              color: point.getAttribute('fill') || 'black',
              radius: parseFloat(point.getAttribute('r')),
            };
          })
          .sort((a, b) => a.length - b.length);

        this.cameraSubdivisions = Path.subdividePath(
          this.cameraPath,
          this.cameraSubdivisionSize,
          true
        );
        this.cameraLength = Path.getLength(this.cameraPath);
        this.cameraBreakpoints = this.setupBreakpoints(this.cameraPath);

        this.trailSubdivisions = Path.subdividePath(
          this.trailPath,
          this.trailSubdivisionSize,
          true
        );
        this.trailBreakpoints = this.setupBreakpoints(this.trailPath);
        this.trailLength = Path.getLength(this.trailPath);

        loadImage(this.props.mapSrc).then((img) => {
          this.mapWidth = img.width;
          this.mapHeight = img.height;
          // quick IE fix for #27
          if (this.mapHeight === 0) {
            this.mapWidth = 2040;
            this.mapHeight = 1178;
          }
          this.map = arrayNum(this.mapScales).map((v, i) => {
            const scale = 1 + (((this.mapMaxScale - 1) / (this.mapScales - 1)) * i);
            const map = createCanvas(this.mapWidth * scale, this.mapHeight * scale);
            const mapCtx = map.getContext('2d', { alpha: false });
            mapCtx.fillStyle = 'white';
            mapCtx.fillRect(0, 0, this.mapWidth * scale, this.mapHeight * scale);
            mapCtx.drawImage(img, 0, 0, this.mapWidth * scale, this.mapHeight * scale);
            return { map, scale };
          });
          this.mapBuffer = createCanvas(1, 1);
          this.mapBufferCtx = this.mapBuffer.getContext('2d', { alpha: false });
          this.updateMapBufferSize();
          this.mapBufferCtx.fillStyle = 'white';
          this.mapBufferCtx.fillRect(0, 0, this.mapBufferSize.x, this.mapBufferSize.y);
          this.mapBufferOffset = { x: 0, y: 0 };
          this.mapBufferScale = this.mapScale;
          this.ready = true;
          document.addEventListener('scroll', this.onScroll.bind(this));
          this.onScroll();
        });
      });
      window.addEventListener('resize', this.onResize.bind(this));
    },
    setupBreakpoints(path) {
      return this.points.map(point => Path.getLengthAtPoint(path, point))
        .map((point, i) => (
          this.sections[i].getAttribute('data-stay') === 'true' ? [point, point] : [point]
        ))
        .reduce((flattened, cur) => flattened.concat(cur), []);
    },
    getMapBufferSize() {
      return {
        x: this.state.width + (this.mapBufferMargin * 2),
        y: this.state.height + (this.mapBufferMargin * 2),
      };
    },
    updateMapBufferSize() {
      this.mapBufferSize = this.getMapBufferSize();

      this.mapBuffer.setAttribute('width', this.mapBufferSize.x);
      this.mapBuffer.setAttribute('height', this.mapBufferSize.y);

      this.mapBufferLast = {
        zoom: -1,
        pos: { x: -1, y: -1 },
      };
    },
    calculateSections() {
      const scroll = getScroll();
      this.sections = Array.from(this.props.textContainer.querySelectorAll('.js-section'));
      this.sectionsBounds = this.sections.map((section) => {
        const bounds = section.getBoundingClientRect();
        return {
          top: bounds.top + scroll,
          bottom: bounds.bottom + scroll,
          left: bounds.left,
          right: bounds.right,
          height: bounds.height,
          width: bounds.width,
        };
      });
      this.sectionsIcons = this.sections.map((section) => {
        const icon = section.getAttribute('data-icon');
        if (icon != null) {
          const iconImg = document.createElement('img');
          iconImg.setAttribute('src', icon);
          return iconImg;
        }
        return null;
      });

      this.imagesBounds = this.sections.map(section =>
        Array.from(section.querySelectorAll('.js-image')).map((image) => {
          const bounds = image.getBoundingClientRect();
          return {
            top: bounds.top + scroll,
            bottom: bounds.bottom + scroll,
            left: bounds.left,
            right: bounds.right,
            height: bounds.height,
            mapPos: parseFloat(image.getAttribute('data-pos')),
          };
        })
      );
    },
    onScroll() {
      const scroll = getScroll();
      let t = 0;
      let d = Math.abs(scroll - this.lastScroll);
      d = Math.sqrt(clamp(d / 10));
      this.lastScroll = scroll;
      t = d * 0.2;
      TweenLite.to(this.scrollAnim, t, {
        value: scroll,
        onUpdate: () => {
          this.updateScroll(this.scrollAnim.value);
        },
        onComplete: () => {
          this.updateScroll(this.scrollAnim.value);
        },
      });
    },

    updateScroll(scroll) {
      const sectionIndex = this.sectionsBounds.findIndex(
        (curSection, i, sections) => {
          const isLast = i === sections.length - 1;
          if (isLast) return true;

          const nextSection = sections[i + 1];
          const isBeforeNextTop = !isUndefined(nextSection) ? scroll < nextSection.top : false;
          const isBeforeCurBottom = scroll < curSection.bottom;
          return isBeforeCurBottom || isBeforeNextTop;
        }
      );

      const sectionBounds = this.sectionsBounds[sectionIndex];
      const section = this.sections[sectionIndex];
      const pos = clamp((scroll - sectionBounds.top) / sectionBounds.height, 0, 1);

      const cameraSegment = {
        start: this.cameraBreakpoints[sectionIndex],
        end: this.cameraBreakpoints[clamp(sectionIndex + 1, this.cameraBreakpoints.length - 1)],
      };
      cameraSegment.length = cameraSegment.end - cameraSegment.start;

      const trailSegment = {
        start: this.trailBreakpoints[sectionIndex],
        end: this.trailBreakpoints[clamp(sectionIndex + 1, this.trailBreakpoints.length - 1)],
      };
      trailSegment.length = trailSegment.end - trailSegment.start;

      this.state = {
        sectionIndex,
        section,
        sectionBounds,
        pos,
        cameraSegment,
        trailSegment,
      };
    },
    onResize() {
      this.state = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      this.updateMapBufferSize();
      this.canvas.width = this.state.width;
      this.canvas.height = this.state.height;
      this.calculateSections();
      this.onScroll();
    },
    getZoom() {
      return this.getZoomAtPercent(this.state.pos);
    },
    drawMapBuffer(ctx, pos, zoom) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, this.mapBufferSize.x, this.mapBufferSize.y);
      let mapIndex = 0;
      while (zoom > this.map[mapIndex].scale && mapIndex < this.map.length - 1) {
        mapIndex += 1;
      }
      const map = this.map[mapIndex];

      const offset = sub(mult(pos, map.scale), this.mapBufferMargin);
      const scale = map.scale / zoom;

      drawCanvasSlice(
        ctx, map.map,
        Object.assign({}, offset, {
          width: this.mapBufferSize.x * scale,
          height: this.mapBufferSize.y * scale
        }),
        {
          x: 0,
          y: 0,
          width: this.mapBufferSize.x,
          height: this.mapBufferSize.y
        }
      );
      return { offset, scale, mapScale: map.scale };
    },
    getCameraPosAtPercent(percent) {
      return Path.getPointAtPercent(
        this.cameraSubdivisions,
        percent
      );
    },
    getMapSliceAtPercent(pcnt) {
      // quick fix bug #20
      const percent = isNaN(pcnt) ? 1 : pcnt;
      const cameraPos = this.getCameraPosAtPercent(percent);
      const zoom = this.getZoomAtPercent(percent);
      const width = this.state.width / zoom;
      const height = this.state.height / zoom;
      const center = {
        x: this.state.width > 720 ? 0.66 : 0.5,
        y: 0.33,
      };
      return {
        x: (cameraPos.x - (width * center.x)),
        y: (cameraPos.y - (height * center.y)),
        width,
        height,
        zoom,
        cameraPos,
      };
    },
    getPosAtPercent(/* percent */) {
      return this.state.pos;
    },
    getZoomAtPercent(/* percent */) {
      const sectionIndex = this.state.sectionIndex;
      const pos = this.getPosAtPercent();

      const section = this.sections[sectionIndex];
      const nextSection = this.sections[clamp(sectionIndex + 1, this.sections.length - 1)];
      // const lastSection = this.sections[clamp(sectionIndex - 1, 0, this.sections.length - 1)];

      const getNumericAttr = (el, attr, def = 1) => {
        const v = el.getAttribute(attr);
        return likeNull(v) ? def : parseFloat(v);
      };
      const getStartZoom = sect => getNumericAttr(sect, 'data-zoom-start', 1);
      const getMiddleZoom = sect => getNumericAttr(sect, 'data-zoom-middle', getStartZoom(sect));

      const zoom1 = pos <= 0.5 ? getStartZoom(section) : getMiddleZoom(section);
      const zoom2 = pos <= 0.5 ? getMiddleZoom(section) : getStartZoom(nextSection);

      return interpolate(
        pos === 1 ? 1 : ((pos / 0.5) - Math.floor(pos / 0.5)),
        zoom1,
        zoom2,
        easing.cubic.inOut
      );
    },
    renderMap() {
      if (!this.ready) return;

      // const localToGlobal = v => mult(sub(v, cameraPos), zoom);
      // const cameraPath = this.cameraPath;
      // const section = this.state.section;
      // const cameraPos = mapSlice.cameraPos;
      const pos = this.state.pos;
      const sectionIndex = this.state.sectionIndex;
      const cameraSegment = this.state.cameraSegment;
      const trailSegment = this.state.trailSegment;
      const trailPos = interpolate(pos, trailSegment.start, trailSegment.end, v => clamp(v * 1.2));
      const trailTipIndex = Math.round(trailPos / this.trailSubdivisionSize);
      const trailTip = this.trailSubdivisions[
        clamp(trailTipIndex, this.trailSubdivisions.length - 1)
      ];
      const trailTip2 = this.trailSubdivisions[
        clamp(trailTipIndex - 1, this.trailSubdivisions.length - 1)
      ];
      const icon = this.sectionsIcons[sectionIndex];
      const mapSlice = this.getMapSliceAtPercent(
        interpolate(pos, cameraSegment.start, cameraSegment.end) / this.cameraLength
      );
      const zoom = mapSlice.zoom;
      const inverseZoom = 1 / zoom;
      const dpi = 1; // window.devicePixelRatio
      let updatedBufferThisFrame = false;

      const canvasPos = (x, y) => (
        isObject(x)
          ? canvasPos(x.x, x.y)
          : [(x - mapSlice.x) * zoom, (y - mapSlice.y) * zoom]
      );

      const drawImagePointer = (image) => {
        const scroll = getScroll();
        const imageMapPos = Path.getPointAtPercent(
          this.trailSubdivisions,
          interpolate(
            image.mapPos,
            trailSegment.start,
            trailSegment.end
          ) / this.trailLength
        );
        const halfWindowHeight = window.innerHeight / 2;
        const falloff = halfWindowHeight * 1.2;
        const imageMiddle = (image.top + (image.height / 2)) - scroll;
        let imageVisibility = (
          falloff - Math.abs(halfWindowHeight - imageMiddle)
        ) / falloff;

        imageVisibility = easing.quad.out(clamp(imageVisibility));

        if (imageVisibility <= 0) return;

        let origin = canvasPos(imageMapPos);
        origin = {
          x: origin[0],
          y: origin[1],
        };

        const transformCoords = (x, y) => [x, y];
        const drawTriangle = (c1, c2) => {
          const corner1 = transformCoords(...c1);
          const corner2 = transformCoords(...c2);
          const getAngle = (x, y) => Math.atan2(y - origin.y, x - origin.x);
          const PI = Math.PI;
          const PI2 = PI * 2;
          const angle1 = getAngle(...corner1) + PI2;
          const angle2 = getAngle(...corner2) + PI2;
          const angleDelta = Math.atan2(Math.sin(angle1 - angle2), Math.cos(angle1 - angle2));
          const angleMiddle = angle1 - (angleDelta / 2);
          const radius = 2 * imageVisibility;
          const angleOrigin = angleMiddle + (PI / 2);
          const originOffset = {
            x: (radius + 1) * Math.cos(angleOrigin),
            y: (radius + 1) * Math.sin(angleOrigin),
          };
          const colorValue = imageVisibility * 0.3;
          this.ctx.fillStyle = `rgba(220,220,202,${colorValue})`;
          setCompositeOperation(this.ctx, 'darken', 'source-over');

          this.ctx.beginPath();
          this.ctx.moveTo(
            origin.x + originOffset.x,
            origin.y + originOffset.y
          );
          this.ctx.lineTo(...corner1);
          this.ctx.lineTo(...corner2);
          this.ctx.lineTo(
            origin.x - originOffset.x,
            origin.y - originOffset.y
          );

          this.ctx.lineWidth = 5 * imageVisibility;
          this.ctx.arc(origin.x, origin.y, radius, angleOrigin + PI, angleOrigin);
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.arc(origin.x, origin.y, radius, angleOrigin, angleOrigin + PI2);
          // this.ctx.strokeStyle=`#aaa`
          // this.ctx.stroke()
          this.ctx.fill();
          setCompositeOperation(this.ctx);

          this.ctx.fillStyle = '#405b54';
          const imagePointRadius = 4 * imageVisibility;
          this.ctx.beginPath();
          this.ctx.arc(origin.x, origin.y, imagePointRadius, 0, PI2);
          this.ctx.fill();
        };

        const corner1 = [
          image.top - scroll < origin.y ? image.right : image.left,
          image.top - scroll,
        ];
        const corner2 = [
          image.bottom - scroll < origin.y ? image.left : image.right,
          image.right < origin.x ? image.bottom - scroll : image.top - scroll,
        ];

        drawTriangle(corner1, corner2);
      };

      const drawImagePointers = () => {
        this.imagesBounds[this.state.sectionIndex].forEach(drawImagePointer);
      };

      const drawSubdividedPath = (path, interval = 1, end = -1) => {
        this.ctx.beginPath();
        this.ctx.moveTo(...canvasPos(path[0]));
        let brokenPath = false;
        for (let i = 1; i < (end === -1 ? path.length : clamp(end, path.length)); i += interval) {
          const f = brokenPath ? this.ctx.moveTo : this.ctx.lineTo;
          const p = canvasPos(path[i]);
          if (p[0] >= 0 && p[1] >= 0 && p[0] < this.state.width && p[1] < this.state.height) {
            brokenPath = false;
            f.call(this.ctx, ...p);
          } else {
            brokenPath = true;
          }
        }
        this.ctx.stroke();
      };

      const drawTrail = () => {
        this.ctx.lineWidth = this.trailWidth;
        this.ctx.strokeStyle = this.trailColor;
        this.ctx.lineCap = 'round';
        this.ctx.setLineDash(this.props.trailDash);
        drawSubdividedPath(this.trailSubdivisions, 4);

        this.ctx.lineWidth = this.props.trailVisitedWidth;
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = this.props.trailVisitedColor;
        this.ctx.lineCap = 'butt';
        drawSubdividedPath(this.trailSubdivisions, 2, trailTipIndex);
      };

      const isVisited = point => trailPos >= point.length;

      // sets a value if the point has been visited, is being visited, or hasnt been visited yet
      const setByStatus = (i, past, present, fut = null) => {
        const future = likeNull(fut) ? past : fut;
        const point = this.points[i];
        const nextPoint = this.points[i + 1] || null;
        if (!isVisited(point)) return future;
        if (likeNull(nextPoint)) return present;
        if (isVisited(nextPoint)) return past;
        return present;
      };

      const drawPoint = (point, i) => {
        this.ctx.fillStyle = setByStatus(i,
          this.props.pointPastColor || point.color,
          this.props.pointPresentColor || point.color,
          this.props.pointFutureColor
        );
        this.ctx.beginPath();
        this.ctx.arc(
          ...canvasPos(point),
          (this.props.pointRadius || point.radius),
          0, 2 * Math.PI
        );
        this.ctx.fill();
      };

      const drawPoints = () => this.points.forEach(drawPoint);

      const drawLabel = (point, i) => {
        const fontSize = 15;
        this.ctx.font = `${setByStatus(i, 'normal', 'bold')} ${(setByStatus(i, fontSize, fontSize * 1.2))}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = setByStatus(i,
          this.props.fontPastColor,
          this.props.fontPresentColor,
          this.props.fontFutureColor
        );
        this.ctx.strokeStyle = '#FDFCEC';
        this.ctx.lineWidth = 6;
        const labelPos = add(point, { x: 20 * inverseZoom, y: 0 });
        this.ctx.strokeText(point.label, ...canvasPos(labelPos));
        this.ctx.fillText(point.label, ...canvasPos(labelPos));
      };

      const drawLabels = () => this.points.forEach(drawLabel);

      const drawIcon = () => {
        if (likeNull(icon)) return;

        const iconCenter = {
          x: icon.width / 2,
          y: icon.height / 2,
        };
        const angle = Math.atan2(
          trailTip.y - trailTip2.y,
          trailTip.x - trailTip2.x
        );
        this.ctx.save();
        this.ctx.translate(
          ...canvasPos(trailTip.x, trailTip.y)
        );
        this.ctx.rotate(angle);
        const p = pos * 1.2;
        const scale = clamp(
          p < 0.5
            ? interpolate(p * 2, 0, 1, easing.quad.out)
            : interpolate((p * 2) - 1, 1, 0, easing.quad.in)
        ) * 0.7;
        this.ctx.scale(scale, scale);
        this.ctx.drawImage(icon,
          -iconCenter.x,
          -iconCenter.y
        );
        this.ctx.restore();
      };

      const updateMapBuffer = () => {
        updatedBufferThisFrame = true;
        const buffer = this.drawMapBuffer(this.mapBufferCtx, mapSlice, zoom);
        this.mapBufferScale = buffer.scale;
        this.mapBufferOffset = buffer.offset;
        this.mapScale = buffer.mapScale;
      };

      const checkForBufferUpdate = () => {
        const zoomDelta = Math.abs(zoom - this.mapBufferLast.zoom);
        const dx = Math.abs(mapSlice.x - this.mapBufferLast.pos.x);
        const dy = Math.abs(mapSlice.y - this.mapBufferLast.pos.y);
        let mapIndex = 0;
        while (zoom > this.map[mapIndex].scale && mapIndex < this.map.length - 1) {
          mapIndex += 1;
        }
        const optimalScale = this.map[mapIndex].scale;

        if (
          dx < this.mapBufferMargin / 3 &&
          dy < this.mapBufferMargin / 3 &&
          zoomDelta < 1 &&
          !(zoom === optimalScale && this.mapBufferLast.zoom !== optimalScale)
        ) return;

        this.mapBufferLast = {
          zoom,
          pos: { x: mapSlice.x, y: mapSlice.y },
        };
        updateMapBuffer();
      };

      const drawMap = () => {
        checkForBufferUpdate();

        if (!updatedBufferThisFrame) {
          const slice = {
            x: ((mapSlice.x * this.mapScale) - this.mapBufferOffset.x) / this.mapBufferScale,
            y: ((mapSlice.y * this.mapScale) - this.mapBufferOffset.y) / this.mapBufferScale,
            width: (mapSlice.width * this.mapScale) / this.mapBufferScale,
            height: (mapSlice.height * this.mapScale) / this.mapBufferScale,
          };
          const target = {
            x: 0,
            y: 0,
            width: this.state.width,
            height: this.state.height,
          };
          drawCanvasSlice(
            this.ctx,
            this.mapBuffer,
            slice,
            target
          );
        } else {
          this.ctx.drawImage(
            this.mapBuffer,
            Math.round(-this.mapBufferMargin / this.mapBufferScale),
            Math.round(-this.mapBufferMargin / this.mapBufferScale)
          );
        }
      };

      // Clear canvas
      // this.ctx.clearRect(0,0,this.canvas.width*dpi,this.canvas.height*dpi)
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(0, 0, this.canvas.width * dpi, this.canvas.height * dpi);

      drawMap();
      drawTrail();
      drawIcon();
      drawPoints();
      drawLabels();
      drawImagePointers();

      // this.ctx.restore()

      const blendWorks = setCompositeOperation(this.ctx, 'screen');
      const right = this.sectionsBounds[0].right;
      const gradient = this.ctx.createLinearGradient(right, 0, right + 200, 0);

      if (blendWorks) {
        gradient.addColorStop(0, 'rgba(185, 217, 151, 1)');
        gradient.addColorStop(1, 'rgba(185, 217, 151, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      this.ctx.fillStyle = gradient;

      // this.ctx.fillStyle='rgba(185, 217, 151, 1)'

      this.ctx.fillRect(0, 0, this.sectionsBounds[0].right + 200, this.state.height);

      if (blendWorks) {
        setCompositeOperation(this.ctx);
      }
    },
    render() {
      this.renderMap();
    },
  };

  return Object.assign(
    Component(props),
    object
  );
};

export default CanvasMap;
