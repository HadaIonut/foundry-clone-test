import * as THREE from 'three'
import {Vector3} from 'three'
import {watch} from "vue";
import concaveman from "concaveman";


const findCenterOfObject = (points) => {
  const xCenter = points.reduce((acc, cur) => acc + cur.x, 0) / points.length
  const zCenter = points.reduce((acc, cur) => acc + cur.z, 0) / points.length

  return new Vector3(xCenter, 0, zCenter)
}

const createCenterPoint = (controlPoints, scene) => {
  const points = controlPoints.reduce((acc, cur) => [...acc, cur.position], [])

  return createPoint(findCenterOfObject(points), scene, 'blue', 'centerPoint')
}

const createCurveGeometry = (controlPoints, tension, centralPoint) => {
  let pts = [];
  controlPoints.forEach(pt => {
    pts.push([pt.position.x, pt.position.z]);
  });
  // debugger
  pts = concaveman(pts, 1)
  pts = pts.map(pt => new THREE.Vector3(pt[0], 0, pt[1]))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', tension.value);
  curve.closed = true;
  const curveGeometry = new THREE.BufferGeometry();
  curveGeometry.vertices = curve.getPoints(75);
  curveGeometry.translate(0, 1, 0);

  const newCenterLocation = findCenterOfObject(pts)
  centralPoint.position.set(newCenterLocation.x, newCenterLocation.y, newCenterLocation.z)

  return curveGeometry;
}

export const createPoint = (position, scene, color = 'white', objectName = '') => {
  const viewGeometry = new THREE.BoxGeometry(15, 50, 15, 1, 3, 1);
  viewGeometry.translate(0, .75, 0);
  const viewMaterial = new THREE.MeshBasicMaterial({color: color, wireframe: false, transparent: true, opacity: .5});
  const view = new THREE.Mesh(viewGeometry, viewMaterial);
  view.position.copy(position);
  view.name = objectName
  scene.add(view);
  return view;
}
export const adjustableShape = (scene, controls, rayCaster, controlPoints, plane, mouse, tension, handleContextMenu) => {
  let centralPoint = createCenterPoint(controlPoints, scene);

  const curveMaterial = new THREE.LineBasicMaterial({color: "white"});
  const curveLine = new THREE.Line(createCurveGeometry(controlPoints, tension, centralPoint), curveMaterial);

  const extrudeSettings = {amount: 1, bevelEnabled: false, depth: 20};
  let points = [];
  let shape = null;
  let shapeGeometry;
  const shapeMaterial = new THREE.MeshBasicMaterial({color: 'red'})
  const shapeMesh = new THREE.Mesh(shapeGeometry, shapeMaterial);

  let intersects;
  let dragging = false;
  let dragObject;
  const pointOfIntersection = new THREE.Vector3();
  const planeNormal = new THREE.Vector3(0, 1, 0);
  const shift = new THREE.Vector3();
  const shapeGroup = new THREE.Group()
  shapeGroup.name = 'adjustableShape'

  shapeGroup.add(shapeMesh)
  shapeGroup.add(curveLine)
  shapeGroup.add(centralPoint)
  controlPoints.forEach(point => shapeGroup.add(point))

  watch(tension, () => {
    curveLine.geometry.dispose();
    curveLine.geometry = createCurveGeometry(controlPoints, tension, centralPoint);
    extrudeMesh()
  })

  shapeMesh.castShadow = true
  scene.add(shapeGroup)

  curveLine.geometry.vertices.forEach((vertex, index) => {
    points.push(new THREE.Vector2(vertex.x, vertex.z)); // fill the array of points with THREE.Vector2() for re-use
  });

  const updateShape = () => {
    curveLine.geometry.dispose();
    curveLine.geometry = createCurveGeometry(controlPoints, tension, centralPoint);
    controlPoints.forEach(point => shapeGroup.add(point))
    shapeGroup.userData.id = controlPoints[0].userData.groupId

    extrudeMesh()
  }
  const extrudeMesh = () => {
    curveLine.geometry.vertices.forEach((vertex, index) => {
      points[index].set(vertex.x, vertex.z); // re-use the array
    });

    shape = new THREE.Shape(points);
    shapeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    shapeGeometry.rotateX(Math.PI * .5);
    shapeGeometry.translate(0, 20, 0);
    shapeMesh.geometry.dispose();
    shapeMesh.geometry = shapeGeometry;
  }
  extrudeMesh();

  const onMouseDown = (event) => {
    const controlPointsIntersection = rayCaster.intersectObjects(controlPoints)
    const centralPointIntersection = rayCaster.intersectObject(centralPoint);

    if (event.button === 0) {

      if (controlPointsIntersection.length) intersects = controlPointsIntersection
      else intersects = centralPointIntersection

      if (intersects.length > 0) {
        controls.enableRotate = false;
        dragObject = intersects[0].object;
        plane.setFromNormalAndCoplanarPoint(planeNormal, intersects[0].point);
        shift.subVectors(dragObject.position, intersects[0].point);
        dragging = true;
      }
    }
    if (event.button === 2) {
      console.log("rightclick?")
      if (centralPointIntersection.length) handleContextMenu({top: event.clientY, left: event.clientX}, centralPointIntersection[0].object)
      event.preventDefault()
      return false
    }

  }

  const onMouseUp = (event) => {
    controls.enableRotate = false;
    dragObject = null;
    dragging = false;
    event.preventDefault()
  }

  const onMouseMove = (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    if (intersects?.length === 0 || !dragging) return;

    if (intersects[0].object.name === 'centerPoint') {
      const oldObjectPosition = dragObject.position.clone()
      rayCaster.ray.intersectPlane(plane, pointOfIntersection);
      dragObject.position.copy(pointOfIntersection).add(shift);
      const newObjectPosition = dragObject.position

      const moveDelta = new Vector3().subVectors(newObjectPosition, oldObjectPosition)

      controlPoints.forEach((point, index) => {
        point.position.setY(25).add(moveDelta)
      })

      curveLine.geometry.dispose();
      curveLine.geometry = createCurveGeometry(controlPoints, tension, centralPoint);
      extrudeMesh();
    } else {
      rayCaster.ray.intersectPlane(plane, pointOfIntersection);
      dragObject.position.copy(pointOfIntersection).add(shift);
      curveLine.geometry.dispose();
      curveLine.geometry = createCurveGeometry(controlPoints, tension, centralPoint);
      extrudeMesh();
    }

  }

  window.addEventListener("mousedown", onMouseDown, false);
  window.addEventListener("mouseup", onMouseUp, false);
  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("contextmenu", (event) => event.preventDefault(), false);

  return [updateShape, extrudeMesh]
}

