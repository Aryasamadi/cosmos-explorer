import * as THREE from 'three';

export interface SkyDome {
  mesh: THREE.Mesh;
  setSunAltitude(altitudeDeg: number): void;
}

export function createSkyDome(radius = 230): SkyDome {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunAltitude: { value: -20 },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform float uSunAltitude;

      void main() {
        float t = clamp(vDirection.y, 0.0, 1.0);
        float day = smoothstep(-10.0, 4.0, uSunAltitude);
        vec3 night = mix(vec3(0.004, 0.006, 0.016), vec3(0.009, 0.016, 0.042), pow(t, 0.55));
        vec3 dayColor = mix(vec3(0.33, 0.47, 0.65), vec3(0.018, 0.075, 0.25), pow(t, 0.62));
        vec3 color = mix(night, dayColor, day);

        float twilight = exp(-pow((uSunAltitude + 3.5) / 5.0, 2.0));
        color += vec3(0.82, 0.30, 0.08) * twilight * (1.0 - smoothstep(0.0, 0.32, t)) * 0.55;
        color *= mix(0.35, 1.0, smoothstep(-0.3, 0.02, vDirection.y));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  mesh.renderOrder = -100;
  mesh.name = 'sky-dome';

  return {
    mesh,
    setSunAltitude(altitudeDeg: number): void {
      material.uniforms.uSunAltitude!.value = altitudeDeg;
    },
  };
}
