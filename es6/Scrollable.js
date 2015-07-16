import * as dom from "./lib/dom.js";

export default class Scrollable {

  static get selector() { return '[data-drag-scrollable]'; }

  static closest(el) { return dom.closest(el, this.selector); }

  static scale(v, d, r) { return (v-d[0]) / (d[1]-d[0]) * (r[1]-r[0]) + r[0]; }

  constructor(drag, el) {
    this.el = el;
    this.velocity = [0,0];
    this.offset = [0,0];
    this.hEnabled = false;
    this.vEnabled = false;
    this.direction = 'both';
    this.lastUpdate = null;
    this.options = drag.options;
    this.initialize();
  }

  initialize() {
    let style = getComputedStyle(this.el);
    this.hEnabled = (style.overflowX === 'auto' || style.overflowX === 'scroll')
    this.vEnabled = (style.overflowY === 'auto' || style.overflowY === 'scroll')
    if (this.el.tagName === 'BODY') {
      this.bounds = {
        left: 0,
        top: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        right: document.documentElement.clientWidth,
        bottom: document.documentElement.clientHeight
      }
    } else {
      this.bounds = this.el.getBoundingClientRect();
    }
  }


  tryScroll(pointerXY) {
    this.updateVelocity(pointerXY);
    if (this.velocity[0] !== 0 || this.velocity[1] !== 0) {
      this.offset = [this.el.scrollLeft, this.el.scrollTop];
      this.requestId = requestAnimationFrame(this.continueScroll.bind(this));
      return true;
    }
    return false;
  }


  continueScroll() {
    this.requestId = null;
    // calculate the amount we want to scroll
    let currentUpdate = new Date();
    let elapsedTimeMs = this.lastUpdate ? currentUpdate - this.lastUpdate : 16;
    this.offset = [this.offset[0] + this.velocity[0] * elapsedTimeMs,
                   this.offset[1] + this.velocity[1] * elapsedTimeMs];

    // scroll the scrollable
    if (this.velocity[0] !== 0) this.el.scrollLeft = this.offset[0];
    if (this.velocity[1] !== 0) this.el.scrollTop  = this.offset[1];
    this.lastUpdate = currentUpdate;

    // schedule the next scroll update
    if (this.velocity[0] !== 0 || this.velocity[1] !== 0)
      this.requestId = requestAnimationFrame(this.continueScroll.bind(this));
  }


  stopScroll() {
    cancelAnimationFrame(this.requestId);
    this.requestId = null;
    this.lastUpdate = null;
  }


  updateVelocity(xy) {
    const sensitivity = this.options.scrollSensitivity;
    const maxV = this.options.scrollSpeed;
    const b = this.bounds;

    let v = [0,0];
    if (xy[0] >= this.bounds.left && xy[0] <= this.bounds.right
      && xy[1] >= this.bounds.top && xy[1] <= this.bounds.bottom) {

      if (this.hEnabled) {
        const hs = Math.min(sensitivity, b.width / 3);
        if (xy[0] > b.right - hs && dom.canScrollRight(this.el)) v[0] = Scrollable.scale(xy[0], [b.right-hs, b.right], [0, +maxV]);
        if (xy[0] < b.left + hs && dom.canScrollLeft(this.el)) v[0] = Scrollable.scale(xy[0], [b.left+hs, b.left], [0, -maxV]);
      }

      if (this.vEnabled) {
        const vs = Math.min(sensitivity, b.height / 3);
        if (xy[1] > b.bottom - vs && dom.canScrollDown(this.el)) v[1] = Scrollable.scale(xy[1], [b.bottom-vs, b.bottom], [0, +maxV]);
        if (xy[1] < b.top + vs && dom.canScrollUp(this.el)) v[1] = Scrollable.scale(xy[1], [b.top+vs, b.top], [0, -maxV]);
      }
    }
    this.velocity = v;
    return this.velocity[0] !== 0 || this.velocity[1] !== 0;
  }


}
