import { Live2DModel } from "pixi-live2d-display/cubism4";
import { Application, Sprite, Loader } from "pixi.js";
import * as PIXI from "pixi.js";

let cubismModel = "/tyrunny_lobby/tyrunny_lobby.model3.json";

window.PIXI = PIXI;

(async () => {
  //stage setup
  const app = new Application({
    resizeTo: window,
    autoStart: true,
  });

  document.body.appendChild(app.view);
  app.view.style.position = "absolute";

  const tyrant = await Live2DModel.from(cubismModel, {
    autoInteract: false,
  });

  const [texture, trailTexture] = await new Promise((resolve) => {
    Loader.shared
      .add("background", "images/bg.jpg")
      .add("trail", "images/trail.png")
      .load((loader, resources) => {
        resolve([resources.background.texture, resources.trail.texture]);
      });
  });

  const bg = new Sprite(texture);

  // Don't create a sprite for the trail - SimpleRope uses the texture directly
  const historyX = [];
  const historyY = [];
  const historySize = 20;
  const ropeSize = 100;
  const points = [];

  for (let i = 0; i < historySize; i++) {
    historyX.push(tyrant.x);
    historyY.push(tyrant.y);
  }

  for (let i = 0; i < ropeSize; i++) {
    points.push(new PIXI.Point(0, 0));
  }

  // Use the texture directly, not a Sprite
  const rope = new PIXI.SimpleRope(trailTexture, points);

  let mouseposition = null;

  app.stage.interactive = true;
  app.stage.hitArea = app.renderer.screen;
  app.stage.on("mousemove", (event) => {
    mouseposition = mouseposition || { x: 0, y: 0 };
    mouseposition.x = event.data.global.x;
    mouseposition.y = event.data.global.y;
  });

  app.ticker.add(() => {
    if (!mouseposition) return;

    // Update the mouse values to history
    historyX.pop();
    historyX.unshift(mouseposition.x);
    historyY.pop();
    historyY.unshift(mouseposition.y);

    // Update the points to correspond with history.
    for (let i = 0; i < ropeSize; i++) {
      const p = points[i];
      // Smooth the curve with cubic interpolation to prevent sharp edges.
      const ix = cubicInterpolation(historyX, (i / ropeSize) * historySize);
      const iy = cubicInterpolation(historyY, (i / ropeSize) * historySize);
      p.x = ix;
      p.y = iy;
    }
  });

  function cubicInterpolation(array, t) {
    const k = Math.floor(t);
    const m = [getTangent(array, k), getTangent(array, k + 1)];
    const p = [array[k], array[k + 1]];
    t -= k;
    const t2 = t * t;
    const t3 = t * t2;
    return (
      (2 * t3 - 3 * t2 + 1) * p[0] +
      (t3 - 2 * t2 + t) * m[0] +
      (-2 * t3 + 3 * t2) * p[1] +
      (t3 - t2) * m[1]
    );
  }

  function getTangent(array, k) {
    return (
      (array[Math.min(k + 1, array.length - 1)] - array[Math.max(k - 1, 0)]) *
      0.5
    );
  }

  const container = new PIXI.Container();

  function resizeContent() {
    const scaleX = app.view.width / bg.texture.width;
    const scaleY = app.view.height / bg.texture.height;
    const scale = Math.max(scaleX, scaleY);

    const modelBounds = tyrant.getBounds();

    const modelScaleX = app.view.width / modelBounds.width;
    const modelScaleY = app.view.height / modelBounds.height;
    const modelScale = Math.max(modelScaleX, modelScaleY);

    tyrant.x = -50;
    tyrant.y = -130;
    tyrant.scale.set(modelScale * 1.1);
    bg.scale.set(scale);
  }

  container.addChild(bg);
  container.addChild(tyrant);
  container.addChild(rope);

  app.stage.addChild(container);

  resizeContent();

  // Add this after loading the model to see all parameters
  const paramCount =
    tyrant.internalModel.coreModel.getParameterDefaultValue(22);

  //eye blink
  let timeSinceLastBlink = 0;
  let blinkInterval = 4000;
  let targetREyeValue = 1.0;
  let targetLEyeValue = 1.0;
  let targetBlushValue = -5.0;
  let currentREyeValue =
    tyrant.internalModel.coreModel.getParameterValueById("ParamEyeROpen");
  let currentLEyeValue =
    tyrant.internalModel.coreModel.getParameterValueById("ParamEyeLOpen");
  let currentBlushValue =
    tyrant.internalModel.coreModel.getParameterValueByIndex(22);

  app.ticker.add((delta) => {
    timeSinceLastBlink += delta * 16.67;

    if (!isDragging) {
      if (timeSinceLastBlink >= blinkInterval) {
        targetREyeValue = 0.0;
        targetLEyeValue = 0.0;
        timeSinceLastBlink = 0;
      }
      if (
        currentREyeValue <= 0.01 &&
        targetREyeValue === 0.0 &&
        currentLEyeValue <= 0.01 &&
        targetLEyeValue === 0.0
      ) {
        targetREyeValue = 1.0;
        targetLEyeValue = 1.0;
        blinkInterval = 2000 * Math.random() * (4 - 1) + 1;
      }
    }

    const speed = 0.1;
    currentREyeValue += (targetREyeValue - currentREyeValue) * speed;
    currentLEyeValue += (targetLEyeValue - currentLEyeValue) * speed;
    currentBlushValue += (targetBlushValue - currentBlushValue) * speed;
    tyrant.internalModel.coreModel.setParameterValueById(
      "ParamEyeROpen",
      currentREyeValue
    );
    tyrant.internalModel.coreModel.setParameterValueById(
      "ParamEyeLOpen",
      currentLEyeValue
    );
    tyrant.internalModel.coreModel.setParameterValueById(
      "blush",
      currentBlushValue
    );
  });

  //interactivity

  tyrant.interactive = true;
  tyrant.buttonMode = true;
  tyrant.cursor = 'url("/images/custom_cursor.png") 16 16, auto';

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modelStartX = 0;
  let modelStartY = 0;

  tyrant.on("pointerdown", (event) => {
    isDragging = true;
    dragStartX = event.data.global.x;
    dragStartY = event.data.global.y;
    modelStartX =
      tyrant.internalModel.coreModel.getParameterValueById("ParamAngleX");
    modelStartY =
      tyrant.internalModel.coreModel.getParameterValueById("ParamAngleY");

    targetREyeValue = 0.0;
    targetBlushValue = 10;
  });

  tyrant.on("pointermove", (event) => {
    if (isDragging) {
      const currentX = event.data.global.x;
      const deltaX = currentX - dragStartX;

      tyrant.internalModel.coreModel.setParameterValueById(
        "ParamAngleX",
        modelStartX + deltaX * 0.09
      );
      tyrant.internalModel.coreModel.setParameterValueById(
        "ParamAngleY",
        modelStartX + deltaX * 0.09
      );
    }
  });

  app.stage.on("pointerup", () => {
    isDragging = false;
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
    targetREyeValue = 1.0;
    targetBlushValue = -5.0;
  });

  // load animation

  // Your original/design screen size
  const DESIGN_WIDTH = 1920; // adjust to your reference width
  const DESIGN_HEIGHT = 1080; // adjust to your reference height

  // Current screen size
  const screenWidth = app.screen.width;
  const screenHeight = app.screen.height;

  // Scale factors
  const scaleX = screenWidth / DESIGN_WIDTH;
  const scaleY = screenHeight / DESIGN_HEIGHT;

  const animations = [
    {
      x: -3800 * scaleX,
      y: -2100 * scaleY,
      scale: 4,
      hold: 2000,
      instant: true,
      panX: -3700 * scaleX,
      panY: -2110 * scaleY,
    },
    {
      x: -3600 * scaleX,
      y: -1500 * scaleY,
      scale: 3.5,
      hold: 2000,
      instant: true,
      panX: -3660 * scaleX,
      panY: -1510 * scaleY,
    },
    {
      x: -3800 * scaleX,
      y: -1000 * scaleY,
      scale: 3.5,
      hold: 2000,
      instant: true,
      panX: -3750 * scaleX,
      panY: -1010 * scaleY,
    },
    // Zoom out to full view (SMOOTH)
    { x: 0, y: 0, scale: 1, duration: 2000, instant: false },
  ];

  let currentAnim = 0;
  let animProgress = 0;
  let startX = 0,
    startY = 0,
    startScale = 1;
  let targetX = 0,
    targetY = 0,
    targetScale = 1;
  let panEndX = 0,
    panEndY = 0;
  let animDuration = 0;
  let isInstant = false;
  let hasPan = false;

  const startAnimation = (index) => {
    if (index >= animations.length) {
      currentAnim = 0;
      startAnimation(0);
      return;
    }

    const anim = animations[index];
    startX = container.x;
    startY = container.y;
    startScale = container.scale.x;
    targetX = anim.x;
    targetY = anim.y;
    targetScale = anim.scale;
    isInstant = anim.instant;
    animDuration = anim.duration || anim.hold || 0;
    animProgress = 0;

    hasPan = anim.panX !== undefined && anim.panY !== undefined;
    if (hasPan) {
      panEndX = anim.panX;
      panEndY = anim.panY;
    }

    if (isInstant) {
      container.x = targetX;
      container.y = targetY;
      container.scale.set(targetScale);
      // Set start position for pan
      startX = targetX;
      startY = targetY;
    }
  };

  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const linear = (t) => t;

  startAnimation(0);

  app.ticker.add((delta) => {
    animProgress += delta * 16.0;

    if (animProgress >= animDuration) {
      currentAnim++;
      // startAnimation(currentAnim % animations.length);

      if (currentAnim < animations.length) {
        startAnimation(currentAnim); // Remove the % operator
      }
    }

    const t = Math.min(animProgress / animDuration, 1);

    if (isInstant && hasPan) {
      // Slow linear pan during hold
      const panT = linear(t);
      container.x = startX + (panEndX - startX) * panT;
      container.y = startY + (panEndY - startY) * panT;
    } else if (!isInstant && animDuration > 0) {
      // Smooth animation for zoom out
      const easedT = easeInOutCubic(t);
      container.x = startX + (targetX - startX) * easedT;
      container.y = startY + (targetY - startY) * easedT;
      container.scale.set(startScale + (targetScale - startScale) * easedT);
    }
  });
})();
