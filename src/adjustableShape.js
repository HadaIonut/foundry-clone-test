import * as THREE from 'three'
import {watch} from "vue";

export const adjustableShape = (scene, controls, rayCaster, controlPoints, plane, mouse, tension ) => {

    const createCurveGeometry = () => {
        const pts = [];
        controlPoints.forEach(pt => {
            pts.push(pt.position);
        });
        const curve = new THREE.CatmullRomCurve3( pts, true, 'catmullrom', tension.value );
        curve.closed = true;
        const curveGeometry = new THREE.BufferGeometry();
        curveGeometry.vertices = curve.getPoints(75);
        curveGeometry.translate(0, 1, 0);
        return curveGeometry;
    }

    watch(tension, () => {
        curveLine.geometry.dispose();
        curveLine.geometry = createCurveGeometry();
        extrudeMesh()
    })

    const curveMaterial = new THREE.LineBasicMaterial({color: "white"});
    const curveLine = new THREE.Line(createCurveGeometry(), curveMaterial);
    scene.add(curveLine);

    const extrudeSettings = { amount: 1, bevelEnabled: false, depth: 20};
    const points = [];
    let shape = null;
    let shapeGeometry;
    const shapeMaterial = new THREE.MeshBasicMaterial({color:'red'})
    const shapeMesh = new THREE.Mesh(shapeGeometry, shapeMaterial);
    shapeMesh.castShadow = true
    scene.add(shapeMesh);
    curveLine.geometry.vertices.forEach((vertex, index)=>{
        points.push(new THREE.Vector2(vertex.x, vertex.z)); // fill the array of points with THREE.Vector2() for re-use
    });
    function extrudeMesh(){
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

    window.addEventListener("mousedown", onMouseDown, false);
    window.addEventListener("mouseup", onMouseUp, false);
    window.addEventListener("mousemove", onMouseMove, false);

    let intersects;
    let dragging = false;
    let dragObject;
    const pointOfIntersection = new THREE.Vector3();
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const shift = new THREE.Vector3();

    function onMouseDown(event){
        intersects = rayCaster.intersectObjects(controlPoints);
        if (intersects.length > 0){
            controls.enableRotate = false;
            dragObject = intersects[0].object;
            plane.setFromNormalAndCoplanarPoint(planeNormal, intersects[0].point);
            shift.subVectors(dragObject.position, intersects[0].point);
            dragging = true;
        }
    }

    function onMouseUp(event){
        controls.enableRotate = false;
        dragObject = null;
        dragging = false;
    }

    function onMouseMove(event){
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        if (intersects?.length === 0 || !dragging) return;
        rayCaster.ray.intersectPlane(plane, pointOfIntersection);
        dragObject.position.copy(pointOfIntersection).add(shift);
        curveLine.geometry.dispose();
        curveLine.geometry = createCurveGeometry();
        extrudeMesh();
    }
}

