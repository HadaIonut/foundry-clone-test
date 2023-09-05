export default /* glsl */`
GeometricContext geometry;
geometry.position = - vViewPosition;
geometry.normal = normal;
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
#ifdef USE_CLEARCOAT
\tgeometry.clearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
\tfloat dotNVi = saturate( dot( normal, geometry.viewDir ) );
\tif ( material.iridescenceThickness == 0.0 ) {
\t\tmaterial.iridescence = 0.0;
\t} else {
\t\tmaterial.iridescence = saturate( material.iridescence );
\t}
\tif ( material.iridescence > 0.0 ) {
\t\tmaterial.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
\t\tmaterial.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
\t}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
\tPointLight pointLight;
\t#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
\tPointLightShadow pointLightShadow;
\t#endif
\t#pragma unroll_loop_start
\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
\t\tpointLight = pointLights[ i ];
\t\tgetPointLightInfo( pointLight, geometry, directLight );
\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
\t\tpointLightShadow = pointLightShadows[ i ];
\t\tdirectLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
\t\t#endif
\t\tRE_Direct( directLight, geometry, material, reflectedLight );
\t}
\t#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
\tSpotLight spotLight;
\tvec4 spotColor;
\tvec3 spotLightCoord;
\tbool inSpotLightMap;
\t#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
\tSpotLightShadow spotLightShadow;
\t#endif
\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
\t\tspotLight = spotLights[ i ];
\t\tgetSpotLightInfo( spotLight, geometry, directLight );
\t\tif ( !directLight.visible ) { continue; }
\t\t#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
\t\t#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
\t\t#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
\t\t#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
\t\t#else
\t\t#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
\t\t#endif
\t\t#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
\t\t\tspotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
\t\t\tinSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
\t\t\tspotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
\t\t\tdirectLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
\t\t#endif
\t\t#undef SPOT_LIGHT_MAP_INDEX
\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
\t\tspotLightShadow = spotLightShadows[ i ];
\t\tdirectLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
\t\t#endif
\t\tRE_Direct( directLight, geometry, material, reflectedLight );
\t}
\t#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
\tDirectionalLight directionalLight;
\t#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
\tDirectionalLightShadow directionalLightShadow;
\t#endif
\t#pragma unroll_loop_start
\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
\t\tdirectionalLight = directionalLights[ i ];
\t\tgetDirectionalLightInfo( directionalLight, geometry, directLight );
\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
\t\tdirectionalLightShadow = directionalLightShadows[ i ];
\t\tdirectLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
\t\t#endif
\t\tRE_Direct( directLight, geometry, material, reflectedLight );
\t}
\t#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
\tRectAreaLight rectAreaLight;
\t#pragma unroll_loop_start
\tfor ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
\t\trectAreaLight = rectAreaLights[ i ];
\t\tRE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
\t}
\t#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
\tvec3 iblIrradiance = vec3( 0.0 );
\tvec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
\tirradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
\t#if ( NUM_HEMI_LIGHTS > 0 )
\t\t#pragma unroll_loop_start
\t\tfor ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
\t\t\tirradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );
\t\t}
\t\t#pragma unroll_loop_end
\t#endif
#endif
#if defined( RE_IndirectSpecular )
\tvec3 radiance = vec3( 0.0 );
\tvec3 clearcoatRadiance = vec3( 0.0 );
#endif
`