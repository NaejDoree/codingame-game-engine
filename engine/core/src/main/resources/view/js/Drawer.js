import * as config from './config.js';
import { unlerp } from './utils.js';
import { WIDTH, HEIGHT } from './constants.js';

export class Drawer {
  constructor() {
    this.toDestroy = [];
    this.demo = config.demo;
  }

  static get requirements() {
    return {
      PIXI: 'PIXI4'
    }
  }
  static get VERSION() {
    return 3;
  }
  static get WIDTH() {
    return WIDTH;
  }
  static get HEIGHT() {
    return HEIGHT;
  }
  static getGameRatio() {
    return Drawer.WIDTH / Drawer.HEIGHT;
  }

  instantiateModules() {
    this.modules = {};
    for (const module of config.modules) {
      this.modules[module.name] = new module.class(module.name, config.assets);
    }
  }

  destroy() {
    if (this.alreadyLoaded) {
      this.renderer.destroy();
      this.endCallback = null;
    }
    this.destroyed = true;
  }

  destroyScene(scope) {
    for (var i = 0, l = this.toDestroy.length; i < l; ++i) {
      var texture = this.toDestroy[i];
      texture.destroy(true);
    }
    this.toDestroy = [];
  }

  /** Mandatory */
  getGameName() {
    return "CodinGame";
  }
  canSwapPlayers() {
    return false;
  }

  /** Mandatory */
  getResources() {
    return Object.assign({
      baseUrl: '',
      images: {},
      spines: {},
      sprites: [],
      fonts: [],
      others: []
    }, config.assets);
  }

  getOptions() {
    var drawer = this;
    return [{
      get: function () {
        return drawer.debugMode;
      },
      set: function (value) {
        drawer.debugMode = value;
        drawer.setDebug(value);
      },
      title: 'DEBUG MODE',
      values: {
        'ON': true,
        'OFF': false
      }
    }];
  }

  setDebug(v) {
    this.asyncRenderingTime = Drawer.RenderTimeout;
  }

  /** Mandatory */
  initPreload(scope, container, progress, canvasWidth, canvasHeight) {
    scope.canvasWidth = canvasWidth;
    scope.canvasHeight = canvasHeight;

    scope.loaderProgress = new PIXI.Text('100', {
      fontSize: (canvasHeight * 0.117),
      fontFamily: 'Lato',
      fontWeight: '900',
      fill: 'white',
      align: 'center'
    });

    scope.loaderProgress.anchor.y = 1;
    scope.loaderProgress.anchor.x = 1.3;
    scope.progress = scope.realProgress = progress;
    scope.loaderProgress.position.y = canvasHeight;

    scope.progressBar = new PIXI.Graphics();
    container.addChild(scope.progressBar);
    container.addChild(scope.loaderProgress);
  }

  /** Mandatory */
  preload(scope, container, progress, canvasWidth, canvasHeight, obj) {
    scope.progress = progress;
  }

  /** Mandatory */
  renderPreloadScene(scope, step) {
    var stepFactor = Math.pow(0.998, step);
    scope.realProgress = stepFactor * scope.realProgress + (1 - stepFactor) * scope.progress;
    scope.loaderProgress.text = ((scope.realProgress * 100).toFixed(0));
    scope.loaderProgress.position.x = scope.realProgress * scope.canvasWidth;

    scope.progressBar.clear();

    scope.progressBar.beginFill(0x0, 1);
    scope.progressBar.drawRect(0, 0, scope.canvasWidth * scope.realProgress + 1, scope.canvasHeight);
    scope.progressBar.endFill();

    scope.progressBar.beginFill(0x3f4446, 1);
    scope.progressBar.drawRect(scope.canvasWidth * scope.realProgress, 0, scope.canvasWidth, scope.canvasHeight);
    scope.progressBar.endFill();
    return true;
  }

  /** Mandatory */
  initDefaultScene(scope, container, canvasWidth, canvasHeight) {
    var scene = new PIXI.Container();
    container.addChild(scene);
    container.scale.x = canvasWidth / Drawer.WIDTH;
    container.scale.y = canvasHeight / Drawer.HEIGHT;
    scope.drawer = this;
    scope.renderables = [];
    scope.time = 0;


    if (this.demo) {

      if (this.demo.logo) {
        const logo = PIXI.Sprite.fromFrame('demo-logo');
        logo.position.set(Drawer.WIDTH / 2, Drawer.HEIGHT / 2);
        logo.anchor.x = logo.anchor.y = 0.5;
        scene.addChild(logo);
        scope.logo = logo;
      }

      var darkness = new PIXI.Graphics();
      darkness.beginFill(0, 0.6);
      darkness.drawRect(0, 0, 1940, 1100);
      darkness.endFill()
      darkness.x -= 10;
      darkness.y -= 10;

      var demoContainer = new PIXI.Container();

      this.initDefaultFrames(this.demo.playerCount, this.demo.frames, this.demo.agents);
      /** **************************************************************************************************************************************** */
      this.preconstructScene(this.scope, demoContainer, this.initWidth, this.initHeight);
      this.initScene(this.scope, demoContainer, this.frames, true);
      this.updateScene(this.scope, this.question, this.frames, this.currentFrame, this.progress, 1, this.reasons[this.currentFrame], true);
      /** **************************************************************************************************************************************** */

      scope.demo = demoContainer;
      scope.demotime = 0;

      this.currentFrame = -1;
      container.addChild(demoContainer);
      container.addChild(darkness);
    }

    container.addChild(scene);

    scope.updateTime = 0;
    scope.frameTime = 0;
  }

  initDefaultFrames(playerCount, frames, agents) {
    var drawer = this;
    var loader = new PIXI.loaders.Loader(window.location.origin);

    this.instantiateModules();

    this.playerInfo = agents.map(function (agent, index) {
      var agentData = {
        name: agent.name || 'Anonymous',
        color: agent.color ? drawer.parseColor(agent.color) : '#ffffff',
        number: index,
        index: agent.index,
        type: agent.type,
        isMe: agent.type === 'CODINGAMER' && agent.typeData.me,
        avatar: agent.avatarTexture
      };

      return agentData;
    });

    this._frames = frames;
    this.parseGlobalData(this._frames[0].global);
    this.playerCount = playerCount;
    this.reasons = [];
    this.frames = [];
    this.currentFrame = 0;
    const firstFrame = this._frames[0].frame;
    this.frames.push(this.parseFrame(firstFrame, this.frames));
    for (var i = 1; i < this._frames.length; ++i) {
      this.frames.push(this.parseFrame(this._frames[i], this.frames));
    }

    this.asyncRenderingTime = Drawer.RenderTimeout;
  };

  /** Mandatory */
  renderDefaultScene(scope, step) {
    step = Math.min(80, step);

    if (this.demo === undefined) {
      return false;
    }

    this.currentFrame = this.currentFrameTemp || 0;

    scope.frameTime += step;
    scope.updateTime += step;
    scope.demotime += step / 1000;

    var animProgress = Math.max(0, Math.min(1, (scope.demotime - 1) / 0.5));
    if (scope.logo) {
      scope.logo.alpha = animProgress;
      scope.logo.scale.x = scope.logo.scale.y = 3 - animProgress * 2;
    }

    if (scope.demotime > 1.5 && scope.demotime <= 2.2) {
      var amplitude = Math.max(0, 1 - (scope.demotime - 1.5) / 0.7) * 15;

      scope.demo.x = (Math.random() * 2 - 1) * amplitude;
      scope.demo.y = (Math.random() * 2 - 1) * amplitude;
    } else {
      scope.demo.x = scope.demo.y = 0;
    }
    var updateInterval = 30;
    var frameInterval = this.frames[this.currentFrame].frameDuration || 500;

    if (scope.updateTime >= updateInterval) {
      scope.updateTime -= updateInterval;
      this.progress = unlerp(0, frameInterval, scope.frameTime);
      this.updateScene(this.scope, this.question, this.frames, this.currentFrame, this.progress, 1, this.reasons[this.currentFrame], true);
    }

    if (scope.frameTime >= frameInterval) {
      scope.frameTime -= frameInterval;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
    this.renderScene(this.scope, this.question, this.frames, this.currentFrame, this.progress, 1, this.reasons[this.currentFrame], step, true);

    this.currentFrameTemp = this.currentFrame;
    this.currentFrame = -1;
    return true;
  }

  endDefaultScene(scope, step) {
    return true;
  }

  /** Mandatory */
  parseGlobalData(globalData) {
    for (let moduleName in this.modules) {
      if (globalData.hasOwnProperty(moduleName)) {
        const module = this.modules[moduleName];
        if (typeof module.handleGlobalData === 'function') {
          module.handleGlobalData(this.playerInfo, globalData[moduleName]);
        }
      }
    }
  }

  /** Mandatory */
  parseFrame(frame, previousFrames) {
    var number = previousFrames.length;
    var parsedFrame = {
      number: number,
      data: {}
    };
    parsedFrame.previous = previousFrames[previousFrames.length - 1] || parsedFrame;
    if (parsedFrame !== parsedFrame.previous) {
      parsedFrame.previous.next = parsedFrame;
    }

    if (!frame.key) {
      return parsedFrame.previous;
    }

    if (frame.duration) {
      parsedFrame.frameDuration = frame.duration;
    } else {
      parsedFrame.frameDuration = parsedFrame.previous.frameDuration || 1000;
    }

    for (let moduleName in this.modules) {
      if (frame.hasOwnProperty(moduleName)) {
        const module = this.modules[moduleName];
        parsedFrame.data[moduleName] = module.handleFrameData(number, frame[moduleName]);
      }
    }

    return parsedFrame;
  }

  preconstructScene(scope, container, canvasWidth, canvasHeight) {
    scope.canvasHeight = canvasHeight;
    scope.canvasWidth = canvasWidth;

    scope.renderables = [];
    scope.updatables = [];

    scope.time = 0;
    scope.endTime = 0;

    scope.playerInfo = this.playerInfo;

    container.scale.x = canvasWidth / Drawer.WIDTH;
    container.scale.y = canvasHeight / Drawer.HEIGHT;
  }

  initScene(scope, container, frames) {
    for (let moduleName in this.modules) {
      const module = this.modules[moduleName];
      var stage = new PIXI.Container();
      module.reinitScene(stage, {
        width: scope.canvasWidth,
        height: scope.canvasHeight
      });
      container.addChild(stage);
    }
  }

  updateScene(scope, question, frames, frameNumber, progress, speed, reason) {
    /** ************************************* */
    /*        SYNCHRONOUS                     */
    /** ************************************* */
    var parsedFrame = frames[frameNumber];
    scope.currentFrame = parsedFrame;
    scope.currentProgress = progress;
    scope.reason = reason;

    for (var i = 0; i < scope.updatables.length; ++i) {
      scope.updatables[i].update(frameNumber, progress, frame, scope);
    }

    for (let moduleName in this.modules) {
      const module = this.modules[moduleName];
      if (parsedFrame.data.hasOwnProperty(moduleName)) {
        module.updateScene(parsedFrame.previous.data[moduleName], parsedFrame.data[moduleName], progress);
      }
    }
  }

  initEndScene(scope, failure) {
    scope.endSceneViewed = false;
  }

  destroyEndScene(scope) {
  }

  renderEndScene(scope, step, failure) {
    var endOfEnd;
    if (scope.endTime === 0) {
      this.initEndScene(scope, failure);
    }

    scope.endTime += step;

    if (scope.endTime >= endOfEnd && !scope.endSceneViewed) {
      if (this.endCallback) {
        sCallback();
      }
      scope.endSceneViewed = true;
    }
  }

  renderRenderables(step, scope) {
    var next = [];
    for (var i = 0; i < scope.renderables.length; ++i) {
      var updatable = scope.renderables[i];
      var remove = updatable.render(step, scope);
      if (!remove) {
        next.push(updatable);
      }
    }
    scope.renderables = next;
  }

  renderScene(scope, question, frames, frameNumber, progress, speed, reason, step) {
    /** ************************************* */
    /*        ASYNCHRONOUS                    */
    /** ************************************* */
    step = Math.min(80, step);

    var endFrame = !this.debugMode && (frameNumber == frames.length - 1 && progress == 1);

    if (endFrame) {
      this.renderEndScene(scope, step, (reason != "Win"));
    } else {
      if (scope.endTime > 0) {
        this.destroyEndScene(scope);
      }
      scope.endTime = 0;
    }

    this.renderRenderables(step, scope);

    return true;
  }

  getFrameSpeed(frameNumber, playerSpeed) {
    //Will be multiplied by current playerSpeed
    return 1;
  }

  getFrameDuration(frameNumber) {
    return this.frames && this.frames[frameNumber] && this.frames[frameNumber].frameDuration || 1000;
  }

  static get RenderTimeout() { return window.location.hostname === "localhost" ? Infinity : 20000; }

  enableAsyncRendering(enabled) {
    this.asyncRendering = enabled;
    this.asyncRenderingTime = Drawer.RenderTimeout;
  }

  purge() {
    this.scope = {}
    this.changed = true;

    this.container.interactiveChildren = false;
    this.container.destroy({
      texture: false,
      children: true
    });

    delete this.container;
    this.container = new PIXI.Container();
  }

  reinitScene() {
    if (this.loaded >= 1) {
      this.destroyScene(this.scope);
      this.purge();
      this.asyncRenderingTime = Drawer.RenderTimeout;
      this.preconstructScene(this.scope, this.container, this.initWidth, this.initHeight);
      this.initScene(this.scope, this.container, this.frames);
      this.updateScene(this.scope, this.question, this.frames, this.currentFrame, this.progress, this.speed, this.reasons[this.currentFrame]);
      this.changed = true;
    }

  }

  reinitDefaultScene() {
    if (this.loaded >= 1) {
      this.intro = true;
      this.destroyScene(this.scope);
      this.purge();
      this.asyncRenderingTime = Drawer.RenderTimeout;
      this.initDefaultScene(this.scope, this.container, this.initWidth, this.initHeight);
      this.changed = true;
    }
  }

  reinitLoadingScene() {
    if (this.loaded < 1) {
      this.purge();
      this.asyncRenderingTime = Drawer.RenderTimeout;
      this.initPreload(this.scope, this.container, this.loaded, this.initWidth, this.initHeight);
    }
  }

  reinit(force) {
    if (this.loaded >= 1) {
      if (this.currentFrame >= 0 && !this.intro) {
        this.reinitScene();
      } else {
        if (!this.intro || force)
          this.reinitDefaultScene();
      }
    } else {
      this.reinitLoadingScene();
    }
  }

  animate(time) {
    if (this.destroyed) {
      return;
    }

    if (!this.lastRenderTime)
      this.lastRenderTime = time;
    var step = time - this.lastRenderTime;
    if (this.asynchronousStep) {
      step = this.asynchronousStep;
    }
    if (this.onBeforeRender) {
      this.onBeforeRender();
    }

    if (!this.loading) {
      if (this.loaded < 1) {
        this.changed |= this.renderPreloadScene(this.scope, step);
      } else if (this.changed || (this.asyncRendering && this.asyncRenderingTime > 0)) {
        if (this.currentFrame < 0) {
          this.changed |= this.renderDefaultScene(this.scope, step);
        } else if (this.intro) {
          this.changed = true;
          if (this.endDefaultScene(this.scope, step)) {
            this.intro = false;
            this.reinit(true);
          }
        } else {
          this.changed |= this.renderScene(this.scope, this.question, this.frames, this.currentFrame, this.progress, this.speed, this.reasons[this.currentFrame], step);
        }
      }
      if (this.changed) {
        this.renderer.render(this.container);
        this.changed = false;
      }
    }
    if (this.onAfterRender) {
      this.onAfterRender();
    }
    var self = this;
    this.lastRenderTime = time;
    if (!this.destroyed)
      requestAnimationFrame(this.animate.bind(this));

    this.asyncRenderingTime -= step;
  }

  _initFrames(playerCount, frames) {
    this.instantiateModules()
    this._frames = frames;
    this.parseGlobalData(this._frames[0].global);
    this.playerCount = playerCount;
    this.reasons = [];
    this.frames = [];
    this.currentFrame = 0;
    this.progress = 1;
    const firstFrame = this._frames[0].frame;
    this.frames.push(this.parseFrame(firstFrame, this.frames));
    for (var i = 1; i < this._frames.length; ++i) {
      this.frames.push(this.parseFrame(this._frames[i], this.frames));
    }
  }

  isTurnBasedGame() {
    return false;
  }

  initFrames(frames, agents) {
    if (this.playerInfo) {
      this.playerInfo.forEach(function (playerInfo) {
        if (playerInfo.avatar) {
          playerInfo.avatar.destroy(true);
        }
      });
    }

    var drawer = this;

    var loader = new PIXI.loaders.Loader(window.location.origin);
    this.playerInfo = agents.map(function (agent, index) {
      var agentData = {
        name: agent.name || 'Anonymous',
        color: drawer.parseColor(agent.color),
        number: index,
        index: agent.index,
        type: agent.type,
        isMe: agent.type === 'CODINGAMER' && agent.typeData.me,
        avatar: null
      };

      loader.add('avatar' + index, agent.avatar, { loadType: 2 }, function (event) {
        agentData.avatar = event.texture;
        PIXI.Texture.addTextureToCache(event.texture, '$' + agentData.index);
      });
      return agentData;
    });
    this.loading = true;
    loader.on('complete', function (loader) {
      drawer._initFrames(agents.length, frames);
      drawer.loading = false;
      drawer.reinit(false);
    });
    loader.on('error', function (e) {
      console.warn(e);
    });
    loader.load();
  }

  update(currentFrame, progress, speed) {
    if (this.currentFrame >= 0) {
      this.asyncRenderingTime = Drawer.RenderTimeout;
      this.changed = true;
      this.speed = speed;
      this.currentFrame = currentFrame;
      this.progress = progress;
      if (this.loaded >= 1 && !this.intro) {
        this.updateScene(this.scope, this.question, this.frames, currentFrame, progress, this.speed, this.reasons[this.currentFrame]);
      }
    }
  }

  parseColor(color) {
    if (Array.isArray(color)) {
      var i;
      var parsedColor = [];
      for (i = 0; i < color.length; ++i) {
        parsedColor.push(this.parseColor(color[i]));
      }
      return parsedColor;
    } else {
      return parseInt(color.substring(1), 16);
    }
  }

  init(canvas, width, height, colors, oversampling, endCallback, location) {
    var key;
    window.PIXI = Drawer.PIXI || window.PIXI;
    this.oversampling = oversampling || 1;
    this.canvas = $(canvas);
    if (colors) this.colors = this.parseColor(colors);
    if (!this.debugModeSetByUser && location === 'ide') {
      this.debugMode = true;
    }

    this.asyncRendering = true;
    this.asyncRenderingTime = 0;
    this.destroyed = false;
    this.asynchronousStep = null;
    var self = this;
    this.initWidth = width | 0;
    this.initHeight = height | 0;
    this.endCallback = endCallback || this.endCallback;

    if (!this.alreadyLoaded) {
      this.toDestroy = [];
      this.alreadyLoaded = true;
      // Initialisation
      this.question = null;
      this.scope = null;
      this.currentFrame = -1;
      this.loaded = 0;
      // Engine instanciation
      this.container = new PIXI.Container();
      var resources = this.getResources();
      this.renderer = this.createRenderer(this.initWidth, this.initHeight, canvas);
      var loader = new PIXI.loaders.Loader(resources.baseUrl);
      for (key in resources.images) {
        loader.add(key, resources.images[key]);
      }
      var i;
      for (i = 0; i < resources.sprites.length; ++i) {
        loader.add(resources.sprites[i]);
      }
      for (i = 0; i < resources.fonts.length; ++i) {
        loader.add(resources.fonts[i]);
      }
      for (key in resources.spines) {
        loader.add(key, resources.spines[key]);
      }
      for (i = 0; i < resources.others.length; ++i) {
        loader.add(resources.others[i]);
      }

      if (this.demo) {
        if (this.demo.logo) {
          loader.add('demo-logo', this.demo.logo);
        }
        this.demo.agents.forEach(agent => {
          loader.add('avatar' + agent.index, agent.avatar, { loadType: 2 }, function (event) {
            agent.avatarTexture = event.texture;
            PIXI.Texture.addTextureToCache(event.texture, '$' + agent.index);
          });
        });
      }

      self.scope = {};

      const onStart = function (loader, resource) {
        requestAnimationFrame(self.animate.bind(self));
        self.initPreload(self.scope, self.container, self.loaded = 0, self.initWidth, self.initHeight);
      }
      loader.on('start', onStart);
      loader.on('progress', function (loader, resource) {
        if (loader.progress < 100) {
          self.preload(self.scope, self.container, self.loaded = loader.progress / 100, self.initWidth, self.initHeight, resource);
        }
      });

      const onComplete = function () {
        var key;
        for (key in resources.images) {
          if (resources.images.hasOwnProperty(key)) {
            PIXI.Texture.addTextureToCache(loader.resources[key].texture, key);
          }
        }
        for (key in resources.spines) {
          if (resources.spines.hasOwnProperty(key)) {
            PIXI.AnimCache[key] = PIXI.AnimCache[resources.baseUrl + resources.spines[key]];
          }
        }
        self.loaded = 1;
        self.reinit(true);
        self.changed = true;
      };

      loader.on('complete', onComplete);
      loader.on('error', function (e) {
        console.warn(e);
      });

      // PIXI bug workaround: if there is nothing to load, don't even try.
      if (Object.keys(loader.resources).length) {
        loader.load();
      } else {
        onStart();
        onComplete();
      }

    } else {
      this.changed = true;
      this.renderer.resize(this.initWidth, this.initHeight);
      this.reinit(true);
    }
  }
  createRenderer(width, height, canvas) {
    return PIXI.autoDetectRenderer(width, height, {
      view: canvas,
      clearBeforeRender: true,
      preserveDrawingBuffer: false
    });
  }

  /**
   * Turns a graphic into a texture, saves the texture for later destruction
   */
  generateTexture(graphics) {
    var tex = graphics.generateTexture();
    this.toDestroy.push(tex);
    return tex;
  }

  /**
   * Creates a Text and keeps the texture for later destruction
   */
  generateText(text, size, color, align) {

    var bitmap = size * this.scope.canvasWidth / this.oversampling >= 30 * 960;
    //  var bitmap = size * this.scope.canvasWidth / 1 >= 30 * 960;
    var textEl;
    if (bitmap) {
      textEl = new PIXI.extras.BitmapText(text, {
        font: size + 'px agency_80',
        tint: color
      });
      textEl.lineHeight = size;
    } else {
      textEl = new PIXI.Text(text, {
        fontSize: Math.round(size / 1.2) + 'px',
        fontFamily: 'Lato',
        fontWeight: 'bold',
        fill: color
      });
      textEl.lineHeight = Math.round(size / 1.2);
    }
    if (align === 'right') {
      textEl.anchor.x = 1;
    } else if (align === 'center') {
      textEl.anchor.x = 0.5;
    }
    this.toDestroy.push(textEl);
    return textEl;
  }
  isReady() {
    return this.loaded >= 1;
  }


}