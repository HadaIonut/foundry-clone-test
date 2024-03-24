<script setup>
import * as THREE from 'three'
import {reactive, ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import Stats from 'stats.js'
import {adjustableShape, createPoint} from "./adjustableShape.js";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";
import lights_par_beginGlsl from "./shaderOverrides/lights_par_begin.glsl.js"
import lights_fragment_beginGlsl from "./shaderOverrides/lights_frament_begin.glsl.js"
import {onClickOutside} from "@vueuse/core";
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';
import {hideNonVisibleLights, initCharacter} from "./characterController.js";
import {addDragControls} from "./utils.js";
import {initLights} from "./lightController.js";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const app = ref(null)

let interactionManager
let camera, scene, renderer, controls
let click = []
let rayCaster;
const controlPoints = [];
let mouse = new THREE.Vector2();
let plane;
let drawMode = ref(false);
const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)
let time = 0;
let curShift = 0;

let enableRotation = false;
let wallTension = ref(0);
let lightColor = ref(0xffffff);
let shape = {}
let currentDrawingId = null;

let contextMenuRef = ref(null)
let contextMenuTargetedObject = ref(null)
let player;

let groundSizes = [1000, 1000]

const handleContextMenu = (position, targetedObject, visibility) => {
  if (visibility) contextMenuRef.value.style.display = visibility
  else {
    if (contextMenuRef.value.style.display === 'none') contextMenuRef.value.style.display = 'block'
    else contextMenuRef.value.style.display = 'none'
  }
  if (targetedObject) contextMenuTargetedObject.value = targetedObject
  contextMenuRef.value.style.top = `${position.top}px`
  contextMenuRef.value.style.left = `${position.left}px`
}

const drawModeToggleFunction = (event) => {
  event.stopPropagation()
  drawMode.value = !drawMode.value;
  currentDrawingId = null
}

const initGround = () => {
  const groundTexture = new THREE.TextureLoader().load('./map.jpg')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSizes[0], groundSizes[1]),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0xffffff,
      depthWrite: true
    }));
  ground.rotateX(-Math.PI / 2);
  ground.receiveShadow = true;

  scene.add(ground)
  const size = 1000;
  const divisions = 20;

  const gridHelper = new THREE.GridHelper(size, divisions);
  gridHelper.position.y += 5;
  scene.add(gridHelper);
}

const findLocationFromCoords = (x, y) => {
  const reycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  mouse.x = (x / window.innerWidth) * 2 - 1
  mouse.y = -(y / window.innerHeight) * 2 + 1

  reycaster.setFromCamera(mouse, camera)
  const intersectedObjects = reycaster.intersectObjects(scene.children)

  if (intersectedObjects.length === 0) return []
  return new THREE.Vector3(intersectedObjects[0].point.x, 0, intersectedObjects[0].point.z)
}

const getRandomInt = (max) => {
  return Math.ceil(Math.random() * max) * (Math.round(Math.random()) ? 1 : -1)
}

const initGUI = () => {
  const panel = new GUI({width: 310});
  const settings = {
    "enable rotation": false,
    "wall tension": 0,
    "light color": 0xffffff
  }
  panel.add(settings, "enable rotation").onChange((newValue) => controls.enableRotate = newValue)
  panel.add(settings, "wall tension", 0, 1, 0.1).onChange((newValue) => wallTension.value = newValue)
  panel.addColor(settings, "light color", 0xffffff).onChange((newValue) => lightColor.value = newValue)
}
const init = () => {
  rayCaster = new THREE.Raycaster();
  plane = new THREE.Plane();
  plane.setFromCoplanarPoints(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
  camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
  camera.position.set(0, 700, 0)

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = enableRotation
  controls.enabled = true

  initGUI()

  watch(app, (newValue) => {
    if (!newValue) return

    newValue.appendChild(renderer.domElement)
    newValue.addEventListener('click', (event) => {
      if (!drawMode.value) return
      const clickLocation = findLocationFromCoords(event.clientX, event.clientY)
      const newPoint = createPoint(clickLocation, scene)

      if (!shape[currentDrawingId]) {
        let [updateShape, extrudeMesh, object] = adjustableShape({
          scene,
          controls,
          rayCaster,
          originPoint: newPoint,
          plane,
          mouse,
          tension: wallTension,
          filled: false,
          closed: false,
          concaveHull: false,
          renderer,
          handleContextMenu,
          onDragComplete: () => {
            hideNonVisibleLights(scene, player.position)
          }
        })
        currentDrawingId = object.uuid
        shape[currentDrawingId] = {
          object,
          updateShape,
          extrudeMesh
        }
      }
      shape[currentDrawingId].object.add(newPoint);
      shape[currentDrawingId].updateShape()
    })
  })
  player = initCharacter(scene, camera, renderer)

  const spawnLight = initLights(scene, lightColor, camera, renderer, player)

  initGround();
  for (let i = 0; i < 10; i++) {
    spawnLight({x: getRandomInt(10) * 25, y: 10, z: getRandomInt(10) * 25});
  }

  spawnLight({x: 75, y: 10, z: 25});
}

const animate = () => {
  stats.begin()
  requestAnimationFrame(animate);

  rayCaster.setFromCamera(mouse, camera);
  controlPoints.forEach((cp, idx) => {
    curShift = (Math.PI / 2) * idx;
    cp.material.opacity = 0.6 + Math.sin(time - curShift) * .2;
  });

  renderer.render(scene, camera);
  stats.end()
}

const objectDelete = () => {
  if (contextMenuTargetedObject.value.parent.name === 'adjustableShape') contextMenuTargetedObject.value.parent.removeFromParent()

  handleContextMenu({})
}

const addPointsToObject = () => {
  if (contextMenuTargetedObject.value.parent.name === 'adjustableShape') {
    setTimeout(() => {
      drawMode.value = true
      currentDrawingId = contextMenuTargetedObject.value.parent.uuid
    }, 0)
  }

  handleContextMenu({})
}

const removePointFromObject = () => {
  const workingShapeId = contextMenuTargetedObject.value.parent.uuid
  const workingShape = shape[workingShapeId]
  contextMenuTargetedObject.value.removeFromParent()
  workingShape.updateShape()
  handleContextMenu({})

}

init();
animate();
onClickOutside(contextMenuRef, () => handleContextMenu({}, undefined, 'none'))

</script>

<template>
  <div ref="app">
    <div :style="`position: absolute; top: 100px; color: white; background:${drawMode ? 'pink' : 'darkslategray'} `"
         @click="drawModeToggleFunction">test
    </div>
    <div ref="contextMenuRef"
         style="display: none; position: absolute; top: 0; left: 0; background: #888888; transform: translateX(-50%)">
      <div style="cursor: pointer;" @click="addPointsToObject">add points</div>
      <div style="cursor: pointer;" @click="removePointFromObject"
           v-if="contextMenuTargetedObject?.name === 'controlPoint'">remove point
      </div>
      <div style="cursor: pointer;" @click="objectDelete">delete object</div>
    </div>
  </div>
</template>

<style scoped>

</style>
