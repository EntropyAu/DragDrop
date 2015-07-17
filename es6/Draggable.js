import * as dom from "./lib/dom.js";


export default class Draggable {

  static get handleSelector() {
    return '[data-drag-handle]';
  }

  static get draggableSelector() {
    return '[data-drag-draggable],[data-drag-sortable] > *,[data-drag-canvas] > *';
  }

  static get handleOrDraggableSelector() {
    return `${this.handleSelector},${this.draggableSelector}`;
  }

  static get handleUnderDraggableSelector() {
    return '[data-drag-draggable] [data-drag-handle],[data-drag-sortable] [data-drag-handle],[data-drag-canvas] [data-drag-handle]';
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

    // check all of the drag handles underneath this draggable element,
    // and make sure they all belong to other (child) draggables
    for (let childHandleEl of dragEl.querySelectorAll(this.handleSelector)) {
      if (dom.closest(childHandleEl, this.draggableSelector) === dragEl)
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
    this.tags = [];
    this.initialize();
  }

  initialize() {
    if (this.el.hasAttribute('data-drag-tag')) {
      this.tags = (this.el.getAttribute('data-drag-tag') || '').split(' ');
    } else {
      this.tags = (this.el.parentElement.getAttribute('data-drag-tag') || '').split(' ');
    }
  }

  removeOriginal() {
    this.el.remove();
  }

  restoreOriginal() {
    dom.topLeft(this.el, this.originalOffset);
    this.originalParentEl.insertBefore(this.el, this.originalParentEl.children[this.originalIndex]);
  }

}
