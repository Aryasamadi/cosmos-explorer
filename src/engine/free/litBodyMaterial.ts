import * as THREE from 'three';

export interface LitBodyMaterial {
  material: THREE.ShaderMaterial;
  sunDirection: THREE.Vector3;
}

/**
 * Minimal diffuse material for a spherical body. The Sun direction is supplied
 * per body, so the display position of the Sun mesh never drives illumination.
 */
export function createLitBodyMaterial(
  map: THREE.Texture,
  ambient = 0.08,
): LitBodyMaterial {
  const sunDirection = new THREE.Vector3(1, 0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uSunDirection: { value: sunDirection },
      uAmbient: { value: ambient },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <common>

      uniform sampler2D map;
      uniform vec3 uSunDirection;
      uniform float uAmbient;

      varying vec2 vUv;
      varying vec3 vWorldNormal;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        float diffuse = max(dot(normal, normalize(uSunDirection)), 0.0);
        vec3 surface = texture2D(map, vUv).rgb;
        vec3 color = surface * (uAmbient + (1.0 - uAmbient) * diffuse);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
  return { material, sunDirection };
}
