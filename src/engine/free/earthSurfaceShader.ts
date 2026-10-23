export const EARTH_CITY_LIGHT_INTENSITY = 1.25;

/** Shared day/night color model for the base sphere and detail tiles. */
export const EARTH_SURFACE_COLOR_GLSL = `
uniform vec3 uSunDirection;
uniform float uCityLightIntensity;

vec3 earthSurfaceColor(vec3 dayColor, vec3 nightLights, float sunDot) {
  float dayFactor = smoothstep(-0.10, 0.14, sunDot);
  float cityMask = 1.0 - smoothstep(-0.16, 0.04, sunDot);

  // Keep continents recognizable at night; never crush the dark side to
  // pure black. This is a display baseline, not a physical radiance.
  vec3 nightBase = dayColor * vec3(0.055, 0.075, 0.12);
  nightBase += dayColor * 0.025;
  vec3 nightColor =
    nightBase + nightLights * vec3(1.0, 0.84, 0.58) * uCityLightIntensity * cityMask;

  vec3 dayLit = dayColor * (0.34 + 1.08 * max(sunDot, 0.0));
  return mix(nightColor, dayLit, dayFactor);
}
`;
