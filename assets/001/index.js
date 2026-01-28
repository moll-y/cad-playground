const canvas = document.getElementById("canvas");
if (!canvas) {
  throw new Error("canvas is not defined.");
}

const gl = canvas.getContext("webgl2");
if (!gl) {
  throw new Error("webgl2 context is not defined.");
}

const vshader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(
  vshader,
  `#version 300 es                        \n
                                          \n
  layout (location = 0) in vec4 position; \n
  layout (location = 1) in vec4 color;    \n
                                          \n
  out vec4 in_color;                      \n
                                          \n
  void main(void) {                       \n
      gl_Position = position;             \n
      in_color = color;                   \n
  }`,
);

gl.compileShader(vshader);
if (!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
  throw new Error(`could not compile vshader: ${gl.getShaderInfoLog(vshader)}`);
}

const fshader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(
  fshader,
  `#version 300 es                        \n
                                          \n
  precision highp float;                  \n
                                          \n
  in vec4 in_color;                       \n
  out vec4 color;                         \n
                                          \n
  void main(void) {                       \n
      color = in_color;                   \n
  }`,
);

gl.compileShader(fshader);
if (!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
  throw new Error(`could not compile fshader: ${gl.getShaderInfoLog(fshader)}`);
}

const program = gl.createProgram();
gl.attachShader(program, vshader);
gl.attachShader(program, fshader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`could not link program: ${gl.getProgramInfoLog(program)}`);
}

gl.deleteShader(vshader);
gl.deleteShader(fshader);

// Vertex array object.
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// Element buffer object.
const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(
  gl.ELEMENT_ARRAY_BUFFER,
  new Uint32Array([0, 1, 2, 0, 1, 2]),
  gl.STATIC_DRAW,
);

// Vertex buffer object.
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
// position = 0
gl.vertexAttribPointer(
  0,
  4,
  gl.FLOAT,
  false,
  4 * Float32Array.BYTES_PER_ELEMENT,
  0,
);
gl.enableVertexAttribArray(0);

// Color buffer object.
const cbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
// position = 1
gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(1);

function camera({ x, y, z }) {
  return { x, y, z: z + 1 };
}

function project({ x, y, z }) {
  // Focal length of the camera.
  const g = 0.1;
  const s = 1.0;
  const n = 0.1;
  // Infinite projection.
  return [x * (g / s), y * g, z - n, z];
}

const zero = document.timeline.currentTime;

gl.useProgram(program);
gl.bindVertexArray(vao);

function render(timestamp) {
  const elapsed = timestamp - zero;

  // Enable depth testing
  gl.enable(gl.DEPTH_TEST);
  // Near things obscure far things
  gl.depthFunc(gl.LEQUAL);
  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // First triangle.
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...project(camera({ x: 0.8, y: 0.0, z: 0.2 + elapsed * 0.0001 - 1 })),
      ...project(camera({ x: 0.9, y: 0.2, z: 0.2 + elapsed * 0.0001 - 1 })),
      ...project(camera({ x: 1.0, y: 0.0, z: 0.2 + elapsed * 0.0001 - 1 })),
    ]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...[1.0, 0.0, 0.0, 1.0],
      ...[1.0, 0.0, 0.0, 1.0],
      ...[1.0, 0.0, 0.0, 1.0],
    ]),
    gl.STATIC_DRAW,
  );
  gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);

  // Second triangle.
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...project(camera({ x: 0.8, y: 0.0, z: elapsed * 0.0005 - 1 })),
      ...project(camera({ x: 0.9, y: 0.2, z: elapsed * 0.0005 - 1 })),
      ...project(camera({ x: 1.0, y: 0.0, z: elapsed * 0.0005 - 1 })),
    ]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...[0.0, 0.0, 0.0, 1.0],
      ...[0.0, 0.0, 0.0, 1.0],
      ...[0.0, 0.0, 0.0, 1.0],
    ]),
    gl.STATIC_DRAW,
  );
  gl.drawElements(
    gl.TRIANGLES,
    3,
    gl.UNSIGNED_INT,
    3 * Uint32Array.BYTES_PER_ELEMENT,
  );

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
