import {
  Audio,
  AnimationClip,
  AnimationMixer,
  Object3D,
  MathUtils,
  LoopOnce,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { getMousePosition, getMouseDegrees } from "../helpers/helperFunctions";

export default class Mutant extends Object3D {
  #neck;
  #waist;
  #idleAnimation;
  #animations;
  #mixer;
  #currentlyAnimating;
  #screamSound;
  constructor(path, manager, audioLoader, audioListener) {
    super();
    this.#loadMutant(path, manager);
    this.#initObserveMouse();
    this.#switchAnimationInterval();
  }

  #loadMutant(path, manager) {
    const loader = new GLTFLoader(manager);
    loader.load(path, (gltf) => {
      console.log(gltf);
      const { scene: mutant, animations } = gltf;
      this.add(mutant);
      this.rotation.y = Math.PI / 3;
      this.#createNeckAndWaistBones(mutant);
      this.#createAnimations(animations, mutant);
    });
  }

  #createAnimations(fileAnimations, mutant) {
    const otherClips = fileAnimations.filter((val) => val.name !== "Idle");
    this.#mixer = new AnimationMixer(mutant);
    this.#setIdleAnimation(fileAnimations);
    this.#setAnimations(otherClips);
    this.#idleAnimation.play();
  }

  #createNeckAndWaistBones(mutant) {
    mutant.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }

      if (child.isBone) {
        if (child.name === "MutantNeck") {
          this.#neck = child;
        }

        if (child.name === "MutantSpine") {
          this.#waist = child;
        }
      }
    });
  }

  #setIdleAnimation(animations) {
    const animation = AnimationClip.findByName(animations, "Idle");
    animation.tracks.splice(3, 3);
    animation.tracks.splice(9, 3);
    this.#idleAnimation = this.#mixer.clipAction(animation);
  }

  #setAnimations(clips) {
    this.#animations = clips.map((clip) => {
      let newClip = AnimationClip.findByName(clips, clip.name);
      newClip.tracks.splice(3, 3);
      newClip.tracks.splice(9, 3);
      newClip = this.#mixer.clipAction(newClip);
      return newClip;
    });
  }

  #moveJoint(mouse, joint, degreeLimit) {
    const degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit);
    joint.rotation.y = MathUtils.degToRad(degrees.x);
    joint.rotation.x = MathUtils.degToRad(degrees.y);
  }

  #initObserveMouse() {
    document.addEventListener("mousemove", (e) => {
      const neckDegreeLimit = 60;
      const waistDegreeLimit = 40;
      const mouseCoords = getMousePosition(e);
      if (this.#neck && this.#waist) {
        this.#moveJoint(mouseCoords, this.#neck, neckDegreeLimit);
        this.#moveJoint(mouseCoords, this.#waist, waistDegreeLimit);
      }
    });
  }

  set currentlyAnimating(value) {
    this.#currentlyAnimating = value;
  }

  get currentlyAnimating() {
    return this.#currentlyAnimating;
  }

  switchAnimation() {
    this.currentlyAnimating = true;
    const anim = Math.floor(Math.random() * this.#animations.length) + 0;
    this.#playModifierAnimation(
      this.#idleAnimation,
      0.25,
      this.#animations[anim],
      0.25
    );
  }

  #switchAnimationInterval() {
    setInterval(
      () => !this.#currentlyAnimating && this.switchAnimation(),
      2 * 60 * 1000
    );
  }

  #playModifierAnimation(from, fSpeed, to, tSpeed) {
    to.setLoop(LoopOnce);
    to.reset();
    to.play();
    from.crossFadeTo(to, fSpeed, true);
    setTimeout(() => {
      from.enabled = true;
      to.crossFadeTo(from, tSpeed, true);
      this.currentlyAnimating = false;
    }, to._clip.duration * 1000 - (tSpeed + fSpeed) * 1000);
  }

  #loadScreamSound(audioLoader, audioListener) {
    this.#screamSound = new Audio(audioListener);
    audioLoader.load("./assets/sounds/scream.ogg", (buffer) => {
      this.#screamSound.setBuffer(buffer);
      this.#screamSound.setVolume(0.1);
      this.#screamSound.setLoop(false);
    });
  }

  #scream() {
    this.#screamSound.play();
  }

  animate(delta) {
    if (this.#mixer) {
      this.#mixer.update(delta);
    }
  }
}
