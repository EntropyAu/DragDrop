import Container from './Container.js';
import ContainerFactory from './ContainerFactory.js';
import Helper from './Helper.js';
import Placeholder from './Placeholder.js';
import Scrollable from './Scrollable.js';
import * as events from './lib/events.js';
import * as math from './lib/math.js';
import * as dom from './lib/dom.js';


// TODO: Animated revert
// TODO: Animated resize
// TODO: Animated destroy (beginDrop elsewhere)
// TODO: Animated pickUp

// TODO: Scroll only if scrollable is an ancestor of the target element
// TODO: Scroll does not propagate if target element is constrained
// TODO: Scroll adjust scroll maxV based on number of items
// TODO: Scroll trigger placeholder update when scroll stops
// TODO: Copy behaviour

export default class Drag {
  constructor(draggable, pointerXY, options) {
    this.options = options;
    this.pointerXY = pointerXY;
    this.constrainedXY = null;
    this.pointerEl = null;
    this.helper = null;

    this.draggable = draggable;
    this.target = null;
    this.knownContainers = new Map();
    this.revertOnCancel = true;
    this.dropAction = "move"; // "copy"
    this.cancelAction = "last"; // "remove", "last"
    this.initialize();
  }


  initialize() {
    this.helper = new Helper(this);
    this.updateConstrainedPosition();
    this.pointerEl = dom.elementFromPoint(this.pointerXY);
    this.draggable.originalContainer = this.updateTargetContainer();
    events.raiseEvent(this.draggable.el, 'dragstart', this)
  }


  move(pointerXY) {
    this.pointerXY = pointerXY;
    this.updateConstrainedPosition();

    if (!this.scroller || !this.scroller.updateVelocity(this.pointerXY)) {
      this.pointerEl = dom.elementFromPoint(pointerXY);
      this.updateTargetContainer();
      if (this.target) this.target.setPointerXY(this.constrainedXY);
      events.raiseEvent(this.draggable.el, 'drag', this);
      this.updateScroll();
    }
    this.helper.setPosition(this.constrainedXY);

  }


  updateScroll() {
    this.scroller = false;
    var scrollEls = dom.ancestors(this.target ? this.target.el : document.body, Scrollable.selector);
    scrollEls.every(function(scrollEl) {
      let scrollable = new Scrollable(this, scrollEl);
      if (scrollable.tryScroll(this.pointerXY)) {
        this.scroller = scrollable;
        return false;
      }
      return true;
    }.bind(this));
  }


  end() {
    if (this.target) this.beginDrop(); else this.beginCancel();
    if (this.scroller) this.scroller.stopScroll();
    events.raiseEvent(this.draggable.el, 'dragend', this)
  }


  beginDrop() {
    events.raiseEvent(this.draggable.el, 'beginDrop', this)
    if (this.target.placeholder) {
      this.helper.animateToElementAndPutDown(this.target.placeholder.el, function() {
        requestAnimationFrame(function() {
          this.target.finalizeDrop(this.draggable);
          this.dispose();
        }.bind(this));
      }.bind(this));
    }
  }


  beginCancel() {
    this.draggable.restoreOriginal();
    // restore draggable to original position
    this.dispose();
  }


  applyDirectionConstraint(drag) {
    switch (drag.orientation) {
      case "vertical": adjustedX = drag.originalOffsetLeft; break;
      case "horizontal": adjustedY = drag.originalOffsetTop; break;
      case "both": break;
    }
  }


  updateConstrainedPosition() {
    if (this.target && this.target.captures(this.draggable)) {
      let constrained = [this.pointerXY[0] - this.helper.grip[0] * this.helper.size[0],
                         this.pointerXY[1] - this.helper.grip[1] * this.helper.size[1]];
      let rect = this.target.el.getBoundingClientRect();
      constrained[0] = math.coerce(constrained[0], rect.left, rect.right - this.helper.size[0]);
      constrained[1] = math.coerce(constrained[1], rect.top, rect.bottom - this.helper.size[1]);
      this.constrainedXY = [constrained[0] + this.helper.grip[0] * this.helper.size[0],
                            constrained[1] + this.helper.grip[1] * this.helper.size[1]];
    } else {
      this.constrainedXY = this.pointerXY;
    }
  }

  getContainerForElement(el) {
    let container = this.knownContainers.get(el);
    if (!container) {
      container = ContainerFactory.makeContainer(el, this);
      this.knownContainers.set(el, container);
    }
    return container;
  }


  findAcceptingTargetUnderEl(el) {
    let targetEl = ContainerFactory.closest(el);
    while (targetEl) {
      let target = this.getContainerForElement(targetEl);
      if (target.accepts(this.draggable)) return target;
      targetEl = ContainerFactory.closest(targetEl.parentElement);
    }
    return null;
  }


  updateTargetContainer() {
    if (this.target && this.target.captures(this.draggable)) return;

    let newTarget = this.findAcceptingTargetUnderEl(this.pointerEl);
    if (newTarget === this.target) return;

    if (newTarget || this.cancelAction !== 'last') {
      if (this.target) this._leaveTarget(this.target);
      if (newTarget) this._enterTarget(newTarget);
      return newTarget;
    }
  }


  _enterTarget(container) {
    if (events.raiseEvent(container.el, 'dragenter', this).returnValue) {
      container.updatePosition(this.constrainedXY);
      container.enter();
      if (container.placeholderSize && this.options.helperResize) {
        this.helper.setSizeAndScale(
          container.placeholderSize,
          container.placeholderScale);
      }
      container.el.classList.add(this.options.containerHoverClass);
      this.target = container;
    }
  }


  _leaveTarget(container) {
    if (events.raiseEvent(container.el, 'dragleave', this).returnValue) {
      container.leave();
      container.el.classList.remove(this.options.containerHoverClass);
      this.target = null;
    }
  }

  dispose() {
    if (this.target) {
      this.target.el.classList.remove('dd-drag-over');
    }

    this.knownContainers.forEach((t) => t.dispose());
    this.helper.dispose();
    this.helper = null;
  }
}
