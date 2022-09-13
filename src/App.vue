<script setup>
import * as THREE from 'three'
import {ref, watch} from "vue";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {DragControls} from "three/addons/controls/DragControls.js";

const app = ref(null)

let camera, scene, renderer, controls, mesh, light, lightControls, sphere;
let dragging = true;

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
    ground.addEventListener("hover", () => {
        console.log("clicked")
    })

    const gridHelper = new THREE.GridHelper( size, divisions );
    scene.add( gridHelper );
}

const initLights = () => {
    light = new THREE.PointLight(0xffffff, 10, 2000);
    light.position.set(0, 10, 0);
    light.castShadow = true;
    scene.add(light);

    const geometry = new THREE.SphereGeometry(20);
    const material = new THREE.MeshBasicMaterial({color: "orange"});
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = false;
    scene.add(cube)

    const controls = new DragControls([cube], camera, renderer.domElement);

    controls.addEventListener("dragstart", () => {
        dragging = false;
    })

    controls.addEventListener('drag', (event) => {
        // cube.position.x = Math.round(cube.position.x / 20) * 20;
        // cube.position.z = Math.round(cube.position.z / 20) * 20;
        cube.position.y = 10
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
        dragging = true;
    })

}

const initWalls = () => {
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 200), new THREE.MeshStandardMaterial({color: "red"}));
    wall1.castShadow = true
    wall1.receiveShadow = true
    wall1.position.x = -100;
    scene.add(wall1)
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 400), new THREE.MeshStandardMaterial({color: "blue"}));
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    wall2.position.x = 100;
    scene.add(wall2)
};


const init = () => {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000.0);
    // camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
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
    controls.enableRotate = false;

    watch(app, (newValue) => {
        if (!newValue) return

        newValue.appendChild(renderer.domElement)
    })

    initGround();
    initLights();
    initWalls();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();


const onPointerMove = (event) => {
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}


const animate = () => {
    requestAnimationFrame(animate);
    raycaster.setFromCamera( pointer, camera );

    // calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects( scene.children , false);

    // for ( let i = 0; i < intersects.length; i ++ ) {
    //     intersects[ i ].object.material.color.set( 0xff0000 );
    // }
    // console.log(intersects.slice(-1)[0]?.object);
    controls.enableRotate = dragging

    renderer.render(scene, camera);
}

init();
window.addEventListener( 'pointermove', onPointerMove );
animate();
</script>

<template>
    <div ref="app">

    </div>
</template>

<style scoped>

</style>
