<script setup>
import * as THREE from 'three'
import {ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import Stats from 'stats.js'
import {ProgressiveLightMap} from "three/addons/misc/ProgressiveLightMap.js";
import {PCFSoftShadowMap} from "three";

const app = ref(null)

let camera, scene, renderer, controls, mesh, lightControls, sphere, line, transformTest;
let isBuilding = false;
let mouseMoveCoords = []
let points = []
let click = []
let progressiveSurfacemap;

let walls = [];
let wallWorkingIndex = 0;
const params = { 'Enable': true, 'Blur Edges': true, 'Blend Window': 200,
    'Light Radius': 50, 'Ambient Weight': 0.5, 'Debug Lightmap': false };

const stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

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
    const light = new THREE.PointLight(0xffffff, 1000, 500, 1);
    light.position.set(x, y, z);
    light.castShadow = true;

    scene.add(light);
    console.log(light.visible)

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
        // cube.position.x = Math.round(cube.position.x / 20) * 20;
        // cube.position.z = Math.round(cube.position.z / 20) * 20;
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
        // light.position.x = cube.position.x;
        // light.position.z = cube.position.z;
        // light.needsUpdate = true
    })

}

const initWalls = () => {
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 200), new THREE.MeshPhongMaterial({ color: 0xffffff, depthWrite: true }));
    console.log(wall1)
    wall1.castShadow = true
    wall1.receiveShadow = true
    wall1.position.x = -100;
    scene.add(wall1)
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 400), new THREE.MeshPhongMaterial({ color: 0xffffff, depthWrite: true }));
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    wall2.position.x = 100;
    scene.add(wall2)
    progressiveSurfacemap.addObjectsToLightMap( walls );

};

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

const initLine = (x, y) => {
    const [clickX, clickY] = findLocationFromCoords(x, y)
    click[0] = clickX
    click[1] = clickY
    if (!clickX) return

    const material = new THREE.LineBasicMaterial({color: 0x0000ff});

    const points = [];
    points.push(new THREE.Vector3(clickX, 0, clickY));
    points.push(new THREE.Vector3(clickX + 200, 0, clickY + 200));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    line = new THREE.Line(geometry, material);
    line.castShadow = true

    scene.add(line);
    isBuilding = true;
}

const createNewGeometry = () => {
    const wallShape = new THREE.Shape();
    wallShape.setFromPoints(points)

    return new THREE.ExtrudeGeometry([wallShape], {
        depth: 10,
        bevelEnabled: false,
    });
}

const globalClick = {x: 0, z: 0};

const testShape = (x, y) => {
    if (walls[wallWorkingIndex]) {
        wallWorkingIndex++;
        points = []
        return;
    }

    const [clickX, clickY] = findLocationFromCoords(x, y)
    if (!clickX) return

    globalClick.x = clickX;
    globalClick.z = clickY;
    points.push(new THREE.Vector3(clickX, 0, clickY)); // original-click 0
    points.push(new THREE.Vector3(clickX, 0, clickY + 10)); // original-click 1 horizontal
    points.push(new THREE.Vector3(clickX + 2, 0, clickY + 10)); // 2
    points.push(new THREE.Vector3(clickX + 2, 0, clickY)); // 3

    points.push(new THREE.Vector3(clickX, 10, clickY)); // original-click 4
    points.push(new THREE.Vector3(clickX, 10, clickY + 10)); // original-click 5 horizontal
    points.push(new THREE.Vector3(clickX + 2, 10, clickY + 10)); // 6
    points.push(new THREE.Vector3(clickX + 2, 10, clickY)); //7

    const wallGeometry = new ConvexGeometry(points)

    walls[wallWorkingIndex] = new THREE.Mesh(wallGeometry, new THREE.MeshBasicMaterial({
        color: 'red',
        wireframe: false
    }));

    walls[wallWorkingIndex].castShadow = true;

    scene.add(walls[wallWorkingIndex])
}

const getRandomInt = (max) => {
    return Math.ceil(Math.random() * max) * (Math.round(Math.random()) ? 1 : -1)
}

const init = () => {
    // camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000.0);
    camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
    camera.position.set(0, 700, 0)
    // camera.zoom = 0.5

    progressiveSurfacemap = new ProgressiveLightMap( renderer, 256 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);

    // scene.add(new THREE.HemisphereLight(0xffffcc, 0x19bbdc, 1));

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.enabled = true

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false // TODO FACI TU DACA VREI SA POTI ROTI CAMERA


    watch(app, (newValue) => {
        if (!newValue) return

        newValue.appendChild(renderer.domElement)
        newValue.addEventListener('click', (event) => {
            if (event.altKey) testShape(event.clientX, event.clientY)
        })
    })

    window.addEventListener('pointermove', (event) => {
        mouseMoveCoords[0] = event.clientX
        mouseMoveCoords[1] = event.clientY
    })

    initGround();
    for (let i = 0; i < 25; i++) {
        initLights({x: getRandomInt(500), y: 10, z: getRandomInt(500)});
    }
    initWalls();
    testShape()
}

const animate = () => {
    stats.begin()
    requestAnimationFrame(animate);

    const newMouseCoords = findLocationFromCoords(mouseMoveCoords[0], mouseMoveCoords[1])

    if (newMouseCoords.length !== 0 && walls[wallWorkingIndex]) {
        const angle = Math.atan(Math.abs(points[0].z - newMouseCoords[1]) / Math.abs(points[0].x - newMouseCoords[0])) || 0;
        // TODO: REFACTORIZAM AICI MATEMATICA SAU IGNOIRAM CA SAR CAPETELE PERETIILOR
        const widthX = Math.sin(angle) * 5;
        const widthY = Math.cos(angle) * 5 * (((globalClick.z > newMouseCoords[1] && globalClick.x > newMouseCoords[0]) || (globalClick.z < newMouseCoords[1] && globalClick.x < newMouseCoords[0])) ? -1 : 1);

        points[1].z = globalClick.z + widthY;
        points[5].z = globalClick.z + widthY;
        points[0].z = globalClick.z - widthY;
        points[4].z = globalClick.z - widthY;

        points[1].x = globalClick.x + widthX;
        points[5].x = globalClick.x + widthX;
        points[0].x = globalClick.x - widthX;
        points[4].x = globalClick.x - widthX;

        points[2].x = newMouseCoords[0] + widthX
        points[2].z = newMouseCoords[1] + widthY
        points[3].x = newMouseCoords[0] - widthX
        points[3].z = newMouseCoords[1] - widthY

        points[6].x = newMouseCoords[0] + widthX
        points[6].z = newMouseCoords[1] + widthY
        points[7].x = newMouseCoords[0] - widthX
        points[7].z = newMouseCoords[1] - widthY

        walls[wallWorkingIndex].geometry = new ConvexGeometry(points)

        walls[wallWorkingIndex].geometry.attributes.position.needsUpdate = true
    }

    if ( params[ 'Enable' ] ) {

        progressiveSurfacemap.update( camera, params[ 'Blend Window' ], params[ 'Blur Edges' ] );

        if ( ! progressiveSurfacemap.firstUpdate ) {

            progressiveSurfacemap.showDebugLightmap( params[ 'Debug Lightmap' ] );

        }

    }

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
