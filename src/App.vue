<script setup>
import * as THREE from 'three'
import {ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";

const app = ref(null)

let camera, scene, renderer, controls ,mesh, light, lightControls, sphere;

const createWorld = () => {
  const wallGroup = new THREE.Group();
  const wallObject = new THREE.Object3D();

  wallGroup.add(wallObject);
  scene.add(wallGroup);

  // Draw side walls
  const wallShape = new THREE.Shape();
  wallShape.moveTo(0, 0);
  wallShape.lineTo(500, 0);
  wallShape.lineTo(500, 35);
  wallShape.lineTo(0, 35);
  wallShape.lineTo(0, 0);
  const wallGeometry = new THREE.ExtrudeGeometry([ wallShape ], {
    steps: 1,
    depth: 1,
    bevelEnabled: false,
    curveSegments: 32
  });
  const wallA = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({ color: 0xff9999}));
  wallA.rotateY(-Math.PI / 2);
  wallA.translateX(-200);
  wallA.castShadow = true;
  wallA.receiveShadow = true;
  wallObject.add(wallA);

  const wallB = wallA.clone();
  wallB.translateZ(-150);
  wallObject.add(wallB);

  const groundTexture = new THREE.TextureLoader().load( './map.jpg' )
  
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({
    map: groundTexture
  }));
  ground.rotateX(-Math.PI / 2);
  ground.castShadow = true;
  ground.receiveShadow = true;
  wallGroup.add(ground);

  light = new THREE.PointLight( 0xffffff, 5, 1000);
  light.position.set( 70, 10, 1 );
  light.castShadow = true
  scene.add( light );

  mesh = [ wallGroup, wallObject ];

};

const init = () => {
  // camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
  camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 0.1, 10000 );
  camera.position.set(0,1,0)
  // camera.zoom = 0.5

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);

  // scene.add(new THREE.HemisphereLight(0xffffcc, 0x19bbdc, 1));

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // renderer.shadowMap.type = THREE.VSMShadowMap
  renderer.shadowMap.enabled = true
  controls = new OrbitControls( camera, renderer.domElement );
  controls.enableRotate = false

  watch(app, (newValue) => {
    if (!newValue) return

    newValue.appendChild(renderer.domElement)
  })

  createWorld();
}

const animate = () => {
  requestAnimationFrame(animate);

  // controls.update();
  // lightControls.update()

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
