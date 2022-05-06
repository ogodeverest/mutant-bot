import { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default class Terrain extends Object3D {
  constructor(path, manager) {
    super();
    this.#loadTerrain(path, manager);
  }

  #loadTerrain(path, manager) {
    const loader = new GLTFLoader(manager);
    loader.load(path, (gltf) => {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.material.roughnessMap = null;
        }
      });
      this.add(gltf.scene);
    });
  }
}
