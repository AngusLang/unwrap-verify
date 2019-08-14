const vertexShader = `
attribute float quality;

varying float vQuality;

uniform vec3 scale;
uniform float transform;

void main()
{
  vec3 uvPosition = scale * vec3(uv - 0.5, mix(0.0, position.z, transform));
  vec4 mvPosition = modelViewMatrix * vec4(mix(uvPosition, position, transform), 1.0);
  vQuality = quality;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform sampler2D colorMap;

varying float vQuality;

void main()
{
  gl_FragColor = vec4(texture2D(colorMap, vec2(1.0 - vQuality, 0.5)).rgb, 1.0);
}
`;

const uniforms = {
  colorMap: {value: null},
  scale: {value: new THREE.Vector3(1, 1, 1)},
  transform: {value: 0.0}
};

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms
});

var v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
var u0 = new THREE.Vector2(), u1 = new THREE.Vector2(), u2 = new THREE.Vector2();
var area_sum = 0;
function _compute_area(vx0, vx1, vx2, uv0, uv1, uv2, i, texel_area, geometry_area) {
  vx1.sub(vx0);
  vx2.sub(vx0);
  var area = vx1.cross(vx2).length();
  geometry_area[i] = geometry_area[i + 1] = geometry_area[i + 2] = area;
  area_sum += area;

  uv2.sub(uv0);
  uv1.sub(uv0);
  // for more percision, times 100
  texel_area[i] = texel_area[i + 1] = texel_area[i + 2] =  Math.abs(uv2.cross(uv1)) * 100 / 1.2;
}

function varify(object) {

  if (!object.isMesh) {
    return;
  }

  var geometry = object.geometry;
  if (!geometry.isBufferGeometry)
  {
    return;
  }

  var position = geometry.getAttribute('position')
  var uv = geometry.getAttribute('uv');
  if (!uv) {
    throw new Error('geometry must have uv attribute');
  }

  var positionData = position.array;
  var uvData = uv.array;
  
  if (geometry.index) {
    // expand index
    var indexData = geometry.index.array;
    var indexCount = geometry.index.count;
    var newPosition = new Float32Array(indexCount * 3);
    var newUv = new Float32Array(indexCount * 2);
    for (let i = 0; i < indexCount; ++i) {
      var index_ptr = indexData[i];
      v0.fromArray(positionData, index_ptr * 3).toArray(newPosition, i * 3);
      u0.fromArray(uvData, index_ptr * 2).toArray(newUv, i * 2);
    }
    position.setArray(newPosition);
    uv.setArray(newUv);
  
    positionData = newPosition;
    uvData = newUv;
  }

  area_sum = 0;
  var vertexCount = position.count;
  var geometry_area = new Float32Array(vertexCount);
  var texel_area = new Float32Array(vertexCount);
  for (var i = 0; i < vertexCount; i += 3) {
    v0.fromArray(positionData, i * 3);
    v1.fromArray(positionData, (i + 1) * 3);
    v2.fromArray(positionData, (i + 2)  * 3);

    u0.fromArray(uvData, i * 2);
    u1.fromArray(uvData, (i + 1) * 2);
    u2.fromArray(uvData, (i + 2) * 2);

    _compute_area(v0, v1, v2, u0, u1, u2, i, texel_area, geometry_area);
  }

  var quality = new Float32Array(vertexCount);
  for (let i = 0; i < quality.length; i += 3) {
    var density = texel_area[i] / (geometry_area[i] / area_sum * 100);
    quality[i] = quality[i + 1] = quality[i + 2] = density;
  }

  geometry.computeBoundingBox();
  var box = geometry.boundingBox;
  box.getSize(uniforms.scale.value);

  geometry.addAttribute('quality', new THREE.BufferAttribute(quality, 1, false));

  object.material = material;
}

function setColorMap(name) {
  var texture = new THREE.TextureLoader().load(`colormap/${name}.png`);
  material.uniforms.colorMap.value = texture;
  material.needsUpdate = true;
}

var transform = document.getElementById('transform');
var onchange = function (event) {
  uniforms.transform.value = this.value;
}.bind(transform);

transform.addEventListener('mousedown', function() {
  if (control) {
    control.enabled = false;
  }
  window.addEventListener('mousemove', onchange, false);
  window.addEventListener('mouseup', function() {
    window.removeEventListener('mousemove', onchange);
    if (control) {
      control.enabled = true;
    }
  }, false);
}, false);
