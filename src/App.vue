<script setup>
import * as THREE from 'three'
import {ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";

const app = ref(null)

let camera, scene, renderer, controls, mesh, light, lightControls, sphere, line;
let isBuilding = false;
let mouseMoveCoords = []

const initGround = () => {
  const groundTexture = new THREE.TextureLoader().load('./map.jpg')
  console.log(groundTexture.width)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({
    map: groundTexture
  }));
  ground.rotateX(-Math.PI / 2);
  ground.castShadow = true;
  ground.receiveShadow = true;

  scene.add(ground)
  const size = 1000;
  const divisions = 20;

  const gridHelper = new THREE.GridHelper(size, divisions);
  scene.add(gridHelper);
}

const initLights = () => {
  light = new THREE.PointLight(0xffffff, 10, 2000);
  light.position.set(0, 10, 0);
  light.castShadow = true;
  scene.add(light);

  const geometry = new THREE.SphereGeometry(20);
  const material = new THREE.MeshBasicMaterial({color: "orange", emissive: 0.5});
  const cube = new THREE.Mesh(geometry, material);
  cube.castShadow = false;
  scene.add(cube)

  const controls = new DragControls([cube], camera, renderer.domElement);

  controls.addEventListener('drag', (event) => {
    // cube.position.x = Math.round(cube.position.x / 20) * 20;
    // cube.position.z = Math.round(cube.position.z / 20) * 20;
    light.position.x = cube.position.x;
    light.position.z = cube.position.z;
  });

  controls.addEventListener("dragend", (event) => {
    const grid = 50;
    const halfGrd = grid / 2;
    cube.position.x = Math.round((cube.position.x + halfGrd) / grid) * grid - halfGrd;
    cube.position.z = Math.round((cube.position.z + halfGrd) / grid) * grid - halfGrd;
    light.position.x = cube.position.x;
    light.position.z = cube.position.z;
  })

}

const initWalls = () => {
  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 200), new THREE.MeshBasicMaterial({color: "red"}));
  console.log(wall1)
  wall1.castShadow = true
  // wall1.receiveShadow = true
  wall1.position.x = -100;
  scene.add(wall1)
  const wall2 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 400), new THREE.MeshBasicMaterial({color: "blue"}));
  wall2.castShadow = true;
  // wall2.receiveShadow = true;
  wall2.position.x = 100;
  scene.add(wall2)
};

const findLocationFromCoords = (x,y) => {
  const reycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  mouse.x = ( x / window.innerWidth ) * 2 - 1
  mouse.y = -( y / window.innerHeight ) * 2 + 1

  reycaster.setFromCamera(mouse, camera)
  const intersectedObjects = reycaster.intersectObjects(scene.children)

  if (intersectedObjects.length === 0) return []
  return [intersectedObjects[0].point.x, intersectedObjects[0].point.z]
}

const initLine = (x,y) => {
  const [clickX, clickY] = findLocationFromCoords(x, y)
  if (!clickX) return

  const material = new THREE.LineBasicMaterial({color: 0x0000ff});

  const points = [];
  points.push(new THREE.Vector3(clickX, 0, clickY));
  points.push(new THREE.Vector3(clickX + 2, 0, clickY + 2));

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  line = new THREE.Line(geometry, material);
  line.castShadow = true

  scene.add(line);
  console.log(line.geometry.attributes.position.array)
  isBuilding = true;
}

const testShape = () => {
  const wallShape = new THREE.Shape();
  wallShape.lineTo(500, 30);
  wallShape.lineTo(500, 30);
  wallShape.lineTo(0, 30);

  const wallGeometry = new THREE.ExtrudeGeometry([ wallShape ], {
    steps: 1,
    depth: 5,
    bevelEnabled: false,
    curveSegments: 32
  });
  const wallA = new THREE.Mesh(wallGeometry, new THREE.MeshBasicMaterial({ color: 'red'}));
  // wallA.translateX(-200);
  wallA.translateY(-15);
  console.log(wallA)
  wallA.position.z = 100
  wallA.castShadow = true;
  scene.add(wallA)
}

const init = () => {
  // camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
  camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
  camera.position.set(0, 700, 0)
  // camera.zoom = 0.5

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);

  // scene.add(new THREE.HemisphereLight(0xffffcc, 0x19bbdc, 1));

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.enabled = true
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false // TODO FACI TU DACA VREI SA POTI ROTI CAMERA

  watch(app, (newValue) => {
    if (!newValue) return

    newValue.appendChild(renderer.domElement)
    newValue.addEventListener('click', (event) => {
      // initLine(event.clientX, event.clientY)
    })
  })

  window.addEventListener('pointermove', (event) => {
    mouseMoveCoords[0] = event.clientX
    mouseMoveCoords[1] = event.clientY
  })

  initGround();
  initLights();
  initWalls();
  testShape()
}

const animate = () => {
  requestAnimationFrame(animate);

  const newMouseCoords = findLocationFromCoords(mouseMoveCoords[0], mouseMoveCoords[1])

  if (newMouseCoords.length !== 0 && line) {
    line.geometry.attributes.position.array[3] = newMouseCoords[0]
    line.geometry.attributes.position.array[5] = newMouseCoords[1]
    line.geometry.attributes.position.needsUpdate = true
  }

  renderer.render(scene, camera);
}

init();
animate();
</script>

<template>
  <div ref="app">

  </div>
</template>

<style scoped>

</style>
