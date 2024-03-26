import {DragControls} from "three/addons/controls/DragControls.js";

export const addDragControls = (camera, renderer) => ({primary, secondary, onDragComplete}) => {
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

export const getActivePlayer = (scene) => {
  const player = scene.getObjectsByProperty('name', 'player')
  return player.filter((player) => player.userData.selected)[0]
}