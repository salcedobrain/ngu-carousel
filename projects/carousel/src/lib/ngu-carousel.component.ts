import { isPlatformBrowser } from '@angular/common';
import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  DoCheck,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  isDevMode,
  IterableChangeRecord,
  IterableChanges,
  IterableDiffer,
  IterableDiffers,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  QueryList,
  Renderer2,
  TrackByFunction,
  ViewChild,
  ViewContainerRef,
  EmbeddedViewRef
} from '@angular/core';
import {
  empty,
  fromEvent,
  interval,
  merge,
  Observable,
  of,
  Subject,
  Subscription
} from 'rxjs';
import {
  mapTo,
  startWith,
  switchMap,
  takeUntil,
  debounceTime
} from 'rxjs/operators';
import {
  NguCarouselDefDirective,
  NguCarouselOutlet,
  NguCarouselOutletLeft,
  NguCarouselOutletRight
} from './ngu-carousel.directive';
import {
  NguCarouselConfig,
  NguCarouselOutletContext,
  NguCarouselStore
} from './ngu-carousel';
import { slider } from './carousel-animation';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'ngu-carousel',
  templateUrl: 'ngu-carousel.component.html',
  styleUrls: ['ngu-carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slider],
  host: {
    '[class.nguvertical]': 'vertical.enabled',
    '[class.ngurtl]': 'RTL && !vertical.enabled',
    '[class]': 'token'
  }
})
// tslint:disable-next-line:component-class-suffix
export class NguCarousel<T> extends NguCarouselStore
  implements OnInit, AfterContentInit, AfterViewInit, OnDestroy, DoCheck {
  _dataSubscription: Subscription;
  _dataSource: T[];
  _dataDiffer: IterableDiffer<{}>;
  styleid: string;

  private pointIndex: number;
  private withAnim = true;
  activePoint: number;
  isHovered = false;
  alternatives = false;

  @Input('inputs')
  private inputs: NguCarouselConfig;
  @Output('carouselLoad')
  private carouselLoad = new EventEmitter();

  // tslint:disable-next-line:no-output-on-prefix
  @Output('onMove')
  private onMove = new EventEmitter<NguCarousel<T>>();
  arrayChanges: IterableChanges<{}>;
  carouselInt: Subscription;

  listener3: () => void;
  listener4: () => void;

  extraLoopItemsWidth: number;
  resetAferAnimation: any;
  carouselItemSize: number;

  @Input('dataSource')
  get dataSource(): T[] {
    return this._dataSource;
  }
  set dataSource(data: T[]) {
    if (data) {
      this._switchDataSource(data);
    }
  }

  private _defaultNodeDef: NguCarouselDefDirective<T> | null;

  @ContentChildren(NguCarouselDefDirective)
  private _defDirec: QueryList<NguCarouselDefDirective<T>>;

  @ViewChild(NguCarouselOutlet)
  _nodeOutlet: NguCarouselOutlet;

  @ViewChild(NguCarouselOutletLeft)
  _nodeOutletLeft: NguCarouselOutlet;

  @ViewChild(NguCarouselOutletRight)
  _nodeOutletRight: NguCarouselOutlet;

  @ViewChild('ngucarousel', { read: ElementRef })
  private carouselMain1: ElementRef;

  @ViewChild('nguItemsContainer', { read: ElementRef })
  private nguItemsContainer: ElementRef;

  @ViewChild('touchContainer', { read: ElementRef })
  private touchContainer: ElementRef;

  private _intervalController$ = new Subject<number>();

  private carousel: any;

  private onResize: any;
  private onScrolling: any;

  pointNumbers: Array<any> = [];

  /**
   * Tracking function that will be used to check the differences in data changes. Used similarly
   * to `ngFor` `trackBy` function. Optimize Items operations by identifying a Items based on its data
   * relative to the function to know if a Items should be added/removed/moved.
   * Accepts a function that takes two parameters, `index` and `item`.
   */
  @Input()
  get trackBy(): TrackByFunction<T> {
    return this._trackByFn;
  }
  set trackBy(fn: TrackByFunction<T>) {
    if (
      isDevMode() &&
      fn != null &&
      typeof fn !== 'function' &&
      <any>console &&
      <any>console.warn
    ) {
      console.warn(
        `trackBy must be a function, but received ${JSON.stringify(fn)}.`
      );
    }
    this._trackByFn = fn;
  }
  private _trackByFn: TrackByFunction<T>;

  constructor(
    private _el: ElementRef,
    private _renderer: Renderer2,
    private _differs: IterableDiffers,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    super();
  }

  ngOnInit() {
    this._dataDiffer = this._differs
      .find([])
      .create((_i: number, item: any) => {
        return this.trackBy ? this.trackBy(item.dataIndex, item.data) : item;
      });
  }

  ngDoCheck() {
    this.arrayChanges = this._dataDiffer.diff(this.dataSource);
    if (this.arrayChanges && this._defDirec) {
      // console.log('Changes detected!');
      this._observeRenderChanges();
    }
  }

  private _switchDataSource(dataSource: T[]): any {
    this._dataSource = dataSource;
    if (this._defDirec && this.slideItems) {
      console.log('this');
      this._observeRenderChanges();
    }
  }

  private _observeRenderChanges() {
    let dataStream: Observable<T[]> | undefined;

    if (this._dataSource instanceof Observable) {
      dataStream = this._dataSource;
    } else if (Array.isArray(this._dataSource)) {
      dataStream = of(this._dataSource);
    }

    if (dataStream) {
      this._dataSubscription = dataStream
        .pipe(
          takeUntil(this._intervalController$),
          debounceTime(10)
        )
        .subscribe(data => {
          this.renderNodeChanges(data);
          this.isLast = false;
        });
    }
  }

  private renderNodeChanges(
    data: T[],
    viewContainer: ViewContainerRef = this._nodeOutlet.viewContainer
  ) {
    if (!this.arrayChanges) return;
    // console.log(data);
    // this.collectExtractItemIndex.forEach(item => {
    //   item.destroy();
    // });
    // this.collectExtractItemIndex = [];

    this.arrayChanges.forEachOperation(
      (
        item: IterableChangeRecord<T>,
        adjustedPreviousIndex: number,
        currentIndex: number
      ) => {
        // console.log(item);
        // console.log(adjustedPreviousIndex, data[currentIndex]);
        // const node = this._defDirec.find(items => item.item);

        if (item.previousIndex == null) {
          // console.log(data[currentIndex], item);

          this._createNodeItem(data, viewContainer, currentIndex);
        } else if (currentIndex == null) {
          viewContainer.remove(adjustedPreviousIndex);
        } else {
          const view = viewContainer.get(adjustedPreviousIndex);
          viewContainer.move(view, currentIndex);
        }
      }
    );
    this._updateItemIndexContext();
    this.extraLoopItemsWidth = 0;
    if (this.loop) {
      // console.log(0, this.slideItems);
      const leftContainer = this._nodeOutletLeft.viewContainer;
      const rightContainer = this._nodeOutletRight.viewContainer;
      leftContainer.clear();
      rightContainer.clear();
      const rightItems = this.inputs.grid.offset
        ? this.slideItems + 1
        : this.slideItems;
      for (let it = 0; it < rightItems; it++) {
        this._createNodeItem(data, rightContainer, it, true);
        // console.log(this.collectExtractItemIndex);
      }
      const leftItems = this.inputs.grid.offset
        ? this.slideItems + 1
        : this.slideItems;
      const ln = data.length;
      for (let it = ln - 1; it > ln - leftItems - 1; it--) {
        // console.log(it, ln, data.length, this.slideItems);
        this._createNodeItem(data, leftContainer, it, false, 0);
      }
      // console.log('device from renderer', this.deviceType);
      this.calculateExtraItem();
      // 100 / (this.inputs.grid.offset / 2);
      if (this.activePoint === 0) {
        const transform = `translate3d(${this.directionSym}${
          this.extraLoopItemsWidth
        }%, 0, 0`;
        console.log('renderer called transform');
        this.transformCarousel(transform);
      }

      // if (this.carousel) {
      // this._storeCarouselData();
    }
    this._carouselPoint();
  }

  private _createNodeItem(
    data: T[],
    viewContainer: ViewContainerRef,
    currentIndex: number,
    tempItem = false,
    insertIndex?: number
  ) {
    const node = this._getNodeDef(data[currentIndex], currentIndex);
    const context = new NguCarouselOutletContext<T>(data[currentIndex]);
    context.index = currentIndex;
    const indexx = !tempItem
      ? currentIndex
      : typeof insertIndex === 'number'
        ? insertIndex
        : undefined;
    return viewContainer.createEmbeddedView(node.template, context, indexx);
  }

  /**
   * Updates the index-related context for each row to reflect any changes in the index of the rows,
   * e.g. first/last/even/odd.
   */
  private _updateItemIndexContext() {
    const viewContainer = this._nodeOutlet.viewContainer;
    for (
      let renderIndex = 0, count = viewContainer.length;
      renderIndex < count;
      renderIndex++
    ) {
      const viewRef = viewContainer.get(renderIndex) as any;
      const context = viewRef.context as any;
      context.count = count;
      context.first = renderIndex === 0;
      context.last = renderIndex === count - 1;
      context.even = renderIndex % 2 === 0;
      context.odd = !context.even;
      context.index = renderIndex;
    }
  }

  private _getNodeDef(data: T, i: number): NguCarouselDefDirective<T> {
    // console.log(this._defDirec);
    if (this._defDirec.length === 1) {
      return this._defDirec.first;
    }

    const nodeDef =
      this._defDirec.find(def => def.when && def.when(i, data)) ||
      this._defaultNodeDef;

    return nodeDef;
  }

  ngAfterViewInit() {
    console.log('ngAfterViewInit');
    this.carousel = this._el.nativeElement;
    // this.validateInputs(this.inputs);
    // this._carouselSize();
    this.changeGridConfig();
    // console.log('ngAfterContentInit');
    this._observeRenderChanges();

    // this.carouselCssNode = this._createStyleElem();

    if (isPlatformBrowser(this.platformId)) {
      this._carouselInterval();
      if (!this.vertical.enabled) {
        this._touch();
      }
      this.listener3 = this._renderer.listen('window', 'resize', event => {
        this._onResizing(event);
      });
      this._onWindowScrolling();
    }
    this.cdr.markForCheck();
  }

  changeGridConfig(grid?) {
    if (grid) {
      this.inputs.grid = grid;
    }
    this.validateInputs(this.inputs);
    this._carouselSize();
    this.moveTo(this.activePoint, true);
  }

  ngAfterContentInit() {
    console.log('ngAfterContentInit');
    // this._observeRenderChanges();
    // this.cdr.markForCheck();
  }

  ngOnDestroy() {
    // clearInterval(this.carouselInt);
    this.carouselInt && this.carouselInt.unsubscribe();
    this._intervalController$.unsubscribe();
    this.carouselLoad.complete();
    this.onMove.complete();

    /** remove listeners */
    for (let i = 1; i <= 4; i++) {
      const str = `listener${i}`;
      this[str] && this[str]();
    }
  }

  private _onResizing(event: any): void {
    clearTimeout(this.onResize);
    this.onResize = setTimeout(() => {
      if (this.deviceWidth !== event.target.outerWidth) {
        // this._setStyle(this.nguItemsContainer.nativeElement, 'transition', ``);
        this._storeCarouselData();
      }
    }, 500);
  }

  /** Get Touch input */
  private _touch(): void {
    if (this.inputs.touch) {
      const hammertime = new Hammer(this.touchContainer.nativeElement);
      hammertime.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL });

      hammertime.on('panstart', (ev: any) => {
        this.carouselWidth = this.nguItemsContainer.nativeElement.offsetWidth;
        this.touchTransform = this.transform;
        this.dexVal = 0;
        // this._setStyle(this.nguItemsContainer.nativeElement, 'transition', '');
        // this.carouselTransition = '';
      });
      if (this.vertical.enabled) {
        hammertime.on('panup', (ev: any) => {
          this._touchHandling('panleft', ev);
        });
        hammertime.on('pandown', (ev: any) => {
          this._touchHandling('panright', ev);
        });
      } else {
        hammertime.on('panleft', (ev: any) => {
          this._touchHandling('panleft', ev);
        });
        hammertime.on('panright', (ev: any) => {
          this._touchHandling('panright', ev);
        });
      }
      hammertime.on('panend', (ev: any) => {
        if (Math.abs(ev.velocity) >= this.velocity) {
          this.touch.velocity = ev.velocity;
          let direc = 0;
          if (!this.RTL) {
            direc = this.touch.swipe === 'panright' ? 0 : 1;
          } else {
            direc = this.touch.swipe === 'panright' ? 1 : 0;
          }
          console.log('panend');
          this.carouselScrollOne(direc);
        } else {
          this.dexVal = 0;
          const transition = '300ms cubic-bezier(0, 0, 0.2, 1)';
          const transform = `translate3d(-${this.transform +
            this.extraLoopItemsWidth}%,0,0)`;
          this.transformCarousel(transform, transition);
        }
      });
      hammertime.on('hammer.input', function(ev) {
        // allow nested touch events to no propagate, this may have other side affects but works for now.
        // TODO: It is probably better to check the source element of the event and only apply the handle to the correct carousel
        ev.srcEvent.stopPropagation();
      });
    }
  }

  /** handle touch input */
  private _touchHandling(e: string, ev: any): void {
    // if (!this.inputs.touch) return;
    // vertical touch events seem to cause to panstart event with an odd delta
    // and a center of {x:0,y:0} so this will ignore them
    if (ev.center.x === 0 || !this.inputs.touch) {
      return;
    }

    ev = Math.abs(this.vertical.enabled ? ev.deltaY : ev.deltaX);
    let valt = ev - this.dexVal;
    valt =
      this.type === 'responsive'
        ? (Math.abs(ev - this.dexVal) /
            (this.vertical.enabled
              ? this.vertical.height
              : this.carouselWidth)) *
          100
        : valt;
    this.dexVal = ev;
    this.touch.swipe = e;
    this._setTouchTransfrom(e, valt);
    this._setTransformFromTouch();
  }

  private _setTouchTransfrom(e: string, valt: number) {
    const condition = this.RTL ? 'panright' : 'panleft';
    this.touchTransform =
      e === condition ? valt + this.touchTransform : this.touchTransform - valt;
  }

  private _setTransformFromTouch() {
    if (this.touchTransform < 0 && !this.loop) {
      this.touchTransform = 0;
    }
    const type = this.type === 'responsive' ? '%' : 'px';

    const transform = this.vertical.enabled
      ? `translate3d(0, ${this.directionSym}${this.touchTransform}${type}, 0)`
      : `translate3d(${this.directionSym}${this.touchTransform +
          this.extraLoopItemsWidth}${type}, 0, 0)`;

    this.transformCarousel(transform);
  }

  private transformCarousel(transform: string, transition?: string) {
    this.alternatives = !this.alternatives;
    this.carouselTransition = transition || '0ms';
    this.carouselTransform = transform;
    this.cdr.detectChanges();
  }

  /** this fn used to disable the interval when it is not on the viewport */
  private _onWindowScrolling(): void {
    const top = this.carousel.offsetTop;
    const scrollY = window.scrollY;
    const heightt = window.innerHeight;
    const carouselHeight = this.carousel.offsetHeight;
    const isCarouselOnScreen =
      top <= scrollY + heightt - carouselHeight / 4 &&
      top + carouselHeight / 2 >= scrollY;

    if (isCarouselOnScreen) {
      this._intervalController$.next(1);
    } else {
      this._intervalController$.next(0);
    }
  }

  // enableTouch() {
  //   this.inputs.touch = true;
  // }

  // disableTouch() {
  //   this.inputs.touch = false;
  // }

  /** store data based on width of the screen for the carousel */
  private _storeCarouselData(): void {
    this.deviceWidth = isPlatformBrowser(this.platformId)
      ? window.innerWidth
      : 1200;

    this.carouselWidth = this.carouselMain1.nativeElement.offsetWidth;

    if (this.type === 'responsive') {
      // this.deviceType = 'xs';
      this.items = this.inputs.grid.size;
      this.itemWidth =
        this.carouselWidth -
        this.carouselWidth / this.inputs.grid.offset / this.items;
    } else {
      this.items = Math.trunc(this.carouselWidth / this.inputs.grid.size);
      this.itemWidth = this.inputs.grid.size;
      // this.deviceType = 'all';
    }

    this.slideItems = +(this.inputs.slide < this.items
      ? this.inputs.slide
      : this.items);
    this.load =
      this.inputs.load >= this.slideItems ? this.inputs.load : this.slideItems;
    this.speed =
      this.inputs.speed && this.inputs.speed > -1 ? this.inputs.speed : 400;
    console.log('device type', this.type);
    this._carouselPoint();
  }

  /** Used to reset the carousel */
  public reset(withOutAnimation?: boolean): void {
    withOutAnimation && (this.withAnim = false);
    // this.carouselCssNode.innerHTML = '';
    this.moveTo(0);
    this._carouselPoint();
  }

  /** Init carousel point */
  private _carouselPoint(): void {
    const Nos = this.dataSource.length - (this.items - this.slideItems);
    this.pointIndex = Math.ceil(Nos / this.slideItems);
    const pointers = [];

    if (this.pointIndex > 1 || !this.inputs.point.hideOnSingleSlide) {
      for (let i = 0; i < this.pointIndex; i++) {
        pointers.push(i);
      }
    }
    this.pointNumbers = pointers;
    this._carouselPointActiver();
    if (this.pointIndex <= 1) {
      this._btnBoolean(1, 1);
    } else {
      if (this.currentSlide === 0 && !this.loop) {
        this._btnBoolean(1, 0);
      } else {
        this._btnBoolean(0, 0);
      }
    }
  }

  /** change the active point in carousel */
  private _carouselPointActiver(): void {
    const i = Math.ceil(this.currentSlide / this.slideItems);
    this.activePoint = i;
    this.cdr.markForCheck();
  }

  /** this function is used to scoll the carousel when point is clicked */
  public moveTo(slide: number, withOutAnimation?: boolean) {
    // slide = slide - 1;
    withOutAnimation && (this.withAnim = false);
    if (this.activePoint !== slide && slide < this.pointIndex) {
      this.resetAferAnimation = null;
      let slideremains;
      const btns = this.currentSlide < slide ? 1 : 0;

      switch (slide) {
        case 0:
          this._btnBoolean(1, 0);
          slideremains = slide * this.slideItems;
          break;
        case this.pointIndex - 1:
          this._btnBoolean(0, 1);
          slideremains = this.dataSource.length - this.items;
          break;
        default:
          this._btnBoolean(0, 0);
          slideremains = slide * this.slideItems;
      }
      this._carouselScrollTwo(btns, slideremains, this.speed);
    }
  }

  /** set the style of the carousel based the inputs data */
  private _carouselSize(): void {
    if (!this.token) {
      this.token = this._generateID();
      this.styleid = `.${
        this.token
      } > .ngucarousel > .ngu-touch-container > .ngucarousel-items`;
      this._renderer.addClass(this.carousel, this.token);
    }
    const dism = '';
    // if (this.inputs.custom === 'banner') {
    //   this._renderer.addClass(this.carousel, 'banner');
    // }

    // if (this.inputs.animation === 'lazy') {
    //   dism += `${this.styleid} > .item {transition: transform .6s ease;}`;
    // }

    let itemStyle = '';
    if (this.vertical.enabled) {
      this.carouselItemSize = this.vertical.height / +this.inputs.grid.size;
      itemStyle = `${this.styleid} > .item {height: ${
        this.carouselItemSize
      }px}`;

      // itemStyle = `${itemWidth_xs}`;
    } else if (this.type === 'responsive') {
      this.carouselItemSize = this.carouselOffsetWidth / +this.inputs.grid.size;
      itemStyle = `${this.styleid} .item {flex: 0 0 ${
        this.carouselItemSize
      }%; max-width: ${this.carouselItemSize}%;}`;
      // itemStyle = `${itemWidth_xs}`;
    } else {
      itemStyle = `${this.styleid} .item {flex: 0 0 ${
        this.inputs.grid.size
      }px; width: ${this.inputs.grid.size}px;}`;
    }
    console.log(this);

    this.calculateExtraItem();

    this._createStyleElem(`${dism} ${itemStyle}`);
    this.cdr.markForCheck();
    this._storeCarouselData();
  }

  private calculateExtraItem() {
    this.extraLoopItemsWidth =
      this.carouselItemSize *
        (this.slideItems + (this.inputs.grid.offset ? 1 : 0)) -
      this.inputs.grid.offset +
      this.inputs.grid.offset / 2;
  }

  /** logic to scroll the carousel step 1 */
  carouselScrollOne(Btn: number): void {
    let itemSpeed = this.speed;
    let translateXval,
      currentSlide = 0;
    const touchMove = Math.ceil(this.dexVal / this.itemWidth);
    // this._setStyle(this.nguItemsContainer.nativeElement, 'transform', '');
    // this.carouselTransform = '';

    if (this.pointIndex === 1) {
      return;
    } else if (Btn === 0 && ((!this.loop && !this.isFirst) || this.loop)) {
      // const slide = this.slideItems * this.pointIndex;
      let preLast = false;

      const currentSlideD = this.currentSlide - this.slideItems;
      const MoveSlide = currentSlideD + this.slideItems;
      this._btnBoolean(0, 1);
      if (this.currentSlide === 0 && this.loop) {
        preLast = true;
        this._btnBoolean(0, 0);
        if (touchMove > this.slideItems) {
          currentSlide = this.currentSlide - touchMove;
          itemSpeed = 200;
        } else {
          currentSlide = this.currentSlide - this.slideItems;
        }
      } else if (this.currentSlide === 0) {
        currentSlide = this.dataSource.length - this.items;
        itemSpeed = 400;
        this._btnBoolean(0, 1);
      } else if (this.slideItems >= MoveSlide) {
        currentSlide = translateXval = 0;
        this._btnBoolean(1, 0);
      } else {
        this._btnBoolean(0, 0);
        if (touchMove > this.slideItems) {
          currentSlide = this.currentSlide - touchMove;
          itemSpeed = 200;
        } else {
          currentSlide = this.currentSlide - this.slideItems;
        }
      }
      this._carouselScrollTwo(
        Btn,
        currentSlide,
        itemSpeed,
        this.loop && preLast
      );
    } else if (Btn === 1 && ((!this.loop && !this.isLast) || this.loop)) {
      let preLast = false;
      if (
        this.dataSource.length <=
          this.currentSlide + this.items + this.slideItems &&
        !this.isLast
      ) {
        currentSlide = this.dataSource.length - this.items;
        this._btnBoolean(0, 1);
      } else if (this.isLast && this.loop) {
        preLast = true;
        this._btnBoolean(1, 0);
        if (touchMove > this.slideItems) {
          currentSlide =
            this.currentSlide + this.slideItems + (touchMove - this.slideItems);
          itemSpeed = 200;
        } else {
          currentSlide = this.currentSlide + this.slideItems;
        }
      } else if (this.isLast) {
        currentSlide = translateXval = 0;
        itemSpeed = 400;
        this._btnBoolean(1, 0);
      } else {
        this._btnBoolean(0, 0);
        if (touchMove > this.slideItems) {
          currentSlide =
            this.currentSlide + this.slideItems + (touchMove - this.slideItems);
          itemSpeed = 200;
        } else {
          currentSlide = this.currentSlide + this.slideItems;
        }
      }
      this._carouselScrollTwo(
        Btn,
        currentSlide,
        itemSpeed,
        this.loop && preLast
      );
    }
  }

  /** logic to scroll the carousel step 2 */
  private _carouselScrollTwo(
    Btn: number,
    currentSlide: number,
    itemSpeed: number,
    resetAferAnimation = false
  ): void {
    if (this.dexVal !== 0) {
      const val = Math.abs(this.touch.velocity);
      let somt = Math.floor(
        (this.dexVal / val / this.dexVal) * (this.deviceWidth - this.dexVal)
      );
      somt = somt > itemSpeed ? itemSpeed : somt;
      itemSpeed = somt < 200 ? 200 : somt;
      this.dexVal = 0;
    }

    if (this.withAnim) {
      this.carouselTransition = `${itemSpeed}ms ${this.inputs.easing}`;
      this.inputs.animation &&
        this._carouselAnimator(
          Btn,
          currentSlide + 1,
          currentSlide + this.items,
          itemSpeed,
          Math.abs(this.currentSlide - currentSlide)
        );
    } else {
      this.carouselTransition = '0ms cubic-bezier(0, 0, 0.2, 1)';
    }

    this.itemLength = this.dataSource.length;
    this._transformStyle(currentSlide);
    this.currentSlide = currentSlide;
    this.onMove.emit(this);
    this._carouselPointActiver();
    this._carouselLoadTrigger();
    this.withAnim = true;
    this.resetAferAnimation = resetAferAnimation ? Btn : null;
    // console.log('animation start', performance.now());
  }

  animationCompleted() {
    // console.log('animation end', performance.now());
    if (typeof this.resetAferAnimation === 'number') {
      this.moveTo(
        this.resetAferAnimation ? 0 : this.pointNumbers.length - 1,
        true
      );
    }
  }

  /** boolean function for making isFirst and isLast */
  private _btnBoolean(first: number, last: number) {
    this.isFirst = !!first;
    this.isLast = !!last;
  }

  private _transformString(slide: number): string {
    let collect = '';
    collect += `translate3d(`;

    if (this.vertical.enabled) {
      this.transform = (this.vertical.height / this.inputs.grid.size) * slide;
      collect += `0, -${this.transform}px, 0`;
    } else {
      this.transform = this.carouselItemSize * slide;
      const collectSt = this.transform + this.extraLoopItemsWidth;
      collect += `${collectSt > 0 ? this.directionSym : ''}${collectSt}%, 0, 0`;
    }
    collect += `)`;
    return collect;
  }

  /** set the transform style to scroll the carousel  */
  private _transformStyle(slide: number): void {
    let slideCss = '';
    if (this.type === 'responsive') {
      slideCss = `${this._transformString(slide)}`;
    } else {
      this.transform = this.inputs.grid.size * slide;
      slideCss = `translate3d(${this.directionSym}${this.transform}px, 0, 0)`;
    }
    this.transformCarousel(slideCss, this.carouselTransition);
    // console.log(this.carouselTransform, this.carouselTransition);
  }

  /** this will trigger the carousel to load the items */
  private _carouselLoadTrigger(): void {
    if (typeof this.inputs.load === 'number') {
      this.dataSource.length - this.load <= this.currentSlide + this.items &&
        this.carouselLoad.emit(this.currentSlide);
    }
  }

  /** generate Class for each carousel to set specific style */
  private _generateID(): string {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 6; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return `ngucarousel${text}`;
  }

  /** handle the auto slide */
  private _carouselInterval(): void {
    const container = this.carouselMain1.nativeElement;
    if (this.interval && this.loop) {
      this.listener4 = this._renderer.listen('window', 'scroll', () => {
        clearTimeout(this.onScrolling);
        this.onScrolling = setTimeout(() => {
          this._onWindowScrolling();
        }, 600);
      });

      const play$ = fromEvent(container, 'mouseleave').pipe(mapTo(1));
      const pause$ = fromEvent(container, 'mouseenter').pipe(mapTo(0));

      const touchPlay$ = fromEvent(container, 'touchstart').pipe(mapTo(1));
      const touchPause$ = fromEvent(container, 'touchend').pipe(mapTo(0));

      const interval$ = interval(this.inputs.interval.timing).pipe(mapTo(1));

      setTimeout(() => {
        this.carouselInt = merge(
          play$,
          touchPlay$,
          pause$,
          touchPause$,
          this._intervalController$
        )
          .pipe(
            startWith(1),
            switchMap(val => {
              this.isHovered = !val;
              this.cdr.markForCheck();
              return val ? interval$ : empty();
            })
          )
          .subscribe(res => {
            this.carouselScrollOne(1);
          });
      }, this.interval.initialDelay);
    }
  }

  /** animate the carousel items */
  private _carouselAnimator(
    direction: number,
    start: number,
    end: number,
    speed: number,
    length: number,
    viewContainer = this._nodeOutlet.viewContainer
  ): void {
    let val = length < 5 ? length : 5;
    val = val === 1 ? 3 : val;
    const collectIndex = [];

    if (direction === 1) {
      for (let i = start - 1; i < end; i++) {
        val = val * 2;
        const viewRef = viewContainer.get(i) as any;
        if (viewRef) {
          collectIndex.push(i);
          const context = viewRef.context as any;
          context.animate = { value: true, params: { distance: val } };
        }
      }
    } else {
      for (let i = end - 1; i >= start - 1; i--) {
        val = val * 2;
        const viewRef = viewContainer.get(i) as any;
        if (viewRef) {
          collectIndex.push(i);
          const context = viewRef.context as any;
          context.animate = { value: true, params: { distance: -val } };
        }
      }
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      this._removeAnimations(collectIndex);
    }, speed * 0.7);
  }

  private _removeAnimations(indexs: number[]) {
    const viewContainer = this._nodeOutlet.viewContainer;
    indexs.forEach(i => {
      const viewRef = viewContainer.get(i) as any;
      const context = viewRef.context as any;
      context.animate = { value: false, params: { distance: 0 } };
    });
    this.cdr.markForCheck();
  }

  /** Short form for setElementStyle */
  private _setStyle(el: any, prop: any, val: any): void {
    this._renderer.setStyle(el, prop, val);
  }

  /** For generating style tag */
  private _createStyleElem(datas?: string) {
    const styleItem = this._renderer.createElement('style');
    if (datas) {
      const styleText = this._renderer.createText(datas);
      this._renderer.appendChild(styleItem, styleText);
    }
    this._renderer.appendChild(this.carousel, styleItem);
    return styleItem;
  }
}