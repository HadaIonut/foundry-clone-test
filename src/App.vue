<script setup>
import * as THREE from 'three'
import {reactive, ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import Stats from 'stats.js'
import {ProgressiveLightMap} from "three/addons/misc/ProgressiveLightMap.js";
import {PCFSoftShadowMap} from "three";
import {adjustableShape, createPoint} from "./adjustableShape.js";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";
import lights_par_beginGlsl from "./shaderOverrides/lights_par_begin.glsl.js"
import lights_fragment_beginGlsl from "./shaderOverrides/lights_frament_begin.glsl.js"
import {InteractionManager} from "three.interactive";
import {onClickOutside} from "@vueuse/core";
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';

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
let fogMask
let fogTexture, fogMesh, fogMaterial

let groundSizes = [1000, 1000]

const handleContextMenu = (position, targetedObject, visibility) => {
  if (visibility) contextMenuRef.value.style.display = visibility
  else {
    if (contextMenuRef.value.style.display === 'none') contextMenuRef.value.style.display = 'block'
    else contextMenuRef.value.style.display = 'none'
  }
  if (targetedObject) contextMenuTargetedObject.value = targetedObject
  // debugger
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
    new THREE.MeshPhongMaterial({
      map: groundTexture,

      color: 0xffffff, depthWrite: true
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

const addDragControls = ({primary, secondary, onDragComplete}) => {
  const controls = new DragControls([primary], camera, renderer.domElement);

  controls.addEventListener('drag', () => {
    if (secondary) {
      secondary.position.x = primary.position.x;
      secondary.position.z = primary.position.z;
    }
  });

  controls.addEventListener("dragend", () => {
    const grid = 50;
    const halfGrd = grid / 2;
    primary.position.set(
      Math.round((primary.position.x + halfGrd) / grid) * grid - halfGrd,
      primary.position.y,
      Math.round((primary.position.z + halfGrd) / grid) * grid - halfGrd
    )

    if (secondary)
      secondary.position.set(primary.position.x, primary.position.y, primary.position.z)

    renderer.shadowMap.needsUpdate = true

    onDragComplete?.(primary.position)
  })
}

const initLights = ({x, y, z}) => {
  const light = new THREE.PointLight(lightColor.value, 1000, 500, 1);
  light.position.set(x, y, z);
  light.castShadow = true;
  light.distance = 300;

  scene.add(light);

  const geometry = new THREE.SphereGeometry(20);
  const material = new THREE.MeshBasicMaterial({color: "orange"});
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(x, y, z)
  cube.castShadow = false;
  scene.add(cube)

  const helper = new THREE.PointLightHelper(light);
  scene.add(helper);

  addDragControls({primary: cube, secondary: light})

  watch(lightColor, (newValue) => {
    light.color.set(newValue)
  })
}
const worldPositionToVectorPosition = (worldPosition) => {
  const matrixSpace = [worldPosition.x + groundSizes[0] / 2, worldPosition.z + groundSizes[1] / 2]
  const origin = (2 * matrixSpace[0] + matrixSpace[1] * groundSizes[1] * 2)
  const rowMax = groundSizes[0] * 2 + matrixSpace[1] * groundSizes[1] * 2

  return [origin, rowMax]
}
const clearFogAtPosition = (worldPosition) => {
  const [vectorPosition, rowMax] = worldPositionToVectorPosition(worldPosition)
  fogMask[vectorPosition] = 0
  fogMask[vectorPosition + 1] = 0
  clearFogAroundVectorPosition(vectorPosition, rowMax)
  fogTexture.data = fogMask
  fogTexture.needsUpdate = true;
  fogMesh.needsUpdate = true;
  fogMaterial.needsUpdate = true
}

const clearFogAroundVectorPosition = (vectorPosition, rowMax, distance = 120) => {
  for (let i = 0; i < distance * 2; i += 2) {
    for (let j = 0; j < distance * 2; j += 2) {
      if (vectorPosition + i <= rowMax) {
        fogMask[vectorPosition + i] = 0
        fogMask[vectorPosition + i + 1] = 0
        fogMask[vectorPosition - j * groundSizes[1] + i + 1] = 0
        fogMask[vectorPosition - j * groundSizes[1] + i] = 0
        fogMask[vectorPosition + j * groundSizes[1] + i + 1] = 0
        fogMask[vectorPosition + j * groundSizes[1] + i] = 0
      }
      if (vectorPosition - i > rowMax - groundSizes[0] * 2) {
        fogMask[vectorPosition - i] = 0
        fogMask[vectorPosition - i - 1] = 0
        fogMask[vectorPosition - j * groundSizes[1] - i - 1] = 0
        fogMask[vectorPosition - j * groundSizes[1] - i] = 0
        fogMask[vectorPosition + j * groundSizes[1] - i - 1] = 0
        fogMask[vectorPosition + j * groundSizes[1] - i] = 0
      }
    }
  }
}

const initCharacter = () => {
  const geometry = new THREE.CylinderGeometry(20, 5, 20, 32);
  const material = new THREE.MeshBasicMaterial({color: 0xffff00});
  const cylinder = new THREE.Mesh(geometry, material);
  scene.add(cylinder);

  cylinder.position.set(25, 10, 25)
  clearFogAtPosition(cylinder.position)
  addDragControls({
    primary: cylinder, onDragComplete: (newPosition) => {
      clearFogAtPosition(newPosition)
    }
  })

  scene.add(cylinder)
}

const initFogOfWar = () => {
  fogMask = new Uint8Array(groundSizes[0] * groundSizes[1] * 2);
  fogMask.fill(255)
  fogTexture = new THREE.DataTexture(fogMask, groundSizes[0], groundSizes[1], THREE.RGFormat, THREE.UnsignedByteType);

  fogTexture.flipY = true;
  fogTexture.wrapS = THREE.ClampToEdgeWrapping;
  fogTexture.wrapT = THREE.ClampToEdgeWrapping;
  fogTexture.generateMipmaps = false;

  fogTexture.magFilter = THREE.LinearFilter;
  fogTexture.minFilter = THREE.LinearFilter;

  fogTexture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
  fogMaterial = new THREE.MeshBasicMaterial({
    color: 0xFF0000,
    alphaMap: fogTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1
  });
  fogMesh = new THREE.Mesh(geometry, fogMaterial);
  fogMesh.position.y = 30
  fogMesh.rotateX(-Math.PI / 2);

  scene.add(fogMesh);
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
  THREE.ShaderChunk.lights_pars_begin = lights_par_beginGlsl
  THREE.ShaderChunk.lights_fragment_begin = lights_fragment_beginGlsl

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
          handleContextMenu
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

  initGround();
  for (let i = 0; i < 2; i++) {
    initLights({x: getRandomInt(500), y: 10, z: getRandomInt(500)});
  }

  initLights({x: 50, y: 10, z: 50});

  initFogOfWar()
  initCharacter()
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
