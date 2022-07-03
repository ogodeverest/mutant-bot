import {
  Audio,
  AudioListener,
  AudioLoader,
  Clock,
  DirectionalLight,
  DirectionalLightHelper,
  FogExp2,
  HemisphereLight,
  LoadingManager,
  PerspectiveCamera,
  ReinhardToneMapping,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GUI } from "dat.gui";
import { Manager } from "hammerjs";
import {
  resizeRendererToDisplaySize,
  makeXYZGUI,
} from "./helpers/helperFunctions";
import ColorGUIHelper from "./helpers/ColorGUIHelper";
import MinMaxGUIHelper from "./helpers/MinMaxGUIHelper";
import Mutant from "./objects/Mutant";
import Terrain from "./objects/Terrain";
import dataEndpoint from "./dataEndpoint";

export default class WebGlApp {
  #gui;
  #renderer;
  #sceneColor;
  #scene;
  #composer;
  #audioListener;
  #ambientSound;
  #audioLoader;
  #camera;
  #clock;
  #controls;
  #directionalLight;
  #directionalLightHelper;
  #hemisphereLight;
  #loadingManager;
  #hammerManager;
  #mutant;
  #terrain;

  constructor() {
    this.#initGui();
    this.#initRenderer();
    this.#initScene();
    this.#initCamera();
    this.#initLoadingManager();
    this.#initAudioListener();
    this.#loadAmbientSound();
    this.#initPostProccesing();
    this.#addFog();
    this.#initClock();
    this.#initOrbitControls();
    this.#addLights();
    this.#initHammerManager();
    this.#addTerrain();
    this.#addMutant();
    this.#listenForInteraction();
    this.#render();
  }

  #initRenderer() {
    this.#renderer = new WebGLRenderer({
      antialias: true,
    });
    this.#sceneColor = 0xe0e0ce;
    this.#renderer.setClearColor(this.#sceneColor);
    this.#renderer.toneMapping = ReinhardToneMapping;
    this.#renderer.toneMappingExposure = 2.3;
    this.#renderer.shadowMap.enabled = true;
    document.body.append(this.#renderer.domElement);
  }

  #initScene() {
    this.#scene = new Scene();
  }

  #initCamera() {
    const fov = 51;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.01;
    const far = 1000;
    this.#camera = new PerspectiveCamera(fov, aspect, near, far);
    this.#camera.position.x = 8;
    this.#camera.position.y = 0.9;
    this.#camera.position.z = 8.4;
    const folder = this.#gui.addFolder("Camera");

    folder
      .add(this.#camera, "fov", 1, 180)
      .onChange(this.#updateCamera.bind(this));
    const minMaxGUIHelper = new MinMaxGUIHelper(
      this.#camera,
      "near",
      "far",
      0.1
    );
    folder
      .add(minMaxGUIHelper, "min", 0.1, 50, 0.1)
      .name("near")
      .onChange(this.#updateCamera.bind(this));
    folder
      .add(minMaxGUIHelper, "max", 0.1, 50, 0.1)
      .name("far")
      .onChange(this.#updateCamera.bind(this));
    makeXYZGUI(
      folder,
      this.#camera.position,
      "Position",
      this.#updateCamera.bind(this)
    );
    folder.open();
  }

  #initGui() {
    this.#gui = new GUI().addFolder("Scene");
  }

  #initPostProccesing() {
    const renderScene = new RenderPass(this.#scene, this.#camera);
    const noiseIntensity = 0.09;
    const scanlineIntensity = 0.025;
    const scanlineCount = 648;
    const grayScale = false;
    const filmPass = new FilmPass(
      noiseIntensity,
      scanlineIntensity,
      scanlineCount,
      grayScale
    );
    this.#composer = new EffectComposer(this.#renderer);
    this.#composer.setPixelRatio(window.devicePixelRatio);
    this.#composer.addPass(renderScene);
    this.#composer.addPass(filmPass);

    const folder = this.#gui.addFolder("Postprocesing");
    folder.add(filmPass.uniforms.grayscale, "value").name("grayscale");
    folder
      .add(filmPass.uniforms.nIntensity, "value", 0, 1)
      .name("noise intensity");
    folder
      .add(filmPass.uniforms.sIntensity, "value", 0, 1)
      .name("scanline intensity");
    folder
      .add(filmPass.uniforms.sCount, "value", 0, 1000)
      .name("scanline count");
    folder.open();
  }

  #initAudioListener() {
    this.#audioListener = new AudioListener();
    this.#camera.add(this.#audioListener);
    this.#audioLoader = new AudioLoader(this.#loadingManager);
  }

  #loadAmbientSound() {
    this.#audioLoader.load(`${dataEndpoint}sounds/ambience.ogg`, (buffer) => {
      this.#ambientSound = new Audio(this.#audioListener);
      this.#ambientSound.setBuffer(buffer);
      this.#ambientSound.setLoop(true);
      this.#ambientSound.setVolume(0.7);
      this.#ambientSound.play();
    });
  }

  #addFog() {
    const density = 0.025;
    this.#scene.fog = new FogExp2(this.#sceneColor, density);
    const folder = this.#gui.addFolder("Fog");
    folder
      .addColor(new ColorGUIHelper(this.#scene.fog, "color"), "value")
      .name("Fog Color");
    folder.add(this.#scene.fog, "density", 0, 2, 0.01);
    folder.open();
  }

  #initClock() {
    this.#clock = new Clock();
  }

  #initOrbitControls() {
    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    this.#controls.enableDamping = true;
    this.#controls.enableZoom = true;
    this.#controls.maxDistance = 10;
    this.#controls.minDistance = 5;
    this.#controls.maxPolarAngle = (29 * Math.PI) / 60;
    this.#controls.minAzimuthAngle = 0;
    this.#controls.maxAzimuthAngle = Math.PI / 2;
    this.#controls.enablePan = false;
  }

  #addDirectionalLight() {
    const color = 0xffffff;
    const intesity = 1;
    this.#directionalLight = new DirectionalLight(color, intesity);
    this.#directionalLight.position.set(10, 10, 20);
    this.#directionalLight.target.position.set(0, 0, 0);
    this.#directionalLightHelper = new DirectionalLightHelper(
      this.#directionalLight
    );
    this.#directionalLight.castShadow = true;
    this.#scene.add(this.#directionalLightHelper);
    this.#scene.add(this.#directionalLight);
    this.#scene.add(this.#directionalLight.target);

    const folder = this.#gui.addFolder("Directional Light");

    folder
      .addColor(new ColorGUIHelper(this.#directionalLight, "color"), "value")
      .name("color");
    folder.add(this.#directionalLight, "intensity", 0, 2, 0.01);

    makeXYZGUI(
      folder,
      this.#directionalLight.position,
      "position",
      this.#updateLight.bind(this)
    );
    makeXYZGUI(
      folder,
      this.#directionalLight.target.position,
      "target",
      this.#updateLight.bind(this)
    );
    folder.open();
  }

  #addHemisphereLight() {
    const skyColor = 0xffeeb1;
    const groundCOlor = 0x080820;
    const itensity = 4;
    this.#hemisphereLight = new HemisphereLight(
      skyColor,
      groundCOlor,
      itensity
    );

    const folder = this.#gui.addFolder("Hemisphere Light");

    folder
      .addColor(new ColorGUIHelper(this.#hemisphereLight, "color"), "value")
      .name("skyColor");
    folder
      .addColor(
        new ColorGUIHelper(this.#hemisphereLight, "groundColor"),
        "value"
      )
      .name("groundColor");
    folder.add(this.#hemisphereLight, "intensity", 0, 2, 0.01);
  }

  #addLights() {
    this.#addDirectionalLight();
    this.#addHemisphereLight();
  }

  #initLoadingManager() {
    this.#loadingManager = new LoadingManager();
    this.#loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
      console.log(
        "Started loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files..."
      );

      this.#loadingManager.onLoad = () => {
        console.log("Loading complete!");
        document.getElementById("loading").style.display = "none";
        this.#renderer.setAnimationLoop(this.#render.bind(this));
      };

      this.#loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        console.log(
          "Loading file: " +
            url +
            ".\nLoaded " +
            itemsLoaded +
            " of " +
            itemsTotal +
            " files."
        );

        document.getElementById("loading-info").innerHTML =
          Math.floor((itemsLoaded / itemsTotal) * 100) + "%";
      };

      this.#loadingManager.onError = (url) => {
        console.log("There was an error loading " + url);
      };
    };
  }

  #initHammerManager() {
    const stage = document.body;
    this.#hammerManager = new Manager(stage);

    const DoubleTap = new Hammer.Tap({
      event: "doubletap",
      taps: 2,
    });

    this.#hammerManager.add(DoubleTap);
  }

  #addTerrain() {
    this.#terrain = new Terrain(
      `${dataEndpoint}terrain/terrain.glb`,
      this.#loadingManager
    );
    this.#scene.add(this.#terrain);
  }

  #addMutant() {
    this.#mutant = new Mutant(
      `${dataEndpoint}mutant/mutant.glb`,
      this.#loadingManager,
      this.#audioLoader,
      this.#audioListener
    );
    this.#scene.add(this.#mutant);
  }

  #updateLight() {
    this.#directionalLight.updateMatrixWorld();
    this.#directionalLightHelper.update();
  }

  #updateCamera() {
    this.#camera.updateProjectionMatrix();
  }

  #adjustCamera() {
    if (resizeRendererToDisplaySize(this.#renderer)) {
      const canvas = this.#renderer.domElement;
      this.#camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.#updateCamera();
      this.#composer.setSize(canvas.width, canvas.height);
    }
  }

  #listenForInteraction() {
    this.#hammerManager.on("doubletap", (e) => {
      if (!this.#mutant.currentlyAnimating) {
        this.#mutant.switchAnimation();
      }
    });
  }

  #render() {
    const delta = this.#clock.getDelta();
    this.#adjustCamera();
    this.#mutant.animate(delta);
    this.#controls.update();
    this.#composer.render();
  }
}
