export default /* glsl */`
uniform bool receiveShadow;
uniform vec3 ambientLightColor;
uniform vec3 lightProbe[ 9 ];
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
\tfloat x = normal.x, y = normal.y, z = normal.z;
\tvec3 result = shCoefficients[ 0 ] * 0.886227;
\tresult += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
\tresult += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
\tresult += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
\tresult += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
\tresult += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
\tresult += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
\tresult += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
\tresult += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
\treturn result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
\tvec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
\tvec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
\treturn irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
\tvec3 irradiance = ambientLightColor;
\treturn irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
\t#if defined ( LEGACY_LIGHTS )
\t\tif ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
\t\t\treturn pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
\t\t}
\t\treturn 1.0;
\t#else
\t\tfloat distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
\t\tif ( cutoffDistance > 0.0 ) {
\t\t\tdistanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
\t\t}
\t\treturn distanceFalloff;
\t#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
\treturn smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
\tstruct DirectionalLight {
\t\tvec3 direction;
\t\tvec3 color;
\t};
\tuniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
\tvoid getDirectionalLightInfo( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight light ) {
\t\tlight.color = directionalLight.color;
\t\tlight.direction = directionalLight.direction;
\t\tlight.visible = true;
\t}
#endif
#if NUM_POINT_LIGHTS > 0
\tstruct PointLight {
\t\tvec3 position;
\t\tvec3 color;
\t\tfloat distance;
\t\tfloat decay;
\t};
\tuniform PointLight pointLights[ NUM_POINT_LIGHTS ];
\tvoid getPointLightInfo( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight light ) {
\t\tvec3 lVector = pointLight.position - geometry.position;
\t\tlight.direction = normalize( lVector );
\t\tfloat lightDistance = length( lVector );
\t\tlight.color = pointLight.color * step( lightDistance, pointLight.distance );
\t\tlight.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
\t\tlight.visible = ( light.color != vec3( 0.0 ) );
\t}
#endif
#if NUM_SPOT_LIGHTS > 0
\tstruct SpotLight {
\t\tvec3 position;
\t\tvec3 direction;
\t\tvec3 color;
\t\tfloat distance;
\t\tfloat decay;
\t\tfloat coneCos;
\t\tfloat penumbraCos;
\t};
\tuniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
\tvoid getSpotLightInfo( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight light ) {
\t\tvec3 lVector = spotLight.position - geometry.position;
\t\tlight.direction = normalize( lVector );
\t\tfloat angleCos = dot( light.direction, spotLight.direction );
\t\tfloat spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
\t\tif ( spotAttenuation > 0.0 ) {
\t\t\tfloat lightDistance = length( lVector );
\t\t\tlight.color = spotLight.color * spotAttenuation;
\t\t\tlight.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
\t\t\tlight.visible = ( light.color != vec3( 0.0 ) );
\t\t} else {
\t\t\tlight.color = vec3( 0.0 );
\t\t\tlight.visible = false;
\t\t}
\t}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
\tstruct RectAreaLight {
\t\tvec3 color;
\t\tvec3 position;
\t\tvec3 halfWidth;
\t\tvec3 halfHeight;
\t};
\tuniform sampler2D ltc_1;\tuniform sampler2D ltc_2;
\tuniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
\tstruct HemisphereLight {
\t\tvec3 direction;
\t\tvec3 skyColor;
\t\tvec3 groundColor;
\t};
\tuniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
\tvec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
\t\tfloat dotNL = dot( normal, hemiLight.direction );
\t\tfloat hemiDiffuseWeight = 0.5 * dotNL + 0.5;
\t\tvec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
\t\treturn irradiance;
\t}
#endif
`