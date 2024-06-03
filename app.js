import * as THREE from "../../libs/three/three.module.js";
import { VRButton } from "../../libs/three/jsm/VRButton.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { BoxLineGeometry } from "../../libs/three/jsm/BoxLineGeometry.js";
import { Stats } from "../../libs/stats.module.js";
import { OrbitControls } from "../../libs/three/jsm/OrbitControls.js";

class App {
  constructor() {
    const container = document.getElementById("container");

    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.6, 3);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x505050);

    this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1, 1, 1).normalize();
    this.scene.add(light);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.6, 0);
    this.controls.update();

    this.stats = new Stats();
    container.appendChild(this.stats.dom);

    this.holes = [];
    this.initScene();
    this.setupXR();

    window.addEventListener("resize", this.resize.bind(this));

    this.renderer.setAnimationLoop(this.render.bind(this));

    this.worms = [];
    this.lastWormTime = 0;

    this.wormUpDuration = 1.5;
    this.wormDownDuration = 1.5;
    this.wormVisibleDuration = this.wormUpDuration + this.wormDownDuration;

    this.wormHeight = 0.45;

    this.grabbedObject = null;
    this.hammer = null;
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  initScene() {
    const tableGeometry = new THREE.BoxGeometry(2, 0.1, 2);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.y = 1;
    this.scene.add(table);

    const holeGeometry = new THREE.CircleGeometry(0.1, 32);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        hole.position.set(i * 0.6, table.position.y + 0.051, j * 0.6);
        hole.rotation.x = -Math.PI / 2;
        this.scene.add(hole);
        this.holes.push(hole.position.clone());
      }
    }

    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    this.hammer = this.createHammer();
    this.hammer.position.set(-1.5, 1.05, 0);
    this.scene.add(this.hammer);

    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
  }

  setupXR() {
    this.renderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(this.renderer));

    const controllerModelFactory = new XRControllerModelFactory();

    this.controller1 = this.renderer.xr.getController(0);
    this.scene.add(this.controller1);
    const controllerGrip1 = this.renderer.xr.getControllerGrip(0);
    controllerGrip1.add(
      controllerModelFactory.createControllerModel(controllerGrip1)
    );
    this.scene.add(controllerGrip1);

    this.controller2 = this.renderer.xr.getController(1);
    this.scene.add(this.controller2);
    const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
      controllerModelFactory.createControllerModel(controllerGrip2)
    );
    this.scene.add(controllerGrip2);

    // Hammer direkt an den rechten Controller anhängen
    this.controller2.addEventListener("connected", (event) => {
      this.attachHammerToController(this.controller2);
    });
  }

  createHammer() {
    const hammerHandleGeometry = new THREE.CylinderGeometry(
      0.05,
      0.05,
      0.7,
      32
    );
    const hammerHandleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
    });
    const hammerHandle = new THREE.Mesh(
      hammerHandleGeometry,
      hammerHandleMaterial
    );
    hammerHandle.position.set(0, 0, 0);

    const hammerHeadGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const hammerHeadMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
    });
    const hammerHead = new THREE.Mesh(hammerHeadGeometry, hammerHeadMaterial);
    hammerHead.position.set(0, 0.35, 0);

    hammerHandle.add(hammerHead);
    hammerHandle.name = "Hammer";

    return hammerHandle;
  }

  spawnWorm() {
    const wormGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 32);
    const wormMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const worm = new THREE.Mesh(wormGeometry, wormMaterial);

    const holePosition =
      this.holes[Math.floor(this.random(0, this.holes.length))];
    worm.position.set(
      holePosition.x,
      holePosition.y - this.wormHeight,
      holePosition.z
    );
    worm.rotation.x = Math.PI;

    this.scene.add(worm);
    this.worms.push({
      mesh: worm,
      spawnTime: this.clock.getElapsedTime(),
      holePosition,
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onSelectStart(event) {
    const controller = event.target;
    const intersections = this.getIntersections(controller);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      this.grabbedObject = intersection.object;
      controller.attach(this.grabbedObject);
    }
  }

  onSelectEnd(event) {
    const controller = event.target;

    if (this.grabbedObject) {
      this.scene.attach(this.grabbedObject);
      this.grabbedObject = null;
    }
  }

  getIntersections(controller) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    return this.raycaster.intersectObjects(this.scene.children, false);
  }

  attachHammerToController(controller) {
    controller.attach(this.hammer);
    this.hammer.position.set(0, -0.1, 0.05); // Anpassung der Position relativ zum Controller
  }

  render() {
    this.stats.update();

    const elapsedTime = this.clock.getElapsedTime();
    if (elapsedTime - this.lastWormTime > 1 && this.worms.length < 2) {
      this.spawnWorm();
      this.lastWormTime = elapsedTime;
    }

    this.worms = this.worms.filter((worm) => {
      const timeAlive = elapsedTime - worm.spawnTime;
      if (timeAlive > this.wormVisibleDuration) {
        this.scene.remove(worm.mesh);
        return false;
      } else {
        const progress =
          timeAlive <= this.wormUpDuration
            ? timeAlive / this.wormUpDuration
            : (this.wormVisibleDuration - timeAlive) / this.wormDownDuration;
        worm.mesh.position.y =
          worm.holePosition.y -
          this.wormHeight * 0.7 +
          this.wormHeight * progress;
        return true;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

export { App };
