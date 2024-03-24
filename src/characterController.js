import * as THREE from "three";
import {addDragControls} from "./utils.js";

export const hideNonVisibleLights = (scene, position, viewDistance = 400) => {
  const lights = scene.getObjectsByProperty('name', 'sourceLight')
  const walls = scene.getObjectsByProperty('name', 'adjustableShape')
    .map((group) => group.children)
    .reduce((acc, cur) => [...acc, ...cur], []).filter((el) => el.name === 'Wall')

  lights.reduce((acc, cur) => {
    const raycaster = new THREE.Raycaster()
    const direction = new THREE.Vector3()

    const lightSource = scene.getObjectByProperty('name', `sourceLight-${cur.uuid}`)

    raycaster.firstHitOnly = true;
    direction.subVectors(cur.position, position)

    raycaster.set(position, direction.normalize());
    raycaster.near = 0;
    raycaster.far = viewDistance;

    const intersects = raycaster.intersectObjects([cur, ...walls], false).map((el) => el.object)

    if (intersects[0]?.name === 'sourceLight') {
      cur.visible = true
      lightSource.visible = true
    } else {
      lightSource.visible = false
      cur.visible = false;
    }
  }, [])
}

const handleKeyNavigation = (event, player, scene) => {
  if (event.key === 'ArrowUp') {
    player.translateZ(-50)
  } else if (event.key === 'ArrowDown') {
    player.translateZ(50)
  } else if (event.key === 'ArrowLeft') {
    player.translateX(-50)
  } else if (event.key === 'ArrowRight') {
    player.translateX(50)
  }

  hideNonVisibleLights(scene, player.position)
}

export const initCharacter = (scene, camera, renderer) => {
  const geometry = new THREE.CylinderGeometry(20, 5, 20, 32);
  const material = new THREE.MeshBasicMaterial({color: 0xffff00});
  const cylinder = new THREE.Mesh(geometry, material);
  scene.add(cylinder);

  cylinder.position.set(25, 10, 25)
  setTimeout(() => hideNonVisibleLights(scene, cylinder.position), 10)

  addDragControls(camera, renderer)({
    primary: cylinder, onDragComplete: (newPosition) => {
      hideNonVisibleLights(scene, cylinder.position)
    }
  })

  document.addEventListener('keydown', (event) => handleKeyNavigation(event, cylinder, scene))

  scene.add(cylinder)
  return cylinder
}