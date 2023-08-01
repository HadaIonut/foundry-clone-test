<script setup>
import * as THREE from 'three'
import {ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import Stats from 'stats.js'
import {ProgressiveLightMap} from "three/addons/misc/ProgressiveLightMap.js";
import {PCFSoftShadowMap} from "three";
import {adjustableShape} from "./adjustableShape.js";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";

const app = ref(null)

let camera, scene, renderer, controls, mesh, lightControls, sphere, line, transformTest;
let isBuilding = false;
let mouseMoveCoords = []
let points = []
let click = []
let progressiveSurfacemap;
let rayCaster;
const controlPoints = [];
let mouse = new THREE.Vector2();
let walls = [];
let wallWorkingIndex = 0;
let plane;
const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

let enableRotation = false;
let wallTension = ref(0);
let lightColor = ref(0xffffff);

const initGround = () => {
    const groundTexture = new THREE.TextureLoader().load('./map.jpg')
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshPhongMaterial({
            map: groundTexture,
            side: THREE.DoubleSide,
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

const initLights = ({x, y, z}) => {
    const light = new THREE.PointLight(lightColor.value, 1000, 500, 1);
    light.position.set(x, y, z);
    light.castShadow = true;

    scene.add(light);

    const geometry = new THREE.SphereGeometry(20);
    const material = new THREE.MeshBasicMaterial({color: "orange"});
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z)
    cube.castShadow = false;
    scene.add(cube)

    const helper = new THREE.PointLightHelper(light);
    scene.add(helper);

    const controls = new DragControls([cube], camera, renderer.domElement);

    controls.addEventListener('drag', (event) => {
        light.position.x = cube.position.x;
        light.position.z = cube.position.z;
    });

    controls.addEventListener("dragend", (event) => {
        const grid = 50;
        const halfGrd = grid / 2;
        cube.position.set(
            Math.round((cube.position.x + halfGrd) / grid) * grid - halfGrd,
            cube.position.y,
            Math.round((cube.position.z + halfGrd) / grid) * grid - halfGrd
        )

        light.position.set(cube.position.x, cube.position.y, cube.position.z)
        renderer.shadowMap.needsUpdate = true

    })

    watch(lightColor, (newValue) => {
       light.color.set(newValue)
    })
}



const findLocationFromCoords = (x, y) => {
    const reycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    mouse.x = (x / window.innerWidth) * 2 - 1
    mouse.y = -(y / window.innerHeight) * 2 + 1

    reycaster.setFromCamera(mouse, camera)
    const intersectedObjects = reycaster.intersectObjects(scene.children)

    if (intersectedObjects.length === 0) return []
    return [intersectedObjects[0].point.x, intersectedObjects[0].point.z]
}


const globalClick = {x: 0, z: 0};

const getRandomInt = (max) => {
    return Math.ceil(Math.random() * max) * (Math.round(Math.random()) ? 1 : -1)
}
const createPoint = (position, color = 'white') => {
    const viewGeometry = new THREE.BoxGeometry(15, 50, 15, 1, 3, 1);
    viewGeometry.translate(0, .75, 0);
    const viewMaterial = new THREE.MeshBasicMaterial({color: color, wireframe: false, transparent: true, opacity: .5});
    const view = new THREE.Mesh(viewGeometry, viewMaterial);
    view.position.copy(position);
    scene.add(view);
    return view;
}

const initGUI = () => {
    const panel = new GUI( { width: 310 } );
    const settings = {
        "enable rotation": false,
        "wall tension": 0,
        "light color": 0xffffff
    }
    panel.add(settings, "enable rotation").onChange((newValue) => controls.enableRotate = newValue)
    panel.add(settings, "wall tension", 0, 1, 0.1).onChange((newValue) => wallTension.value = newValue)
    panel.addColor(settings, "wall tension", 0xffffff ).onChange((newValue) => lightColor.value = newValue)
}
const init = () => {
    rayCaster = new THREE.Raycaster();
    plane = new THREE.Plane();
    plane.setFromCoplanarPoints(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
    // camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000.0);
    camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
    camera.position.set(0, 700, 0)
    // camera.zoom = 0.5

    progressiveSurfacemap = new ProgressiveLightMap(renderer, 256);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);

    // scene.add(new THREE.HemisphereLight(0xffffcc, 0x19bbdc, 1));

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.enabled = true

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = enableRotation // TODO FACI TU DACA VREI SA POTI ROTI CAMERA

    initGUI()

    controlPoints.push(createPoint(new THREE.Vector3(20, 0,  0)));
    controlPoints.push(createPoint(new THREE.Vector3( 30, 0, 20)));
    controlPoints.push(createPoint(new THREE.Vector3( 50, 0,  10)));
    controlPoints.push(createPoint(new THREE.Vector3( 50, 0,  -30)));
    controlPoints.push(createPoint(new THREE.Vector3( 0, 0,  0)));

    watch(app, (newValue) => {
        if (!newValue) return

        newValue.appendChild(renderer.domElement)
    })

    initGround();
    for (let i = 0; i < 10; i++) {
        initLights({x: getRandomInt(500), y: 10, z: getRandomInt(500)});
    }
    adjustableShape(scene, controls, rayCaster, controlPoints, plane, mouse, wallTension)
}
let time = 0;
let curShift = 0;
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

init();
animate();
</script>

<template>
    <div ref="app">

    </div>
</template>

<style scoped>

</style>
