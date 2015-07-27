module Tactile {

  export class Sortable extends Container {

    private index: number;
    private _direction: string;
    private _directionProperties: any;
    private _childEls: HTMLElement[];
    private _siblingEls: HTMLElement[];
    private _childMeasures: Cache;
    private _style: CSSStyleDeclaration = getComputedStyle(this.el);
    private _forceFeedRequired: boolean = true;
    private _avoidDomMutations: boolean = true;
    private _mutObserver:MutationObserver;
    private _ignoreMutObserver:boolean = false;


    constructor(el: HTMLElement, drag: Drag) {
      super(el, drag);
      this._childMeasures = new Cache();
      this._initializeDirection();
      this._initializeMutationListener();
    }

    private _initializeMutationListener():void {
      if (!window["MutationObserver"]) return;
      this._mutObserver = new MutationObserver(this._onDomMutation.bind(this));
      this._mutObserver.observe(this.el, {
        childList: true,
        subtree: true
      })
    }

    private _onDomMutation(e):void {
      this._childMeasures.clear();
    }


    enter(xy: [number, number]): void {
      if (!this.placeholder) {
        this.index = null;
        this._initializeChildAndSiblingEls();
        this._initializePlaceholder();
        this._updatePlaceholderPosition();
        // TODO: need to force measures as velocity may have cached values
      }
      this.placeholder.setState("ghost");
      this.helperSize = this.placeholder.size;
      this.helperScale = this.placeholder.scale;
      this._childMeasures.clear();
      this.move(xy);
    }


    move(xy: [number, number]): void {
      this._updateIndex(xy);
    }


    _updateIndex(xy: [number, number]): void {
      if (this._siblingEls.length === 0) {
        return this._setPlaceholderIndex(0);
      }
      if (this._direction !== 'wrap') {
        this._updateIndexViaOffset(xy);
      } else {
        this._updateIndexViaSelectionApi(xy);
      }
    }


    _updateIndexViaOffset(xy: [number, number]): void {
      const bounds = this.drag.geometryCache.get(this.el, 'cr', () => this.el.getBoundingClientRect());
      const sl = this.drag.geometryCache.get(this.el, 'sl', () => this.el.scrollLeft);
      const st = this.drag.geometryCache.get(this.el, 'st', () => this.el.scrollTop);

      // calculate the position of the item relative to this container
      const innerXY = [xy[0] - bounds.left + sl - parseInt(this._style.paddingLeft, 10),
                       xy[1] - bounds.top + st - parseInt(this._style.paddingTop, 10)];
      let adjustedXY = [innerXY[0] - this.drag.helper.gripXY[0],
                        innerXY[1] - this.drag.helper.gripXY[1]];

      adjustedXY = [adjustedXY[0] / this.helperScale[0],
                    adjustedXY[1] / this.helperScale[1]];


      let naturalOffset = 0;
      let newIndex = 0;
      do {
        let measure = this._getChildMeasure(this._siblingEls[newIndex]);
        if (adjustedXY[this._directionProperties.index] < naturalOffset + measure.dimension / 2) break;
        naturalOffset += measure.dimension;
        newIndex++;
      }
      while (newIndex < this._siblingEls.length);
      this._setPlaceholderIndex(newIndex);
    }


    _updateIndexViaSelectionApi(xy: [number, number]): void {
      const closestElement = Dom.elementFromPointViaSelection(xy);
      const closestElementParents = Dom.ancestors(closestElement, 'li');
      const closestSiblingEl = this._siblingEls.filter(el => closestElementParents.indexOf(el) !== -1)[0];
      if (closestSiblingEl && !Dom.matches(closestSiblingEl, '.velocity-animating')) {
        let newIndex = this._siblingEls.indexOf(closestSiblingEl);
        const childBounds = closestSiblingEl.getBoundingClientRect();
        if (xy[0] > childBounds.left + childBounds.width / 2) newIndex++;
        this._setPlaceholderIndex(newIndex);
      }
    }


    leave(): void {
      if (this.leaveAction === "copy" && this.placeholder.isOriginalEl) {
        this.placeholder.setState("materialized");
      } else {
        this.index = null;
        this.placeholder.setState("hidden");
        this._clearChildTranslations();
        this._childMeasures.clear();
        this._forceFeedRequired = true;
        this._updatePlaceholderPosition();
      }
    }


    finalizePosition(el: HTMLElement): void {
      this.el.insertBefore(el, this._siblingEls[this.index]);
    }


    dispose(): void {
      if (this.placeholder) this.placeholder.dispose()
      if (this._mutObserver) {
        this._mutObserver.disconnect();
        this._mutObserver = null;
      }

      this._clearChildTranslations();
      this._childMeasures.dispose();
    }


    private _initializeDirection(): void {
      this._direction = this.el.getAttribute('data-drag-sortable') || "vertical";
      this._directionProperties = this._direction === "vertical"
        ? {
          index: 1,
          translate: 'translateY',
          paddingStart: 'paddingTop',
          layoutOffset: 'offsetTop',
          outerDimension: 'outerHeight'
        }
        : {
          index: 0,
          translate: 'translateX',
          paddingStart: 'paddingLeft',
          layoutOffset: 'offsetLeft',
          outerDimension: 'outerWidth'
        };

      // the simple layout algorithm that uses transform:translate() rather than
      // repositioning the placeholders in the DOM does not support wrapping
      // sortable layouts. In this case revert to DOM-based positioning
      if (this._direction === 'wrap') {
        this._avoidDomMutations = false;
      } else {
        this._avoidDomMutations = this.drag.options.avoidDomMutations;
      }
    }


    private _initializePlaceholder(): void {
      if (this.drag.draggable.originalParentEl === this.el) {
        this.placeholder = new Placeholder(this.drag.draggable.el, this.drag);
        this.index = this._childEls.indexOf(this.drag.draggable.el);
      } else {
        this.placeholder = Placeholder.buildPlaceholder(this.el, this.drag);
      }
    }


    private _initializeChildAndSiblingEls(): void {
      this._childEls = Dom.children(this.el);
      this._siblingEls = this._childEls.slice(0);
      let draggableElIndex = this._childEls.indexOf(this.drag.draggable.el);
      if (draggableElIndex !== -1) {
        this._siblingEls.splice(draggableElIndex, 1);
      }
    }


    private _setPlaceholderIndex(newIndex: number): void {
      if (newIndex !== this.index) {
        this.index = newIndex;
        this._updatePlaceholderPosition();
      }
    }


    private _updatePlaceholderPosition(): void {
      if (this._avoidDomMutations) {
        this._updateChildTranslations();
      } else {
        this._updatePlaceholderIndex();
      }
    }


    private _getChildMeasure(el: HTMLElement): any {
      function getMeasure() {
        return {
          layoutOffset: el[this._directionProperties.layoutOffset] - parseInt(this._style[this._directionProperties.paddingStart], 10),
          dimension: Dom[this._directionProperties.outerDimension](el, true),
          translation: <number>null
        };
      }
      let measure = this._childMeasures.get(el, 'measures', getMeasure.bind(this));
      return measure;
    }


    // reposition the placeholder at the new index position
    // this method is slower than using translations as it mutates the dom
    // and triggers a layout pass, however it supports all sortable directions
    private _updatePlaceholderIndex(): void {
      let domMutation = () => this.el.insertBefore(this.placeholder.el, this._siblingEls[this.index]);
      Animation.animateDomMutation(this.el, domMutation, { animationOptions: this.drag.options.reorderAnimation });
    }


    private _updateChildTranslations(): void {
      let offset: number = 0;
      let placeholderOffset: number = null;

      let els = []
      let elValues = [];

      this._siblingEls.forEach(function(el: HTMLElement, index: number) {
        if (index === this.index) {
          placeholderOffset = offset;
          offset += this.placeholder.outerSize[this._directionProperties.index];
        }
        let measure = this._getChildMeasure(el);
        let newTranslation = offset - measure.layoutOffset
        if (measure.translation !== newTranslation || this._forceFeedRequired) {
          measure.translation = newTranslation;
          els.push(el);
          elValues.push(newTranslation);
        }
        offset += measure.dimension;
      }.bind(this));

      const translate = this._directionProperties.translate;

      let props = {
      [translate]: this._forceFeedRequired
        ? [function(i) { return elValues[i]; },
           function(i) { return elValues[i] + 0.0001; }]
        : function(i) { return elValues[i]; }
      };
      Animation.set(els, props, this.drag.options.reorderAnimation);


      if (placeholderOffset === null) placeholderOffset = offset;
      let placeholderMeasure = this._getChildMeasure(this.placeholder.el);
      let newPlaceholderTranslation = placeholderOffset - placeholderMeasure.layoutOffset;
      if (placeholderMeasure.translation !== newPlaceholderTranslation || this._forceFeedRequired) {
        // teleport the placeholder into it's new position (no animation)
        Dom.transform(this.placeholder.el, { [translate]: newPlaceholderTranslation });
        placeholderMeasure.translation = newPlaceholderTranslation;
      }
      this._forceFeedRequired = false;
    }


    private _clearChildTranslations(): void {
      // synchronously clear the transform styles (rather than calling
      // velocity.js) to avoid flickering when the dom elements are reordered
      Animation.stop(this._siblingEls || []);
      if (this._childEls) {
        this._childEls.forEach(function(el) {
          el.style.transform = '';
          el.style.webkitTransform = '';
        });
      }
      Animation.clear(this._siblingEls || []);
      this._forceFeedRequired = true;
    }
  }
}
