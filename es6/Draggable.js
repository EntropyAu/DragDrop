import * as dom from "./lib/dom.js";

export default class Draggable {

  static get handleSelector() {
    return '[data-drag-handle]';
  }

  static get draggableSelector() {
    return '[data-draggable],[data-drag-sortable] > *,[data-drag-canvas] > *';
  }

  static get handleOrDraggableSelector() {
    return `${this.handleSelector},${this.draggableSelector}`;
  }

  static get handleUnderDraggableSelector() {
    return '[data-draggable] [data-drag-handle],[data-drag-sortable] [data-drag-handle],[data-drag-canvas] [data-drag-handle]';
  }

  static closest(el) {
    let dragEl = dom.closest(el, Draggable.handleOrDraggableSelector);
    if (!dragEl) return null;

    // if the pointer is over a handle element, ascend the DOM to find the
    // associated draggable item
    if (dragEl.hasAttribute('data-drag-handle')) {
      dragEl = dom.closest(dragEl, this.draggableSelector);
      return dragEl ? new Draggable(dragEl) : null;
    }

    // if the item contains a handle (which was not the the pointer down spot)
    // then ignore
    // TODO: fix this
    console.log(dragEl.querySelectorAll(this.handleUnderDraggableSelector).length);
    if (dragEl.querySelectorAll(this.handleSelector).length >
        dragEl.querySelectorAll(this.handleUnderDraggableSelector).length) {
      return null;
    }

    return dragEl ? new Draggable(dragEl) : null;
  }


  get enabled() {
    return !(this.el.hasAttribute('data-drag-disabled')
          || this.el.parentElement && this.el.parentElement.hasAttribute('data-drag-disabled'));
  }

  constructor(el) {
    this.el = el;
    this.originalParentEl = el.parentElement;
    this.originalIndex = dom.indexOf(el);
    this.originalSize = [this.el.offsetWidth, this.el.offsetHeight];
    this.originalOffset = [this.el.offsetLeft, this.el.offsetTop];
    this.originalScale = dom.clientScale(el);
  }

  removeOriginal() {
    this.el.remove();
  }

  clean() {
    this.el.removeAttribute('data-drag-placeholder');
    this.el.classList.remove('dd-drag-placeholder');
    this.el.style.webkitTransform = '';
    this.el.style.transform = '';
    this.el.style.visibility = 'visible';
  }

  restoreOriginal() {
    dom.topLeft(this.el, this.originalOffset);
    this.originalParentEl.insertBefore(this.el, this.originalParentEl.children[this.originalIndex]);
  }

}
