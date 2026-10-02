import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Three-step gradient map that gives MeshToonMaterial its cel-shaded bands. */
const gradientMap = (() => {
  const data = new Uint8Array([110, 190, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const toonCache = new Map<string, THREE.MeshToonMaterial>();

/** Cel-shaded material; cached per colour so meshes share GPU programs. */
export function toon(color: THREE.ColorRepresentation, opts: { map?: THREE.Texture } = {}) {
  if (opts.map) {
    return new THREE.MeshToonMaterial({ color, gradientMap, map: opts.map });
  }
  const key = new THREE.Color(color).getHexString();
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap });
    toonCache.set(key, m);
  }
  return m;
}

/** Unlit material for glowing parts (bulbs, lamps). */
export function glow(color: THREE.ColorRepresentation) {
  return new THREE.MeshBasicMaterial({ color });
}

const OUTLINE_VERTEX = /* glsl */ `
uniform float thickness;
void main() {
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz += n * thickness;
  gl_Position = projectionMatrix * mv;
}`;

const OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 color;
void main() { gl_FragColor = vec4(color, 1.0); }`;

const outlineMaterials = new Map<string, THREE.ShaderMaterial>();

function outlineMaterial(thickness: number, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color);
  const key = `${thickness.toFixed(4)}-${c.getHexString()}`;
  let m = outlineMaterials.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness }, color: { value: c } },
      vertexShader: OUTLINE_VERTEX,
      fragmentShader: OUTLINE_FRAGMENT,
      side: THREE.BackSide,
    });
    outlineMaterials.set(key, m);
  }
  return m;
}

const outlineGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * A smooth-normal copy of a geometry for the inverted-hull outline. Boxes and
 * cylinders have split normals, which would open gaps at the edges when the
 * hull is pushed outwards, so we merge vertices by position first.
 */
function outlineGeometry(source: THREE.BufferGeometry) {
  let g = outlineGeometryCache.get(source);
  if (g) return g;
  const positionOnly = new THREE.BufferGeometry();
  positionOnly.setAttribute('position', source.getAttribute('position').clone());
  if (source.index) positionOnly.setIndex(source.index.clone());
  g = mergeVertices(positionOnly, 1e-4);
  g.computeVertexNormals();
  outlineGeometryCache.set(source, g);
  return g;
}

export const OUTLINE_COLOR = 0x1d2a1b;

/** Add a cartoon outline to a mesh (inverted hull, drawn with back faces). */
export function addOutline(mesh: THREE.Mesh, thickness = 0.03, color: THREE.ColorRepresentation = OUTLINE_COLOR) {
  const hull = new THREE.Mesh(outlineGeometry(mesh.geometry), outlineMaterial(thickness, color));
  hull.name = 'outline';
  hull.castShadow = false;
  hull.receiveShadow = false;
  mesh.add(hull);
  return hull;
}

/** Convenience: make a shadowed, outlined mesh in one call. */
export function solid(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: { outline?: number | false; shadow?: boolean } = {},
) {
  const mesh = new THREE.Mesh(geometry, material);
  const shadow = opts.shadow ?? true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  if (opts.outline !== false) addOutline(mesh, opts.outline ?? 0.03);
  return mesh;
}

export const PALETTE = {
  pepeSkin: 0x5aa84a,
  pepeSkinDark: 0x3e7f33,
  pepeShirt: 0x2f6fd6,
  pepeShorts: 0x8b5a2b,
  eyeWhite: 0xffffff,
  pupil: 0x141a14,
  mouthLine: 0x1e2a1a,
  lip: 0xc9433a,
  grass: 0x7ccd5f,
  stone: 0xc9c2b6,
  water: 0x5fb8e8,
  sand: 0xe8d9a8,
  wood: 0xa0713d,
  woodDark: 0x6e4a26,
  pastelPink: 0xf7b9c9,
  pastelYellow: 0xf9e79f,
  pastelMint: 0xa8e6cf,
  pastelLilac: 0xcdb4e4,
  pastelPeach: 0xffd3a8,
  pastelBlue: 0xaed9f5,
  roofRed: 0xd9534f,
  roofTeal: 0x3e9a8f,
  roofPlum: 0x7b4f9d,
  roofOrange: 0xe88a3b,
  leaf: 0x4caf50,
  leafLight: 0x6fd36a,
  trunk: 0x7a4b25,
  gold: 0xf5c542,
  neonGreen: 0x4dff88,
} as const;
