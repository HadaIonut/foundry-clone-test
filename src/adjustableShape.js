import * as THREE from 'three'
import {watch} from "vue";
import {Vector3} from "three";

let centralPoint;

const findCenterOfObject = (points) => {
    const xCenter = points.reduce((acc, cur) => acc + cur.x ,0) / points.length
    const zCenter = points.reduce((acc, cur) => acc + cur.z ,0) / points.length

    return new Vector3(xCenter, 0, zCenter)
}

const createCenterPoint = (controlPoints, scene) => {
    const points = controlPoints.reduce((acc, cur) => [...acc, cur.position],[])

    centralPoint = createPoint(findCenterOfObject(points), scene)
}

const createCurveGeometry = (controlPoints, tension) => {
    const pts = [];
    controlPoints.forEach(pt => {
        pts.push(pt.position);
    });
    const curve = new THREE.CatmullRomCurve3( pts, true, 'catmullrom', tension.value );
    curve.closed = true;
    const curveGeometry = new THREE.BufferGeometry();
    curveGeometry.vertices = curve.getPoints(75);
    curveGeometry.translate(0, 1, 0);

    const newCenterLocation = findCenterOfObject(pts)
    centralPoint.position.set(newCenterLocation.x, newCenterLocation.y, newCenterLocation.z)

    return curveGeometry;
}

export const createPoint = (position, scene, color = 'white' ) => {
    const viewGeometry = new THREE.BoxGeometry(15, 50, 15, 1, 3, 1);
    viewGeometry.translate(0, .75, 0);
    const viewMaterial = new THREE.MeshBasicMaterial({color: color, wireframe: false, transparent: true, opacity: .5});
    const view = new THREE.Mesh(viewGeometry, viewMaterial);
    view.position.copy(position);
    scene.add(view);
    return view;
}
export const adjustableShape = (scene, controls, rayCaster, controlPoints, plane, mouse, tension ) => {
    createCenterPoint(controlPoints, scene)

    const curveMaterial = new THREE.LineBasicMaterial({color: "white"});
    const curveLine = new THREE.Line(createCurveGeometry(controlPoints, tension), curveMaterial);

    const extrudeSettings = { amount: 1, bevelEnabled: false, depth: 20};
    const points = [];
    let shape = null;
    let shapeGeometry;
    const shapeMaterial = new THREE.MeshBasicMaterial({color:'red'})
    const shapeMesh = new THREE.Mesh(shapeGeometry, shapeMaterial);

    let intersects;
    let dragging = false;
    let dragObject;
    const pointOfIntersection = new THREE.Vector3();
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const shift = new THREE.Vector3();

    watch(tension, () => {
        curveLine.geometry.dispose();
        curveLine.geometry = createCurveGeometry(controlPoints, tension);
        extrudeMesh()
    })

    shapeMesh.castShadow = true
    scene.add(shapeMesh);
    scene.add(curveLine);
    curveLine.geometry.vertices.forEach((vertex, index)=>{
        points.push(new THREE.Vector2(vertex.x, vertex.z)); // fill the array of points with THREE.Vector2() for re-use
    });
    const extrudeMesh = () => {
        curveLine.geometry.vertices.forEach((vertex, index)=>{
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

    const onMouseDown = () => {
        intersects = rayCaster.intersectObjects(controlPoints);
        if (intersects.length > 0){
            controls.enableRotate = false;
            dragObject = intersects[0].object;
            plane.setFromNormalAndCoplanarPoint(planeNormal, intersects[0].point);
            shift.subVectors(dragObject.position, intersects[0].point);
            dragging = true;
        }
    }

    const onMouseUp = () => {
        controls.enableRotate = false;
        dragObject = null;
        dragging = false;
    }

    const onMouseMove = (event) => {
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        if (intersects?.length === 0 || !dragging) return;
        rayCaster.ray.intersectPlane(plane, pointOfIntersection);
        dragObject.position.copy(pointOfIntersection).add(shift);
        curveLine.geometry.dispose();
        curveLine.geometry = createCurveGeometry(controlPoints, tension);
        extrudeMesh();
    }

    window.addEventListener("mousedown", onMouseDown, false);
    window.addEventListener("mouseup", onMouseUp, false);
    window.addEventListener("mousemove", onMouseMove, false);
}

